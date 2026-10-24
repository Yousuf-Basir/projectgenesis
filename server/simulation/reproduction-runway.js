// A local affordability forecast, not a subsidy or a prediction of future food.
export const runwayEnabled=sim=>Boolean(sim.config.bond.adaptiveMorphology?.enabled
  && sim.config.bond.reproductionRunway?.enabled);

export function reproductionRunway(sim,parent) {
  if(!runwayEnabled(sim))return {allowed:true};
  const policy=sim.config.bond.reproductionRunway;
  const byId=new Map(sim.organisms.filter(m=>m.alive).map(m=>[m.id,m]));
  const ids=new Set([parent.id]);
  // Only the parent's physical one-hop neighbourhood; no global component wallet.
  const edges=[...sim.bonds.values()].filter(e=>!e.dormant);
  for(const e of edges) {
    const other=e.firstId===parent.id?e.secondId:e.secondId===parent.id?e.firstId:null;
    if(other!==null && byId.has(other) && sim.areAdjacent(parent,byId.get(other)))ids.add(other);
  }
  const members=[...ids].map(id=>byId.get(id)).filter(Boolean);
  const costs=m=>Math.max(0,m.foragingOperatingCost??m.lastOperatingExpense??0);
  // Discount even recently earned income: a patch can run out tomorrow.
  const burn=m=>Math.max(costs(m)*.25,costs(m)-Math.max(0,m.foragingIncome??0)*.8);
  const parentCost=costs(parent),childBurn=parentCost;
  const retained=parent.energy*sim.config.organism.reproductionCostFactor;
  const horizon=policy.horizonTicks;
  const pending=(sim.reproductionRunwayBirths??[]).filter(b=>ids.has(b.parentId)&&!ids.has(b.child.id));
  const weakest=members.some(m=>m.id!==parent.id && m.energy<2*costs(m));
  const balance=members.reduce((s,m)=>s+m.energy,0)+pending.reduce((s,b)=>s+b.child.energy,0);
  const operating=members.reduce((s,m)=>s+burn(m),0)+pending.reduce((s,b)=>s+b.burn,0)+childBurn;
  const upkeep=edges.filter(e=>ids.has(e.firstId)&&ids.has(e.secondId)).length*sim.config.bond.maintenancePerTick;
  // Birth divides existing energy. Do not add the prospective child's balance
  // again. Pending children ARE added, because their debited parent is in members.
  const allowed=!weakest && retained>=horizon*Math.max(burn(parent),childBurn)
    && balance>=horizon*(operating+upkeep);
  return {allowed,balance,required:horizon*(operating+upkeep),parentCost,childBurn,weakest};
}

export function recordRunwayBirth(sim,parent,child) {
  if(!runwayEnabled(sim))return;
  sim.reproductionRunwayBirths??=[];
  sim.reproductionRunwayBirths.push({parentId:parent.id,child,
    burn:Math.max(0,parent.foragingOperatingCost??parent.lastOperatingExpense??0)});
}
