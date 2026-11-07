import {test} from "node:test";
import assert from "node:assert/strict";
import {compileExpression} from "../public/expressions.mjs";
test("arithmetic precedence, powers, implicit multiplication, and parameters",()=>{
  for(const [input,x,want] of [["-x^2",3,-9],["2^-2",0,.25],["2^3^2",0,512],["2x+1",4,9],["(x+1)(x-1)",3,8],["y=a*x^2+b",2,13],["ax+b",2,7]]){
    assert.equal(compileExpression(input).evaluate(x,{a:3,b:1}),want,input);
  }
});
test("domain gaps remain nonfinite instead of becoming points",()=>{
  assert.equal(compileExpression("1/x").evaluate(0),Infinity);
  assert(Number.isNaN(compileExpression("sqrt(x)").evaluate(-1)));
  assert.equal(compileExpression("sin(pi/2)").evaluate(0),1);
  assert.deepEqual(compileExpression("a*x^2+b").variables,["a","b"]);
});
test("invalid and executable expressions are rejected",()=>{
  for(const source of ["x;alert(1)","window.location","constructor(x)","sin x","x^","(x+1","x=1","x**2"]){
    assert.throws(()=>compileExpression(source),undefined,source);
  }
});
