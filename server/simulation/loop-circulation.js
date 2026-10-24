import {closedLoops,settlePantryMaintenance} from './food-pantries.js';

export const circulationEnabled=sim=>Boolean(sim.config.bond.adaptiveMorphology?.enabled && sim.config.bond.loopCirculation?.enabled);
const stats=sim=>(sim.loopCirculationStats??={passes:0,compartmentTicks:0,memberTicks:0,overlapSkips:0,
  delivered:0,loss:0,edgeEnergyHops:0,starvationAvoided:0,closureGuidedMoves:0,usefulClosures:0});
const capacity=(sim,m)=>Math.max(m.energy,sim.config.organism.reproductionThreshold*1.8
  *(m.genomeProfile.powers[3]??1)*(sim.config.organism.energyCapacityMultiplier??1));

// Find a common final level, not a sequence of pairwise transfers. Donors pay
// the declared loss; caps may leave low-capacity members below the common level.
export function equalizedBalances(energies,capacities,efficiency) {
  if(!(efficiency>0 && efficiency<=1))throw new Error('Circulation efficiency must be in (0,1].');
  if(!energies.length || Math.max(...energies)-Math.min(...energies)<1e-12)
    return {balances:[...energies],withdrawn:0,delivered:0,loss:0};
  let low=0,high=Math.max(0,...capacities);
  for(let iteration=0;iteration<56;iteration++) {
    const level=(low+high)/2;
    let required=0,available=0;
    for(let i=0;i<energies.length;i++) {
      const delta=Math.min(capacities[i],level)-energies[i];
      if(delta>0)required+=delta;else available-=delta;
    }
    if(required>available*efficiency)high=level;else low=level;
  }
  const balances=energies.map((_,i)=>Math.min(capacities[i],(low+high)/2));
  const withdrawn=energies.reduce((sum,e,i)=>sum+Math.max(0,e-balances[i]),0);
  const delivered=energies.reduce((sum,e,i)=>sum+Math.max(0,balances[i]-e),0);
  return {balances,withdrawn,delivered,loss:Math.max(0,withdrawn-delivered)};
}

export function prepareLoopCirculation(sim) {
  sim.loopCirculationPlan=[];sim.loopCirculationMembers=new Set();sim.loopCirculationLast=[];
  if(!circulationEnabled(sim))return;
  // Fast transport is available only on paid physical connections. Reserve
  // funding is an internal debit; the ordinary maintenance burn still occurs once.
  const policy=sim.config.bond.loopCirculation,s=stats(sim);
  const loops=closedLoops(sim).filter(loop=>loop.memberIds.length<=policy.maximumMembers)
    .sort((a,b)=>a.key.localeCompare(b.key));
  const offset=loops.length?sim.simulationTicks%loops.length:0;
  for(let i=0;i<loops.length;i++) {
    const loop=loops[(i+offset)%loops.length];
    if(loop.memberIds.some(id=>sim.loopCirculationMembers.has(id))){s.overlapSkips++;continue;}
    const edgeKeys=new Set(loop.memberIds.map((id,j)=>sim.bondKey(id,loop.memberIds[(j+1)%loop.memberIds.length])));
    sim.fundExistingBondReserves(edgeKeys);settlePantryMaintenance(sim,edgeKeys);
    if([...edgeKeys].some(key=>(sim.bonds.get(key)?.reserve??0)+1e-9<sim.config.bond.maintenancePerTick))continue;
    sim.loopCirculationPlan.push(loop);
    for(const id of loop.memberIds)sim.loopCirculationMembers.add(id);
  }
}

function routeOnLoop(ids,from,to) {
  const start=ids.indexOf(from),end=ids.indexOf(to),n=ids.length;
  const clockwise=(end-start+n)%n,anticlockwise=n-clockwise,step=clockwise<=anticlockwise?1:-1;
  const route=[from];for(let i=start;i!==end;){i=(i+step+n)%n;route.push(ids[i]);}return route;
}

export function applyLoopCirculation(sim) {
  if(!circulationEnabled(sim)||sim.loopCirculationAppliedTick===sim.simulationTicks)return;
  sim.loopCirculationAppliedTick=sim.simulationTicks;
  const policy=sim.config.bond.loopCirculation,s=stats(sim);
  const byId=new Map(sim.organisms.filter(m=>m.alive).map(m=>[m.id,m]));
  let markers=0;s.passes++;
  for(const loop of sim.loopCirculationPlan??[]) {
    const members=loop.memberIds.map(id=>byId.get(id));
    if(members.some(m=>!m)||members.some((m,i)=>{
      const other=members[(i+1)%members.length],edge=sim.bonds.get(sim.bondKey(m.id,other.id));
      return !edge||edge.dormant||!sim.areAdjacent(m,other)||(edge.reserve??0)+1e-9<sim.config.bond.maintenancePerTick;
    }))continue; // No revival after age death or circulation through a broken loop.
    const opening=members.map(m=>m.energy);
    const result=equalizedBalances(opening,members.map(m=>capacity(sim,m)),policy.efficiency);
    const donors=members.map((m,i)=>({m,amount:Math.max(0,opening[i]-result.balances[i])}));
    const receivers=members.map((m,i)=>({m,amount:Math.max(0,result.balances[i]-opening[i])}));
    // Apply the entire immutable plan at once. No member can participate again.
    for(let i=0;i<members.length;i++)members[i].energy=result.balances[i];
    for(const donor of donors) {
      const lost=donor.amount*(1-policy.efficiency);
      donor.m.energyLedger.losses.loopCirculation=(donor.m.energyLedger.losses.loopCirculation??0)+lost;
      for(const receiver of receivers) {
        const gross=Math.min(donor.amount,receiver.amount/policy.efficiency);
        if(gross<=1e-9)continue;
        const delivered=gross*policy.efficiency;donor.amount-=gross;receiver.amount-=delivered;
        const route=routeOnLoop(loop.memberIds,donor.m.id,receiver.m.id);
        for(let i=0;i<route.length-1;i++) {
          const a=byId.get(route[i]),b=byId.get(route[i+1]);
          const edge=sim.bonds.get(sim.bondKey(a.id,b.id));
          edge.circulationWork=(edge.circulationWork??0)+delivered;
          sim.rewardUsefulBondWork(a,new Set([b.id]),delivered,'loop-circulation');
          s.edgeEnergyHops+=delivered;
          if(!sim.headlessObservationMode && markers++<12)sim.energyTransfers.push({
            fromId:a.id,toId:b.id,amount:delivered,kind:'loop-circulation',ttl:3});
        }
      }
    }
    sim.energyEconomics.losses.loopCirculation=(sim.energyEconomics.losses.loopCirculation??0)+result.loss;
    s.compartmentTicks++;s.memberTicks+=members.length;s.delivered+=result.delivered;s.loss+=result.loss;
    sim.loopCirculationLast.push({key:loop.key,memberIds:loop.memberIds,delivered:result.delivered,
      loss:result.loss,spread:Math.max(...result.balances)-Math.min(...result.balances),
      capacityLimited:result.balances.some(value=>value+1e-8<Math.max(...result.balances))});
  }
}

function graph(sim) {
  const byId=new Map(sim.organisms.filter(m=>m.alive).map(m=>[m.id,m]));
  const neighbors=new Map([...byId.keys()].map(id=>[id,[]])),degree=new Map();
  for(const edge of sim.bonds.values()) {
    for(const id of [edge.firstId,edge.secondId])degree.set(id,(degree.get(id)??0)+1);
    const a=byId.get(edge.firstId),b=byId.get(edge.secondId);
    if(!a||!b||edge.dormant||!sim.areAdjacent(a,b))continue;
    neighbors.get(a.id).push(b.id);neighbors.get(b.id).push(a.id);
  }
  return {byId,neighbors,degree};
}

function closurePath(sim,first,second,context) {
  const policy=sim.config.bond.loopCirculation;
  if(sim.bonds.has(sim.bondKey(first.id,second.id)))return null;
  const queue=[[first.id]],seen=new Set([first.id]);
  for(let i=0;i<queue.length;i++) {
    const route=queue[i];if(route.length>=policy.maximumMembers)continue;
    for(const next of context.neighbors.get(route.at(-1))??[]) {
      if(next===second.id)return route.length>=2?[...route,next]:null;
      if(!seen.has(next)){seen.add(next);queue.push([...route,next]);}
    }
  }
  return null;
}

function simplePolygon(points) {
  let area=0;
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length];
    if(Math.abs(a.x-b.x)>2||Math.abs(a.y-b.y)>2)return false;
    area+=a.x*b.y-b.x*a.y;
    for(let j=i+2;j<points.length;j++) {
      if(i===0&&j===points.length-1)continue;
      const c=points[j],d=points[(j+1)%points.length];
      if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0)return false;
    }
  }
  return Math.abs(area)>1e-9;
}

function benefit(sim,member,other,x,y,context) {
  const path=closurePath(sim,member,other,context);if(!path)return 0;
  const members=path.map(id=>context.byId.get(id));
  if(!simplePolygon(members.map(m=>m.id===member.id?{x,y}:m)))return 0;
  const energies=members.map(m=>m.energy),floors=members.map(m=>sim.getBondFundingFloor(m));
  const before=energies.reduce((sum,e,i)=>sum+Math.max(0,floors[i]-e),0);
  if(before<=0)return 0;
  const result=equalizedBalances(energies,members.map(m=>capacity(sim,m)),sim.config.bond.loopCirculation.efficiency);
  const after=result.balances.reduce((sum,e,i)=>sum+Math.max(0,floors[i]-e),0);
  const cost=sim.config.bond.initialReserve+2*sim.config.bond.maintenancePerTick+result.loss
    +((member.x!==x||member.y!==y)?sim.config.organism.moveCost:0);
  return Math.max(0,Math.min(1,(before-after-cost)/Math.max(1,before)));
}

export function closurePreferenceAt(sim,member,x,y) {
  const policy=sim.config.bond.loopCirculation;
  if(!circulationEnabled(sim)||!policy.closureEnabled||!member.genomeProfile.traits.canCouple
    ||!(member.brainExecution?.effectors.bind>=.35))return 0;
  if(sim.loopClosureContext?.tick!==sim.simulationTicks)sim.loopClosureContext={tick:sim.simulationTicks,...graph(sim)};
  const context=sim.loopClosureContext,maxDegree=sim.config.bond.adaptiveMorphology.maximumDegree;
  if((context.degree.get(member.id)??0)>=maxDegree)return 0;
  let score=0;
  for(const other of context.byId.values()) {
    if(other.id===member.id||!(other.brainExecution?.effectors.bind>=.35)
      ||(context.degree.get(other.id)??0)>=maxDegree||!sim.areAdjacent({x,y},other))continue;
    score=Math.max(score,benefit(sim,member,other,x,y,context));
  }
  return score*policy.closureBias;
}

export function noteUsefulClosure(sim,first,second) {
  if(!circulationEnabled(sim)||!sim.config.bond.loopCirculation.closureEnabled)return;
  if(benefit(sim,first,second,first.x,first.y,graph(sim))>0)stats(sim).usefulClosures++;
}

export function noteClosureMove(sim) { stats(sim).closureGuidedMoves++; }
