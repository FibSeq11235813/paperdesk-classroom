import {defaultToolPolicy,normalizeToolPolicy} from "./public/tool-policy.mjs";
import {defaultClassTimer,updateClassTimer} from "./public/class-timer-state.mjs";
import {createServer} from "node:http";
import {randomBytes,randomInt,createHash,timingSafeEqual} from "node:crypto";
import {mkdirSync,createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {resolve,extname,sep,join} from "node:path";
import {fileURLToPath} from "node:url";
import {DatabaseSync} from "node:sqlite";
import {parseArgs} from "node:util";

const publicDir=fileURLToPath(new URL("./public/",import.meta.url));
const dataDir=resolve(process.env.PAPERDESK_DATA || fileURLToPath(new URL("./data/",import.meta.url)));
mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(join(dataDir,"classroom.sqlite"));
db.exec(`
  PRAGMA foreign_keys=ON;
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY, title TEXT NOT NULL, teacher_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS slides (
    id INTEGER PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    label TEXT NOT NULL, image BLOB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    slide INTEGER NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    name TEXT NOT NULL, time INTEGER NOT NULL, image BLOB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    room TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    name TEXT NOT NULL,
    student_hash TEXT NOT NULL,
    joined INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    current_slide INTEGER,
    work_version INTEGER NOT NULL DEFAULT 0,
    board_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS students_room_idx ON students(room, joined);
`);
if(!db.prepare("PRAGMA table_info(slides)").all().some(column=>column.name==="graph"))db.exec("ALTER TABLE slides ADD COLUMN graph TEXT");
if(!db.prepare("PRAGMA table_info(slides)").all().some(column=>column.name==="pdf"))db.exec("ALTER TABLE slides ADD COLUMN pdf BLOB");
if(!db.prepare("PRAGMA table_info(submissions)").all().some(column=>column.name==="work"))db.exec("ALTER TABLE submissions ADD COLUMN work TEXT");
if(!db.prepare("PRAGMA table_info(rooms)").all().some(column=>column.name==="timer"))db.exec("ALTER TABLE rooms ADD COLUMN timer TEXT");
if(!db.prepare("PRAGMA table_info(rooms)").all().some(column=>column.name==="tools"))db.exec("ALTER TABLE rooms ADD COLUMN tools TEXT");
const query=Object.fromEntries(Object.entries({
  room:"SELECT * FROM rooms WHERE code=?",
  create:"INSERT INTO rooms(code,title,teacher_hash) VALUES(?,?,?)",
  remove:"DELETE FROM rooms WHERE code=?",
  slides:"SELECT id,label,graph,CASE WHEN pdf IS NOT NULL THEN 1 ELSE 0 END AS native FROM slides WHERE room=? ORDER BY id",
  addSlide:"INSERT INTO slides(room,label,image,graph,pdf) VALUES(?,?,?,?,?)",
  slide:"SELECT image,pdf FROM slides WHERE room=? AND id=?",
  submissions:"SELECT id,slide,name,time FROM submissions WHERE room=? ORDER BY id DESC",
  addSubmission:"INSERT INTO submissions(room,slide,name,time,image,work) VALUES(?,?,?,?,?,?)",
  submission:"SELECT image,slide,work FROM submissions WHERE room=? AND id=?",
  students:"SELECT id,name,joined,last_seen,last_activity,current_slide,work_version FROM students WHERE room=? ORDER BY joined",
  student:"SELECT * FROM students WHERE room=? AND id=?",
  addStudent:"INSERT INTO students(id,room,name,student_hash,joined,last_seen,last_activity,current_slide,work_version,board_json) VALUES(?,?,?,?,?,?,?,?,0,'{}')",
  heartbeat:"UPDATE students SET last_seen=?, current_slide=? WHERE room=? AND id=?",
  heartbeatWork:"UPDATE students SET last_seen=?, last_activity=?, current_slide=?, work_version=work_version+1, board_json=? WHERE room=? AND id=?",
  studentWork:"SELECT board_json,work_version,current_slide,last_seen,last_activity,name FROM students WHERE room=? AND id=?"
}).map(([name,sql])=>[name,db.prepare(sql)]));

const types={".webp":"image/webp",".png":"image/png",".jpg":"image/jpeg",".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
  ".wasm":"application/wasm",".pdf":"application/pdf"};
const hash=token=>createHash("sha256").update(token).digest("hex");
function bearer(req) {
  return req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1]||null;
}
function authorized(req,room) {
  const token=bearer(req);
  return !!token && timingSafeEqual(Buffer.from(hash(token)),Buffer.from(room.teacher_hash));
}
function studentAuthorized(req,student) {
  const token=bearer(req);
  return !!token && !!student && timingSafeEqual(Buffer.from(hash(token)),Buffer.from(student.student_hash));
}
function fail(status,message){throw Object.assign(new Error(message),{status});}
function send(res,status,body,type="application/json; charset=utf-8") {
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store"});
  res.end(type.startsWith("application/json")?JSON.stringify(body):body);
}
async function json(req,max=4096) {
  if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"]||"")) fail(415,"Expected JSON.");
  if (Number(req.headers["content-length"])>max) fail(413,"This image is too large.");
  const chunks=[];
  let size=0;
  for await (const chunk of req.iterator({destroyOnReturn:false})) {
    size+=chunk.length;
    if(size>max) fail(413,"This image is too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { fail(400,"Invalid request."); }
}
function label(value,max,fallback) {
  return (typeof value==="string"?value.trim().slice(0,max):"")||fallback;
}
function jpeg(value) {
  if(typeof value!=="string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
    fail(400,"Expected a JPEG image.");
  const bytes=Buffer.from(value.slice(23),"base64");
  if(bytes.length>1_800_000) fail(413,"This image is too large.");
  if(bytes.length<16 || bytes[0]!==255 || bytes[1]!==216 || bytes.at(-2)!==255 || bytes.at(-1)!==217)
    fail(400,"Invalid JPEG image.");
  return bytes;
}
function studentBoardJson(value) {
  if(!value || typeof value!=="object" || Array.isArray(value) || value.version!==1)fail(400,"Invalid live whiteboard state.");
  if(!["slide","graph"].includes(value.view))fail(400,"Invalid live whiteboard view.");
  if(!Number.isSafeInteger(value.slide)||value.slide<1)fail(400,"Invalid live slide.");
  if(value.view==="graph"){
    if(typeof value.graphImage!=="string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.graphImage))fail(400,"Invalid graph preview.");
  } else {
    if(!Number.isFinite(value.sourceHeight)||value.sourceHeight<100||value.sourceHeight>10000||
       !Number.isFinite(value.logicalHeight)||value.logicalHeight<value.sourceHeight||value.logicalHeight>12000)fail(400,"Invalid whiteboard dimensions.");
    if(!Array.isArray(value.marks)||value.marks.length>3000)fail(400,"Invalid live annotations.");
    let totalPoints=0;
    const kinds=new Set(["pen","highlighter","line","rect","ellipse","arc","path","image","point"]);
    for(const mark of value.marks){
      if(!mark||!kinds.has(mark.kind)||!Array.isArray(mark.points)||!mark.points.length)fail(400,"Invalid live annotation.");
      totalPoints+=mark.points.length;
      if(totalPoints>120000||mark.points.some(point=>!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||Math.abs(point.x)>100000||Math.abs(point.y)>100000))fail(400,"Invalid live annotation points.");
      if(mark.kind==="image"&&(typeof mark.image!=="string"||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(mark.image)))fail(400,"Invalid live snippet image.");
    }
  }
  const text=JSON.stringify(value);
  if(Buffer.byteLength(text)>5_000_000)fail(413,"Live whiteboard state is too large.");
  return text;
}
async function api(req,res,path) {
  const method=req.method;
  if(path==="/api/config" && method==="GET")return send(res,200,{teacherPasswordRequired:!!process.env.TEACHER_PASSWORD});
  if(path==="/api/health" && method==="GET")return send(res,200,{ok:true});
  if(path==="/api/rooms" && method==="POST") {
    const body=await json(req);
    if (!body || typeof body!=="object") fail(400,"Invalid request.");
    if(process.env.TEACHER_PASSWORD && hash(body.password||"")!==hash(process.env.TEACHER_PASSWORD))fail(403,"Enter the teacher password.");
    const title=label(body.title,90,"Untitled lesson");
    const alphabet="abcdefghjkmnpqrstuvwxyz23456789";
    let code;
    for(let attempt=0;attempt<100;attempt++){
      const candidate=Array.from({length:4},()=>alphabet[randomInt(alphabet.length)]).join("");
      if(!query.room.get(candidate)){code=candidate;break;}
    }
    if(!code)fail(503,"Could not allocate a class code. Please try again.");
    const token=randomBytes(32).toString("base64url");
    query.create.run(code,title,hash(token));
    return send(res,201,{code,title,token});
  }

  const studentMatch=/^\/api\/rooms\/([a-z0-9]{4}|[a-f0-9]{12})\/students(?:\/([a-f0-9]{24})(?:\/(heartbeat|work))?)?$/i.exec(path);
  if(studentMatch) {
    const [,rawCode,studentId,action]=studentMatch;
    const code=rawCode.toLowerCase();
    const room=query.room.get(code);
    if(!room) fail(404,"Class session was not found or has been ended.");
    const teacher=authorized(req,room);

    if(method==="POST" && !studentId) {
      const body=await json(req);
      if(!body || typeof body!=="object") fail(400,"Invalid request.");
      const name=label(body.name,50,"Student");
      const id=randomBytes(12).toString("hex");
      const token=randomBytes(32).toString("base64url");
      const now=Date.now();
      query.addStudent.run(id,code,name,hash(token),now,now,now,null);
      return send(res,201,{id,name,token});
    }

    const student=studentId?query.student.get(code,studentId):null;
    if(studentId && !student) fail(404,"Student session was not found.");

    if(method==="GET" && !studentId) {
      if(!teacher) fail(403,"Teacher access is required.");
      return send(res,200,{students:query.students.all(code),serverTime:Date.now()});
    }

    if(method==="GET" && studentId && action==="work") {
      if(!teacher) fail(403,"Teacher access is required.");
      const row=query.studentWork.get(code,studentId);
      let board=null;
      try { board=row.board_json&&row.board_json!=="{}"?JSON.parse(row.board_json):null; } catch {}
      return send(res,200,{id:studentId,name:row.name,workVersion:row.work_version,currentSlide:row.current_slide,
        lastSeen:row.last_seen,lastActivity:row.last_activity,board,serverTime:Date.now()});
    }

    if(method==="POST" && studentId && action==="heartbeat") {
      if(!studentAuthorized(req,student)) fail(403,"Student access is required.");
      const body=await json(req,5_500_000);
      if(!body || typeof body!=="object") fail(400,"Invalid request.");
      const slide=body.currentSlide===null||body.currentSlide===undefined?null:Number(body.currentSlide);
      if(slide!==null && (!Number.isSafeInteger(slide)||!query.slide.get(code,slide))) fail(404,"Slide is unavailable.");
      const now=Date.now();
      if(body.board!==undefined){
        query.heartbeatWork.run(now,now,slide,studentBoardJson(body.board),code,studentId);
      } else {
        query.heartbeat.run(now,slide,code,studentId);
      }
      const updated=query.student.get(code,studentId);
      return send(res,200,{seen:true,workVersion:updated.work_version,serverTime:now});
    }

    fail(405,"Method is unavailable.");
  }
    const match=/^\/api\/rooms\/([a-z0-9]{4}|[a-f0-9]{12})(?:\/(slides|submissions)(?:\/([1-9]\d{0,12})(?:\/(pdf|work))?)?)?$/i.exec(path);
  if(!match) fail(404,"Unknown endpoint.");
  const [,rawCode,section,id,format]=match;
  const code=rawCode.toLowerCase();
  if(format&& !((section==="slides"&&format==="pdf")||(section==="submissions"&&format==="work")))fail(404,"Unknown endpoint.");
  const room=query.room.get(code);
  if(!room) fail(404,"Class session was not found or has been ended.");
  const teacher=authorized(req,room);
  if(!section && method==="GET") return send(res,200,{code,title:room.title,slides:query.slides.all(code).map(slide=>({...slide,graph:slide.graph?JSON.parse(slide.graph):null})),teacher,tools:room.tools?JSON.parse(room.tools):defaultToolPolicy(),timer:room.timer?JSON.parse(room.timer):defaultClassTimer(),serverTime:Date.now()});
  if(!section && method==="PATCH") {
    if(!teacher)fail(403,"Only the teacher can change class controls.");
    const body=await json(req,4096);
    const current=query.room.get(code);
    if(!current)fail(404,"Class session was not found.");
    if(body?.tools!==undefined){
      let tools;try{tools=normalizeToolPolicy(body.tools);}catch(error){fail(400,error.message);}
      db.prepare("UPDATE rooms SET tools=? WHERE code=?").run(JSON.stringify(tools),code);
      return send(res,200,{tools,serverTime:Date.now()});
    }
    const now=Date.now();let timer;
    try{timer=updateClassTimer(current.timer?JSON.parse(current.timer):defaultClassTimer(),body?.timer||{},now);}catch(error){fail(400,error.message);}
    db.prepare("UPDATE rooms SET timer=? WHERE code=?").run(JSON.stringify(timer),code);
    return send(res,200,{timer,serverTime:Date.now()});
  }
  if(!section && method==="DELETE") {
    if(!teacher) fail(403,"Teacher access is required.");
    query.remove.run(code);
    return send(res,200,{ended:true});
  }
  if(section==="slides" && method==="POST" && !id) {
    if(!teacher) fail(403,"Teacher access is required.");
    const body=await json(req,14_500_000);
    if (!body || typeof body!=="object") fail(400,"Invalid request.");
    let pdf=null;
    if(body.pdf!=null){
      if(typeof body.pdf!=="string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.pdf))fail(400,"Invalid PDF data.");
      pdf=Buffer.from(body.pdf,"base64");
      if(pdf.length>8*1024*1024)fail(413,"This native PDF page exceeds the 8 MB upload limit.");
      if(pdf.subarray(0,5).toString()!=="%PDF-")fail(400,"Expected a PDF page.");
    }
    const image=jpeg(body.image), slideLabel=label(body.label,90,"Revealed slide");
    if(!query.room.get(code)) fail(404,"Class session has ended.");
    if(query.slides.all(code).length>=100) fail(409,"This room already has 100 slides.");
    const {lastInsertRowid}=query.addSlide.run(code,slideLabel,image,body.graph?JSON.stringify(body.graph):null,pdf);
    return send(res,201,{id:Number(lastInsertRowid),label:slideLabel});
  }
  if(section==="slides" && method==="GET" && id) {
    const row=query.slide.get(code,Number(id));
    if(!row) fail(404,"Slide has not been revealed in this room.");
    if(format==="pdf"&&!row.pdf)fail(404,"This older slide has no native PDF source.");
    return send(res,200,format==="pdf"?row.pdf:row.image,format==="pdf"?"application/pdf":"image/jpeg");
  }
  if(section==="submissions" && method==="POST" && !id) {
    const body=await json(req,6_000_000);
    if (!body || typeof body!=="object") fail(400,"Invalid request.");
    if(!Number.isSafeInteger(body.slide) || !query.slide.get(code,body.slide)) fail(404,"Slide is unavailable.");
    if(query.submissions.all(code).length>=500) fail(409,"This room already has 500 submissions.");
    const name=label(body.name,50,"Student");
    let work=null;
    if(body.work!==undefined){
      const value=body.work;
      if(!value||value.version!==1||!["slide","graph"].includes(value.type))fail(400,"Invalid shared work.");
      const encoded=JSON.stringify(value);
      if(encoded.length>3_000_000)fail(413,"Shared annotations are too large.");
      if(value.type==="slide"){
        if(!Array.isArray(value.marks)||value.marks.length>3000)fail(400,"Invalid annotations.");
        let totalPoints=0;
        for(const mark of value.marks){
          if(!mark||!["pen","highlighter","line","rect","ellipse","arc","path","image"].includes(mark.kind)||!Array.isArray(mark.points)||!mark.points.length)fail(400,"Invalid annotation.");
          if(["line","rect","ellipse","image"].includes(mark.kind)&&mark.points.length!==2)fail(400,"Invalid shape points.");
          totalPoints+=mark.points.length;
          if(totalPoints>100000||mark.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000))fail(400,"Invalid annotation points.");
          if(!Number.isFinite(mark.width)||mark.width<=0||mark.width>60||!Number.isFinite(mark.opacity)||mark.opacity<0||mark.opacity>1)fail(400,"Invalid annotation style.");
          if(mark.kind==="image"&&(typeof mark.image!=="string"||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(mark.image)))fail(400,"Invalid snippet image.");
          if(mark.kind==="arc"&&(!Number.isFinite(mark.radius)||mark.radius<0||mark.radius>10000||!Number.isFinite(mark.start)||!Number.isFinite(mark.sweep)||Math.abs(mark.sweep)>Math.PI*2+.01))fail(400,"Invalid arc.");
        }
      }
      work=encoded;
    }
    query.addSubmission.run(code,body.slide,name,Date.now(),jpeg(body.image),work);
    return send(res,201,{shared:true});
  }
  if(section==="submissions" && method==="GET") {
    if(!teacher) fail(403,"Teacher access is required.");
    if(!id) return send(res,200,{submissions:query.submissions.all(code)});
    const row=query.submission.get(code,Number(id));
    if(!row) fail(404,"Submission was not found.");
    if(format==="work")return send(res,200,{slide:row.slide,native:!!query.slide.get(code,row.slide)?.pdf,work:row.work?JSON.parse(row.work):null});
    return send(res,200,row.image,"image/jpeg");
  }
  fail(405,"Method is unavailable.");
}
async function staticFile(req,res,path) {
  if(!["GET","HEAD"].includes(req.method)) fail(405,"Method is unavailable.");
  const relative=["/","/teach","/teach/","/join","/join/"].includes(path)?"index.html":decodeURIComponent(path.slice(1));
  const file=resolve(publicDir,relative);
  if(!file.startsWith(resolve(publicDir)+sep)) fail(404,"Not found.");
  const info=await stat(file).catch(()=>null);
  if(!info?.isFile()) fail(404,"Not found.");
  res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream",
    "Content-Length":info.size,"Cache-Control":path.startsWith("/vendor/")?"public, max-age=86400":"no-cache"});
  if(req.method==="HEAD") res.end(); else createReadStream(file).pipe(res);
}
const server=createServer(async(req,res)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("Content-Security-Policy","default-src 'self'; img-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; font-src 'self' blob: data:");
  try {
    const path=new URL(req.url,"http://localhost").pathname;
    if(path.startsWith("/api/")) await api(req,res,path);
    else await staticFile(req,res,path);
  } catch(error) {
    if(!error.status) console.error(error);
    if(!res.headersSent) send(res,error.status||500,{error:error.status?error.message:"Server error."});
    else res.destroy();
  }
});
server.requestTimeout=20_000;
const {values}=parseArgs({options:{host:{type:"string"},port:{type:"string"},strictPort:{type:"boolean"}}});
const host=values.host||process.env.HOST||"127.0.0.1";
const port=Number(values.port||process.env.PORT||4170);
server.listen(port,host,()=>console.log(`Paperdesk Classroom at http://${host}:${server.address().port}`));
