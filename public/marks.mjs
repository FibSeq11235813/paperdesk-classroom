// Mark coordinates use PDF.js's scale-one viewport, with the origin at top left.
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const polar = (center, radius, angle) => ({
  x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle)
});
const direction = (center, point) => Math.atan2(point.y - center.y, point.x - center.x);

function pathPoints(mark) {
  const [a, b] = mark.points;
  if (mark.kind === "line") return [a, b];
  if (mark.kind === "rect") return [a, {x:b.x,y:a.y}, b, {x:a.x,y:b.y}, a];
  if (mark.kind === "ellipse") {
    const center = {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    return Array.from({length:129}, (_, i) => {
      const angle = i * TAU / 128;
      return {x:center.x+(b.x-a.x)/2*Math.cos(angle),y:center.y+(b.y-a.y)/2*Math.sin(angle)};
    });
  }
  if (mark.kind === "arc") {
    const count = Math.max(1, Math.ceil(Math.abs(mark.sweep) * 24));
    return Array.from({length:count+1}, (_, i) => polar(a, mark.radius, mark.start + i/count*mark.sweep));
  }
  return mark.points;
}

function dashArray(mark) {
  if (mark.pattern === "Dashed") return [4*mark.width, 3*mark.width];
  if (mark.pattern === "Dotted") return [0.01, 3*mark.width];
  return [];
}

function widthAt(mark, a, b = a) {
  return mark.width * (mark.variable ? 0.22 + 0.78 * ((a.p+b.p)/2) : 1);
}

function strokeSegments(mark) {
  const groups=[];
  for(const point of pathPoints(mark)){
    if(!groups.length || point.breakBefore)groups.push([]);
    groups.at(-1).push(point);
  }
  return groups;
}
function eachStroke(mark, draw) {
  for(const points of strokeSegments(mark)){
    if (points.length === 1) {
      draw([points[0], {...points[0], x:points[0].x+0.01}], widthAt(mark, points[0]), []);
    } else if (mark.variable) {
      for (let i=1; i<points.length; i++) draw([points[i-1], points[i]], widthAt(mark, points[i-1], points[i]), []);
    } else {
      draw(points, mark.width, dashArray(mark));
    }
  }
}

function paintMark(ctx, mark) {
  ctx.save();
  ctx.strokeStyle = mark.color;
  ctx.globalAlpha = mark.opacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  eachStroke(mark, (points, width, dash) => {
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.lineDashOffset=mark.dashOffset||0;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x,p.y);
    ctx.stroke();
  });
  ctx.restore();
}

function touches(mark, point) {
  const points = pathPoints(mark);
  const tolerance = Math.max(6, mark.width/2+3);
  if (points.length === 1) return distance(points[0], point) <= tolerance;
  return points.slice(1).some((b,i) => {
    if(b.breakBefore)return false;
    const a=points[i], dx=b.x-a.x, dy=b.y-a.y;
    const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy || 1),0,1);
    return distance(point,{x:a.x+t*dx,y:a.y+t*dy})<=tolerance;
  });
}

function saveAnnotation(doc, page, mark, toPdf) {
  const {PDFName, PDFHexString, PDFArray} = PDFLib;
  const ctx = doc.context;
  const num = value => Number(value.toFixed(5));
  const coords = point => toPdf(point).map(num);
  const points = pathPoints(mark).map(coords);
  let left=Infinity,bottom=Infinity,right=-Infinity,top=-Infinity;
  for (const [x,y] of points) {
    left=Math.min(left,x); right=Math.max(right,x);
    bottom=Math.min(bottom,y); top=Math.max(top,y);
  }
  // PDF UserUnit changes the relation between PDF units and viewport points.
  const origin=coords({x:0,y:0}), unit=coords({x:1,y:0});
  const units=Math.hypot(unit[0]-origin[0],unit[1]-origin[1]);
  const pad=(mark.width+2)*units;
  const box=[left-pad,bottom-pad,right+pad,top+pad].map(num);
  const color=mark.color.slice(1).match(/../g).map(value=>parseInt(value,16)/255);
  const commands=[`q /Opacity gs ${color.map(num).join(" ")} RG 1 J 1 j`];
  eachStroke(mark, (stroke,width,dash) => {
    commands.push(`${num(width*units)} w [${dash.map(value=>num(value*units)).join(" ")}] ${num((mark.dashOffset||0)*units)} d`);
    for (const [i,point] of stroke.entries()) {
      const [x,y]=coords(point);
      commands.push(`${x} ${y} ${i ? "l" : "m"}`);
    }
    commands.push("S");
  });
  commands.push("Q");
  const appearance=ctx.register(ctx.flateStream(commands.join("\n"), {
    Type:"XObject",Subtype:"Form",BBox:box,
    Resources:{ExtGState:{Opacity:{Type:"ExtGState",CA:mark.opacity,ca:mark.opacity}}}
  }));
  const annotation={Type:"Annot",Subtype:"Ink",Rect:box,C:color,CA:mark.opacity,F:4,
    T:PDFHexString.fromText("Paperdesk PDF"),AP:{N:appearance},
    BS:{Type:"Border",W:num(mark.width*units),S:dashArray(mark).length ? "D" : "S"}};
  if (dashArray(mark).length) annotation.BS.D=dashArray(mark).map(value=>num(value*units));
  if (mark.kind==="line") {
    annotation.Subtype="Line";
    annotation.L=points.flat();
  } else if (mark.kind==="ellipse" || mark.kind==="rect") {
    annotation.Subtype=mark.kind==="ellipse" ? "Circle" : "Square";
  } else {
    annotation.InkList=strokeSegments(mark).map(group=>{
      const values=group.map(coords).flat();
      return group.length===1?[...values,...coords({...group[0],x:group[0].x+0.01})]:values;
    });
  }
  const key=PDFName.of("Annots");
  let annots=page.node.lookupMaybe(key,PDFArray);
  if (!annots) {
    annots=ctx.obj([]);
    page.node.set(key,annots);
  }
  annots.push(ctx.register(ctx.obj(annotation)));
}

export {paintMark, touches, saveAnnotation, pathPoints, polar, direction, distance, clamp};
