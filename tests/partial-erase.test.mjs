import test from 'node:test';
import assert from 'node:assert/strict';
import {eraseCircle,eraseSweep} from '../public/partial-erase.mjs';
const line={kind:'line',points:[{x:0,y:0},{x:100,y:0}],width:.5,color:'#174a87',opacity:1,pattern:'Dashed'};
test('partial erasing splits a line and preserves dash position and style',()=>{
  const parts=eraseCircle(line,{x:50,y:0},5);
  assert.equal(parts.length,2);assert.equal(parts[0].points.at(-1).x,44.75);assert.equal(parts[1].points[0].x,55.25);
  assert.equal(parts[1].dashOffset,55.25);assert.equal(parts[0].pattern,'Dashed');assert.equal(parts[0].width,.5);
  assert.equal(line.points.length,2);
});
test('swept eraser catches a line even when input jumps across it',()=>{
  const parts=eraseSweep([line],{x:50,y:-100},{x:50,y:100},.25);
  assert.equal(parts.length,2);assert.equal(parts[0].points.at(-1).x,49.5);assert.equal(parts[1].points[0].x,50.5);
});
test('unhit shapes retain identity; erased shapes retain unaffected borders',()=>{
  const rect={...line,kind:'rect',points:[{x:0,y:0},{x:100,y:100}]};
  assert.equal(eraseCircle(rect,{x:50,y:50},2)[0],rect);
  const parts=eraseCircle(rect,{x:50,y:0},5);assert.equal(parts.length,2);
  assert.ok(parts[1].points.some(p=>p.y===100));
});
test('eraser respects existing path breaks',()=>{
  const mark={...line,kind:'path',points:[{x:0,y:0},{x:10,y:0},{x:90,y:0,breakBefore:true},{x:100,y:0}]};
  assert.equal(eraseCircle(mark,{x:50,y:0},2)[0],mark);
});
