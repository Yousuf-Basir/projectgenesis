import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {equalizedBalances,prepareLoopCirculation,applyLoopCirculation,closurePreferenceAt} from '../server/simulation/loop-circulation.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert.deepEqual(equalizedBalances([90,30,15],[200,200,200],1).balances,[45,45,45]);
assert.deepEqual(equalizedBalances([160,20,20,20],[200,200,200,200],1).balances,[55,55,55,55]);
const capped=equalizedBalances([150,0,0],[200,20,200],1).balances;
close(capped[0],65);close(capped[1],20);close(capped[2],65);
for(let trial=0;trial<300;trial++) {
 const energies=Array.from({length:3+trial%6},(_,i)=>(trial*37+i*71)%190);
 const caps=energies.map((e,i)=>Math.max(e,40+(i*43)%150));
 const copy=[...energies],r=equalizedBalances(energies,caps,.98);
 close(energies.reduce((a,b)=>a+b,0),r.balances.reduce((a,b)=>a+b,0)+r.loss);
 close(r.delivered,r.withdrawn*.98);
 assert.ok(r.balances.every((v,i)=>v>=0&&v<=caps[i]+1e-8));assert.deepEqual(energies,copy);
}
const sim=new Simulation();sim.stop();sim.headlessObservationMode=true;
Object.assign(sim.config.bond.adaptiveMorphology,{enabled:true,alignedBudgetsEnabled:true});
Object.assign(sim.config.bond.loopCirculation,{enabled:true,efficiency:1});
sim.organisms=sim.organisms.slice(0,5);sim.bonds.clear();
const [a,b,c,d,e]=sim.organisms;
for(const [m,x,y] of [[a,10,10],[b,12,10],[c,11,12],[d,13,12],[e,12,14]])
 Object.assign(m,{x,y,energy:0,foodPantry:{GREEN:2,BLUE:0,RED:0},brainExecution:{effectors:{bind:.6}}});
const connect=(x,y)=>sim.bonds.set(sim.bondKey(x.id,y.id),{firstId:x.id,secondId:y.id,reserve:3,strength:1});
connect(a,b);connect(b,c);connect(c,a);connect(c,d);connect(d,e);connect(e,c);
a.energy=90;
const keys=[...sim.bonds.keys()],food=sim.organisms.map(m=>({...m.foodPantry}));
prepareLoopCirculation(sim);assert.equal(sim.loopCirculationPlan.length,1,'overlapping loops are not a shared global bus');
applyLoopCirculation(sim);
close(a.energy,30);close(b.energy,30);close(c.energy,30);close(d.energy,0);close(e.energy,0);
prepareLoopCirculation(sim);applyLoopCirculation(sim);close(d.energy,0,'no second pool in one tick');
sim.simulationTicks++;prepareLoopCirculation(sim);applyLoopCirculation(sim);
close(a.energy,30);close(c.energy,10);close(d.energy,10);close(e.energy,10);
assert.deepEqual([...sim.bonds.keys()],keys);assert.deepEqual(sim.organisms.map(m=>m.foodPantry),food);
assert.ok(sim.loopCirculationStats.overlapSkips>0);
// A square is eligible without a diagonal, and pays the configured loss.
sim.bonds.clear();sim.organisms=[a,b,c,d];
for(const [m,x,y,energy] of [[a,10,10,90],[b,12,10,30],[c,12,12,15],[d,10,12,5]])Object.assign(m,{x,y,energy});
connect(a,b);connect(b,c);connect(c,d);connect(d,a);
sim.config.bond.loopCirculation.efficiency=.98;sim.simulationTicks++;
prepareLoopCirculation(sim);const before=sim.organisms.reduce((s,m)=>s+m.energy,0),lossBefore=sim.loopCirculationStats.loss;
applyLoopCirculation(sim);
close(Math.max(...sim.organisms.map(m=>m.energy)),Math.min(...sim.organisms.map(m=>m.energy)));
close(before,sim.organisms.reduce((s,m)=>s+m.energy,0)+sim.loopCirculationStats.loss-lossBefore);
sim.bonds.values().next().value.dormant=true;sim.simulationTicks++;prepareLoopCirculation(sim);
assert.equal(sim.loopCirculationPlan.length,0,'no fast transport through a dormant/open loop');
// The hint is positive for a nearby useful closure, not a free shape bonus.
sim.bonds.clear();sim.organisms=[a,b,c];
Object.assign(a,{x:10,y:10,energy:150});Object.assign(b,{x:12,y:10,energy:30});Object.assign(c,{x:12,y:12,energy:10});
connect(a,b);connect(b,c);sim.config.bond.loopCirculation.closureEnabled=true;sim.loopClosureContext=null;
const hint=closurePreferenceAt(sim,a,11,11);assert.ok(hint>0&&hint<=.15);
for(const m of sim.organisms)m.energy=100;sim.loopClosureContext=null;
assert.equal(closurePreferenceAt(sim,a,11,11),0,'balanced energy does not earn a geometry reward');
sim.config.bond.loopCirculation.enabled=false;sim.simulationTicks++;prepareLoopCirculation(sim);
const off=sim.organisms.map(m=>m.energy);applyLoopCirculation(sim);assert.deepEqual(sim.organisms.map(m=>m.energy),off);
assert.equal(closurePreferenceAt(sim,a,11,11),0);

sim.config.bond.loopCirculation.enabled=true;
sim.config.bond.loopCirculation.closureEnabled=false;
connect(c,a);sim.simulationTicks++;
for(const m of sim.organisms)m.energy=sim.getBondFundingFloor(m);
for(const edge of sim.bonds.values())edge.reserve=0;
prepareLoopCirculation(sim);assert.equal(sim.loopCirculationPlan.length,0,'unpaid loops get no fast service');
for(const edge of sim.bonds.values())edge.reserve=3;
sim.organisms.push(d,e);Object.assign(d,{x:40,y:40,energy:150});Object.assign(e,{x:42,y:40,energy:150});
connect(d,e);sim.bonds.get(sim.bondKey(d.id,e.id)).reserve=0;
prepareLoopCirculation(sim);
assert.equal(sim.bonds.get(sim.bondKey(d.id,e.id)).reserve,0,'advance funding does not alter unrelated open chains');
assert.equal(d.energy,150);assert.equal(e.energy,150);

// An actual act/harvest/death pipeline must wait for the same-tick sharing pass,
// but must never revive an age-dead member or share through its broken loop.
function metabolicFixture(ageDeath=false) {
 const fixture=new Simulation();fixture.stop();fixture.headlessObservationMode=true;
 Object.assign(fixture.config.bond.adaptiveMorphology,{enabled:true,alignedBudgetsEnabled:false,
   reshapingEnabled:false,edgeFlow:0,maximumFieldHarvest:0});
 Object.assign(fixture.config.bond.loopCirculation,{enabled:true,efficiency:1});
 fixture.config.bond.foodPantries.enabled=false;fixture.config.bond.componentReserveEconomy.enabled=false;
 fixture.config.bond.neighbourSurplusSupport.enabled=false;
 fixture.organisms=fixture.organisms.slice(0,3);fixture.bonds.clear();
 for(const [i,m] of fixture.organisms.entries()) {
  Object.assign(m,{x:10+(i===1?2:i===2?1:0),y:10+(i===2?2:0),energy:i===0?150:i===1?.001:30});
  fixture.world.getTile(m.x,m.y).type='EMPTY';
 }
 for(const [i,j] of [[0,1],[1,2],[2,0]]) {
  const x=fixture.organisms[i],y=fixture.organisms[j];
  fixture.bonds.set(fixture.bondKey(x.id,y.id),{firstId:x.id,secondId:y.id,reserve:3,strength:1});
 }
 fixture.supportLowEnergyMember=()=>0;fixture.relayReserveToMember=()=>({withdrawn:0,delivered:0});
 if(ageDeath)fixture.organisms[2].age=fixture.config.organism.maxAge;
 return fixture;
}
const rescued=metabolicFixture(),weakId=rescued.organisms[1].id;rescued.step();
assert.ok(rescued.organisms.find(m=>m.id===weakId)?.energy>0);
assert.ok(rescued.loopCirculationStats.starvationAvoided>0,'sharing happens before the deferred starvation verdict');
const old=metabolicFixture(true),oldId=old.organisms[2].id;old.step();
assert.ok(!old.organisms.some(m=>m.id===oldId));assert.equal(old.loopCirculationLast.length,0);
console.log('Simultaneous triangle/square balance, loss/capacity conservation, overlap fairness, no same-tick relay, useful-only closure and off/open controls passed.');
process.exit(0);
