export function snapGeometry(at,marks,tolerance,{lines=true}={}){
 let best=null,distance=tolerance;
 const consider=p=>{const d=Math.hypot(at.x-p.x,at.y-p.y);if(d<=distance){best={x:p.x,y:p.y};distance=d;}};
 for(const mark of marks){
  if(mark.kind==='point')consider(mark.points[0]);
  if(mark.kind==='line')for(const p of mark.points)consider(p);
 }
 if(best)return {point:best,target:true};
 if(lines)for(const mark of marks)if(mark.kind==='line'){
  const [a,b]=mark.points,dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;
  const t=l?Math.max(0,Math.min(1,((at.x-a.x)*dx+(at.y-a.y)*dy)/l)):0;
  consider({x:a.x+t*dx,y:a.y+t*dy});
 }
 return {point:best||at,target:!!best};
}
