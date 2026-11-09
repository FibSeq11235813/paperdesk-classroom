const TAU=Math.PI*2;
export function compassHandles(center,radius,angle,scale){
  const c=Math.cos(angle),s=Math.sin(angle),offset=Math.max(32/scale,radius*.32);
  return {pin:center,tip:{x:center.x+c*radius,y:center.y+s*radius},
    radius:{x:center.x+c*radius*.7-s*32/scale,y:center.y+s*radius*.7+c*32/scale},
    rotate:{x:center.x+c*radius*.5+s*offset,y:center.y+s*radius*.5-c*offset}};
}
export function compassHit(handles,point,scale){
  return ['pin','tip','radius','rotate'].find(key=>Math.hypot(handles[key].x-point.x,handles[key].y-point.y)<=15/scale)||null;
}
export function arcStep(previous,current){return Math.atan2(Math.sin(current-previous),Math.cos(current-previous));}
export function paintCompass(ctx,center,radius,angle,scale,{locked,color,tip}){
  const h=compassHandles(center,radius,angle,scale),u=1/scale;
  const line=(a,b,width,stroke)=>{ctx.strokeStyle=stroke;ctx.lineWidth=width*u;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
  const disk=(p,r,fill,stroke='#526376')=>{ctx.beginPath();ctx.arc(p.x,p.y,r*u,0,TAU);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1*u;ctx.stroke();};
  const between=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#52738d40';ctx.lineWidth=u;ctx.setLineDash([3*u,7*u]);ctx.beginPath();ctx.arc(center.x,center.y,radius,0,TAU);ctx.stroke();ctx.setLineDash([]);
  // Steel pin leg, with a separate sharpened needle at the paper.
  const needle=between(h.rotate,h.pin,.88);
  line(h.rotate,needle,9,'#293747');line(h.rotate,needle,6,'#b7c4cf');
  line(between(h.rotate,needle,.08),between(h.rotate,needle,.94),1.5,'#edf5fa');
  line(needle,h.pin,2,'#27303c');
  // Pencil holder on the opposite leg, plus a colored barrel and exposed tip.
  const holder=between(h.rotate,h.tip,.42),wood=between(h.rotate,h.tip,.88),lead=between(h.rotate,h.tip,.98);
  line(h.rotate,holder,9,'#293747');line(h.rotate,holder,6,'#aab8c5');
  line(holder,wood,tip==='Highlighter'?13:10,'#293747');
  line(holder,wood,tip==='Highlighter'?10:7,tip==='Pencil'?'#e4b24c':color);
  line(between(holder,wood,.08),between(holder,wood,.92),1.5,'#ffffff88');
  const dx=h.tip.x-h.rotate.x,dy=h.tip.y-h.rotate.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
  ctx.beginPath();ctx.moveTo(wood.x+nx*4*u,wood.y+ny*4*u);ctx.lineTo(wood.x-nx*4*u,wood.y-ny*4*u);ctx.lineTo(h.tip.x,h.tip.y);ctx.closePath();
  ctx.fillStyle=tip==='Pencil'?'#dbc2a0':color;ctx.fill();line(lead,h.tip,2.5,tip==='Pencil'?'#30333b':color);
  line(between(h.rotate,h.tip,.39),between(h.rotate,h.tip,.49),13,'#63778a');
  line(between(h.rotate,h.tip,.40),between(h.rotate,h.tip,.47),10,'#d9e3eb');
  // Fine-adjustment crossbar and its knurled thumbwheel.
  const brace=between(h.rotate,h.pin,.62);
  line(brace,h.radius,3,'#485c6f');line(brace,h.radius,1,'#dbe6ee');
  disk(h.radius,7,'#8195a6');
  for(let i=-2;i<=2;i++)line({x:h.radius.x+i*2*u,y:h.radius.y-4*u},{x:h.radius.x+i*2*u,y:h.radius.y+4*u},.8,'#e6eef4');
  // Ribbed turning grip sits above the circular pivot joint.
  const middle=between(h.pin,h.tip,.5),vx=h.rotate.x-middle.x,vy=h.rotate.y-middle.y,vl=Math.hypot(vx,vy)||1;
  const grip={x:h.rotate.x+vx/vl*21*u,y:h.rotate.y+vy/vl*21*u};
  line(h.rotate,grip,10,'#263747');line(h.rotate,grip,6,'#62778b');
  disk(h.rotate,11,'#c8d5df');disk(h.rotate,5,'#536b80');
  line({x:h.rotate.x-3*u,y:h.rotate.y},{x:h.rotate.x+3*u,y:h.rotate.y},1,'#edf5fa');
  // A small pin ring communicates the lock without hiding the needle.
  ctx.strokeStyle=locked?'#c24145':'#2874b8';ctx.lineWidth=1.5*u;
  ctx.beginPath();ctx.arc(h.pin.x,h.pin.y,5*u,0,TAU);ctx.stroke();
  ctx.font=`${10*u}px system-ui`;ctx.textAlign='center';
  for(const [key,label] of [['pin',locked?'Pin locked':'Move pin'],['radius','Radius'],['rotate','Rotate'],['tip',tip]]){
    const p=h[key],y=p.y+(key==='rotate'?-30:19)*u;
    ctx.lineWidth=3*u;ctx.strokeStyle='#fffffff0';ctx.strokeText(label,p.x,y);ctx.fillStyle='#263f54';ctx.fillText(label,p.x,y);
  }
  ctx.restore();
}
