import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {prepareAdaptiveMorphology,applyMorphologyEnvironment,setMorphologyField} from '../server/simulation/adaptive-morphology.js';
const simulation=new Simulation();simulation.stop();
simulation.config.bond.adaptiveMorphology.enabled=true;
simulation.organisms=simulation.organisms.slice(0,3);
simulation.organisms.forEach((member,index)=>{member.x=10+index%2;member.y=10+Math.floor(index/2);member.energy=index?10:250;});
simulation.bonds.clear();
for(const [i,j] of [[0,1],[1,2],[2,0]]) {
  const first=simulation.organisms[i],second=simulation.organisms[j];
  simulation.bonds.set(simulation.bondKey(first.id,second.id),{firstId:first.id,secondId:second.id,reserve:5,strength:1});
}
const zeros=()=>Array.from({length:4},()=>Array(4).fill(0));
assert.throws(()=>setMorphologyField(simulation,[[NaN]],[[0]]));
setMorphologyField(simulation,zeros(),zeros());
const total=()=>simulation.organisms.reduce((sum,member)=>sum+member.energy,0);
const before=total();
prepareAdaptiveMorphology(simulation);
assert.ok(simulation.morphologyStats.shared>0);
assert.ok(Math.abs(before-total()-simulation.morphologyStats.transferLoss-simulation.energyEconomics.expenses.movement)<1e-8);
assert.ok([...simulation.bonds.values()].every(edge=>simulation.areAdjacent(simulation.organisms.find(m=>m.id===edge.firstId),simulation.organisms.find(m=>m.id===edge.secondId))));
const ones=zeros().map(row=>row.map(()=>1));
setMorphologyField(simulation,ones,zeros());prepareAdaptiveMorphology(simulation);
for(const member of simulation.organisms) applyMorphologyEnvironment(simulation,member);
assert.ok(simulation.morphologyStats.fieldIncome<=simulation.morphologyStats.fieldGenerated+1e-9);
const member=simulation.organisms[0];
setMorphologyField(simulation,zeros(),ones);const prior=member.energy;
applyMorphologyEnvironment(simulation,member);
assert.equal(prior-member.energy,simulation.config.bond.adaptiveMorphology.dangerCost);
simulation.bondCandidates.clear();
simulation.removeInvalidBonds();
assert.equal(simulation.bonds.size,3,'paid adjacent bonds survive transient binding dips');
for(const edge of simulation.bonds.values()) {edge.reserve=0;edge.strength=0.001;}
simulation.config.bond.dormantBonds.enabled=false;
simulation.removeInvalidBonds();
assert.equal(simulation.bonds.size,0,'unfunded bonds still fail');
console.log('Conservative flow, paid motion, adjacency preservation, bounded external field and danger debit checks passed.');
process.exit(0);
