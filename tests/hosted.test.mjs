import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import worker from "../worker/index.mjs";
test("hosted sessions preserve graph copies and restrict shared work to teachers",async()=>{
  const sqlite=new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON;");
  sqlite.exec(readFileSync(new URL("../drizzle/0000_classroom.sql",import.meta.url),"utf8"));
  sqlite.exec(readFileSync(new URL("../drizzle/0001_native_pages.sql",import.meta.url),"utf8"));
  const objects=new Map(),pending=[];
  const env={
    DB:{prepare(sql){return {bind(...values){return {
      async first(){return sqlite.prepare(sql).get(...values)??null;},
      async all(){return {results:sqlite.prepare(sql).all(...values)};},
      async run(){const info=sqlite.prepare(sql).run(...values);return {meta:{changes:info.changes,last_row_id:Number(info.lastInsertRowid)}};}
    };}};}},
    BUCKET:{
      async put(key,value){objects.set(key,value);},
      async get(key){return objects.has(key)?{body:objects.get(key)}:null;},
      async delete(key){objects.delete(key);}
    }
  };
  async function request(path,{method="GET",body,teacher,token}={}){
    return worker.fetch(new Request("https://classroom.test"+path,{method,
      headers:{...(body?{"content-type":"application/json"}:{}),...(teacher?{"oai-authenticated-user-id":"test-teacher"}:{}),...(token?{authorization:"Bearer "+token}:{})},
      body:body?JSON.stringify(body):undefined}),env,{waitUntil:promise=>pending.push(promise)});
  }
  assert.equal((await request("/api/rooms",{method:"POST",body:{title:"Graph lab"}})).status,401);
  const room=await (await request("/api/rooms",{method:"POST",body:{title:"Graph lab"},teacher:true})).json();
  const base="/api/rooms/"+room.code;
  const fakeJPEG="data:image/jpeg;base64,"+Buffer.from([255,216,...Array(12).fill(1),255,217]).toString("base64");
  const graph={rows:[{expression:"a*x^2",color:"#205db2",visible:true}],parameters:{a:2},center:[0,0],units:40};
  assert.equal((await request(base+"/slides",{method:"POST",body:{image:fakeJPEG,graph}})).status,403);
  const slide=await (await request(base+"/slides",{method:"POST",body:{label:"Graph 1",image:fakeJPEG,graph},token:room.token})).json();
  const joined=await (await request(base)).json();
  assert.equal(joined.teacher,false);
  assert.deepEqual(joined.slides[0].graph,graph);
  assert.equal((await request(base+"/slides/"+(slide.id+1))).status,404);
  assert.equal((await request(base+"/slides/"+slide.id)).status,200);
  const native="%PDF-1.7\nNative page fixture";
  const nativeSlide=await (await request(base+"/slides",{method:"POST",body:{label:"Native page",image:fakeJPEG,pdf:Buffer.from(native).toString("base64")},token:room.token})).json();
  const nativeList=await (await request(base)).json();
  assert.equal(nativeList.slides.find(item=>item.id===nativeSlide.id).native,1);
  const pdfResponse=await request(base+"/slides/"+nativeSlide.id+"/pdf");
  assert.equal(pdfResponse.headers.get("content-type"),"application/pdf");
  assert.equal(await pdfResponse.text(),native);
  assert.equal((await request(base+"/slides/"+slide.id+"/pdf")).status,404);
  const submitted=await request(base+"/submissions",{method:"POST",body:{slide:slide.id,name:"Student",image:fakeJPEG}});
  assert.equal(submitted.status,201);
  assert.equal((await request(base+"/submissions")).status,403);
  const {submissions}=await (await request(base+"/submissions",{token:room.token})).json();
  assert.equal(submissions.length,1);
  assert.equal((await request(base+"/submissions/"+submissions[0].id)).status,403);
  assert.equal((await request(base+"/submissions/"+submissions[0].id,{token:room.token})).status,200);
  assert.equal((await request(base,{method:"DELETE",token:room.token})).status,200);
  assert.equal((await request(base)).status,404);
  await Promise.all(pending);
  assert.equal(objects.size,0);
  sqlite.close();
});
