import assert from 'node:assert/strict';
import {Renderer} from '../public/renderer.js';

globalThis.window={devicePixelRatio:1,addEventListener(){}};
const fills=[];
const arcs=[];
const context={setTransform(){},clearRect(){},fillRect(...bounds){fills.push({color:this.fillStyle,bounds});},
 save(){},restore(){},setLineDash(){},beginPath(){},stroke(){},arc(...values){arcs.push(values);}};
const renderer=new Renderer({style:{},getContext:()=>context});
const snapshot={world:{width:1,height:1,tiles:[['EMPTY']]},organisms:[],controls:{},
  markers:{facetWorkTrail:[[100000]],environmentMemory:[[1]],births:[],deaths:[]},environmentMemory:{enabled:true}};
const before=JSON.stringify(snapshot);
renderer.render(snapshot);
assert.equal(JSON.stringify(snapshot),before,'visualization must not mutate simulation data');
assert.equal(fills.length,3,'background plus one quiet fill per heat layer; no bright inner squares');
for(const fill of fills.slice(1)) {
  const [red,green,blue,alpha]=fill.color.match(/[\d.]+/g).map(Number);
  assert.ok(blue>red&&green>red,'heatmaps must use cool colors');
  assert.ok(alpha<=.19,'saturated history must remain subtle');
  assert.deepEqual(fill.bounds,[0,0,13,13]);
}
snapshot.bonding={adaptiveMorphology:{patchCapacity:240,resourcePatches:{patches:[{x:1,y:1,remaining:120}]}}};
snapshot.morphologyEnvironment={size:2,reward:[[0,0],[0,0]],danger:[[0,0],[0,0]]};
renderer.render(snapshot);
assert.equal(arcs.length,2,'resource center and remaining-productivity arcs must render');
assert.ok(Math.abs(arcs[1][4]-arcs[1][3]-Math.PI)<1e-9,'half productivity must draw half a circle');
console.log('Cool low-opacity heatmaps, no inner squares, immutable snapshot passed.');
