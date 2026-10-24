const add = (ledger, key, value) => { ledger[key] = (ledger[key] ?? 0) + value; };

// Contact feeding, not recruitment: no movement, genome or topology is changed.
export function harvestPassingOrganisms(simulation) {
  const policy = simulation.config.bond.organismHarvest;
  if (!policy?.enabled || !simulation.usesAlignedBudgets()
    || simulation.organismHarvestTick === simulation.simulationTicks) return;
  simulation.organismHarvestTick = simulation.simulationTicks;
  const stats = simulation.organismHarvestStats ??= {
    contacts:0,withdrawn:0,delivered:0,conversionLoss:0,captureCost:0,bondFunding:0,bodyDelivered:0
  };
  const members = new Map(simulation.organisms.filter(member => member.alive).map(member => [member.id, member]));
  const linked = new Set([...simulation.bonds.values()].flatMap(edge => [edge.firstId, edge.secondId]));
  const adjacent = new Map();
  for (const edge of simulation.bonds.values()) {
    const a = members.get(edge.firstId), b = members.get(edge.secondId);
    if (!a || !b || edge.dormant || !simulation.areAdjacent(a,b)) continue;
    for (const member of [a,b]) {
      if (!adjacent.has(member.id)) adjacent.set(member.id,[]);
      adjacent.get(member.id).push(edge);
    }
  }
  const preyCells = new Map();
  for (const prey of members.values()) {
    // Use the existing survival threshold as a refuge, not an invented reward.
    if (linked.has(prey.id) || prey.energy <= simulation.config.bond.supportThreshold) continue;
    preyCells.set(`${prey.x},${prey.y}`,prey);
  }
  const visited = new Set(), harvested = new Set();
  let markers = 0;
  for (const first of adjacent.keys()) {
    if (visited.has(first)) continue;
    const group = [first]; visited.add(first);
    for (let index=0;index<group.length;index++) for (const edge of adjacent.get(group[index])) {
      const next = edge.firstId === group[index] ? edge.secondId : edge.firstId;
      if (!visited.has(next)) { visited.add(next); group.push(next); }
    }
    if (group.length < 3) continue;
    let best = null;
    // Rotate local actors so the first member does not own every encounter.
    for (let index=0;index<group.length;index++) {
      const collector = members.get(group[(index+simulation.simulationTicks)%group.length]);
      if (collector.energy <= policy.captureCost) continue;
      const capacity = simulation.config.organism.reproductionThreshold*1.8*(collector.genomeProfile.powers[3]??1);
      const goal = Math.min(capacity,simulation.getBondFundingFloor(collector));
      const edges = adjacent.get(collector.id);
      const bondNeed = edges.reduce((sum,edge)=>sum+Math.max(0,simulation.bondMaintenanceBuffer(edge)-(edge.reserve??0)),0);
      const demand = Math.max(0,goal-collector.energy)+bondNeed;
      if (demand <= 1e-9) continue; // No farming prey to fund unlimited growth.
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
        const at = simulation.world.wrapPosition(collector.x+dx,collector.y+dy);
        const prey = preyCells.get(`${at.x},${at.y}`);
        if (!prey || harvested.has(prey.id)) continue;
        const withdrawn = Math.min(policy.maximumWithdrawalPerComponentPerTick,
          prey.energy-simulation.config.bond.supportThreshold,
          (Math.max(0,goal-collector.energy+policy.captureCost)+bondNeed)/policy.efficiency);
        const delivered = withdrawn*policy.efficiency;
        if (delivered <= policy.captureCost) continue;
        if (!best || demand > best.demand) best = {collector,prey,edges,goal,demand,withdrawn,delivered};
      }
    }
    if (!best) continue;
    const {collector,prey,edges,goal,withdrawn,delivered} = best;
    harvested.add(prey.id);
    prey.energy -= withdrawn;
    collector.energy -= policy.captureCost;
    let available = delivered, bodyDelivered = 0, bondFunding = 0;
    const feed = target => {
      const amount = Math.min(available,Math.max(0,target-collector.energy));
      collector.energy += amount; available -= amount; bodyDelivered += amount;
    };
    feed(Math.min(goal,2*Math.max(0,collector.lastOperatingExpense??0)));
    for (const edge of edges) {
      const amount = Math.min(available,Math.max(0,simulation.bondMaintenanceBuffer(edge)-(edge.reserve??0)));
      edge.reserve = (edge.reserve??0)+amount; available -= amount; bondFunding += amount;
    }
    feed(goal);
    // Calculation above limits recovery to actual demand, including capture cost.
    const loss = withdrawn-bodyDelivered-bondFunding;
    add(prey.energyLedger.allocations,'organismHarvestGiven',withdrawn);
    add(collector.energyLedger.allocations,'organismHarvestReceived',bodyDelivered+bondFunding);
    add(collector.energyLedger.expenses,'organismCapture',policy.captureCost);
    add(simulation.energyEconomics.allocations,'organismHarvest',bodyDelivered+bondFunding);
    add(simulation.energyEconomics.expenses,'organismCapture',policy.captureCost);
    add(simulation.energyEconomics.losses,'organismHarvest',loss);
    stats.contacts++; stats.withdrawn+=withdrawn; stats.delivered+=bodyDelivered+bondFunding;
    stats.bodyDelivered+=bodyDelivered; stats.bondFunding+=bondFunding;
    stats.conversionLoss+=loss; stats.captureCost+=policy.captureCost;
    if (!simulation.headlessObservationMode && markers++ < 8) simulation.energyTransfers.push({
      fromId:prey.id,toId:collector.id,amount:bodyDelivered+bondFunding,ttl:6,kind:'organism-harvest'
    });
  }
}
