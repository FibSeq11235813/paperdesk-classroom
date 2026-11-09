import {createDieObject,setDieResult} from './dice-3d.mjs?renderer=3';
import {createCoinObject,setCoinResult} from './coin-3d.mjs?renderer=3';
import {playToolAnimation,remainingMotion} from './tool-animation.mjs';
export function captureSharedObjects(root){
 return [...root.querySelectorAll('[data-shared-kind]')].filter(el=>!el.closest('[hidden]')).map(el=>{
  const solid=el.querySelector('.die-solid,.coin-solid');let motion=null;
  try{motion=solid.dataset.toolMotion?JSON.parse(solid.dataset.toolMotion):null;}catch{}
  return {id:el.dataset.syncId,kind:el.dataset.sharedKind,config:JSON.parse(el.dataset.sharedConfig),
   left:el.offsetLeft-(el.parentElement?.scrollLeft||0),top:el.offsetTop-(el.parentElement?.scrollTop||0),
   transform:solid.style.transform,result:el.dataset.result??null,motion};
 });
}
// The teacher and clean screen use these exact same factories. No face markup is copied.
export function createSharedObjectRenderer(scene,{dieFactory=createDieObject,coinFactory=createCoinObject,clock=Date.now}={}){
 const records=new Map();
 function update(states){
  const active=new Set();
  for(const state of states||[]){
   if(!['dice','coin'].includes(state.kind))continue;
   active.add(state.id);const configKey=JSON.stringify([state.kind,state.config]);let record=records.get(state.id);
   if(!record||record.configKey!==configKey){
    record?.animation?.cancel();record?.object.remove();
    record=(state.kind==='dice'?dieFactory:coinFactory)(state.config);record.configKey=configKey;records.set(state.id,record);scene.append(record.object);
    record.object.removeAttribute('tabindex');record.object.removeAttribute('role');
   }
   record.object.style.left=state.left+'px';record.object.style.top=state.top+'px';
   if(state.result!==null&&state.result!==undefined){
    if(state.kind==='dice')setDieResult(record,Number(state.result));else setCoinResult(record,state.result);
   }
   // Authoritative final pose/result are applied even if the window joins after a roll.
   record.solid.style.transform=state.transform;
   const motion=remainingMotion(state.motion,clock());
   if(motion){
    if(record.motionKey!==motion.startedAt){
     record.animation?.cancel();record.motionKey=motion.startedAt;
     record.animation=playToolAnimation(record.solid,motion.frames,motion.options,{startedAt:motion.startedAt,now:clock()});
    }
   }else{
    record.animation?.cancel();record.animation=null;record.motionKey=null;
   }
  }
  for(const [id,record] of records)if(!active.has(id)){record.animation?.cancel();record.object.remove();records.delete(id);}
 }
 return {update};
}
