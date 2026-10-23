import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {readFile,writeFile} from 'node:fs/promises';
const screen=JSON.parse(await readFile('research-results/morphology-search.json','utf8'));
const variants=['frugal','gentle','learned'].map(name=>screen.find(row=>row.variant.name===name)?.variant).filter(Boolean);
if(variants.length!==3) throw new Error('Wait for screening to finish.');
const results=[];
for(const variant of variants) for(const seed of [160103,160104,160117]) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
 const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 Object.assign(simulation.config.bond.adaptiveMorphology,variant);
 const born=new Map();
 for(let tick=0;tick<1000;tick++) {
  simulation.step();
  for(const key of simulation.bonds.keys()) if(!born.has(key))born.set(key,tick);
  for(const key of born.keys()) if(!simulation.bonds.has(key))born.delete(key);
 }
 const row={variant,seed,...controller.score(simulation),deathCauses:simulation.energyEconomics.deaths,
 largestComponent:Math.max(0,...simulation.getBondGroups().map(group=>group.length)),
 survivingBondMeanAge:[...born.values()].reduce((sum,tick)=>sum+1000-tick,0)/Math.max(1,born.size),
 longestBondAge:Math.max(0,...[...born.values()].map(tick=>1000-tick)),morphology:simulation.morphologyStats};
 results.push(row);console.log(JSON.stringify(row));
 await writeFile('research-results/morphology-validation.json',JSON.stringify(results,null,2));
}
process.exit(0);
