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
  const h=compassHandles(center,radius,angle,scale),size=9/scale;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#52738d55';ctx.lineWidth=1/scale;ctx.setLineDash([4/scale,5/scale]);ctx.beginPath();ctx.arc(center.x,center.y,radius,0,TAU);ctx.stroke();ctx.setLineDash([]);
  // Two metal legs join at the rotation hinge; the right leg holds the ink tip.
  ctx.strokeStyle='#263b50';ctx.lineWidth=7/scale;ctx.beginPath();ctx.moveTo(h.pin.x,h.pin.y);ctx.lineTo(h.rotate.x,h.rotate.y);ctx.lineTo(h.tip.x,h.tip.y);ctx.stroke();
  ctx.strokeStyle='#b8c9d8';ctx.lineWidth=3/scale;ctx.stroke();
  ctx.strokeStyle='#6c8399';ctx.lineWidth=2/scale;ctx.beginPath();ctx.moveTo(center.x,center.y);ctx.lineTo(h.tip.x,h.tip.y);ctx.stroke();
  ctx.font=`${11/scale}px system-ui`;ctx.textAlign='center';
  for(const key of ['pin','radius','rotate','tip']){
    const p=h[key];ctx.fillStyle=key==='tip'?color:key==='pin'&&locked?'#c24145':key==='radius'?'#13846d':'#2874b8';
    ctx.beginPath();ctx.arc(p.x,p.y,size,0,TAU);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2/scale;ctx.stroke();
    const label=key==='pin'?(locked?'Pin locked':'Move pin'):key==='radius'?'Radius':key==='rotate'?'Rotate':tip;
    const y=p.y-15/scale;ctx.lineWidth=3/scale;ctx.strokeStyle='#ffffffee';ctx.strokeText(label,p.x,y);ctx.fillStyle='#20374c';ctx.fillText(label,p.x,y);
  }
  ctx.restore();
}
