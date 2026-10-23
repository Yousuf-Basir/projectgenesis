import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {prepareAdaptiveMorphology,applyMorphologyEnvironment,setMorphologyField} from '../server/simulation/adaptive-morphology.js';

function make(seed=160104) {
 const simulation=new Simulation();simulation.stop();simulation.setSeed(seed);simulation.stop();
 simulation.organisms=simulation.organisms.slice(0,1);simulation.bonds.clear();
 Object.assign(simulation.config.bond.adaptiveMorphology,{enabled:true,resourcePatchesEnabled:true,smoothFieldSensing:true,reshapingEnabled:false,patchCapacity:240});
 prepareAdaptiveMorphology(simulation);return simulation;
}
const a=make(),b=make(),c=make(160105);
assert.deepEqual(a.resourcePatchState.patches,b.resourcePatchState.patches,'same seed must reproduce environment');
assert.notDeepEqual(a.resourcePatchState.patches,c.resourcePatchState.patches,'different seed must vary environment');
const patches=structuredClone(a.resourcePatchState.patches);
for(let tick=0;tick<500;tick++){a.simulationTicks=tick;prepareAdaptiveMorphology(a);}
assert.deepEqual(a.resourcePatchState.patches,patches,'elapsed time alone must not deplete or relocate patches');
assert.equal(a.random(),b.random(),'environment preparation must not consume organism RNG');
const member=a.organisms[0];member.energy=10;
const before=member.energy;const capacityBefore=a.resourcePatchState.patches.reduce((sum,patch)=>sum+patch.remaining,0);
applyMorphologyEnvironment(a,member);
assert.ok(member.energy>before,'field stock must actually be harvested');
assert.ok(Math.abs(capacityBefore-a.resourcePatchState.patches.reduce((sum,patch)=>sum+patch.remaining,0)-(member.energy-before))<1e-8);
a.resourcePatchState.patches[0].remaining=0;
prepareAdaptiveMorphology(a);
assert.equal(a.resourcePatchState.relocations,1);
assert.ok(Math.hypot(a.resourcePatchState.patches[0].x-patches[0].x,a.resourcePatchState.patches[0].y-patches[0].y)>=16*.4);
assert.ok(a.morphologyStats.fieldIncome<=a.morphologyStats.fieldGenerated+1e-8);
setMorphologyField(a,[[0,1],[1,0]],[[0,0],[0,0]],'manual');
prepareAdaptiveMorphology(a);
assert.equal(a.resourcePatchState,null);assert.equal(a.morphologyField.source,'manual');
console.log('Consumption-only depletion, seeded relocation, finite income and image override passed.');
process.exit(0);
