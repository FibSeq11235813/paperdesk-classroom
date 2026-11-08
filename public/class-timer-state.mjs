export const defaultClassTimer=()=>({visible:false,mode:'Countdown',durationMs:300000,elapsedMs:0,startedAt:null,revision:0});
export function timerElapsed(timer,now){
 const elapsed=timer.elapsedMs+(timer.startedAt===null?0:Math.max(0,now-timer.startedAt));
 return timer.mode==='Countdown'?Math.min(timer.durationMs,elapsed):elapsed;
}
export function timerSeconds(timer,now){
 const elapsed=timerElapsed(timer,now);
 return timer.mode==='Countdown'?Math.max(0,Math.ceil((timer.durationMs-elapsed)/1000)):Math.floor(elapsed/1000);
}
export function updateClassTimer(previous,command,now){
 const timer={...previous,revision:previous.revision+1};
 switch(command.action){
 case 'show':timer.visible=true;break;
 case 'hide':timer.visible=false;break;
 case 'start':
  timer.elapsedMs=timerElapsed(timer,now);
  if(timer.mode==='Countdown'&&timer.elapsedMs>=timer.durationMs)timer.elapsedMs=0;
  timer.startedAt=now;timer.visible=true;break;
 case 'pause':timer.elapsedMs=timerElapsed(timer,now);timer.startedAt=null;break;
 case 'reset':timer.elapsedMs=0;timer.startedAt=null;break;
 case 'configure':
  if(command.mode!==undefined){if(!['Countdown','Stopwatch'].includes(command.mode))throw new Error('Invalid timer mode.');timer.mode=command.mode;}
  if(command.minutes!==undefined){if(!Number.isFinite(command.minutes)||command.minutes<.1||command.minutes>180)throw new Error('Choose between 0.1 and 180 minutes.');timer.durationMs=Math.round(command.minutes*60000);}
  timer.elapsedMs=0;timer.startedAt=null;break;
 default:throw new Error('Unknown timer action.');
 }
 return timer;
}
