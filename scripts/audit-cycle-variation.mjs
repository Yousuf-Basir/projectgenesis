import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {prepareAdaptiveMorphology,MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);
const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
const controller=new ReincarnationController({seed:160104,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['renewing-colonies'],{resourcePatchesEnabled:true,smoothFieldSensing:true});
// Controlled transition audit, not a six-world survival experiment. Preserve a
// paid fixture component so descendant mutation is exercised at every boundary.
const members=simulation.organisms.slice(0,4);
members.forEach((member,index)=>{member.x=10+index%2;member.y=10+Math.floor(index/2);member.energy=100;});
const rows=[];
for(let cycle=0;cycle<7;cycle++) {
 prepareAdaptiveMorphology(simulation);
 rows.push({cycle,seed:simulation.seed,birthMutationRate:simulation.config.organism.mutationRate,recipe:controller.recipe,inheritance:{...controller.inheritance},
  landscape:hash(simulation.world.serializeTiles()),patches:hash(simulation.resourcePatchState.patches),
  genomes:new Set(simulation.organisms.map(member=>JSON.stringify(member.genome))).size});
 const bonds=[[0,1],[1,3],[3,2],[2,0]].map(([i,j])=>({firstId:members[i].id,secondId:members[j].id,reserve:3,strength:1}));
 const carried={members,bonds,positions:members.map(member=>({id:member.id,x:member.x,y:member.y})),reserves:[],facetCount:0};
 controller.history.push({...controller.score(simulation),recipe:controller.recipe});
 controller.generation++;controller.cycle++;
 controller.applyRecipe(simulation,controller.chooseRecipe(),carried);
}
assert.equal(new Set(rows.map(row=>row.seed)).size,rows.length);
assert.equal(new Set(rows.map(row=>row.landscape)).size,rows.length);
assert.equal(new Set(rows.map(row=>row.patches)).size,rows.length);
assert.ok(rows.slice(4).every(row=>row.recipe.mutation));
assert.ok(rows.reduce((sum,row)=>sum+row.inheritance.mutations,0)>0);
await writeFile('research-results/cycle-variation-audit.json',JSON.stringify({kind:'controlled-transition-audit-not-survival-evidence',rows},null,2));
console.log(JSON.stringify(rows));process.exit(0);
