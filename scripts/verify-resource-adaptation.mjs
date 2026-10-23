import {Simulation} from '../server/simulation/simulation.js';
import {ReincarnationController} from '../server/simulation/reincarnation.js';
import {MORPHOLOGY_PROFILES,setMorphologyField} from '../server/simulation/adaptive-morphology.js';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const results=[];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);
for(const seed of (process.env.GENESIS_VERIFY_SEEDS??'160104,160118').split(',').map(Number)) {
 const frames=[],continuationFrames=[];
 for(const treatment of ['sensing','blind','blind-yoked']) {
  const simulation=new Simulation();simulation.stop();simulation.headlessObservationMode=true;
  const controller=new ReincarnationController({seed,adaptiveMorphologyEnabled:true});controller.applyRecipe(simulation,controller.chooseRecipe());
  Object.assign(simulation.config.bond.adaptiveMorphology,MORPHOLOGY_PROFILES['renewing-colonies'],{
    resourcePatchesEnabled:treatment!=='blind-yoked',smoothFieldSensing:true,
    fieldSensingEnabled:treatment==='sensing',environmentNavigationBias:3,
    reshapeMinimumGain:Number(process.env.GENESIS_VERIFY_GAIN??.003),
    stockSensingWeight:Number(process.env.GENESIS_VERIFY_STOCK??0),scarcitySensingEnabled:process.env.GENESIS_VERIFY_SCARCITY==='1',fieldHarvestRoutingEnabled:process.env.GENESIS_VERIFY_ROUTING==='1'});
  if(treatment==='blind-yoked')setMorphologyField(simulation,frames[0],frames[0].map(row=>row.map(()=>0)),'yoked sensing landscape');
  const checkpoints=[];let serial=0;
  const identify=()=>{for(const member of simulation.organisms)member.resourceIdentity??=`${seed}-${serial++}`;};
  const edgeIds=()=>{const map=new Map(simulation.organisms.map(member=>[member.id,member.resourceIdentity]));return new Set([...simulation.bonds.values()].map(edge=>[map.get(edge.firstId),map.get(edge.secondId)].sort().join('|')));};
  for(let tick=0;tick<1000;tick++) {
    if(treatment==='blind-yoked')simulation.morphologyField.reward=frames[tick];
    simulation.step();identify();
    if(treatment==='sensing')frames.push(structuredClone(simulation.morphologyField.reward));
    if([299,599,999].includes(tick))checkpoints.push({tick:tick+1,...controller.score(simulation),fieldIncome:simulation.morphologyStats.fieldIncome});
  }
  const before={...controller.score(simulation),morphology:{...simulation.morphologyStats},
    largestComponent:Math.max(0,...simulation.getBondGroups().map(group=>group.length)),
    relocations:simulation.resourcePatchState?.relocations??null,events:simulation.resourcePatchState?.events??[],
    genomeTypes:new Set(simulation.organisms.map(member=>JSON.stringify(member.genome))).size,
    topology:hash(simulation.getBondGroups().map(group=>group.length).sort((a,b)=>a-b))};
  const carried=controller.captureComponent(simulation),members=new Set(carried?.members??[]),pairs=edgeIds();
  controller.observe(simulation);identify();
  for(let tick=0;tick<80;tick++) {
    if(treatment==='blind-yoked')simulation.morphologyField.reward=continuationFrames[tick];
    simulation.step();identify();
    if(treatment==='sensing')continuationFrames.push(structuredClone(simulation.morphologyField.reward));
  }
  const now=edgeIds();
  const row={protocolVersion:2,seed,treatment,checkpoints,before,
    afterTransition:{seed:simulation.seed,inheritance:controller.inheritance,carriedMembers:carried?.members.length??0,carriedBonds:carried?.bonds.length??0,
      originalMembersAfter80:[...members].filter(member=>member.alive&&simulation.organisms.includes(member)).length,
      originalEdgesAfter80:[...pairs].filter(pair=>now.has(pair)).length,
      patches:simulation.resourcePatchState?.patches??null},
    parameters:{reshapeMinimumGain:simulation.config.bond.adaptiveMorphology.reshapeMinimumGain,stockSensingWeight:simulation.config.bond.adaptiveMorphology.stockSensingWeight,scarcitySensingEnabled:simulation.config.bond.adaptiveMorphology.scarcitySensingEnabled,fieldHarvestRoutingEnabled:simulation.config.bond.adaptiveMorphology.fieldHarvestRoutingEnabled},
    frameFingerprint:hash(frames),continuationFrameFingerprint:hash(continuationFrames)};
  results.push(row);console.log(JSON.stringify(row));await writeFile(process.env.GENESIS_VERIFY_OUTPUT??'research-results/resource-adaptation-verification.json',JSON.stringify(results,null,2));
 }
}
process.exit(0);
