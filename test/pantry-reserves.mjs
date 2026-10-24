import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {prepareFoodPantries,storeHarvest,settlePantryMaintenance,pantrySnapshot} from '../server/simulation/food-pantries.js';
const sim=new Simulation();sim.stop();sim.headlessObservationMode=true;
Object.assign(sim.config.bond.adaptiveMorphology,{enabled:true,alignedBudgetsEnabled:true});
Object.assign(sim.config.bond.foodPantries,{enabled:true,adaptiveReuseEnabled:true,reliableReservesEnabled:true,
  spoilage:{GREEN:0,BLUE:0,RED:0}});
sim.config.bond.componentReserveEconomy.enabled=false;
sim.organisms=sim.organisms.slice(0,7);sim.bonds.clear();
const [a,b,c,r1,r2,tail,isolated]=sim.organisms;
for(const [m,x,y] of [[a,10,10],[b,12,10],[c,11,12],[r1,8,10],[r2,6,10],[tail,4,10],[isolated,40,40]]) {
  Object.assign(m,{x,y,energy:150,lastOperatingExpense:1,foodPantry:{GREEN:0,BLUE:0,RED:0},
    brainExecution:{effectors:{bind:0}}});
}
const connect=(x,y,reserve=3)=>sim.bonds.set(sim.bondKey(x.id,y.id),{firstId:x.id,secondId:y.id,reserve,strength:.005});
connect(a,b);connect(b,c);connect(c,a);
const meal=()=>({consumedEnergy:10,consumedResource:'GREEN',overflowEnergy:0,energyFlow:{losses:{capacityOverflow:0}}});
const owned=()=>sim.organisms.reduce((sum,m)=>sum+m.energy+Object.values(m.foodPantry).reduce((x,y)=>x+y,0),0)
 +[...sim.bonds.values()].reduce((sum,e)=>sum+e.reserve,0);
let before=owned();storeHarvest(sim,a,meal());
assert.equal(a.foodPantry.GREEN,1.5,'a surplus meal saves 15% even before capacity overflow');
assert.equal(owned(),before);assert.equal(sim.pantryStats.surplusSaved,1.5);
a.energy=sim.getReproductionEnergyFloor(a);const saved=a.foodPantry.GREEN;storeHarvest(sim,a,meal());
assert.equal(a.foodPantry.GREEN,saved,'do not tax the reproduction/survival budget');
const out=meal();storeHarvest(sim,isolated,out);assert.equal(isolated.foodPantry.GREEN,0,'no invented chamber');
// Start-of-tick body pledges cannot excuse a late unpaid bill.
for(const m of [a,b,c]) {m.energy=150;m.foodPantry={GREEN:0,BLUE:1,RED:0};}
for(const e of sim.bonds.values())e.reserve=0;
prepareFoodPantries(sim);
assert.equal(sim.pantryStats.bondDelivered,0,'available body surplus initially covers the pledge');
for(const m of [a,b,c])m.energy=sim.getBondFundingFloor(m);
before=owned();const paid=sim.pantryStats.bondDelivered;
sim.updateBonds();
assert.equal(sim.bonds.size,3,'late food must keep these otherwise-unfunded bonds alive');
assert.ok([...sim.bonds.values()].every(e=>e.reserve>=sim.config.bond.maintenancePerTick-1e-9));
assert.ok(sim.pantryStats.lateBondDelivered>0);
assert.ok(Math.abs(sim.pantryStats.bondDelivered-paid-.24)<1e-9);
assert.ok(Math.abs(before-owned()-.12)<1e-9,'only actual upkeep disappears');
const last=sim.pantryStats.lateBondDelivered;settlePantryMaintenance(sim);const once=sim.pantryStats.lateBondDelivered;
settlePantryMaintenance(sim);assert.equal(sim.pantryStats.lateBondDelivered,once,'no overfilling paid bills');
assert.ok(once>=last);
// Demand can draw food outward from a chamber, still one physical hop/tick.
for(const m of sim.organisms) {m.energy=150;m.foodPantry={GREEN:0,BLUE:0,RED:0};}
for(const e of sim.bonds.values())e.reserve=3;
connect(a,r1);connect(r1,r2);connect(r2,tail,0);
r2.energy=sim.getBondFundingFloor(r2);tail.energy=sim.getBondFundingFloor(tail);
a.foodPantry.BLUE=2;before=owned();const lossBefore=sim.pantryStats.transferLoss;
prepareFoodPantries(sim);
assert.ok(r1.foodPantry.BLUE>0);assert.equal(r2.foodPantry.BLUE,0,'no instant delivery across two bonds');
prepareFoodPantries(sim);
assert.ok(r2.foodPantry.BLUE>0,'next tick food reaches the threatened edge endpoint');
settlePantryMaintenance(sim);
assert.ok(sim.bonds.get(sim.bondKey(r2.id,tail.id)).reserve>0,'outward-routed food really pays the bill');
assert.ok(sim.pantryStats.demandRouted>0);
assert.ok(Math.abs(before-owned()-(sim.pantryStats.transferLoss-lossBefore))<1e-9);
assert.equal(pantrySnapshot(sim).stockedChambers,pantrySnapshot(sim).chambers.filter(c=>Object.values(c.contents).some(v=>v>.01)).length);
// Separate switches retain the previous overflow-only physics.
sim.config.bond.foodPantries.reliableReservesEnabled=false;
a.energy=150;a.foodPantry={GREEN:0,BLUE:0,RED:0};storeHarvest(sim,a,meal());
assert.equal(a.foodPantry.GREEN,0);
const delivered=sim.pantryStats.lateBondDelivered;for(const e of sim.bonds.values())e.reserve=0;
settlePantryMaintenance(sim);assert.equal(sim.pantryStats.lateBondDelivered,delivered);
sim.config.bond.foodPantries.reliableReservesEnabled=true;sim.config.bond.foodPantries.adaptiveReuseEnabled=false;
storeHarvest(sim,a,meal());assert.equal(a.foodPantry.GREEN,0,'legacy reuse off also disables the new surplus-savings default');
console.log('Surplus saving, protected budgets, final unpaid-bill rescue, outward one-hop demand, conservation and legacy controls passed.');
process.exit(0);
