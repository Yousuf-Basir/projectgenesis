import assert from 'node:assert/strict';
import { Simulation } from '../server/simulation/simulation.js';

const simulation = new Simulation();
simulation.stop();
simulation.config.bond.usefulWorkReward.enabled = true;
simulation.organisms = simulation.organisms.slice(0, 3);
const [source, recipient, unrelated] = simulation.organisms;
source.x = 10; source.y = 10;
recipient.x = 11; recipient.y = 10;
unrelated.x = 11; unrelated.y = 11;
simulation.bonds.clear();
for (const [a, b] of [[source, recipient], [recipient, unrelated], [source, unrelated]]) {
  simulation.bonds.set(simulation.bondKey(a.id, b.id), {firstId:a.id, secondId:b.id, reserve:5, strength:1, componentCommitment:0});
}
source.energy = 200; recipient.energy = 1; unrelated.energy = 1;
simulation.getFacets = () => [{memberIds: simulation.organisms.map(member => member.id)}];
const sum = () => simulation.organisms.reduce((total, member) => total + member.energy, 0);
const before = sum();
const sharing = simulation.shareFacetEnergy(source, 10);
assert.ok(sharing.total > 0);
assert.ok(Math.abs(sum() - before) < 1e-8, 'reward must conserve physical energy');
assert.ok(source.energy >= simulation.getReproductionEnergyFloor(source));
const edge = simulation.bonds.get(simulation.bondKey(source.id, recipient.id));
assert.ok(edge.componentCommitment > 0);
assert.equal(simulation.bonds.get(simulation.bondKey(recipient.id, unrelated.id)).componentCommitment, 0);
simulation.rewardUsefulBondWork(source, new Set([recipient.id]), 100, 'gate-harvest');
simulation.rewardUsefulBondWork(source, new Set([recipient.id]), 100, 'gate-harvest');
assert.ok(edge.workRewardGain <= simulation.config.bond.usefulWorkReward.maximumGainPerBondPerTick);
const credit = edge.componentCommitment;
simulation.config.bond.usefulWorkReward.enabled = false;
simulation.rewardUsefulBondWork(source, new Set([recipient.id]), 100, 'gate-harvest');
assert.equal(edge.componentCommitment, credit);
console.log('Useful work rewards conserve energy, respect donor floor, target participating edges, cap gains, and switch off.');
process.exit(0);
