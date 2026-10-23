export function supportFromNeighbourSurplus(simulation, recipient) {
  const policy = simulation.config.bond.neighbourSurplusSupport;
  if (!policy?.enabled || !recipient.alive || recipient.energy >= policy.targetEnergy) return 0;
  let received = 0;
  let budget = policy.maximumWithdrawalPerMemberPerTick;
  const edges = [...simulation.bonds.values()].filter(edge => !edge.dormant && (edge.firstId === recipient.id || edge.secondId === recipient.id));
  for (const edge of policy.donorSharingEnabled ? edges : []) {
    const donor = simulation.organisms.find(member => member.alive && member.id === (edge.firstId === recipient.id ? edge.secondId : edge.firstId));
    if (!donor || !simulation.areAdjacent(donor, recipient)) continue;
    const floor = Math.max(simulation.getReproductionEnergyFloor(donor), simulation.config.bond.supportThreshold);
    const spent = donor.surplusSupportTick === simulation.simulationTicks ? donor.surplusSupportSpent ?? 0 : 0;
    const withdrawal = Math.max(0, Math.min(donor.energy - floor,
      policy.maximumWithdrawalPerMemberPerTick - spent, budget, (policy.targetEnergy - recipient.energy) / policy.efficiency));
    if (withdrawal <= 0) continue;
    const delivered = withdrawal * policy.efficiency;
    donor.energy -= withdrawal;
    donor.surplusSupportTick = simulation.simulationTicks;
    donor.surplusSupportSpent = spent + withdrawal;
    recipient.energy += delivered;
    budget -= withdrawal;
    received += delivered;
    simulation.neighbourSupportStats.transfers += 1;
    simulation.neighbourSupportStats.delivered += delivered;
    simulation.neighbourSupportStats.lost += withdrawal - delivered;
    simulation.energyEconomics.losses.neighbourSupport = (simulation.energyEconomics.losses.neighbourSupport ?? 0) + withdrawal - delivered;
    simulation.rewardUsefulBondWork(donor, new Set([recipient.id]), delivered, 'neighbour-support');
    if (recipient.energy >= policy.targetEnergy || budget <= 0) break;
  }
  if (policy.reserveRelayEnabled && budget > 0 && recipient.energy < policy.targetEnergy) {
    const distance = new Map([[recipient.id,0]]);
    const queue = [recipient.id];
    for (let index=0; index<queue.length; index++) {
      const id = queue[index];
      if (distance.get(id) >= policy.maximumHops) continue;
      const member = simulation.organisms.find(candidate=>candidate.alive && candidate.id===id);
      for (const edge of simulation.bonds.values()) {
        if (edge.dormant) continue;
        const next = edge.firstId===id ? edge.secondId : edge.secondId===id ? edge.firstId : null;
        const partner = simulation.organisms.find(candidate=>candidate.alive && candidate.id===next);
        if (!member || !partner || distance.has(next) || !simulation.areAdjacent(member,partner)) continue;
        distance.set(next,distance.get(id)+1); queue.push(next);
      }
    }
    for (const edge of simulation.bonds.values()) {
      const hops = Math.min(distance.get(edge.firstId) ?? Infinity, distance.get(edge.secondId) ?? Infinity) + 1;
      if (edge.dormant || hops>policy.maximumHops) continue;
      const first = simulation.organisms.find(member=>member.alive && member.id===edge.firstId);
      const second = simulation.organisms.find(member=>member.alive && member.id===edge.secondId);
      if (!first || !second || !simulation.areAdjacent(first,second)) continue;
      const available = Math.max(0,(edge.reserve??0)-simulation.config.bond.supportReserveFloor);
      const spent = edge.emergencyRelayTick===simulation.simulationTicks ? edge.emergencyRelaySpent??0 : 0;
      const efficiency = policy.efficiency ** hops;
      const withdrawal = Math.max(0,Math.min(available,budget,policy.maximumWithdrawalPerMemberPerTick-spent,(policy.targetEnergy-recipient.energy)/efficiency));
      if (withdrawal<=0) continue;
      const delivered=withdrawal*efficiency;
      edge.reserve-=withdrawal;
      edge.emergencyRelayTick=simulation.simulationTicks; edge.emergencyRelaySpent=spent+withdrawal;
      recipient.energy+=delivered; received+=delivered; budget-=withdrawal;
      simulation.neighbourSupportStats.transfers++;
      simulation.neighbourSupportStats.delivered+=delivered;
      simulation.neighbourSupportStats.lost+=withdrawal-delivered;
      simulation.energyEconomics.losses.neighbourSupport=(simulation.energyEconomics.losses.neighbourSupport??0)+withdrawal-delivered;
      if (budget<=0 || recipient.energy>=policy.targetEnergy) break;
    }
  }
  return received;
}
