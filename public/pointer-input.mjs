// Keep the gesture lifecycle independent of optional browser pointer capture.
export function defaultInputMode(userAgent){
  return /Windows/i.test(userAgent)&&/Firefox\//i.test(userAgent)?"mouse":"pointer";
}
export function bindPointerInput(element,callbacks,target=window,{mode="pointer"}={}){
  let active=null;
  const mouse=mode==="mouse";
  const events=mouse?{down:"mousedown",move:"mousemove",up:"mouseup"}:
    {down:"pointerdown",move:"pointermove",up:"pointerup"};
  function packet(event){
    if(!mouse)return event;
    return {pointerId:1,pointerType:"mouse",button:event.button,buttons:event.buttons,
      clientX:event.clientX,clientY:event.clientY,timeStamp:event.timeStamp,pressure:.5,
      isPrimary:true,altKey:event.altKey,shiftKey:event.shiftKey,target:event.target,
      preventDefault:()=>event.preventDefault(),stopPropagation:()=>event.stopPropagation()};
  }
  function reset(){
    const old=active;active=null;
    if(old&&!mouse){
      try{if(element.hasPointerCapture?.(old.id))element.releasePointerCapture(old.id);}catch{/* Some tablet drivers reject capture/release. */}
    }
  }
  function cancel(){
    if(!active)return;
    reset();callbacks.cancel?.();
  }
  function down(raw){
    const event=packet(raw);
    if(event.button!==0 && !(event.pointerType==="pen"&&event.button===-1))return;
    if(event.pointerType==="touch"&&event.isPrimary===false)return;
    cancel();
    if(callbacks.start(event)===false)return;
    active={id:event.pointerId};
    if(!mouse){
      try{element.setPointerCapture?.(event.pointerId);}catch{/* Window listeners still receive the gesture. */}
    }
  }
  function move(raw){
    const event=packet(raw);
    if(!active||event.pointerId!==active.id)return;
    callbacks.move?.(event);
  }
  function up(raw){
    const event=packet(raw);
    if(!active||event.pointerId!==active.id)return;
    reset();callbacks.end?.(event);
  }
  function pointerCancel(event){if(active?.id===event.pointerId)cancel();}
  element.addEventListener(events.down,down);
  target.addEventListener(events.move,move,true);
  target.addEventListener(events.up,up,true);
  if(!mouse)target.addEventListener("pointercancel",pointerCancel,true);
  target.addEventListener("blur",cancel);
  return {reset,cancel,dispose(){
    cancel();element.removeEventListener(events.down,down);
    target.removeEventListener(events.move,move,true);
    target.removeEventListener(events.up,up,true);
    if(!mouse)target.removeEventListener("pointercancel",pointerCancel,true);
    target.removeEventListener("blur",cancel);
  }};
}
