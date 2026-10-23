const COLORS={GREEN:'#9dff84',BLUE:'#70b6ff',RED:'#ff8b76'};
function inside(x,y,polygon) {
 let yes=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
  const a=polygon[i],b=polygon[j];
  if((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;
 }
 return yes;
}

export function pantryGrains(points,contents,grainEnergy=1,grainSize=0) {
 if(!points?.length)return [];
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
 const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const candidates=[];
 const resolution=grainSize>0?16:8;
 for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++) {
  const point={x:minX+(x+.5)/resolution*(maxX-minX),y:minY+(y+.5)/resolution*(maxY-minY)};
  const margin=grainSize/2;
  if(inside(point.x,point.y,points) && (!margin || [[-1,-1],[-1,1],[1,-1],[1,1]].every(([dx,dy])=>inside(point.x+dx*margin,point.y+dy*margin,points))))candidates.push(point);
 }
 if(grainSize>0) {
  const packed=[];
  for(const point of candidates)if(packed.every(other=>Math.hypot(point.x-other.x,point.y-other.y)>=grainSize+1))packed.push(point);
  candidates.splice(0,candidates.length,...packed);
 }
 const grains=[],buckets=[];
 for(const color of Object.keys(COLORS)) {
  const amount=Math.max(0,contents?.[color]??0),count=Math.min(6,Math.ceil(amount/Math.max(.001,grainEnergy)));
  if(amount<=.01)continue;
  buckets.push({color,amount,count});
 }
 buckets.sort((a,b)=>b.amount-a.amount);
 for(let i=0;i<6;i++)for(const {color,amount,count} of buckets)if(i<count)
  grains.push({color,alpha:Math.min(1,amount/Math.max(.001,grainEnergy)-i)});
 return grains.slice(0,candidates.length).map((grain,index,list)=>({...grain,
  ...candidates[Math.min(candidates.length-1,Math.floor((index+.5)*candidates.length/list.length))]}));
}

export function drawPantries(context,pantries,cellSize,offsetX=0,offsetY=0) {
 if(!pantries?.enabled)return;
 context.save();
 context.globalAlpha=1;
 context.lineCap='round';
 for(const chamber of pantries.chambers??[]) {
  const colors=Object.keys(COLORS).filter(color=>(chamber.contents?.[color]??0)>.01)
   .sort((a,b)=>chamber.contents[b]-chamber.contents[a]);
  if(!colors.length || !chamber.points?.length)continue;
  const points=chamber.points.map(point=>({x:offsetX+(point.x+.5)*cellSize,y:offsetY+(point.y+.5)*cellSize}));
  let center={x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length};
  if(!inside(center.x,center.y,points)) {
   center=pantryGrains(points,chamber.contents,pantries.grainEnergy)
    .sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y))[0];
   if(!center)continue;
  }
  // This is a presence symbol, not a food sprite or a strength/energy halo.
  // Draw it last, with a dark outline, so gold bonds cannot cover it again.
  const radius=Math.max(3,cellSize*.23),{x,y}=center;
  context.strokeStyle='#03131b';context.lineWidth=4;
  context.beginPath();context.moveTo(x-radius,y);context.lineTo(x+radius,y);
  context.moveTo(x,y-radius);context.lineTo(x,y+radius);context.stroke();
  const arms=[[x-radius,y,x,y],[x,y,x+radius,y],[x,y-radius,x,y],[x,y,x,y+radius]];
  context.lineWidth=2;
  arms.forEach(([x1,y1,x2,y2],index)=>{
   context.strokeStyle=COLORS[colors[index%colors.length]];
   context.beginPath();context.moveTo(x1,y1);context.lineTo(x2,y2);context.stroke();
  });
 }
 // If a chamber opens, show the actual owner's remaining pouch rather than
 // pretending the food vanished or is still enclosed by nonexistent bonds.
 for(const member of pantries.loose??[]) {
  let index=0;
  for(const color of Object.keys(COLORS))if(member.contents[color]>.01) {
   context.fillStyle=COLORS[color];context.globalAlpha=1;
   context.fillRect(offsetX+(member.x+.1+index*.28)*cellSize,offsetY+(member.y+.95)*cellSize,3,3);index++;
  }
 }
 context.restore();
}
