export function annotationKeys(fileKey,storage=localStorage){
 const prefix='paperdesk.teacher.'+fileKey+'.',keys=[];
 for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix)&&/^\d+$/.test(key.slice(prefix.length)))keys.push(key);}
 return keys;
}
export function savedPageCount(fileKey,storage=localStorage){
 try{return annotationKeys(fileKey,storage).filter(key=>{try{return JSON.parse(storage.getItem(key))?.marks?.length>0;}catch{return false;}}).length;}catch{return 0;}
}
export function clearPDFAnnotations(fileKey,storage=localStorage){for(const key of annotationKeys(fileKey,storage))storage.removeItem(key);}
export function choosePDFMemory(count){return new Promise(resolve=>{
 const dialog=document.createElement('dialog');dialog.className='pdf-memory-dialog';
 dialog.innerHTML='<h2>Resume this PDF?</h2><p></p><div class="actions"><button data-choice="resume" class="primary">Resume annotations</button><button data-choice="fresh">Start fresh</button><button data-choice="cancel">Cancel</button></div>';
 dialog.querySelector('p').textContent=`This browser has saved annotations on ${count} page${count===1?'':'s'}. Start fresh clears those annotations for this PDF; your saved clean-screen frame stays.`;
 let done=false;const finish=choice=>{if(done)return;done=true;dialog.close();dialog.remove();resolve(choice);};
 for(const b of dialog.querySelectorAll('button'))b.onclick=()=>finish(b.dataset.choice);
 dialog.oncancel=event=>{event.preventDefault();finish('cancel');};document.body.append(dialog);dialog.showModal();
});}
