export function shareFreshHarvest(simulation, source, mealEnergy) {
  const policy = simulation.config.bond.harvestMemberSupport;
  const result = { withdrawn: 0, delivered: 0, external: 0 };
  if (!policy?.enabled || mealEnergy <= 0 || !source.alive) return result;
  const linked = new Set([...simulation.bonds.values()].filter(edge => !edge.dormant)
    .flatMap(edge => edge.firstId === source.id ? [edge.secondId] : edge.secondId === source.id ? [edge.firstId] : []));
  const recipients = simulation.organisms.filter(member => member.alive && linked.has(member.id)
    && member.energy < simulation.config.bond.supportThreshold && simulation.areAdjacent(source, member))
    .sort((a,b) => a.energy-b.energy || a.id-b.id);
  const floor = Math.max(simulation.getReproductionEnergyFloor(source), simulation.config.bond.supportThreshold);
  let budget = Math.min(mealEnergy * policy.maximumMealFraction, Math.max(0, source.energy-floor));
  const cycle = simulation.gateFieldCycles.find(item => item.endedTick === null && Object.hasOwn(item.memberStartEnergy, source.id));
  for (const recipient of recipients) {
    const withdrawn = Math.min(budget, (simulation.config.bond.supportThreshold-recipient.energy)/policy.efficiency);
    if (withdrawn <= 0) break;
    const delivered = withdrawn * policy.efficiency;
    source.energy -= withdrawn; recipient.energy += delivered; budget -= withdrawn;
    result.withdrawn += withdrawn; result.delivered += delivered;
    if (cycle && !Object.hasOwn(cycle.memberStartEnergy,recipient.id)) result.external += delivered;
    simulation.harvestSupportStats.transfers++;
    simulation.harvestSupportStats.delivered += delivered;
    simulation.harvestSupportStats.lost += withdrawn-delivered;
    simulation.energyEconomics.losses.harvestSupport = (simulation.energyEconomics.losses.harvestSupport??0)+withdrawn-delivered;
    simulation.rewardUsefulBondWork(source,new Set([recipient.id]),delivered,'harvest-member-support');
  }
  return result;
}
