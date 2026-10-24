import assert from 'node:assert/strict';
import {Renderer} from '../public/renderer.js';
globalThis.window={devicePixelRatio:1,addEventListener(){}};
const strokes=[];
const context={setTransform(){},clearRect(){},save(){},restore(){},setLineDash(){},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},arc(){},fillRect(){},fill(){},
  stroke(){strokes.push(this.strokeStyle);}};
const renderer=new Renderer({style:{},getContext:()=>context});
const snapshot={world:{width:3,height:3,tiles:Array.from({length:3},()=>Array(3).fill('EMPTY'))},
  organisms:[{id:1,x:1,y:1,energy:100,capabilities:[]},{id:2,x:0,y:1,energy:100,capabilities:[]}],
  bonds:[],facets:[],controls:{},markers:{births:[],deaths:[],energyTransfers:[{fromId:2,toId:1,ttl:6,kind:'organism-harvest'}]}};
const before=JSON.stringify(snapshot);renderer.render(snapshot);
assert.ok(strokes.includes('rgba(255, 132, 160, 0.9)'),'feeding flashes have a distinct pink color');
assert.equal(JSON.stringify(snapshot),before,'rendering does not create a bond or mutate physics');
strokes.length=0;snapshot.markers.energyTransfers=[];renderer.render(snapshot);
assert.ok(!strokes.some(color=>color?.includes('255, 132, 160')),'no phantom harvesting flash');
console.log('Pink contact-feeding flash is distinct, optional and does not mutate the world.');
