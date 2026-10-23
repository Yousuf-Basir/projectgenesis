import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {prepareAdaptiveMorphology, setMorphologyField, MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';

const simulation=new Simulation();
simulation.stop();
simulation.organisms=[];
simulation.bonds.clear();
Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['renewing-colonies'],{enabled:true,fieldDemoEnabled:true});
for(const [tick,phase] of [[0,'forage'],[399,'forage'],[400,'danger-shift'],[599,'danger-shift'],[600,'recovery']]) {
  simulation.simulationTicks=tick;
  prepareAdaptiveMorphology(simulation);
  assert.equal(simulation.morphologyDemoPhase,phase);
  assert.ok(simulation.morphologyStock.flat().reduce((a,b)=>a+b,0)<=simulation.config.bond.adaptiveMorphology.fieldBudgetPerTick*2+1e-8);
  assert.equal(simulation.morphologyField.danger.flat().some(value=>value>0),phase==='danger-shift');
}
const reward=[[0,1],[1,0]],danger=[[0,0],[0,1]];
setMorphologyField(simulation,reward,danger,'uploaded-test');
for(const tick of [0,400,600]) {
  simulation.simulationTicks=tick;
  prepareAdaptiveMorphology(simulation);
  assert.equal(simulation.morphologyField.source,'uploaded-test');
  assert.deepEqual(simulation.morphologyField.reward,reward);
  assert.deepEqual(simulation.morphologyField.danger,danger);
}
simulation.reset();
prepareAdaptiveMorphology(simulation);
assert.equal(simulation.morphologyField.source,'uploaded-test','manual environment must survive reset');
console.log('Demonstration phases, bounded stock and manual-image override passed.');
process.exit(0);
