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
- Full `/api/state` responses measured roughly 1–2.6 MB, without Content-Encoding on the measured response.
- Browser reproduction at 200,000 bytes/second and 150 ms latency: requests aborted at 4 seconds, status became `Connection Error`, and the initial tick remained 0.
- At that same speed, larger snapshots approached or exceeded an intermediate 15-second timeout; completed requests included 2.45 MB in 13.7 seconds and 2.60 MB in 15.0 seconds.
- `public/main.js` now allows 30 seconds for snapshot downloads instead of 4 seconds; single-flight polling, timeout cleanup and retry behavior are unchanged.
- A previously rendered world can remain visible while later requests time out. `Connection Error` is set by the polling catch block; successful rendering restores Running/Paused.
- Scope: snapshot timeout, regression test and npm test registration only. No changes to simulation physics, API permissions or proxy configuration.

## Verification and current status
- Deployed on the Oracle VM without a PM2 restart; the server session ID was unchanged, preserving the running world.
- Live browser verification at 200,000 bytes/second and 150 ms latency: a 2.42 MB snapshot completed in 13.6 seconds and the status was Running. Forced offline changed the status to Connection Error; restoring the connection returned it to Running with advancing ticks.
- The public `/main.js` SHA-256 matched the VM file after deployment.
- Upstream push is denied for the available GitHub account. The fix and context are saved in `Yousuf-Basir/projectgenesis`, branch `fix/snapshot-connection-timeout`; the VM stays on `codex/adaptive-morphology-world` with these commits fast-forwarded from the fork. Upstream branch tracking remains unchanged. Do not discard these fork-only fixes during future updates.
- `node test/snapshot-connection.mjs` failed on the old four-second timeout; a stronger twenty-second case also rejected the intermediate fifteen-second timeout. Both pass with the thirty-second deadline. Covers single-flight polling, genuine timeout, retry recovery and lower-version server restart.
- `npm run test:release` passed, including stable and experimental demo startup on isolated loopback ports.
- Production Node version at investigation: 24.21.0.
- Remaining limit: downloads taking over 30 seconds still time out. Payload compression/reduction and long-duration soak testing are outside this fix.

## Commands
```sh
node test/snapshot-connection.mjs
npm run test:release
# Frontend-only deploy: pull the reviewed commit, verify /main.js, reload viewer.
# Do not run pm2 restart merely to publish public/main.js.
```
