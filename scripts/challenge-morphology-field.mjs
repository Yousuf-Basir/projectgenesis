import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {setMorphologyField,fieldAt} from '../server/simulation/adaptive-morphology.js';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const seed of [160103,160104]) for(const sensing of [false,true]) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
 const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 Object.assign(simulation.config.bond.adaptiveMorphology,{stationaryOperatingMultiplier:.18,edgeFlow:.1,collectiveMovementInterval:5,environmentNavigationBias:3,learningEnabled:false});
 for(let tick=0;tick<400;tick++)simulation.step();
 const cohort=simulation.organisms.filter(member=>simulation.isActivelyBonded(member.id));
 const reward=Array.from({length:16},()=>Array.from({length:16},(_,x)=>1-x/15));
 const danger=reward.map(row=>row.map(value=>(1-value)*.3));
 setMorphologyField(simulation,reward,danger,'challenge-reward-left-danger-right');
 simulation.config.bond.adaptiveMorphology.fieldSensingEnabled=sensing;
 let exposure=0,observations=0;
 const startDanger=cohort.reduce((sum,member)=>sum+fieldAt(simulation,member.x,member.y).danger,0)/Math.max(1,cohort.length);
 for(let tick=0;tick<200;tick++) {
  simulation.step();
  for(const member of cohort) if(member.alive){exposure+=fieldAt(simulation,member.x,member.y).danger;observations++;}
 }
 const alive=cohort.filter(member=>member.alive);
 const row={seed,sensing,cohort:cohort.length,survivors:alive.length,startDanger,
 meanExposure:exposure/Math.max(1,observations),endDanger:alive.reduce((sum,member)=>sum+fieldAt(simulation,member.x,member.y).danger,0)/Math.max(1,alive.length),
 ...controller.score(simulation),morphology:simulation.morphologyStats};
 results.push(row);console.log(JSON.stringify(row));await writeFile('research-results/morphology-field-challenge.json',JSON.stringify(results,null,2));
}
process.exit(0);
