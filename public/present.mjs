import {createClassTimer} from "./class-timer.mjs";
import {createPresentationTools} from "./presentation-tools.mjs?sync=2";
import {createWhiteboard,loadPDF} from "./whiteboard.mjs?sync=2";
const board=createWhiteboard(document.getElementById("presentationBoard"),{readOnly:true});
const toolHost=document.createElement("div");document.body.append(toolHost);const tools=createPresentationTools(toolHost,guide=>board.setToolOverlay(guide));
const timerHost=document.createElement("div");timerHost.className="clean-class-timer";document.body.append(timerHost);const classTimer=createClassTimer(timerHost);
const name=location.hash.slice(1);
if(!/^[a-f0-9]{32}$/.test(name))throw new Error("Open the clean screen from your teacher workspace.");
const channel=new BroadcastChannel("paperdesk-present-"+name);
let version=0,doc,pendingMarks=[],pendingCrop=null;
channel.onmessage=async({data})=>{
  if(data.type==="timer"){classTimer.sync(data.timer,data.serverTime);return;}
  if(data.type==="tools"){tools.update(data);if(data.children?.length)document.getElementById("presentationWait").hidden=true;return;}
  if(data.type==="marks"){pendingMarks=data.marks;pendingCrop=data.crop??null;board.setMarks(pendingMarks);board.setCrop(pendingCrop);return;}
  if(data.type!=="source")return;
  const current=++version;pendingMarks=data.marks||[];pendingCrop=data.crop??null;
  let nextDoc;
  try{
    if(data.bytes){
      nextDoc=await loadPDF(data.bytes);
      const page=await nextDoc.getPage(data.pageNumber);
      if(current!==version){await nextDoc.destroy();return;}
      await board.setSource({bytes:data.bytes,page,pageNumber:data.pageNumber},pendingMarks,{crop:pendingCrop});
    }else if(data.image){
      const image=new Image();image.src=data.image;await image.decode();
      if(current!==version)return;
      await board.setSource({image},pendingMarks,{crop:pendingCrop});
    }
    if(current!==version){await nextDoc?.destroy();return;}
    const old=doc;doc=nextDoc;if(old)await old.destroy();
    board.setMarks(pendingMarks);board.setCrop(pendingCrop);document.title="Paperdesk · "+(data.label||"Clean presentation");document.getElementById("presentationBoard").setAttribute("aria-label",data.label||"Presented page");document.getElementById("presentationWait").hidden=true;board.fit();
  }catch(error){console.error(error);document.getElementById("presentationWait").textContent="Could not render this page. Present it again from the teacher workspace.";}
};
channel.postMessage({type:"ready"});
document.getElementById("fullscreen").onclick=()=>document.documentElement.requestFullscreen();
document.addEventListener("dblclick",()=>{if(!document.fullscreenElement)void document.documentElement.requestFullscreen();});
window.addEventListener("pagehide",()=>{channel.close();void doc?.destroy();});
