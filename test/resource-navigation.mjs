import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {setMorphologyField,localResourceValue} from '../server/simulation/adaptive-morphology.js';
const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
Object.assign(simulation.config.bond.adaptiveMorphology,{enabled:true,smoothFieldSensing:true,environmentNavigationBias:3});
simulation.config.collectiveWork.navigation.enabled=false;
simulation.organisms=simulation.organisms.slice(0,4);simulation.bonds.clear();
for(let y=17;y<25;y++)for(let x=17;x<25;x++)simulation.world.setTileType(x,y,'EMPTY');
simulation.organisms.forEach((member,index)=>{
 member.x=20+index%2;member.y=20+Math.floor(index/2);member.energy=100;
 member.brainExecution={effectors:{move:1,direction:{N:0,E:0,S:0,W:0}}};
});
for(const [i,j] of [[0,1],[1,3],[3,2],[2,0]]) {
 const a=simulation.organisms[i],b=simulation.organisms[j];
 simulation.bonds.set(simulation.bondKey(a.id,b.id),{firstId:a.id,secondId:b.id,strength:1,reserve:5});
}
const reward=Array.from({length:16},()=>Array.from({length:16},(_,x)=>x/15));
const zeros=reward.map(row=>row.map(()=>0));
setMorphologyField(simulation,reward,zeros);
const before=simulation.organisms.map(member=>member.x);
simulation.simulationTicks=5;simulation.moveCompounds();
assert.deepEqual(simulation.organisms.map(member=>member.x),before.map(x=>x+1),'local cue must guide movement toward rising reward');
setMorphologyField(simulation,reward.map(row=>row.map(value=>1-value)),zeros);
simulation.simulationTicks=10;simulation.moveCompounds();
assert.deepEqual(simulation.organisms.map(member=>member.x),before,'reversing the cue must reverse the response');
assert.equal(simulation.bonds.size,4);
assert.ok([...simulation.bonds.values()].every(edge=>simulation.areAdjacent(simulation.organisms.find(m=>m.id===edge.firstId),simulation.organisms.find(m=>m.id===edge.secondId))));
setMorphologyField(simulation,zeros,zeros);
simulation.config.bond.adaptiveMorphology.stockSensingWeight=1;
simulation.morphologyStock=reward.map(row=>row.map(value=>value*12));
assert.ok(localResourceValue(simulation,24,20)>localResourceValue(simulation,20,20),'stored energy can be sensed independently of replenishment intensity');
console.log('Local cue reversal, topology-preserving movement and optional stock sensing passed (controlled fixture).');
process.exit(0);
