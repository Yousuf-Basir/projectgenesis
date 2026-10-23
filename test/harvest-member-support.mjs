import assert from 'node:assert/strict';
import { shareFreshHarvest } from '../server/simulation/harvest-member-support.js';
const source={id:1,alive:true,energy:100}; const hungry={id:2,alive:true,energy:0}; const isolated={id:3,alive:true,energy:0};
const simulation={config:{bond:{harvestMemberSupport:{enabled:true,maximumMealFraction:0.25,efficiency:0.98},supportThreshold:24}},
  organisms:[source,hungry,isolated],bonds:new Map([['1:2',{firstId:1,secondId:2}]]),
  getReproductionEnergyFloor:()=>40,areAdjacent:()=>true,gateFieldCycles:[],harvestSupportStats:{transfers:0,delivered:0,lost:0},
  energyEconomics:{losses:{}},rewardUsefulBondWork:()=>{}};
let result=shareFreshHarvest(simulation,source,20);
assert.equal(result.withdrawn,5); assert.equal(result.delivered,4.9);
assert.equal(isolated.energy,0);
assert.ok(Math.abs(source.energy+hungry.energy+simulation.harvestSupportStats.lost-100)<1e-9);
source.energy=41; result=shareFreshHarvest(simulation,source,20);
assert.equal(source.energy,40); assert.equal(result.withdrawn,1);
source.energy=100; simulation.bonds.get('1:2').dormant=true;
assert.equal(shareFreshHarvest(simulation,source,20).withdrawn,0);
simulation.bonds.get('1:2').dormant=false; simulation.config.bond.harvestMemberSupport.enabled=false;
assert.equal(shareFreshHarvest(simulation,source,20).withdrawn,0);
console.log('Fresh-harvest conservation, meal cap, source floor, connected recipients, dormancy and switch checks passed.');
