import {defaultClassTimer,timerSeconds,timerElapsed} from './class-timer-state.mjs';
export function createClassTimer(root,{teacher=false,onCommand=async()=>{}}={}){
 root.classList.add('class-timer');
 root.innerHTML='<strong>Class timer</strong><output aria-label="Class timer remaining time">05:00</output>'+ (teacher?'<select aria-label="Class timer mode"><option>Countdown</option><option>Stopwatch</option></select><label class="class-timer-minutes">Min <input aria-label="Class timer minutes" type="number" min=".1" max="180" step=".1" value="5"></label><button class="class-timer-start">Start</button><button class="class-timer-reset">Reset</button>':'<span>Synced with teacher</span>');
 let timer=defaultClassTimer(),serverBase=Date.now(),localBase=performance.now(),busy=false;
 const now=()=>serverBase+performance.now()-localBase;
 function paint(){
  root.hidden=!timer.visible;
  const seconds=timerSeconds(timer,now());root.querySelector('output').textContent=Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');
  if(teacher){
   const running=timer.startedAt!==null&&(timer.mode!=='Countdown'||timerElapsed(timer,now())<timer.durationMs);
   root.querySelector('.class-timer-start').textContent=running?'Pause':'Start';
   const mode=root.querySelector('select'),input=root.querySelector('input');
   if(document.activeElement!==mode)mode.value=timer.mode;
   if(document.activeElement!==input)input.value=timer.durationMs/60000;
   root.querySelector('label').hidden=timer.mode==='Stopwatch';
  }
 }
 async function command(action,extra={}){
  if(busy)return;busy=true;
  for(const control of root.querySelectorAll('input,select,button'))control.disabled=true;
  try{await onCommand({action,...extra});}finally{busy=false;for(const control of root.querySelectorAll('input,select,button'))control.disabled=false;paint();}
 }
 if(teacher){
  root.querySelector('.class-timer-start').onclick=()=>void command(timer.startedAt!==null&&(timer.mode!=='Countdown'||timerElapsed(timer,now())<timer.durationMs)?'pause':'start');
  root.querySelector('.class-timer-reset').onclick=()=>void command('reset');
  root.querySelector('select').onchange=event=>void command('configure',{mode:event.target.value});
  root.querySelector('input').onchange=event=>void command('configure',{minutes:Number(event.target.value)});
 }
 setInterval(paint,200);paint();
 return {sync(value,serverNow){if(value&&value.revision>=timer.revision){timer={...value};serverBase=serverNow;localBase=performance.now();paint();}},toggle:()=>command(timer.visible?'hide':'show'),reset(){timer=defaultClassTimer();paint();}};
}
