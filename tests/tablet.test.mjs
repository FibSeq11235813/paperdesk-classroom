import {test} from "node:test";
import assert from "node:assert/strict";
import {contactPoint,appendContact} from "../public/tablet-input.mjs";
import {pathPoints,touches} from "../public/marks.mjs";
test("tablet coordinates stay in page space at zoom and reject reset coordinates",()=>{
  const rect={left:200,top:100,width:2000,height:1400};
  assert.deepEqual(contactPoint({clientX:600,clientY:300,pressure:.8},rect,2),{x:200,y:100,p:.8});
  assert.equal(contactPoint({clientX:0,clientY:0},rect,2),null);
  assert.equal(contactPoint({clientX:NaN,clientY:100},rect,2),null);
  assert.equal(contactPoint({clientX:0,clientY:0},{left:-100,top:-200,width:3000,height:2400},2,{left:200,top:100,right:900,bottom:800}),null);
});
test("hover packets cannot extend ink and discontinuous contact has a pen break",()=>{
  const mark={points:[{x:50,y:50,p:.5}]},previous={time:10,scale:1};
  assert.equal(appendContact(mark,{x:0,y:0,p:0},{buttons:0,timeStamp:11},previous),false);
  assert.equal(mark.points.length,1);
  appendContact(mark,{x:55,y:55,p:.6},{buttons:1,timeStamp:20},previous);
  assert.equal(mark.points[1].breakBefore,undefined);
  appendContact(mark,{x:800,y:600,p:.6},{buttons:1,timeStamp:25},previous);
  assert.equal(mark.points[2].breakBefore,true);
  const full={kind:"pen",...mark,width:3};
  assert.equal(touches(full,{x:400,y:300}),false);
  assert.equal(pathPoints(full).length,3);
});

test("pausing with the pen held down keeps the next nearby sample connected",()=>{
  const mark={points:[{x:10,y:10,p:.5}]};
  appendContact(mark,{x:15,y:15,p:.5},{buttons:0,pointerType:"pen",timeStamp:1000},{contact:true,time:0,scale:1});
  assert.equal(mark.points[1].breakBefore,undefined);
});
