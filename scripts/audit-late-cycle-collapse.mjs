import {writeFile} from 'node:fs/promises';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';

// Read-only deterministic replay: does not contact or reset the live server.
const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['adaptive-foraging']);
simulation.config.bond.adaptiveMorphology.alignedBudgetsEnabled=false;
const controller=new ReincarnationController({seed:160104,adaptiveMorphologyEnabled:true});
controller.applyRecipe(simulation,controller.chooseRecipe());
const report={initialSeed:160104,profile:'adaptive-foraging',cycles:[],targetCheckpoints:[]};
const checkpoint=()=>({cycle:controller.cycle,...controller.score(simulation),
  breakReasons:{...simulation.bondBreakReasons},deaths:{...simulation.energyEconomics.deaths},
  income:{...simulation.energyEconomics.income},expenses:{...simulation.energyEconomics.expenses},
  allocations:{...simulation.energyEconomics.allocations},morphology:{...simulation.morphologyStats},
  meanEnergy:simulation.organisms.reduce((sum,member)=>sum+member.energy,0)/Math.max(1,simulation.organisms.length),
  reproducingEnergyFloor:simulation.getReproductionEnergyFloor(simulation.organisms[0]),
  coupledMembers:simulation.getCoupledIds().size,
  intervals:simulation.energyEconomics.intervals.map(item=>({tick:item.tick,population:item.population,
    income:item.income.food+item.income.gateWork+(item.income.environmentField??0),movement:item.expenses.movement,
    bonds:item.expenses.bonds,deaths:item.deathCauses})),
  recipe:{...controller.recipe}});
for(let cycle=0;cycle<=9;cycle++) {
  for(let tick=0;tick<1000;tick++) {
    simulation.step();
    if(cycle===9 && [99,199,299,399,499,599,699,799,899,939,999].includes(tick)) {
      const row=checkpoint();report.targetCheckpoints.push(row);
      console.log(JSON.stringify({cycle,tick:tick+1,population:row.population,bonds:row.bonds,breakReasons:row.breakReasons,deaths:row.deaths}));
      await writeFile('research-results/late-cycle-collapse-audit.json',JSON.stringify(report,null,2));
    }
  }
  const row=checkpoint();report.cycles.push(row);
  console.log(JSON.stringify({cycle,population:row.population,bonds:row.bonds,breakReasons:row.breakReasons,deaths:row.deaths}));
  await writeFile('research-results/late-cycle-collapse-audit.json',JSON.stringify(report,null,2));
  controller.observe(simulation);
}
process.exit(0);
