// Hosted adapter. Sites provisions DB (D1) and BUCKET (R2).
const encoder=new TextEncoder();
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value))),byte=>byte.toString(16).padStart(2,"0")).join("");
const random=length=>Array.from(crypto.getRandomValues(new Uint8Array(length)),byte=>byte.toString(16).padStart(2,"0")).join("");
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max,fallback)=>(typeof value==="string"?value.trim().slice(0,max):"")||fallback;
const response=(value,status=200,type="application/json; charset=utf-8")=>new Response(type.startsWith("application/json")?JSON.stringify(value):value,{status,headers:{"Content-Type":type,"Cache-Control":"no-store"}});
async function body(request,max=2_500_000){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))fail(415,"Expected JSON.");
  if(Number(request.headers.get("content-length"))>max)fail(413,"This page is too large.");
  const reader=request.body?.getReader();if(!reader)fail(400,"Empty request.");
  const chunks=[];let size=0;
  while(true){
    const {value,done}=await reader.read();if(done)break;
    size+=value.length;if(size>max){await reader.cancel();fail(413,"This page is too large.");}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let value;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{fail(400,"Invalid JSON.");}
  if(!value || typeof value!=="object" || Array.isArray(value))fail(400,"Invalid request.");
  return value;
}
function jpeg(value){
  if(typeof value!=="string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))fail(400,"Expected a JPEG image.");
  const bytes=Uint8Array.from(atob(value.slice(23)),char=>char.charCodeAt(0));
  if(bytes.length>1_800_000)fail(413,"This image is too large.");
  if(bytes.length<16||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)fail(400,"Invalid JPEG image.");
  return bytes;
}
function nativePDF(value){
  if(value==null)return null;
  if(typeof value!=="string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))fail(400,"Invalid PDF data.");
  const bytes=Uint8Array.from(atob(value),char=>char.charCodeAt(0));
  if(bytes.length>8*1024*1024)fail(413,"This native PDF page exceeds the 8 MB upload limit.");
  if(new TextDecoder().decode(bytes.subarray(0,5))!=="%PDF-")fail(400,"Expected a PDF page.");
  return bytes;
}
function graphJSON(value){
  if(value==null)return null;
  if(!value || typeof value!=="object" || !Array.isArray(value.rows) || value.rows.length>12)fail(400,"Invalid graph.");
  const json=JSON.stringify(value);if(json.length>16000)fail(400,"Graph is too large.");return json;
}
async function cloudAPI(request,env,path){
  const {DB,BUCKET}=env,method=request.method;
  const owner=request.headers.get("oai-authenticated-user-id");
  if(path==="/api/config")return response({teacherPasswordRequired:false,signInRequired:!owner});
  if(!DB || !BUCKET)fail(503,"Classroom storage has not been configured.");
  const first=(sql,...args)=>DB.prepare(sql).bind(...args).first();
  const all=async(sql,...args)=>(await DB.prepare(sql).bind(...args).all()).results;
  if(path==="/api/health") {
    await first("SELECT count(*) AS total FROM rooms");return response({ok:true});
  }
  if(path==="/api/rooms" && method==="POST"){
    if(!owner)fail(401,"Sign in to teach.");
    const input=await body(request,4096);
    const code=random(6),token=random(24); // 48 hex characters; kept in the teacher browser.
    const title=text(input.title,90,"Untitled lesson"),hash=await digest(token);
    const inserted=await DB.prepare("INSERT INTO rooms(code,title,teacher_hash,owner) SELECT ?,?,?,? WHERE (SELECT count(*) FROM rooms WHERE owner=?) < 8").bind(code,title,hash,owner,owner).run();
    if(!inserted.meta.changes)fail(409,"End an older class before starting another (8 active classes maximum).");
    return response({code,title,token},201);
  }
  const match=/^\/api\/rooms\/([a-f0-9]{12})(?:\/(slides|submissions)(?:\/([1-9]\d{0,12})(?:\/(pdf))?)?)?$/.exec(path);
  if(!match)fail(404,"Unknown endpoint.");
  const [,code,section,id,format]=match;
  if(format&&section!=="slides")fail(404,"Unknown endpoint.");
  const room=await first("SELECT * FROM rooms WHERE code=?",code);
  if(!room)fail(404,"Class session was not found or has been ended.");
  const token=request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32,64})$/)?.[1];
  const teacher=!!token && await digest(token)===room.teacher_hash;
  if(!section && method==="GET"){
    const slides=await all("SELECT id,label,graph,CASE WHEN pdf_key IS NOT NULL THEN 1 ELSE 0 END AS native FROM slides WHERE room=? ORDER BY id",code);
    return response({code,title:room.title,teacher,slides:slides.map(slide=>({...slide,graph:slide.graph?JSON.parse(slide.graph):null}))});
  }
  if(!section && method==="DELETE"){
    if(!teacher)fail(403,"Teacher access is required.");
    const objects=await all("SELECT object_key FROM slides WHERE room=? UNION ALL SELECT object_key FROM submissions WHERE room=? UNION ALL SELECT pdf_key AS object_key FROM slides WHERE room=? AND pdf_key IS NOT NULL",code,code,code);
    await DB.prepare("DELETE FROM rooms WHERE code=?").bind(code).run();
    // R2 deletes are retriable. Database access is revoked before cleanup starts.
    env.waitUntil(Promise.all(objects.map(row=>BUCKET.delete(row.object_key))));
    return response({ended:true});
  }
  if(section==="slides" && method==="POST" && !id){
    if(!teacher)fail(403,"Teacher access is required.");
    const input=await body(request,14_500_000),image=jpeg(input.image),graph=graphJSON(input.graph),pdf=nativePDF(input.pdf);
    const key=code+"/slides/"+random(12)+".jpg",pdfKey=pdf?code+"/slides/"+random(12)+".pdf":null,label=text(input.label,90,"Revealed slide");
    await BUCKET.put(key,image,{httpMetadata:{contentType:"image/jpeg"}});
    try{
      if(pdf)await BUCKET.put(pdfKey,pdf,{httpMetadata:{contentType:"application/pdf"}});
      const result=await DB.prepare("INSERT INTO slides(room,label,graph,object_key,pdf_key) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rooms WHERE code=?) AND (SELECT count(*) FROM slides WHERE room=?)<100").bind(code,label,graph,key,pdfKey,code,code).run();
      if(!result.meta.changes)fail(409,"Class ended or its 100-slide limit was reached.");
      return response({id:result.meta.last_row_id,label},201);
    }catch(error){await BUCKET.delete(key);if(pdfKey)await BUCKET.delete(pdfKey);throw error;}
  }
  if(section==="slides" && method==="GET" && id){
    const row=await first("SELECT object_key,pdf_key FROM slides WHERE room=? AND id=?",code,Number(id));
    if(!row)fail(404,"Slide has not been revealed in this room.");
    const key=format==="pdf"?row.pdf_key:row.object_key;
    if(!key)fail(404,"This older slide has no native PDF source.");
    const object=await BUCKET.get(key);
    if(!object)fail(404,"Slide source is unavailable.");
    return response(object.body,200,format==="pdf"?"application/pdf":"image/jpeg");
  }
  if(section==="submissions" && method==="POST" && !id){
    const input=await body(request);
    if(!Number.isSafeInteger(input.slide))fail(400,"Invalid slide.");
    const image=jpeg(input.image),name=text(input.name,50,"Student");
    const key=code+"/submissions/"+random(12)+".jpg";
    await BUCKET.put(key,image,{httpMetadata:{contentType:"image/jpeg"}});
    try{
      const result=await DB.prepare("INSERT INTO submissions(room,slide,name,time,object_key) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM slides WHERE room=? AND id=?) AND (SELECT count(*) FROM submissions WHERE room=?)<500").bind(code,input.slide,name,Date.now(),key,code,input.slide,code).run();
      if(!result.meta.changes)fail(409,"Slide is unavailable or this class has 500 shared pages.");
      return response({shared:true},201);
    }catch(error){await BUCKET.delete(key);throw error;}
  }
  if(section==="submissions" && method==="GET"){
    if(!teacher)fail(403,"Teacher access is required.");
    if(!id)return response({submissions:await all("SELECT id,slide,name,time FROM submissions WHERE room=? ORDER BY id DESC",code)});
    const row=await first("SELECT object_key FROM submissions WHERE room=? AND id=?",code,Number(id));
    if(!row)fail(404,"Submission was not found.");
    const object=await BUCKET.get(row.object_key);
    if(!object)fail(404,"Shared page is unavailable.");
    return response(object.body,200,"image/jpeg");
  }
  fail(405,"Method is unavailable.");
}
export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    let result;
    try{
      if(path.startsWith("/api/"))result=await cloudAPI(request,{...env,waitUntil:promise=>ctx.waitUntil(promise)},path);
      else {
        const asset=ASSETS[path==="/" ? "/index.html":path];
        if(!asset)fail(404,"Not found.");
        if(!["GET","HEAD"].includes(request.method))fail(405,"Method is unavailable.");
        const bytes=request.method==="HEAD"?null:Uint8Array.from(atob(asset.data),char=>char.charCodeAt(0));
        result=new Response(bytes,{headers:{"Content-Type":asset.type,"Cache-Control":path.startsWith("/vendor/")?"public,max-age=86400":"no-cache"}});
      }
    }catch(error){
      if(!error.status)console.error("Classroom request failed",error.message);
      result=response({error:error.status?error.message:"Server error. Please try again."},error.status||500);
    }
    result.headers.set("X-Content-Type-Options","nosniff");
    result.headers.set("Referrer-Policy","no-referrer");
    result.headers.set("Content-Security-Policy","default-src 'self'; img-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; font-src 'self' blob: data:");
    return result;
  }
};
