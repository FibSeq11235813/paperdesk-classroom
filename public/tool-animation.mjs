// One animation description drives both the teacher object and its clean-screen copy.
export function remainingMotion(motion,now=Date.now()){
 if(!motion||!Array.isArray(motion.frames)||!Number.isFinite(motion.startedAt)||!Number.isFinite(motion.options?.duration))return null;
 const elapsed=Math.max(0,now-motion.startedAt);
 return elapsed<motion.options.duration?{...motion,elapsed}:null;
}
export function playToolAnimation(element,frames,options,{startedAt=Date.now(),now=Date.now()}={}){
 const motion={frames,options,startedAt};
 element.dataset.toolMotion=JSON.stringify(motion);
 const animation=element.animate(frames,options);
 animation.currentTime=Math.max(0,now-startedAt);
 animation.finished.finally(()=>{if(element.dataset.toolMotion===JSON.stringify(motion))delete element.dataset.toolMotion;}).catch(()=>{});
 return animation;
}
