import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES} from '../server/simulation/adaptive-morphology.js';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const seed of [160104,160118]) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
 const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['renewing-colonies'],{fieldDemoEnabled:true});
 let serial=0;const identify=()=>{for(const member of simulation.organisms)member.continuityToken??=`${seed}-${serial++}`;};
 const edges=()=>{const byId=new Map(simulation.organisms.map(member=>[member.id,member.continuityToken]));return new Set([...simulation.bonds.values()].map(edge=>[byId.get(edge.firstId),byId.get(edge.secondId)].sort().join('|')));};
 let incoming=null;
 for(let cycle=0;cycle<2;cycle++) {
  const checkpoints=[];let retention=null;
  for(let tick=0;tick<1000;tick++) {
   simulation.step();identify();
   if(tick===79&&incoming){const now=edges();retention={members:[...incoming.members].filter(member=>member.alive&&simulation.organisms.includes(member)).length,originalEdges:[...incoming.edges].filter(edge=>now.has(edge)).length};}
   if([399,599,999].includes(tick)) checkpoints.push({tick:tick+1,...controller.score(simulation),phase:simulation.morphologyDemoPhase});
  }
  const carried=controller.captureComponent(simulation);
  const row={seed,cycle,...controller.score(simulation),checkpoints,retention,
    largestComponent:Math.max(0,...simulation.getBondGroups().map(group=>group.length)),morphology:{...simulation.morphologyStats},
    carriedMembers:carried?.members.length??0,carriedBonds:carried?.bonds.length??0};
  results.push(row);console.log(JSON.stringify(row));await writeFile('research-results/colony-demonstration.json',JSON.stringify(results,null,2));
  incoming={members:new Set(carried?.members??[]),edges:edges()};
  controller.observe(simulation);identify();
 }
}
process.exit(0);
