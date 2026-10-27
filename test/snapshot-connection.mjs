import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/main.js', import.meta.url), 'utf8');
const timers = new Map();
const requests = [];
const rendered = [];
let timerId = 0;
let now = 0;
const statusPill = {textContent: 'Connecting...'};
const context = vm.createContext({
  AbortController, statusPill,
  snapshotRequestInFlight: false,
  lastRenderedSnapshotVersion: -1,
  lastServerSessionId: null,
  window: {
    setTimeout(callback, ms) { timers.set(++timerId, {callback, at: now + ms}); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  },
  fetch(url, {signal}) {
    assert.equal(url, '/api/state');
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {once: true});
      requests.push(snapshot => resolve({ok: true, json: async () => snapshot}));
    });
  },
  renderSnapshot(snapshot) {
    rendered.push(snapshot.version);
    statusPill.textContent = snapshot.controls.paused ? 'Paused' : 'Running';
  }
});
// Run the real fetch and polling functions, isolating network timing from canvas rendering.
vm.runInContext(source.slice(source.indexOf('async function fetchJson('), source.indexOf('function renderStats('))
  + source.slice(source.indexOf('async function loadSnapshot('), source.indexOf('async function loadExperiments(')), context);
const load = () => vm.runInContext('loadSnapshot()', context);
const advance = ms => {
  now += ms;
  for (const [id, timer] of timers) {
    if (timer.at <= now) { timers.delete(id); timer.callback(); }
  }
};
const snapshot = (version, paused = false, serverSessionId = 'first') => ({version, controls: {paused}, serverSessionId});

const slow = load();
await load();
assert.equal(requests.length, 1, 'polls remain single-flight');
advance(20000);
requests.shift()(snapshot(10));
await slow;
assert.equal(statusPill.textContent, 'Running', 'a successful twenty-second download must not be aborted');
assert.deepEqual(rendered, [10]);
assert.equal(timers.size, 0, 'successful requests clear the deadline');

const stalled = load();
advance(30000);
await stalled;
requests.shift();
assert.equal(statusPill.textContent, 'Connection Error', 'a stalled connection still times out');
assert.equal(context.snapshotRequestInFlight, false, 'timeouts must allow another poll');

const recovery = load();
requests.shift()(snapshot(11, true));
await recovery;
assert.equal(statusPill.textContent, 'Paused', 'a successful retry clears the connection error');

const restart = load();
requests.shift()(snapshot(1, false, 'restarted'));
await restart;
assert.equal(statusPill.textContent, 'Running');
assert.deepEqual(rendered, [10, 11, 1], 'server restarts may begin at a lower version');
assert.equal(timers.size, 0);
console.log('Snapshot polling: slow download, single-flight, timeout, recovery and server restart passed.');
