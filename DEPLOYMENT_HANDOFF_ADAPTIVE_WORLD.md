# Project Genesis — developer deployment handoff

Date: **24 October 2026**. Target: the current adaptive morphology / reincarnation / food-pantry demo, not an older experiment.

## 1. Release identity

- Repository: [lucpattyn/projectgenesis](https://github.com/lucpattyn/projectgenesis).
- **Deploy branch:** `codex/adaptive-morphology-world`
- Branch URL: [codex/adaptive-morphology-world](https://github.com/lucpattyn/projectgenesis/tree/codex/adaptive-morphology-world).
- Functional code baseline: full commit **`f78e68bf837d980866e83b04c59fb0fd180be29f`**.
- This handoff and the reader-facing README summary are a documentation-only follow-up to that code. For an immutable deployment including these documents, pin the **final release SHA supplied with this handoff**, rather than assuming future branch HEAD will stay unchanged. Record `git rev-parse HEAD` in the deployment log.
- Do **not** deploy `main`, `codex/reincarnation-intelligence-loop`, or `codex/delayed-cue-computation` for this release.

This release includes top-layer food-colored `+` indicators, adaptive pantry routing/reuse, aligned energy budgets, adaptive resource patches, mutation/selection and living-structure carry-over. It reproduces the local **configuration from its beginning**, not a copy of the currently running local world.

## 2. Runtime and checkout

Use **Node.js 24.x**; local verification used Node **24.14.1**, npm **11.11.0**. Node's native ES modules and built-in APIs are used. This repository currently has no external runtime dependencies, frontend build, package lockfile, database or required npm installation. `npm ci` is not applicable without a lockfile. Do not add dependencies merely to start the demo.

Example fresh checkout (Linux shell):

```bash
git clone --branch codex/adaptive-morphology-world --single-branch https://github.com/lucpattyn/projectgenesis.git
cd projectgenesis
git rev-parse HEAD
# To pin the immutable release instead of a moving branch, replace RELEASE_SHA
# with the full SHA provided by the release owner:
# git checkout --detach RELEASE_SHA
node --version
npm --version
```

Run from the **repository root**: static assets and optional research-output paths are resolved from the process working directory.

## 3. Exact live preset

Set all of these explicitly so a service does not inherit stale experimental settings:

```dotenv
GENESIS_ADAPTIVE_MORPHOLOGY=1
GENESIS_MORPHOLOGY_PROFILE=adaptive-foraging
GENESIS_SEED=160104
GENESIS_RESOURCE_PATCHES=1
GENESIS_FIELD_DEMO=0
GENESIS_ALIGNED_BUDGETS=1
GENESIS_FOOD_PANTRIES=1
GENESIS_PANTRY_REUSE=1
GENESIS_VISUAL_RELAY=0
```

An `.env` file is **not automatically loaded** by the application. Supply process environment variables through your service/container, or use Node 24's explicit env-file support. For example, save the above configuration in an operator-managed file and run:

```bash
node --env-file=/absolute/path/to/genesis.env server/index.js
```

Alternatively, export the variables in the shell and use `npm start`. PowerShell uses `$env:GENESIS_FOOD_PANTRIES='1'`, etc., before `npm start`.

The server listens on **`0.0.0.0:3000`**, as configured in `server/simulation/config.js`. This release does **not** honor generic `PORT` or `HOST` environment variables. Expose internal port 3000 through your chosen reverse proxy/container mapping. A platform requiring a dynamic listening port needs a separately reviewed code change, not an undocumented environment override.

On startup the application starts the simulation timer and resumes the world automatically. Normal display speed is 1. No browser needs to stay open for the server-side simulation to continue.

## 4. One live world, one process

**Run exactly one application process/replica for a shared public world.** Every viewer sees that process's in-memory simulation. Do not use Node cluster, multiple PM2 instances, horizontally scaled containers or round-robin load balancing across independent copies. They would serve different ticks, seeds and worlds, making the display appear to jump backwards or change unpredictably. Session stickiness alone would still give different visitors different worlds.

Use your existing service supervisor with automatic restart and stdout/stderr collection. Keep its working directory at the repository root, set the environment above, and use an unprivileged service account. Verify the actual Node executable path; it may differ from the example below.

Example systemd service template for a checkout at `/opt/projectgenesis`:

```ini
[Unit]
Description=Project Genesis shared adaptive world
After=network.target

[Service]
Type=simple
User=genesis
Group=genesis
WorkingDirectory=/opt/projectgenesis
EnvironmentFile=/etc/projectgenesis.env
ExecStart=/usr/bin/node /opt/projectgenesis/server/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

The account, checkout path, environment file and supervisor configuration must be provisioned by the deployment operator; they are **not created by this document or installed in the repository**. This template has not been deployed/tested on the target host. Container-based supervision is also possible, but use one replica and the same working-directory/environment rules. No Docker image or Dockerfile is supplied by this release.

## 5. Public-access precautions — required

This is a research demo, **not an authenticated multi-user product**. The application currently exposes control/settings/upload/experiment POST endpoints without built-in authentication. A visitor able to call them could pause/reset the shared world, change parameters, upload a field or start expensive research jobs.

Before public exposure:

1. Put HTTPS and your approved reverse proxy/access-control layer in front of Node.
2. For public spectators, allow static GET/HEAD requests and the necessary read-only endpoints: `GET /api/state`, `GET /api/experiments`, and `GET /api/guided-task`.
3. Deny public write methods, including POSTs to `/api/control`, `/api/settings`, `/api/environment-field`, `/api/guided-input`, `/api/guided-task`, and `/api/experiments`. Restrict all other API paths by default. If operators need controls, provide them through a separately authenticated/private route. Some controls will remain visible in the existing UI but must not be writable by unauthenticated viewers.
4. Firewall direct access to port 3000 so users cannot bypass the protected proxy. The application binds all interfaces by default.
5. Rate-limit public API access and monitor response size, CPU, memory and event-loop delays. Many viewers requesting full snapshots, large populations or operator-triggered research jobs can be expensive. No production load/24-hour stability guarantee is established.

Do not put credentials in committed files. The preset above contains no secrets. Authentication/proxy rollout is an operator responsibility and has not been implemented merely by pushing this branch.

## 6. What the deployed world does

The simulation starts with seed **160104**, a new population and cycle **0**. Each cycle lasts **1,000 simulation ticks**, not 1,000 seconds. Even successful worlds transition; there is no “only reset if poor” gate in this implementation.

At a transition it records results, regenerates terrain/resources from a different seed, changes the recipe, introduces newcomers, and restores eligible survivors. Retained members preserve their positions, ages, earned energy and food pouches; their bonds and component reserves are remapped rather than recreated. With aligned budgets there is no 75-unit carry cap or 10% bond/component reserve tax. New walls beneath survivors are cleared; colliding newcomers are moved to open sites.

Exact eligibility: connected groups must have at least **three** members, and the combined eligible living member set must contain at least **four**. Thus one isolated three-member group alone is not carried. Singletons and pairs do not qualify. Fresh newcomers are kept alongside survivors. With survivors available, half the declared new population is replaced by descendants of an older/energetic elite; their initial energy comes from that same newcomer budget. They do not duplicate parent food. Ordinary birth mutations remain 2% per birth in this preset, with 25% mutation attempts in inherited newcomers.

The first four cycles are:

| UI cycle | Recipe | Food growth rate | Max growth attempts/tick | Gate discovery | Gate navigation | Collective-stride movement-cost multiplier |
|---|---|---:|---:|---|---|---:|
|0|resource-foraging|0.45|8|on|on|0.9|
|1|gate-consensus|0.32|6|on|on|0.8|
|2|distributed-memory|0.42|8|on|off|1.0|
|3|scarcity-recovery|0.24|5|on|on|0.7|

All four use resource-funded survival and dormant-bond support. These are settings, not guarantees that a specific behavior or cognitive faculty will emerge. The movement multiplier applies to the configured collective-stride mechanism, not universally to every movement expense.

From cycle 4 onward, selection explores a base recipe 25% of the time or chooses among the top three recently ranked recipes 75% of the time, then mutates **one** numeric setting within bounds:

| Parameter | Bounds | Mutation step |
|---|---|---|
|Food growth rate|0.2–0.5|0.04|
|Growth attempts/tick|4–10|1|
|Collective-stride movement multiplier|0.6–1.1|0.08|

Recipe gate/navigation booleans are inherited from the chosen recipe, not independent random switches every cycle. Rankings use bounded population retention, bond retention, gate completions and triangle density from up to 24 recent cycle records. These are heuristic fitness measures, not an intelligence score.

The seed formula is `initialSeed + generation × 9973 + cycle × 101`. Generation and cycle advance together in normal operation: seed 160104 starts cycle 0, then 170178, then 180252, and so on. Repeating simple motifs does not mean the complete world is repeating. The world number (normally 85470) is a separate generator recipe and does not need to change each cycle.

Automatic resource patches also deplete and relocate within a cycle according to actual harvesting, not a fixed timed challenge. The global field-generation ceiling remains four energy units/tick. The demo therefore has continuing declared environmental inputs; it is not a fixed-total-energy universe. Manual image-derived reward/danger fields disable automatic patch succession while active and persist through in-process cycles, not server restarts. Image brightness/redness are local intensity cues, not image recognition.

Legacy Package A guided substrate and conditional/unconditional development-support settings are disabled by the recipe controller at cycle transitions. Do not enable them merely because an older handoff describes them. The active adaptive field/image and food-pantry mechanisms are separate.

## 7. Food and bond behavior to explain to viewers

- Food-colored `+` markers are drawn above the world on stocked closed loops. Mixed arms indicate multiple food types. No plus means no displayed chamber stock; not every structure is expected to hold food at every moment. Loose-owner stores appear as small colored squares.
- Food stores come from actual otherwise-overflowing harvest, have finite capacity and spoilage, and belong to specific organisms. Saved food moves at most one bond-hop per tick toward reachable chambers, with a 0.5-unit sender bandwidth and 98% crossing efficiency. These are authored transport rules, not learned navigation.
- Falling local energy can trigger eating before critical starvation. Immediate withdrawals are from own/adjacent stores, not arbitrary distant component members. A broken route cannot deliver food magically.
- Green feeds members first; blue keeps longer and can feed them later; red funds actual bond maintenance. If ordinary body surplus and red stores cannot pay a maintenance buffer, blue/green can cover the remaining bill after member needs are protected.
- Formation/maintenance protect a reproduction endowment; local renewal and paid connection seeds replace some ageing members. Funded adjacent bonds can tolerate binding dips. None of this makes a bond immortal or recreates already-broken edges for free.

Latest two-seed, 2,000-tick routing/reuse results are 161 versus 274 final bonds on seed 160104 and 283 versus 49 on seed 160121: **444 versus 323 in aggregate, but not a consistent win**. Do not market this as proven intelligence, robust survival on every seed, or a completed nutrient cycle. See [full pantry results](FOOD_PANTRIES_2026-10-24.md) and [budget alignment](ALIGNED_ENERGY_BUDGETS_2026-10-24.md).

## 8. Verification and acceptance

Before starting the supervised service, run from its checkout:

```bash
npm run check
npm test
node test/aligned-budgets.mjs
node test/food-pantries.mjs
node test/pantry-routing.mjs
node test/renderer-pantry-markers.mjs
node test/renderer-heatmap.mjs
node test/morphology-speed-parity.mjs
node test/morphology-occupancy.mjs
node test/resource-patches.mjs
```

These tests use their own simulations and do not reset the running live server. Headless comparison jobs are optional and can be CPU-heavy; run them separately from a public viewing process.

After startup, open `/` and inspect `GET /api/state`. There is no separate `/health` endpoint. For a local Node 24 smoke check:

```bash
node --input-type=module -e 'const s=await(await fetch("http://127.0.0.1:3000/api/state")).json(); console.log({tick:s.statistics.tick,cycle:s.reincarnation.cycle,seed:s.settings.universeSeed,controls:s.controls,profile:s.bonding.adaptiveMorphology.name,aligned:s.bonding.adaptiveMorphology.alignedBudgetsEnabled,pantries:s.bonding.foodPantries.enabled,reuse:s.bonding.foodPantries.adaptiveReuseEnabled});'
```

Confirm:

- HTTP 200 for `/`, `/renderer.js`, `/pantry-visuals.js`, and `/api/state`.
- Profile `adaptive-foraging`, aligned budgets/pantries/reuse true; paused false and speed 1.
- Tick advances between checks. At a cycle boundary tick legitimately returns to zero while cycle increases. It should not bounce between independent worlds under one stable process.
- The initial seed is 160104; later cycle seeds change as above. Do not reject a healthy running service because it is already on a later cycle.
- Food `+` marks appear only when real stock exists. The legend by itself is not evidence of stock. Verify `bonding.foodPantries.stored`, `chambers[].contents`, `loose`, and usage/routing counters. Stores can be eaten, spoil, move or be lost; an empty cycle is possible.
- Public unauthenticated writes are blocked at the proxy; authenticated operator access, if provided, is deliberate.

Browser reload is needed after frontend updates. Assets use `Cache-Control: no-store`; avoid a proxy/service-worker policy that serves stale JS. Do not reset or accelerate the public world just to force a plus marker to appear.

## 9. Persistence, operations and rollback

Living world state, current organisms, pantry owners, uploaded fields and reincarnation history are **in memory**. A Node restart/redeploy/crash starts a new cycle-0 run from the preset. Cycle-to-cycle carry-over is not a checkpoint/restart system. Runtime image uploads are not embedded in this release. `data/experiment-history.json`, when present, holds research-job history, not a live-world backup; guided research jobs may write under `research-results/`. Preserve operator-generated outputs separately when updating the checkout. Avoid `git reset --hard`/`git clean` on a live research checkout.

Use a supervisor and log process restarts; a stable service alone does not prove persistent collective identity. Watch CPU/memory/API latency and inspect recipe, population, bonds, starvation, carry counts and pantry usage across cycles. Hardware sizing and large-audience load validation remain deployment work.

Rollback options, always after an intentional service stop/restart:

- `GENESIS_PANTRY_REUSE=0`: preceding pantry physics, keeping clearer `+` graphics.
- `GENESIS_FOOD_PANTRIES=0`: disable the pantry layer entirely.
- `GENESIS_ALIGNED_BUDGETS=0`: legacy budget/carry behavior; this reintroduces the old carry cap and reserve tax and is for controlled comparisons, not an implied recommended fix.
- Pin a previously recorded commit and its matching environment file for full code rollback. Do not merely switch to `main` and assume matching behavior.

Deployment changes reset the in-memory run. If restart continuity is required, durable world checkpointing is a separate task and must be implemented/tested before promising it to users.

## 10. Source map and operator sign-off

| Responsibility | Source |
|---|---|
|Startup/environment flags/API/static serving|`server/index.js`|
|Recipes, seeds, selection, inheritance, carry|`server/simulation/reincarnation.js`|
|Adaptive profiles, finite field, shaping/flow|`server/simulation/adaptive-morphology.js`|
|Consumption-driven patch relocation|`server/simulation/resource-patches.js`|
|Food ownership, routing, eating and upkeep|`server/simulation/food-pantries.js`|
|Budgets, reproduction, paid maintenance|`server/simulation/simulation.js`|
|Policy defaults and listening address|`server/simulation/config.js`|
|Food `+` drawing and final overlay order|`public/pantry-visuals.js`, `public/renderer.js`|
|Status, recipe hints and legend|`public/main.js`, `public/index.html`|

Before sharing the URL, record the **deployed full Git SHA, branch, environment file, one-process supervisor identity, HTTPS URL, public-write protection, smoke-check result and restart policy**. Pushing this branch to GitHub does not itself deploy it or configure those protections on a live host.
