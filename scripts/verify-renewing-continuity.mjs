import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const seed of [160103,160104,160118]) {
 const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
 const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
 Object.assign(simulation.config.bond.adaptiveMorphology,{stationaryOperatingMultiplier:.18,edgeFlow:.1,collectiveMovementInterval:5,environmentNavigationBias:3,learningEnabled:false,renewalEnabled:true,paidFormationEnabled:true});
 let serial=0;
 const identify=()=>{for(const member of simulation.organisms)member.continuityToken??=`${seed}-${serial++}`;};
 const edgeTokens=()=>{
  const byId=new Map(simulation.organisms.filter(member=>member.alive).map(member=>[member.id,member.continuityToken]));
  return new Set([...simulation.bonds.values()].filter(edge=>byId.has(edge.firstId)&&byId.has(edge.secondId)).map(edge=>[byId.get(edge.firstId),byId.get(edge.secondId)].sort().join('|')));
 };
 for(let tick=0;tick<1000;tick++) {simulation.step();identify();}
 const before=controller.score(simulation);
 const carried=controller.captureComponent(simulation);
 const members=new Set(carried?.members??[]);
 const pairs=edgeTokens();
 controller.observe(simulation);identify();
 const immediate={population:simulation.organisms.length,bonds:simulation.bonds.size,carried:controller.lastCarry};
 for(let tick=0;tick<80;tick++){simulation.step();identify();}
 const now=edgeTokens();
 const early={members:[...members].filter(member=>member.alive&&simulation.organisms.includes(member)).length,
 originalEdges:[...pairs].filter(pair=>now.has(pair)).length,totalBonds:simulation.bonds.size};
 for(let tick=80;tick<1000;tick++){simulation.step();identify();}
 const row={seed,before,immediate,after80:early,afterSecondWorld:controller.score(simulation),
 largestComponent:Math.max(0,...simulation.getBondGroups().map(group=>group.length)),morphology:simulation.morphologyStats};
 results.push(row);console.log(JSON.stringify(row));await writeFile('research-results/renewing-continuity.json',JSON.stringify(results,null,2));
}
process.exit(0);
