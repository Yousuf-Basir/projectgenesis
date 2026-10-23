import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
import {pantrySnapshot} from '../server/simulation/food-pantries.js';
const seed=Number(process.argv[2]??160104),aligned=process.argv[3]!=='off';
const label=process.argv[4]??(aligned?'endowment':'off');
const sim=new Simulation();sim.stop();sim.headlessObservationMode=true;
Object.assign(sim.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['adaptive-foraging'],{alignedBudgetsEnabled:aligned});
sim.config.bond.foodPantries.enabled=process.argv[5]==='pantry';
if(process.argv[6]!==undefined)sim.config.bond.foodPantries.harvestFraction=Number(process.argv[6]);
const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(sim,controller.chooseRecipe());
const rows=[];let inherited=[];
for(let cycle=0;cycle<2;cycle++) {
 const openingPantry=pantrySnapshot(sim).stored??0;
 for(let tick=1;tick<=1000;tick++) {
  sim.step();
  assert.ok(sim.organisms.every(member=>Number.isFinite(member.energy)));
  assert.ok(sim.morphologyStats.fieldGenerated<=tick*4+1e-6,'external field budget unchanged');
  if([200,500,1000].includes(tick)) {
   const pantry=pantrySnapshot(sim);
   if(pantry.enabled)assert.ok(Math.abs(openingPantry+pantry.deposited-pantry.memberDelivered-pantry.bondDelivered
    -pantry.transferLoss-pantry.spoiled-pantry.deathLost-pantry.stored)<1e-6,'pantry ledger must balance including carry, spoilage and deaths');
   if(!aligned && cycle===0 && tick===1000) {
    const reference={160104:[166,201],160121:[51,66]}[seed];
    if(reference)assert.deepEqual([sim.organisms.length,sim.bonds.size],reference,'disabled mode must reproduce the committed reference');
   }
   const row={cycle,tick,...controller.score(sim),breaks:{...sim.bondBreakReasons},deaths:{...sim.energyEconomics.deaths},
    bondFunding:sim.energyEconomics.allocations.bondFunding,emergencyShared:sim.morphologyStats.emergencyShared??0,renewalBirths:sim.morphologyStats.renewalBirths??0,
    inheritedEdgesRemaining:inherited.filter(key=>sim.bonds.has(key)).length};
   if(pantry.enabled)row.pantry={opening:openingPantry,stored:pantry.stored,deposited:pantry.deposited,
    overflowSaved:pantry.overflowSaved,memberDelivered:pantry.memberDelivered,bondDelivered:pantry.bondDelivered,
    spoiled:pantry.spoiled,deathLost:pantry.deathLost,transferLoss:pantry.transferLoss,contents:pantry.contents,
    closedChambers:pantry.chambers.length,filledChambers:pantry.chambers.filter(c=>Object.values(c.contents).some(v=>v>.01)).length};
   rows.push(row);console.log(JSON.stringify({seed,aligned,...row}));
   await writeFile(`research-results/aligned-budgets-${seed}-${label}.json`,JSON.stringify({seed,aligned,label,rows},null,2));
  }
 }
 controller.observe(sim);
 inherited=[...sim.bonds.keys()];
 // Next world's inherited IDs are remapped: capture after transition, not before.
 // Lifetime continuity is separately checked by boundary conservation tests.
}
process.exit(0);
