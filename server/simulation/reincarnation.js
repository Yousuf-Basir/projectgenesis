// Bounded, inspectable world cycling for the exploratory intelligence branch.
// A cycle changes environmental parameters, never organism code or learned data.
import { Organism } from "./organism.js";

export class ReincarnationController {
  constructor({ cycleTicks = 1000, seed = 160103, enabled = true, maximumHistory = 24, evolutionEnabled = true, workRewardsEnabled = true, adaptiveShrinkingEnabled = false, energyConservationEnabled = false, harvestMemberSupportEnabled = false, adaptiveMorphologyEnabled = false } = {}) {
    this.cycleTicks = cycleTicks;
    this.seed = seed;
    this.enabled = enabled;
    this.maximumHistory = maximumHistory;
    this.generation = 0;
    this.cycle = 0;
    this.history = [];
    this.recipe = null;
    this.lastResult = null;
    this.nextReason = "initial world";
    this.carriedComponentSize = 0;
    this.carriedBondCount = 0;
    this.carriedFacetCount = 0;
    this.lastCarry = null;
    this.evolutionEnabled = evolutionEnabled;
    this.workRewardsEnabled = workRewardsEnabled;
    this.adaptiveShrinkingEnabled = adaptiveShrinkingEnabled;
    this.energyConservationEnabled = energyConservationEnabled;
    this.harvestMemberSupportEnabled = harvestMemberSupportEnabled;
    this.adaptiveMorphologyEnabled = adaptiveMorphologyEnabled;
    this.searchState = seed >>> 0;
    this.inheritance = { descendants: 0, mutations: 0 };
  }

  random() {
    this.searchState = (Math.imul(this.searchState, 1664525) + 1013904223) >>> 0;
    return this.searchState / 4294967296;
  }

  recipes() {
    return [
      {
        name: "resource-foraging",
        resourceFunded: true,
        foodGrowthRate: 0.45,
        foodAttempts: 8,
        gateDiscovery: true,
        navigation: true,
        dormantBonds: true,
        movementCostMultiplier: 0.9
      },
      {
        name: "gate-consensus",
        resourceFunded: true,
        foodGrowthRate: 0.32,
        foodAttempts: 6,
        gateDiscovery: true,
        navigation: true,
        dormantBonds: true,
        movementCostMultiplier: 0.8
      },
      {
        name: "distributed-memory",
        resourceFunded: true,
        foodGrowthRate: 0.42,
        foodAttempts: 8,
        gateDiscovery: true,
        navigation: false,
        dormantBonds: true,
        movementCostMultiplier: 1
      },
      {
        name: "scarcity-recovery",
        resourceFunded: true,
        foodGrowthRate: 0.24,
        foodAttempts: 5,
        gateDiscovery: true,
        navigation: true,
        dormantBonds: true,
        movementCostMultiplier: 0.7
      }
    ];
  }

  chooseRecipe() {
    const recipes = this.recipes();
    // Explore every recipe once, then revisit the best-scoring recipe with a
    // new seed. This is a transparent bandit-like search, not pre-trained data.
    if (this.generation < recipes.length) return recipes[this.generation];
    if (!this.evolutionEnabled) return recipes[this.generation % recipes.length];
    const ranked = [...this.history].sort((a, b) => b.selectionScore - a.selectionScore);
    const parent = this.random() < 0.25
      ? recipes[Math.floor(this.random() * recipes.length)]
      : ranked[Math.floor(this.random() * Math.min(3, ranked.length))].recipe;
    const bounds = { foodGrowthRate: [0.2, 0.5, 0.04], foodAttempts: [4, 10, 1], movementCostMultiplier: [0.6, 1.1, 0.08] };
    const key = Object.keys(bounds)[Math.floor(this.random() * 3)];
    const [minimum, maximum, step] = bounds[key];
    let value = Math.max(minimum, Math.min(maximum, parent[key] + (this.random() < 0.5 ? -step : step)));
    if (value === parent[key]) value = parent[key] === minimum ? minimum + step : maximum - step;
    return { ...parent, name: `evolved-${this.generation}`, parentRecipe: parent.name, mutation: { parameter: key, before: parent[key], after: Number(value.toFixed(3)) }, [key]: Number(value.toFixed(3)) };
  }

  captureComponent(simulation) {
    const groups = simulation.getBondGroups().filter((group) => group.length >= 3);
    if (!groups.length) return null;
    const ids = new Set(groups.flat());
    const members = [...ids]
      .map((id) => simulation.organisms.find((organism) => organism.id === id))
      .filter((organism) => organism?.alive);
    if (members.length < 4) return null;
    const internalBonds = [...simulation.bonds.values()].filter((bond) => ids.has(bond.firstId) && ids.has(bond.secondId));
    const internalFacets = simulation.getFacets().filter((facet) => facet.memberIds.every((id) => ids.has(id)));
    return {
      members,
      positions: members.map((member) => ({ id: member.id, x: member.x, y: member.y })),
      bonds: internalBonds.map((bond) => ({ ...bond })),
      facetCount: internalFacets.length,
      reserves: [...simulation.componentReserves.entries()]
        .filter(([key]) => key.split(":").every((id) => ids.has(Number(id))))
        .map(([key, value]) => [key, value])
    };
  }

  restoreComponent(simulation, carried) {
    if (!carried) {
      this.carriedComponentSize = 0;
      this.carriedBondCount = 0;
      this.carriedFacetCount = 0;
      this.lastCarry = null;
      return;
    }
    // Keep the freshly seeded population as the new world's newcomers. Add the
    // carried organisms alongside it, remapping only IDs that could collide;
    // their positions and topology remain unchanged on the canvas.
    if (this.adaptiveMorphologyEnabled) {
      const carriedPositions=new Set(carried.members.map(member=>`${member.x},${member.y}`));
      const occupied=new Set([...carriedPositions,...simulation.organisms.map(member=>`${member.x},${member.y}`)]);
      for(const member of carried.members) {
        if(!simulation.world.isWalkable(member.x,member.y)) simulation.world.setTileType(member.x,member.y,'EMPTY');
      }
      for(const newcomer of simulation.organisms) {
        if(!carriedPositions.has(`${newcomer.x},${newcomer.y}`)) continue;
        const site=simulation.world.findRandomOpenPosition(occupied);
        if(!site) throw new Error('No free position for a newcomer beside carried structures.');
        newcomer.x=site.x;newcomer.y=site.y;occupied.add(`${site.x},${site.y}`);
      }
    }
    let nextId = Math.max(0, ...simulation.organisms.map((organism) => organism.id)) + 1;
    const idMap = new Map();
    for (const member of carried.members) {
      const oldId = member.id;
      const newId = nextId;
      nextId += 1;
      idMap.set(oldId, newId);
      member.id = newId;
      member.alive = true;
      member.energy = Math.max(1, Math.min(member.energy, simulation.config.organism.startingEnergy * 1.25));
      member.random = simulation.random;
      member.collectiveStrideActive = false;
      member.collectiveTransportActive = false;
      simulation.organisms.push(member);
      if (member.lineageId !== undefined && !simulation.lineageBirthTicks.has(member.lineageId)) {
        simulation.lineageBirthTicks.set(member.lineageId, -member.age);
      }
    }
    for (const bond of carried.bonds) {
      const firstId = idMap.get(bond.firstId);
      const secondId = idMap.get(bond.secondId);
      if (firstId === undefined || secondId === undefined) continue;
      const carriedBond = {
        ...bond,
        firstId,
        secondId,
        reserve: Math.max(0, (bond.reserve ?? 0) * 0.9),
        dormant: Boolean(bond.dormant)
      };
      simulation.bonds.set(simulation.bondKey(firstId, secondId), carriedBond);
    }
    for (const [key, value] of carried.reserves ?? []) {
      const remappedIds = key.split(":").map(Number).map((id) => idMap.get(id)).filter((id) => id !== undefined);
      if (remappedIds.length) {
        simulation.componentReserves.set(simulation.componentReserveKey(remappedIds), Math.max(0, value * 0.9));
      }
    }
    simulation.births += carried.members.length;
    simulation.nextOrganismId = nextId;
    simulation.bondGroupsCache = null;
    this.carriedComponentSize = carried.members.length;
    this.carriedBondCount = carried.bonds.length;
    this.carriedFacetCount = carried.facetCount ?? 0;
    this.lastCarry = {
      members: this.carriedComponentSize,
      bonds: this.carriedBondCount,
      facets: this.carriedFacetCount,
      reserveTransitionLoss: 0.1
    };
  }

  applyRecipe(simulation, recipe, carried = null) {
    simulation.config.bond.resourceFundedSurvival.enabled = Boolean(recipe.resourceFunded);
    simulation.config.bond.usefulWorkReward.enabled = this.workRewardsEnabled;
    simulation.config.bond.adaptiveShrinking.enabled = this.adaptiveShrinkingEnabled;
    simulation.config.bond.energyConservation.enabled = this.energyConservationEnabled;
    simulation.config.bond.harvestMemberSupport.enabled = this.harvestMemberSupportEnabled;
    simulation.config.bond.adaptiveMorphology.enabled = this.adaptiveMorphologyEnabled;
    simulation.config.bond.dormantBonds.enabled = Boolean(recipe.dormantBonds);
    simulation.config.collectiveWork.gateDiscovery.enabled = Boolean(recipe.gateDiscovery);
    simulation.config.collectiveWork.navigation.enabled = Boolean(recipe.navigation);
    simulation.config.food.growthRate = recipe.foodGrowthRate;
    simulation.config.food.maxGrowthAttemptsPerTick = recipe.foodAttempts;
    simulation.config.collectiveWork.collectiveStride.movementCostMultiplier = recipe.movementCostMultiplier;
    simulation.setGuidedStructuralIntelligenceEnabled(false);
    simulation.setGuidedSupportedDevelopmentEnabled(false);
    simulation.config.guidedStructuralIntelligence.supportedDevelopment.unconditionalSupportEnabled = false;
    this.recipe = { ...recipe };
    simulation.setSeed(this.seed + this.generation * 9973 + this.cycle * 101);
    this.inheritance = { descendants: 0, mutations: 0 };
    if (this.evolutionEnabled && carried?.members.length) {
      // Replace half of the declared fresh population with descendants. Their
      // energy comes from the same reset budget as ordinary newcomers.
      const parents = [...carried.members].sort((a, b) =>
        (b.age / Math.max(1, simulation.config.organism.maxAge) + b.energy / Math.max(1, simulation.config.organism.startingEnergy))
        - (a.age / Math.max(1, simulation.config.organism.maxAge) + a.energy / Math.max(1, simulation.config.organism.startingEnergy)));
      const elite = parents.slice(0, Math.max(1, Math.ceil(parents.length / 3)));
      for (let index = 0; index < Math.floor(simulation.organisms.length / 2); index += 1) {
        const newcomer = simulation.organisms[index];
        const parent = elite[Math.floor(this.random() * elite.length)];
        const mutation = this.random() < 0.25
          ? simulation.mutationEngine.mutate(parent.genome, () => this.random(), simulation.config.organism.mutationPrimes) : null;
        const profile = simulation.genomeEngine.construct(mutation?.after ?? parent.genome);
        simulation.organisms[index] = new Organism({ id: newcomer.id, x: newcomer.x, y: newcomer.y,
          energy: newcomer.energy, genomeProfile: profile, brain: simulation.brainGenerator.generate(profile),
          random: simulation.random, generation: parent.generation + 1, mutation,
          nodeTrace: Math.min(0.2, (parent.nodeTrace ?? 0) * 0.1) });
        this.inheritance.descendants += 1;
        simulation.organisms[index].morphologyPreferences = Object.fromEntries(Object.entries(parent.morphologyPreferences??{}).map(([key,value])=>[key,value*0.1]));
        if (mutation) this.inheritance.mutations += 1;
      }
    }
    this.restoreComponent(simulation, carried);
    this.startPopulation = simulation.organisms.length;
    simulation.resume();
  }

  score(simulation) {
    const stats = simulation.getStatistics();
    const discovery = simulation.gateDiscoveryStats ?? {};
    const telemetry = simulation.telemetry ?? {};
    const populationRetention = stats.population / Math.max(1, simulation.config.organism.initialPopulation);
    const structure = stats.bonds + simulation.getFacets().length * 2;
    const interaction = (discovery.consensuses ?? 0) * 2 + (simulation.collectiveWorkCompletions ?? 0) * 3;
    const continuity = Math.max(0, stats.population - (simulation.deaths ?? 0) * 0.25);
    const score = Number((populationRetention * 10 + structure + interaction + continuity).toFixed(3));
    const selectionScore = Number((Math.min(2, stats.population / Math.max(1, this.startPopulation ?? stats.population))
      + Math.min(1, stats.bonds / Math.max(1, simulation.bondsFormed ?? 0))
      + Math.min(1, (simulation.collectiveWorkCompletions ?? 0) / Math.max(1, stats.population))
      + Math.min(1, simulation.getFacets().length / Math.max(1, stats.population))).toFixed(4));
    return {
      selectionScore,
      tick: stats.tick,
      population: stats.population,
      births: stats.births,
      deaths: stats.deaths,
      bonds: stats.bonds,
      facets: simulation.getFacets().length,
      food: stats.foodCount,
      gateSightings: discovery.sightings ?? 0,
      gateRelays: discovery.relays ?? 0,
      gateConsensuses: discovery.consensuses ?? 0,
      gateCompletions: simulation.collectiveWorkCompletions ?? 0,
      bondsFormed: telemetry.bondsFormed ?? simulation.bondsFormed ?? 0,
      bondsBroken: telemetry.bondsBroken ?? simulation.bondsBroken ?? 0,
      populationRetention: Number(populationRetention.toFixed(3)),
      score
    };
  }

  observe(simulation) {
    if (!this.enabled || simulation.simulationTicks < this.cycleTicks) return false;
    const carried = this.captureComponent(simulation);
    const result = this.score(simulation);
    const completed = {
      generation: this.generation,
      cycle: this.cycle,
      recipeIndex: this.recipes().findIndex((recipe) => recipe.name === this.recipe?.name),
      recipe: this.recipe,
      inheritance: { ...this.inheritance },
      ...result
    };
    this.history.push(completed);
    if (this.history.length > this.maximumHistory) this.history.shift();
    this.lastResult = completed;
    this.generation += 1;
    this.cycle += 1;
    const next = this.chooseRecipe();
    this.nextReason = next.mutation ? `Testing ${next.mutation.parameter} mutation from ${next.parentRecipe}` : "sampling initial environmental recipes";
    this.applyRecipe(simulation, next, carried);
    return true;
  }

  snapshot(simulation = null) {
    const tick = simulation?.simulationTicks ?? 0;
    return {
      enabled: this.enabled,
      cycleTicks: this.cycleTicks,
      generation: this.generation,
      cycle: this.cycle,
      currentRecipe: this.recipe,
      evolutionEnabled: this.evolutionEnabled,
      workRewardsEnabled: this.workRewardsEnabled,
      adaptiveShrinkingEnabled: this.adaptiveShrinkingEnabled,
      energyConservationEnabled: this.energyConservationEnabled,
      harvestMemberSupportEnabled: this.harvestMemberSupportEnabled,
      adaptiveMorphologyEnabled: this.adaptiveMorphologyEnabled,
      inheritance: this.inheritance,
      ticksRemaining: Math.max(0, this.cycleTicks - tick),
      nextReason: this.nextReason,
      lastResult: this.lastResult,
      carriedComponentSize: this.carriedComponentSize,
      carriedBondCount: this.carriedBondCount,
      carriedFacetCount: this.carriedFacetCount,
      lastCarry: this.lastCarry,
      history: this.history.slice(-this.maximumHistory)
    };
  }
}
