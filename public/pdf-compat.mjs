// PDF.js runs in two separate environments: the page and its module worker.
// Install missing APIs in both before loading the renderer.
if(!Promise.withResolvers)Object.defineProperty(Promise,"withResolvers",{configurable:true,writable:true,value:function(){
  let resolve,reject;const promise=new this((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};
}});
if(!Promise.try)Object.defineProperty(Promise,"try",{configurable:true,writable:true,value:function(callback,...args){
  return new this(resolve=>resolve(callback(...args)));
}});
for(const Type of [Map,WeakMap])if(!Type.prototype.getOrInsertComputed)Object.defineProperty(Type.prototype,"getOrInsertComputed",{configurable:true,writable:true,value:function(key,callback){
  if(this.has(key))return this.get(key);
  const value=callback(key);this.set(key,value);return value;
}});
if(!Set.prototype.intersection)Object.defineProperty(Set.prototype,"intersection",{configurable:true,writable:true,value:function(other){
  return new Set([...this].filter(value=>other.has(value)));
}});
if(!ArrayBuffer.prototype.transferToFixedLength)Object.defineProperty(ArrayBuffer.prototype,"transferToFixedLength",{configurable:true,writable:true,value:function(length=this.byteLength){
  const copy=new ArrayBuffer(length);new Uint8Array(copy).set(new Uint8Array(this,0,Math.min(this.byteLength,length)));return copy;
}});
if(typeof Response!=="undefined"&&!Response.prototype.bytes)Object.defineProperty(Response.prototype,"bytes",{configurable:true,writable:true,value:async function(){return new Uint8Array(await this.arrayBuffer());}});
