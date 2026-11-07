const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function normalizeFrame(value,height){
  if(!value || ![value.x,value.y,value.width,value.height].every(Number.isFinite))return null;
  const width=clamp(value.width,Math.min(40,1000),1000);
  const frameHeight=clamp(value.height,Math.min(40,height),height);
  return {x:clamp(value.x,0,1000-width),y:clamp(value.y,0,height-frameHeight),width,height:frameHeight};
}
export function adjustFrame(frame,action,dx,dy,height){
  const start=normalizeFrame(frame,height);
  if(!start)return null;
  if(action==="move")return {...start,x:clamp(start.x+dx,0,1000-start.width),y:clamp(start.y+dy,0,height-start.height)};
  let left=start.x,top=start.y,right=left+start.width,bottom=top+start.height;
  if(action.includes("w"))left=clamp(left+dx,0,right-Math.min(40,right));
  if(action.includes("e"))right=clamp(right+dx,left+40,1000);
  if(action.includes("n"))top=clamp(top+dy,0,bottom-Math.min(40,bottom));
  if(action.includes("s"))bottom=clamp(bottom+dy,top+Math.min(40,height),height);
  return normalizeFrame({x:left,y:top,width:right-left,height:bottom-top},height);
}

// Carry one PDF-wide frame across pages, including pages with different heights.
export function frameForPage(saved,height){
  if(!saved?.crop)return null;
  const ratio=Number.isFinite(saved.height)&&saved.height>0?height/saved.height:1;
  return normalizeFrame({...saved.crop,y:saved.crop.y*ratio,height:saved.crop.height*ratio},height);
}
