export const randomUnit=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
export function diceRoll(faces,count,rng=randomUnit){
 if(!Number.isInteger(faces)||faces<2||faces>1000||!Number.isInteger(count)||count<1||count>20)throw new Error('Choose 2–1000 faces and 1–20 dice.');
 return Array.from({length:count},()=>Math.floor(rng()*faces)+1);
}
export function isPrime(n){if(n<2||!Number.isInteger(n))return false;for(let d=2;d*d<=n;d++)if(n%d===0)return false;return true;}
export function randomNumbers({min,max,count,type='integer',unique=false},rng=randomUnit){
 if(!Number.isFinite(min)||!Number.isFinite(max)||min>max||Math.abs(min)>1e6||Math.abs(max)>1e6||!Number.isInteger(count)||count<1||count>100)throw new Error('Use a valid range within ±1,000,000 and 1–100 results.');
 if(!['integer','even','odd','prime','decimal'].includes(type))throw new Error('Unknown number type.');
 if(type==='decimal'){
  const low=Math.ceil(min*100),high=Math.floor(max*100),size=high-low+1;
  if(size<1||unique&&count>size)throw new Error('Not enough two-decimal values in this range.');
  const output=[],seen=new Set();while(output.length<count){const n=low+Math.floor(rng()*size);if(!unique||!seen.has(n)){output.push(n/100);seen.add(n);}}return output;
 }
 const low=Math.ceil(min),high=Math.floor(max);
 if(high-low>100000)throw new Error('For integer types, use a range spanning at most 100,000.');
 const pool=[];for(let n=low;n<=high;n++)if(type==='integer'||type==='even'&&n%2===0||type==='odd'&&Math.abs(n%2)===1||type==='prime'&&isPrime(n))pool.push(n);
 if(!pool.length||unique&&count>pool.length)throw new Error('Not enough matching numbers in this range.');
 return Array.from({length:count},()=>{const i=Math.floor(rng()*pool.length);return unique?pool.splice(i,1)[0]:pool[i];});
}
export function wheelSectors(count,text,weighted){
 if(!Number.isInteger(count)||count<2||count>40)throw new Error('Choose 2–40 sectors.');
 const lines=text.trim()?text.trim().split('\n').map(s=>s.trim()).filter(Boolean):Array.from({length:count},(_,i)=>String(i+1));
 if(lines.length<2||lines.length>40)throw new Error('Enter 2–40 sector labels, one per line.');
 return lines.map(line=>{
  const index=line.lastIndexOf(':'),label=weighted&&index>=0?line.slice(0,index).trim():line;
  const weight=weighted&&index>=0?Number(line.slice(index+1)):1;
  if(!label||!Number.isFinite(weight)||weight<=0||weight>1e6)throw new Error('Weights must be positive; use Label:weight.');
  return {label:label.slice(0,60),weight};
 });
}
export function weightedPick(sectors,rng=randomUnit){
 const total=sectors.reduce((sum,s)=>sum+s.weight,0),draw=rng()*total;let start=0;
 for(let i=0;i<sectors.length;i++){const end=start+sectors[i].weight;if(draw<end||i===sectors.length-1)return {index:i,label:sectors[i].label,angle:(start+sectors[i].weight/2)/total*360};start=end;}
}
