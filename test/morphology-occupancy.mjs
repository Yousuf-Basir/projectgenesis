import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
const controller=new ReincarnationController({adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
for(let tick=0;tick<220;tick++) {
 simulation.step();
 const cells=simulation.organisms.map(member=>`${member.x},${member.y}`);
 assert.equal(new Set(cells).size,cells.length,`overlap at tick ${tick}`);
}
const carried=controller.captureComponent(simulation);
assert.ok(carried?.members.length);
const positions=carried.members.map(member=>`${member.x},${member.y}`);
simulation.setSeed(999);
simulation.organisms[0].x=carried.members[0].x;simulation.organisms[0].y=carried.members[0].y;
for(const member of carried.members)simulation.world.setTileType(member.x,member.y,'WALL');
controller.restoreComponent(simulation,carried);
const cells=simulation.organisms.map(member=>`${member.x},${member.y}`);
assert.equal(new Set(cells).size,cells.length);
assert.deepEqual(carried.members.map(member=>`${member.x},${member.y}`),positions);
assert.ok(carried.members.every(member=>simulation.world.isWalkable(member.x,member.y)));
console.log('Live reshaping occupancy and wall/newcomer-safe cycle carry passed.');
process.exit(0);
