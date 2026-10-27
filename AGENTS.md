# Project Genesis / Primes — operational context

## Scope and source
- Artificial-life simulation with a browser viewer; no frontend build or runtime dependencies.
- Research overview and release instructions: `README.md`, `GENESIS_DEPLOYMENT_FOR_DEVELOPER.md`, and `DEPLOYMENT_HANDOFF_ADAPTIVE_WORLD.md`.
- Working branch: `codex/adaptive-morphology-world`. Do not substitute `main` or the older reincarnation branch.
- Keep this file current with changes, verification results and deployment state.

## Deployment
- Public viewer: `https://primes.quarkshub.com/`.
- Oracle VM SSH alias: `lucoraclevm`; checkout `/var/www/projectgenesis`; PM2 process `genesis`.
- Node 24; one process running `npm run start:demo` on port 3000 with `config/demo-stable.env`.
- Public API writes are proxy-blocked; direct external access to port 3000 is firewalled. Preserve these restrictions.
- `genesis.env` on the VM is operator-owned and untracked; preserve it.
- World state is in memory: restarting the process resets it. Do not restart for a frontend-only change: static files are read from disk per request and served with `Cache-Control: no-store`. Existing viewers must reload.

## Connection-status diagnosis — 2026-10-27
- Full `/api/state` responses measured roughly 1–1.4 MB, without Content-Encoding on the measured response.
- Browser reproduction at 200,000 bytes/second and 150 ms latency: requests aborted at 4 seconds, status became `Connection Error`, and the initial tick remained 0.
- `public/main.js` now allows 15 seconds for snapshot downloads instead of 4 seconds; single-flight polling, timeout cleanup and retry behavior are unchanged.
- A previously rendered world can remain visible while later requests time out. `Connection Error` is set by the polling catch block; successful rendering restores Running/Paused.
- Scope: snapshot timeout, regression test and npm test registration only. No changes to simulation physics, API permissions or proxy configuration.

## Verification and current status
- Implemented and locally verified; deployment verification pending.
- `node test/snapshot-connection.mjs` failed on the old timeout and passed after the change. Covers a five-second download, single-flight polling, genuine timeout, retry recovery and lower-version server restart.
- `npm run test:release` passed, including stable and experimental demo startup on isolated loopback ports.
- Production Node version at investigation: 24.21.0.
- Remaining limit: downloads taking over 15 seconds still time out. Payload compression/reduction and long-duration soak testing are outside this fix.

## Commands
```sh
node test/snapshot-connection.mjs
npm run test:release
# Frontend-only deploy: pull the reviewed commit, verify /main.js, reload viewer.
# Do not run pm2 restart merely to publish public/main.js.
```
