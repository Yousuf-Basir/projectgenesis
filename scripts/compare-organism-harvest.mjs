import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
const seed=Number(process.argv[2]??160104),enabled=process.argv[3]!=='off';
const sim=new Simulation();sim.stop();sim.headlessObservationMode=true;
Object.assign(sim.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['adaptive-foraging']);
sim.config.bond.foodPantries.enabled=true;
sim.config.bond.organismHarvest.enabled=enabled;
const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});
controller.applyRecipe(sim,controller.chooseRecipe());
const rows=[];
for(let cycle=0;cycle<2;cycle++) {
  let bondTicks=0;const opening=new Set(sim.bonds.keys()),continuous=new Set(opening);
  for(let tick=1;tick<=1000;tick++) {
    sim.step();bondTicks+=sim.bonds.size;
    for(const key of continuous)if(!sim.bonds.has(key))continuous.delete(key);
    assert.ok(sim.organisms.every(m=>Number.isFinite(m.energy)&&m.energy>=0));
    const h=sim.organismHarvestStats;
    if(h){
      assert.ok(Math.abs(h.withdrawn-h.delivered-h.conversionLoss)<1e-7,'feeding must conserve energy');
      assert.ok(Math.abs(h.delivered-h.withdrawn*sim.config.bond.organismHarvest.efficiency)<1e-7,'conversion has no hidden losses');
    }
    assert.ok(sim.morphologyStats.fieldGenerated<=tick*4+1e-6);
    if([500,1000].includes(tick)) {
      rows.push({cycle,tick,population:sim.organisms.length,bonds:sim.bonds.size,bondTicks,
        inheritedOpening:opening.size,continuousInherited:continuous.size,
        harvest:h?{...h}:null,deaths:{...sim.energyEconomics.deaths},breaks:{...sim.bondBreakReasons}});
      console.log(JSON.stringify({seed,enabled,...rows.at(-1)}));
    }
  }
  controller.observe(sim);
}
await writeFile(`research-results/organism-harvest-${seed}-${enabled?'on':'off'}.json`,JSON.stringify({seed,enabled,rows},null,2));
process.exit(0);
