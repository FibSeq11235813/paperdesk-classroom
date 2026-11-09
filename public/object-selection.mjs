import {pathPoints,arrowPaths} from './marks.mjs';
export function objectBounds(mark){
  const points=[...pathPoints(mark),...arrowPaths(mark).flat()],padding=(mark.width||0)/2;
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const p of points){left=Math.min(left,p.x);top=Math.min(top,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}
  return {x:left-padding,y:top-padding,width:right-left+padding*2,height:bottom-top+padding*2};
}
export function hitObject(mark,at,tolerance){
  if(mark.kind==='image'){
    const b=objectBounds(mark);return at.x>=b.x&&at.x<=b.x+b.width&&at.y>=b.y&&at.y<=b.y+b.height;
  }
  const points=[...pathPoints(mark),...arrowPaths(mark).flatMap(path=>path.map((p,i)=>i? p:{...p,breakBefore:true}))],radius=tolerance+(mark.width||0)/2;
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
export function selectionBounds(marks){
  if(!marks.length)return null;
  const boxes=marks.map(objectBounds),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
}
export function selectionCorners(box){return [
  {x:box.x,y:box.y},{x:box.x+box.width,y:box.y},
  {x:box.x+box.width,y:box.y+box.height},{x:box.x,y:box.y+box.height}
];}
export function resizeFactor(anchor,corner,dx,dy){
  const x=corner.x-anchor.x,y=corner.y-anchor.y,length=x*x+y*y;
  return length?Math.max(.02,Math.min(100,1+(dx*x+dy*y)/length)):1;
}
export function scaleObject(mark,anchor,factor){
  const result={...mark,points:mark.points.map(p=>({...p,x:anchor.x+(p.x-anchor.x)*factor,y:anchor.y+(p.y-anchor.y)*factor}))};
  if(mark.kind==='arc')result.radius=mark.radius*factor;
  // Keep the chosen pen width while resizing geometry, including freehand ink.
  return result;
}
