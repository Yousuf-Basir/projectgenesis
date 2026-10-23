import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const seed of [160103,160104]) for(const enabled of process.env.GENESIS_REFINE==='1'?[true]:[false,true]) {
  const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
  const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:enabled});
  controller.applyRecipe(simulation,controller.chooseRecipe());
  for(let cycle=0;cycle<2;cycle++) {
    for(let tick=0;tick<1000;tick++) simulation.step();
    const carried=controller.captureComponent(simulation);
    const row={seed,enabled,cycle,...controller.score(simulation),deaths:simulation.energyEconomics.deaths,
      morphology:{...simulation.morphologyStats},carriedMembers:carried?.members.length??0,carriedBonds:carried?.bonds.length??0};
    results.push(row);console.log(JSON.stringify(row));
    controller.observe(simulation);
  }
}
await writeFile(process.env.GENESIS_REFINE==='1'?'research-results/adaptive-morphology-refined.json':'research-results/adaptive-morphology-screen.json',JSON.stringify(results,null,2));
process.exit(0);
