import {readFile,readdir,mkdir,writeFile,copyFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join,extname} from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".pdf":"application/pdf",".wasm":"application/wasm"};
const assets={};
async function visit(folder,prefix=""){
  for(const item of await readdir(folder,{withFileTypes:true})){
    const path=join(folder,item.name),url=prefix+"/"+item.name;
    if(item.isDirectory())await visit(path,url);
    else assets[url]={type:types[extname(path)]||"application/octet-stream",data:(await readFile(path)).toString("base64")};
  }
}
await visit(join(root,"public"));
await mkdir(join(root,"dist/server"),{recursive:true});
await mkdir(join(root,"dist/.openai"),{recursive:true});
const worker=await readFile(join(root,"worker/index.mjs"),"utf8");
await writeFile(join(root,"dist/server/index.js"),"const ASSETS="+JSON.stringify(assets)+";\n"+worker);
await copyFile(join(root,".openai/hosting.json"),join(root,"dist/.openai/hosting.json"));
console.log("Hosted Worker built with "+Object.keys(assets).length+" local assets.");
