import {playToolAnimation} from "./tool-animation.mjs";
import {randomUnit} from './random-tools.mjs';
// Photographs of identified real designs; all images are bundled locally.
const mintHalf='https://www.usmint.gov/learn/coins-and-medals/circulating-coins/half-dollar';
const euroSource='https://www.ecb.europa.eu/euro/coins/1euro/html/index.en.html';
export const COIN_SETS={
 'United States':[
  ['50¢','Franklin half dollar · 1963','silver',false,{heads:'franklin-heads',tails:'franklin-tails',detail:'Benjamin Franklin / Liberty Bell and small eagle',source:mintHalf}],
  ['50¢','Kennedy half dollar · 2025','silver',false,{heads:'kennedy-heads',tails:'kennedy-tails',detail:'John F. Kennedy / presidential-seal eagle',source:mintHalf}],
  ['$1','Susan B. Anthony dollar · 1999','silver',false,{heads:'anthony-heads',tails:'anthony-tails',detail:'Susan B. Anthony / Apollo 11 eagle and Moon',source:'https://www.usmint.gov/learn/coins-and-medals/circulating-coins/susan-b-anthony-dollar'}],
  ['10¢','Mercury dime · 1916-D','silver',false,{heads:'mercury-heads',tails:'mercury-tails',detail:'Winged Liberty / fasces and olive branch',source:'https://www.usmint.gov/learn/coins-and-medals/circulating-coins/dime'}]
 ],
 'Euro area':[
  ['€1','Germany · eagle','gold-silver',false,{heads:'euro-germany',tails:'euro-common',detail:'German national eagle / common European value side',source:euroSource}],
  ['€1','Greece · owl','gold-silver',false,{heads:'euro-greece',tails:'euro-common',detail:'Owl inspired by an ancient Athenian coin / common European value side',source:euroSource}],
  ['€1','Ireland · harp','gold-silver',false,{heads:'euro-ireland',tails:'euro-common',detail:'Irish harp / common European value side',source:euroSource}]
 ]
};
const metals={copper:['#dba47c','#a45b35','#efc5a4'],silver:['#dce5ed','#8093a4','#f7fbff'],gold:['#f1d67e','#aa812d','#fff1b5']};
export function coinPalette(style){const [outer,inner]=style.split('-');return {rim:metals[outer],center:metals[inner||outer]};}
export const coinOutcome=(rng=randomUnit)=>rng()<.5?'Heads':'Tails';
export function validateCoins(size,count){if(!Number.isInteger(size)||size<60||size>180||!Number.isInteger(count)||count<1||count>12)throw new Error('Use a size of 60–180 and 1–12 coins.');}
export function coinImagePath(spec,side){return '/coins/'+spec[4][side==='Heads'?'heads':'tails']+'.webp';}
let coinSequence=0;
export function createCoinObject({currency,denomination,pixels}){
 const spec=COIN_SETS[currency]?.[denomination];if(!spec)throw new Error('Unknown coin design.');validateCoins(pixels,1);
 const palette=coinPalette(spec[2]),object=document.createElement('div');object.className='floating-coin-object';object.style.width=object.style.height=pixels+'px';
 object.dataset.sharedKind='coin';object.dataset.sharedConfig=JSON.stringify({currency,denomination,pixels});object.dataset.syncId='coin-'+ ++coinSequence;
   const scene=document.createElement('div');scene.className='coin-perspective';const solid=document.createElement('div');solid.className='coin-solid';scene.append(solid);object.append(scene);
   for(let j=0;j<7;j++){const edge=document.createElement('div');edge.className='coin-thickness';edge.style.background=`radial-gradient(circle at 30% 20%,${palette.rim[2]},${palette.rim[0]} 60%,${palette.rim[1]})`;edge.style.transform=`translateZ(${j-3}px)`;if(spec[3]){edge.style.maskImage=edge.style.webkitMaskImage='radial-gradient(circle closest-side,transparent 0 15%,black 16%)';}solid.append(edge);}
   for(const side of ['Heads','Tails']){
    const face=document.createElement('div');face.className='coin-disc '+(side==='Heads'?'coin-heads':'coin-tails');const image=document.createElement('img');image.src=coinImagePath(spec,side);image.alt=spec[1]+' — '+side;image.draggable=false;face.append(image);solid.append(face);
   }
   solid.style.transform='rotateX(-16deg) rotateY(18deg)';
 return {object,solid,spec};
}
export function setCoinResult(record,side){
 if(!['Heads','Tails'].includes(side))throw new Error('Invalid coin result.');
 record.object.dataset.result=side;record.object.setAttribute('aria-label',record.spec[1]+': '+side);
 return side==='Heads'?'rotateX(0deg)':'rotateX(180deg)';
}
export function createCoinWidget(root,layer,activate){
 const controls=document.createElement('div');controls.className='coin-toolbar actions';controls.hidden=true;
 controls.innerHTML='<strong>Coins</strong><label>Currency <select name="currency"></select></label><label>Design / denomination <select name="denomination"></select></label><label>Size <input name="size" type="range" min="60" max="180" step="10" value="110"></label><label>How many <input name="count" type="number" min="1" max="12" value="1"></label><button class="primary" data-flip>Flip coins</button><button data-heads>Show heads</button><button data-tails>Show tails</button><button data-close>Hide coins</button><small class="coin-design-info"></small><a class="coin-source-link" target="_blank" rel="noopener noreferrer">Coin details / source</a><output aria-live="polite"></output>';
 root.querySelector('.board-tools').append(controls);
 const stage=document.createElement('div');stage.className='coin-object-stage';stage.hidden=true;layer.append(stage);
 const currency=controls.querySelector('[name=currency]'),denomination=controls.querySelector('[name=denomination]'),size=controls.querySelector('[name=size]'),count=controls.querySelector('[name=count]'),output=controls.querySelector('output');
 for(const country of Object.keys(COIN_SETS)){const option=document.createElement('option');option.textContent=option.value=country;currency.append(option);}
 let records=[],busy=false,enabled=true;
 function choices(){denomination.replaceChildren();COIN_SETS[currency.value].forEach((spec,i)=>{const option=document.createElement('option');option.value=i;option.textContent=spec[0]+' · '+spec[1];denomination.append(option);});if(currency.value==='United States')denomination.value='0';}
 function select(){if(!enabled)return;activate();controls.hidden=stage.hidden=false;}
 function rebuild(){
  if(busy)return;
  const pixels=+size.value,n=+count.value;try{validateCoins(pixels,n);}catch(e){output.textContent=e.message;return;}
  records=[];stage.replaceChildren();output.textContent='';
  const spec=COIN_SETS[currency.value][+denomination.value];controls.querySelector(".coin-design-info").textContent=spec[4].detail;controls.querySelector(".coin-source-link").href=spec[4].source;
  const palette=coinPalette(spec[2]),gap=pixels+22,columns=Math.max(1,Math.floor((layer.clientWidth-20)/gap));
  for(let i=0;i<n;i++){
   const record=createCoinObject({currency:currency.value,denomination:+denomination.value,pixels}),{object,solid}=record;
   object.style.left=(12+i%columns*gap)+'px';object.style.top=(105+Math.floor(i/columns)*gap)+'px';object.tabIndex=0;object.setAttribute('role','button');object.setAttribute('aria-label',`${currency.value} ${spec[1]}. Click to flip; drag to move.`);
   for(const image of solid.querySelectorAll('img'))image.onerror=()=>{output.textContent='Coin photographs could not load. Check public/coins.';};
   stage.append(object);records.push(record);
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
   await Promise.all(records.flatMap(record=>[...record.solid.querySelectorAll('img')].map(image=>image.decode())));
   await Promise.all(records.map(async(record,i)=>{
    const previous=record.solid.style.transform,angle=outcomes[i]==='Heads'?0:180,final=setCoinResult(record,outcomes[i]);
    record.solid.style.transform=final;
    const animation=playToolAnimation(record.solid,[{transform:previous},{offset:.3,transform:`translate3d(${i%2?15:-15}px,-85px,35px) rotateX(680deg) rotateY(25deg)`},{offset:.68,transform:`translateY(-32px) rotateX(${1440+angle}deg) rotateY(-15deg)`},{offset:.85,transform:`translateY(-10px) rotateX(${1800+angle}deg)`},{transform:final}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:1550+i*90,easing:'cubic-bezier(.2,.6,.3,1)'});
    await animation.finished;record.object.dataset.result=outcomes[i];record.object.setAttribute('aria-label',`${outcomes[i]}. Click to flip; drag to move.`);
   }));output.textContent=outcomes.join(' · ');
  }catch(error){output.textContent='Coin images or animation could not load. Refresh after uploading all coin image files.';}finally{busy=false;for(const control of controls.querySelectorAll('input,select,button'))control.disabled=false;}
 }
 for(const [selector,side] of [['[data-heads]','Heads'],['[data-tails]','Tails']])controls.querySelector(selector).onclick=()=>{
  if(busy)return;for(const record of records){record.solid.style.transform=setCoinResult(record,side);record.object.setAttribute('aria-label',side+'. Click to flip; drag to move.');}output.textContent=side;
 };
 choices();currency.onchange=()=>{choices();rebuild();};denomination.onchange=count.onchange=rebuild;size.oninput=rebuild;
 controls.querySelector('[data-flip]').onclick=()=>void flip();controls.querySelector('[data-close]').onclick=()=>{controls.hidden=stage.hidden=true;};
 return {open:()=>{select();if(!records.length)rebuild();},hideControls:()=>{controls.hidden=true;},setEnabled:value=>{enabled=value;if(!enabled)controls.hidden=stage.hidden=true;}};
}
