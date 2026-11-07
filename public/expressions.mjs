// A small expression parser. Expressions are interpreted as arithmetic, never JavaScript.
const functions = {
  sin:Math.sin, cos:Math.cos, tan:Math.tan, asin:Math.asin, acos:Math.acos, atan:Math.atan,
  sqrt:Math.sqrt, abs:Math.abs, exp:Math.exp, ln:Math.log, log:Math.log10,
  floor:Math.floor, ceil:Math.ceil, round:Math.round
};
const constants={pi:Math.PI,e:Math.E};
export function compileExpression(source) {
  const text=source.trim().replace(/^y\s*=/i,"").replaceAll("π","pi").replaceAll("−","-")
    .replaceAll("×","*").replaceAll("÷","/");
  if(!text || text.length>300)throw new Error("Enter a function of x (up to 300 characters).");
  const tokens=[];
  let offset=0;
  while(offset<text.length){
    const char=text[offset];
    if(/\s/.test(char)){offset++;continue;}
    const number=/^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(text.slice(offset));
    if(number){tokens.push({type:"number",value:Number(number[0])});offset+=number[0].length;continue;}
    const name=/^[A-Za-z]+/.exec(text.slice(offset));
    if(name){tokens.push({type:"name",value:name[0].toLowerCase()});offset+=name[0].length;continue;}
    if("+-*/^()".includes(char)){tokens.push({type:char});offset++;continue;}
    throw new Error("Use numbers, x, a–z parameters, + − * / ^, and functions such as sin(x).");
  }
  if(tokens.length>200)throw new Error("That expression is too long.");
  tokens.push({type:"end"});
  const variables=new Set();
  let cursor=0;
  const peek=()=>tokens[cursor].type;
  function atom(){
    const token=tokens[cursor++];
    if(token.type==="number")return {kind:"value",value:token.value};
    if(token.type==="("){
      const node=expression();
      if(peek()!==")")throw new Error("Close the parenthesis.");
      cursor++;return node;
    }
    if(token.type==="name"){
      if(Object.hasOwn(functions,token.value)){
        if(peek()!=="(")throw new Error("Write "+token.value+"(x) with parentheses.");
        cursor++;const input=expression();
        if(peek()!==")")throw new Error("Close the function’s parenthesis.");
        cursor++;return {kind:"call",name:token.value,input};
      }
      if(Object.hasOwn(constants,token.value))return {kind:"value",value:constants[token.value]};
      // Adjacent one-letter variables, such as ax, mean a*x.
      if(!/^[a-df-hj-z]x?$/.test(token.value))throw new Error("Unknown name. Try sin(x), sqrt(x), or a single-letter parameter.");
      const letters=[...token.value];
      const nodes=letters.map(name=>{
        if(name!=="x")variables.add(name);
        return {kind:"variable",name};
      });
      return nodes.reduce((left,right)=>({kind:"binary",operator:"*",left,right}));
    }
    throw new Error("Expected a number, variable, or parenthesis.");
  }
  function power(){
    const left=atom();
    if(peek()!=="^")return left;
    cursor++;return {kind:"binary",operator:"^",left,right:unary()};
  }
  function unary(){
    if(peek()==="+" || peek()==="-"){
      const operator=tokens[cursor++].type;
      return {kind:"unary",operator,input:unary()};
    }
    return power();
  }
  function product(){
    let left=unary();
    while(true){
      let operator=peek(),implicit=false;
      if(["number","name","("].includes(operator)){operator="*";implicit=true;}
      if(operator!=="*" && operator!=="/")return left;
      if(!implicit)cursor++;
      left={kind:"binary",operator,left,right:unary()};
    }
  }
  function expression(){
    let left=product();
    while(peek()==="+" || peek()==="-"){
      const operator=tokens[cursor++].type;
      left={kind:"binary",operator,left,right:product()};
    }
    return left;
  }
  const tree=expression();
  if(peek()!=="end")throw new Error("Unexpected symbol or unmatched parenthesis.");
  function evaluate(node,x,parameters){
    if(node.kind==="value")return node.value;
    if(node.kind==="variable")return node.name==="x"?x:Number(parameters[node.name]??0);
    if(node.kind==="call")return functions[node.name](evaluate(node.input,x,parameters));
    if(node.kind==="unary"){
      const value=evaluate(node.input,x,parameters);
      return node.operator==="-"?-value:value;
    }
    const a=evaluate(node.left,x,parameters),b=evaluate(node.right,x,parameters);
    switch(node.operator){
      case "+":return a+b;
      case "-":return a-b;
      case "*":return a*b;
      case "/":return a/b;
      case "^":return Math.pow(a,b);
    }
  }
  return {variables:[...variables].sort(),evaluate:(x,parameters={})=>evaluate(tree,x,parameters)};
}
