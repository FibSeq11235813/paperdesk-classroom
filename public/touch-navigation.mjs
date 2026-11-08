export function touchMetrics(points){
  const [a,b]=points;
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))};
}
export function touchView(start,current){
  const zoom=Math.min(start.maxZoom||10,Math.max(.1,start.zoom*current.distance/start.distance));
  const scale=start.scale*zoom/start.zoom;
  return {zoom,left:start.anchorX*scale-current.x+16,top:start.anchorY*scale-current.y+16};
}
// One touch belongs to the drawing tool. Two touches take over navigation;
// remaining fingers stay suppressed until all lift, avoiding stray ink.
export function bindTouchNavigation(surface,callbacks,target=window){
  const points=new Map();let navigating=false,suppressed=false;
  const pair=()=>touchMetrics([...points.values()].slice(0,2));
  const block=event=>{event.preventDefault();event.stopImmediatePropagation();};
  function down(event){
    if(event.pointerType!=="touch")return;
    if(callbacks.ignore?.(event)){block(event);return;}
    if(callbacks.enabled?.()===false)return;
    points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(points.size>=2){
      block(event);suppressed=true;
      if(!navigating){navigating=true;callbacks.start(pair());}
      try{surface.setPointerCapture(event.pointerId);}catch{/* Window listeners provide fallback. */}
    }else if(suppressed)block(event);
  }
  function move(event){
    if(event.pointerType!=="touch"||!points.has(event.pointerId))return;
    points.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(suppressed){block(event);if(navigating&&points.size>=2)callbacks.move(pair());}
  }
  function up(event){
    if(event.pointerType!=="touch"||!points.has(event.pointerId))return;
    if(suppressed)block(event);
    points.delete(event.pointerId);
    if(navigating&&points.size<2){navigating=false;callbacks.end?.();}
    if(!points.size)suppressed=false;
  }
  function reset(){if(navigating)callbacks.end?.();points.clear();navigating=false;suppressed=false;}
  surface.addEventListener("pointerdown",down,true);
  target.addEventListener("pointermove",move,true);
  target.addEventListener("pointerup",up,true);
  target.addEventListener("pointercancel",up,true);
  target.addEventListener("blur",reset);
  return {reset};
}
