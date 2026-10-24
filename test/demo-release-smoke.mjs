import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

for(const preset of ['stable','experimental']) {
  const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
  const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  // Test on an ephemeral loopback port without changing the application's
  // published startup behavior or disturbing the operator's port-3000 world.
  const bootstrap=`import {DEFAULT_CONFIG} from './server/simulation/config.js';
    DEFAULT_CONFIG.server.port=${port};DEFAULT_CONFIG.server.host='127.0.0.1';
    await import('./server/index.js');`;
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GENESIS_')));
  const child=spawn(process.execPath,[`--env-file=config/demo-${preset}.env`,'--input-type=module','-e',bootstrap],
    {cwd:process.cwd(),env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
  try {
    const base=`http://127.0.0.1:${port}`;let state;
    for(let attempt=0;attempt<100;attempt++) {
      if(child.exitCode!==null)throw new Error(`Demo ${preset} exited: ${logs}`);
      try {state=await (await fetch(`${base}/api/state`,{signal:AbortSignal.timeout(3000)})).json();break;}
      catch {await delay(100);}
    }
    assert.ok(state,`Demo ${preset} did not start: ${logs}`);
    for(const path of ['/','/main.js','/renderer.js','/pantry-visuals.js'])
      assert.equal((await fetch(`${base}${path}`)).status,200,`${preset}: ${path}`);
    assert.equal(state.controls.paused,false);assert.equal(state.controls.speed,1);
    for(const key of ['adaptiveMorphology','foodPantries','organismHarvest','loopCirculation'])
      assert.equal(state.bonding[key].enabled,true,`${preset}: ${key}`);
    assert.equal(state.bonding.foodPantries.reliableReservesEnabled,true);
    assert.equal(state.bonding.loopCirculation.closureEnabled,true);
    assert.equal(state.bonding.reproductionRunway.enabled,preset==='experimental');
    assert.equal(state.bonding.reproductionRunway.horizonTicks,60);
    const first=state.bonding.loopCirculation.passes??0;let advanced=false;
    for(let attempt=0;attempt<30;attempt++) {
      await delay(200);
      const next=await (await fetch(`${base}/api/state`)).json();
      if((next.bonding.loopCirculation.passes??0)>first){advanced=true;break;}
    }
    assert.ok(advanced,'server must advance without a browser');
    console.log(`Clean demo startup: ${preset}, static assets, preset flags and advancing world passed.`);
  } finally {
    if(child.exitCode===null){child.kill();await once(child,'exit');}
  }
}
