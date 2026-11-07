import {compileExpression} from "./expressions.mjs";
const colors=["#205db2","#c43459","#13816b","#9851b3","#d87818","#243b53"];
const defaultState=()=>({rows:[{expression:"y=x^2",color:colors[0],visible:true},
  {expression:"y=2x+1",color:colors[1],visible:true}],parameters:{},center:[0,0],units:40});
const clone=value=>JSON.parse(JSON.stringify(value));
export function createGraph(root,{onChange=()=>{}}={}){
  root.innerHTML=`
    <div class="graph-layout"><div class="graph-controls">
      <h3>Functions</h3><p class="graph-help">Enter y=f(x). Use ^ for powers, pi, sqrt(x), sin(x), or parameters like a*x^2+b. Trig uses radians.</p>
      <div class="equations"></div><button class="add-function">+ Add function</button>
      <div class="parameters"></div><p class="graph-help">Drag to pan. Scroll or pinch to zoom.</p>
    </div><div><div class="actions graph-navigation"><button class="graph-out" aria-label="Zoom graph out">−</button><button class="graph-in" aria-label="Zoom graph in">+</button><button class="graph-reset">Reset axes</button><output class="graph-readout" aria-live="off"></output></div>
    <canvas class="graph-canvas" width="1000" height="700" aria-label="Cartesian plane"></canvas></div></div>`;
  const find=selector=>root.querySelector(selector);
  const canvas=find("canvas"),ctx=canvas.getContext("2d");
  let data=defaultState(), compiled=[],drag=null,frame;
  const pointers=new Map();
  const emit=()=>onChange(clone(data));
  function prepare(){
    const variables=new Set();
    compiled=data.rows.map(row=>{
      try{
        const fn=compileExpression(row.expression);
        for(const name of fn.variables)variables.add(name);
        return {fn};
      }catch(error){return {error:error.message};}
    });
    for(const name of variables)if(!Number.isFinite(data.parameters[name]))data.parameters[name]=name==="a"?1:0;
    return [...variables].sort().slice(0,12);
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
  function fields(){
    const vars=prepare();
    find(".equations").replaceChildren(...data.rows.map((row,index)=>{
      const group=document.createElement("div");group.className="equation";
      const visible=document.createElement("input");visible.type="checkbox";visible.checked=row.visible;
      visible.setAttribute("aria-label","Show function "+(index+1));
      visible.onchange=()=>{row.visible=visible.checked;draw();emit();};
      const color=document.createElement("input");color.type="color";color.value=row.color;
      color.setAttribute("aria-label","Function "+(index+1)+" color");
      color.oninput=()=>{row.color=color.value;draw();emit();};
      const input=document.createElement("input");input.type="text";input.value=row.expression;input.maxLength=300;
      input.spellcheck=false;input.setAttribute("aria-label","Function "+(index+1));
      const remove=document.createElement("button");remove.textContent="×";remove.setAttribute("aria-label","Remove function "+(index+1));
      remove.onclick=()=>{data.rows.splice(index,1);fields();draw();emit();};
      const error=document.createElement("p");error.className="equation-error";error.setAttribute("role","status");
      error.textContent=compiled[index].error||"";
      input.oninput=()=>{
        row.expression=input.value;prepare();
        error.textContent=compiled[index].error||"";
        parameterFields();schedule();emit();
      };
      group.append(visible,color,input,remove,error);return group;
    }));
    parameterFields(vars);
  }
  function parameterFields(vars=prepare()){
    const panel=find(".parameters");
    const key=vars.join(",");
    if(panel.dataset.variables===key)return;
    panel.dataset.variables=key;panel.replaceChildren();
    for(const name of vars){
      const label=document.createElement("label");label.className="parameter";
      const heading=document.createElement("span");heading.textContent=name+" = ";
      const number=document.createElement("input");number.type="number";number.step="0.1";number.value=data.parameters[name];
      number.min="-100";number.max="100";number.setAttribute("aria-label","Parameter "+name+" value");
      const range=document.createElement("input");range.type="range";range.min="-10";range.max="10";range.step="0.1";
      range.value=data.parameters[name];range.setAttribute("aria-label","Parameter "+name);
      function update(value){
        const parsed=Number(value);
        if(!Number.isFinite(parsed))return;
        data.parameters[name]=Math.min(100,Math.max(-100,parsed));
        range.value=data.parameters[name];number.value=data.parameters[name];draw();emit();
      }
      number.oninput=()=>update(number.value);range.oninput=()=>update(range.value);
      label.append(heading,number,range);panel.append(label);
    }
  }
  const toWorld=(px,py)=>[data.center[0]+(px-500)/data.units,data.center[1]-(py-350)/data.units];
  function zoom(factor,px=500,py=350){
    const before=toWorld(px,py);
    data.units=Math.min(1e5,Math.max(0.02,data.units*factor));
    const after=toWorld(px,py);
    data.center[0]+=before[0]-after[0];data.center[1]+=before[1]-after[1];
    draw();
  }
  function draw(){
    ctx.clearRect(0,0,1000,700);ctx.fillStyle="#fff";ctx.fillRect(0,0,1000,700);
    const left=toWorld(0,0)[0],right=toWorld(1000,0)[0];
    const bottom=toWorld(0,700)[1],top=toWorld(0,0)[1];
    const raw=65/data.units,power=10**Math.floor(Math.log10(raw)),ratio=raw/power;
    const step=(ratio<2?1:ratio<5?2:5)*power;
    const sx=x=>500+(x-data.center[0])*data.units,sy=y=>350-(y-data.center[1])*data.units;
    const label=value=>Math.abs(value)<step/100?"0":Number(value.toPrecision(5)).toString();
    ctx.font="13px system-ui";ctx.lineWidth=1;
    for(let x=Math.ceil(left/step)*step;x<=right;x+=step){
      const px=sx(x);ctx.strokeStyle="#e0e7ef";ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,700);ctx.stroke();
      ctx.fillStyle="#52657b";ctx.fillText(label(x),px+4,Math.min(684,Math.max(16,sy(0)+16)));
    }
    for(let y=Math.ceil(bottom/step)*step;y<=top;y+=step){
      const py=sy(y);ctx.strokeStyle="#e0e7ef";ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(1000,py);ctx.stroke();
      ctx.fillStyle="#52657b";if(Math.abs(y)>step/100)ctx.fillText(label(y),Math.min(945,Math.max(4,sx(0)+5)),py-5);
    }
    ctx.strokeStyle="#52657b";ctx.lineWidth=1.7;
    ctx.beginPath();ctx.moveTo(sx(0),0);ctx.lineTo(sx(0),700);ctx.moveTo(0,sy(0));ctx.lineTo(1000,sy(0));ctx.stroke();
    ctx.fillStyle="#263d58";ctx.fillText("x",981,Math.min(680,Math.max(18,sy(0)-8)));
    ctx.fillText("y",Math.min(977,Math.max(8,sx(0)+9)),17);
    for(const [index,row] of data.rows.entries()){
      const fn=compiled[index]?.fn;
      if(!row.visible || !fn)continue;
      ctx.strokeStyle=row.color;ctx.lineWidth=2.6;ctx.beginPath();
      const sample=px=>{
        const y=fn.evaluate(toWorld(px,0)[0],data.parameters);
        return Number.isFinite(y)?sy(y):NaN;
      };
      // Midpoint subdivision keeps curves smooth and breaks across poles/domain gaps.
      function segment(x1,y1,x2,y2,depth=0){
        const mid=(x1+x2)/2,ym=sample(mid);
        if(!Number.isFinite(y1)&&!Number.isFinite(y2)&&!Number.isFinite(ym))return;
        const valid=Number.isFinite(y1)&&Number.isFinite(y2)&&Number.isFinite(ym);
        const error=Math.abs(ym-(y1+y2)/2);
        if((!valid || error>0.6 || Math.abs(y1-y2)>450) && depth<8){
          segment(x1,y1,mid,ym,depth+1);segment(mid,ym,x2,y2,depth+1);return;
        }
        if(!valid || error>4 || (y1<0&&y2>700)||(y2<0&&y1>700))return;
        if(Math.max(y1,y2)<-50 || Math.min(y1,y2)>750)return;
        ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
      }
      let y=sample(0);
      for(let px=2;px<=1000;px+=2){const next=sample(px);segment(px-2,y,px,next);y=next;}
      ctx.stroke();
    }
  }
  find(".add-function").onclick=()=>{
    if(data.rows.length>=12)return;
    data.rows.push({expression:"",color:colors[data.rows.length%colors.length],visible:true});
    fields();draw();emit();find(".equations").lastElementChild.querySelector('input[type=text]').focus();
  };
  find(".graph-in").onclick=()=>{zoom(1.4);emit();};
  find(".graph-out").onclick=()=>{zoom(1/1.4);emit();};
  find(".graph-reset").onclick=()=>{data.center=[0,0];data.units=40;draw();emit();};
  const at=event=>{
    const rect=canvas.getBoundingClientRect();return [(event.clientX-rect.left)*1000/rect.width,(event.clientY-rect.top)*700/rect.height];
  };
  canvas.onwheel=event=>{event.preventDefault();zoom(Math.exp(-event.deltaY*0.0015),...at(event));emit();};
  canvas.onpointerdown=event=>{
    if(event.button!==0)return;
    event.preventDefault();pointers.set(event.pointerId,at(event));canvas.setPointerCapture(event.pointerId);drag=null;
    if(pointers.size===1)drag={point:at(event),center:[...data.center]};
  };
  canvas.onpointermove=event=>{
    const next=at(event);
    const world=toWorld(...next);find(".graph-readout").textContent=`(${world[0].toFixed(2)}, ${world[1].toFixed(2)})`;
    if(!pointers.has(event.pointerId))return;
    if(pointers.size===2){
      const prior=[...pointers.values()],oldLength=Math.hypot(prior[0][0]-prior[1][0],prior[0][1]-prior[1][1]);
      pointers.set(event.pointerId,next);
      const current=[...pointers.values()],length=Math.hypot(current[0][0]-current[1][0],current[0][1]-current[1][1]);
      if(oldLength>1)zoom(length/oldLength,(current[0][0]+current[1][0])/2,(current[0][1]+current[1][1])/2);
    }else if(drag){
      data.center=[drag.center[0]-(next[0]-drag.point[0])/data.units,
        drag.center[1]+(next[1]-drag.point[1])/data.units];draw();
    }
    pointers.set(event.pointerId,next);
  };
  const finish=event=>{
    if(!pointers.delete(event.pointerId))return;
    drag=null;if(pointers.size===1)drag={point:[...pointers.values()][0],center:[...data.center]};
    emit();
  };
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=finish;
  function restore(value){
    data=defaultState();
    if(value && Array.isArray(value.rows)){
      data.rows=value.rows.slice(0,12).map((row,index)=>({
        expression:typeof row.expression==="string"?row.expression.slice(0,300):"",
        color:/^#[a-f0-9]{6}$/i.test(row.color)?row.color:colors[index%colors.length],visible:row.visible!==false
      }));
      if(value.center?.length===2 && value.center.every(Number.isFinite))data.center=value.center.map(v=>Math.min(1e8,Math.max(-1e8,v)));
      if(Number.isFinite(value.units))data.units=Math.min(1e5,Math.max(.02,value.units));
      for(const [name,parameterValue] of Object.entries(value.parameters||{})){
        if(/^[a-z]$/.test(name)&&Number.isFinite(parameterValue))data.parameters[name]=Math.min(100,Math.max(-100,parameterValue));
      }
    }
    find(".parameters").dataset.variables="unset";
    fields();draw();
  }
  restore();
  return {getState:()=>clone(data),restore,
    snapshot:()=>{
      const output=document.createElement("canvas");output.width=1000;output.height=830;
      const paint=output.getContext("2d");paint.fillStyle="#fff";paint.fillRect(0,0,1000,830);paint.drawImage(canvas,0,0);
      paint.font="16px system-ui";
      data.rows.filter(row=>row.visible).slice(0,12).forEach((row,index)=>{
        paint.fillStyle=row.color;paint.fillText(row.expression,16+(index%3)*330,727+Math.floor(index/3)*23,315);
      });
      return output;
    }};
}
