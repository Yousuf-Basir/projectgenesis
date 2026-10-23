import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {prepareFoodPantries,storeHarvest,pantrySnapshot} from '../server/simulation/food-pantries.js';
const sim=new Simulation();sim.stop();sim.headlessObservationMode=true;
Object.assign(sim.config.bond.adaptiveMorphology,{enabled:true,alignedBudgetsEnabled:true});
Object.assign(sim.config.bond.foodPantries,{enabled:true,adaptiveReuseEnabled:true,spoilage:{GREEN:0,BLUE:0,RED:0}});
sim.organisms=sim.organisms.slice(0,6);sim.bonds.clear();
const [a,b,c,relay,scout,isolated]=sim.organisms;
for(const [member,x,y] of [[a,10,10],[b,12,10],[c,11,12],[relay,8,10],[scout,6,10],[isolated,30,30]]) {
 Object.assign(member,{x,y,energy:150,lastOperatingExpense:2,foodPantry:{GREEN:0,BLUE:0,RED:0}});
}
const connect=(x,y)=>sim.bonds.set(sim.bondKey(x.id,y.id),{firstId:x.id,secondId:y.id,reserve:10,strength:1});
connect(a,b);connect(b,c);connect(c,a);connect(a,relay);connect(relay,scout);
const owned=()=>sim.organisms.reduce((sum,m)=>sum+m.energy+Object.values(m.foodPantry).reduce((x,y)=>x+y,0),0)
 +[...sim.bonds.values()].reduce((sum,e)=>sum+e.reserve,0);
scout.foodPantry.GREEN=5;const initial=owned();
prepareFoodPantries(sim);
assert.equal(a.foodPantry.GREEN,0,'food cannot cross two bonds in one tick');
assert.ok(Math.abs(relay.foodPantry.GREEN-.49)<1e-9);
assert.ok(Math.abs(initial-owned()-sim.pantryStats.transferLoss)<1e-9);
prepareFoodPantries(sim);
assert.ok(a.foodPantry.GREEN>0,'next tick food reaches the real closed chamber');
assert.ok(pantrySnapshot(sim).chambers.some(chamber=>chamber.contents.GREEN>0));
assert.ok(Math.abs(initial-owned()-sim.pantryStats.transferLoss)<1e-9);
assert.equal(isolated.foodPantry.GREEN,0,'no transfers through empty space');
// A connected scout can collect otherwise-wasted harvest for its actual core.
const harvest=()=>({consumedEnergy:8,consumedResource:'BLUE',overflowEnergy:8,energyFlow:{losses:{capacityOverflow:8}}});
const room=sim.config.organism.foodEnergy*sim.config.bond.foodPantries.capacityMealsPerMember
 -Object.values(scout.foodPantry).reduce((x,y)=>x+y,0);
scout.energyLedger.losses.capacityOverflow+=8;const result=harvest();storeHarvest(sim,scout,result);
assert.equal(result.overflowEnergy,8-Math.min(room,8));assert.equal(scout.foodPantry.BLUE,Math.min(room,8));
const detached=harvest();storeHarvest(sim,isolated,detached);assert.equal(detached.overflowEnergy,8);
// Falling energy triggers use at 20, not just the old 4-unit critical threshold.
a.energy=20;a.pantryPreviousEnergy=25;a.pantryEnergyTrend=0;a.foodPantry.GREEN=8;
prepareFoodPantries(sim);assert.equal(a.energy,sim.config.bond.supportThreshold);
assert.ok(sim.pantryStats.anticipatoryDelivered>=4);
// With no spendable body surplus or red fuel, saved blue can pay a real bill.
for(const member of sim.organisms) {
 member.energy=sim.getBondFundingFloor(member);member.pantryPreviousEnergy=member.energy;member.pantryEnergyTrend=0;
 member.foodPantry={GREEN:0,BLUE:0,RED:0};
}
a.foodPantry.BLUE=2;
for(const edge of sim.bonds.values())edge.reserve=0;
const before=owned(),lossBefore=sim.pantryStats.transferLoss;
prepareFoodPantries(sim);
assert.ok(sim.bonds.get(sim.bondKey(a.id,b.id)).reserve>sim.config.bond.maintenancePerTick);
assert.equal(sim.bonds.get(sim.bondKey(b.id,c.id)).reserve,0,'a shared component is not a remote energy wallet');
assert.ok(sim.pantryStats.foodBondRescues>0);
assert.ok(Math.abs(before-owned()-(sim.pantryStats.transferLoss-lossBefore))<1e-9);
// Opening a route stops food movement; owner-held stores do not disappear.
sim.bonds.delete(sim.bondKey(relay.id,scout.id));scout.foodPantry.GREEN=2;
prepareFoodPantries(sim);assert.equal(scout.foodPantry.GREEN,2);
sim.config.bond.foodPantries.adaptiveReuseEnabled=false;
a.energy=20;a.pantryPreviousEnergy=25;a.foodPantry.GREEN=8;
prepareFoodPantries(sim);assert.equal(a.energy,20,'legacy comparison disables anticipatory eating');
console.log('One-hop chamber routing, finite loss, scout overflow, proactive feeding, real upkeep and disconnected/legacy controls passed.');
process.exit(0);
