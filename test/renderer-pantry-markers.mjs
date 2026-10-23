import assert from 'node:assert/strict';
import {Renderer} from '../public/renderer.js';
globalThis.window={devicePixelRatio:1,addEventListener(){}};
const paint=[];
const context={setTransform(){},clearRect(){},save(){},restore(){},setLineDash(){},
 beginPath(){},moveTo(){},lineTo(){},closePath(){},arc(){},
 fillRect(){paint.push({kind:'fill',color:this.fillStyle});},
 fill(){paint.push({kind:'fill',color:this.fillStyle});},
 stroke(){paint.push({kind:'stroke',color:this.strokeStyle});}};
const renderer=new Renderer({style:{},getContext:()=>context});
const points=[{x:0,y:0},{x:2,y:0},{x:0,y:2}];
const chamber={points,contents:{GREEN:9,BLUE:2,RED:0}};
const snapshot={world:{width:3,height:3,tiles:Array.from({length:3},()=>Array(3).fill('EMPTY'))},
 organisms:points.map((p,i)=>({...p,id:i+1,energy:120,capabilities:[]})),controls:{},
 bonds:[{firstId:1,secondId:2,strength:1,reserve:3}],facets:[{memberIds:[1,2,3],reserve:1}],
 bonding:{foodPantries:{enabled:true,chambers:[chamber],loose:[]}},
 markers:{births:[{x:1,y:1,ttl:10}],deaths:[{x:1,y:1,ttl:14}]}};
const before=JSON.stringify(snapshot);renderer.render(snapshot);
assert.deepEqual(paint.slice(-5),['#03131b','#9dff84','#70b6ff','#9dff84','#70b6ff'].map(color=>({kind:'stroke',color})),
 'presence + must paint after bonds, bodies, rings, births and deaths');
assert.equal(JSON.stringify(snapshot),before);
chamber.contents={GREEN:0,BLUE:0,RED:0};paint.length=0;renderer.render(snapshot);
assert.ok(!paint.some(p=>['#9dff84','#70b6ff','#ff8b76'].includes(p.color)),'empty shapes have no food marker');
chamber.contents={GREEN:0,BLUE:0,RED:5};paint.length=0;renderer.render(snapshot);
assert.ok(paint.slice(-4).every(p=>p.color==='#ff8b76'),'red-only store has a red +');
snapshot.bonding.foodPantries.enabled=false;paint.length=0;renderer.render(snapshot);
assert.ok(!paint.some(p=>p.color==='#ff8b76'),'disabled feature leaves no pantry overlays');
console.log('Food-colored + markers render above every world layer; empty/disabled shapes are unmarked.');
