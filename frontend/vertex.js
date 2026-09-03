const defaults = {vertices:[[-180,-90],[180,-90],[-180,90],[180,90]],tx:0,ty:0,sx:1,sy:1,rotation:0};
let saved=defaults;try { saved={...defaults,...JSON.parse(localStorage.getItem("workflow.vertexTransform")||"null")}; } catch (_) { /* first workflow uses defaults */ }
const vertices = (Array.isArray(saved.vertices)&&saved.vertices.length===4?saved.vertices:defaults.vertices).map((pair,index)=>({index,x:Number(pair[0])||0,y:Number(pair[1])||0}));
const root=document.querySelector("#vertex-inputs");
vertices.forEach(v=>{const row=document.createElement("label");row.className="vertex-row";row.innerHTML=`<span>V${v.index}</span><input data-i="${v.index}" data-key="x" type="number" value="${v.x}"><input data-i="${v.index}" data-key="y" type="number" value="${v.y}">`;root.append(row);});
[["#tx",saved.tx],["#ty",saved.ty],["#sx",saved.sx],["#sy",saved.sy],["#rotation",saved.rotation]].forEach(([selector,value])=>document.querySelector(selector).value=value);
const number=id=>Number(document.querySelector(id).value)||0;
function save(){localStorage.setItem("workflow.vertexTransform",JSON.stringify({vertices:vertices.map(vertex=>[vertex.x,vertex.y]),tx:number("#tx"),ty:number("#ty"),sx:number("#sx")||1,sy:number("#sy")||1,rotation:number("#rotation")}));}
function render(){
  document.querySelectorAll(".vertex-row input").forEach(input=>vertices[Number(input.dataset.i)][input.dataset.key]=Number(input.value)||0);
  const tx=number("#tx"),ty=number("#ty"),sx=number("#sx")||1,sy=number("#sy")||1,deg=number("#rotation"),r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  const result=vertices.map(v=>({x:(v.x*sx)*c-(v.y*sy)*s+tx,y:(v.x*sx)*s+(v.y*sy)*c+ty}));
  const svg=document.querySelector("#vertex-preview"),cx=210,cy=140,scale=.45;
  // The runtime uses triangle-strip order; SVG polygons need perimeter order.
  const previewOrder=[0,1,3,2];
  const points=previewOrder.map(index=>`${cx+result[index].x*scale},${cy-result[index].y*scale}`).join(" ");
  svg.innerHTML=`<line x1="0" y1="${cy}" x2="420" y2="${cy}" class="axis"/><line x1="${cx}" y1="0" x2="${cx}" y2="280" class="axis"/><polygon points="${points}" class="quad"/>${result.map((p,i)=>`<circle cx="${cx+p.x*scale}" cy="${cy-p.y*scale}" r="5" class="vertex-dot"/><text x="${cx+p.x*scale+8}" y="${cy-p.y*scale-8}">V${i}</text>`).join("")}`;
  document.querySelector("#vertex-code").textContent=`// Runtime requires explicit QuadVertices\nnew QuadVertices(${vertices.flatMap(p=>[p.x+"f",p.y+"f"]).join(", ")});\n\nvec2 scaled = a_position * vec2(${sx.toFixed(3)}, ${sy.toFixed(3)});\nmat2 rotation = mat2(${c.toFixed(5)}, ${s.toFixed(5)}, -${s.toFixed(5)}, ${c.toFixed(5)});\nvec2 world = rotation * scaled + vec2(${tx.toFixed(3)}, ${ty.toFixed(3)});\ngl_Position = gameViewport * vec4(world, 0.0, 1.0);`;
  save();
}
document.querySelectorAll("input").forEach(e=>e.addEventListener("input",render));render();
