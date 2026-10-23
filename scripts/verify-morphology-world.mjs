import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {writeFile} from 'node:fs/promises';
const variants=[
 {name:'corrected-current',stationaryOperatingMultiplier:.25,edgeFlow:.75,collectiveMovementInterval:5,environmentNavigationBias:0,learningEnabled:true},
 {name:'corrected-gentle',stationaryOperatingMultiplier:.18,edgeFlow:.1,collectiveMovementInterval:5,environmentNavigationBias:3,learningEnabled:false},
 {name:'renewing',stationaryOperatingMultiplier:.18,edgeFlow:.1,collectiveMovementInterval:5,environmentNavigationBias:3,learningEnabled:false,renewalEnabled:true,paidFormationEnabled:true},
 {name:'renewing-memory',stationaryOperatingMultiplier:.18,edgeFlow:.1,collectiveMovementInterval:5,environmentNavigationBias:3,learningEnabled:true,renewalEnabled:true,paidFormationEnabled:true}
];
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
 await writeFile('research-results/morphology-verification.json',JSON.stringify(results,null,2));
}
process.exit(0);
