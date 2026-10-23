import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const scarcity of [false,true])for(const seed of [160103,160104,160118]) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
 const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['renewing-colonies'],{
  resourcePatchesEnabled:true,smoothFieldSensing:true,environmentNavigationBias:3,reshapeMinimumGain:.003,stockSensingWeight:0,scarcitySensingEnabled:scarcity,fieldHarvestRoutingEnabled:true});
 for(let tick=0;tick<1000;tick++)simulation.step();
 const row={scarcity,seed,...controller.score(simulation),morphology:simulation.morphologyStats,
  relocations:simulation.resourcePatchState.relocations,deathCauses:simulation.energyEconomics.deaths,
  largestComponent:Math.max(0,...simulation.getBondGroups().map(group=>group.length))};
 results.push(row);console.log(JSON.stringify(row));await writeFile('research-results/field-harvest-routing-search.json',JSON.stringify(results,null,2));
}
process.exit(0);
