import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
function run(speed,headless) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=headless;
 const controller=new ReincarnationController({seed:160104,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['renewing-colonies']);simulation.setSpeed(speed);
 for(let tick=0;tick<180;tick++)simulation.step();
 return {organisms:simulation.organisms.map(member=>[member.id,member.x,member.y,member.energy,member.genome]),
 bonds:[...simulation.bonds.values()],tiles:simulation.world.serializeTiles(),income:simulation.energyEconomics.income};
}
assert.deepEqual(run(1,false),run(50,true));
console.log('Display speed and omitted canvas-only observation do not change physical outcomes per tick.');
process.exit(0);
