# Primes

Primes, also called Project Genesis, is a long-term Artificial Life research project built around a server-driven simulation engine. Its central hypothesis is that prime factorization can serve as a canonical language for generation: a prime represents one irreducible generator, while a composite represents their composition.

## Current live state — aligned energy budgets (24 October 2026)

The adaptive-foraging profile now preserves carried member/bond/component balances, protects one offspring's energy endowment, and pays bounded emergency member support and connection upkeep before reproduction. Formation and maintenance use the same protected budget. A small rolling upkeep buffer avoids locking creation-sized reserves away from renewal. Discretionary sharing still protects the full reproduction trigger; no extra food or support subsidy is added. Compare with `GENESIS_ALIGNED_BUDGETS=0` before startup.

See [aligned energy budgets, comparisons and startup instructions](ALIGNED_ENERGY_BUDGETS_2026-10-24.md). The [exact late-cycle diagnosis](LATE_CYCLE_PERSISTENCE_DIAGNOSIS_2026-10-23.md) supersedes earlier suggestions that long-term bond survival had been solved. Results remain seed-dependent.

Two matched 2,000-tick runs ended with **245 versus 68 bonds** in aggregate and lower second-world starvation deaths. Initial growth was smaller, and one seed's final bond count was essentially unchanged. This is a late-stage improvement on these cases, not proof of indefinite survival or intelligence.

## Previous live state — adaptive resource foraging (23 October 2026)

The default on `codex/adaptive-morphology-world` is now **adaptive-foraging**, seed **160104**, speed 1. Start with `npm start` and refresh http://localhost:3000/.

This builds on renewing colonies below, but replaces fixed timed environmental phases with **consumption-driven depletion and relocation**. Patches lose productivity when harvested; exhausted patches open at new seeded locations. Gentle, smoothly sampled local cues bias movement and shaping without supplying destination coordinates or extra energy. The global field budget remains four units/tick. Small cyan resource rings and the status line show remaining patch productivity, shifts and genome diversity. Uploaded images remain authoritative and turn off automatic succession.

Across four matched seeds at 1,000 ticks, the selected sensing treatment harvested about **15% more field energy** and retained 350 versus 250 bonds in aggregate. The effect is uneven: two seeds lost the bond-count comparison, and the two fresh validation seeds showed better harvesting but **no bond-retention advantage**. This is a promising adaptive-foraging substrate, not a universal survival or learned-intelligence result. Stronger attraction, stock sensing, metabolic feedback and direct field-to-bond routing were tested; none established a consistently better default, so those options remain off.

Cycle variation was audited: distinct terrain/patch seeds, ordinary 2%-per-birth mutation, inherited descendant mutations and bounded recipe mutation after the initial four recipes. Surviving structures are intentionally inherited; recurring simple motifs do not imply identical world resets.

See [resource adaptation results and handoff](RESOURCE_ADAPTATION_RESULTS_2026-10-23.md) for raw comparisons, rejected variants, exact carry-over, startup switches and regression commands. Use `GENESIS_MORPHOLOGY_PROFILE=renewing-colonies` before startup to compare with the prior timed demonstration.

## Previous live state — renewing colonies (23 October 2026)

Active branch: `codex/adaptive-morphology-world`. The selected survival/response implementation is recorded in commit `8fc912d`; the original reincarnation branch is retained as a reference. Start with `npm start` and open http://localhost:3000/. The current default is seed **160104**, profile **renewing-colonies**, at speed 1.

### What changed to reach this state

- Stationary bonded operating cost was reduced from 25% to 18% of the base charge; awake-edge energy flow was reduced from 0.75 to 0.10 per tick, retaining 98% efficiency and protecting donors' reproduction/support floors.
- Funded adjacent bonds tolerate temporary binding-signal dips. Depletion, separation, death and ageing still apply.
- Older, sufficiently energetic bonded members can reproduce locally and invest existing energy into newborn connection seeds. New bond reserves are paid by endpoints, with a maximum degree of four for new connections in this profile.
- A rotating member can reshape locally without breaking its existing adjacencies. Periodic component motion uses local reward/danger sensing; no particular shape or gate is prescribed.
- Eligible surviving structures remain at their positions across 1,000-tick reincarnations, alongside newcomers. New walls under survivors are cleared, and colliding newcomers are relocated.
- Fixed stale movement occupancy after reshaping, and removed playback speed from per-tick food production. Playback speed no longer changes ecology within an individual tick.
- Optional directional learning was tested and left **off** because it did not improve the measured retention comparison. Existing evolutionary selection/inheritance and topology-trace mechanisms remain separate; improved survival is not proof of learned intelligence.

### Observable environment and measured result

The default demonstration cycles through forage (ticks 0–399), a reward-left/danger-right challenge (400–599), then recovery (600–999). The next world carries eligible survivors forward. The field supplies at most four external energy units globally per tick; harvesting, transport loss, paid motion and danger are accounted for. Uploaded images override the schedule: brightness maps to reward and excess red to danger, not semantic image recognition.

Three matched 1,000-tick seeds retained **185 bonds / 150 members** in aggregate versus **61 bonds / 52 members** with the starting adaptive profile. Final changing-environment demonstrations survived two worlds on both tested seeds, with measured original-member/edge carry-over. Individual starvation and topology retention remain mixed; this is not a 24-hour stability or intelligence claim.

The small status line above the canvas shows phase, colony count, largest component, shape moves and renewal births. Background facet-work history now uses a **low-opacity cyan wash**, with no bright golden inner squares; environmental memory uses soft blue, and reward/nutrient overlays are muted cool tones. Organisms and bonds retain orange/gold so they stand apart. Red danger remains distinguishable. These palette changes affect rendering only, not simulation rules or heatmap values.

Full parameters, raw-result links, regression commands, limitations and PowerShell startup switches: [latest experiment report](MORPHOLOGY_EXPERIMENT_REPORT_2026-10-23.md). Architecture and earlier results: [adaptive morphology world](ADAPTIVE_MORPHOLOGY_WORLD.md). The report supersedes older live-default descriptions below.

## Historical research state — Phase 16 Energy Logistics

Project Genesis now has a functioning structural ecology: organisms can form bonds, closed triangular facets, larger bonded components, complete consensus gates, harvest physical gate-field food, and migrate between finite gate opportunities. The current research question is no longer whether visible structure can form. It is whether a **collective** can persist as an identifiable entity across energy cycles, migration, and member turnover.

Current live demonstrations use seed `160103`. They enable bounded component lifecycle (`harvest → conserve → migrate`) and bounded migrating-component transport. These are experimental mechanisms, not claims of long-horizon stability. They create no energy, food, global target, or teleportation; transport reduces only the existing movement charge of a coherent strong bonded component travelling toward a locally sensed gate.

The principal empirical findings so far are:

- finite individual energy storage was a genuine bottleneck, but removing storage overflow alone did not create persistence;
- gate-centred collective work is survival-critical in the resource-limited task ecology;
- components can form, migrate, and repeatedly exploit gates, but migration remains the dominant energy leak;
- transport improves short-horizon component energy retention and structural richness, while requiring longer replicated persistence tests;
- cumulative facet-work heatmaps show gate-centred structural-work regions distinct from ordinary food-bearing foraging space.

The research record is maintained in:

- `PHASE_16_ENERGY_LOGISTICS.md` — protocols, causal results, and interpretation constraints;
- `RESEARCHER_UPDATE_ENERGY_LOGISTICS.md` — concise researcher-facing summary;
- `NEXT_SESSION_HANDOFF.md` — the next instrumentation phase: longitudinal collective identity and morphology analysis.

The first measurement layers are now active: every 20 ticks, the server records raw topology and economics for each strong-facet bonded component—members, bonds, facets, density, cycles, bridge fragility, branching, spatial extent, energy, reserves, and gate context—then conservatively links only unambiguous consecutive samples using member/direct-descendant continuity plus bond, facet, and spatial evidence. The next planned work is replicated longer longitudinal analysis asking whether any collective outlives the organisms that founded it. No new biological mechanism is required for that question.

## Topology-native pulse and motif memory

The topology-native memory layer is an opt-in research mechanism (`bond.topologyMemory.enabled`, currently `false`). It preserves the baseline formation rules and does not use remembered world coordinates or privileged shapes. Live degree determines roles: degree-one terminals can explore, degree-three-or-higher nodes can relay, and non-terminal members of cyclic components are structural cores.

Useful outcomes—food return, gate completion, productive migration, member support, and reproduction—share the existing bounded pulse path. A pulse attenuates across the component's current bonds and reinforces only the nodes and edges it reaches. Traces decay continuously. Component reserves remain the only energy source: they are capped, protect source survival and reproduction first, then support members and weak bond reserves.

When enabled, the server also records topology signatures made from component size, bond count, cycle rank, and degree sequence. Repeated successful pulses consolidate a signature into a motif trace; a five-node ring can therefore become a learned memory without any pentagon whitelist. Consolidated motifs may modestly protect an existing adjacent edge and qualify a stable, surplus-bearing component for structural reproduction. They cannot create edges, create energy, prevent separation, or make a bond immortal. Newborns inherit only a capped, noisy fraction of local node trace.

The layer is intentionally measured against the same seed and tick horizon with the switch off and on before changing live defaults. Diagnostics expose role counts, motif counts, consolidation, topology traces, pulse paths, and reserve throughput in the bonding snapshot.

The reserve budget follows a strict survival order: source survival floor, protected reproduction slice, weakest-member support, then bond maintenance. A topology-memory pulse can preserve an edge only while its component still has usable reserve and all members are above the support floor. This prevents a successful motif from keeping bonds alive by starving its own members.

The first scout stage is observational: the server identifies degree-one terminals attached to cyclic cores and records bounded tethered-scout eligibility/episode state, but does not yet move scouts independently or alter bonds. This null-intervention boundary was verified against seed `160103`; enabling the diagnostics produced identical ecology over 300 ticks. Return-path movement and reinforcement are the next separately tested intervention.

The experimental elastic-tether mode is now implemented but remains off by default (`bond.topologyMemory.tetheredScout.elasticEnabled: false`). It permits one eligible terminal to make bounded local moves, records value-bearing returns, and emits a return pulse. The initial 800-tick seed-`160103` screen was too disruptive (93 departures, 31 returns, 14 bonds/7 facets at the endpoint). Requiring shared reserve, reducing departure probability, and adding a return cooldown produced 1 departure and 1 successful return, with 47 bonds/49 facets and 21 energy-exhaustion deaths at the endpoint. This remains a promising but single-seed tuning result.

Scout eligibility now also requires a redundant core: minimum internal bonds, positive cycle rank, enough cyclic-core members, minimum core bond strength, and a larger shared reserve. In a 1,200-tick seed-`160103` screen this raised the early peak to 97 bonds/88 facets and limited excursions to 2 departures/1 successful return. Endpoint survival remains mixed, so the mode stays experimental and opt-in.

Facet-local memory combines each facet's internal cycle with the sorted external attachment degrees. Only collective successes reinforce that record, at most once per tick; ordinary individual food pulses do not saturate every triangle. A later facet can rediscover the trace when the same local topology reappears, while decay and attachment changes make the memory forgetful.

### Why topology memory remains compatible with the intelligence goal

Topology memory is a substrate for emergent collective intelligence, not a hard-coded answer. The simulation does not assign meaning to a pentagon, diamond, star, or any other shape. It records only that a live topology repeatedly carried a useful event, then gives that topology a bounded, decaying trace. Pulses are signals, traces are memory, repeated success is consolidation, and decay is forgetting. Memory can bias maintenance, routing, or reproduction, but it cannot create energy, force a movement target, bypass adjacency, make a bond immortal, or override ordinary lifecycle rules. A motif must continue proving its usefulness, and changed topology or failed work weakens its record. This preserves the project's original question: whether useful computation and organization can arise from simple prime-generated organisms, rather than being inserted as a predefined intelligence.

## Historical foundations: Phases 13–15.5

Phase 14 added distributed state without introducing a new prime. Prime 13 retains an organism's prior-tick state, and Prime 31 exposes that value one active bond hop away as an anonymous generated graph input. Phase 13 ecological differentiation remains active: food has green, blue, and red resource identities, and every tile has locally exhaustible fertility.

Structural homeostasis makes the world energy budget inspectable. Fertility-driven food regrowth is recorded as primary productivity, while bonds can return a small, lossy reserve transfer to an attached low-energy member. Bonds store and redistribute existing energy; they never create it.

Structural inheritance lets an actively bonded Prime-31 parent bud a child into an adjacent open tile. If the child retains Prime 31, its parent invests energy into a weak bond seed that must mature under the normal proximity and maintenance rules. Mutation can still remove Prime 31, producing an unbonded descendant.

Phase 15 begins distributed processing with collective navigation. Bonded Prime-17 organisms pool only their generated directional scores, then translate in the strongest legal collective direction. A resource's score depends on the observer's existing metabolic expression; no bond member transmits an action or receives a hard-coded food target.

Strong closed facets also receive bounded collective harvest capital only when a member consumes a resource. This capital belongs to the exact three-member topology, not to any body or ordinary bond reserve. When it reaches the birth threshold, it can seed two inherited bonds for a locally born Prime-31 child. A child that mutates away Prime 31 cannot inherit this capital. The UI reports held and spent capital separately from world primary productivity.

Phase 15.5 gives structure an ecological role. Red food is low-energy catalytic material: a strong closed Prime-31 facet can retain it, then spend one catalyst after twelve maintained ticks near detritus or ash to restore that local patch. Refining consumes existing material, restores fertility, and releases ordinary local food and nutrients; it never deposits energy directly into an organism or creates primary productivity. Every completed restoration also creates one bounded facet-owned nursery credit, which can provide a local structural birth opportunity only when the child retains Prime 31.

Strong facets use their existing Prime-17 directional field contextually: catalyst-poor facets value nearby red food, while catalyst-loaded facets value nearby detritus and ash. Global reproduction opportunity is deliberately bounded at 16%, leaving time for this delayed ecological cycle to matter.

Environmental state is represented as named world layers. Fertility is the first canonical layer and remains compatible with the existing chemistry view; future layers such as moisture, shelter, temperature, or signal conductivity can be added without changing tile identity.

## Collective work: consensus gates

Consensus gates are the first explicit problem-solving task in the world. Each visible three-port gate alternates between an **observe** phase and a **respond** phase. During observation it gives nearby Prime-19 organisms different local signal fragments. A complete, strong facet whose members also carry Prime 13, 19, and 31 must retain and exchange those fragments, then hold one converged state band through the response phase. The task measures agreement, not impossible exact recall of a continuously changing floating-point value. After the required consecutive consensus ticks, the gate releases a bounded set of ordinary food units nearby.

The gate never transfers energy into organisms. Success activates a visible, local production field that gradually creates ordinary food at the three work ports physically occupied by the responsible facet. Its green aura and port rings disappear if that facet leaves or dissolves, and it fades unless consensus is renewed; a nearby working facet’s existing Prime-17 field scores the active region as valuable and can harvest the resulting food. An individual cannot complete the task because it cannot form a three-member closed facet or receive direct neighbor state. This is deliberately an unfamiliar computational ecology rather than an imitation of a known food chain: facets are being tested as small distributed state machines with a survival-relevant job.

The Evolution Lab’s gate screen compares matched **gate-enabled** and **gate-disabled** worlds. It fixes food, mutation, reproduction, founder mix, and seed, disables the refinery in both arms, and records gate attendance, completions, gate-derived food, Prime-31 frequency, bonds, facets, lineage age, and extinctions. It is a selection test, not a reward guarantee.

Mobile couriers are disabled by default and can be enabled from Settings for a controlled experiment. A loose high-energy organism with Prime 19 and Prime 13 can carry one finite report only about a nearby actionable gate: its location and ready/observe phase. Food remains locally sensed by Prime 17 and is deliberately not courier-reported. When a scout comes near a bonded facet compound, the compound briefly retains that gate report and its Prime-17 directional scores gain an added gradient toward the reported location. Cyan rings identify active gate reports. The Evolution Lab includes matched gates-with-couriers and gates-without-couriers controls.

The canvas retains an observational **facet-work trail**. Each tick that a strong closed facet occupies a cell adds to its history, now rendered as a faint cyan wash rather than gold squares. It resets with the world and is never read by organisms or used by any ecological rule. Long runs therefore reveal where structural work concentrated, migrated, or disappeared without altering the simulation being measured.

## Phase 16: Environmental Memory

Every cell now has a neutral `[0, 1]` environmental-memory scalar with slow deterministic decay and synchronous cardinal diffusion. Prime 41 adds an energy-costly graph write effector; Prime 43 adds a graph read sensor. Neither has a built-in interpretation and environmental memory never directly changes food, energy, movement, reproduction, signals, gates, or any other ecological system. The Settings panel can show or hide its blue-purple visualization without altering the layer. The Evolution Lab compares memory-disabled, write-only, read-only, and read+write mutation availability conditions under the same gate ecology.

## Energetic Economics

Energetic Economics is an observation phase, not a new survival mechanism. Every organism now retains a lifetime energy ledger and the simulation aggregates it into 100-tick windows. The ledger separates food and gate-work income from movement, baseline/genome maintenance, perception, bond coupling, memory writing, signals, and idle costs. Reproduction and structural bond seeding are reported as **allocations**: they move energy into a child or structural reserve rather than destroy it. Each death records its immediate cause, while the world reports food energy that remains physically available but unharvested. This makes a population crash inspectable without falsely treating energy transfers as costs or claiming that all available food was accessible.

The ledger also records surplus discarded at an organism's finite energy-storage ceiling. An initial capacity mechanism screen shows that reducing this overflow greatly increases short-run births and facets, but it also produces much denser populations. Storage capacity therefore remains an experimental variable, not a new live-world rule, until long-horizon replicated persistence results are available.

An additional disabled-by-default structural-overflow experiment can retain a lossy fraction of otherwise discarded surplus in an existing bond or closed-facet reserve. The first matched screen found a small directional benefit for bond capture and an unfavorable facet-capture result because reserve capacity fills quickly. It is an experimental diagnostic, never an automatic live-world subsidy.

The live world now enables a separate **critical-only one-hop relay**: after ordinary direct bond support fails, a member at energy `<= 2` may receive one bounded, lossy relay from an adjacent reserve-rich bond through their shared partner. It is not a global pool, cannot help loose organisms, respects reserve floors and capacities, and remains available as an off control for matched experiments. Its short-run evidence is promising but not yet a long-horizon persistence claim.

## Phase 16: Energy Logistics

Energy Logistics extends the ledger into a bounded per-tick research time series. It records population turnover, energy stocks and flows, bond and facet reserves, gate activity, reproductive investment, lineage longevity, and energy inequality (minimum, maximum, mean, median, standard deviation, and Gini coefficient). It is diagnostic only: no ecological rule changes. The full protocol and interpretation constraints are in `PHASE_16_ENERGY_LOGISTICS.md`.

The live default seed is `160103`, selected because it reproducibly exhibits a rich early structural phase under the current configuration. It is a demonstrator and research baseline, not a claim of guaranteed long-horizon persistence; changing world settings or the seed defines a different experiment.

The first 1,000-tick matched screen established that gates are survival-critical in the task-rich resource-limited setting: all gate-disabled replicates went extinct, while gate-enabled replicates persisted and reached later generations. Gate production is now port-coupled to the three occupied cells of the exact working facet and records provenance on every food unit. A matched 500-tick production sweep found a viable high-output port regime: 95 mean final facets and 56.7 bonds, versus 5 facets and 13.3 bonds for the matched diffuse-field control. The default port rate is therefore 0.9 ordinary food units per field-strength tick. Output remains physical and contestable; the remaining research question is its longer-horizon stability, not whether it can support a rich structural phase. Full method and results are in `EVOLUTIONARY_VALIDATION_HANDOFF.md`.

## Niche-dependence experiment

The current ecology experiment deliberately avoids terrain. All four conditions use the same open world, founder population, chemistry, mutation rate, and Prime-31 starting frequency. They differ only in background food supply and whether a refined patch is actively maintained.

- **Abundant:** ordinary food is plentiful, so a facet niche should provide little selective advantage.
- **Intermediate:** ordinary food is reduced; a maintained niche may improve local reliability without being essential.
- **Scarce, maintained:** background food is scarce. A facet that has completed a refinery restoration holds a bounded engineered-fertility gradient. That gradient decays without the facet, and while it is maintained it receives a limited number of preferential local food-growth attempts. It creates food as normal primary production; it never transfers energy directly to organisms.
- **Scarce, maintenance disabled:** the matched negative control. Refinery restoration can still occur, but its gradient is allowed to decay and receives no continuing reinforcement.

This design makes the causal claim testable: if maintained facets are ecologically necessary, scarce-maintained runs should retain more structural lineages, active bonds, and refinery/niche activity than the matched maintenance-disabled control. It does **not** assume the result; the lab records extinctions and failed invasions too.

## Foundational Phase 7 goals

- Establish a clean simulation engine with clear module boundaries.
- Construct the running physics configuration from a factorized world number.
- Register each supported prime-to-generator mapping in one inspectable server-side registry.
- Show the active recipe, factorization, and generator chain in the browser UI.
- Give every organism an inspectable prime-factor genome and generated capability profile.
- Preserve an organism's genome unchanged across reproduction.
- Generate and inspect a deterministic brain graph for every organism.
- Execute generated brain graphs on every simulation tick without behavior trees or neural networks.
- Mutate heredity through prime arithmetic only; never rewrite a graph directly.
- Make Prime 13 a general persistent-node primitive.
- Make every experiment deterministic and reproducible from a server-owned world seed.
- Keep the simulation running on the server as the source of truth.
- Provide a browser control panel to start, pause, resume, step, reset, and randomize the world.
- Expose extension points for future phases: genomes, virtual CPU, memory, mutation, communication, and richer evolution.

## Prime roadmap boundary

The project will not hardcode intelligence. Phase 3 registers `2` movement, `3` energy, `5` resources, `7` reproduction, and `11` terrain. The default world recipe is `2310 = 2 x 3 x 5 x 7 x 11`; `210 = 2 x 3 x 5 x 7` omits terrain. Phase 4 uses the founder genome `210 = 2 x 3 x 5 x 7`: locomotion, metabolism, digestion, and reproduction. Phase 6 executes the resulting graph: energy and food sensors feed energy state, movement, consumption, and reproduction effectors. Prime-17 organisms now generate cardinal direction outputs from their neighborhood inputs; the server moves them along the strongest legal graph-selected direction. Organisms without Prime 17 retain random movement as a sensory fallback.

## Project structure

- `package.json`: minimal Node.js scripts for running the project.
- `server/index.js`: static file server plus JSON API for simulation control and snapshots.
- `server/simulation/config.js`: all simulation constants and tunable defaults.
- `server/simulation/prime-registry.js`: Phase 3 factorization and inspectable prime-to-generator registry.
- `server/simulation/generator-engine.js`: constructs a physics configuration from a registered prime composition.
- `server/simulation/genome-engine.js`: Phase 4 deterministic organism genome construction.
- `server/simulation/brain-generator.js`: Phase 5 deterministic brain graph generation.
- `server/simulation/brain-executor.js`: graph propagation, persistent-node state, and effector output engine.
- `server/simulation/mutation-engine.js`: Phase 7 arithmetic genome mutation engine.
- `server/simulation/utils.js`: reusable math, randomization, color, and formatting helpers.
- `server/simulation/world.js`: toroidal tile world with resources, fertility, chemistry, and wall management.
- `server/simulation/organism.js`: organism model, graph-based directional selection, resource metabolism, persistent state, and one-hop bonded-state sensing.
- `server/simulation/simulation.js`: core engine, lifecycle rules, statistics, scheduling, and control actions.
- `public/index.html`: control panel and canvas application shell.
- `public/style.css`: responsive visualization and dashboard styling.
- `public/renderer.js`: canvas renderer for tiles, organisms, and optional grid.
- `public/main.js`: browser UI controller, polling loop, and API interactions.

## How it works

The server owns the entire simulation state. The browser never simulates organisms locally. Instead:

1. The Node.js server runs a long-lived `Simulation` instance.
2. The UI fetches snapshots from the API at a steady rate.
3. Control actions from the UI call server endpoints.
4. The renderer draws the latest server snapshot onto a canvas.

This keeps the architecture aligned with future deployment, persistence, and multi-client monitoring needs.

## Running locally

1. Open a terminal in the project folder.
2. Run `npm start`.
3. Open `http://localhost:3000`.

## API overview

- `GET /api/state`: current world snapshot, organisms, settings, and statistics.
- `POST /api/control`: control actions such as `pause`, `resume`, `step`, `reset`, and `randomize`.
- `POST /api/settings`: update speed, food growth rate, initial population, or grid visibility.

## Foundational Phase 7 behavior

- World size: `64 x 64`
- Tiles: `EMPTY`, `FOOD`, `WALL`
- Organisms: 24 by default
- Movement: graph-based cardinal choice for Prime-17 organisms; random fallback without directional perception
- Resources: green (Prime-5 digestion weighted), blue (Prime-3 energy weighted), and red (Prime-19 signal weighted)
- Fertility: harvesting lowers local fertility; slow recovery governs where food can regrow
- Default food growth: tuned to retain a small baseline population for the initial seed
- Energy: consumed by movement, restored by eating
- Reproduction: duplicates when energy passes a threshold
- Statistics: simulation time, fps estimate, population, births, deaths, average age, oldest organism, average energy, food count
- Reproducibility: resetting a world recreates it from its displayed seed; changing the seed creates a new inspectable experiment
- World recipe: the server factorizes `2310` by default and applies its registered generators to construct the active configuration
- Founder genome: `210` constructs locomotion (`2`), metabolism (`3`), digestion (`5`), and reproduction (`7`)
- Inspection: clicking a living organism reveals its factorization, generated capabilities, energy, age, and lineage
- Brain graph: clicking an organism also reveals its generated sensors, internal state nodes, effectors, and edges
- Brain execution: live node values propagate through the graph each tick and gate movement, food consumption, and reproduction
- Arithmetic heredity: a child has a 2% chance to gain Prime 13, lose one existing generator, or strengthen an existing generator through a prime power
- Prime powers: repeated `3` expands energy capacity, repeated `5` improves food energy with diminishing returns, and repeated `7` lowers the reproduction energy threshold with diminishing returns; Phase 7 caps powers at three
- Persistence: Prime `13` replaces direct energy-to-action links with a one-tick persistent state node, evaluated deterministically as read-then-write
- Ecology: food regrows up to an 18% world carrying capacity; amplified genes and persistence consume maintenance energy each tick
- Facet refinery: strong Prime-31 triangles can recover existing detritus or ash after sustained local contact; conversions, released food, and recovered nutrients are live telemetry

## Extension roadmap

Future phases can add:

- prime-based genomes or compositional encodings
- instruction sets and virtual CPUs
- mutable memory and sensors
- richer environments and resource types
- persistence with SQLite
- experiment logging and replay tools
- server deployment with PM2 and GitHub sync

Phase 7 makes inheritance arithmetic. Prediction, communication, abstraction, planning, and richer persistent structures remain future phases.

## Collective memory layer (switchable)

The experimental `bond.collectiveMemory` layer starts disabled and can be
enabled without changing the baseline seed or world recipe. Useful events emit
bounded pulses through existing bonds; organisms and bonds retain decaying
traces, and repeated event locations can provide a small movement and energy
routing bias. Pulses never create energy, override legal movement, or privilege
a named geometric shape. The current implementation covers food, gate
completion, migration arrival, reproduction, and member-support pulses;
inheritance/consolidation diagnostics are intentionally staged for later work.

### Proactive topology reproduction (experimental)

When topology memory is enabled, a stable, repeatedly useful facet may fund a
local child from its component reserve before age-driven reproduction occurs.
The birth requires real reserve above a post-birth buffer, an energy floor for
all facet members, a free adjacent site, and a cooldown. A small reserve
investment seeds two bonds and the child receives only bounded local trace
inheritance. Births are capped per tick and per run; no energy is created and
ordinary adjacency, reserve, and lifecycle rules still apply. This keeps the
mechanism topology-native rather than selecting named shapes.
