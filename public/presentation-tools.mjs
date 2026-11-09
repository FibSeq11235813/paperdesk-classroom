const HTML_TAGS=new Set(['div','section','span','strong','small','p','output','i']);
const SVG_TAGS=new Set(['svg','g','path','circle','ellipse','rect','polygon','line','text','textPath','defs','linearGradient','radialGradient','stop','mask']);
const ATTRS=new Set(['class','style','viewBox','d','cx','cy','r','rx','ry','x','y','x1','x2','y1','y2','width','height','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','points','transform','id','offset','stop-color','stop-opacity','opacity','mask','font-family','font-size','font-weight','letter-spacing','text-anchor','startOffset','color']);
export function safeMirrorAttribute(name,value){return ATTRS.has(name)||name==='href'&&value.startsWith('#');}
export function mirrorScale(sourceWidth,sourceHeight,width,height){return Math.min(width/Math.max(1,sourceWidth),height/Math.max(1,sourceHeight));}
function encode(node){
 if(node.nodeType===3)return {text:node.textContent};
 if(node.nodeType!==1||node.hidden||(!HTML_TAGS.has(node.localName)&&!SVG_TAGS.has(node.localName)))return null;
 const attrs={};for(const a of node.attributes)if(safeMirrorAttribute(a.name,a.value))attrs[a.name]=a.value;
 const animations=(node.getAnimations?.()||[]).filter(a=>a.playState==='running'&&a.effect?.target===node).map(a=>{
  const t=a.effect.getTiming();return {frames:a.effect.getKeyframes().map(f=>Object.fromEntries(Object.entries(f).filter(([key])=>['transform','opacity','offset','easing'].includes(key)))),duration:Number(t.duration)||0,delay:t.delay||0,easing:t.easing,iterations:Number.isFinite(t.iterations)?t.iterations:1,time:Number(a.currentTime)||0};
 })||[];
 return {tag:node.localName,svg:node.namespaceURI==='http://www.w3.org/2000/svg',attrs,scroll:[node.scrollLeft,node.scrollTop],animations,children:[...node.childNodes].map(encode).filter(Boolean)};
}
export function capturePresentationTools(root,guide=null){
 const layer=root.querySelector('.floating-tool-layer');
 const children=layer?[...layer.children].filter(el=>!['menu','inspector'].includes(el.dataset.widget)).map(encode).filter(Boolean):[];
 return {type:'tools',width:root.clientWidth,height:root.clientHeight,capturedAt:Date.now(),children,guide};
}
export function watchPresentationTools(root,send,guide){
 let timer=null;const update=()=>{if(timer!==null)return;timer=setTimeout(()=>{timer=null;send(capturePresentationTools(root,guide()));},50);};
 const layer=root.querySelector('.floating-tool-layer');
 if(layer)new MutationObserver(update).observe(layer,{subtree:true,childList:true,attributes:true,characterData:true});
 for(const event of ['pointerdown','pointerup','mousedown','mouseup','input','change','animationstart','animationend','transitionrun','transitionend'])root.addEventListener(event,update,true);
 layer?.addEventListener('scroll',update,true);new ResizeObserver(update).observe(root);
 return update;
}
export function createPresentationTools(host,onGuide){
 host.classList.add('presentation-tool-mirror');let latest=null;
 function draw(data){
  latest=data;const scene=document.createElement('div');scene.className='tool-mirror-scene';scene.style.width=data.width+'px';scene.style.height=data.height+'px';
  const scale=mirrorScale(data.width,data.height,host.clientWidth,host.clientHeight);scene.style.transform=`scale(${scale})`;scene.style.left=(host.clientWidth-data.width*scale)/2+'px';scene.style.top=(host.clientHeight-data.height*scale)/2+'px';
  const scrolls=[],plays=[];let remaining=20000;
  const decode=tree=>{
   if(--remaining<0)return document.createTextNode('');
   if(tree.text!==undefined)return document.createTextNode(String(tree.text));
   if(!(tree.svg?SVG_TAGS:HTML_TAGS).has(tree.tag))return document.createTextNode('');
   const el=tree.svg?document.createElementNS('http://www.w3.org/2000/svg',tree.tag):document.createElement(tree.tag);
   for(const [name,value] of Object.entries(tree.attrs||{}))if(safeMirrorAttribute(name,String(value)))el.setAttribute(name,String(value));
   el.removeAttribute('tabindex');
   for(const child of tree.children||[])el.append(decode(child));
   if(tree.animations?.length){el.style.animation='none';el.style.transition='none';plays.push([el,tree.animations]);}
   if(tree.scroll)scrolls.push([el,tree.scroll]);return el;
  };
  for(const child of data.children||[])scene.append(decode(child));host.replaceChildren(scene);
  for(const [el,scroll] of scrolls){el.scrollLeft=scroll[0];el.scrollTop=scroll[1];}
  for(const [el,animations] of plays)for(const a of animations){
   try{const animation=el.animate(a.frames,{duration:a.duration,delay:a.delay,easing:a.easing,iterations:a.iterations,fill:'none'});animation.currentTime=a.time+Math.max(0,Date.now()-data.capturedAt);}catch{/* Static object remains if an older browser cannot replay an animation. */}
  }
  onGuide(data.guide||null);
 }
 new ResizeObserver(()=>{if(latest)draw(latest);}).observe(host);
 return {update:draw};
}
