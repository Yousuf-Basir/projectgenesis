import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
import {writeFile} from 'node:fs/promises';
const variants=[
 {name:'gain-008',reshapeMinimumGain:.008},
 {name:'gain-015',reshapeMinimumGain:.015},
 {name:'gain-020',reshapeMinimumGain:.02},
 {name:'slower-succession',reshapeMinimumGain:.008,patchCapacity:480}
];
const results=[];
for(const variant of variants)for(const seed of [160103,160104,160118]) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
 const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['renewing-colonies'],{
  resourcePatchesEnabled:true,smoothFieldSensing:true,environmentNavigationBias:3},variant);
 for(let tick=0;tick<1000;tick++)simulation.step();
 const row={variant,seed,...controller.score(simulation),morphology:simulation.morphologyStats,
  relocations:simulation.resourcePatchState.relocations,deathCauses:simulation.energyEconomics.deaths,
  largestComponent:Math.max(0,...simulation.getBondGroups().map(group=>group.length))};
 results.push(row);console.log(JSON.stringify(row));await writeFile('research-results/resource-adaptation-refinement.json',JSON.stringify(results,null,2));
}
process.exit(0);
