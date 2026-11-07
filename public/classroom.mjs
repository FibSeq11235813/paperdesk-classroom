import {frameForPage} from "./presentation-frame.mjs";
import {createGraph} from "./graph.mjs";
import {createWhiteboard,loadPDF,bytesToBase64} from "./whiteboard.mjs";
const $=id=>document.getElementById(id);
const state={room:null,role:null,token:null,name:"",pdf:null,page:1,render:0,
  current:null,slides:[],boardVersion:0,sessionVersion:0};

const store={
  get(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},
  set(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}},
  remove(key){try{localStorage.removeItem(key);}catch{/* The browser may block local storage. */}}
};

const teacherGraph=createGraph($("teacherGraph"),{onChange:value=>{store.set("paperdesk.graph.teacher",value);if(presentedKey==="graph")scheduleGraphPresentation();}});
teacherGraph.restore(store.get("paperdesk.graph.teacher"));
const studentGraph=createGraph($("studentGraph"),{onChange:value=>{
  if(state.current!==null)store.set(workKey()+".graph",value);
}});
let studentView="Slide";
function setView(role,view){
  const graph=view==="Graph";
  $(role+"GraphPanel").hidden=!graph;
  $(role+"SlidePanel").hidden=graph;
  $(role+"GraphTab").setAttribute("aria-pressed",String(graph));
  $(role+"SlideTab").setAttribute("aria-pressed",String(!graph));
  if(role==="student"){studentView=view;if(!graph)requestAnimationFrame(()=>studentBoard.fit());}

}
for(const role of ["teacher","student"]){
  for(const view of ["Slide","Graph"])$(role+view+"Tab").onclick=()=>setView(role,view);
}
const teacherKey="paperdesk.classroom.teacher";
const notice=text=>{$("notice").textContent=text;};
const workStatus=text=>{$("workStatus").textContent=text;};
const roomPath=()=>"/api/rooms/"+state.room;
const slideURL=id=>roomPath()+"/slides/"+id;
const workKey=(id=state.current)=>"paperdesk.classroom.work."+state.room+"."+id;
const shortName=name=>name.trim().slice(0,50)||"Student";
const cleanCode=code=>code.trim().toLowerCase().replace(/[\s-]/g,"");
function show(section){
  for(const id of ["landing","teacher","student"]) $(id).hidden=id!==section;
  notice("");
}
async function api(path,{method="GET",body,token,image=false}={}) {
  const headers={};
  if(body!==undefined) headers["Content-Type"]="application/json";
  if(token) headers.Authorization="Bearer "+token;
  const res=await fetch(path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
  if(!res.ok) {
    const detail=await res.json().catch(()=>null);
    throw Object.assign(new Error(detail?.error||"Could not connect to the class."),{status:res.status});
  }
  return image?res.blob():res.json();
}
function button(text,callback) {
  const element=document.createElement("button");
  element.textContent=text;element.onclick=callback;return element;
}
function list(element,items,make) {
  element.replaceChildren(...items.map(item=>{
    const li=document.createElement("li");
    li.append(make(item));return li;
  }));
}
function joinAddress(code){
  const url=new URL("/",location.href);
  url.searchParams.set("join",code);
  return url.href;
}
api("/api/config").then(config=>{
  $("teacherPasswordWrap").hidden=!config.teacherPasswordRequired;
  $("teacherSignIn").hidden=!config.signInRequired;
  $("create").querySelector("button").hidden=!!config.signInRequired;
}).catch(()=>{});
const queryCode=cleanCode(new URLSearchParams(location.search).get("join")||"");
$("code").value=queryCode;
$("name").value=store.get("paperdesk.classroom.name","");
$("resume").hidden=!!queryCode || !store.get(teacherKey);
$("create").onsubmit=async event=>{
  event.preventDefault();
  const submit=event.submitter;submit.disabled=true;
  try {
    const room=await api("/api/rooms",{method:"POST",body:{title:$("title").value,password:$("teacherPassword").value}});
    store.set(teacherKey,room);
    await teach(room);
  } catch(error){notice(error.message);}
  finally {submit.disabled=false;}
};
$("resume").onclick=async()=>{
  const room=store.get(teacherKey);
  if(!room) return;
  try {await teach(room);}
  catch(error){notice(error.message);if(error.status===404){store.remove(teacherKey);$("resume").hidden=true;}}
};
async function teach(room) {
  const data=await api("/api/rooms/"+room.code,{token:room.token});
  if(!data.teacher) throw new Error("This browser no longer has teacher access.");
  state.sessionVersion++;
  Object.assign(state,{role:"teacher",room:room.code,token:room.token});
  $("teacherTitle").textContent=data.title;
  $("roomCode").textContent=room.code;
  $("joinLink").value=joinAddress(room.code);
  show("teacher");
  void refresh();
}
$("copy").onclick=async()=>{
  const field=$("joinLink");
  try {await navigator.clipboard.writeText(field.value);$("connection").textContent="Student link copied";}
  catch {field.select();notice("Copy the selected student link.");}
};
$("end").onclick=async()=>{
  if(!confirm("End this class and delete its revealed slides and shared submissions from the server?")) return;
  $("end").disabled=true;
  try {await api(roomPath(),{method:"DELETE",token:state.token});store.remove(teacherKey);location.href="/";}
  catch(error){notice(error.message);}
  finally{$("end").disabled=false;}
};


let pdfBytes,fileKey,currentTeacherKey=null,presentedKey=null,presentationState=null,presentationTimer,inkPresentationTimer;
const presentName=Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,"0")).join("");
const presentationChannel=new BroadcastChannel("paperdesk-present-"+presentName);
let presentationWindow;
const teacherBoard=createWhiteboard($("teacherBoard"),{teacher:true,onChange:(marks)=>{
  if(currentTeacherKey)store.set(currentTeacherKey,{version:3,marks,crop:teacherBoard.getCrop()});
  if(currentTeacherKey===presentedKey)scheduleInkPresentation();
},onCropChange:(crop,height)=>{
  if(fileKey)store.set("paperdesk.teacher.frame."+fileKey,{crop,height});
},onPreview:()=>{if(currentTeacherKey===presentedKey)scheduleInkPresentation();}});
const studentBoard=createWhiteboard($("studentBoard"),{onChange:(marks,view)=>{
  if(state.current===null)return;
  const saved=store.set(workKey(),{version:3,marks});
  store.set(workKey()+".view",view);
  workStatus(saved?"Saved on this browser.":"Browser storage is unavailable. Keep this page open to preserve your work.");
}});
function scheduleInkPresentation(){
  if(inkPresentationTimer!==undefined)return;
  inkPresentationTimer=setTimeout(()=>{
    inkPresentationTimer=undefined;
    if(currentTeacherKey!==presentedKey)return;
    const marks=teacherBoard.getDisplayMarks();
    const crop=teacherBoard.getCrop();
    if(presentationState){presentationState.marks=marks;presentationState.crop=crop;}
    presentationChannel.postMessage({type:"marks",marks,crop});
  },35);
}
function scheduleGraphPresentation(){
  clearTimeout(presentationTimer);
  presentationTimer=setTimeout(()=>{
    if(presentedKey!=="graph")return;
    presentationState={type:"source",label:"Graph",image:teacherGraph.snapshot().toDataURL("image/jpeg",.92),marks:[]};
    presentationChannel.postMessage(presentationState);
  },100);
}
presentationChannel.onmessage=({data})=>{if(data.type==="ready"&&presentationState)presentationChannel.postMessage(presentationState);};
$("openPresentation").onclick=()=>{
  presentationWindow=window.open("/present.html#"+presentName,"paperdesk-"+presentName,"popup,width=1200,height=800");
  if(!presentationWindow){notice("Allow the presentation window to open, then try Open clean screen again.");return;}
  if(!presentationState&&teacherBoard.getSource())presentCurrentPage();
  else if(presentationState)presentationChannel.postMessage(presentationState);
};
function presentCurrentPage(){
  const scene=teacherBoard.presentation();if(!scene)return;
  presentedKey=currentTeacherKey;presentationState={type:"source",...scene,label:"Page "+state.page};
  presentationChannel.postMessage(presentationState);
  $("connection").textContent="Presenting "+$("sourcePage").textContent;
}
$("presentPage").onclick=presentCurrentPage;
async function openPDF(file) {
  if(!file)return;
  if(file.size>80_000_000){notice("Choose a PDF under 80 MB.");return;}
  const version=++state.render;
  for(const id of ["reveal","prev","next","presentPage","downloadPDF"])$(id).disabled=true;
  $("sourcePage").textContent="Opening…";
  try {
    const bytes=await file.arrayBuffer();
    const hash=await crypto.subtle.digest("SHA-256",bytes);
    const key=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,"0")).join("");
    const pdf=await loadPDF(bytes);
    if(version!==state.render){await pdf.destroy();return;}
    const previous=state.pdf;
    state.pdf=pdf;state.page=1;pdfBytes=bytes;fileKey=key;
    await renderPage();
    if(previous)void previous.destroy().catch(()=>{});
  }catch(error){notice("Could not open that PDF. Try a readable, unprotected file.");console.error(error);}
}
$("pdf").onchange=()=>void openPDF($("pdf").files[0]);
$("example").onclick=async()=>{
  try{const res=await fetch("/example.pdf");if(!res.ok)throw new Error("Example unavailable.");await openPDF(await res.blob());}
  catch(error){notice(error.message);}
};
async function renderPage(){
  const version=++state.render;
  for(const id of ["prev","next","reveal","presentPage","downloadPDF"])$(id).disabled=true;
  try{
    const page=await state.pdf.getPage(state.page);
    if(version!==state.render)return;
    currentTeacherKey="paperdesk.teacher."+fileKey+"."+state.page;
    const saved=store.get(currentTeacherKey,{marks:[]});
    const viewport=page.getViewport({scale:1}),height=viewport.height/viewport.width*1000;
    const frameKey="paperdesk.teacher.frame."+fileKey;
    let pdfFrame=store.get(frameKey);
    // Adopt an older page-specific frame once, then use the shared PDF setting.
    if(pdfFrame===null&&saved.crop){pdfFrame={crop:saved.crop,height};store.set(frameKey,pdfFrame);}
    await teacherBoard.setSource({page,bytes:pdfBytes,pageNumber:state.page},saved.marks||[],{crop:frameForPage(pdfFrame,height)});
    if(version!==state.render)return;
    $("sourcePage").textContent="Page "+state.page+" / "+state.pdf.numPages;
    $("prev").disabled=state.page<=1;$("next").disabled=state.page>=state.pdf.numPages;
    $("reveal").disabled=$("presentPage").disabled=$("downloadPDF").disabled=false;notice("");
    // Browsing a different page is private until Present this page is clicked.
  }catch(error){if(version===state.render)notice("Could not render this page.");console.error(error);}
}
$("prev").onclick=()=>{state.page--;void renderPage();};
$("next").onclick=()=>{state.page++;void renderPage();};
$("reveal").onclick=async()=>{
  const page=state.page;$("reveal").disabled=true;
  try{
    const [native,image]=await Promise.all([teacherBoard.nativePDF(),teacherBoard.snapshot()]);
    if(native.length>8*1024*1024)throw new Error("This native PDF page exceeds the 8 MB upload limit. It has not been compressed.");
    await api(roomPath()+"/slides",{method:"POST",token:state.token,body:{
      label:"Page "+page,pdf:bytesToBase64(native),image:image.toDataURL("image/jpeg",.8)
    }});
    $("connection").textContent="Native PDF page "+page+" revealed";void refresh();
  }catch(error){notice(error.message);}
  finally{if(page===state.page)$("reveal").disabled=false;}
};
$("downloadPDF").onclick=async()=>{
  $("downloadPDF").disabled=true;
  try{
    const bytes=await teacherBoard.nativePDF(),url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
    const link=document.createElement("a");link.href=url;link.download="Paperdesk-page-"+state.page+".pdf";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){notice(error.message);}
  finally{$("downloadPDF").disabled=false;}
};

$("join").onsubmit=async event=>{
  event.preventDefault();
  const code=cleanCode($("code").value);
  if(!/^[a-f0-9]{12}$/.test(code)){notice("Enter the 12-character class code.");return;}
  const submit=event.submitter;
  submit.disabled=true;
  try {await join(code,shortName($("name").value));}
  catch(error){notice(error.message);}
  finally {submit.disabled=false;}
};
async function join(code,name){
  const data=await api("/api/rooms/"+code);
  state.sessionVersion++;
  Object.assign(state,{role:"student",room:code,name});
  history.replaceState(null,"",joinAddress(code));
  store.set("paperdesk.classroom.name",name);
  store.set("paperdesk.classroom.joined."+code,name);
  $("studentTitle").textContent=data.title;
  show("student");
  await updateStudent(data.slides);
}
$("leave").onclick=()=>{store.remove("paperdesk.classroom.joined."+state.room);location.href="/";};
if(queryCode){
  const previous=store.get("paperdesk.classroom.joined."+queryCode);
  if(previous) void join(queryCode,previous).catch(error=>notice(error.message));
}
let refreshing=false;
async function refresh(){
  if(!state.room || refreshing)return;
  refreshing=true;
  const version=state.sessionVersion;
  try {
    const data=await api(roomPath(),{token:state.token});
    if(version!==state.sessionVersion)return;
    if(state.role==="student"){
      await updateStudent(data.slides);
    } else {
      list($("revealed"),data.slides,slide=>slide.label);
      const {submissions}=await api(roomPath()+"/submissions",{token:state.token});
      if(version!==state.sessionVersion)return;
      $("shareEmpty").hidden=submissions.length>0;
      const names=new Map(data.slides.map(slide=>[slide.id,slide.label]));
      const key=JSON.stringify(submissions);
      if($("inbox").dataset.key!==key){
        $("inbox").dataset.key=key;
        list($("inbox"),submissions,item=>button(
          `${item.name} · ${names.get(item.slide)||"Slide"} · ${new Date(item.time).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`,
          ()=>void viewSubmission(item,names.get(item.slide))));
      }
    }
    if($("connection").textContent.startsWith("Connection")) $("connection").textContent="Connected";
  } catch(error){
    if(version!==state.sessionVersion)return;
    if(error.status===404){
      state.room=null;
      $("connection").textContent="Class ended";
      if(state.role==="student"){
        $("share").disabled=true;
        workStatus("Class ended. You can still view the current page until you leave.");
      } else notice(error.message);
    } else $("connection").textContent="Connection interrupted · retrying";
  } finally{refreshing=false;}
}
setInterval(()=>void refresh(),1800);
let submissionURL;
async function viewSubmission(item,slide){
  try {
    const blob=await api(roomPath()+"/submissions/"+item.id,{token:state.token,image:true});
    if(submissionURL)URL.revokeObjectURL(submissionURL);
    submissionURL=URL.createObjectURL(blob);
    $("submissionImage").src=submissionURL;
    $("submissionTitle").textContent=item.name+" · "+(slide||"Slide");
    if(!$("viewer").open)$("viewer").showModal();
  }catch(error){notice(error.message);}
}
$("viewer").onclose=()=>{
  if(submissionURL)URL.revokeObjectURL(submissionURL);
  $("submissionImage").removeAttribute("src");
  submissionURL=null;
};

async function updateStudent(slides) {
  const changed=slides.length!==state.slides.length;
  state.slides=slides;
  if(changed) paintSlideList();
  $("waiting").hidden=slides.length>0;
  if(state.current===null && slides.length){
    const saved=store.get("paperdesk.classroom.slide."+state.room);
    const slide=slides.find(item=>item.id===saved)||slides.at(-1);
    await loadSlide(slide);
  } else updateLatest();
}
function paintSlideList(){
  list($("studentSlides"),state.slides,slide=>{
    const link=button(slide.label,()=>void loadSlide(slide));
    link.setAttribute("aria-pressed",String(slide.id===state.current));
    return link;
  });
}
function updateLatest(){
  const latest=state.slides.at(-1);
  $("latest").hidden=!latest || latest.id===state.current;
  $("latest").onclick=()=>void loadSlide(latest);
}

let studentDocument;
async function loadSlide(slide){
  if(!slide||!state.room||slide.id===state.current)return;
  const version=++state.boardVersion;
  let nextDoc;
  try{
    let source;
    if(slide.native){
      const res=await fetch(slideURL(slide.id)+"/pdf");
      if(!res.ok)throw new Error("This PDF page is unavailable.");
      const bytes=await res.arrayBuffer();nextDoc=await loadPDF(bytes);
      source={bytes,page:await nextDoc.getPage(1),pageNumber:1};
    }else{
      const image=new Image();image.src=slideURL(slide.id);await image.decode();source={image};
    }
    if(version!==state.boardVersion){await nextDoc?.destroy();return;}
    const saved=store.get("paperdesk.classroom.work."+state.room+"."+slide.id,[]);
    const initial=Array.isArray(saved)?saved:saved.marks||[];
    const settings=store.get("paperdesk.classroom.work."+state.room+"."+slide.id+".view",{});
    if(Array.isArray(saved)&&saved.length&&!Object.hasOwn(settings,"scratch"))settings.scratch=true;
    state.current=slide.id;
    studentGraph.restore(store.get(workKey()+".graph",slide.graph));
    $("work").hidden=false;$("workTitle").textContent=slide.label;
    setView("student",slide.graph?"Graph":"Slide");
    await studentBoard.setSource(source,initial,settings);
    if(version!==state.boardVersion){await nextDoc?.destroy();return;}
    const old=studentDocument;studentDocument=nextDoc;if(old)void old.destroy().catch(()=>{});
    store.set("paperdesk.classroom.slide."+state.room,state.current);
    paintSlideList();updateLatest();notice("");
  }catch(error){
    if(version===state.boardVersion)notice("Could not load this slide. Try selecting it again.");
    console.error(error);
  }
}
$("share").onclick=async()=>{
  if(!state.room||state.current===null)return;
  $("share").disabled=true;
  const version=state.boardVersion,slide=state.current;
  try{
    const copy=studentView==="Graph"?studentGraph.snapshot():await studentBoard.snapshot();
    await api(roomPath()+"/submissions",{method:"POST",body:{slide,name:state.name,image:copy.toDataURL("image/jpeg",.8)}});
    if(version===state.boardVersion)workStatus("This page was shared with your teacher.");
  }catch(error){if(version===state.boardVersion)workStatus(error.message);}
  finally{$("share").disabled=!state.room;}
};

$("revealGraph").onclick=async()=>{
  $("revealGraph").disabled=true;
  try {
    await api(roomPath()+"/slides",{method:"POST",token:state.token,body:{
      label:"Graph "+($("revealed").children.length+1),graph:teacherGraph.getState(),
      image:teacherGraph.snapshot().toDataURL("image/jpeg",0.85)
    }});
    $("connection").textContent="Graph revealed";void refresh();
  }catch(error){notice(error.message);}
  finally{$("revealGraph").disabled=false;}
};

const presentGraphButton=button("Present graph on clean screen",()=>{presentedKey="graph";scheduleGraphPresentation();});
$("teacherGraphPanel").append(presentGraphButton);
