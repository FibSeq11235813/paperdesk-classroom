import {createCoinWidget} from "./coin-3d.mjs?renderer=3";
import {createDiceWidget} from "./dice-3d.mjs?renderer=3";
import {iconButton} from "./ui-icons.mjs";
import {TOOL_CATALOG,WIDGET_TOOLS,defaultToolPolicy} from './tool-policy.mjs';
import {randomUnit,randomNumbers,wheelSectors,weightedPick} from './random-tools.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createFloatingTools(root,{onWidgetSelected=()=>{}}={}){
 root.classList.add('floating-tools-host');
 const layer=document.createElement('div');layer.className='floating-tool-layer';root.append(layer);
 const launch=document.createElement('button');launch.className='widget-launch';launch.textContent='✦ Classroom tools';root.querySelector('.board-footer').append(launch);
 let policy=defaultToolPolicy(),serial=0,activeWidget=null;const windows=new Map(),bars=new Map();
 function activateWidget(key){activeWidget=key;onWidgetSelected();for(const [id,bar] of bars)bar.hidden=id!==key;dice.hideControls();coins.hideControls();}
 const dice=createDiceWidget(root,layer,()=>activateWidget('dice'));
 const coins=createCoinWidget(root,layer,()=>activateWidget('coin'));
 const coinButton=document.createElement('button');coinButton.textContent='Coins';iconButton(coinButton,'coin','Coins');root.querySelector('.tool-rail').append(coinButton);coinButton.onclick=()=>open('coin');
 const diceButton=document.createElement('button');diceButton.textContent='Dice';iconButton(diceButton,'dice','Dice');root.querySelector('.tool-rail').append(diceButton);diceButton.onclick=()=>open('dice');
 function panel(key,title){
  const box=document.createElement('section');box.className='floating-tool';box.dataset.widget=key;box.style.left=(12+serial%4*22)+'px';box.style.top=(12+serial++%4*22)+'px';box.style.zIndex=String(10+serial);
  const header=document.createElement('div');header.className='floating-tool-handle';
  const heading=document.createElement('strong');heading.textContent=title;const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close '+title);close.onclick=()=>{box.hidden=true;};
  header.append(heading,close);const body=document.createElement('div');body.className='floating-tool-body';box.append(header,body);layer.append(box);
  box.addEventListener('pointerdown',()=>{box.style.zIndex=String(10+ ++serial);});
  header.addEventListener('pointerdown',event=>{
   if(event.target.closest('button')||event.button!==0)return;event.preventDefault();header.setPointerCapture(event.pointerId);
   const start={x:event.clientX,y:event.clientY,left:box.offsetLeft,top:box.offsetTop};
   const move=e=>{if(e.pointerId!==event.pointerId)return;box.style.left=Math.max(0,Math.min(layer.clientWidth-box.offsetWidth,start.left+e.clientX-start.x))+'px';box.style.top=Math.max(0,Math.min(layer.clientHeight-40,start.top+e.clientY-start.y))+'px';};
   const end=e=>{if(e.pointerId!==event.pointerId)return;header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',end);header.removeEventListener('pointercancel',end);};
   header.addEventListener('pointermove',move);header.addEventListener('pointerup',end);header.addEventListener('pointercancel',end);
  });
  const record={box,body,heading};windows.set(key,record);return record;
 }
 const menu=panel('menu','Classroom tools');menu.box.hidden=true;
 for(const key of WIDGET_TOOLS){const b=document.createElement('button');b.textContent=TOOL_CATALOG[key];b.dataset.tool=key;if(key==='dice')iconButton(b,'dice','Dice');if(key==='coin')iconButton(b,'coin','Coins');b.onclick=()=>open(key);menu.body.append(b);}
 launch.onclick=()=>{menu.box.hidden=!menu.box.hidden;};
 
 function open(key){
  if(!policy[key])return;
  menu.box.hidden=true;
  if(key==='dice'){dice.open();return;}
  if(key==='coin'){coins.open();return;}
  activateWidget(key);
  if(windows.has(key)){windows.get(key).box.hidden=false;return;}
  const bar=document.createElement('div');bar.className='widget-settings-toolbar actions';bars.set(key,bar);root.querySelector('.board-tools').append(bar);
  const widget=panel(key,TOOL_CATALOG[key]),body=widget.body;
  const forms={random:'<label>Minimum <input name="min" type="number" value="1"></label><label>Maximum <input name="max" type="number" value="100"></label><label>How many <input name="count" type="number" min="1" max="100" value="1"></label><label>Type <select name="type"><option value="integer">Integers</option><option value="even">Even integers</option><option value="odd">Odd integers</option><option value="prime">Primes</option><option value="decimal">Decimals (2 places)</option></select></label><label><input name="unique" type="checkbox"> No repeats</label><div class="widget-result"></div><button data-run>Generate</button>',
   spinner:'<label>Sectors <input name="count" type="number" min="2" max="40" value="6"></label><label><input name="weighted" type="checkbox"> Custom weights</label><label>Labels (optional, one per line)<textarea name="labels" placeholder="Red:2&#10;Blue:1&#10;Green:1"></textarea></label><small>Blank labels use numbered sectors. With custom weights, Label:2 is twice as likely as Label:1.</small><div class="wheel-wrap"><div class="spinner-wheel"></div><span class="wheel-pointer">▼</span></div><div class="wheel-key"></div><div class="widget-result"></div><button data-preview>Update wheel</button><button data-run>Spin</button>',
   names:'<label>Names or prompts (one per line)<textarea name="names" placeholder="Alex&#10;Sam&#10;Jordan"></textarea></label><label><input name="remove" type="checkbox"> Remove after picking</label><div class="widget-result"></div><button data-run>Pick one</button>',
   counter:'<div class="widget-result">0</div><button data-minus>−</button><button data-run>+1</button><button data-reset>Reset</button>'};
  body.innerHTML=forms[key];const error=document.createElement('p');error.className='widget-error';error.setAttribute('role','status');body.append(error);
  const result=body.querySelector('.widget-result');result.setAttribute('aria-live','polite');const value=name=>body.querySelector(`[name="${name}"]`)||bar.querySelector(`[name="${name}"]`),run=body.querySelector('[data-run]');let total=0,rotation=0;
  const colors=['#5c67dc','#e9557c','#efab3c','#20a88e','#378dc5','#955cc9','#df743d','#4b9d49'];
  function drawWheel(){
   const sectors=wheelSectors(+value('count').value,value('labels').value,value('weighted').checked),sum=sectors.reduce((n,s)=>n+s.weight,0);let at=0;
   body.querySelector('.spinner-wheel').style.background='conic-gradient('+sectors.map((s,i)=>{const start=at;at+=s.weight/sum*360;return `${colors[i%colors.length]} ${start}deg ${at}deg`;}).join(',')+')';
   body.querySelector('.wheel-key').innerHTML=sectors.map((s,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${escape(s.label)} (${(s.weight/sum*100).toFixed(1)}%)</span>`).join('');return sectors;
  }
  if(key==='spinner'){
   body.querySelector('[data-preview]').onclick=()=>{try{error.textContent='';drawWheel();}catch(e){error.textContent=e.message;}};drawWheel();
  }
  if(key==='counter'){body.querySelector('[data-minus]').onclick=()=>result.textContent=--total;body.querySelector('[data-reset]').onclick=()=>result.textContent=total=0;}
  run.onclick=()=>{
   error.textContent='';try{
    result.classList.remove('widget-animate');void result.offsetWidth;
    if(key==='random')result.textContent=randomNumbers({min:+value('min').value,max:+value('max').value,count:+value('count').value,type:value('type').value,unique:value('unique').checked}).join(', ');
    if(key==='names'){
     const names=value('names').value.split('\n').map(n=>n.trim()).filter(Boolean);if(!names.length)throw new Error('Enter at least one name or prompt.');
     const index=Math.floor(randomUnit()*names.length);result.textContent=names[index];if(value('remove').checked){names.splice(index,1);value('names').value=names.join('\n');}
    }
    if(key==='counter')result.textContent=++total;
    if(key==='spinner'){
     const pick=weightedPick(drawWheel()),wheel=body.querySelector('.spinner-wheel');rotation+=360*5+((360-pick.angle-rotation%360)+360)%360;
     wheel.style.transform=`rotate(${rotation}deg)`;for(const control of [...body.querySelectorAll('button,input,textarea'),...bar.querySelectorAll('button,input,textarea')])control.disabled=true;result.textContent='Spinning…';
     setTimeout(()=>{result.textContent=pick.label;for(const control of [...body.querySelectorAll('button,input,textarea'),...bar.querySelectorAll('button,input,textarea')])control.disabled=false;},2300);
    }
   }catch(e){error.textContent=e.message;}
  };
  for(const child of [...body.children])if(child.matches('label,button,small,.widget-error'))bar.append(child);
 }
 return {activateDrawing:()=>{activeWidget=null;dice.hideControls();coins.hideControls();for(const bar of bars.values())bar.hidden=true;},
  setPolicy:next=>{policy={...defaultToolPolicy(),...next};dice.setEnabled(policy.dice);diceButton.hidden=!policy.dice;coins.setEnabled(policy.coin);coinButton.hidden=!policy.coin;for(const key of WIDGET_TOOLS){menu.body.querySelector(`[data-tool="${key}"]`).hidden=!policy[key];if(!policy[key]&&windows.has(key))windows.get(key).box.hidden=true;if(!policy[key]&&bars.has(key))bars.get(key).hidden=true;}launch.hidden=WIDGET_TOOLS.every(key=>!policy[key]);},
  hideInspector:()=>{dice.hideControls();coins.hideControls();for(const bar of bars.values())bar.hidden=true;},open};
}
