import { Simulation } from '../server/simulation/simulation.js';
import { ReincarnationController } from '../server/simulation/reincarnation.js';
import { writeFile } from 'node:fs/promises';
const results=[];
for (const seed of [160103,160104]) for (const enabled of [false,true]) {
  const simulation=new Simulation(); simulation.stop(); simulation.headlessObservationMode=true;
  const controller=new ReincarnationController({seed}); controller.applyRecipe(simulation,controller.chooseRecipe());
  simulation.config.bond.harvestMemberSupport.enabled=enabled;
  for (let tick=0;tick<1000;tick++) simulation.step();
  const row={seed,enabled,...controller.score(simulation),deathCauses:simulation.energyEconomics.deaths,support:simulation.harvestSupportStats};
  results.push(row); console.log(JSON.stringify(row));
}
await writeFile('research-results/harvest-support-screen.json',JSON.stringify(results,null,2));
process.exit(0);
