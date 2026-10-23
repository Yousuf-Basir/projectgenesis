import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const variant of ['without-learning','without-reshaping']) {
  const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
  const controller=new ReincarnationController({seed:160103,adaptiveMorphologyEnabled:true});
  controller.applyRecipe(simulation,controller.chooseRecipe());
  simulation.config.bond.adaptiveMorphology.learningEnabled=variant!=='without-learning';
  simulation.config.bond.adaptiveMorphology.reshapingEnabled=variant!=='without-reshaping';
  for(let tick=0;tick<1000;tick++) simulation.step();
  const row={variant,...controller.score(simulation),deathCauses:simulation.energyEconomics.deaths,morphology:simulation.morphologyStats};
  results.push(row);console.log(JSON.stringify(row));
}
await writeFile('research-results/morphology-ablation.json',JSON.stringify(results,null,2));
process.exit(0);
