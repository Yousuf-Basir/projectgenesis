// Forecast uses only observed component energy; it cannot predict future food.
export function shrinkAtRiskComponents(simulation) {
  const policy = simulation.config.bond.adaptiveShrinking;
  if (!policy?.enabled) return;
  simulation.shrinkHistory ??= new Map();
  simulation.shrinkStats ??= { reclaimed: 0, energyRecovered: 0, energyLost: 0 };
  const active = new Set();
  for (const ids of simulation.getBondGroups()) {
    if (ids.length <= policy.minimumRemainingMembers) continue;
    const members = simulation.organisms.filter(member => member.alive && ids.includes(member.id));
    if (members.length !== ids.length) continue;
    const key = simulation.componentReserveKey(ids);
    active.add(key);
    const edges = [...simulation.bonds.entries()].filter(([, bond]) => ids.includes(bond.firstId) && ids.includes(bond.secondId));
    const total = members.reduce((sum, member) => sum + Math.max(0, member.energy), 0)
      + (simulation.componentReserves.get(key) ?? 0) + edges.reduce((sum, [, bond]) => sum + (bond.reserve ?? 0), 0);
    const previous = simulation.shrinkHistory.get(key);
    simulation.shrinkHistory.set(key, { total, samples: (previous?.samples ?? 0) + 1,
      drain: previous ? 0.8 * (previous.drain ?? 0) + 0.2 * (previous.total - total) : 0 });
    const trend = simulation.shrinkHistory.get(key);
    if (trend.samples < policy.minimumSamples || trend.drain <= 0 || total / trend.drain > policy.forecastTicks) continue;
    if (!members.some(member => member.energy < simulation.config.bond.supportThreshold)) continue;
    if (members.some(member => member.age - (member.lastShrinkAge ?? -Infinity) < policy.cooldownTicks)) continue;
    const candidates = members.filter(member => edges.filter(([, bond]) => bond.firstId === member.id || bond.secondId === member.id).length === 1)
      .sort((a, b) => (a.nodeTrace ?? 0) - (b.nodeTrace ?? 0) || a.energy - b.energy);
    const terminal = candidates.find(member => member.energy > 0);
    if (!terminal) continue;
    const [edgeKey, edge] = edges.find(([, bond]) => bond.firstId === terminal.id || bond.secondId === terminal.id);
    const neighbour = members.find(member => member.id === (edge.firstId === terminal.id ? edge.secondId : edge.firstId));
    if (!simulation.areAdjacent(terminal, neighbour)) continue;
    const stored = terminal.energy + (edge.reserve ?? 0);
    const capacity = simulation.config.organism.reproductionThreshold * 1.8 * (neighbour.genomeProfile.powers[3] ?? 1);
    const recovered = Math.min(stored * policy.recoveryEfficiency, Math.max(0, capacity - neighbour.energy));
    if (recovered <= 0) continue;
    neighbour.energy += recovered;
    terminal.energy = 0;
    terminal.alive = false;
    terminal.deathReason = 'adaptive reclamation';
    simulation.bonds.delete(edgeKey);
    simulation.bondsBroken += 1;
    simulation.bondBreakReasons['adaptive reclamation'] = (simulation.bondBreakReasons['adaptive reclamation'] ?? 0) + 1;
    const remaining = members.filter(member => member !== terminal);
    for (const member of remaining) member.lastShrinkAge = member.age;
    const reserve = simulation.componentReserves.get(key);
    simulation.componentReserves.delete(key);
    if (reserve !== undefined) simulation.componentReserves.set(simulation.componentReserveKey(remaining.map(member => member.id)), reserve);
    simulation.bondGroupsCache = null;
    simulation.shrinkStats.reclaimed += 1;
    simulation.shrinkStats.energyRecovered += recovered;
    simulation.shrinkStats.energyLost += stored - recovered;
    simulation.energyEconomics.losses.reclamation = (simulation.energyEconomics.losses.reclamation ?? 0) + stored - recovered;
    simulation.recordTelemetry('adaptive-shrink', `Reclaimed terminal #${terminal.id}; delivered ${recovered.toFixed(2)} energy to #${neighbour.id}.`);
  }
  for (const key of simulation.shrinkHistory.keys()) if (!active.has(key)) simulation.shrinkHistory.delete(key);
}
