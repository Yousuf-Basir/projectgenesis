import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
import {writeFile} from 'node:fs/promises';

const results=[];
const variants=[
 {name:'blind',fieldSensingEnabled:false},
 {name:'local-3',environmentNavigationBias:3},
 {name:'local-12',environmentNavigationBias:12},
 {name:'local-36',environmentNavigationBias:36},
 {name:'gentle-12',environmentNavigationBias:12,collectiveMovementInterval:8},
 {name:'stock-12',environmentNavigationBias:12,patchCapacity:120}
];
for(const variant of variants)for(const seed of [160103,160104]) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
 const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['renewing-colonies'],{
  resourcePatchesEnabled:true,smoothFieldSensing:true,reshapeMinimumGain:.003},variant);
 const checkpoints=[];let cohort=[];let startIncome=0;
 for(let tick=0;tick<900;tick++) {
  simulation.step();
  if(tick===299){cohort=simulation.organisms.filter(member=>simulation.isActivelyBonded(member.id)).map(member=>({member,x:member.x,y:member.y}));startIncome=simulation.morphologyStats.fieldIncome;}
  if([299,599,899].includes(tick))checkpoints.push({tick:tick+1,population:simulation.organisms.length,bonds:simulation.bonds.size,relocations:simulation.resourcePatchState.relocations});
 }
 const alive=cohort.filter(item=>item.member.alive);
 const row={variant,seed,...controller.score(simulation),checkpoints,morphology:simulation.morphologyStats,
  relocations:simulation.resourcePatchState.relocations,events:simulation.resourcePatchState.events,
  cohort:cohort.length,cohortSurvivors:alive.length,cohortTravel:alive.reduce((sum,item)=>sum+simulation.distanceBetweenPositions(item,item.member),0)/Math.max(1,alive.length),
  laterHarvest:simulation.morphologyStats.fieldIncome-startIncome,deathCauses:simulation.energyEconomics.deaths,
  largestComponent:Math.max(0,...simulation.getBondGroups().map(group=>group.length))};
 results.push(row);console.log(JSON.stringify(row));await writeFile('research-results/resource-adaptation-search.json',JSON.stringify(results,null,2));
}
process.exit(0);
