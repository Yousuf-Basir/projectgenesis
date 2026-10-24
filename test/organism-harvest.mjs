import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {harvestPassingOrganisms} from '../server/simulation/organism-harvest.js';
const sim = new Simulation();sim.stop();sim.headlessObservationMode=true;
Object.assign(sim.config.bond.adaptiveMorphology,{enabled:true,alignedBudgetsEnabled:true});
sim.config.bond.organismHarvest.enabled=true;
sim.organisms=sim.organisms.slice(0,5);sim.bonds.clear();
const [a,b,c,prey,remote]=sim.organisms;
for(const [member,x,y] of [[a,10,10],[b,11,10],[c,10,11],[prey,9,10],[remote,35,35]]) {
  Object.assign(member,{x,y,energy:150,lastOperatingExpense:1});
}
const connect=(x,y)=>sim.bonds.set(sim.bondKey(x.id,y.id),{firstId:x.id,secondId:y.id,reserve:3,strength:1});
connect(a,b);connect(b,c);connect(c,a);
const owned=()=>sim.organisms.reduce((sum,m)=>sum+m.energy,0)+[...sim.bonds.values()].reduce((sum,e)=>sum+e.reserve,0);
const links=[...sim.bonds.keys()],position=[prey.x,prey.y];
harvestPassingOrganisms(sim);assert.equal(prey.energy,150,'healthy structures do not feed needlessly');
a.energy=30;for(const e of sim.bonds.values())e.reserve=0;
sim.simulationTicks++;const before=owned();harvestPassingOrganisms(sim);
assert.equal(prey.energy,146);assert.equal(remote.energy,150,'no distant energy theft');
assert.ok(a.energy>30);assert.ok(sim.bonds.get(sim.bondKey(a.id,b.id)).reserve>0,'harvest pays threatened bonds');
assert.deepEqual([...sim.bonds.keys()],links,'no forced recruitment');assert.deepEqual([prey.x,prey.y],position);
assert.ok(Math.abs(before-owned()-sim.organismHarvestStats.conversionLoss-sim.organismHarvestStats.captureCost)<1e-9);
assert.ok(Math.abs(sim.organismHarvestStats.withdrawn-sim.organismHarvestStats.delivered-sim.organismHarvestStats.conversionLoss)<1e-9);
assert.ok(Math.abs(sim.organismHarvestStats.delivered-sim.organismHarvestStats.withdrawn*.8)<1e-9,'no unallocated recovered energy');
harvestPassingOrganisms(sim);assert.equal(prey.energy,146,'component and prey caps hold across repeated same-tick calls');
prey.energy=sim.config.bond.supportThreshold;sim.simulationTicks++;harvestPassingOrganisms(sim);
assert.equal(prey.energy,sim.config.bond.supportThreshold,'prey survival refuge');
prey.energy=150;connect(prey,remote);sim.simulationTicks++;harvestPassingOrganisms(sim);
assert.equal(prey.energy,150,'bonded organisms are not prey, even with a separated bond');
sim.bonds.delete(sim.bondKey(prey.id,remote.id));
sim.config.bond.organismHarvest.enabled=false;sim.simulationTicks++;harvestPassingOrganisms(sim);assert.equal(prey.energy,150);
sim.config.bond.organismHarvest.enabled=true;
// A well-fed collector can directly fund its threatened edges without storing
// an extra capture refund above its body goal or losing recovered energy.
for(const member of [a,b,c])member.energy=150;
for(const edge of sim.bonds.values())edge.reserve=0;
const oldWithdrawn=sim.organismHarvestStats.withdrawn,oldDelivered=sim.organismHarvestStats.delivered;
sim.simulationTicks++;harvestPassingOrganisms(sim);
assert.ok(sim.organismHarvestStats.delivered>oldDelivered);
assert.ok(Math.abs((sim.organismHarvestStats.delivered-oldDelivered)
 -(sim.organismHarvestStats.withdrawn-oldWithdrawn)*.8)<1e-9);
const afterFeeding=prey.energy;
prey.x=40;sim.simulationTicks++;harvestPassingOrganisms(sim);assert.equal(prey.energy,afterFeeding,'passing out of contact stops feeding');
prey.x=9;for(const e of sim.bonds.values())e.dormant=true;
sim.simulationTicks++;harvestPassingOrganisms(sim);assert.equal(prey.energy,afterFeeding,'dormant structures cannot feed');
const snapshot=sim.getSnapshot().bonding.organismHarvest;
assert.equal(snapshot.captureCostPerContact,.1);
assert.equal(snapshot.captureCost,sim.organismHarvestStats.captureCost,'cumulative cost is separate from per-contact price');
console.log('Contact-only paid harvest, finite conversion, prey refuge, direct bond funding, no recruitment, caps and off/dormant controls passed.');
process.exit(0);
