import {test} from "node:test";
import assert from "node:assert/strict";
import {appendContact,finishContact} from "../public/tablet-input.mjs";
import {stabilizePoint} from "../public/stroke-filter.mjs";
test("backdated contact packets never pull the drawn stroke backwards",()=>{
  const mark={points:[{x:0,y:0,p:.5}]},state={contact:true,time:10,scale:1};
  appendContact(mark,{x:10,y:0,p:.5},{timeStamp:20,buttons:0},state);
  assert.equal(appendContact(mark,{x:3,y:0,p:.5},{timeStamp:15,buttons:0},state),false);
  assert.deepEqual(mark.points.map(point=>point.x),[0,10]);
  assert.equal(state.time,20);
});
test("stabilization damps alternating wobble and bounds lag at each zoom",()=>{
  for(const scale of [.5,1,4]){
    const state={};const filtered=[];
    for(let index=0;index<80;index++){
      const raw={x:index*4/scale,y:(index%2?2:-2)/scale,p:.5};
      const value=stabilizePoint(raw,index*16,scale,state);
      assert(Math.hypot(value.x-raw.x,value.y-raw.y)*scale<=4.00001);
      if(index>20)filtered.push(value.y*scale);
    }
    assert(Math.max(...filtered)-Math.min(...filtered)<1.5);
  }
});
test("stabilization retains real reversals and the final contact endpoint",()=>{
  const mark={points:[{x:0,y:0,p:.5}]},state={contact:true,time:0,scale:1,stabilize:true};
  const xs=[5,10,15,20,25,20,15,10,5,0];
  xs.forEach((x,index)=>appendContact(mark,{x,y:0,p:.5},{timeStamp:(index+1)*16,buttons:0},state));
  finishContact(mark,state);
  assert.equal(mark.points.at(-1).x,0);
  assert(Math.max(...mark.points.map(point=>point.x))>20);
  assert.equal(mark.points.at(-1).y,0);
});
