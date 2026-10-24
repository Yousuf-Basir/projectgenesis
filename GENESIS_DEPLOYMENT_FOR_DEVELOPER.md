# Project Genesis — shareable deployment instructions

Prepared: 24 October 2026. This document is self-contained and can be forwarded to the deployment developer.

## 1. Which version to deploy

- Repository: https://github.com/lucpattyn/projectgenesis
- Branch: `codex/adaptive-morphology-world`
- Branch link: https://github.com/lucpattyn/projectgenesis/tree/codex/adaptive-morphology-world
- Release tag: **`genesis-demo-2026-10-24`**. The release owner supplies the verified full commit SHA with the handover; record `git rev-parse HEAD` after checkout.
- Pin this tag or that full SHA. Do not substitute `main` or assume a future branch HEAD has identical behavior.

This demo release includes reliable pantry saving/reuse, colored food `+` indicators, bounded energy harvesting from passing organisms, paid fast-loop circulation/closure, adaptive resource patches, aligned budgets, and reincarnation with living-structure carry-over. The reproduction-runway experiment is included but **off in the stable/control preset**. Recruitment was withdrawn; passing organisms are not forced to join.

“Stable” means the reproducible demo control, not proven indefinite survival. The optional birth forecast has mixed results; neither preset demonstrates general intelligence. Restarting recreates the configuration from the beginning, not the exact population of a running local world.

## 2. Runtime and checkout

Use **Node.js 24.x**. Local verification used Node 24.14.1 and npm 11.11.0. This revision has no external runtime dependencies, frontend build, package lockfile, or required database. `npm ci` is not applicable without a lockfile.

Fresh Linux checkout:

```bash
git clone --branch codex/adaptive-morphology-world --single-branch https://github.com/lucpattyn/projectgenesis.git
cd projectgenesis
git checkout --detach genesis-demo-2026-10-24
git rev-parse HEAD
node --version
npm --version
```

Run all following application commands from the repository root. Existing live checkouts may contain research outputs or modifications: preserve them before updating; do not use `git reset --hard` or `git clean` as a deployment shortcut.

## 3. Exact environment file

Create a file named **`genesis.env`** in the repository root with these contents:

```dotenv
GENESIS_ADAPTIVE_MORPHOLOGY=1
GENESIS_MORPHOLOGY_PROFILE=adaptive-foraging
GENESIS_SEED=160104
GENESIS_RESOURCE_PATCHES=1
GENESIS_FIELD_DEMO=0
GENESIS_ALIGNED_BUDGETS=1
GENESIS_FOOD_PANTRIES=1
GENESIS_PANTRY_REUSE=1
GENESIS_PANTRY_RESERVES=1
GENESIS_ORGANISM_HARVEST=1
GENESIS_LOOP_CIRCULATION=1
GENESIS_LOOP_CLOSURE=1
GENESIS_REPRODUCTION_RUNWAY=0
GENESIS_VISUAL_RELAY=0
```

Use these values explicitly; do not inherit stale flags from older experiments. They contain no credentials. Environment variables already set by a service/shell take precedence over Node's env-file values, so remove conflicting service-level values.

The application does **not** automatically load an env file through `npm start`. Use the explicit startup command below, or supply the complete environment through the supervisor.

### Two launch presets

Checked-in `config/demo-stable.env` contains the exact values above. `config/demo-experimental.env` differs only by `GENESIS_REPRODUCTION_RUNWAY=1` (a 60-tick local affordability forecast).

```bash
npm run start:demo
# OR, after stopping the first process:
npm run start:demo:experimental
```

Use **one** preset/process, not both. To reproduce the latest local experimental demo, choose the experimental command. For the recommended public control, choose `start:demo`. These commands explicitly load the env files; bare `npm start` does not select either complete preset. Clear conflicting inherited `GENESIS_*` service variables because they override env-file values.

`GENESIS_REPRODUCTION_RUNWAY=0` restores the preceding reproduction checks without removing circulation or pantries. Pantry inventory is real harvested food; the `+` marks stocked chambers. Fast circulation redistributes body energy with loss; it does not pool or duplicate food. See `PANTRY_RESERVES_FIX_2026-10-24.md`, `LOOP_CIRCULATION_2026-10-24.md`, `ORGANISM_HARVEST_2026-10-24.md` and `REPRODUCTION_RUNWAY_2026-10-24.md` for measured outcomes and limitations.

## 4. Verify and start

The release packages its tests, raw comparisons and both presets. Use the full release check from a clean checkout:

Before launching the public service:

```bash
npm run test:release
```

Start from the repository root:

```bash
node --env-file=genesis.env server/index.js
```

The same Node command works in PowerShell when run from the repository root. It starts and resumes the world automatically. No browser needs to remain open for the simulation to continue.

The server binds **`0.0.0.0:3000`**. This revision does not honor generic `PORT` or `HOST` variables. Use a reverse proxy or container port mapping for the external URL. A hosting platform requiring a dynamic application port needs a reviewed code change.

## 5. Keep exactly one shared world running

Run **one application process / one replica**. Do not enable Node cluster, multiple PM2 instances, or load balancing between independent application copies. Each process owns a different in-memory world; multiple replicas can make ticks jump backwards and show inconsistent worlds. Sticky sessions still leave different visitors watching different worlds.

Use a supervisor with automatic restart and log collection, under an unprivileged service account. Keep its working directory at the repository root.

Example Linux systemd service, assuming the operator provisions `/opt/projectgenesis`, the `genesis` account, and `/opt/projectgenesis/genesis.env`:

```ini
[Unit]
Description=Project Genesis shared world
After=network.target

[Service]
Type=simple
User=genesis
Group=genesis
WorkingDirectory=/opt/projectgenesis
ExecStart=/usr/bin/node --env-file=/opt/projectgenesis/genesis.env /opt/projectgenesis/server/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Verify the actual Node executable location and filesystem permissions on your host; `/usr/bin/node` is an example. After saving an appropriately provisioned service as `projectgenesis.service`, use:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now projectgenesis
sudo systemctl status projectgenesis
sudo journalctl -u projectgenesis -f
```

Do not leave the manual foreground process running when starting the service; only one process can own port 3000. This service template has not been installed or tested on your target server.

## 6. Public-access security — required before sharing the URL

The research application has **no built-in authentication for write/control endpoints**. Without proxy protection, visitors can pause/reset the shared world, change settings, upload fields, or start expensive experiments.

The deployment operator must:

1. Put HTTPS and an access-control reverse proxy in front of Node.
2. Allow public static GET/HEAD requests and required read-only API access: `GET /api/state`, `GET /api/experiments`, and `GET /api/guided-task`.
3. Block public API write methods, including POST requests to `/api/control`, `/api/settings`, `/api/environment-field`, `/api/guided-input`, `/api/guided-task`, and `/api/experiments`. Restrict other API paths by default.
4. Provide any required operator writes only through an authenticated/private access path. UI controls may remain visible even when public writes are blocked.
5. Firewall direct external access to port 3000 so users cannot bypass the proxy.
6. Rate-limit snapshot access and monitor CPU, memory and API latency. Run CPU-heavy headless research jobs separately from the public demo.

Do not deploy the research app directly to the open Internet without these protections. No production audience-size or 24-hour reliability guarantee has been established.

## 7. Acceptance checks

Open the public `/` page and verify `/api/state`. There is no separate `/health` endpoint.

- `/`, `/renderer.js`, `/pantry-visuals.js`, and `/api/state` return HTTP 200.
- `bonding.adaptiveMorphology.name` is `adaptive-foraging`.
- Aligned budgets, food pantries and adaptive pantry reuse are enabled.
- Reliable pantry reserves, organism harvesting, loop circulation and closure are enabled. `bonding.reproductionRunway.enabled` is false for stable and true for experimental; its horizon is 60.
- `controls.paused` is false and `controls.speed` is 1.
- Ticks advance between requests. At a cycle boundary, tick returns to zero while the cycle number increases; that is intentional.
- The initial seed is 160104. Later seeds change; do not reject a service simply because it has reached a later cycle.
- Saved food appears as food-colored `+` markers inside stocked loops. Empty chambers have no marker. Check `bonding.foodPantries.stored`, chamber contents and usage counters rather than assuming every shape must have food.
- Public unauthenticated API writes are actually blocked, including direct bypass attempts to port 3000.

Reload the browser after frontend updates. Avoid proxy/service-worker caching that serves stale JavaScript; the application serves assets with `Cache-Control: no-store`.

## 8. What viewers should expect

Organisms form and lose bonds, harvest resources, reshape, share energy, reproduce, age and die. Stored food is real harvested energy: green nourishes members, blue keeps longer, and red can fund bond upkeep. Food transfer has limited bandwidth and losses. Funded bonds are more resilient but not immortal.

Every **1,000 simulation ticks**, a new reincarnation cycle changes the seeded terrain/resources and recipe. Eligible living structures carry their members, ages, positions, earned energy, connections and owner-held food forward; fresh organisms also enter. Exact eligibility requires groups of at least three and at least four eligible members in total, so one triangle alone does not qualify.

The initial four recipes vary food growth, growth attempts, collective-stride movement cost and gate navigation. Later cycles use bounded recipe selection and numeric mutation; reproduction also introduces inherited variation. This is authored evolutionary experimentation, not autonomous invention of new algorithms or demonstrated general intelligence.

Legacy Package A guided substrate and conditional/unconditional development support are disabled by the cycle controller. The current adaptive reward/danger field is a separate mechanism; do not enable old development support to match this preset.

## 9. Persistence, updates and rollback

The live world is **in memory**. A restart, crash or redeploy begins a fresh cycle-0 world from the configured seed. Cycle-to-cycle carry-over is not durable checkpointing. Runtime image uploads and the exact current local population are not bundled in the Git release.

Research history/output files are not live-world backups. Preserve operator-generated data separately when updating code. If uninterrupted organism identity across restarts is required, durable checkpointing must be implemented and tested as a separate task.

For rollback, stop the service intentionally, restore a previously recorded code SHA and its matching environment, then restart. In the published version, `GENESIS_PANTRY_REUSE=0` disables the newer pantry reuse behavior and `GENESIS_FOOD_PANTRIES=0` disables pantries entirely; these change experimental conditions and are not recommended production defaults.

Before handing over the public URL, record:

- Full deployed Git SHA and environment values.
- Service name, working directory, Node executable and one-process configuration.
- HTTPS URL, proxy write restrictions and port-3000 firewall policy.
- Smoke-check results, logs, restart policy and rollback SHA.

Pushing to GitHub does not itself deploy the application or configure the host's security.

Full handoff: https://github.com/lucpattyn/projectgenesis/blob/genesis-demo-2026-10-24/DEPLOYMENT_HANDOFF_ADAPTIVE_WORLD.md

Emergency previous-release rollback: pin `b1bab422e0c2fc988c65b0def23307e0a4b19fe2` and use **that commit's matching handoff/preset**, not the new flags. Preserve operator data and stop the old service before switching. No destructive reset is required.
