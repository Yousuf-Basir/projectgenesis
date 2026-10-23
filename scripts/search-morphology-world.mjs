import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {writeFile} from 'node:fs/promises';
const variants=[
  {name:'current',stationaryOperatingMultiplier:.25,edgeFlow:.75,collectiveMovementInterval:5,environmentNavigationBias:0,learningEnabled:true},
  {name:'balanced',stationaryOperatingMultiplier:.25,edgeFlow:.25,collectiveMovementInterval:3,environmentNavigationBias:3,learningEnabled:false},
  {name:'frugal',stationaryOperatingMultiplier:.12,edgeFlow:.25,collectiveMovementInterval:3,environmentNavigationBias:3,learningEnabled:false},
  {name:'mobile',stationaryOperatingMultiplier:.25,edgeFlow:.25,collectiveMovementInterval:1,environmentNavigationBias:5,learningEnabled:false},
  {name:'gentle',stationaryOperatingMultiplier:.18,edgeFlow:.1,collectiveMovementInterval:5,environmentNavigationBias:3,learningEnabled:false},
  {name:'learned',stationaryOperatingMultiplier:.18,edgeFlow:.25,collectiveMovementInterval:3,environmentNavigationBias:3,learningEnabled:true}
];
const results=[];
for(const variant of variants) for(const seed of [160103,160104]) {
  const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
  const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});
  controller.applyRecipe(simulation,controller.chooseRecipe());
  Object.assign(simulation.config.bond.adaptiveMorphology,variant);
  const lifetimes=new Map();const ended=[];
  for(let tick=0;tick<600;tick++) {
    simulation.step();
    for(const key of simulation.bonds.keys()) if(!lifetimes.has(key))lifetimes.set(key,tick);
    for(const [key,born] of lifetimes) if(!simulation.bonds.has(key)){ended.push(tick-born);lifetimes.delete(key);}
  }
  const groups=simulation.getBondGroups();
  const row={variant,seed,...controller.score(simulation),deathCauses:simulation.energyEconomics.deaths,
    largestComponent:Math.max(0,...groups.map(group=>group.length)),
    survivingBondMeanAge:[...lifetimes.values()].reduce((sum,born)=>sum+600-born,0)/Math.max(1,lifetimes.size),
    longestBondAge:Math.max(0,...[...lifetimes.values()].map(born=>600-born)),morphology:simulation.morphologyStats};
  results.push(row);console.log(JSON.stringify(row));
  await writeFile('research-results/morphology-search.json',JSON.stringify(results,null,2));
}
process.exit(0);
