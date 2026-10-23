import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
const results=[];
for(const [seed,expectedPopulation,expectedBonds] of [[160104,166,201],[160121,51,66]]) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
 Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['adaptive-foraging']);
 simulation.config.bond.adaptiveMorphology.alignedBudgetsEnabled=false;
 const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 let endpoint;
 for(let tick=0;tick<1200;tick++) {
  simulation.step();
  assert.equal(new Set(simulation.organisms.map(member=>`${member.x},${member.y}`)).size,simulation.organisms.length,'occupied cells must remain unique');
  if(tick===999) {
   endpoint={...controller.score(simulation),morphology:{...simulation.morphologyStats},carried:controller.captureComponent(simulation)?.members.length??0};
   assert.equal(endpoint.population,expectedPopulation);assert.equal(endpoint.bonds,expectedBonds);
  }
  controller.observe(simulation);
 }
 const row={seed,endpoint,after200InNextWorld:{...controller.score(simulation),seed:simulation.seed,inheritance:controller.inheritance,profile:simulation.config.bond.adaptiveMorphology.name},
  fieldEnergyWithinBudget:simulation.morphologyStats.fieldGenerated<=simulation.simulationTicks*4+1e-7};
 assert.ok(row.fieldEnergyWithinBudget);
 results.push(row);console.log(JSON.stringify(row));await writeFile('research-results/selected-foraging-verification.json',JSON.stringify(results,null,2));
}
process.exit(0);
