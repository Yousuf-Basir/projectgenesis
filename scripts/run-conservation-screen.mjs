import { Simulation } from '../server/simulation/simulation.js';
import { ReincarnationController } from '../server/simulation/reincarnation.js';
import { writeFile } from 'node:fs/promises';
const results = [];
for (const enabled of [false, true]) {
  const simulation = new Simulation(); simulation.stop(); simulation.headlessObservationMode = true;
  const controller = new ReincarnationController();
  controller.applyRecipe(simulation, controller.chooseRecipe());
  simulation.config.bond.energyConservation.enabled = enabled;
  for (let tick=0; tick<1000; tick++) simulation.step();
  results.push({enabled, ...controller.score(simulation), expenses:simulation.energyEconomics.expenses,
    deathsByCause:simulation.energyEconomics.deaths, conservationMemberTicks:simulation.conservationMemberTicks});
  console.log(JSON.stringify(results.at(-1)));
}
await writeFile('research-results/conservation-screen.json', JSON.stringify(results,null,2));
process.exit(0);
