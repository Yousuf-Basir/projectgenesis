// Local, paid food inventories. A loop is a shelter/visual compartment, not a
// global wallet: every stored unit belongs to a living boundary member.
const COLORS=['GREEN','BLUE','RED'];
const stock=member=>(member.foodPantry??={GREEN:0,BLUE:0,RED:0});
const total=values=>COLORS.reduce((sum,color)=>sum+(values?.[color]??0),0);
export const pantriesEnabled=sim=>Boolean(sim.config.bond.adaptiveMorphology?.enabled && sim.config.bond.foodPantries?.enabled);
const stats=sim=>(sim.pantryStats??={deposited:0,overflowSaved:0,memberDelivered:0,bondDelivered:0,spoiled:0,transferLoss:0,deathLost:0,routed:0,routingTransfers:0,anticipatoryDelivered:0,foodBondRescues:0});

function canonical(ids) {
 const minimum=Math.min(...ids),index=ids.indexOf(minimum);
 const forward=[...ids.slice(index),...ids.slice(0,index)];
 const reverse=[forward[0],...forward.slice(1).reverse()];
 return forward.join(':')<reverse.join(':')?forward:reverse;
}

export function closedLoops(sim) {
 const members=new Map(sim.organisms.filter(member=>member.alive).map(member=>[member.id,member]));
 const edges=[...sim.bonds.values()].filter(edge=>!edge.dormant && members.has(edge.firstId)&&members.has(edge.secondId)
  && sim.areAdjacent(members.get(edge.firstId),members.get(edge.secondId)));
 const signature=edges.map(edge=>sim.bondKey(edge.firstId,edge.secondId)).sort().join('|');
 if(sim.pantryTopologyCache?.signature!==signature) {
  const adjacency=new Map([...members.keys()].map(id=>[id,[]]));
  for(const edge of edges){adjacency.get(edge.firstId).push(edge.secondId);adjacency.get(edge.secondId).push(edge.firstId);}
  const cycles=new Map(),limit=sim.config.bond.foodPantries.maximumLoopSize;
  for(const edge of edges) {
   const queue=[[edge.firstId]],seen=new Set([edge.firstId]);let path=null;
   for(let index=0;index<queue.length && !path;index++) {
    const route=queue[index],last=route.at(-1);
    if(route.length>=limit)continue;
    for(const next of adjacency.get(last)??[]) {
     if(last===edge.firstId && next===edge.secondId)continue;
     if(next===edge.secondId){path=[...route,next];break;}
     if(seen.has(next))continue;seen.add(next);queue.push([...route,next]);
    }
   }
   if(!path || path.length<3)continue;
   const ids=canonical(path);
   // A diagonal divides a chamber; don't count both the shell and its parts.
   let chord=false;
   for(let i=0;i<ids.length;i++)for(let j=i+2;j<ids.length;j++) {
    if(i===0 && j===ids.length-1)continue;
    if(adjacency.get(ids[i]).includes(ids[j]))chord=true;
   }
   if(!chord)cycles.set(ids.join(':'),ids);
  }
  sim.pantryTopologyCache={signature,cycles:[...cycles.entries()]};
 }
 const result=[];
 for(const [key,ids] of sim.pantryTopologyCache.cycles) {
  const points=ids.map(id=>members.get(id));if(points.some(point=>!point))continue;
  // A seam-spanning loop has no honest interior in the flat canvas; skip it.
  if(points.some((point,i)=>Math.abs(point.x-points[(i+1)%points.length].x)>2 || Math.abs(point.y-points[(i+1)%points.length].y)>2))continue;
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  let crossing=false;
  for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++) {
   if(i===0 && j===points.length-1)continue;
   const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
   if(cross(a,b,c)*cross(a,b,d)<=0 && cross(c,d,a)*cross(c,d,b)<=0)crossing=true;
  }
  const area=Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.y-b.x*a.y;},0))/2;
  if(area>0 && !crossing)result.push({key,memberIds:ids,points:points.map(({x,y})=>({x,y})),area});
 }
 return result.sort((a,b)=>a.area-b.area || a.key.localeCompare(b.key));
}

function loss(sim,key,amount) {
 sim.energyEconomics.losses[key]=(sim.energyEconomics.losses[key]??0)+amount;
}

function pantryNetwork(sim) {
 const members=new Map(sim.organisms.filter(member=>member.alive).map(member=>[member.id,member]));
 const neighbors=new Map([...members.keys()].map(id=>[id,[]]));
 const edges=[];
 for(const edge of sim.bonds.values()) {
  const a=members.get(edge.firstId),b=members.get(edge.secondId);
  if(!a||!b||edge.dormant||!sim.areAdjacent(a,b))continue;
  neighbors.get(a.id).push(b);neighbors.get(b.id).push(a);edges.push(edge);
 }
 // A graph-distance advertisement from actual storage chambers, not a world
 // coordinate or environmental oracle. Food itself still moves one hop/tick.
 const distance=new Map(),queue=[];
 for(const loop of closedLoops(sim))for(const id of loop.memberIds)if(!distance.has(id)) {distance.set(id,0);queue.push(id);}
 for(let i=0;i<queue.length;i++)for(const next of neighbors.get(queue[i])??[])if(!distance.has(next.id)) {
  distance.set(next.id,distance.get(queue[i])+1);queue.push(next.id);
 }
 return {members,neighbors,edges,distance};
}

function operatingTarget(sim,member) {
 const immediate=Math.min(sim.config.bond.supportThreshold,2*Math.max(0,member.lastOperatingExpense??0));
 return sim.config.bond.foodPantries.adaptiveReuseEnabled && (member.pantryEnergyTrend??0)<-1e-9
  ? Math.max(immediate,sim.config.bond.supportThreshold) : immediate;
}

function foodMarker(sim,from,to,amount,color,kind) {
 if(sim.headlessObservationMode || amount<=.01 || (sim.pantryMarkersThisTick??0)>=8)return;
 sim.pantryMarkersThisTick=(sim.pantryMarkersThisTick??0)+1;
 sim.energyTransfers.push({fromId:from.id,toId:to.id,amount,resource:color,kind,ttl:6});
}

function routePantryFood(sim,network) {
 const {members,neighbors,distance}=network,policy=sim.config.bond.foodPantries,s=stats(sim);
 // Snapshot sending budgets: new arrivals cannot travel a second hop now.
 const budgets=new Map([...members].map(([id,member])=>[id,{...stock(member)}]));
 const capacity=sim.config.organism.foodEnergy*policy.capacityMealsPerMember;
 for(const donor of members.values()) {
  const hops=distance.get(donor.id);if(hops===undefined || hops===0)continue;
  const destinations=neighbors.get(donor.id).filter(member=>distance.get(member.id)<hops)
   .sort((a,b)=>total(stock(a))-total(stock(b)) || a.id-b.id);
  let bandwidth=policy.transferPerTick;
  for(const receiver of destinations)for(const color of COLORS) {
   const pouch=stock(donor),destination=stock(receiver),efficiency=sim.config.bond.adaptiveMorphology.flowEfficiency;
   if(efficiency<=0)continue;
   const ownNeed=color==='RED'?0:Math.max(0,operatingTarget(sim,donor)-donor.energy);
   const edible=pouch.GREEN+pouch.BLUE;
   const available=color==='RED'?pouch.RED:Math.min(pouch[color],Math.max(0,edible-ownNeed));
   const amount=Math.max(0,Math.min(budgets.get(donor.id)[color],available,bandwidth,
    (capacity-total(destination))/efficiency));
   if(!amount)continue;
   pouch[color]-=amount;budgets.get(donor.id)[color]-=amount;bandwidth-=amount;
   destination[color]+=amount*efficiency;s.routed+=amount*efficiency;s.routingTransfers++;
   s.transferLoss+=amount*(1-efficiency);loss(sim,'pantryTransfer',amount*(1-efficiency));
   foodMarker(sim,donor,receiver,amount*efficiency,color,'pantry-routing');
  }
 }
}

export function prepareFoodPantries(sim) {
 if(!pantriesEnabled(sim))return;
 const policy=sim.config.bond.foodPantries,s=stats(sim);
 sim.pantryMarkersThisTick=0;
 const network=pantryNetwork(sim),{members,neighbors,edges}=network;
 if(policy.adaptiveReuseEnabled)for(const member of members.values()) {
  const change=member.energy-(member.pantryPreviousEnergy??member.energy);
  member.pantryEnergyTrend=.8*(member.pantryEnergyTrend??0)+.2*change;
 }
 for(const member of members.values())for(const color of COLORS) {
  const pouch=stock(member),spoiled=pouch[color]*policy.spoilage[color];
  pouch[color]-=spoiled;s.spoiled+=spoiled;loss(sim,'pantrySpoilage',spoiled);
 }
 // Snapshot needs: incoming food cannot be relayed repeatedly in one tick.
 for(const member of members.values()) {
  const target=operatingTarget(sim,member);
  let need=Math.max(0,target-member.energy);
  for(const donor of [member,...neighbors.get(member.id)]) {
   const efficiency=donor===member?1:sim.config.bond.adaptiveMorphology.flowEfficiency;
   const donorNeed=donor===member?0:Math.max(0,operatingTarget(sim,donor)-donor.energy);
   for(const color of ['GREEN','BLUE']) {
    const pouch=stock(donor),available=policy.adaptiveReuseEnabled
     ? Math.min(pouch[color],Math.max(0,pouch.GREEN+pouch.BLUE-donorNeed))
     : Math.max(0,pouch[color]-donorNeed);
    const withdrawn=Math.min(available,need/efficiency);if(withdrawn<=0)continue;
    pouch[color]-=withdrawn;member.energy+=withdrawn*efficiency;need-=withdrawn*efficiency;
    s.memberDelivered+=withdrawn*efficiency;s.transferLoss+=withdrawn*(1-efficiency);
    if(target>2*(member.lastOperatingExpense??0))s.anticipatoryDelivered+=withdrawn*efficiency;
    loss(sim,'pantryTransfer',withdrawn*(1-efficiency));
    foodMarker(sim,donor,member,withdrawn*efficiency,color,'pantry-release');
   }
   if(need<=1e-9)break;
  }
 }
 // Red's modest existing calorific yield is useful as maintenance fuel. There
 // is no extra bond-strength bonus or multiplication of catalyst energy.
 const pledgedBody=new Map([...members].map(([id,member])=>[id,Math.max(0,member.energy-sim.getBondFundingFloor(member))]));
 for(const edge of edges) {
  const a=members.get(edge.firstId),b=members.get(edge.secondId);
  if(!a||!b||edge.dormant||!sim.areAdjacent(a,b))continue;
  let need=Math.max(0,sim.bondMaintenanceBuffer(edge)-(edge.reserve??0));
  for(const member of [a,b]) {
   const pouch=stock(member),withdrawn=Math.min(pouch.RED,need);
   pouch.RED-=withdrawn;edge.reserve=(edge.reserve??0)+withdrawn;need-=withdrawn;s.bondDelivered+=withdrawn;
   foodMarker(sim,member,member===a?b:a,withdrawn,'RED','pantry-maintenance');
  }
  if(policy.adaptiveReuseEnabled && need>0) {
   // First allow ordinary body surplus to pay. Only burn edible stores when
   // those resources cannot cover the next maintenance buffer.
   for(const member of [a,b]) {
    const pledge=Math.min(need,pledgedBody.get(member.id));
    pledgedBody.set(member.id,pledgedBody.get(member.id)-pledge);need-=pledge;
   }
   for(const member of [a,b])for(const color of ['BLUE','GREEN']) {
    const pouch=stock(member),ownNeed=Math.max(0,operatingTarget(sim,member)-member.energy);
    const available=Math.min(pouch[color],Math.max(0,pouch.GREEN+pouch.BLUE-ownNeed));
    const withdrawn=Math.min(available,need);if(withdrawn<=0)continue;
    pouch[color]-=withdrawn;edge.reserve=(edge.reserve??0)+withdrawn;need-=withdrawn;
    s.bondDelivered+=withdrawn;s.foodBondRescues++;
    foodMarker(sim,member,member===a?b:a,withdrawn,color,'pantry-maintenance');
   }
  }
 }
 if(policy.adaptiveReuseEnabled)routePantryFood(sim,network);
 for(const member of members.values())member.pantryPreviousEnergy=member.energy;
}

export function storeHarvest(sim,member,result) {
 if(!pantriesEnabled(sim)||!member.alive||!result.consumedEnergy||!COLORS.includes(result.consumedResource))return;
 if(sim.config.bond.foodPantries.adaptiveReuseEnabled
  ? !pantryNetwork(sim).distance.has(member.id)
  : !closedLoops(sim).some(loop=>loop.memberIds.includes(member.id)))return;
 const policy=sim.config.bond.foodPantries,pouch=stock(member),s=stats(sim);
 const capacity=sim.config.organism.foodEnergy*policy.capacityMealsPerMember;
 let room=Math.max(0,capacity-total(pouch));
 const overflow=Math.min(room,result.overflowEnergy??0,result.consumedEnergy);
 if(overflow>0) {
  result.overflowEnergy-=overflow;result.energyFlow.losses.capacityOverflow-=overflow;
  member.energyLedger.losses.capacityOverflow-=overflow;room-=overflow;s.overflowSaved+=overflow;
 }
 const surplus=Math.min(room,Math.max(0,member.energy-sim.getReproductionEnergyFloor(member)),
  Math.max(0,result.consumedEnergy-overflow)*policy.harvestFraction);
 member.energy-=surplus;
 const amount=overflow+surplus;pouch[result.consumedResource]+=amount;s.deposited+=amount;
 member.energyLedger.allocations.foodStorage=(member.energyLedger.allocations.foodStorage??0)+amount;
 sim.energyEconomics.allocations.foodStorage=(sim.energyEconomics.allocations.foodStorage??0)+amount;
}

export function loseDeadPantry(sim,member) {
 const amount=total(member.foodPantry);if(!amount)return;
 stats(sim).deathLost+=amount;loss(sim,'pantryDeath',amount);
 member.foodPantry={GREEN:0,BLUE:0,RED:0};
}

export function pantrySnapshot(sim) {
 if(!pantriesEnabled(sim))return {enabled:false};
 const loops=closedLoops(sim),assigned=new Set(),members=new Map(sim.organisms.filter(member=>member.alive).map(member=>[member.id,member]));
 const chambers=loops.map(loop=>{
  const contents={GREEN:0,BLUE:0,RED:0};
  for(const id of loop.memberIds) {
   if(assigned.has(id))continue;assigned.add(id);
   const pouch=members.get(id)?.foodPantry;
   for(const color of COLORS)contents[color]+=pouch?.[color]??0;
  }
  return {...loop,contents};
 });
 const loose=[...members.values()].filter(member=>!assigned.has(member.id)&&total(member.foodPantry)>0.01)
  .map(member=>({id:member.id,x:member.x,y:member.y,contents:{...member.foodPantry}}));
 const contents={GREEN:0,BLUE:0,RED:0};
 for(const member of members.values())for(const color of COLORS)contents[color]+=member.foodPantry?.[color]??0;
 return {enabled:true,...stats(sim),contents,stored:total(contents),chambers,loose,
  grainEnergy:sim.config.organism.foodEnergy/8};
}
