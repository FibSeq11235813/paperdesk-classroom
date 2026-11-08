import {icon,iconButton} from "./ui-icons.mjs";
import {eraseSweep} from "./partial-erase.mjs";
import {paintMark,saveAnnotation,loadMarkImages,polar,direction,distance,clamp} from "./marks.mjs";
import {contactPoint,appendContact,finishContact} from "./tablet-input.mjs";
import {bindPointerInput,defaultInputMode} from "./pointer-input.mjs";
import {attachInputCheck} from "./input-check.mjs";
import {normalizeFrame,adjustFrame} from "./presentation-frame.mjs";
let activeInkBoard=null;
export function historyShortcut(event){
  if(event.defaultPrevented||event.isComposing||event.altKey||!(event.ctrlKey||event.metaKey))return null;
  const key=event.key.toLowerCase();
  if(key==="z")return event.shiftKey?"redo":"undo";
  if(key==="y"&&!event.shiftKey)return "redo";
  return null;
}
let renderer;
export async function loadPDF(bytes){
  if(!renderer){
    renderer=await import("./vendor/pdf.min.mjs");
    renderer.GlobalWorkerOptions.workerSrc="/vendor/pdf.worker.min.mjs";
  }
  return renderer.getDocument({data:new Uint8Array(bytes.slice(0)),isEvalSupported:false,useSystemFonts:false,
    cMapUrl:"/vendor/cmaps/",standardFontDataUrl:"/vendor/standard_fonts/",wasmUrl:"/vendor/wasm/"}).promise;
}
export function bytesToBase64(bytes){
  let value="";
  for(let offset=0;offset<bytes.length;offset+=32768)value+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
  return btoa(value);
}
export function createWhiteboard(root,{onChange=()=>{},onPreview=()=>{},onCropChange=()=>{},readOnly=false,teacher=false}={}){
  root.innerHTML=`
    <div class="board-tools" ${readOnly?"hidden":""}>
      <div class="actions tool-rail" role="toolbar" aria-label="Drawing tools">
        <button data-ink-tool="pen" aria-pressed="true">Pen</button><button data-ink-tool="highlighter">Highlighter</button><button data-ink-tool="eraser">Eraser</button>
        <button data-ink-tool="line">Line</button><button data-ink-tool="rect">Rectangle</button><button data-ink-tool="ellipse">Ellipse</button>
        <button data-ink-tool="protractor">Protractor</button><button data-ink-tool="compass">Compass</button><button data-ink-tool="pan">Pan</button><button data-ink-tool="zoom" title="Alt + drag also zooms to a rectangle">Zoom box</button>
      </div>
      <div class="actions">
        <div class="ink-swatches"></div><label>Color <input class="ink-color" type="color" value="#174a87"></label>
        <label>Width <input class="ink-width" aria-label="Pen width" type="number" min=".1" max="60" step=".1" value="0.5"></label>
        <label>Opacity % <input class="ink-opacity" aria-label="Ink opacity" type="number" min="5" max="100" value="100"></label>
        <label>Line style <select class="ink-pattern"><option>Solid</option><option>Dashed</option><option>Dotted</option></select></label>
        <label>Input mode <select class="input-mode" aria-label="Drawing input mode"><option value="pointer">Standard pen / touch</option><option value="mouse">Bamboo / legacy mouse</option></select></label><label><input class="ink-stabilize" type="checkbox">Stabilize strokes</label><label><input class="ink-snap" type="checkbox">Snap</label><label title="Optional variable width for compatible pens. Stable fixed width is the default."><input class="ink-pressure" type="checkbox">Pen pressure</label>
      </div>
      <div class="actions">
        <button class="ink-undo" disabled>Undo</button><button class="ink-redo" disabled>Redo</button><button class="board-out" aria-label="Zoom slide out">−</button><output class="board-zoom">100%</output><button class="board-in" aria-label="Zoom slide in">+</button>
        <button class="board-fit">Fit page</button><button class="board-width">Fit width</button>
        <label ${teacher?"hidden":""}><input class="board-scratch" type="checkbox">Extra scratch space</label>
        <button class="board-timer-toggle">Timer</button>
        <button class="frame-toggle" aria-pressed="false" ${teacher?"":"hidden"}>Adjust clean-screen frame</button><button class="frame-standard" hidden>Standard slide view</button><button class="frame-reset" ${teacher?"":"hidden"}>Full page on clean screen</button>
      </div>
      <div class="geometry-tools actions" hidden><span class="geometry-help"></span><label>Radius <input class="guide-radius" type="number" min="10" max="1000" value="100"></label><label class="rotation-label">Rotation ° <input class="guide-rotation" type="number" value="0"></label><label class="ray-label"><input class="guide-ray" type="checkbox">Draw ray</label><button class="guide-circle">Draw full circle</button><output class="guide-angle"></output></div>
    </div>
    <div class="board-timer actions" hidden><strong class="timer-readout">05:00</strong><select class="timer-mode" aria-label="Timer mode"><option>Countdown</option><option>Stopwatch</option></select><label class="timer-minutes-label">Minutes <input class="timer-minutes" type="number" min=".1" max="180" value="5"></label><button class="timer-start">Start</button><button class="timer-reset">Reset</button></div>
    <div class="native-viewport" tabindex="0" aria-label="Zoomable PDF workspace"><div class="native-clip"><div class="native-page">
      <canvas class="pdf-tile"></canvas><canvas class="ink-tile" aria-label="Draw on the PDF"></canvas>
      <div class="eraser-outline" hidden></div><div class="zoom-selection" hidden></div><div class="presentation-frame" tabindex="0" role="group" aria-label="Clean-screen frame. Drag to move or use arrow keys." hidden><span class="frame-caption">Clean screen</span><button data-corner="nw" aria-label="Resize frame top left"></button><button data-corner="ne" aria-label="Resize frame top right"></button><button data-corner="sw" aria-label="Resize frame bottom left"></button><button data-corner="se" aria-label="Resize frame bottom right"></button></div>
    </div></div></div><p class="board-status" role="status">${readOnly?"":"Use a mouse or stylus to draw. Pen pressure is optional."}</p>`;
  const find=selector=>root.querySelector(selector);
  const boardStage=document.createElement("div");boardStage.className="board-stage";
  const surface=find(".native-viewport");surface.before(boardStage);boardStage.append(surface,find(".tool-rail"));
  if(readOnly)find(".tool-rail").hidden=true;
  for(const button of root.querySelectorAll("[data-ink-tool]"))iconButton(button,button.dataset.inkTool);
  for(const [selector,name] of [[".ink-undo","undo"],[".ink-redo","redo"],[".board-out","minus"],[".board-in","plus"],[".board-fit","fit"],[".board-width","width"],[".board-timer-toggle","timer"],[".frame-toggle","frame"],[".frame-standard","zoom"],[".frame-reset","screen"]])iconButton(find(selector),name);
  const settingsRow=find(".board-tools > .actions"),advanced=document.createElement("details");
  advanced.className="advanced-ink-settings";
  advanced.innerHTML=`<summary title="Input and ink settings" aria-label="Input and ink settings">${icon("settings")}</summary><div class="advanced-ink-content"></div>`;
  for(const element of [...settingsRow.children])if(element.querySelector?.(".input-mode,.ink-stabilize,.ink-snap,.ink-pressure,.ink-opacity"))advanced.lastElementChild.append(element);
  settingsRow.append(advanced);
  const footer=find(".board-tools").children[1];footer.classList.add("board-footer");footer.hidden=readOnly;
  boardStage.after(footer);
  const clipElement=find(".native-clip"),frameElement=find(".presentation-frame");
  const viewport=find(".native-viewport"),pageElement=find(".native-page"),pdfCanvas=find(".pdf-tile"),inkCanvas=find(".ink-tile"),ink=inkCanvas.getContext("2d");
  let page=null,source=null,logicalHeight=700,originalHeight=700,marks=[],undo=[],redo=[],draft=null,gesture=null,guide=null;
  let zoom=1,scale=1,tool="pen",renderTask=null,generation=0,renderTimer,drawFrame,baseWidth=700,sceneVersion=0;
  let tile={x:0,y:0,width:1,height:1,dpr:1},renderedTile=null;
  let pointerInput,frameInput,inputCheck,crop=null,editingFrame=false,frameDrag=null,eraserAt=null,standardCrop=null,initialRegion=null,selectionCallback=null,pendingSnippet=null;
  const cropChanged=()=>onCropChange(clone(crop),originalHeight);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const radius=()=>clamp(Number(find(".guide-radius").value)||100,10,1000);
  const rotation=()=>Number(find(".guide-rotation").value||0)*Math.PI/180;
  const visibleHeight=()=>find(".board-scratch").checked?logicalHeight:originalHeight;
  const status=text=>{find(".board-status").textContent=text;};
  function changed(){
    find(".ink-undo").disabled=!undo.length;find(".ink-redo").disabled=!redo.length;
    onChange(clone(marks),{zoom,scratch:find(".board-scratch").checked,crop:clone(crop)});onPreview();
  }
  function edit(next){undo.push(marks);if(undo.length>80)undo.shift();marks=next;redo=[];changed();redraw();}
  function geometry(){
    const active=["compass","protractor"].includes(tool);
    find(".geometry-tools").hidden=!active;
    find(".geometry-help").textContent=tool==="compass"?"Place a center, then drag near the edge to sweep an arc.":"Place the center, rotate the baseline, and drag near an edge to measure.";
    find(".rotation-label").hidden=find(".ray-label").hidden=tool!=="protractor";
    find(".guide-circle").hidden=tool!=="compass";
  }
  const presets={pen:{color:"#174a87",width:.5,opacity:100},highlighter:{color:"#ffdd3e",width:.5,opacity:32},shape:{color:"#174a87",width:.5,opacity:100},eraser:{color:"#174a87",width:25,opacity:100}};
  for(const name of ["line","rect","ellipse","compass","protractor","pan","zoom"])presets[name]={...presets.shape};
  const presetKey=value=>value;
  function choose(next){
    pendingSnippet=null;
    const oldKey=presetKey(tool),nextKey=presetKey(next);
    presets[oldKey]={color:find(".ink-color").value,width:find(".ink-width").value,opacity:find(".ink-opacity").value};
    cancel();tool=next;
    for(const button of root.querySelectorAll("[data-ink-tool]"))button.setAttribute("aria-pressed",String(button.dataset.inkTool===tool));
    inkCanvas.style.cursor=tool==="pan"?"grab":"crosshair";
    if(oldKey!==nextKey){
      const preset=presets[nextKey];find(".ink-color").value=preset.color;find(".ink-width").value=preset.width;find(".ink-opacity").value=preset.opacity;
    }
    geometry();positionEraser();redraw();
  }
  for(const button of root.querySelectorAll("[data-ink-tool]"))button.onclick=()=>choose(button.dataset.inkTool);
  for(const color of ["#174a87","#161c25","#c52d42","#11714b","#8042ac","#ffdd3e","#f47c24","#ffffff"]){
    const button=document.createElement("button");button.className="ink-swatch";button.style.background=color;
    button.setAttribute("aria-label","Ink color "+color);button.title=color;button.onclick=()=>find(".ink-color").value=color;find(".ink-swatches").append(button);
  }
  function baseMark(kind,points,event){
    return {kind,points,width:clamp(Number(find(".ink-width").value)||.5,.1,60),
      color:find(".ink-color").value,opacity:clamp(Number(find(".ink-opacity").value)||100,5,100)/100,
      pattern:["line","rect","ellipse","arc"].includes(kind)?find(".ink-pattern").value:"Solid",
      variable:kind==="pen"&&find(".ink-pressure").checked&&event?.pointerType==="pen"};
  }
  function measureTile(){
    const width=viewport.clientWidth,height=viewport.clientHeight;
    const margin=180;
    const originX=readOnly&&crop?crop.x*scale:0,originY=readOnly&&crop?crop.y*scale:0;
    const x=Math.max(0,originX+viewport.scrollLeft-margin),y=Math.max(0,originY+viewport.scrollTop-margin);
    return {x,y,
      width:Math.max(1,Math.min(width+margin*2,1000*scale-x)),
      height:Math.max(1,Math.min(height+margin*2,visibleHeight()*scale-y)),
      dpr:Math.min(devicePixelRatio||1,2)};
  }
  function sameTile(a,b){return a&&a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height&&a.dpr===b.dpr&&a.scale===scale;}
  function place(canvas,current){
    canvas.style.left=current.x+"px";canvas.style.top=current.y+"px";
    canvas.style.width=current.width+"px";canvas.style.height=current.height+"px";
    canvas.width=Math.ceil(current.width*current.dpr);canvas.height=Math.ceil(current.height*current.dpr);
  }
  function paintSurface(context,image,tileData){
    context.fillStyle="#fff";context.fillRect(0,0,tileData.width*tileData.dpr,tileData.height*tileData.dpr);
    if(image){
      context.setTransform(scale*tileData.dpr,0,0,scale*tileData.dpr,-tileData.x*tileData.dpr,-tileData.y*tileData.dpr);
      context.drawImage(image,0,0,1000,originalHeight);context.setTransform(1,0,0,1,0,0);
    }
    if(find(".board-scratch").checked){
      context.save();context.setTransform(scale*tileData.dpr,0,0,scale*tileData.dpr,-tileData.x*tileData.dpr,-tileData.y*tileData.dpr);
      context.fillStyle="#eaf4f2";context.fillRect(0,originalHeight,1000,32);
      context.fillStyle="#20554a";context.font="600 14px system-ui";context.fillText("SCRATCH SPACE",12,originalHeight+22);context.restore();
    }
  }
  async function render(){
    if(!source||!viewport.clientWidth)return;
    const current=measureTile();
    tile=current;place(inkCanvas,current);redraw();
    if(sameTile(renderedTile,current))return;
    const version=++generation;renderTask?.cancel();
    const temp=document.createElement("canvas");temp.width=Math.ceil(current.width*current.dpr);temp.height=Math.ceil(current.height*current.dpr);
    const context=temp.getContext("2d");
    paintSurface(context,source.image,current);
    try{
      if(page){
        const native=page.getViewport({scale:1});
        const view=page.getViewport({scale:1000*scale/native.width});
        renderTask=page.render({canvas:temp,viewport:view,
          transform:[current.dpr,0,0,current.dpr,-current.x*current.dpr,-current.y*current.dpr],
          background:"rgba(255,255,255,0)"});
        await renderTask.promise;
        if(find(".board-scratch").checked)paintScratch(context,current);
      }
      if(version!==generation)return;
      place(pdfCanvas,current);pdfCanvas.getContext("2d").drawImage(temp,0,0);
      renderedTile={...current,scale};
    }catch(error){if(error.name!=="RenderingCancelledException"){console.error(error);status("Could not render this part of the PDF.");}}
  }
  function paintScratch(context,current){
    context.save();context.setTransform(scale*current.dpr,0,0,scale*current.dpr,-current.x*current.dpr,-current.y*current.dpr);
    context.fillStyle="#fff";context.fillRect(0,originalHeight,1000,logicalHeight-originalHeight);
    context.fillStyle="#eaf4f2";context.fillRect(0,originalHeight,1000,32);context.fillStyle="#20554a";
    context.font="600 14px system-ui";context.fillText("SCRATCH SPACE",12,originalHeight+22);context.restore();
  }
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>void render(),55);}
  function layout(nextZoom=zoom,anchor=null){
    if(!source||!viewport.clientWidth)return;
    cancel();
    const oldScale=scale;
    zoom=clamp(nextZoom,.1,readOnly?100:10);
    baseWidth=Math.max(80,viewport.clientWidth-32);scale=baseWidth/1000*zoom;
    const region=readOnly&&crop?crop:{x:0,y:0,width:1000,height:visibleHeight()};
    clipElement.style.width=region.width*scale+"px";clipElement.style.height=region.height*scale+"px";
    pageElement.style.width=1000*scale+"px";pageElement.style.height=visibleHeight()*scale+"px";
    pageElement.style.left=-region.x*scale+"px";pageElement.style.top=-region.y*scale+"px";
    positionFrame();positionEraser();
    find(".board-zoom").textContent=Math.round(zoom*100)+"%";
    if(anchor){
      viewport.scrollLeft=(viewport.scrollLeft+anchor.x-16)*scale/oldScale-anchor.x+16;
      viewport.scrollTop=(viewport.scrollTop+anchor.y-16)*scale/oldScale-anchor.y+16;
    }
    renderedTile=null;void render();
  }
  function fit(mode="page"){
    if(!source||!viewport.clientWidth)return;
    const width=Math.max(80,viewport.clientWidth-32),height=Math.max(80,viewport.clientHeight-32);
    const region=readOnly&&crop?crop:{width:1000,height:visibleHeight()};
    const value=readOnly?Math.min(width/region.width,height/region.height)/(width/1000):(mode==="width"?1:Math.min(1,height/(visibleHeight()*width/1000)));
    layout(value);viewport.scrollTo(0,0);
  }
  function zoomToRegion(region){
    const nextScale=Math.min((viewport.clientWidth-32)/region.width,(viewport.clientHeight-32)/region.height);
    layout(nextScale/(Math.max(80,viewport.clientWidth-32)/1000));
    viewport.scrollLeft=(region.x+region.width/2)*scale-viewport.clientWidth/2+16;
    viewport.scrollTop=(region.y+region.height/2)*scale-viewport.clientHeight/2+16;
    scheduleRender();
  }
  find(".frame-standard").onclick=()=>{
    if(!standardCrop)return;
    cancel();crop={...standardCrop};editingFrame=false;positionFrame();cropChanged();zoomToRegion(crop);changed();
    status("Standard slide area selected for this PDF and the clean screen.");
  };
  function positionFrame(){
    frameElement.hidden=!teacher||!editingFrame||!crop;
    find(".frame-toggle").setAttribute("aria-pressed",String(editingFrame));
    if(!crop)return;
    frameElement.style.left=crop.x*scale+"px";frameElement.style.top=crop.y*scale+"px";
    frameElement.style.width=crop.width*scale+"px";frameElement.style.height=crop.height*scale+"px";
  }
  find(".frame-toggle").onclick=()=>{
    if(!source){status("Open a page first.");return;}
    cancel();editingFrame=!editingFrame;
    if(editingFrame&&!crop)crop={x:100,y:originalHeight*.15,width:800,height:originalHeight*.7};
    positionFrame();positionEraser();cropChanged();changed();status(editingFrame?"Move the frame by dragging inside it. Drag a corner to resize. Only the framed area appears on the clean screen.":"Frame hidden. The clean screen keeps the selected area.");
  };
  find(".frame-reset").onclick=()=>{crop=null;editingFrame=false;positionFrame();positionEraser();cropChanged();changed();status("The clean screen now shows the full page.");};
  const frameCallbacks={
    start:event=>{
      if(!crop||!editingFrame)return false;
      event.preventDefault();event.stopPropagation();cancel();
      frameDrag={start:{x:event.clientX,y:event.clientY},original:{...crop},action:event.target.dataset.corner||"move",scale};
      return true;
    },
    move:event=>{
      if(!frameDrag)return;
      crop=adjustFrame(frameDrag.original,frameDrag.action,(event.clientX-frameDrag.start.x)/frameDrag.scale,(event.clientY-frameDrag.start.y)/frameDrag.scale,originalHeight);
      positionFrame();onPreview();
    },
    end:()=>{frameDrag=null;cropChanged();changed();},
    cancel:()=>{frameDrag=null;cropChanged();changed();}
  };
  frameElement.onkeydown=event=>{
    if(!crop||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key))return;
    event.preventDefault();
    const step=event.shiftKey?10:1,dx=event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0,dy=event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0;
    crop=adjustFrame(crop,event.target.dataset.corner||"move",dx,dy,originalHeight);positionFrame();cropChanged();changed();
  };
  function guidePaint(context){
    if(!guide||!["compass","protractor"].includes(tool))return;
    context.save();context.translate(guide.x,guide.y);context.strokeStyle="#176cc7";context.fillStyle="#176cc71f";context.lineWidth=1.2;
    const r=radius();context.beginPath();
    if(tool==="compass"){context.setLineDash([4,4]);context.arc(0,0,r,0,Math.PI*2);context.stroke();}
    else {
      context.rotate(rotation());context.arc(0,0,r,Math.PI,Math.PI*2);context.closePath();context.fill();context.stroke();
      context.font="11px system-ui";context.textAlign="center";context.fillStyle="#174a87";
      for(let angle=0;angle<=180;angle+=5){
        const a=-angle*Math.PI/180,major=angle%15===0,start=polar({x:0,y:0},r,a),end=polar({x:0,y:0},r-(major?10:5),a);
        context.beginPath();context.moveTo(start.x,start.y);context.lineTo(end.x,end.y);context.stroke();
        if(major&&r>55){const label=polar({x:0,y:0},r-20,a);context.fillText(angle,label.x,label.y);}
      }
    }
    context.setLineDash([]);context.beginPath();context.arc(0,0,5,0,Math.PI*2);context.fillStyle="#176cc7";context.fill();context.restore();
  }
  function redraw(){
    if(drawFrame!==undefined)return;
    drawFrame=requestAnimationFrame(()=>{
      drawFrame=undefined;
      ink.setTransform(1,0,0,1,0,0);ink.clearRect(0,0,inkCanvas.width,inkCanvas.height);
      ink.setTransform(scale*tile.dpr,0,0,scale*tile.dpr,-tile.x*tile.dpr,-tile.y*tile.dpr);
      for(const mark of marks)paintMark(ink,mark);
      if(!readOnly)guidePaint(ink);
      if(draft)paintMark(ink,draft);
    });
  }
  function point(event){
    // Use the page's rectangle, never the moving render tile's origin.
    return contactPoint(event,pageElement.getBoundingClientRect(),scale,viewport.getBoundingClientRect());
  }
  function cancel(){
    const hadDraft=!!draft;
    if(gesture?.eraseOriginal&&gesture.eraseOriginal!==marks){undo.push(gesture.eraseOriginal);if(undo.length>80)undo.shift();redo=[];changed();}
    find(".zoom-selection").hidden=true;gesture=null;draft=null;pointerInput?.reset();
    redraw();if(hadDraft)onPreview();
  }
  function positionEraser(){
    const outline=find(".eraser-outline");
    outline.hidden=readOnly||tool!=="eraser"||!eraserAt||editingFrame;
    if(outline.hidden)return;
    const diameter=clamp(Number(find(".ink-width").value)||25,.1,60)*scale;
    outline.style.width=diameter+"px";outline.style.height=diameter+"px";
    outline.style.left=(eraserAt.x*scale-diameter/2)+"px";outline.style.top=(eraserAt.y*scale-diameter/2)+"px";
  }
  function trackEraser(event){
    if(readOnly||tool!=="eraser")return;
    eraserAt=point(event);positionEraser();
  }
  // Hover display is independent of the established tablet drawing lifecycle.
  window.addEventListener("mousemove",event=>{if(inputMode==="mouse")trackEraser(event);},true);
  window.addEventListener("pointermove",event=>{if(inputMode!=="mouse")trackEraser(event);},true);
  window.addEventListener("blur",()=>{eraserAt=null;positionEraser();});
  find(".ink-width").addEventListener("input",positionEraser);
  function erase(at){
    const active=gesture;
    const next=eraseSweep(marks,active.lastErase||at,at,Math.max(.05,Number(find(".ink-width").value)/2));
    active.lastErase=at;eraserAt=at;positionEraser();
    if(next!==marks){if(!active.eraseOriginal)active.eraseOriginal=marks;marks=next;redraw();onPreview();}
  }
  function showZoomBox(a,b){
    const box=find(".zoom-selection");box.hidden=false;
    box.style.left=Math.min(a.x,b.x)*scale+"px";box.style.top=Math.min(a.y,b.y)*scale+"px";
    box.style.width=Math.abs(b.x-a.x)*scale+"px";box.style.height=Math.abs(b.y-a.y)*scale+"px";
  }
  function startPointer(event){
    if((readOnly&&!selectionCallback)||!source)return false;
    event.preventDefault();
    const at=point(event);if(!at)return false;
    // preventDefault keeps tablet input stable, but also suppresses native focus.
    // Explicitly leave the join/name/width field before routing drawing shortcuts.
    if(!readOnly){
      activeInkBoard=root;
      if(document.activeElement!==viewport)viewport.focus({preventScroll:true});
    }
    gesture={id:event.pointerId,contact:true,stabilize:find(".ink-stabilize").checked,pointerType:event.pointerType,start:at,time:event.timeStamp,scale,lastAngle:0,sweep:0};
    if(selectionCallback||event.altKey||tool==="zoom"){
      gesture.zoomBox=true;gesture.end=at;showZoomBox(at,at);
    }else if(pendingSnippet){
      const width=Math.min(250,1000-at.x,(visibleHeight()-at.y)*pendingSnippet.ratio);
      if(width<1){gesture=null;return false;}
      gesture.snippet=true;draft={kind:"image",image:pendingSnippet.image,points:[at,{x:at.x+width,y:at.y+width/pendingSnippet.ratio}],width:1,opacity:1};
    }else if(tool==="eraser"){
      gesture.erase=true;erase(at);
    }else if(tool==="pan"||event.pointerType==="touch"){
      gesture.pan=true;gesture.client=[event.clientX,event.clientY];gesture.scroll=[viewport.scrollLeft,viewport.scrollTop];
    }else if(["compass","protractor"].includes(tool)){
      if(!guide||distance(guide,at)>radius()+22){guide=at;gesture=null;redraw();return false;}
      gesture.center={...guide};gesture.move=distance(guide,at)<14;
      gesture.startAngle=gesture.lastAngle=direction(guide,at);
    }else draft=baseMark(tool,["line","rect","ellipse"].includes(tool)?[at,at]:[at],event);
    if(draft){gesture.rawPoint={...at};gesture.filter={raw:{...at},filtered:{...at},time:event.timeStamp,velocityX:0,velocityY:0};}
    inputCheck?.processed(event,at,at,"start");
    redraw();return true;
  }
  function movePointer(event){
    const active=gesture;
    if(!active||event.pointerId!==active.id)return;
    if(active.pan){
      viewport.scrollLeft=active.scroll[0]-(event.clientX-active.client[0]);
      viewport.scrollTop=active.scroll[1]-(event.clientY-active.client[1]);return;
    }
    const at=point(event);if(!at)return;
    if(active.zoomBox){active.end=at;showZoomBox(active.start,at);return;}
    if(active.erase){erase(at);return;}
    if(active.snippet){
      const width=Math.min(Math.max(10,Math.abs(at.x-active.start.x)),1000-active.start.x,(visibleHeight()-active.start.y)*pendingSnippet.ratio);
      draft.points[1]={x:active.start.x+width,y:active.start.y+width/pendingSnippet.ratio};redraw();onPreview();return;
    }
    if(active.move){guide={x:active.center.x+at.x-active.start.x,y:active.center.y+at.y-active.start.y};}
    else if(tool==="compass"){
      const angle=direction(active.center,at);
      active.sweep=clamp(active.sweep+Math.atan2(Math.sin(angle-active.lastAngle),Math.cos(angle-active.lastAngle)),-Math.PI*2,Math.PI*2);
      active.lastAngle=angle;
      draft={...baseMark("arc",[active.center]),radius:radius(),start:active.startAngle,sweep:active.sweep};
      find(".guide-angle").textContent=(Math.abs(active.sweep)*180/Math.PI).toFixed(1)+"°";
    }else if(tool==="protractor"){
      const angle=direction(active.center,at),degrees=(((rotation()-angle)*180/Math.PI)%360+360)%360;
      find(".guide-angle").textContent=degrees.toFixed(1)+"°";
      draft=baseMark("line",[active.center,at]);draft.guideOnly=!find(".guide-ray").checked;
    }else if(["pen","highlighter"].includes(tool)){
      const accepted=appendContact(draft,at,event,active);
      inputCheck?.processed(event,at,accepted?draft.points.at(-1):null,accepted?"draw":"skip");
    }else{
      let end=at;
      if(event.shiftKey||find(".ink-snap").checked){
        if(tool==="line")end=polar(active.start,distance(active.start,at),Math.round(direction(active.start,at)/(Math.PI/4))*Math.PI/4);
        else{const dx=at.x-active.start.x,dy=at.y-active.start.y,length=Math.max(Math.abs(dx),Math.abs(dy));end={x:active.start.x+Math.sign(dx||1)*length,y:active.start.y+Math.sign(dy||1)*length};}
      }
      draft.points[1]=end;
    }
    redraw();onPreview();
  }
  function endPointer(event){
    if(event.pointerId!==gesture?.id)return;
    if(gesture.zoomBox){
      const a=gesture.start,b=gesture.end,w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y),selected=selectionCallback;
      selectionCallback=null;cancel();
      if(selected){if(w*scale>=4&&h*scale>=4)selected({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:w,height:h});return;}
      if(w*scale>=8&&h*scale>=8){
        const nextScale=Math.min((viewport.clientWidth-32)/w,(viewport.clientHeight-32)/h);
        layout(nextScale/(Math.max(80,viewport.clientWidth-32)/1000));
        viewport.scrollLeft=(Math.min(a.x,b.x)+w/2)*scale-viewport.clientWidth/2+16;
        viewport.scrollTop=(Math.min(a.y,b.y)+h/2)*scale-viewport.clientHeight/2+16;
        scheduleRender();changed();
      }
      return;
    }
    // Do not append the lift packet. Several tablets report a reset position on lift.
    const result=draft,wasSnippet=gesture.snippet;
    if(result&&!wasSnippet&&["pen","highlighter"].includes(tool))finishContact(result,gesture);
    inputCheck?.processed(event,null,null,"end");cancel();
    if(result&&!result.guideOnly)edit([...marks,result]);
    if(wasSnippet){pendingSnippet=null;choose("pen");status("Snippet placed. Undo removes it.");}
  }
  const inputSelect=find(".input-mode");
  let inputMode=defaultInputMode(navigator.userAgent);
  try{const saved=localStorage.getItem("paperdesk.input.mode");if(saved==="mouse"||saved==="pointer")inputMode=saved;}catch{/* Preferences may be unavailable in private browsing. */}
  inputSelect.value=inputMode;
  const stabilization=find(".ink-stabilize");
  let stabilizationPreference=null;
  try{stabilizationPreference=localStorage.getItem("paperdesk.ink.stabilize");}catch{/* Keep the session default. */}
  stabilization.checked=stabilizationPreference===null?inputMode==="mouse":stabilizationPreference==="on";
  stabilization.onchange=()=>{stabilizationPreference=stabilization.checked?"on":"off";try{localStorage.setItem("paperdesk.ink.stabilize",stabilizationPreference);}catch{/* The session setting remains active. */}};
  function configureInput(){
    pointerInput?.dispose();frameInput?.dispose();
    inputMode=inputSelect.value;
    pointerInput=bindPointerInput(inkCanvas,{start:startPointer,move:movePointer,end:endPointer,cancel},window,{mode:inputMode});
    frameInput=bindPointerInput(frameElement,frameCallbacks,window,{mode:inputMode});
    find(".ink-pressure").disabled=inputMode==="mouse";
    if(inputMode==="mouse")find(".ink-pressure").checked=false;
  }
  inputSelect.onchange=()=>{
    configureInput();
    if(stabilizationPreference===null)stabilization.checked=inputMode==="mouse";
    try{localStorage.setItem("paperdesk.input.mode",inputMode);}catch{/* The selected mode still works for this session. */}
    status(inputMode==="mouse"?"Bamboo / legacy mouse input · fixed pen width.":"Standard pen / touch input.");
  };
  configureInput();
  if(!readOnly){
    inputCheck=attachInputCheck(root,inkCanvas,()=>inputMode,()=>stabilization.checked);
    advanced.lastElementChild.append(find(".input-check"));
  }
  find(".ink-undo").onclick=()=>{cancel();if(undo.length){redo.push(marks);marks=undo.pop();changed();redraw();}};
  find(".ink-redo").onclick=()=>{cancel();if(redo.length){undo.push(marks);marks=redo.pop();changed();redraw();}};
  if(!readOnly){
    const activate=()=>{activeInkBoard=root;};
    root.addEventListener("pointerdown",activate,true);
    root.addEventListener("mousedown",activate,true);
    root.addEventListener("focusin",activate,true);
    find(".ink-undo").title="Undo (Ctrl+Z / Cmd+Z)";
    find(".ink-redo").title="Redo (Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z)";
    find(".ink-undo").setAttribute("aria-keyshortcuts","Control+z Meta+z");
    find(".ink-redo").setAttribute("aria-keyshortcuts","Control+y Control+Shift+z Meta+Shift+z");
    window.addEventListener("keydown",event=>{
      const action=historyShortcut(event);if(!action||!source||!root.getClientRects().length)return;
      if(event.target instanceof Element&&event.target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]"))return;
      const dialog=document.querySelector("dialog[open]");if(dialog&&!dialog.contains(root))return;
      if(activeInkBoard&&activeInkBoard!==root&&activeInkBoard.getClientRects().length)return;
      event.preventDefault();activeInkBoard=root;
      // Use the same history actions as the toolbar, including an active eraser drag.
      find(action==="undo"?".ink-undo":".ink-redo").onclick();
    });
  }
  find(".guide-circle").onclick=()=>{if(guide)edit([...marks,{...baseMark("arc",[guide]),radius:radius(),start:0,sweep:Math.PI*2}]);};
  find(".guide-radius").oninput=find(".guide-rotation").oninput=redraw;
  find(".board-in").onclick=()=>{layout(zoom*1.3,{x:viewport.clientWidth/2,y:viewport.clientHeight/2});changed();};
  find(".board-out").onclick=()=>{layout(zoom/1.3,{x:viewport.clientWidth/2,y:viewport.clientHeight/2});changed();};
  find(".board-fit").onclick=()=>{fit();changed();};find(".board-width").onclick=()=>{fit("width");changed();};
  find(".board-scratch").onchange=()=>{layout();changed();};
  window.addEventListener("keydown",event=>{if(event.key==="Escape"&&(gesture?.zoomBox||selectionCallback||pendingSnippet)){event.preventDefault();selectionCallback=null;pendingSnippet=null;cancel();}});
  viewport.onscroll=scheduleRender;
  viewport.addEventListener("wheel",event=>{
    if(!event.ctrlKey||readOnly)return;
    event.preventDefault();const rect=viewport.getBoundingClientRect();
    layout(zoom*Math.exp(-event.deltaY*.002),{x:event.clientX-rect.left,y:event.clientY-rect.top});changed();
  },{passive:false});
  new ResizeObserver(()=>{if(source){if(readOnly)fit();else layout();}}).observe(viewport);
  let timerStart=null,timerElapsed=0;
  const target=()=>clamp(Number(find(".timer-minutes").value)||5,.1,180)*60000;
  const clock=()=>{
    let elapsed=timerElapsed+(timerStart===null?0:performance.now()-timerStart);
    const down=find(".timer-mode").value==="Countdown";
    if(down&&elapsed>=target()){elapsed=target();timerElapsed=elapsed;timerStart=null;}
    const remaining=down?Math.ceil((target()-elapsed)/1000):Math.floor(elapsed/1000);
    find(".timer-readout").textContent=Math.floor(remaining/60).toString().padStart(2,"0")+":"+(remaining%60).toString().padStart(2,"0");
    find(".timer-start").textContent=timerStart===null?"Start":"Pause";
  };
  find(".board-timer-toggle").onclick=()=>find(".board-timer").hidden=!find(".board-timer").hidden;
  find(".timer-start").onclick=()=>{if(timerStart===null){if(find(".timer-mode").value==="Countdown"&&timerElapsed>=target())timerElapsed=0;timerStart=performance.now();}else{timerElapsed+=performance.now()-timerStart;timerStart=null;}clock();};
  find(".timer-reset").onclick=find(".timer-minutes").onchange=()=>{timerElapsed=0;timerStart=null;clock();};
  find(".timer-mode").onchange=()=>{find(".timer-minutes-label").hidden=find(".timer-mode").value==="Stopwatch";timerElapsed=0;timerStart=null;clock();};
  setInterval(clock,200);
  async function setSource(next,initial=[],view={}){
    const current=++sceneVersion;generation++;renderTask?.cancel();cancel();
    selectionCallback=null;pendingSnippet=null;source=next;page=next.page||null;guide=null;eraserAt=null;positionEraser();undo=[];redo=[];renderedTile=null;
    originalHeight=page?page.getViewport({scale:1}).height/page.getViewport({scale:1}).width*1000:next.image.naturalHeight/next.image.naturalWidth*1000;
    logicalHeight=originalHeight+Math.max(220,430);
    initialRegion=normalizeFrame(view.initialRegion,originalHeight);
    crop=normalizeFrame(view.crop,originalHeight);standardCrop=normalizeFrame(view.defaultCrop,originalHeight);
    find(".frame-standard").hidden=!teacher||!standardCrop;
    editingFrame=false;positionFrame();
    marks=Array.isArray(initial)?initial.map(mark=>mark.kind?clone(mark):{
      kind:mark.tool||"pen",points:mark.points.map(([x,y])=>({x:x*1000,y:y*logicalHeight,p:.5})),
      color:mark.color,width:mark.width??(mark.tool==="highlighter"?13:3),opacity:mark.tool==="highlighter"?.31:1,pattern:"Solid",variable:false
    }):[];
    await loadMarkImages(marks);
    if(current!==sceneVersion)return;
    find(".board-scratch").checked=!teacher&&!!view.scratch;
    viewport.scrollTo(0,0);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(current!==sceneVersion)return;
    if(view.zoom)layout(view.zoom);else if(teacher&&crop)zoomToRegion(crop);else if(initialRegion)zoomToRegion(initialRegion);else fit();
    changed();status(next.page?"Native PDF · Alt + drag to zoom into a rectangle.":"Image slide · Alt + drag to zoom into a rectangle.");
  }
  async function snapshot(){
    if(!source)throw new Error("Open a page first.");
    const savedSource=source,savedPage=page,savedMarks=clone(marks),savedHeight=visibleHeight(),savedOriginalHeight=originalHeight;
    const image=document.createElement("canvas");image.width=1600;image.height=Math.ceil(savedHeight*1.6);
    const context=image.getContext("2d");context.fillStyle="#fff";context.fillRect(0,0,image.width,image.height);
    if(savedPage){
      const view=savedPage.getViewport({scale:1600/savedPage.getViewport({scale:1}).width});
      await savedPage.render({canvas:image,viewport:view}).promise;
    }else context.drawImage(savedSource.image,0,0,1600,savedOriginalHeight*1.6);
    context.setTransform(1.6,0,0,1.6,0,0);for(const mark of savedMarks)paintMark(context,mark);
    return image;
  }
  async function nativePDF(){
    if(!source?.bytes||!page)throw new Error("This slide has no native PDF source.");
    const savedSource=source,savedPage=page,savedMarks=clone(marks);
    const input=await PDFLib.PDFDocument.load(savedSource.bytes,{updateMetadata:false}),output=await PDFLib.PDFDocument.create();
    const [copy]=await output.copyPages(input,[savedSource.pageNumber-1]);output.addPage(copy);
    const view=savedPage.getViewport({scale:1});
    for(const mark of savedMarks)await saveAnnotation(output,copy,mark,p=>view.convertToPdfPoint(p.x*view.width/1000,p.y*view.width/1000));
    return output.save({updateFieldAppearances:false});
  }
  async function snapshotRegion(region){
    const savedPage=page,savedSource=source,savedMarks=clone(marks);
    const output=document.createElement("canvas");
    const factor=Math.min(4,2400/Math.max(region.width,region.height),Math.sqrt(6_000_000/(region.width*region.height)));
    output.width=Math.ceil(region.width*factor);output.height=Math.ceil(region.height*factor);
    const context=output.getContext("2d");context.fillStyle="#fff";context.fillRect(0,0,output.width,output.height);
    if(savedPage){
      const native=savedPage.getViewport({scale:1});
      await savedPage.render({canvas:output,viewport:savedPage.getViewport({scale:1000*factor/native.width}),transform:[1,0,0,1,-region.x*factor,-region.y*factor]}).promise;
    }else{
      context.setTransform(factor,0,0,factor,-region.x*factor,-region.y*factor);
      context.drawImage(savedSource.image,0,0,1000,originalHeight);
    }
    await loadMarkImages(savedMarks);
    context.setTransform(factor,0,0,factor,-region.x*factor,-region.y*factor);
    for(const mark of savedMarks)paintMark(context,mark);
    return output.toDataURL("image/png");
  }
  return {setSource,fit,
    zoomBy:factor=>layout(zoom*factor,{x:viewport.clientWidth/2,y:viewport.clientHeight/2}),
    getScratch:()=>find(".board-scratch").checked,
    cancelSelection:()=>{selectionCallback=null;cancel();},
    selectRegion:callback=>{cancel();selectionCallback=callback;status("Drag a rectangle around the section to copy. Escape cancels.");},
    placeSnippet:async(image,ratio)=>{if(!source)throw new Error("Open a teacher PDF first.");await loadMarkImages([{kind:"image",image}]);cancel();pendingSnippet={image,ratio};status("Click or drag on your page to place the snippet; drag farther right for a larger copy.");},
    snapshotRegion,fitDefaultView:()=>{if(initialRegion)zoomToRegion(initialRegion);else fit();},snapshot,nativePDF,getMarks:()=>clone(marks),
    setMarks:value=>{marks=clone(value);void loadMarkImages(marks).then(redraw).catch(console.error);redraw();},
    getCrop:()=>clone(crop),
    setCrop:value=>{const next=normalizeFrame(value,originalHeight);if(JSON.stringify(crop)===JSON.stringify(next))return;crop=next;if(readOnly)fit();else positionFrame();},
    getDisplayMarks:()=>clone(draft&&!draft.guideOnly?[...marks,draft]:marks),
    presentation:()=>source?{bytes:source.bytes,pageNumber:source.pageNumber,image:source.image?.src,marks:clone(marks),height:originalHeight,crop:clone(crop)}:null,
    getSource:()=>source,status,
    getLogicalHeight:()=>logicalHeight,
    legacyMarks:values=>Array.isArray(values)?values.map(mark=>{
      if(mark.kind)return mark;
      return {kind:mark.tool||"pen",points:mark.points.map(([x,y])=>({x:x*1000,y:y*logicalHeight,p:.5})),
        color:mark.color,width:mark.width??(mark.tool==="highlighter"?13:3),opacity:mark.tool==="highlighter"?.31:1,pattern:"Solid",variable:false};
    }):[]};
}
