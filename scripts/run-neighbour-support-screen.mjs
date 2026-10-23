import { Simulation } from '../server/simulation/simulation.js';
import { ReincarnationController } from '../server/simulation/reincarnation.js';
import { writeFile } from 'node:fs/promises';
const results = [];
for (const enabled of [false, true]) {
  const simulation = new Simulation(); simulation.stop(); simulation.headlessObservationMode = true;
  const controller = new ReincarnationController();
  controller.applyRecipe(simulation, controller.chooseRecipe());
  simulation.config.bond.neighbourSurplusSupport.enabled = enabled;
  for (let tick=0; tick<1000; tick++) simulation.step();
  const deaths = simulation.starvationDiagnostics;
  results.push({enabled, ...controller.score(simulation), deathsByCause:simulation.energyEconomics.deaths,
    support:simulation.neighbourSupportStats,
    starvation:{isolated:deaths.filter(record=>!record.bonded).length,
      bonded:deaths.filter(record=>record.bonded).length,
      neighbourSurplus:deaths.filter(record=>record.neighbourSurplus>0).length,
      componentAccessibleReserve:deaths.filter(record=>record.componentAccessibleReserve>0).length}});
  console.log(JSON.stringify(results.at(-1)));
}
await writeFile('research-results/neighbour-support-screen.json', JSON.stringify(results,null,2));
process.exit(0);
