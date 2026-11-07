import {stabilizePoint} from "./stroke-filter.mjs";
export function contactPoint(event,rect,scale,clip=null){
  if(!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)||!Number.isFinite(scale)||scale<=0)return null;
  if(clip&&(event.clientX<clip.left||event.clientY<clip.top||event.clientX>clip.right||event.clientY>clip.bottom))return null;
  const x=(event.clientX-rect.left)/scale,y=(event.clientY-rect.top)/scale;
  if(x<0 || y<0 || x>rect.width/scale || y>rect.height/scale)return null;
  return {x,y,p:Number.isFinite(event.pressure)&&event.pressure>0?Math.min(1,event.pressure):0.5};
}
export function appendContact(mark,point,event,previous){
  // The down/up lifecycle establishes pen contact. Some pads report buttons=0 throughout a valid stroke.
  const penContact=previous.contact===true;
  if(!point || (!(event.buttons&1)&&!penContact))return false;
  if(Number.isFinite(event.timeStamp)&&event.timeStamp<previous.time)return false;
  const last=previous.rawPoint||mark.points.at(-1);
  const elapsed=Math.max(0,event.timeStamp-previous.time);
  const jump=Math.hypot(point.x-last.x,point.y-last.y)*previous.scale;
  if(jump<0.15)return false;
  if(jump>Math.max(260,elapsed*9))point.breakBefore=true;
  previous.rawPoint={...point};
  const drawn=previous.stabilize?stabilizePoint(point,event.timeStamp,previous.scale,previous):point;
  mark.points.push(drawn);
  previous.time=event.timeStamp;
  return true;
}

export function finishContact(mark,previous){
  const raw=previous?.rawPoint,last=mark?.points.at(-1);
  if(!previous?.stabilize||!raw||!last)return;
  if(Math.hypot(last.x-raw.x,last.y-raw.y)>.01)mark.points.push({...raw});
}
