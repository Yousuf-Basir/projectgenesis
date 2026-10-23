const COLORS={GREEN:'#9dff84',BLUE:'#70b6ff',RED:'#ff8b76'};
function inside(x,y,polygon) {
 let yes=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
  const a=polygon[i],b=polygon[j];
  if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;
 }
 return yes;
}

export function pantryGrains(points,contents,grainEnergy=1) {
 if(!points?.length)return [];
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
 const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const candidates=[];
 for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
  const point={x:minX+(x+.5)/8*(maxX-minX),y:minY+(y+.5)/8*(maxY-minY)};
  if(inside(point.x,point.y,points))candidates.push(point);
 }
 const grains=[];
 for(const color of Object.keys(COLORS)) {
  const amount=Math.max(0,contents?.[color]??0),count=Math.min(6,Math.ceil(amount/Math.max(.001,grainEnergy)));
  if(amount<=.01)continue;
  for(let i=0;i<count;i++)grains.push({color,alpha:Math.min(1,amount/Math.max(.001,grainEnergy)-i)});
 }
 return grains.slice(0,candidates.length).map((grain,index,list)=>({...grain,
  ...candidates[Math.min(candidates.length-1,Math.floor((index+.5)*candidates.length/list.length))]}));
}

export function drawPantries(context,pantries,cellSize,offsetX=0,offsetY=0) {
 if(!pantries?.enabled)return;
 context.save();
 for(const chamber of pantries.chambers??[]) {
  if(!Object.values(chamber.contents).some(value=>value>.01))continue;
  const points=chamber.points.map(point=>({x:offsetX+(point.x+.5)*cellSize,y:offsetY+(point.y+.5)*cellSize}));
  context.beginPath();context.moveTo(points[0].x,points[0].y);
  for(const point of points.slice(1))context.lineTo(point.x,point.y);
  context.closePath();context.fillStyle='rgba(4, 29, 37, 0.8)';context.fill();
  for(const grain of pantryGrains(points,chamber.contents,pantries.grainEnergy)) {
   context.globalAlpha=.35+.65*grain.alpha;context.fillStyle=COLORS[grain.color];
   const size=Math.max(1.1,cellSize*.13);context.fillRect(grain.x-size/2,grain.y-size/2,size,size);
  }
  context.globalAlpha=1;
 }
 // If a chamber opens, show the actual owner's remaining pouch rather than
 // pretending the food vanished or is still enclosed by nonexistent bonds.
 for(const member of pantries.loose??[]) {
  let index=0;
  for(const color of Object.keys(COLORS))if(member.contents[color]>.01) {
   context.fillStyle=COLORS[color];context.globalAlpha=.7;
   context.fillRect(offsetX+(member.x+.27+index*.2)*cellSize,offsetY+(member.y+.9)*cellSize,1.8,1.8);index++;
  }
 }
 context.restore();
}
