export function attachInputCheck(root,canvas,getMode,getStabilization=()=>false){
  const panel=document.createElement("details");
  panel.className="input-check";
  panel.innerHTML=`<summary>Tablet input check</summary><p>If your pad still fails, record a few strokes, then copy the report into our chat. The report stays in this browser and includes browser details, contact events, and the points used to draw.</p><div class="actions"><button class="input-record">Start 15-second input check</button><button class="input-copy" disabled>Copy input report</button><output class="input-count" role="status"></output></div><textarea class="input-report" aria-label="Tablet input report" readonly hidden></textarea>`;
  root.append(panel);
  const find=selector=>panel.querySelector(selector);
  let expires=0,started=0,events=[],transitions=[],processed=[],counts={},timer,lastUpdate=0,mouseContact=false;
  const contacts=new Set();
  const recording=()=>expires>0&&performance.now()<=expires;
  for(const type of ["pointerdown","pointermove","pointerup","pointercancel","mousedown","mousemove","mouseup","touchstart","touchmove","touchend"]){
    window.addEventListener(type,event=>{
      if(!recording())return;
      const rect=canvas.closest(".native-viewport").getBoundingClientRect();
      const inWorkspace=Number.isFinite(event.clientX)&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;
      counts[type]=(counts[type]||0)+1;
      const hadContact=mouseContact||contacts.size>0;
      const down=["pointerdown","mousedown","touchstart"].includes(type);
      const up=["pointerup","pointercancel","mouseup","touchend"].includes(type);
      if(down&&inWorkspace){
        if(type==="mousedown")mouseContact=true;
        else contacts.add(event.pointerId??"touch");
      }
      if(hadContact||(down&&inWorkspace)){
        const sample={type,inWorkspace,ms:Math.round(performance.now()-started),
          inputTimeMs:Number(event.timeStamp.toFixed(3)),pointerType:event.pointerType??null,
          id:event.pointerId??null,button:event.button??null,buttons:event.buttons??null,pressure:event.pressure??null,
          x:Number.isFinite(event.clientX)?Math.round(event.clientX):null,
          y:Number.isFinite(event.clientY)?Math.round(event.clientY):null};
        // Preserve the beginning of the actual contact instead of a rolling hover tail.
        if(events.length<400)events.push(sample);
        if((down||up)&&transitions.length<64)transitions.push(sample);
      }
      if(up){
        if(type==="mouseup")mouseContact=false;
        else contacts.delete(event.pointerId??"touch");
      }
      if(performance.now()-lastUpdate>250){
        find(".input-count").textContent=events.length+" contact events recorded";
        lastUpdate=performance.now();
      }
    },true);
  }
  find(".input-record").onclick=()=>{
    started=performance.now();expires=started+15000;events=[];transitions=[];processed=[];counts={};lastUpdate=0;mouseContact=false;contacts.clear();
    find(".input-count").textContent="Recording — draw several strokes with the pad.";
    find(".input-copy").disabled=false;find(".input-report").hidden=true;
    clearTimeout(timer);timer=setTimeout(()=>{
      expires=0;find(".input-count").textContent="Recording complete — "+events.length+" contact events. Copy the report.";
    },15000);
  };
  find(".input-copy").onclick=async()=>{
    expires=0;clearTimeout(timer);
    const report=JSON.stringify({app:"Paperdesk Classroom 0.6",mode:getMode(),stabilization:getStabilization(),
      browser:navigator.userAgent,counts,transitions,events,processed},null,2);
    try{await navigator.clipboard.writeText(report);find(".input-count").textContent="Report copied. Paste it into our chat.";}
    catch{const area=find(".input-report");area.value=report;area.hidden=false;area.select();find(".input-count").textContent="Copy the selected report and paste it into our chat.";}
  };
  return {
    processed(event,raw,drawn,phase){
      if(!recording()||processed.length>=400)return;
      const position=value=>value?{x:Number(value.x.toFixed(3)),y:Number(value.y.toFixed(3))}:null;
      processed.push({phase,inputTimeMs:Number(event.timeStamp.toFixed(3)),raw:position(raw),drawn:position(drawn)});
    }
  };
}
