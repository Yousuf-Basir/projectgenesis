export function updateEnergyConservation(simulation) {
  const policy = simulation.config.bond.energyConservation;
  for (const member of simulation.organisms) member.energyConserving = false;
  if (!policy?.enabled) return;
  const previous = simulation.conservationHistory ?? new Map();
  const next = new Map();
  for (const ids of simulation.getBondGroups()) {
    if (ids.length < 3) continue;
    const members = simulation.organisms.filter(member => member.alive && ids.includes(member.id));
    if (!members.length) continue;
    const key = simulation.componentReserveKey(ids);
    const energy = members.reduce((sum, member) => sum + member.energy, 0) / members.length;
    const prior = previous.get(key);
    const declining = prior && energy < prior.energy;
    const samples = declining ? (prior.samples ?? 0) + 1 : 0;
    const low = energy < simulation.config.bond.supportThreshold * policy.entryEnergyMultiplier;
    const stay = prior?.active && energy < simulation.config.bond.supportThreshold * policy.exitEnergyMultiplier;
    const active = Boolean((low && samples >= policy.decliningTicks) || stay);
    next.set(key, { energy, samples, active });
    if (!active) continue;
    // Periodic full activity provides a bounded escape from a barren site.
    const probe = simulation.simulationTicks % policy.periodTicks < policy.probeTicks;
    const cue = members.some(member => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const at = simulation.world.wrapPosition(member.x + dx, member.y + dy);
        if (simulation.world.getTile(at.x, at.y).type === 'FOOD') return true;
      }
      return simulation.workGates.some(gate => !gate.exhausted && gate.energyStock > 0 && simulation.distanceToGate(member, gate) <= 3);
    });
    if (probe || cue) continue;
    for (const member of members) member.energyConserving = true;
    simulation.conservationMemberTicks = (simulation.conservationMemberTicks ?? 0) + members.length;
  }
  simulation.conservationHistory = next;
}
