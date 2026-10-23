import assert from 'node:assert/strict';
import { supportFromNeighbourSurplus } from '../server/simulation/neighbour-support.js';
const donor={id:1,alive:true,energy:50}; const recipient={id:2,alive:true,energy:0};
const policy={enabled:true,donorSharingEnabled:true,targetEnergy:6,maximumWithdrawalPerMemberPerTick:1.5,efficiency:0.85};
const simulation={config:{bond:{neighbourSurplusSupport:policy,supportThreshold:24}},organisms:[donor,recipient],
  bonds:new Map([['1:2',{firstId:1,secondId:2}]]), simulationTicks:1,areAdjacent:()=>true,
  getReproductionEnergyFloor:()=>40,neighbourSupportStats:{transfers:0,delivered:0,lost:0},
  energyEconomics:{losses:{}},rewardUsefulBondWork:()=>{}};
const delivered=supportFromNeighbourSurplus(simulation,recipient);
assert.equal(delivered,1.275);
assert.ok(Math.abs(donor.energy+recipient.energy+simulation.neighbourSupportStats.lost-50)<1e-9);
supportFromNeighbourSurplus(simulation,recipient);
assert.equal(donor.energy,48.5,'per donor per tick cap');
simulation.simulationTicks++; donor.energy=40;
assert.equal(supportFromNeighbourSurplus(simulation,recipient),0,'protect reproduction floor');
donor.energy=50; simulation.bonds.get('1:2').dormant=true;
assert.equal(supportFromNeighbourSurplus(simulation,recipient),0,'dormant edge cannot transfer');
simulation.bonds.get('1:2').dormant=false; policy.enabled=false;
assert.equal(supportFromNeighbourSurplus(simulation,recipient),0);
console.log('Neighbour support conservation, donor floor, tick cap, dormancy and disabling passed.');
policy.enabled=true; policy.donorSharingEnabled=false; policy.reserveRelayEnabled=true; policy.maximumHops=4;
simulation.config.bond.supportReserveFloor=1.5;
recipient.energy=0;
const far={id:3,alive:true,energy:1}; simulation.organisms.push(far);
simulation.bonds.get('1:2').reserve=1.5;
simulation.bonds.set('1:3',{firstId:1,secondId:3,reserve:5});
const before=donor.energy+recipient.energy+far.energy+6.5;
const lossBefore=simulation.neighbourSupportStats.lost;
supportFromNeighbourSurplus(simulation,recipient);
assert.ok(recipient.energy>0,'remote reserve must reach hungry member');
const after=donor.energy+recipient.energy+far.energy+[...simulation.bonds.values()].reduce((sum,bond)=>sum+bond.reserve,0);
assert.ok(Math.abs(before-after-(simulation.neighbourSupportStats.lost-lossBefore))<1e-9);
assert.ok(simulation.bonds.get('1:3').reserve>=1.5);
recipient.energy=0; simulation.simulationTicks++; simulation.bonds.get('1:2').dormant=true;
assert.equal(supportFromNeighbourSurplus(simulation,recipient),0,'dormant connector stops reserve relay');
console.log('Remote reserve delivery, conversion losses, reserve floor and dormant connector checks passed.');
