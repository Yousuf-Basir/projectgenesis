# Reincarnation Intelligence Loop

This branch (`codex/reincarnation-intelligence-loop`) runs Project Genesis as a sequence of bounded, inspectable worlds. A world lasts 1,000 simulation ticks. At the boundary, the current world is scored, its result is retained, and a new world is seeded with a different environmental recipe.

## What changes between worlds

Recipes vary environmental and ecological parameters only:

- food growth and replenishment attempts;
- gate discovery and navigation;
- resource-funded physical reserves;
- dormant-bond availability;
- collective movement cost.

Organism code, pretrained data, and external labels are never injected. The organisms receive only the world, local resources, local gate reports, and their existing topology/pulses.

## Cycle policy

Updated 2026-10-23: selection now creates bounded recipe mutations after the initial curriculum, and surviving members can seed mutated descendants among newcomers. See [REINCARNATION_EVOLUTION.md](REINCARNATION_EVOLUTION.md) for the current selection objective, inheritance rules, limitations, and validation. The original policy below describes the earlier implementation.

The controller explores each recipe once. Afterwards it selects the next recipe adjacent to the best-scoring result, using a transparent search rather than a hidden model. Each result records population, births, deaths, bonds, facets, gate sightings, relays, consensus, gate completions, and bond turnover.

The score rewards:

- population retention;
- connected structure and facets;
- gate consensus and completed environmental work;
- continuity without assuming survival alone is intelligence.

Low-scoring cycles are explicitly marked as exploration. A high score is not a claim of intelligence; it is a cue for the next controlled comparison.

## Topology continuity

At the boundary, every surviving bonded structure with at least three members is carried into the next world (with a minimum of four total living members required for a meaningful carry). The organisms keep their absolute canvas positions, topology, traces, and bond/component reserves, with a 10% reserve transition loss. The fresh population is retained too, so old structures and new organisms can interact in the changed environment; only colliding runtime IDs are remapped. If no meaningful structure survives, the cycle starts from the fresh population alone. This creates a visible continuity test: the same morphologies encounter a new world, interact with new resources and newcomers, and either adapt, consolidate, or fail.

## Live observability

The API snapshot exposes `reincarnation` with the current recipe, cycle, generation, remaining ticks, last score, and bounded history. The live canvas header displays the cycle and recipe. The default branch behavior is not changed by this work; this branch starts the loop enabled for observation.

## Safety and interpretation

- No pulse creates energy.
- Resource-funded mode uses physical harvest and bounded transfers.
- Dormant bonds pay reduced upkeep but cannot communicate until a nearby food or available gate cue wakes them.
- Gate information remains local, decaying, and quorum-based.
- A cycle reset is a deliberate experimental boundary, not evidence that a morphology reproduced itself.

Run the server with `node server/index.js` and watch `http://localhost:3000/`. Use `/api/state` to inspect the current recipe and cycle history.
