import assert from 'node:assert/strict';
import { updateEnergyConservation } from '../server/simulation/energy-conservation.js';
const policy = {enabled:true, entryEnergyMultiplier:2, exitEnergyMultiplier:3, decliningTicks:8, periodTicks:10, probeTicks:2};
let food = false;
const simulation = {config:{bond:{supportThreshold:24,energyConservation:policy}}, simulationTicks:5,
  organisms:[1,2,3].map(id=>({id,alive:true,energy:20,x:id,y:1})), workGates:[],
  getBondGroups:()=>[[1,2,3]], componentReserveKey:ids=>ids.join(':'),
  world:{wrapPosition:(x,y)=>({x,y}),getTile:()=>({type:food?'FOOD':'EMPTY'})},
  conservationHistory:new Map([['1:2:3',{energy:21,samples:7}]])};
updateEnergyConservation(simulation);
assert.ok(simulation.organisms.every(member=>member.energyConserving));
simulation.simulationTicks=10; updateEnergyConservation(simulation);
assert.ok(simulation.organisms.every(member=>!member.energyConserving),'periodic wake');
simulation.simulationTicks=15; food=true; updateEnergyConservation(simulation);
assert.ok(simulation.organisms.every(member=>!member.energyConserving),'food wakes');
food=false; simulation.workGates=[{exhausted:false,energyStock:2}]; simulation.distanceToGate=()=>2;
updateEnergyConservation(simulation);
assert.ok(simulation.organisms.every(member=>!member.energyConserving),'available gate wakes');
simulation.workGates=[]; simulation.organisms.forEach(member=>member.energy=80);
updateEnergyConservation(simulation);
assert.ok(simulation.organisms.every(member=>!member.energyConserving),'recovery exits conservation');
policy.enabled=false; simulation.organisms.forEach(member=>member.energyConserving=true);
updateEnergyConservation(simulation);
assert.ok(simulation.organisms.every(member=>!member.energyConserving),'disabled clears flags');
console.log('Conservation entry, periodic probing, food/gate wake, energy recovery and disabling passed.');
