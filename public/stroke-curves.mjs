const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,p:((a.p??.5)+(b.p??.5))/2});
export const isFreehand=mark=>mark.kind==='pen'||mark.kind==='highlighter';
// Midpoint quadratics join with a continuous tangent and never overshoot the
// control-point envelope. Raw tablet samples and contact timing stay untouched.
export function curveCommands(points){
 if(!points.length)return [];
 const commands=[{type:'M',end:points[0]}];
 for(let i=1;i<points.length-1;i++)commands.push({type:'Q',control:points[i],end:midpoint(points[i],points[i+1])});
 if(points.length>1)commands.push({type:'L',end:points.at(-1)});
 return commands;
}
function flatQuadratic(a,c,b,out,tolerance,depth=0){
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
 const deviation=length?Math.abs(dy*c.x-dx*c.y+b.x*a.y-b.y*a.x)/length:Math.hypot(c.x-a.x,c.y-a.y);
 // Also split a folded segment whose control lies beyond either end.
 const projection=length?((c.x-a.x)*dx+(c.y-a.y)*dy)/(length*length):.5;
 if(depth>=12||(deviation<=tolerance&&projection>=0&&projection<=1)){out.push({...b});return;}
 const ac=midpoint(a,c),cb=midpoint(c,b),middle=midpoint(ac,cb);
 flatQuadratic(a,ac,middle,out,tolerance,depth+1);flatQuadratic(middle,cb,b,out,tolerance,depth+1);
}
export function flattenCurves(points,tolerance=.035){
 const groups=[];for(const p of points){if(!groups.length||p.breakBefore)groups.push([]);groups.at(-1).push(p);}
 const output=[];
 for(const group of groups){
  let previous=null;
  for(const command of curveCommands(group)){
   if(command.type==='Q')flatQuadratic(previous,command.control,command.end,output,tolerance);
   else output.push({...command.end});
   previous=command.end;
  }
 }
 return output;
}
