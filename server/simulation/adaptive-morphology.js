import { DIRECTIONS } from './config.js';
import {prepareResourcePatches, debitPatchHarvest} from './resource-patches.js';

export const MORPHOLOGY_PROFILES = {
  'original-adaptive': {name:'original-adaptive',stationaryOperatingMultiplier:.25,edgeFlow:.75,collectiveMovementInterval:5,environmentNavigationBias:0,dangerNavigationBias:0,learningEnabled:true,renewalEnabled:false,paidFormationEnabled:false,fieldDemoEnabled:false},
  'renewing-colonies': {name:'renewing-colonies',stationaryOperatingMultiplier:.18,edgeFlow:.1,collectiveMovementInterval:5,environmentNavigationBias:3,dangerNavigationBias:48,learningEnabled:false,renewalEnabled:true,paidFormationEnabled:true,fieldDemoEnabled:false}
};
MORPHOLOGY_PROFILES['adaptive-foraging']={
  ...MORPHOLOGY_PROFILES['renewing-colonies'],name:'adaptive-foraging',
  resourcePatchesEnabled:true,smoothFieldSensing:true,reshapeMinimumGain:.003,
  stockSensingWeight:0,scarcitySensingEnabled:false,fieldHarvestRoutingEnabled:false
};

function forageGrid(size=16) {
  return Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>Math.max(0,1-Math.hypot(x-4,y-6)/6,1-Math.hypot(x-12,y-10)/5)));
}

export function fieldAt(simulation, x, y) {
  const field=simulation.morphologyField;
  if (!field) return {reward:0,danger:0};
  const row=Math.min(field.size-1,Math.floor(y/simulation.world.height*field.size));
  const column=Math.min(field.size-1,Math.floor(x/simulation.world.width*field.size));
  const sample=grid=>{
    if(!simulation.config.bond.adaptiveMorphology.smoothFieldSensing)return grid[row][column];
    const gx=Math.max(0,Math.min(field.size-1,x/simulation.world.width*field.size-.5));
    const gy=Math.max(0,Math.min(field.size-1,y/simulation.world.height*field.size-.5));
    const left=Math.floor(gx),top=Math.floor(gy),right=Math.min(field.size-1,left+1),bottom=Math.min(field.size-1,top+1);
    const dx=gx-left,dy=gy-top;
    return (grid[top][left]*(1-dx)+grid[top][right]*dx)*(1-dy)+(grid[bottom][left]*(1-dx)+grid[bottom][right]*dx)*dy;
  };
  return {reward:sample(field.reward),danger:sample(field.danger),
    stock:simulation.config.bond.adaptiveMorphology.stockSensingWeight>0?sample(simulation.morphologyStock):0,row,column};
}

export function localResourceValue(simulation,x,y) {
  const at=fieldAt(simulation,x,y),policy=simulation.config.bond.adaptiveMorphology;
  return at.reward-at.danger*2+(policy.stockSensingWeight??0)*Math.min(1,at.stock/policy.cellCapacity);
}

export function foragingNeed(member,policy) {
  if(!policy.scarcitySensingEnabled || member.foragingOperatingCost===undefined)return 1;
  return Math.max(.1,Math.min(1,(member.foragingOperatingCost-member.foragingIncome)/Math.max(.01,member.foragingOperatingCost)));
}

export function setMorphologyField(simulation, reward, danger, source='custom', automatic=false) {
  const size=reward?.length;
  if (!Number.isInteger(size)||size<2||size>64) throw new Error('Field must be a square grid from 2 to 64 cells.');
  const validate=grid=>Array.isArray(grid)&&grid.length===size&&grid.every(row=>Array.isArray(row)&&row.length===size&&row.every(value=>Number.isFinite(value)&&value>=0&&value<=1));
  if (!validate(reward)||!validate(danger)) throw new Error('Reward and danger grids must match and contain numbers in [0,1].');
  simulation.morphologyField={size,reward:structuredClone(reward),danger:structuredClone(danger),source,automatic};
  simulation.morphologyStock=reward.map(row=>row.map(()=>0));
  if(!automatic){simulation.resourcePatchState=null;simulation.morphologyDemoPhase='custom';}
}

export function prepareAdaptiveMorphology(simulation) {
  const policy=simulation.config.bond.adaptiveMorphology;
  if (!policy?.enabled) return;
  simulation.morphologyStats??={moves:0,shared:0,transferLoss:0,fieldIncome:0,fieldGenerated:0,dangerCost:0};
  if (!simulation.morphologyField) {
    const size=16;
    const reward=forageGrid(size);
    setMorphologyField(simulation,reward,reward.map(row=>row.map(()=>0)),'two-resource-patches',true);
  }
  if(policy.fieldDemoEnabled && !policy.resourcePatchesEnabled && simulation.morphologyField.automatic) {
    const phase=simulation.simulationTicks<400?'forage':simulation.simulationTicks<600?'danger-shift':'recovery';
    if(phase!==simulation.morphologyDemoPhase) {
      const reward=phase==='danger-shift'?Array.from({length:16},()=>Array.from({length:16},(_,x)=>1-x/15)):forageGrid();
      const danger=reward.map(row=>row.map(value=>phase==='danger-shift'?(1-value)*.3:0));
      setMorphologyField(simulation,reward,danger,`demonstration: ${phase}`,true);
      simulation.morphologyDemoPhase=phase;
    }
  }
  prepareResourcePatches(simulation);
  const field=simulation.morphologyField;
  const sum=field.reward.flat().reduce((a,b)=>a+b,0);
  for(let y=0;y<field.size;y++) for(let x=0;x<field.size;x++) {
    const before=simulation.morphologyStock[y][x];
    simulation.morphologyStock[y][x]=Math.min(policy.cellCapacity,before+policy.fieldBudgetPerTick*field.reward[y][x]/Math.max(1,sum));
    simulation.morphologyStats.fieldGenerated+=simulation.morphologyStock[y][x]-before;
  }
  const byId=new Map(simulation.organisms.filter(member=>member.alive).map(member=>[member.id,member]));
  // One local exchange per edge per tick, conserving energy except explicit loss.
  let flowMarkers=0;
  for(const edge of simulation.bonds.values()) {
    const a=byId.get(edge.firstId),b=byId.get(edge.secondId);
    if (!a||!b||!simulation.areAdjacent(a,b)||edge.dormant) continue;
    const donor=a.energy>b.energy?a:b, receiver=donor===a?b:a;
    const donorFloor=Math.max(simulation.getReproductionEnergyFloor(donor),simulation.config.bond.supportThreshold);
    const amount=Math.min(policy.edgeFlow,Math.max(0,(donor.energy-receiver.energy)/2),Math.max(0,donor.energy-donorFloor));
    donor.energy-=amount; receiver.energy+=amount*policy.flowEfficiency;
    simulation.morphologyStats.shared+=amount*policy.flowEfficiency;
    simulation.morphologyStats.transferLoss+=amount*(1-policy.flowEfficiency);
    simulation.energyEconomics.losses.morphologyFlow=(simulation.energyEconomics.losses.morphologyFlow??0)+amount*(1-policy.flowEfficiency);
    if(!simulation.headlessObservationMode && amount>.02 && flowMarkers<12) {
      simulation.energyTransfers.push({fromId:donor.id,toId:receiver.id,amount:amount*policy.flowEfficiency,ttl:3});
      flowMarkers++;
    }
  }
  const occupied=new Set(simulation.organisms.filter(member=>member.alive).map(member=>`${member.x},${member.y}`));
  if (policy.reshapingEnabled === false) return;
  for(const ids of simulation.getBondGroups()) {
    if(ids.length<3) continue;
    // Rotate the first actor so a single member cannot monopolize reshaping.
    const member=byId.get(ids[simulation.simulationTicks%ids.length]);
    if(!member||member.energy<simulation.config.bond.supportThreshold) continue;
    const neighbours=[...simulation.bonds.values()].flatMap(edge=>edge.firstId===member.id?[byId.get(edge.secondId)]:edge.secondId===member.id?[byId.get(edge.firstId)]:[]).filter(Boolean);
    const score=(x,y)=>{
      const food=simulation.world.getTile(x,y).type==='FOOD'?1:0;
      return food+(policy.fieldSensingEnabled===false?0:localResourceValue(simulation,x,y));
    };
    const current=score(member.x,member.y);
    const choices=DIRECTIONS.map(direction=>({direction,...simulation.world.wrapPosition(member.x+direction.x,member.y+direction.y)}))
      .filter(at=>simulation.world.isWalkable(at.x,at.y)&&!occupied.has(`${at.x},${at.y}`)&&neighbours.every(other=>simulation.areAdjacent(at,other)))
      .map(at=>({...at,score:score(at.x,at.y)+(policy.learningEnabled === false ? 0 : (member.morphologyPreferences?.[at.direction.name]??0)*0.1)}))
      .sort((a,b)=>b.score-a.score);
    const choice=choices[0];
    if(!choice||choice.score<=current+policy.reshapeMinimumGain/foragingNeed(member,policy)) continue;
    occupied.delete(`${member.x},${member.y}`);
    member.x=choice.x;member.y=choice.y;occupied.add(`${member.x},${member.y}`);
    member.energy-=simulation.config.organism.moveCost;
    simulation.energyEconomics.expenses.movement+=simulation.config.organism.moveCost;
    member.energyLedger.expenses.movement+=simulation.config.organism.moveCost;
    member.lastMorphologyDirection=choice.direction.name;
    member.morphologyMoveTick=simulation.simulationTicks;
    simulation.morphologyStats.moves++;
  }
}

export function applyMorphologyEnvironment(simulation, member) {
  const policy=simulation.config.bond.adaptiveMorphology;
  if (!policy?.enabled||!member.alive) return;
  const at=fieldAt(simulation,member.x,member.y);
  const capacity=simulation.config.organism.reproductionThreshold*1.8*(member.genomeProfile.powers[3]??1);
  const harvested=Math.min(policy.maximumFieldHarvest,simulation.morphologyStock[at.row][at.column],Math.max(0,capacity-member.energy));
  simulation.morphologyStock[at.row][at.column]-=harvested;
  debitPatchHarvest(simulation,at.row,at.column,harvested);
  member.energy+=harvested;
  simulation.morphologyStats.fieldIncome+=harvested;
  simulation.energyEconomics.income.environmentField=(simulation.energyEconomics.income.environmentField??0)+harvested;
  const cost=Math.min(member.energy,at.danger*policy.dangerCost);
  member.energy-=cost;
  simulation.morphologyStats.dangerCost+=cost;
  simulation.energyEconomics.expenses.environmentDanger=(simulation.energyEconomics.expenses.environmentDanger??0)+cost;
  // A local metabolic trace, not a remembered coordinate or future-energy oracle.
  member.foragingIncome=(member.foragingIncome??0)*.95+((member.lastConsumedEnergy??0)+harvested)*.05;
  member.foragingOperatingCost=(member.foragingOperatingCost??0)*.95+((member.lastOperatingExpense??0)+cost)*.05;
  if(policy.fieldHarvestRoutingEnabled && harvested>0)routeFieldHarvest(simulation,member,harvested);
  if(policy.learningEnabled !== false && member.morphologyMoveTick===simulation.simulationTicks) {
    member.morphologyPreferences??={};
    const direction=member.lastMorphologyDirection;
    const success=harvested+ (member.lastConsumedEnergy??0)-cost;
    member.morphologyPreferences[direction]=Math.max(-1,Math.min(1,(member.morphologyPreferences[direction]??0)*0.9+Math.tanh(success)*0.1));
  }
}

export function routeFieldHarvest(simulation,source,harvested) {
  if(!source?.alive||harvested<=0)return;
  simulation.morphologyStats??={};
  const policy=simulation.config.bond.adaptiveMorphology;
  const floor=Math.max(simulation.getReproductionEnergyFloor(source),simulation.config.bond.supportThreshold);
  let remaining=harvested;
  const neighbors=[...simulation.bonds.values()].filter(edge=>!edge.dormant)
    .flatMap(edge=>edge.firstId===source.id?[edge.secondId]:edge.secondId===source.id?[edge.firstId]:[]);
  const needy=simulation.organisms.filter(member=>member.alive&&neighbors.includes(member.id)
    && simulation.areAdjacent(source,member)&&member.energy<simulation.config.bond.supportThreshold)
    .sort((a,b)=>a.energy-b.energy||a.id-b.id);
  for(const recipient of needy) {
    const spent=Math.min(remaining,Math.max(0,source.energy-floor),(simulation.config.bond.supportThreshold-recipient.energy)/policy.flowEfficiency);
    if(spent<=0)break;
    const delivered=spent*policy.flowEfficiency;
    source.energy-=spent;recipient.energy+=delivered;remaining-=spent;
    simulation.recordEnergyAllocation(source,'fieldMemberSupport',spent);
    simulation.morphologyStats.fieldMemberSupport=(simulation.morphologyStats.fieldMemberSupport??0)+delivered;
    simulation.energyEconomics.losses.fieldSupport=(simulation.energyEconomics.losses.fieldSupport??0)+spent-delivered;
    simulation.rewardUsefulBondWork(source,new Set([recipient.id]),delivered,'field-member-support');
  }
  const reserveMeal=Math.min(remaining,Math.max(0,source.energy-floor)/Math.max(1e-12,simulation.config.bond.mealEnergyFraction));
  const funding=simulation.feedAttachedBonds(source,reserveMeal).total;
  simulation.recordEnergyAllocation(source,'fieldBondReserve',funding);
  simulation.morphologyStats.fieldBondFunding=(simulation.morphologyStats.fieldBondFunding??0)+funding;
  if(funding>0)simulation.rewardUsefulBondWork(source,new Set(neighbors),funding,'field-bond-funding');
  simulation.emitCollectivePulse(source,'field-harvest',Math.min(1,harvested/10),{x:source.x,y:source.y});
}
