import {pathPoints} from './marks.mjs';
// Clip vector centerlines against the circular brush, leaving editable vector fragments.
function erasePath(mark,from,center,radius){
  const points=pathPoints(mark),r=radius+mark.width/2;
  if(points.length===1){const p=points[0],dx=center.x-from.x,dy=center.y-from.y,t=Math.max(0,Math.min(1,((p.x-from.x)*dx+(p.y-from.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-from.x-t*dx,p.y-from.y-t*dy)<=r?[]:[mark];}
  let fragments=[],current=[],travel=0,startOffset=0,hit=false;
  const flush=()=>{if(current.length>1)fragments.push({...mark,kind:'path',points:current,dashOffset:(mark.dashOffset||0)+startOffset});current=[];};
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,p:(a.p??.5)+((b.p??.5)-(a.p??.5))*t});
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
    if(b.breakBefore){flush();travel=0;continue;}
    const cuts=capsuleIntervals(a,b,from,center,r);
    let cursor=0,intervals=[];
    for(const [lo,hi] of cuts){if(lo>cursor)intervals.push([cursor,lo]);cursor=Math.max(cursor,hi);hit=true;}
    if(cursor<1)intervals.push([cursor,1]);
    if(!intervals.length)flush();
    for(const [lo,hi] of intervals){
      if(lo>0)flush();
      if(!current.length){startOffset=travel+lo*len;current.push(lerp(a,b,lo));}
      current.push(lerp(a,b,hi));if(hi<1)flush();
    }
    travel+=len;
  }
  flush();return hit?fragments:[mark];
}
function capsuleIntervals(a,b,from,to,r){
  const dx=b.x-a.x,dy=b.y-a.y,A=dx*dx+dy*dy,cuts=[];
  function circle(c){
    const x=a.x-c.x,y=a.y-c.y,B=2*(x*dx+y*dy),C=x*x+y*y-r*r,D=B*B-4*A*C;
    if(!A){if(C<0)cuts.push([0,1]);return;}
    if(D<=0)return;const lo=Math.max(0,(-B-Math.sqrt(D))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(D))/(2*A));if(lo<hi)cuts.push([lo,hi]);
  }
  circle(from);circle(to);
  const vx=to.x-from.x,vy=to.y-from.y,length=Math.hypot(vx,vy);
  if(length){
    const ux=vx/length,uy=vy/length,x=(a.x-from.x)*ux+(a.y-from.y)*uy,y=-(a.x-from.x)*uy+(a.y-from.y)*ux;
    let lo=0,hi=1;
    for(const [position,velocity,min,max] of [[x,dx*ux+dy*uy,0,length],[y,-dx*uy+dy*ux,-r,r]]){
      if(Math.abs(velocity)<1e-12){if(position<min||position>max){hi=-1;break;}}
      else{const t1=(min-position)/velocity,t2=(max-position)/velocity;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}
    }
    if(lo<hi)cuts.push([lo,hi]);
  }
  cuts.sort((a,b)=>a[0]-b[0]);const merged=[];
  for(const cut of cuts){const last=merged.at(-1);if(last&&cut[0]<=last[1])last[1]=Math.max(last[1],cut[1]);else merged.push([...cut]);}
  return merged;
}
export function eraseCircle(mark,center,radius){return erasePath(mark,center,center,radius);}
export function eraseSweep(marks,from,to,radius){
  let changed=false;const next=[];
  for(const mark of marks){const parts=erasePath(mark,from,to,radius);if(parts.length!==1||parts[0]!==mark)changed=true;next.push(...parts);}
  return changed?next:marks;
}
