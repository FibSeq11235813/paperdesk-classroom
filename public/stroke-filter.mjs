function blend(previous,next,alpha){return previous+alpha*(next-previous);}
function weight(cutoff,seconds){return 1/(1+1/(2*Math.PI*cutoff*seconds));}
// An adaptive low-pass filter smooths slow ink and follows fast movements more closely.
export function stabilizePoint(point,time,scale,state){
  const previous=state.filter;
  if(!previous || point.breakBefore){
    state.filter={raw:{...point},filtered:{...point},time,velocityX:0,velocityY:0};
    return {...point};
  }
  const seconds=Math.min(.1,Math.max(.001,(time-previous.time)/1000));
  const velocityWeight=weight(1,seconds);
  const velocityX=blend(previous.velocityX,(point.x-previous.raw.x)*scale/seconds,velocityWeight);
  const velocityY=blend(previous.velocityY,(point.y-previous.raw.y)*scale/seconds,velocityWeight);
  const cutoff=1.5+.04*Math.hypot(velocityX,velocityY);
  const alpha=weight(cutoff,seconds);
  let x=blend(previous.filtered.x,point.x,alpha),y=blend(previous.filtered.y,point.y,alpha);
  // Bound the trailing distance in screen pixels at every zoom level.
  const lag=Math.hypot(point.x-x,point.y-y)*scale;
  if(lag>4){const ratio=4/lag;x=point.x+(x-point.x)*ratio;y=point.y+(y-point.y)*ratio;}
  const filtered={...point,x,y};
  state.filter={raw:{...point},filtered,time,velocityX,velocityY};
  return filtered;
}
