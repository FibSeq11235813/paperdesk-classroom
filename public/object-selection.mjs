import {pathPoints} from './marks.mjs';
export function objectBounds(mark){
  const points=pathPoints(mark),padding=(mark.width||0)/2;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
  return {x:left-padding,y:top-padding,width:right-left+padding*2,height:bottom-top+padding*2};
}
export function hitObject(mark,at,tolerance){
  if(mark.kind==='image'){
    const b=objectBounds(mark);return at.x>=b.x&&at.x<=b.x+b.width&&at.y>=b.y&&at.y<=b.y+b.height;
  }
  const points=pathPoints(mark),radius=tolerance+(mark.width||0)/2;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=i&&!a.breakBefore?points[i-1]:a;
    const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
    const t=l?Math.max(0,Math.min(1,((at.x-a.x)*dx+(at.y-a.y)*dy)/l)):0;
    if(Math.hypot(at.x-a.x-t*dx,at.y-a.y-t*dy)<=radius)return true;
  }
  return false;
}
export function moveObject(mark,dx,dy){return {...mark,points:mark.points.map(p=>({...p,x:p.x+dx,y:p.y+dy}))};}
export function insideBox(mark,a,b){
  const box=objectBounds(mark);return box.x>=Math.min(a.x,b.x)&&box.y>=Math.min(a.y,b.y)&&box.x+box.width<=Math.max(a.x,b.x)&&box.y+box.height<=Math.max(a.y,b.y);
}
