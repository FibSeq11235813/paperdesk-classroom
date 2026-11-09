import {randomUnit} from './random-tools.mjs';
// Stylized classroom illustrations, not reproductions of mint artwork.
export const COIN_SETS={
 'United States':[['1¢','Penny','copper'],['5¢','Nickel','silver'],['10¢','Dime','silver'],['25¢','Quarter','silver'],['50¢','Half dollar','silver'],['$1','Dollar','gold']],
 'United Kingdom':[['1p','Penny','copper'],['50p','Fifty pence','silver'],['£1','One pound','gold-silver'],['£2','Two pounds','gold-silver']],
 'Euro area':[['5c','Five cents','copper'],['50c','Fifty cents','gold'],['€1','One euro','gold-silver'],['€2','Two euros','silver-gold']],
 'Canada':[['5¢','Nickel','silver'],['$1','Loonie','gold'],['$2','Toonie','silver-gold']],
 'Japan':[['¥5','Five yen','gold',true],['¥50','Fifty yen','silver',true],['¥100','One hundred yen','silver'],['¥500','Five hundred yen','silver-gold']],
 'Mexico':[['$1','One peso','silver-gold'],['$10','Ten pesos','silver-gold']],
 'India':[['₹5','Five rupees','gold'],['₹10','Ten rupees','silver-gold']],
 'Australia':[['50c','Fifty cents','silver'],['$1','One dollar','gold'],['$2','Two dollars','gold']]
};
const metals={copper:['#dba47c','#a45b35','#efc5a4'],silver:['#dce5ed','#8093a4','#f7fbff'],gold:['#f1d67e','#aa812d','#fff1b5']};
export function coinPalette(style){const [outer,inner]=style.split('-');return {rim:metals[outer],center:metals[inner||outer]};}
export const coinOutcome=(rng=randomUnit)=>rng()<.5?'Heads':'Tails';
export function validateCoins(size,count){if(!Number.isInteger(size)||size<60||size>180||!Number.isInteger(count)||count<1||count>12)throw new Error('Use a size of 60–180 and 1–12 coins.');}
const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let sequence=0;
function coinFace(spec,country,side,id){
 const [value,name,style,hole]=spec,{rim,center}=coinPalette(style);
 return `<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="${id}-rim" cx="30%" cy="20%"><stop stop-color="${rim[2]}"/><stop offset=".6" stop-color="${rim[0]}"/><stop offset="1" stop-color="${rim[1]}"/></radialGradient><radialGradient id="${id}-metal" cx="32%" cy="20%"><stop stop-color="${center[2]}"/><stop offset=".65" stop-color="${center[0]}"/><stop offset="1" stop-color="${center[1]}"/></radialGradient><path id="${id}-arc" d="M17 65 A43 43 0 1 1 103 65"/><mask id="${id}-hole"><rect width="120" height="120" fill="white"/>${hole?'<circle cx="60" cy="60" r="9" fill="black"/>':''}</mask></defs><g mask="url(#${id}-hole)"><circle cx="60" cy="60" r="58" fill="url(#${id}-rim)" stroke="${rim[1]}" stroke-width="2"/><circle cx="60" cy="60" r="47" fill="url(#${id}-metal)" stroke="${rim[1]}" stroke-width="1"/><circle cx="60" cy="60" r="54" fill="none" stroke="${rim[2]}" stroke-width="1.5" stroke-dasharray="1 3"/><text font-family="system-ui" font-size="8" font-weight="700" fill="${rim[1]}" letter-spacing="1"><textPath href="#${id}-arc" startOffset="50%" text-anchor="middle">${safe(country.toUpperCase())}</textPath></text>${side==='Heads'?`<path d="M38 82 Q31 63 40 47 Q41 36 51 32 M82 82 Q89 63 80 47 Q79 36 69 32" fill="none" stroke="${center[1]}" stroke-width="2"/><path d="M39 72l-6-5m6-5-6-5m9-4-5-7m7 1-2-8m38 33 6-5m-6-5 6-5m-9-4 5-7m-7 1 2-8" fill="none" stroke="${center[1]}" stroke-width="2"/>`:''}<text x="60" y="${hole?43:64}" text-anchor="middle" fill="${center[2]}" stroke="${center[2]}" stroke-width=".6" font-size="${hole?20:27}" font-family="Georgia,serif" font-weight="700">${safe(value)}</text><text x="60" y="${hole?42:63}" text-anchor="middle" fill="${center[1]}" font-size="${hole?20:27}" font-family="Georgia,serif" font-weight="700">${safe(value)}</text><text x="60" y="${hole?85:81}" text-anchor="middle" fill="${center[1]}" font-size="9" font-family="system-ui" font-weight="700" letter-spacing="2">${side.toUpperCase()}</text><text x="60" y="101" text-anchor="middle" fill="${rim[1]}" font-size="6" font-family="system-ui">${safe(name.toUpperCase())}</text><path d="M55 23h10 M60 18v10" stroke="${center[1]}" stroke-width="1"/></g></svg>`;
}
export function createCoinWidget(root,layer,activate){
 const controls=document.createElement('div');controls.className='coin-toolbar actions';controls.hidden=true;
 controls.innerHTML='<strong>Coins</strong><label>Currency <select name="currency"></select></label><label>Denomination <select name="denomination"></select></label><label>Size <input name="size" type="range" min="60" max="180" step="10" value="110"></label><label>How many <input name="count" type="number" min="1" max="12" value="1"></label><button class="primary" data-flip>Flip coins</button><button data-close>Hide coins</button><output aria-live="polite"></output>';
 root.querySelector('.board-tools').append(controls);
 const stage=document.createElement('div');stage.className='coin-object-stage';stage.hidden=true;layer.append(stage);
 const currency=controls.querySelector('[name=currency]'),denomination=controls.querySelector('[name=denomination]'),size=controls.querySelector('[name=size]'),count=controls.querySelector('[name=count]'),output=controls.querySelector('output');
 for(const country of Object.keys(COIN_SETS)){const option=document.createElement('option');option.textContent=option.value=country;currency.append(option);}
 let records=[],busy=false,enabled=true;
 function choices(){denomination.replaceChildren();COIN_SETS[currency.value].forEach((spec,i)=>{const option=document.createElement('option');option.value=i;option.textContent=spec[0]+' · '+spec[1];denomination.append(option);});if(currency.value==='United States')denomination.value='3';}
 function select(){if(!enabled)return;activate();controls.hidden=stage.hidden=false;}
 function rebuild(){
  if(busy)return;
  const pixels=+size.value,n=+count.value;try{validateCoins(pixels,n);}catch(e){output.textContent=e.message;return;}
  records=[];stage.replaceChildren();output.textContent='';
  const spec=COIN_SETS[currency.value][+denomination.value],palette=coinPalette(spec[2]),gap=pixels+22,columns=Math.max(1,Math.floor((layer.clientWidth-20)/gap));
  for(let i=0;i<n;i++){
   const object=document.createElement('div');object.className='floating-coin-object';object.style.width=object.style.height=pixels+'px';object.style.left=(12+i%columns*gap)+'px';object.style.top=(105+Math.floor(i/columns)*gap)+'px';object.tabIndex=0;object.setAttribute('role','button');object.setAttribute('aria-label',`${currency.value} ${spec[1]}. Click to flip; drag to move.`);
   const scene=document.createElement('div');scene.className='coin-perspective';const solid=document.createElement('div');solid.className='coin-solid';scene.append(solid);object.append(scene);
   for(let j=0;j<7;j++){const edge=document.createElement('div');edge.className='coin-thickness';edge.style.background=`radial-gradient(circle at 30% 20%,${palette.rim[2]},${palette.rim[0]} 60%,${palette.rim[1]})`;edge.style.transform=`translateZ(${j-3}px)`;if(spec[3]){edge.style.maskImage=edge.style.webkitMaskImage='radial-gradient(circle closest-side,transparent 0 15%,black 16%)';}solid.append(edge);}
   for(const side of ['Heads','Tails']){
    const face=document.createElement('div');face.className='coin-disc '+(side==='Heads'?'coin-heads':'coin-tails');face.innerHTML=coinFace(spec,currency.value,side,'classcoin-'+ ++sequence);solid.append(face);
   }
   solid.style.transform='rotateX(-16deg) rotateY(18deg)';stage.append(object);records.push({object,solid});
   object.onpointerdown=e=>{
    if(e.button!==0||busy)return;select();e.preventDefault();object.setPointerCapture(e.pointerId);
    let moved=false;const start={x:e.clientX,y:e.clientY,left:object.offsetLeft,top:object.offsetTop};
    object.onpointermove=move=>{if(move.pointerId!==e.pointerId)return;const dx=move.clientX-start.x,dy=move.clientY-start.y;if(Math.hypot(dx,dy)>5)moved=true;if(moved){object.style.left=Math.max(0,Math.min(layer.clientWidth-pixels,start.left+dx))+'px';object.style.top=Math.max(50,Math.min(layer.clientHeight-pixels,start.top+dy))+'px';}};
    object.onpointerup=up=>{if(up.pointerId!==e.pointerId)return;object.onpointermove=object.onpointerup=null;if(!moved)void flip();};
    object.onpointercancel=()=>{object.onpointermove=object.onpointerup=null;};
   };
   object.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();void flip();}};
  }
 }
 async function flip(){
  if(busy||!enabled||!records.length)return;busy=true;
  const outcomes=records.map(()=>coinOutcome());for(const control of controls.querySelectorAll('input,select,button'))control.disabled=true;output.textContent='Flipping…';
  try{
   await Promise.all(records.map(async(record,i)=>{
    const previous=record.solid.style.transform,angle=outcomes[i]==='Heads'?0:180,final=`rotateX(${angle}deg)`;
    record.solid.style.transform=final;
    const animation=record.solid.animate([{transform:previous},{offset:.3,transform:`translate3d(${i%2?15:-15}px,-85px,35px) rotateX(680deg) rotateY(25deg)`},{offset:.68,transform:`translateY(-32px) rotateX(${1440+angle}deg) rotateY(-15deg)`},{offset:.85,transform:`translateY(-10px) rotateX(${1800+angle}deg)`},{transform:final}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1550+i*90,easing:'cubic-bezier(.2,.6,.3,1)'});
    await animation.finished;record.object.setAttribute('aria-label',`${outcomes[i]}. Click to flip; drag to move.`);
   }));output.textContent=outcomes.join(' · ');
  }finally{busy=false;for(const control of controls.querySelectorAll('input,select,button'))control.disabled=false;}
 }
 choices();currency.onchange=()=>{choices();rebuild();};denomination.onchange=count.onchange=rebuild;size.oninput=rebuild;
 controls.querySelector('[data-flip]').onclick=()=>void flip();controls.querySelector('[data-close]').onclick=()=>{controls.hidden=stage.hidden=true;};
 return {open:()=>{select();if(!records.length)rebuild();},hideControls:()=>{controls.hidden=true;},setEnabled:value=>{enabled=value;if(!enabled)controls.hidden=stage.hidden=true;}};
}
