import {createSeededRandom} from './utils.js';

// This is environmental succession, not an organism's global target selector.
// Capacity represents exhaustible productivity; all actual energy still enters
// through the same bounded field-generation budget and finite local stock.
export function prepareResourcePatches(simulation) {
  const policy=simulation.config.bond.adaptiveMorphology;
  if(!policy.resourcePatchesEnabled || !simulation.morphologyField?.automatic) return;
  const size=simulation.morphologyField.size;
  let state=simulation.resourcePatchState;
  if(!state) {
    const random=createSeededRandom((simulation.seed^0x51c93a7d)>>>0);
    const patch=(x,y)=>({x,y,radius:3.5+random(),remaining:policy.patchCapacity,harvested:0});
    state=simulation.resourcePatchState={random,patches:[patch(3+random()*3,4+random()*4),patch(10+random()*3,8+random()*4)],events:[],relocations:0};
  }
  for(const patch of state.patches) {
    if(patch.remaining>policy.patchCapacity*.1) continue;
    const previous={x:patch.x,y:patch.y};
    let x,y;
    for(let attempt=0;attempt<32;attempt++) {
      x=1+state.random()*(size-2);y=1+state.random()*(size-2);
      if(Math.hypot(x-patch.x,y-patch.y)>=size*.4)break;
    }
    state.events.push({tick:simulation.simulationTicks,previous,next:{x,y},harvested:patch.harvested});
    if(state.events.length>24)state.events.shift();
    Object.assign(patch,{x,y,radius:3.5+state.random(),remaining:policy.patchCapacity,harvested:0});
    state.relocations++;
  }
  state.weights=state.patches.map(patch=>Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>
    Math.exp(-((x-patch.x)**2+(y-patch.y)**2)/(2*patch.radius**2))*patch.remaining/policy.patchCapacity)));
  simulation.morphologyField.reward=Array.from({length:size},(_,y)=>Array.from({length:size},(_,x)=>
    Math.min(1,state.weights.reduce((sum,grid)=>sum+grid[y][x],0))));
  simulation.morphologyField.source='consumption-driven resource patches';
  simulation.morphologyDemoPhase='forage / deplete / relocate';
}

export function debitPatchHarvest(simulation,row,column,amount) {
  const state=simulation.resourcePatchState;
  if(!state || !simulation.config.bond.adaptiveMorphology.resourcePatchesEnabled || !simulation.morphologyField.automatic || amount<=0)return;
  const weights=state.weights.map(grid=>grid[row][column]);
  const sum=weights.reduce((a,b)=>a+b,0);
  state.patches.forEach((patch,index)=>{
    const used=amount*weights[index]/Math.max(1e-12,sum);
    patch.remaining=Math.max(0,patch.remaining-used);
    patch.harvested+=used;
  });
}
