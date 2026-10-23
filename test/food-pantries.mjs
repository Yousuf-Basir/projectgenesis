import assert from 'node:assert/strict';
import {Simulation} from '../server/simulation/simulation.js';
import {closedLoops,storeHarvest,prepareFoodPantries,pantrySnapshot,loseDeadPantry} from '../server/simulation/food-pantries.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {pantryGrains,drawPantries} from '../public/pantry-visuals.js';
const sim=new Simulation();sim.stop();
sim.config.bond.adaptiveMorphology.enabled=true;sim.config.bond.foodPantries.enabled=true;
sim.config.bond.foodPantries.harvestFraction=.2; // Optional paid surplus saving, not the overflow-only default.
sim.organisms=sim.organisms.slice(0,4);sim.bonds.clear();
const [a,b,c,d]=sim.organisms;
for(const [member,x,y] of [[a,10,10],[b,12,10],[c,12,12],[d,10,12]]){member.x=x;member.y=y;member.energy=160;}
function connect(first,second){sim.bonds.set(sim.bondKey(first.id,second.id),{firstId:first.id,secondId:second.id,reserve:0,strength:1});}
connect(a,b);connect(b,c);connect(c,d);connect(d,a);
assert.equal(closedLoops(sim).length,1,'a square is a pantry too, not only a triangle');
const result=()=>({consumedEnergy:20,consumedResource:'GREEN',overflowEnergy:0,energyFlow:{losses:{capacityOverflow:0}}});
const inventory=()=>sim.organisms.reduce((sum,m)=>sum+m.energy+Object.values(m.foodPantry??{}).reduce((x,y)=>x+y,0),0)
 +[...sim.bonds.values()].reduce((sum,e)=>sum+e.reserve,0);
const before=inventory();storeHarvest(sim,a,result());
assert.equal(inventory(),before);assert.equal(a.foodPantry.GREEN,4);
assert.equal(pantrySnapshot(sim).stored,4);assert.equal(pantrySnapshot(sim).chambers.length,1);
connect(a,c);assert.equal(closedLoops(sim).length,2,'a diagonal divides rather than duplicates the pantry');
const snap=pantrySnapshot(sim);assert.equal(snap.chambers.reduce((sum,x)=>sum+x.contents.GREEN,0),4,'no shared-node inventory duplication');
a.foodPantry={GREEN:10,BLUE:10,RED:10};a.energy=130;b.energy=0;b.lastOperatingExpense=2;
const prior=inventory(),priorLoss=Object.values(sim.energyEconomics.losses).reduce((x,y)=>x+y,0);
prepareFoodPantries(sim);
const afterLoss=Object.values(sim.energyEconomics.losses).reduce((x,y)=>x+y,0);
assert.ok(Math.abs(prior-inventory()-(afterLoss-priorLoss))<1e-8,'withdrawals, upkeep and spoilage conserve accounted energy');
assert.ok(b.energy>=4-1e-9);assert.ok(sim.pantryStats.memberDelivered>0);assert.ok(sim.pantryStats.bondDelivered>0);
assert.ok(a.foodPantry.BLUE>a.foodPantry.GREEN,'blue keeps longer and green is eaten first');
sim.bonds.clear();const loose=pantrySnapshot(sim);assert.equal(loose.chambers.length,0);assert.ok(loose.loose.length);
const held=a.foodPantry.GREEN;storeHarvest(sim,a,result());assert.equal(a.foodPantry.GREEN,held,'open chains cannot create enclosed stores');
// Overflow is redirected once, not counted as both stored and lost.
connect(a,b);connect(b,c);connect(c,a);a.foodPantry={GREEN:0,BLUE:0,RED:0};a.energy=sim.getReproductionEnergyFloor(a);
const over=result();over.overflowEnergy=5;over.energyFlow.losses.capacityOverflow=5;a.energyLedger.losses.capacityOverflow=5;
storeHarvest(sim,a,over);assert.equal(a.foodPantry.GREEN,5);assert.equal(over.overflowEnergy,0);assert.equal(a.energyLedger.losses.capacityOverflow,0);
const controller=new ReincarnationController({adaptiveMorphologyEnabled:true});
sim.config.bond.adaptiveMorphology.alignedBudgetsEnabled=true;
connect(c,d);connect(d,a);sim.bondGroupsCache=null;
const carried=controller.captureComponent(sim);assert.ok(carried);const stockBefore=carried.members.map(m=>({...m.foodPantry}));
sim.setSeed(999);controller.restoreComponent(sim,carried);assert.deepEqual(carried.members.map(m=>({...m.foodPantry})),stockBefore,'food moves with living owners across cycles');
loseDeadPantry(sim,a);assert.equal(Object.values(a.foodPantry).reduce((x,y)=>x+y,0),0);
const polygon=[{x:0,y:0},{x:20,y:0},{x:10,y:20}];
const full=pantryGrains(polygon,{GREEN:4,BLUE:4,RED:4},1),empty=pantryGrains(polygon,{GREEN:0,BLUE:0,RED:0},1);
assert.equal(full.length,12);assert.equal(empty.length,0);assert.equal(new Set(full.map(g=>`${g.x},${g.y}`)).size,full.length);
assert.equal(pantryGrains(polygon,{GREEN:1e-8},1).length,0,'near-empty stores must not leave permanent ghost grains');
assert.ok(pantryGrains([{x:0,y:0},{x:13,y:0},{x:0,y:13}],{GREEN:1},1,5.2).length>0,
 'even the smallest cell triangle must fit a clearly visible food marker');
assert.ok(full.every(g=>g.x>0&&g.y>0&&g.y<2*Math.min(g.x,20-g.x)),'grains remain inside the actual enclosure');
const strokes=[];const context={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes.push(this.strokeStyle);},fillRect(){}};
const visual={enabled:true,grainEnergy:1,chambers:[{points:polygon,contents:{GREEN:1,BLUE:1,RED:1}}]};
const beforeVisual=JSON.stringify(visual);drawPantries(context,visual,1);
assert.deepEqual(new Set(strokes),new Set(['#03131b','#9dff84','#70b6ff','#ff8b76']));
assert.equal(strokes.length,5,'one outline plus four colored arms');
assert.equal(JSON.stringify(visual),beforeVisual,'rendering must not change inventory');
strokes.length=0;drawPantries(context,{...visual,chambers:[{points:polygon,contents:{GREEN:0,BLUE:0,RED:0}}]},1);
assert.equal(strokes.length,0,'empty chambers have no presence mark');
sim.config.bond.foodPantries.enabled=false;assert.equal(pantrySnapshot(sim).enabled,false);
console.log('Generic closed pantries, paid color-specific storage/use, overflow, breakup, carry, losses and visible grains passed.');
process.exit(0);
