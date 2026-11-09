import {diceRoll} from './random-tools.mjs';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
export function dieGeometry(sides){
 const phi=(1+Math.sqrt(5))/2;let vertices=[];
 if(sides===4)vertices=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
 else if(sides===8)vertices=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 else if(sides===12){
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
  for(const a of [-1,1])for(const b of [-1,1])vertices.push([0,a/phi,b*phi],[a/phi,b*phi,0],[b*phi,0,a/phi]);
 }else if(sides===20){for(const a of [-1,1])for(const b of [-1,1])vertices.push([0,a,b*phi],[a,b*phi,0],[b*phi,0,a]);}
 else if(sides===10){vertices=[[0,0,1.35],[0,0,-1.35]];for(let i=0;i<5;i++)vertices.push([Math.cos(i*Math.PI*2/5),Math.sin(i*Math.PI*2/5),0]);}
 else for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
 const max=Math.max(...vertices.map(v=>Math.hypot(...v)));vertices=vertices.map(v=>v.map(n=>n/max*58));
 const found=new Map();
 for(let a=0;a<vertices.length;a++)for(let b=a+1;b<vertices.length;b++)for(let c=b+1;c<vertices.length;c++){
  let normal=cross(sub(vertices[b],vertices[a]),sub(vertices[c],vertices[a]));if(Math.hypot(...normal)<1e-6)continue;normal=unit(normal);
  let distances=vertices.map(v=>dot(normal,sub(v,vertices[a])));
  if(distances.some(d=>d>1e-5)&&distances.some(d=>d< -1e-5))continue;
  if(dot(normal,vertices[a])<0)normal=normal.map(n=>-n);
  const ids=vertices.map((v,i)=>Math.abs(dot(normal,sub(v,vertices[a])))<1e-5?i:-1).filter(i=>i>=0),key=ids.join(',');if(found.has(key))continue;
  const center=[0,1,2].map(axis=>ids.reduce((s,i)=>s+vertices[i][axis],0)/ids.length),u=unit(sub(vertices[ids[0]],center)),v=cross(normal,u);
  const points=ids.map(i=>{const p=sub(vertices[i],center);return [dot(p,u),dot(p,v)];}).sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
  found.set(key,{normal,center,u,v,points});
 }
 return [...found.values()];
}
export function faceRotation(normal,u,v){
 if(u&&v)return `matrix3d(${[u[0],v[0],normal[0],0,u[1],v[1],normal[1],0,u[2],v[2],normal[2],0,0,0,0,1].join(',')})`;
 const angle=Math.acos(Math.max(-1,Math.min(1,normal[2])))*180/Math.PI;
 const axis=[normal[1],-normal[0],0];if(Math.hypot(...axis)<1e-8)return normal[2]>=0?'rotateX(0deg)':'rotateX(180deg)';
 return `rotate3d(${axis.join(',')},${angle}deg)`;
}
export function createDiceWidget(root,layer,activate){
 const controls=document.createElement('div');controls.className='dice-toolbar actions';controls.hidden=true;
 controls.innerHTML='<strong>Dice</strong><label>Type <select name="type"><option value="6">d6 · Cube</option><option value="4">d4 · Tetrahedron</option><option value="8">d8 · Octahedron</option><option value="10">d10</option><option value="12">d12 · Dodecahedron</option><option value="20">d20 · Icosahedron</option><option value="100">d100 · Percentile</option><option value="custom">Custom faces</option></select></label><label class="custom-faces" hidden>Faces <input name="faces" type="number" min="2" max="1000" value="6"></label><label>How many <input name="count" type="number" min="1" max="20" value="1"></label><button class="primary" data-roll>Roll dice</button><button data-close>Hide dice</button><output aria-live="polite"></output>';
 root.querySelector('.board-tools').append(controls);
 const stage=document.createElement('div');stage.className='dice-object-stage';stage.hidden=true;layer.append(stage);
 const type=controls.querySelector('[name=type]'),count=controls.querySelector('[name=count]'),custom=controls.querySelector('[name=faces]'),roll=controls.querySelector('[data-roll]'),output=controls.querySelector('output');
 let solids=[],faces=6,busy=false,enabled=true,generation=0;
 function select(){if(!enabled)return;activate();controls.hidden=false;stage.hidden=false;}
 function rebuild(){
  const next=type.value==='custom'?+custom.value:+type.value,n=+count.value;
  controls.querySelector('.custom-faces').hidden=type.value!=='custom';
  try{diceRoll(next,n,()=>0);}catch(e){output.textContent=e.message;return;}
  generation++;faces=next;solids=[];stage.replaceChildren();output.textContent='';
  const model=dieGeometry(faces>=20?20:faces);
  for(let i=0;i<n;i++){
   const object=document.createElement('div');object.className='floating-die-object';const columns=Math.max(1,Math.floor((layer.clientWidth-20)/112));object.style.left=(12+i%columns*112)+'px';object.style.top=(100+Math.floor(i/columns)*135)+'px';object.tabIndex=0;object.setAttribute('role','button');object.setAttribute('aria-label',`Die ${i+1}: d${faces}. Click to roll; drag to move.`);
   const scene=document.createElement('div');scene.className='die-perspective';const solid=document.createElement('div');solid.className='die-solid';scene.append(solid);object.append(scene);
   model.forEach((face,j)=>{
    const surface=document.createElement('div');surface.className='die-surface';
    const matrix=[...face.u,0,...face.v,0,...face.normal,0,...face.center,1];surface.style.transform=`matrix3d(${matrix.join(',')})`;
    const number=j%faces+1;
    const pips={1:[[0,0]],2:[[-15,-15],[15,15]],3:[[-15,-15],[0,0],[15,15]],4:[[-15,-15],[15,-15],[-15,15],[15,15]],5:[[-15,-15],[15,-15],[0,0],[-15,15],[15,15]],6:[[-15,-15],[15,-15],[-15,0],[15,0],[-15,15],[15,15]]};
    surface.innerHTML=`<svg viewBox="-64 -64 128 128" aria-hidden="true"><polygon points="${face.points.map(p=>p.join(',')).join(' ')}" fill="hsl(${218+i*23} 62% ${43+j%3*5}%)" stroke="#d7e7ff" stroke-width="1.5"/>${faces===6?pips[number].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="white"/>`).join(''):`<text x="0" y="6" text-anchor="middle" fill="white" font-size="20" font-family="system-ui" font-weight="700">${number}</text>`}</svg>`;
    solid.append(surface);
   });
   solid.style.transform='rotateX(-22deg) rotateY(28deg)';
   const record={object,solid,model};solids.push(record);stage.append(object);
   let dragged=false;
   object.onpointerdown=e=>{
    if(e.button!==0||busy)return;select();e.preventDefault();object.setPointerCapture(e.pointerId);dragged=false;
    const start={x:e.clientX,y:e.clientY,left:object.offsetLeft,top:object.offsetTop};
    object.onpointermove=move=>{if(move.pointerId!==e.pointerId)return;const dx=move.clientX-start.x,dy=move.clientY-start.y;if(Math.hypot(dx,dy)>5)dragged=true;
     if(dragged){object.style.left=Math.max(0,Math.min(layer.clientWidth-90,start.left+dx))+'px';object.style.top=Math.max(50,Math.min(layer.clientHeight-100,start.top+dy))+'px';}
    };
    object.onpointerup=up=>{if(up.pointerId!==e.pointerId)return;object.onpointermove=null;object.onpointerup=null;if(!dragged)void rollDice();};
    object.onpointercancel=()=>{object.onpointermove=null;object.onpointerup=null;};
   };
   object.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();void rollDice();}};
  }
 }
 async function rollDice(){
  if(busy||!enabled)return;busy=true;const version=generation,values=diceRoll(faces,solids.length);
  for(const c of controls.querySelectorAll('input,select,button'))c.disabled=true;
  output.textContent='Rolling…';
  try{
   await Promise.all(solids.map(async(record,i)=>{
    const index=(values[i]-1)%record.model.length,normal=record.model[index].normal;
    // Custom/percentile dice use the faceted model with the exact rolled value on the landing face.
    const text=record.solid.children[index].querySelector('text');if(text)text.textContent=values[i];
    const previous=record.solid.style.transform,final=faceRotation(normal,record.model[index].u,record.model[index].v);record.solid.style.transform=final;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation=record.solid.animate([
     {transform:previous},
     {offset:.28,transform:`translate3d(${i%2?24:-24}px,-65px,15px) rotateX(420deg) rotateY(560deg) rotateZ(120deg)`},
     {offset:.66,transform:'translate3d(10px,-24px,0) rotateX(780deg) rotateY(1000deg) rotateZ(260deg)'},
     {offset:.84,transform:`translateY(-12px) ${final}`},
     {transform:final}
    ],{duration:reduced?0:1450+i*75,easing:'cubic-bezier(.25,.65,.35,1)'});
    await animation.finished;record.object.setAttribute('aria-label',`Die ${i+1}: ${values[i]} on d${faces}. Click to roll; drag to move.`);
   }));
   if(version===generation)output.textContent=values.join(' + ')+(values.length>1?' = '+values.reduce((a,b)=>a+b,0):'');
  }finally{busy=false;for(const c of controls.querySelectorAll('input,select,button'))c.disabled=false;}
 }
 type.onchange=count.onchange=custom.onchange=()=>{if(!busy)rebuild();};roll.onclick=()=>void rollDice();
 controls.querySelector('[data-close]').onclick=()=>{stage.hidden=controls.hidden=true;};
 return {open:()=>{select();if(!solids.length)rebuild();},hideControls:()=>{controls.hidden=true;},setEnabled:value=>{enabled=value;if(!enabled)stage.hidden=controls.hidden=true;}};
}
