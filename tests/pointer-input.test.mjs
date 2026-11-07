import {test} from "node:test";
import assert from "node:assert/strict";
import {bindPointerInput,defaultInputMode} from "../public/pointer-input.mjs";
import {appendContact} from "../public/tablet-input.mjs";
class TabletCanvas extends EventTarget {
  setPointerCapture(){throw new Error("Tablet does not support pointer capture");}
}
function packet(type,fields){
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{pointerId:7,pointerType:"pen",button:0,buttons:0,isPrimary:true,...fields});
  return event;
}
test("pen draws with zero button flags, failed capture, and retargeted window events",()=>{
  const canvas=new TabletCanvas(),view=new EventTarget();
  let mark,contact,ends=0;
  const input=bindPointerInput(canvas,{
    start:event=>{mark={points:[{x:event.clientX,y:event.clientY,p:.5}]};contact={contact:true,time:0,scale:1};return true;},
    move:event=>appendContact(mark,{x:event.clientX,y:event.clientY,p:.5},event,contact),
    end:()=>ends++
  },view);
  canvas.dispatchEvent(packet("pointerdown",{clientX:10,clientY:20}));
  canvas.dispatchEvent(packet("lostpointercapture",{}));
  view.dispatchEvent(packet("pointermove",{clientX:20,clientY:25}));
  view.dispatchEvent(packet("pointermove",{clientX:30,clientY:30}));
  view.dispatchEvent(packet("pointerup",{}));
  view.dispatchEvent(packet("pointermove",{clientX:999,clientY:999}));
  assert.equal(mark.points.length,3);
  assert.equal(ends,1);
  input.dispose();
});
test("a missing tablet release cannot block the next mouse stroke",()=>{
  const canvas=new TabletCanvas(),view=new EventTarget();
  const starts=[],moves=[];let cancels=0;
  const input=bindPointerInput(canvas,{
    start:event=>{starts.push(event.pointerType);return true;},
    move:event=>moves.push(event.pointerId),cancel:()=>cancels++
  },view);
  canvas.dispatchEvent(packet("pointerdown",{}));
  canvas.dispatchEvent(packet("pointerdown",{pointerId:1,pointerType:"mouse",buttons:1}));
  view.dispatchEvent(packet("pointermove",{pointerId:1,pointerType:"mouse",buttons:1}));
  view.dispatchEvent(packet("pointerup",{pointerId:1,pointerType:"mouse"}));
  assert.deepEqual(starts,["pen","mouse"]);
  assert.deepEqual(moves,[1]);
  assert.equal(cancels,1);
  input.dispose();
});

test("legacy mode uses mouse events only and never invokes pointer capture",()=>{
  const canvas=new TabletCanvas(),view=new EventTarget();
  let captureAttempts=0,mark,contact,ends=0;
  canvas.setPointerCapture=()=>{captureAttempts++;};
  const input=bindPointerInput(canvas,{
    start:event=>{event.preventDefault();mark={points:[{x:event.clientX,y:event.clientY,p:.5}]};contact={contact:true,time:0,scale:1};return true;},
    move:event=>appendContact(mark,{x:event.clientX,y:event.clientY,p:.5},event,contact),
    end:()=>ends++
  },view,{mode:"mouse"});
  canvas.dispatchEvent(packet("pointerdown",{clientX:5,clientY:5}));
  assert.equal(mark,undefined);
  canvas.dispatchEvent(packet("mousedown",{clientX:10,clientY:20}));
  view.dispatchEvent(packet("mousemove",{clientX:20,clientY:25}));
  view.dispatchEvent(packet("pointermove",{clientX:500,clientY:500}));
  view.dispatchEvent(packet("mousemove",{clientX:30,clientY:30}));
  view.dispatchEvent(packet("mouseup",{}));
  view.dispatchEvent(packet("mousemove",{clientX:999,clientY:999}));
  assert.equal(mark.points.length,3);
  assert.equal(captureAttempts,0);
  assert.equal(ends,1);
  input.dispose();
});

test("Windows Firefox starts in legacy input mode while other browsers retain standard input",()=>{
  assert.equal(defaultInputMode("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:157.0) Gecko/20100101 Firefox/157.0"),"mouse");
  assert.equal(defaultInputMode("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/145.0"),"pointer");
  assert.equal(defaultInputMode("Mozilla/5.0 (Macintosh) Firefox/157.0"),"pointer");
});
