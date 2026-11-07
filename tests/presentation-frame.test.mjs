import {test} from "node:test";
import assert from "node:assert/strict";
import {normalizeFrame,adjustFrame} from "../public/presentation-frame.mjs";
test("presentation frame stays inside the PDF page when moved",()=>{
  const frame={x:100,y:100,width:500,height:250};
  assert.deepEqual(adjustFrame(frame,"move",2000,-2000,700),{x:500,y:0,width:500,height:250});
  assert.equal(normalizeFrame(null,700),null);
  assert.equal(normalizeFrame({x:NaN,y:0,width:200,height:100},700),null);
});
test("each resize corner preserves its opposite corner and a usable minimum size",()=>{
  const frame={x:100,y:100,width:500,height:250};
  assert.deepEqual(adjustFrame(frame,"nw",50,40,700),{x:150,y:140,width:450,height:210});
  assert.deepEqual(adjustFrame(frame,"se",2000,2000,700),{x:100,y:100,width:900,height:600});
  const smallest=adjustFrame(frame,"nw",2000,2000,700);
  assert.equal(smallest.x+smallest.width,600);assert.equal(smallest.y+smallest.height,350);
  assert.equal(smallest.width,40);assert.equal(smallest.height,40);
});
