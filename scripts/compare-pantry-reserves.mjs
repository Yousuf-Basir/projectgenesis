import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
import {pantrySnapshot} from '../server/simulation/food-pantries.js';
const seed=Number(process.argv[2]??160104),enabled=process.argv[3]!=='off';
const sim=new Simulation();sim.stop();sim.headlessObservationMode=true;
Object.assign(sim.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['adaptive-foraging']);
Object.assign(sim.config.bond.foodPantries,{enabled:true,reliableReservesEnabled:enabled});
sim.config.bond.organismHarvest.enabled=true; // Match the running demo, not an unrelated preset.
const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(sim,controller.chooseRecipe());
let opening=pantrySnapshot(sim).stored,peakStored=opening,ticksWithStores=0,maxSampledStocked=0;
const rows=[];
for(let elapsed=1;elapsed<=1200;elapsed++) {
 sim.step();
 assert.ok(sim.organisms.every(m=>Number.isFinite(m.energy)&&m.energy>=0));
 const stored=sim.organisms.reduce((sum,m)=>sum+Object.values(m.foodPantry??{}).reduce((a,b)=>a+b,0),0);
 peakStored=Math.max(peakStored,stored);if(stored>.01)ticksWithStores++;
 if(sim.simulationTicks%100===0) {
  const p=pantrySnapshot(sim);
  maxSampledStocked=Math.max(maxSampledStocked,p.stockedChambers);
  assert.ok(Math.abs(opening+p.deposited-p.stored-p.memberDelivered-p.bondDelivered-p.transferLoss-p.spoiled-p.deathLost)<1e-6,'complete pantry ledger, including cycle carry, must balance');
  if([200,500,800,1000].includes(sim.simulationTicks)) {
   rows.push({elapsed,cycle:controller.cycle,tick:sim.simulationTicks,population:sim.organisms.length,bonds:sim.bonds.size,
    chambers:p.chambers.length,stocked:p.stockedChambers,stored:p.stored,deposited:p.deposited,
    overflowSaved:p.overflowSaved,surplusSaved:p.surplusSaved,memberDelivered:p.memberDelivered,
    bondDelivered:p.bondDelivered,lateBondDelivered:p.lateBondDelivered,demandRouted:p.demandRouted,
    breaks:{...sim.bondBreakReasons},deaths:{...sim.energyEconomics.deaths}});
   console.log(JSON.stringify({seed,enabled,...rows.at(-1)}));
  }
 }
 if(controller.observe(sim))opening=pantrySnapshot(sim).stored;
}
const result={seed,enabled,organismHarvest:true,ticks:1200,peakStored,ticksWithStores,maxSampledStocked,rows};
await writeFile(`research-results/pantry-reserves-${seed}-${enabled?'on':'off'}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({seed,enabled,peakStored,ticksWithStores,maxSampledStocked}));
process.exit(0);
