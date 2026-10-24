import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
import {pantrySnapshot,closedLoops} from '../server/simulation/food-pantries.js';
const seed=Number(process.argv[2]??160104),mode=process.argv[3]??'closure',ticks=Number(process.argv[4]??1500);
const runway=process.argv[5]==='runway',horizon=Number(process.argv[6]??60);
if(!['off','circulation','closure'].includes(mode))throw new Error('Mode must be off, circulation or closure.');
const sim=new Simulation();sim.stop();sim.headlessObservationMode=true;
Object.assign(sim.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['adaptive-foraging']);
Object.assign(sim.config.bond.foodPantries,{enabled:true,reliableReservesEnabled:true});
sim.config.bond.organismHarvest.enabled=true;
Object.assign(sim.config.bond.reproductionRunway,{enabled:runway,horizonTicks:horizon});
Object.assign(sim.config.bond.loopCirculation,{enabled:mode!=='off',closureEnabled:mode==='closure'});
const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(sim,controller.chooseRecipe());
let opening=pantrySnapshot(sim).stored,bondTicks=0,loopTicks=0,starved=0,ageDeaths=0,births=0;
let edgeLifetimes=[],tracked=new Map(),worldStartBirths=sim.births,nextEdgeId=1;
let motifLifetimes=[],motifs=new Map(),pantryFed=0,pantryFuel=0;
const rows=[];
for(let elapsed=1;elapsed<=ticks;elapsed++) {
 sim.step();bondTicks+=sim.bonds.size;
 const present=new Set();
 for(const edge of sim.bonds.values()) {
  edge.circulationObservationId??=nextEdgeId++;present.add(edge.circulationObservationId);
  if(!tracked.has(edge.circulationObservationId))tracked.set(edge.circulationObservationId,elapsed);
 }
 for(const [id,first] of tracked)if(!present.has(id)){edgeLifetimes.push(elapsed-first);tracked.delete(id);}
 const presentMotifs=new Set(closedLoops(sim).map(loop=>loop.memberIds.map((id,i)=>
  sim.bonds.get(sim.bondKey(id,loop.memberIds[(i+1)%loop.memberIds.length])).circulationObservationId).sort((a,b)=>a-b).join(':')));
 for(const key of presentMotifs)if(!motifs.has(key))motifs.set(key,elapsed);
 for(const [key,first] of motifs)if(!presentMotifs.has(key)){motifLifetimes.push(elapsed-first);motifs.delete(key);}
 const active=sim.loopCirculationLast??[];loopTicks+=active.length;
 assert.ok(sim.organisms.every(m=>Number.isFinite(m.energy)&&m.energy>=0));
 for(const loop of active)if(!loop.capacityLimited)assert.ok(loop.spread<1e-7,'unconstrained members must equalize in the same pass');
 if(sim.simulationTicks%250===0||elapsed===ticks) {
  const p=pantrySnapshot(sim),c=sim.loopCirculationStats;
  assert.ok(Math.abs(opening+p.deposited-p.stored-p.memberDelivered-p.bondDelivered-p.transferLoss-p.spoiled-p.deathLost)<1e-6);
  if(c)assert.ok(Math.abs(c.delivered*(1/sim.config.bond.loopCirculation.efficiency-1)-c.loss)<1e-6);
  const row={elapsed,cycle:controller.cycle,tick:sim.simulationTicks,population:sim.organisms.length,bonds:sim.bonds.size,
   bondTicks,loopTicks,births:sim.births-worldStartBirths,runwayDenied:sim.reproductionRunwayDenied??0,deaths:{...sim.energyEconomics.deaths},
   breaks:{...sim.bondBreakReasons},circulation:c?{...c}:null,pantryStored:p.stored,stocked:p.stockedChambers,
   pantryFed:p.memberDelivered,pantryBondFuel:p.bondDelivered};
  rows.push(row);console.log(JSON.stringify({seed,mode,...row}));
 }
 if(elapsed===ticks||sim.simulationTicks===1000) {
  starved+=sim.energyEconomics.deaths['energy exhaustion']??0;ageDeaths+=sim.energyEconomics.deaths['maximum age']??0;
  births+=sim.births-worldStartBirths;
  const pantry=pantrySnapshot(sim);pantryFed+=pantry.memberDelivered;pantryFuel+=pantry.bondDelivered;
 }
 if(elapsed<ticks&&controller.observe(sim)) {
  // Observation IDs are copied with carried edges, so physical lifetime is
  // not falsely ended/restarted just because endpoint IDs are remapped.
  opening=pantrySnapshot(sim).stored;worldStartBirths=sim.births;
 }
}
const result={seed,mode,ticks,runway,horizon,bondTicks,loopTicks,starved,ageDeaths,births,pantryFed,pantryFuel,
 operatingSample:sim.organisms.slice(0,12).map(m=>({energy:m.energy,cost:m.foragingOperatingCost,income:m.foragingIncome})),
 meanEndedEdgeLifetime:edgeLifetimes.reduce((a,b)=>a+b,0)/Math.max(1,edgeLifetimes.length),
 longestEndedEdgeLifetime:Math.max(0,...edgeLifetimes),rows};
result.longestObservedEdgeLifetime=Math.max(result.longestEndedEdgeLifetime,...[...tracked.values()].map(first=>ticks+1-first));
result.longestObservedMotifLifetime=Math.max(0,...motifLifetimes,...[...motifs.values()].map(first=>ticks+1-first));
await writeFile(`research-results/${runway?`reproduction-runway-${horizon}`:'loop-circulation'}-${seed}-${mode}-${ticks}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({seed,mode,summary:{...result,rows:undefined}}));
process.exit(0);
