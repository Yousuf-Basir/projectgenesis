import { BASE_CONFIG, DEFAULT_CONFIG, DIRECTIONS, RESOURCE_TYPES, TILE_TYPES } from "./config.js";
import { DEFAULT_GENERATOR_ENGINE } from "./generator-engine.js";
import { DEFAULT_GENOME_ENGINE } from "./genome-engine.js";
import { DEFAULT_BRAIN_GENERATOR } from "./brain-generator.js";
import { DEFAULT_BRAIN_EXECUTOR } from "./brain-executor.js";
import { DEFAULT_MUTATION_ENGINE } from "./mutation-engine.js";
import { Organism } from "./organism.js";
import { shrinkAtRiskComponents } from "./adaptive-shrinking.js";
import { updateEnergyConservation } from "./energy-conservation.js";
import { supportFromNeighbourSurplus } from "./neighbour-support.js";
import { shareFreshHarvest } from "./harvest-member-support.js";
import { prepareFoodPantries, storeHarvest, loseDeadPantry, pantrySnapshot } from './food-pantries.js';
import { prepareAdaptiveMorphology, applyMorphologyEnvironment, fieldAt, localResourceValue, foragingNeed } from "./adaptive-morphology.js";
import { World } from "./world.js";
import { average, clamp, createSeededRandom, normalizeSeed } from "./utils.js";
import { createDefaultSurvivalCueGrid, createGuidedInput, setGuidedGrid, setGuidedPattern, serializeGuidedInput } from "./guided-input.js";

const MAX_TELEMETRY_EVENTS = 1000;
const MAX_PRIMARY_PRODUCTION_MARKERS = 90;
const MAX_GATE_CAPTURE_RECORDS = 1000;
const MAX_OVERFLOW_ROUTING_RECORDS = 1000;

export class Simulation {
  constructor(config = DEFAULT_CONFIG) {
    this.generatorEngine = DEFAULT_GENERATOR_ENGINE;
    this.genomeEngine = DEFAULT_GENOME_ENGINE;
    this.brainGenerator = DEFAULT_BRAIN_GENERATOR;
    this.brainExecutor = DEFAULT_BRAIN_EXECUTOR;
    this.mutationEngine = DEFAULT_MUTATION_ENGINE;
    this.baseConfig = structuredClone(BASE_CONFIG);
    this.worldNumber = config.universe.worldNumber ?? this.baseConfig.universe.worldNumber;
    this.config = this.generatorEngine.generate(this.baseConfig, this.worldNumber).config;
    this.seed = normalizeSeed(this.config.universe.initialSeed);
    this.random = createSeededRandom(this.seed);
    this.world = new World(this.config.world, this.random);
    this.guidedInput = createGuidedInput({
      size: this.config.guidedStructuralIntelligence?.gridSize ?? 16,
      pattern: this.config.guidedStructuralIntelligence?.pattern ?? "horizontal-boundary",
      enabled: this.config.guidedStructuralIntelligence?.enabled ?? false
    });
    this.guidedInput = setGuidedGrid(
      this.guidedInput,
      createDefaultSurvivalCueGrid(this.guidedInput.size),
      "default-survival-cue"
    );
    this.organisms = [];
    this.nextOrganismId = 1;
    this.isPaused = false;
    this.gridEnabled = false;
    this.facetTrailEnabled = true;
    // Batch experiments may omit canvas-only state without changing ecology.
    this.headlessObservationMode = false;
    this.speed = this.config.simulation.defaultSpeed;
    this.tickIntervalMs = 1000 / this.config.simulation.tickRate;
    this.timer = null;
    this.lastTickTime = Date.now();
    this.simulationTicks = 0;
    this.births = 0;
    this.deaths = 0;
    this.resetEnergyEconomics();
    this.resetEnergyLogistics();
    this.fpsEstimate = 0;
    this.snapshotVersion = 0;
    this.deathMarkers = [];
    this.birthMarkers = [];
    this.energyTransfers = [];
    this.primaryProductionMarkers = [];
    this.facetWorkTrail = Array.from({ length: this.world.height }, () => Array(this.world.width).fill(0));
    this.compoundHeadings = new Map();
    this.bonds = new Map();
    this.componentReserves = new Map();
    this.componentReserveDeposited = 0;
    this.componentReserveWithdrawn = 0;
    this.componentReserveMemberSupport = 0;
    this.componentReserveBondFunding = 0;
    this.collectiveMemoryLocations = [];
    this.collectiveMemorySuccesses = new Map();
    this.topologyMotifs = new Map();
    this.topologyRoleCounts = { terminal: 0, hub: 0, core: 0, interior: 0 };
    this.topologyStableTicks = new Map();
    this.facetMotifMemory = new Map();
    this.facetMotifStableTicks = new Map();
    this.tetheredScoutEpisodes = new Map();
    this.tetheredScoutDiagnostics = {
      eligibleScouts: 0,
      activeEpisodes: 0,
      departures: 0,
      returns: 0,
      leashViolations: 0,
      energyAborts: 0,
      timeoutAborts: 0
      ,valueFinds: 0
      ,successfulReturns: 0
    };
    this.bondGroupsCache = null;
    this.bondCandidates = new Map();
    this.structuralBirthSeeds = new Map();
    this.facetReserves = new Map();
    this.telemetryEvents = [];
    this.bondsFormed = 0;
    this.bondsBroken = 0;
    this.bondBreakReasons = {};
    this.refineryProgress = new Map();
    this.facetCatalysts = new Map();
    this.facetNurseryCredits = new Map();
    this.facetNiches = new Map();
    this.refineryConversions = 0;
    this.nicheMaintenanceEnabled = true;
    this.refineryFoodReleased = 0;
    this.refineryNutrientsProduced = 0;
    this.deathResidueCreated = 0;
    this.deathResidueRecovered = 0;
    this.overflowPlumeCreated = 0;
    this.overflowPlumeCondensed = 0;
    this.overflowPlumeFoodReleased = 0;
    this.workGates = [];
    this.gateFacetAssignments = new Map();
    this.gateDiscoveryReports = new Map();
    this.gateDiscoveryTargets = new Map();
    this.gateDiscoveryStats = { sightings: 0, relays: 0, consensuses: 0 };
    this.collectiveWorkCompletions = 0;
    this.collectiveWorkFoodReleased = 0;
    this.collectiveWorkAttendances = 0;
    this.collectiveWorkFieldHarvests = 0;
    this.collectiveWorkFieldHarvestsByWorkers = 0;
    this.collectiveWorkFieldHarvestsByOthers = 0;
    this.collectiveGateNavigationMoves = 0;
    this.collectivePlumeNavigationMoves = 0;
    this.collectiveGateArrivals = 0;
    this.componentLifecycle = new Map();
    this.componentLifecycleDeferrals = 0;
    this.componentLifecycleMigrations = 0;
    this.collectiveCensusRecords = [];
    this.collectiveLineages = new Map();
    this.collectiveLineageEvents = [];
    this.previousCollectiveCensusCandidates = [];
    this.nextCollectiveLineageId = 1;
    this.collectiveWorkHarvestLineages = new Map();
    this.gateFoodCaptureRecords = [];
    this.nextGateFoodCaptureId = 1;
    this.gateFieldCycles = [];
    this.nextGateFieldCycleId = 1;
    this.componentEpisodes = [];
    this.nextComponentEpisodeId = 1;
    this.nextCourierReportId = 1;
    this.courierReportsCreated = 0;
    this.courierHandoffs = 0;
    this.nextCourierReportTick = 0;
    this.facetTransfers = 0;
    this.facetEnergyShared = 0;
    this.facetHarvests = 0;
    this.facetHarvestEnergy = 0;
    this.facetHarvestReserveEnergy = 0;
    this.facetBirths = 0;
    this.autonomousFacetBirths = 0;
    this.topologyProactiveBirths = 0;
    this.topologyProactiveBirthAttempts = 0;
    this.topologyProactiveBirthDenied = { reserve: 0, memory: 0, energy: 0, cooldown: 0, site: 0 };
    this.topologyProactiveBirthTicks = new Map();
    this.facetBuddingLedgers = new Map();
    this.autonomousFacetBuddingDenied = { cooldown: 0, componentEnergy: 0, completedCycle: 0 };
    this.facetReserveSpent = 0;
    this.bondsFed = 0;
    this.bondEnergyFed = 0;
    this.bondSupportTransfers = 0;
    this.bondSupportEnergyReleased = 0;
    this.structuralBirths = 0;
    this.structuralSeedEnergy = 0;
    this.collectiveMoves = 0;
    this.collectiveResourceDirectedMoves = 0;
    this.primaryResourceUnits = 0;
    this.primaryPotentialEnergy = 0;
    this.latestPrimaryProduction = 0;
    this.environmentMemoryWrites = 0;
    this.environmentMemoryDeposited = 0;
    this.environmentMemoryEnergySpent = 0;
    this.environmentMemoryLineages = new Map();
    this.environmentMemoryVisualizationEnabled = true;
    this.structuralOverflowCaptured = 0;
    this.structuralOverflowCapturedByMode = { bond: 0, facet: 0 };
    this.overflowRoutingRecords = [];
    this.resetOverflowProvenance();
    this.satietyMigrationDeferrals = 0;
    this.resetHarvestGeometry();
    this.starvationDiagnostics = [];
    this.bondRelayTransfers = 0;
    this.bondRelayEnergyWithdrawn = 0;
    this.bondRelayEnergyDelivered = 0;
    this.bondRelayRescues = 0;
    this.guidedSupportStats = { budgetSpent: 0, memberSupport: 0, bondReserveSupport: 0, quietBondTicks: 0, supportCredits: 0, supportRewards: 0 };
    this.guidedSupportCredits = 0;
    this.resetEnergyEconomics();
    this.resetEnergyLogistics();
    this.initializeWorkGates();
    this.seedInitialPopulation(this.config.organism.initialPopulation);
    this.start();
  }

  start() {
    this.stop();
    this.lastTickTime = Date.now();
    this.timer = setInterval(() => {
      this.runLoop();
    }, this.tickIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  runLoop() {
    if (this.isPaused) {
      return;
    }

    const ticksToRun = this.speed;
    for (let tick = 0; tick < ticksToRun; tick += 1) {
      this.step();
    }

    const now = Date.now();
    const elapsed = Math.max(1, now - this.lastTickTime);
    this.fpsEstimate = (ticksToRun * 1000) / elapsed;
    this.lastTickTime = now;
  }

  seedInitialPopulation(count) {
    const occupied = new Set();
    this.organisms = [];
    this.nextOrganismId = 1;

    for (let index = 0; index < count; index += 1) {
      const position = this.world.findRandomOpenPosition(occupied);
      if (!position) {
        break;
      }

      const genomeProfile = this.genomeEngine.construct(this.config.organism.founderGenome);
      const organism = new Organism({
        id: this.nextOrganismId,
        x: position.x,
        y: position.y,
        energy: this.config.organism.startingEnergy,
        genomeProfile,
        brain: this.brainGenerator.generate(genomeProfile),
        random: this.random
      });

      this.nextOrganismId += 1;
      this.organisms.push(organism);
      this.lineageBirthTicks.set(organism.lineageId, this.simulationTicks);
      occupied.add(`${position.x},${position.y}`);
      this.births += 1;
    }
  }

  step() {
    this.organisms.forEach((organism) => { organism.collectiveStrideActive = false; });
    this.organisms.forEach((organism) => { organism.collectiveTransportActive = false; });
    this.organisms.forEach((organism) => { organism.satietyMigrationActive = false; });
    this.applyGuidedDevelopmentSupport();
    this.decayCourierKnowledge();
    this.world.updateFire({ ...this.config.hazards, chemistryEnabled: this.config.chemistry.enabled });
    this.world.updateChemistry(this.config.chemistry, this.config.ecology, this.config.environment);
    this.recoverDeathResidue();
    this.condenseOverflowPlumes();
    this.updateFacetNiches();
    this.updateFacetRefineries();
    this.world.decaySignals(this.config.signal.decay);
    let occupiedBefore;

    const coupledIds = this.getCoupledIds();
    this.updateComponentLifecycle();
    this.updateGateDiscovery();
    prepareAdaptiveMorphology(this);
    prepareFoodPantries(this);
    occupiedBefore = new Set(this.organisms.filter((item) => item.alive).map((item) => `${item.x},${item.y}`));
    updateEnergyConservation(this);
    const collectiveStrideEligibleIds = this.getCollectiveStrideEligibleIds();
    const migrationTransportEligibleIds = this.getMigrationTransportEligibleIds();
    this.organisms.forEach((organism) => { organism.collectiveTransportActive = migrationTransportEligibleIds.has(organism.id); });
    const satietyMigrationEligibleIds = this.getSatietyMigrationEligibleIds();
    const lifecycleConserveIds = this.getComponentLifecycleConserveIds();
    this.satietyMigrationEligibleIds = satietyMigrationEligibleIds;
    // Capture only prior-tick persistent values, so state transport is one hop and execution order cannot leak information.
    const neighborStatesByOrganism = this.getNeighborStatesByOrganism();
    for (const organism of this.organisms) {
      if (!organism.alive) {
        continue;
      }

      occupiedBefore.delete(`${organism.x},${organism.y}`);
      const result = organism.act({
        stationaryOperatingMultiplier: this.config.bond.adaptiveMorphology?.enabled && coupledIds.has(organism.id)
          ? this.config.bond.adaptiveMorphology.stationaryOperatingMultiplier : 1,
        energyConservation: organism.energyConserving ? this.config.bond.energyConservation : null,
        world: this.world,
        occupiedKeys: occupiedBefore,
        config: this.config.organism,
        ecologyConfig: this.config.ecology,
        signalConfig: this.config.signal,
        environmentMemoryConfig: this.config.environmentMemory,
        guidedInput: this.guidedInput,
        guidedInputConfig: this.config.guidedStructuralIntelligence ?? {},
        coupled: coupledIds.has(organism.id),
        collectiveStrideMultiplier: migrationTransportEligibleIds.has(organism.id)
          ? this.config.collectiveWork.migrationTransport.movementCostMultiplier
          : (collectiveStrideEligibleIds.has(organism.id)
            ? this.config.collectiveWork.collectiveStride.movementCostMultiplier
            : 1),
        deferOrdinaryHarvest: satietyMigrationEligibleIds.has(organism.id) || lifecycleConserveIds.has(organism.id),
        harvestRestraint: this.config.ecology.harvestRestraint,
        structuralFocus: this.getStructuralFocus(organism),
        collectiveWorkCue: this.getCollectiveWorkCue(organism),
        collectiveWorkFields: this.getActiveCollectiveWorkFields(),
        courierTarget: this.getCourierTarget(organism),
        memoryDirectionScores: this.getMemoryDirectionScores(organism),
        neighborStates: neighborStatesByOrganism.get(organism.id) ?? [],
        brainExecutor: this.brainExecutor
      });

      organism.lastConsumedEnergy = result.consumedEnergy ?? 0;
      storeHarvest(this,organism,result);
      organism.lastOperatingExpense=Object.values(result.energyFlow.expenses).reduce((sum,value)=>sum+value,0);
      applyMorphologyEnvironment(this, organism);
      let structuralAllocation = 0;
      let externalBondAllocation = 0;
      let facetSharing = 0;
      let externalFacetSharing = 0;
      let facetCapital = 0;
      if (result.consumedEnergy > 0 && organism.alive) {
        this.recordTetheredScoutValue(organism, result.consumedEnergy);
        this.emitCollectivePulse(organism, "food", Math.min(1, result.consumedEnergy / 10), { x: organism.x, y: organism.y });
        if ((organism.guidedInputSignal ?? 0) >= 0.35) {
          this.emitCollectivePulse(organism, "guided-return", Math.min(1, organism.guidedInputSignal), { x: organism.x, y: organism.y });
        }
        const priorityMemberIds = this.getGateFieldEnergyPriority(organism, result.consumedFoodOrigin);
        if (priorityMemberIds) {
          this.rewardUsefulBondWork(organism, priorityMemberIds, result.consumedEnergy, "gate-harvest");
        }
        const surplusFirst = this.config.bond.surplusFirstEnergy?.enabled !== false;
        const freshSupport = shareFreshHarvest(this, organism, result.consumedEnergy);
        const remainingMeal = Math.max(0, result.consumedEnergy-freshSupport.withdrawn);
        const bondAllocation = surplusFirst
          ? { total: 0, external: 0 }
          : this.feedAttachedBonds(organism, remainingMeal, priorityMemberIds);
        const sharing = this.shareFacetEnergy(organism, surplusFirst ? remainingMeal : Math.max(0, remainingMeal - bondAllocation.total), priorityMemberIds);
        facetSharing = sharing.total + freshSupport.delivered;
        externalFacetSharing = sharing.external + freshSupport.external;
        const orderedBondAllocation = surplusFirst
          ? this.feedAttachedBonds(organism, Math.max(0, remainingMeal - sharing.total), priorityMemberIds)
          : bondAllocation;
        structuralAllocation = orderedBondAllocation.total;
        externalBondAllocation = orderedBondAllocation.external;
        this.depositComponentReserveFromHarvest(organism, remainingMeal);
        facetCapital = this.applyFacetHarvestAdvantage(organism, result.consumedEnergy);
      }
      if (result.consumedResource === RESOURCE_TYPES.RED && organism.alive) {
        this.storeFacetCatalyst(organism);
      }
      if (result.consumedFoodOrigin?.type === "gate-field") {
        this.recordCollectiveWorkHarvest(organism, result.consumedFoodOrigin);
      }
      if (result.memoryWrite) this.recordEnvironmentMemoryWrite(organism, result.memoryWrite);
      if (result.deferredHarvest) {
        this.satietyMigrationDeferrals += 1;
        if (lifecycleConserveIds.has(organism.id)) this.componentLifecycleDeferrals += 1;
      }
      this.recordHarvestGeometry(organism, result);
      this.captureStructuralOverflow(organism, result);
      this.createOverflowPlume(organism, result);
      this.recordOverflowProvenance(organism, result);
      this.recordEnergyFlow(organism, result.energyFlow);
      this.recordGateFieldCycleFlow(organism, result.energyFlow, { structuralAllocation, externalBondAllocation, facetSharing, externalFacetSharing, facetCapital });
      this.recordComponentEpisodeMigrationFlow(organism, result.energyFlow);
      this.recordComponentEpisodePhaseFlow(organism, result);
      this.createCourierReport(organism);

      if (organism.alive) {
        const supportContext = this.getSupportContext(organism);
        const directSupport = this.supportLowEnergyMember(organism);
        if (directSupport > 0) this.emitCollectivePulse(organism, "member-support", Math.min(1, directSupport / 2));
        const relayContext = this.getSupportContext(organism);
        const relay = this.relayReserveToMember(organism, relayContext);
        const relayedSupport = relay.delivered > 0 ? this.supportLowEnergyMember(organism) : 0;
        const neighbourSupport = supportFromNeighbourSurplus(this, organism);
        const supportReceived = directSupport + relayedSupport + neighbourSupport;
        this.recordComponentEpisodeMigrationSupport(organism, directSupport, relay.delivered, relayedSupport);
        if (organism.energy <= 0) {
          organism.alive = false;
          organism.deathReason = "energy exhaustion";
          this.recordStarvationDiagnostic(organism, supportContext, supportReceived, relay);
        } else if (relay.delivered > 0 && supportContext.energyBeforeSupport <= 0) {
          this.bondRelayRescues += 1;
        }
      }

      if (organism.alive) {
        occupiedBefore.add(`${organism.x},${organism.y}`);
      }
    }
    this.recordEnvironmentMemoryReads();

    this.moveCompounds();
    this.moveElasticTetherScouts();
    this.updateCourierExchange();
    // Settle existing commitments before spending surplus on a new generation.
    this.fundExistingBondReserves();
    this.handleReproduction();
    this.handleAutonomousFacetBudding();
    this.handleTopologyProactiveReproduction();
    shrinkAtRiskComponents(this);
    this.updateBonds();
    // Scout detection is observational in this stage; no movement or bond
    // state is changed until the tethered-scout intervention is separately tested.
    this.updateTetheredScoutDiagnostics();
    this.recordGateCycleReserveMaintenance();
    this.recordComponentEpisodeMigrationReserveMaintenance();
    this.recordComponentEpisodePhaseReserveMaintenance();
    this.removeDeadOrganisms();
    this.updateComponentEpisodes();
    this.updateFacetReserves();
    if (!this.headlessObservationMode) this.recordFacetWorkTrail();
    this.updateCollectiveWork();
    this.captureCollectiveCensus();
    if (!this.headlessObservationMode) this.updateMarkers();
    const production = this.world.growFood(
      this.config.food.growthRate,
      this.config.food.maxGrowthAttemptsPerTick,
      this.config.chemistry,
      this.config.ecology,
      this.config.environment
    );
    this.latestPrimaryProduction = production.count;
    this.primaryResourceUnits += production.count;
    this.primaryPotentialEnergy += production.count * this.config.organism.foodEnergy;
    if (!this.headlessObservationMode) {
      this.primaryProductionMarkers.push(...production.positions.map((position) => ({ ...position, ttl: 4 })));
      if (this.primaryProductionMarkers.length > MAX_PRIMARY_PRODUCTION_MARKERS) {
        this.primaryProductionMarkers.splice(0, this.primaryProductionMarkers.length - MAX_PRIMARY_PRODUCTION_MARKERS);
      }
    }
    this.world.updateEnvironmentMemory(this.config.environmentMemory);

    this.decayCollectiveMemory();
    this.simulationTicks += 1;
    this.captureEnergyEconomicsInterval();
    this.captureEnergyLogisticsTick();
    this.snapshotVersion += 1;
  }

  getGateFieldEnergyPriority(organism, origin) {
    if (!this.config.collectiveWork.prioritizeResponsibleFacetEnergy || origin?.type !== "gate-field") return null;
    const gate = this.workGates.find((candidate) => candidate.id === origin.gateId);
    if (!gate || gate.fieldStrength <= 0 || gate.fieldFacetKey !== origin.facetKey) return null;
    const facet = this.getFacets().find((candidate) => candidate.key === gate.fieldFacetKey);
    if (!facet || !facet.memberIds.includes(organism.id)) return null;
    return new Set(facet.memberIds);
  }

  getTopologyRoleMap() {
    const adjacency = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, new Set()]));
    for (const bond of this.bonds.values()) {
      if (adjacency.has(bond.firstId) && adjacency.has(bond.secondId)) {
        adjacency.get(bond.firstId).add(bond.secondId);
        adjacency.get(bond.secondId).add(bond.firstId);
      }
    }
    const roles = new Map();
    for (const [id, neighbors] of adjacency) {
      const degree = neighbors.size;
      roles.set(id, degree <= 1 ? "terminal" : degree >= 3 ? "hub" : "interior");
    }
    for (const group of this.getBondGroups()) {
      const internalBonds = [...this.bonds.values()].filter((bond) => group.includes(bond.firstId) && group.includes(bond.secondId));
      if (internalBonds.length >= group.length) {
        for (const id of group) if (roles.get(id) !== "terminal") roles.set(id, "core");
      }
    }
    this.topologyRoleCounts = { terminal: 0, hub: 0, core: 0, interior: 0 };
    for (const role of roles.values()) this.topologyRoleCounts[role] += 1;
    return roles;
  }

  getTetheredScoutCandidates() {
    const policy = this.config.bond.topologyMemory?.tetheredScout;
    if (!policy?.enabled) return [];
    const roles = this.getTopologyRoleMap();
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const candidates = [];
    for (const group of this.getBondGroups()) {
      if (group.length < policy.minimumCoreSize) continue;
      const groupSet = new Set(group);
      const internalBonds = [...this.bonds.values()].filter((bond) => groupSet.has(bond.firstId) && groupSet.has(bond.secondId));
      const cycleRank = Math.max(0, internalBonds.length - group.length + 1);
      const coreIds = group.filter((id) => roles.get(id) === "core");
      const coreBonds = internalBonds.filter((bond) => coreIds.includes(bond.firstId) && coreIds.includes(bond.secondId));
      const coreStrength = coreBonds.length
        ? average(coreBonds.map((bond) => bond.strength ?? 0))
        : 0;
      const componentReserve = this.componentReserves.get(this.componentReserveKey(group)) ?? 0;
      if (internalBonds.length < policy.minimumCoreBonds
        || cycleRank < policy.minimumCoreCycleRank
        || coreIds.length < policy.minimumCoreSize
        || coreStrength < policy.minimumCoreStrength
        || componentReserve < policy.minimumCoreReserve) continue;
      const adjacent = new Map(group.map((id) => [id, []]));
      for (const bond of this.bonds.values()) {
        if (groupSet.has(bond.firstId) && groupSet.has(bond.secondId)) {
          adjacent.get(bond.firstId).push(bond.secondId);
          adjacent.get(bond.secondId).push(bond.firstId);
        }
      }
      for (const [id, neighbors] of adjacent) {
        if (roles.get(id) !== "terminal" || !neighbors.some((neighborId) => roles.get(neighborId) === "core")) continue;
        const scout = byId.get(id);
        if (!scout || scout.energy < policy.energyFloor) continue;
        const attachmentId = neighbors.find((neighborId) => roles.get(neighborId) === "core");
        const bond = this.bonds.get(this.bondKey(id, attachmentId));
        candidates.push({ scout, attachment: byId.get(attachmentId), bond, componentIds: group });
      }
    }
    return candidates.filter((candidate) => candidate.attachment);
  }

  updateTetheredScoutDiagnostics() {
    const policy = this.config.bond.topologyMemory?.tetheredScout;
    if (!policy?.enabled) return;
    const candidates = this.getTetheredScoutCandidates();
    const currentIds = new Set(candidates.map((candidate) => candidate.scout.id));
    this.tetheredScoutDiagnostics.eligibleScouts = candidates.length;
    this.tetheredScoutDiagnostics.activeEpisodes = [...this.tetheredScoutEpisodes.values()]
      .filter((episode) => episode.active).length;
    for (const candidate of candidates) {
      const key = String(candidate.scout.id);
      if (!this.tetheredScoutEpisodes.has(key)) {
        this.tetheredScoutEpisodes.set(key, {
          scoutId: candidate.scout.id,
          attachmentId: candidate.attachment.id,
          startedTick: this.simulationTicks,
          active: false,
          state: "eligible",
          distanceFromAttachment: 0,
          componentSize: candidate.componentIds.length
        });
      }
    }
    for (const [key, episode] of this.tetheredScoutEpisodes) {
      if (!currentIds.has(Number(key)) && episode.active) {
        episode.active = false;
        episode.state = "ineligible";
      }
    }
  }

  moveElasticTetherScouts() {
    const policy = this.config.bond.topologyMemory?.tetheredScout;
    if (!policy?.enabled || !policy.elasticEnabled || !this.config.bond.topologyMemory.enabled) return;
    const candidates = this.getTetheredScoutCandidates();
    const activeComponents = new Set();
    const occupied = new Set(this.organisms.filter((organism) => organism.alive).map((organism) => `${organism.x},${organism.y}`));
    for (const candidate of candidates) {
      const { scout, attachment, bond, componentIds } = candidate;
      if (!bond) continue;
      const componentKey = this.componentReserveKey(componentIds);
      const episodeKey = String(scout.id);
      let episode = this.tetheredScoutEpisodes.get(episodeKey);
      if (episode?.active) {
        activeComponents.add(componentKey);
      } else {
        const componentReserve = this.componentReserves.get(componentKey) ?? 0;
        const cooldownElapsed = episode?.lastEndedTick === undefined
          || this.simulationTicks - episode.lastEndedTick >= policy.returnCooldownTicks;
        if (activeComponents.has(componentKey)
          || scout.energy < policy.energyFloor + policy.excursionMovementCost
          || componentReserve < policy.minimumComponentReserve
          || !cooldownElapsed
          || this.random() > policy.departureProbability) continue;
        episode = {
          scoutId: scout.id,
          attachmentId: attachment.id,
          startedTick: this.simulationTicks,
          active: true,
          state: "exploring",
          valueCollected: 0,
          distanceFromAttachment: 0,
          componentSize: componentIds.length,
          lastEndedTick: episode?.lastEndedTick ?? null
        };
        this.tetheredScoutEpisodes.set(episodeKey, episode);
        bond.elasticScout = true;
        this.tetheredScoutDiagnostics.departures += 1;
        activeComponents.add(componentKey);
      }
      const elapsed = this.simulationTicks - episode.startedTick;
      if (elapsed >= policy.maximumExcursionTicks) {
        episode.active = false;
        episode.state = "timeout";
        episode.lastEndedTick = this.simulationTicks;
        this.tetheredScoutDiagnostics.timeoutAborts += 1;
        bond.elasticScout = false;
        continue;
      }
      const returning = episode.valueCollected > 0;
      const legalDirections = DIRECTIONS.filter((direction) => {
        const target = this.world.wrapPosition(scout.x + direction.x, scout.y + direction.y);
        if (!this.world.isWalkable(target.x, target.y) || occupied.has(`${target.x},${target.y}`)) return false;
        const nextDistance = this.distanceBetweenPositions({ x: target.x, y: target.y }, attachment);
        return nextDistance <= policy.leashRadius
          && (!returning || nextDistance <= this.distanceBetweenPositions(scout, attachment));
      });
      if (!legalDirections.length) continue;
      const direction = [...legalDirections].sort((first, second) => {
        if (!returning) return (scout.brainExecution?.effectors.direction?.[second.name] ?? 0)
          - (scout.brainExecution?.effectors.direction?.[first.name] ?? 0);
        return this.distanceBetweenPositions(this.world.wrapPosition(scout.x + first.x, scout.y + first.y), attachment)
          - this.distanceBetweenPositions(this.world.wrapPosition(scout.x + second.x, scout.y + second.y), attachment);
      })[0];
      occupied.delete(`${scout.x},${scout.y}`);
      const target = this.world.wrapPosition(scout.x + direction.x, scout.y + direction.y);
      scout.x = target.x;
      scout.y = target.y;
      occupied.add(`${scout.x},${scout.y}`);
      scout.energy -= policy.excursionMovementCost;
      scout.energyLedger.expenses.movement += policy.excursionMovementCost;
      episode.distanceFromAttachment = this.distanceBetweenPositions(scout, attachment);
      if (episode.valueCollected > 0 && this.areAdjacent(scout, attachment)) {
        episode.active = false;
        episode.state = "returned-with-value";
        episode.lastEndedTick = this.simulationTicks;
        this.tetheredScoutDiagnostics.returns += 1;
        this.tetheredScoutDiagnostics.successfulReturns += 1;
        bond.elasticScout = false;
        this.emitCollectivePulse(scout, "scout-return", Math.min(1, policy.returnPulseStrength * episode.valueCollected), { x: scout.x, y: scout.y });
      }
    }
  }

  recordTetheredScoutValue(organism, energy) {
    if (energy <= 0) return;
    const episode = this.tetheredScoutEpisodes.get(String(organism.id));
    if (!episode?.active) return;
    episode.valueCollected = Math.min(1, (episode.valueCollected ?? 0) + energy / 10);
    episode.state = "value-found";
    this.tetheredScoutDiagnostics.valueFinds += 1;
  }

  getTopologyMotifSignature(memberIds) {
    const ids = [...memberIds].sort((a, b) => a - b);
    const idSet = new Set(ids);
    const degrees = new Map(ids.map((id) => [id, 0]));
    let bondCount = 0;
    for (const bond of this.bonds.values()) {
      if (!idSet.has(bond.firstId) || !idSet.has(bond.secondId)) continue;
      bondCount += 1;
      degrees.set(bond.firstId, degrees.get(bond.firstId) + 1);
      degrees.set(bond.secondId, degrees.get(bond.secondId) + 1);
    }
    const cycleRank = Math.max(0, bondCount - ids.length + 1);
    return `${ids.length}|${bondCount}|${cycleRank}|${[...degrees.values()].sort((a, b) => a - b).join(",")}`;
  }

  getFacetMotifSignature(facet) {
    const ids = new Set(facet.memberIds);
    const externalDegrees = facet.memberIds.map((id) => [...this.bonds.values()]
      .filter((bond) => (bond.firstId === id && !ids.has(bond.secondId)) || (bond.secondId === id && !ids.has(bond.firstId))).length)
      .sort((a, b) => a - b);
    return `${this.getTopologyMotifSignature(facet.memberIds)}|external:${externalDegrees.join(",")}`;
  }

  recordTopologyPulse(source, event, strength, distance) {
    const policy = this.config.bond.topologyMemory;
    if (!policy?.enabled) return;
    const group = this.getBondGroups().find((memberIds) => memberIds.includes(source.id));
    if (!group || group.length < 3) return;
    const signature = this.getTopologyMotifSignature(group);
    let motif = this.topologyMotifs.get(signature);
    if (!motif) {
      if (this.topologyMotifs.size >= policy.maximumMotifs) {
        const oldest = [...this.topologyMotifs.entries()].sort((a, b) => a[1].lastSuccessTick - b[1].lastSuccessTick)[0];
        if (oldest) this.topologyMotifs.delete(oldest[0]);
      }
      motif = { signature, trace: 0, successes: 0, lastSuccessTick: this.simulationTicks, lastEvent: event, memberCount: group.length };
      this.topologyMotifs.set(signature, motif);
    }
    motif.trace = Math.min(policy.maximumTrace, motif.trace + strength * policy.motifReinforcement);
    motif.successes += 1;
    motif.lastSuccessTick = this.simulationTicks;
    motif.lastEvent = event;
    const groupSet = new Set(group);
    for (const bond of this.bonds.values()) {
      if (!groupSet.has(bond.firstId) || !groupSet.has(bond.secondId)) continue;
      const hops = Math.min(distance.get(bond.firstId) ?? Infinity, distance.get(bond.secondId) ?? Infinity);
      if (!Number.isFinite(hops)) continue;
      bond.topologyTrace = Math.min(policy.maximumTrace, (bond.topologyTrace ?? 0)
        + strength * policy.reinforcementStrength * Math.pow(policy.pulseAttenuationPerHop, hops));
      bond.topologyLastPulseTick = this.simulationTicks;
    }
    this.recordFacetMotifPulse(source, event, strength);
  }

  recordFacetMotifPulse(source, event, strength) {
    const policy = this.config.bond.topologyMemory?.facetMemory;
    if (!policy?.enabled) return;
    if (!["gate", "migration", "scout-return", "member-support", "reproduction"].includes(event)) return;
    for (const facet of this.getFacets()) {
      if (!facet.memberIds.includes(source.id)) continue;
      const signature = this.getFacetMotifSignature(facet);
      const memory = this.facetMotifMemory.get(signature) ?? {
        signature, trace: 0, successes: 0, lastSuccessTick: null, lastEvent: event
      };
      if (memory.lastSuccessTick === this.simulationTicks) continue;
      memory.trace = Math.min(policy.maximumTrace, memory.trace + strength * policy.reinforcementStrength);
      memory.successes += 1;
      memory.lastSuccessTick = this.simulationTicks;
      memory.lastEvent = event;
      this.facetMotifMemory.set(signature, memory);
    }
  }

  updateTopologyMemory() {
    const policy = this.config.bond.topologyMemory;
    if (!policy?.enabled) return;
    const activeSignatures = new Set();
    for (const group of this.getBondGroups()) {
      if (group.length < 3) continue;
      const signature = this.getTopologyMotifSignature(group);
      activeSignatures.add(signature);
      this.topologyStableTicks.set(signature, (this.topologyStableTicks.get(signature) ?? 0) + 1);
    }
    for (const [signature, motif] of this.topologyMotifs) {
      motif.trace *= policy.motifForgettingRate;
      if (!activeSignatures.has(signature) && motif.trace < 0.01) this.topologyMotifs.delete(signature);
    }
    const facetPolicy = policy.facetMemory;
    if (facetPolicy?.enabled) {
      const activeFacetSignatures = new Set(this.getFacets().map((facet) => this.getFacetMotifSignature(facet)));
      for (const signature of activeFacetSignatures) {
        this.facetMotifStableTicks.set(signature, (this.facetMotifStableTicks.get(signature) ?? 0) + 1);
      }
      for (const [signature, memory] of this.facetMotifMemory) {
        memory.trace *= facetPolicy.traceDecayRate;
        if (!activeFacetSignatures.has(signature) && memory.trace < 0.01) this.facetMotifMemory.delete(signature);
      }
    }
    for (const bond of this.bonds.values()) bond.topologyTrace = (bond.topologyTrace ?? 0) * policy.traceDecayRate;
    this.getTopologyRoleMap();
  }

  emitCollectivePulse(source, event, strength = 1, context = {}) {
    this.recordGuidedSupportReward(event, strength);
    const memoryPolicy = this.config.bond.collectiveMemory;
    const topologyPolicy = this.config.bond.topologyMemory;
    const policy = memoryPolicy?.enabled ? memoryPolicy : topologyPolicy;
    if (!policy?.enabled || !source?.alive || strength <= 0) return;
    const distance = new Map([[source.id, 0]]); const queue = [source.id];
    while (queue.length) {
      const id = queue.shift();
      if (distance.get(id) >= policy.maximumHops) continue;
      for (const bond of this.bonds.values()) {
        const next = bond.firstId === id ? bond.secondId : (bond.secondId === id ? bond.firstId : null);
        if (next !== null && !distance.has(next)) { distance.set(next, distance.get(id) + 1); queue.push(next); }
      }
    }
    for (const [id, hops] of distance) {
      const organism = this.organisms.find((candidate) => candidate.id === id);
      if (organism) {
        organism.nodeTrace = Math.min(policy.maximumTrace, organism.nodeTrace + strength * policy.reinforcementStrength * Math.pow(policy.pulseAttenuationPerHop, hops));
        organism.lastPulseTick = this.simulationTicks;
        organism.memoryEvent = event;
        organism.memoryLocation = context.x === undefined ? { x: source.x, y: source.y } : { x: context.x, y: context.y };
      }
    }
    for (const bond of this.bonds.values()) {
      const hops = Math.min(distance.get(bond.firstId) ?? Infinity, distance.get(bond.secondId) ?? Infinity);
      if (!Number.isFinite(hops)) continue;
      bond.bondTrace = Math.min(policy.maximumTrace, (bond.bondTrace ?? 0) + strength * policy.reinforcementStrength * Math.pow(policy.pulseAttenuationPerHop, hops));
      bond.lastPulseTick = this.simulationTicks;
      bond.lastPulseEvent = event;
    }
    const key = `${event}:${context.x ?? source.x},${context.y ?? source.y}`;
    const repeats = (this.collectiveMemorySuccesses.get(key) ?? 0) + 1;
    this.collectiveMemorySuccesses.set(key, repeats);
    for (const id of distance.keys()) {
      const organism = this.organisms.find((candidate) => candidate.id === id);
      if (organism) organism.memoryRepeats = Math.max(organism.memoryRepeats ?? 0, repeats);
    }
    this.collectiveMemoryLocations.push({ x: context.x ?? source.x, y: context.y ?? source.y, event, repeats, tick: this.simulationTicks });
    if (this.collectiveMemoryLocations.length > policy.maximumLocationRecords) this.collectiveMemoryLocations.shift();
    this.recordTopologyPulse(source, event, strength, distance);
  }

  recordGuidedSupportReward(event, strength) {
    const mode = this.config.guidedStructuralIntelligence?.supportedDevelopment;
    if (!mode?.enabled || mode.unconditionalSupportEnabled) return;
    const rewardedEvents = new Set(["food", "guided-return", "gate", "migration", "reproduction", "scout-return", "member-support"]);
    if (!rewardedEvents.has(event)) return;
    const reward = Math.max(0, Number(strength) || 0) * Number(mode.supportCreditPerPulse ?? 0);
    this.guidedSupportCredits = Math.min(Number(mode.maximumSupportCredits ?? 48), this.guidedSupportCredits + reward);
    this.guidedSupportStats.supportRewards += reward;
  }

  decayCollectiveMemory() {
    const policy = this.config.bond.collectiveMemory;
    if (!policy?.enabled) {
      this.updateTopologyMemory();
      return;
    }
    for (const organism of this.organisms) organism.nodeTrace *= policy.traceDecayRate;
    for (const bond of this.bonds.values()) bond.bondTrace = (bond.bondTrace ?? 0) * policy.traceDecayRate;
    this.updateTopologyMemory();
  }

  getMemoryDirectionScores(organism) {
    const policy = this.config.bond.collectiveMemory;
    const scores = Object.fromEntries(DIRECTIONS.map((direction) => [direction.name, 0]));
    const memory = organism?.memoryLocation;
    if (!policy?.enabled || !memory || organism.memoryRepeats < policy.consolidationThreshold || organism.nodeTrace < policy.reinforcementStrength) return scores;
    if (organism.memoryEvent === "food" && this.world.tiles[memory.y]?.[memory.x]?.type !== TILE_TYPES.FOOD) return scores;
    if (organism.memoryEvent === "gate" || organism.memoryEvent === "migration") {
      const gate = this.workGates.find((candidate) => candidate.x === memory.x && candidate.y === memory.y && !candidate.exhausted);
      if (!gate) return scores;
    }
    const before = this.distanceBetweenPositions(organism, memory);
    for (const direction of DIRECTIONS) {
      const target = this.world.wrapPosition(organism.x + direction.x, organism.y + direction.y);
      if (this.distanceBetweenPositions(target, memory) < before) scores[direction.name] = policy.maximumMovementBias * organism.nodeTrace;
    }
    return scores;
  }

  qualifiesTopologyReproduction(organism) {
    const policy = this.config.bond.topologyMemory;
    if (!policy?.enabled) return true;
    const group = this.getBondGroups().find((memberIds) => memberIds.includes(organism.id));
    if (!group || group.length < 3) return false;
    const reserve = this.componentReserves.get(this.componentReserveKey(group)) ?? 0;
    const signature = this.getTopologyMotifSignature(group);
    const motif = this.topologyMotifs.get(signature);
    return reserve >= policy.reproductionReserve
      && (this.topologyStableTicks.get(signature) ?? 0) >= policy.stableTicksRequired
      && (motif?.trace ?? 0) >= policy.motifConsolidationThreshold;
  }

  handleReproduction() {
    const newborns = [];
    this.lastOrdinaryReproductionParents = new Set();
    const occupied = new Set(this.organisms.filter((item) => item.alive).map((item) => `${item.x},${item.y}`));
    const reproductionOpportunity = this.getReproductionOpportunity().opportunity;

    for (const organism of this.organisms) {
      const supportMode = this.config.guidedStructuralIntelligence?.supportedDevelopment;
      if (supportMode?.enabled && this.organisms.length + newborns.length >= supportMode.populationCap) break;
      const morphology=this.config.bond.adaptiveMorphology;
      const renewalEligible=Boolean(morphology?.enabled && morphology.renewalEnabled
        && organism.age>=this.config.organism.maxAge*0.55
        && organism.energy>=this.getReproductionEnergyFloor(organism)*1.2
        && this.isActivelyBonded(organism.id));
      if (!organism.canReproduce(this.config.organism) && !renewalEligible) {
        continue;
      }
      if (!this.canAffordReproduction(organism)) continue;
      const structuralParent = this.isActivelyBonded(organism.id) && organism.genomeProfile.traits.canCouple;
      const sourceFacet = structuralParent ? this.getStrongestFacetForMember(organism.id) : null;
      const nurseryCredit = sourceFacet ? (this.facetNurseryCredits.get(sourceFacet.key) ?? 0) : 0;
      const ordinaryOpportunity = this.random() <= reproductionOpportunity;
      if (!ordinaryOpportunity && nurseryCredit <= 0) continue;
      const facetBirthSite = sourceFacet ? this.findFacetBirthSite(organism, sourceFacet, occupied) : null;
      if (!ordinaryOpportunity && !facetBirthSite) continue;
      const localPosition = facetBirthSite?.position ?? (structuralParent ? this.findLocalBirthPosition(organism, occupied) : null);
      const childPosition = localPosition ?? this.world.findRandomOpenPosition(occupied);
      if (!childPosition) {
        continue;
      }
      if (structuralParent && this.config.bond.topologyMemory.enabled) {
        const memoryPolicy = this.config.bond.topologyMemory;
        const group = this.getBondGroups().find((memberIds) => memberIds.includes(organism.id));
        const reserveKey = group && this.componentReserveKey(group);
        const reserve = reserveKey ? (this.componentReserves.get(reserveKey) ?? 0) : 0;
        const release = Math.min(memoryPolicy.reproductionReserve, reserve);
        if (release > 0) {
          this.componentReserves.set(reserveKey, reserve - release);
          organism.energy += release;
          this.componentReserveWithdrawn += release;
        }
      }

      const child = organism.reproduce(this.nextOrganismId, childPosition, this.config.organism, {
        genomeEngine: this.genomeEngine,
        brainGenerator: this.brainGenerator,
        mutationEngine: this.mutationEngine
      });
      if(morphology?.enabled) {
        child.morphologyPreferences=Object.fromEntries(Object.entries(organism.morphologyPreferences??{}).map(([key,value])=>[key,value*0.1]));
        if(renewalEligible && localPosition && child.genomeProfile.traits.canCouple) {
          const partners=[organism,...this.organisms.filter(other=>other.alive&&other.id!==organism.id
            && this.areAdjacent(child,other)&&this.bonds.has(this.bondKey(organism.id,other.id)))].slice(0,2);
          const investment=Math.min(4,Math.max(0,organism.energy-(this.usesAlignedBudgets()?this.getBondFundingFloor(organism):this.config.bond.supportThreshold)));
          if(investment>0) {
            organism.energy-=investment;
            this.recordEnergyAllocation(organism,'structuralSeed',investment);
            for(const partner of partners)this.seedStructuralBond(partner.id,child.id,investment/partners.length);
            this.morphologyStats.renewalBirths=(this.morphologyStats.renewalBirths??0)+1;
          }
        }
      }
      if (this.config.bond.topologyMemory.enabled) {
        const memoryPolicy = this.config.bond.topologyMemory;
        child.nodeTrace = Math.max(0, Math.min(memoryPolicy.maximumTrace, organism.nodeTrace * memoryPolicy.inheritanceFraction
          + (organism.random() - 0.5) * memoryPolicy.inheritanceNoise));
      }
      // This is a transfer into a new organism, not energy destroyed by reproduction.
      this.energyEconomics.allocations.reproduction += child.energy;
      if (!this.lineageBirthTicks.has(child.lineageId)) this.lineageBirthTicks.set(child.lineageId, this.simulationTicks);
      this.nextOrganismId += 1;
      newborns.push(child);
      this.lastOrdinaryReproductionParents.add(organism.id);
      occupied.add(`${childPosition.x},${childPosition.y}`);
      this.births += 1;
      if (this.config.bond.collectiveMemory.enabled || this.config.bond.topologyMemory.enabled) {
        this.emitCollectivePulse(organism, "reproduction", 0.75, childPosition);
      }
      this.birthMarkers.push({
        x: childPosition.x,
        y: childPosition.y,
        ttl: 10
      });

      if (facetBirthSite && child.genomeProfile.traits.canCouple
        && (this.facetReserves.get(sourceFacet.key) ?? 0) >= this.config.facet.reserveRequiredForBirth) {
        const investment = Math.min(this.config.facet.reserveInvestmentPerBirth, this.facetReserves.get(sourceFacet.key));
        this.facetReserves.set(sourceFacet.key, this.facetReserves.get(sourceFacet.key) - investment);
        this.seedStructuralBond(organism.id, child.id, investment / 2);
        this.seedStructuralBond(facetBirthSite.partner.id, child.id, investment / 2);
        this.structuralBirths += 1;
        this.facetBirths += 1;
        this.facetReserveSpent += investment;
        this.structuralSeedEnergy += investment;
        this.recordEnergyAllocation(organism, "structuralSeed", investment);
        this.recordTelemetry("facet-birth", `Facet ${sourceFacet.key} budded #${child.id} and invested ${investment.toFixed(1)} structural capital into two bond seeds.`);
      } else if (localPosition && child.genomeProfile.traits.canCouple) {
        const seedEnergy = Math.min(Math.max(0,organism.energy-(this.usesAlignedBudgets()?this.getBondFundingFloor(organism):0)), this.config.bond.buddingReserveInvestment);
        if (seedEnergy > 0) {
          organism.energy -= seedEnergy;
          this.recordEnergyAllocation(organism, "structuralSeed", seedEnergy);
          this.seedStructuralBond(organism.id, child.id, seedEnergy);
          this.structuralBirths += 1;
          this.structuralSeedEnergy += seedEnergy;
          this.recordTelemetry("structural-birth", `Organism #${organism.id} locally budded #${child.id} and invested ${seedEnergy.toFixed(1)} energy into a bond seed.`);
        }
      }
      if (facetBirthSite && child.genomeProfile.traits.canCouple && nurseryCredit > 0) {
        this.facetNurseryCredits.set(sourceFacet.key, nurseryCredit - 1);
        this.recordTelemetry("refinery-nursery", `Facet ${sourceFacet.key} spent one restored-habitat nursery credit on structural child #${child.id}.`);
      }
    }

    this.organisms.push(...newborns);
  }

  handleTopologyProactiveReproduction() {
    const topology = this.config.bond.topologyMemory;
    const policy = topology?.proactiveReproduction;
    if (!topology?.enabled || !policy?.enabled) return;
    const facetPolicy = topology.facetMemory;
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const occupied = new Set(this.organisms.filter((organism) => organism.alive).map((organism) => `${organism.x},${organism.y}`));
    const candidates = this.getFacets()
      .map((facet) => ({ ...facet, strength: this.getFacetStrength(facet.memberIds), motif: this.getFacetMotifSignature(facet) }))
      .filter((facet) => facet.strength >= this.config.facet.minimumBondStrength)
      .sort((a, b) => (this.componentReserves.get(this.componentReserveKey(b.memberIds)) ?? 0)
        - (this.componentReserves.get(this.componentReserveKey(a.memberIds)) ?? 0));
    const newborns = [];
    for (const facet of candidates) {
      if (newborns.length >= Math.max(1, policy.maxBirthsPerTick)) break;
      if (this.topologyProactiveBirths >= Math.max(0, policy.maxTotalBirths)) break;
      this.topologyProactiveBirthAttempts += 1;
      const group = this.getBondGroups().find((memberIds) => facet.memberIds.every((id) => memberIds.includes(id)));
      const componentMotif = group ? this.getTopologyMotifSignature(group) : null;
      const facetMemory = this.facetMotifMemory.get(facet.motif);
      const componentMemory = componentMotif ? this.topologyMotifs.get(componentMotif) : null;
      const facetConsolidated = facetMemory && facetMemory.trace >= facetPolicy.consolidationThreshold
        && (this.facetMotifStableTicks.get(facet.motif) ?? 0) >= facetPolicy.stableTicksRequired;
      const componentConsolidated = componentMemory && componentMemory.trace >= topology.motifConsolidationThreshold
        && (this.topologyStableTicks.get(componentMotif) ?? 0) >= topology.stableTicksRequired;
      if (!facetConsolidated && !componentConsolidated) {
        this.topologyProactiveBirthDenied.memory += 1;
        continue;
      }
      const key = this.componentReserveKey(facet.memberIds);
      const reserve = this.componentReserves.get(key) ?? 0;
      if (reserve < policy.reserveThreshold + policy.postBirthReserve + policy.reserveInvestment) {
        this.topologyProactiveBirthDenied.reserve += 1;
        continue;
      }
      const birthKey = componentMotif ?? facet.motif;
      const lastBirth = this.topologyProactiveBirthTicks.get(birthKey) ?? -Infinity;
      if (this.simulationTicks - lastBirth < policy.cooldownTicks) {
        this.topologyProactiveBirthDenied.cooldown += 1;
        continue;
      }
      const members = facet.memberIds.map((id) => byId.get(id)).filter(Boolean);
      if (members.length !== facet.memberIds.length || members.some((member) => member.energy < policy.memberEnergyFloor)) {
        this.topologyProactiveBirthDenied.energy += 1;
        continue;
      }
      const parent = [...members].sort((a, b) => b.energy - a.energy)[0];
      const birthSite = this.findFacetBirthSite(parent, facet, occupied);
      if (!birthSite) {
        this.topologyProactiveBirthDenied.site += 1;
        continue;
      }
      if (!this.canAffordReproduction(parent)) continue;
      const child = parent.reproduce(this.nextOrganismId, birthSite.position, this.config.organism, {
        genomeEngine: this.genomeEngine, brainGenerator: this.brainGenerator, mutationEngine: this.mutationEngine
      });
      child.nodeTrace = Math.max(0, Math.min(topology.maximumTrace,
        parent.nodeTrace * topology.inheritanceFraction + (parent.random() - 0.5) * topology.inheritanceNoise));
      this.componentReserves.set(key, reserve - policy.reserveInvestment);
      this.componentReserveWithdrawn += policy.reserveInvestment;
      this.facetReserveSpent += policy.reserveInvestment;
      this.structuralSeedEnergy += policy.reserveInvestment;
      this.seedStructuralBond(parent.id, child.id, policy.reserveInvestment / 2);
      this.seedStructuralBond(birthSite.partner.id, child.id, policy.reserveInvestment / 2);
      this.recordEnergyAllocation(parent, "structuralSeed", policy.reserveInvestment);
      this.energyEconomics.allocations.reproduction += child.energy;
      this.nextOrganismId += 1;
      newborns.push(child);
      occupied.add(`${child.x},${child.y}`);
      this.births += 1;
      this.structuralBirths += 1;
      this.topologyProactiveBirths += 1;
      this.topologyProactiveBirthTicks.set(birthKey, this.simulationTicks);
      this.birthMarkers.push({ x: child.x, y: child.y, ttl: 10 });
      this.emitCollectivePulse(parent, "reproduction", 0.9, birthSite.position);
      this.recordTelemetry("topology-proactive-birth", `Stable facet ${facet.motif} funded local child #${child.id} from ${policy.reserveInvestment.toFixed(1)} reserve.`);
    }
    this.organisms.push(...newborns);
  }

  getFacetBuddingLedger(facet) {
    let ledger = this.facetBuddingLedgers.get(facet.key);
    if (!ledger) {
      ledger = {
        facetKey: facet.key,
        attempts: 0,
        births: 0,
        lastBirthTick: null,
        lastComponentEnergy: 0,
        lastQualifiedCycleId: null,
        lastQualifiedCycleDelta: null,
        lastQualifiedCycleEndedTick: null
      };
      this.facetBuddingLedgers.set(facet.key, ledger);
    }
    return ledger;
  }

  getFacetBuddingBudget(facet, policy) {
    const componentMemberIds = this.getBondGroups().find((group) => group.includes(facet.memberIds[0])) ?? facet.memberIds;
    const componentEnergy = this.getComponentEnergy(componentMemberIds);
    const latestCycle = [...this.componentEpisodes]
      .reverse()
      .find((episode) => (
        episode.outcome === "next-gate-completion"
        && episode.endedTick !== null
        && episode.originalMemberIds.some((id) => componentMemberIds.includes(id))
      ));
    const cycleIsFresh = latestCycle
      && (policy.completedCycleFreshnessTicks <= 0
        || this.simulationTicks - latestCycle.endedTick <= policy.completedCycleFreshnessTicks);
    const positiveCycle = cycleIsFresh && latestCycle.componentEnergyDelta >= policy.minimumCycleEnergyDelta;
    return {
      componentMemberIds,
      componentEnergy,
      latestCycle: latestCycle ?? null,
      qualifies: componentEnergy >= policy.minimumComponentEnergy
        && (!policy.requirePositiveCompletedCycle || Boolean(positiveCycle))
    };
  }

  recordAutonomousFacetBudInComponentLedger(facet, budget, child, investment) {
    const affected = this.componentEpisodes.filter((episode) => (
      episode.endedTick === null
      && episode.originalMemberIds.some((id) => budget.componentMemberIds.includes(id))
    ));
    for (const episode of affected) {
      episode.budding ??= { births: 0, childIds: [], parentEnergyTransferred: 0, reserveInvestment: 0, offspringSurviving: 0 };
      episode.budding.births += 1;
      episode.budding.childIds.push(child.id);
      episode.budding.parentEnergyTransferred += child.energy;
      episode.budding.reserveInvestment += investment;
    }
  }

  handleAutonomousFacetBudding() {
    const policy = this.config.facet.autonomousBudding;
    if (!policy.enabled) return;
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const occupied = new Set(this.organisms.filter((organism) => organism.alive).map((organism) => `${organism.x},${organism.y}`));
    const usedParents = new Set(this.lastOrdinaryReproductionParents ?? []);
    const newborns = [];
    const facets = this.getFacets()
      .map((facet) => ({ ...facet, strength: this.getFacetStrength(facet.memberIds) }))
      .filter((facet) => facet.strength >= this.config.facet.minimumBondStrength)
      .sort((first, second) => (this.facetReserves.get(second.key) ?? 0) - (this.facetReserves.get(first.key) ?? 0));

    for (const facet of facets) {
      const reserve = this.facetReserves.get(facet.key) ?? 0;
      if (reserve < policy.reserveThreshold) continue;
      const ledger = this.getFacetBuddingLedger(facet);
      ledger.attempts += 1;
      const budget = this.getFacetBuddingBudget(facet, policy);
      ledger.lastComponentEnergy = Number(budget.componentEnergy.toFixed(3));
      ledger.lastQualifiedCycleId = budget.latestCycle?.id ?? null;
      ledger.lastQualifiedCycleDelta = budget.latestCycle?.componentEnergyDelta ?? null;
      ledger.lastQualifiedCycleEndedTick = budget.latestCycle?.endedTick ?? null;
      if (policy.cooldownTicks > 0 && ledger.lastBirthTick !== null
        && this.simulationTicks - ledger.lastBirthTick < policy.cooldownTicks) {
        this.autonomousFacetBuddingDenied.cooldown += 1;
        continue;
      }
      if (!budget.qualifies) {
        if (budget.componentEnergy < policy.minimumComponentEnergy) this.autonomousFacetBuddingDenied.componentEnergy += 1;
        else this.autonomousFacetBuddingDenied.completedCycle += 1;
        continue;
      }
      const members = facet.memberIds.map((id) => byId.get(id)).filter(Boolean);
      if (this.config.bond.topologyMemory.enabled
        && !this.qualifiesTopologyReproduction(members[0])) continue;
      const parent = members
        .filter((member) => !usedParents.has(member.id) && member.energy >= policy.memberEnergyFloor)
        .sort((first, second) => second.energy - first.energy)[0];
      if (!parent) continue;
      const birthSite = this.findFacetBirthSite(parent, facet, occupied);
      if (!birthSite) continue;

      if (!this.canAffordReproduction(parent)) continue;
      const child = parent.reproduce(this.nextOrganismId, birthSite.position, this.config.organism, {
        genomeEngine: this.genomeEngine,
        brainGenerator: this.brainGenerator,
        mutationEngine: this.mutationEngine
      });
      if (this.config.bond.topologyMemory.enabled) {
        const memoryPolicy = this.config.bond.topologyMemory;
        child.nodeTrace = Math.max(0, Math.min(memoryPolicy.maximumTrace, parent.nodeTrace * memoryPolicy.inheritanceFraction
          + (parent.random() - 0.5) * memoryPolicy.inheritanceNoise));
      }
      const investment = Math.min(this.config.facet.reserveInvestmentPerBirth, reserve);
      this.facetReserves.set(facet.key, reserve - investment);
      this.seedStructuralBond(parent.id, child.id, investment / 2);
      this.seedStructuralBond(birthSite.partner.id, child.id, investment / 2);
      this.recordEnergyAllocation(parent, "structuralSeed", investment);
      this.energyEconomics.allocations.reproduction += child.energy;
      this.nextOrganismId += 1;
      newborns.push(child);
      occupied.add(`${child.x},${child.y}`);
      usedParents.add(parent.id);
      this.births += 1;
      this.structuralBirths += 1;
      this.facetBirths += 1;
      this.autonomousFacetBirths += 1;
      ledger.births += 1;
      ledger.lastBirthTick = this.simulationTicks;
      this.facetReserveSpent += investment;
      this.structuralSeedEnergy += investment;
      this.recordAutonomousFacetBudInComponentLedger(facet, budget, child, investment);
      this.birthMarkers.push({ x: child.x, y: child.y, ttl: 10 });
      this.recordTelemetry("autonomous-facet-bud", `Facet ${facet.key} budded #${child.id}, spending parent energy and ${investment.toFixed(1)} reserve on two inherited bond seeds.`);
    }
    this.organisms.push(...newborns);
  }

  isActivelyBonded(organismId) {
    return [...this.bonds.values()].some((bond) => bond.firstId === organismId || bond.secondId === organismId);
  }

  findLocalBirthPosition(parent, occupied) {
    const offset = Math.floor(this.random() * DIRECTIONS.length);
    for (let index = 0; index < DIRECTIONS.length; index += 1) {
      const direction = DIRECTIONS[(offset + index) % DIRECTIONS.length];
      const position = this.world.wrapPosition(parent.x + direction.x, parent.y + direction.y);
      if (this.world.isWalkable(position.x, position.y) && !occupied.has(`${position.x},${position.y}`)) {
        return position;
      }
    }
    return null;
  }

  findFacetBirthSite(parent, facet, occupied) {
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const partners = facet.memberIds.map((id) => byId.get(id)).filter((member) => member && member.id !== parent.id);
    const offset = Math.floor(this.random() * DIRECTIONS.length);
    for (let index = 0; index < DIRECTIONS.length; index += 1) {
      const direction = DIRECTIONS[(offset + index) % DIRECTIONS.length];
      const position = this.world.wrapPosition(parent.x + direction.x, parent.y + direction.y);
      if (!this.world.isWalkable(position.x, position.y) || occupied.has(`${position.x},${position.y}`)) continue;
      const partner = partners.find((member) => this.isPositionAdjacentToMember(position, member));
      if (partner) return { position, partner };
    }
    return null;
  }

  isPositionAdjacentToMember(position, member) {
    const xDistance = Math.abs(position.x - member.x);
    const yDistance = Math.abs(position.y - member.y);
    const wrappedX = this.world.wraps ? Math.min(xDistance, this.world.width - xDistance) : xDistance;
    const wrappedY = this.world.wraps ? Math.min(yDistance, this.world.height - yDistance) : yDistance;
    return wrappedX <= 2 && wrappedY <= 2;
  }

  seedStructuralBond(firstId, secondId, energy) {
    const key = this.bondKey(firstId, secondId);
    this.structuralBirthSeeds.set(key, (this.structuralBirthSeeds.get(key) ?? 0) + energy);
    this.bondCandidates.set(key, 0);
  }

  getReproductionOpportunity() {
    const population = this.organisms.filter((organism) => organism.alive).length;
    const food = this.world.countTilesByType(TILE_TYPES.FOOD);
    const walkableTiles = this.world.width * this.world.height - this.world.countTilesByType(TILE_TYPES.WALL);
    const foodCapacity = Math.floor((this.world.width * this.world.height * this.config.world.foodTargetDensity)
      / this.config.ecology.reproductionFoodUnitsPerOrganism);
    const habitatCapacity = Math.floor(walkableTiles * this.config.ecology.reproductionHabitatFraction);
    const carryingCapacity = Math.max(1, Math.min(foodCapacity, habitatCapacity));
    const foodPressure = clamp(food / Math.max(1, population * this.config.ecology.reproductionFoodUnitsPerOrganism), 0, 1);
    const densityPressure = clamp(1 - (population / carryingCapacity) ** 2, 0, 1);

    return {
      opportunity: Number((this.config.ecology.maximumReproductionOpportunity * foodPressure * densityPressure).toFixed(3)),
      carryingCapacity,
      foodPressure: Number(foodPressure.toFixed(3)),
      densityPressure: Number(densityPressure.toFixed(3))
    };
  }

  removeDeadOrganisms() {
    const deadOrganisms = this.organisms.filter((organism) => !organism.alive);
    for (const organism of deadOrganisms) {
      loseDeadPantry(this,organism);
      const storedEnergy = Math.max(0, organism.energy);
      const residueEnergy = this.config.chemistry.deathResidueEnabled
        ? this.world.addDeathResidue(organism.x, organism.y, Math.min(storedEnergy * this.config.chemistry.deathResidueFraction, this.config.chemistry.deathResidueMaximum), this.config.chemistry.deathResidueMaximum)
        : 0;
      this.deathResidueCreated += residueEnergy;
      this.recordEnergyDeath(organism, residueEnergy);
      if (this.config.chemistry.enabled) this.world.addDetritus(organism.x, organism.y);
      this.deathMarkers.push({
        x: organism.x,
        y: organism.y,
        ttl: 14
      });
    }

    const before = this.organisms.length;
    this.organisms = this.organisms.filter((organism) => organism.alive);
    this.removeInvalidBonds();
    this.deaths += before - this.organisms.length;
  }

  resetEnergyEconomics() {
    this.energyEconomics = {
      income: { food: 0, gateWork: 0 },
      expenses: { movement: 0, maintenance: 0, perception: 0, bonds: 0, bondReserveMaintenance: 0, gateWork: 0, memory: 0, signals: 0, idle: 0 },
      losses: { capacityOverflow: 0, deathStoredEnergy: 0, relayTransfer: 0 },
      allocations: { reproduction: 0, structuralSeed: 0, structuralOverflow: 0, bondFunding: 0 },
      deaths: {},
      intervals: [],
      checkpoint: { income: { food: 0, gateWork: 0 }, expenses: { movement: 0, maintenance: 0, perception: 0, bonds: 0, bondReserveMaintenance: 0, gateWork: 0, memory: 0, signals: 0, idle: 0 }, losses: { capacityOverflow: 0, deathStoredEnergy: 0, relayTransfer: 0 }, allocations: { reproduction: 0, structuralSeed: 0, structuralOverflow: 0, bondFunding: 0 }, deaths: {} }
    };
  }

  recordEnergyFlow(organism, flow) {
    if (!flow) return;
    for (const [kind, values] of Object.entries(flow)) {
      for (const [key, value] of Object.entries(values)) {
        this.energyEconomics[kind][key] += value;
      }
    }
  }

  recordEnergyAllocation(organism, category, amount) {
    organism.energyLedger.allocations[category] += amount;
    this.energyEconomics.allocations[category] += amount;
  }

  captureStructuralOverflow(organism, result) {
    const settings = this.config.overflowCapture;
    if (!organism.alive || settings.mode === "disabled" || result.overflowEnergy <= 0) return 0;
    let remaining = result.overflowEnergy * settings.captureFraction * settings.transferEfficiency;
    let captured = 0;
    if (settings.mode === "bond") {
      const attached = [...this.bonds.values()]
        .filter((bond) => bond.firstId === organism.id || bond.secondId === organism.id)
        .sort((first, second) => (first.reserve ?? 0) - (second.reserve ?? 0));
      for (const bond of attached) {
        const reserve = bond.reserve ?? this.config.bond.initialReserve;
        const deposited = Math.min(remaining, Math.max(0, this.config.bond.reserveCapacity - reserve));
        if (deposited <= 0) continue;
        bond.reserve = reserve + deposited;
        captured += deposited;
        remaining -= deposited;
        this.energyTransfers.push({ fromId: organism.id, toId: bond.firstId === organism.id ? bond.secondId : bond.firstId, amount: Number(deposited.toFixed(2)), ttl: 6, kind: "overflow-routing" });
        this.overflowRoutingRecords.push({
          tick: this.simulationTicks,
          mode: "bond",
          fromId: organism.id,
          bond: this.bondKey(bond.firstId, bond.secondId),
          amount: Number(deposited.toFixed(3)),
          reserveBefore: Number(reserve.toFixed(3)),
          reserveAfter: Number(bond.reserve.toFixed(3))
        });
        if (this.overflowRoutingRecords.length > MAX_OVERFLOW_ROUTING_RECORDS) this.overflowRoutingRecords.shift();
        if (remaining <= 0) break;
      }
    } else if (settings.mode === "facet") {
      const facet = this.getStrongestFacetForMember(organism.id);
      if (facet && facet.strength >= this.config.facet.minimumBondStrength) {
        const reserve = this.facetReserves.get(facet.key) ?? 0;
        captured = Math.min(remaining, Math.max(0, this.config.facet.reserveCapacity - reserve));
        if (captured > 0) this.facetReserves.set(facet.key, reserve + captured);
      }
    }
    if (captured <= 0) return 0;
    result.energyFlow.losses.capacityOverflow -= captured;
    organism.energyLedger.losses.capacityOverflow -= captured;
    this.recordEnergyAllocation(organism, "structuralOverflow", captured);
    this.structuralOverflowCaptured += captured;
    this.structuralOverflowCapturedByMode[settings.mode] += captured;
    return captured;
  }

  createOverflowPlume(organism, result) {
    const chemistry = this.config.chemistry;
    const discarded = result.energyFlow?.losses?.capacityOverflow ?? 0;
    if (!chemistry.overflowPlumeEnabled || discarded <= 0) return 0;
    const accepted = this.world.addOverflowPlume(
      organism.x,
      organism.y,
      discarded * chemistry.overflowPlumeFraction,
      chemistry.overflowPlumeMaximum
    );
    if (accepted <= 0) return 0;
    result.energyFlow.losses.capacityOverflow -= accepted;
    organism.energyLedger.losses.capacityOverflow -= accepted;
    this.overflowPlumeCreated += accepted;
    return accepted;
  }

  findFacetOverflowPlume(members) {
    const radius = this.config.chemistry.overflowPlumeSenseRadius;
    const positions = new Map();
    for (const member of members) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const position = this.world.wrapPosition(member.x + dx, member.y + dy);
          positions.set(`${position.x},${position.y}`, position);
        }
      }
    }
    return [...positions.values()]
      .filter((position) => this.world.overflowPlume[position.y][position.x] >= this.config.chemistry.overflowPlumeEnergyPerFood)
      .filter((position) => members.every((member) => this.distanceBetweenPositions(member, position) <= radius))
      .sort((first, second) => this.world.overflowPlume[second.y][second.x] - this.world.overflowPlume[first.y][first.x])[0] ?? null;
  }

  condenseOverflowPlumes() {
    const chemistry = this.config.chemistry;
    if (!chemistry.overflowPlumeEnabled) return;
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    for (const facet of this.getFacets()) {
      if (this.getFacetStrength(facet.memberIds) < this.config.facet.minimumBondStrength) continue;
      const members = facet.memberIds.map((id) => byId.get(id)).filter(Boolean);
      if (members.length !== 3) continue;
      const plume = this.findFacetOverflowPlume(members);
      if (!plume) continue;
      const tile = this.world.getTile(plume.x, plume.y);
      if (tile.type !== TILE_TYPES.EMPTY || this.world.isBurning(plume.x, plume.y)) continue;
      const condensed = this.world.takeOverflowPlume(plume.x, plume.y, chemistry.overflowPlumeEnergyPerFood);
      if (condensed < chemistry.overflowPlumeEnergyPerFood) continue;
      tile.type = TILE_TYPES.FOOD;
      tile.resource = RESOURCE_TYPES.GREEN;
      tile.foodEnergy = 1;
      tile.foodOrigin = { type: "overflow-plume", facetKey: facet.key, condensedTick: this.simulationTicks };
      this.overflowPlumeCondensed += condensed;
      this.overflowPlumeFoodReleased += 1;
      this.recordTelemetry("overflow-plume-condensed", `Facet ${facet.key} condensed ${condensed.toFixed(1)} overflow charge at ${plume.x},${plume.y}.`);
    }
  }

  resetHarvestGeometry() {
    this.harvestGeometry = {
      attempts: 0,
      wouldOverflow: 0,
      reproductionEligible: 0,
      restrained: 0,
      partialHarvests: 0,
      energyRetainedInFood: 0,
      byOrigin: new Map(),
      byResource: new Map()
    };
  }

  recordHarvestGeometry(organism, result) {
    const decision = result.harvestDecision;
    if (!decision) return;
    const geometry = this.harvestGeometry;
    const add = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
    geometry.attempts += 1;
    if (decision.wouldOverflow) geometry.wouldOverflow += 1;
    if (decision.reproductionEligibleBeforeHarvest) geometry.reproductionEligible += 1;
    if (decision.restrained) geometry.restrained += 1;
    if (decision.partial) {
      geometry.partialHarvests += 1;
      geometry.energyRetainedInFood += decision.projectedMealEnergy * decision.remainingFoodAmount / Math.max(1e-9, decision.availableFoodAmount);
    }
    add(geometry.byOrigin, decision.origin);
    add(geometry.byResource, decision.resource);
  }

  getHarvestGeometryDiagnostics() {
    const geometry = this.harvestGeometry;
    return {
      attempts: geometry.attempts,
      wouldOverflow: geometry.wouldOverflow,
      wouldOverflowFraction: geometry.attempts ? Number((geometry.wouldOverflow / geometry.attempts).toFixed(3)) : 0,
      reproductionEligibleBeforeHarvest: geometry.reproductionEligible,
      reproductionEligibleFraction: geometry.attempts ? Number((geometry.reproductionEligible / geometry.attempts).toFixed(3)) : 0,
      restrainedHarvests: geometry.restrained,
      partialHarvests: geometry.partialHarvests,
      energyRetainedInFood: Number(geometry.energyRetainedInFood.toFixed(3)),
      byOrigin: Object.fromEntries(geometry.byOrigin.entries()),
      byResource: Object.fromEntries(geometry.byResource.entries())
    };
  }

  resetOverflowProvenance() {
    this.overflowProvenance = {
      total: 0,
      byPhase: new Map(),
      byOrigin: new Map(),
      byResource: new Map(),
      byOrganism: new Map(),
      byComponent: new Map(),
      deathsAfterOverflow: []
    };
  }

  recordOverflowProvenance(organism, result) {
    const discarded = result.energyFlow?.losses?.capacityOverflow ?? 0;
    if (discarded <= 0) return;
    const context = result.overflowContext ?? { phase: "unknown", origin: "unknown", resource: null };
    const group = this.getBondGroups().find((ids) => ids.includes(organism.id)) ?? [organism.id];
    const componentKey = group.length > 1 ? group.slice().sort((first, second) => first - second).join(":") : `loose:${organism.id}`;
    const add = (map, key, amount) => map.set(key, (map.get(key) ?? 0) + amount);
    this.overflowProvenance.total += discarded;
    add(this.overflowProvenance.byPhase, context.phase, discarded);
    add(this.overflowProvenance.byOrigin, context.origin, discarded);
    add(this.overflowProvenance.byResource, context.resource ?? "none", discarded);
    const organismRecord = this.overflowProvenance.byOrganism.get(organism.id) ?? {
      organismId: organism.id,
      lineageId: organism.lineageId,
      generation: organism.generation,
      total: 0,
      events: 0,
      phase: context.phase,
      origin: context.origin
    };
    organismRecord.total += discarded;
    organismRecord.events += 1;
    this.overflowProvenance.byOrganism.set(organism.id, organismRecord);
    const componentRecord = this.overflowProvenance.byComponent.get(componentKey) ?? {
      componentKey,
      memberCount: group.length,
      total: 0,
      events: 0,
      origin: context.origin
    };
    componentRecord.total += discarded;
    componentRecord.events += 1;
    componentRecord.memberCount = Math.max(componentRecord.memberCount, group.length);
    this.overflowProvenance.byComponent.set(componentKey, componentRecord);
  }

  getOverflowProvenanceDiagnostics() {
    const provenance = this.overflowProvenance;
    const roundedEntries = (map) => Object.fromEntries([...map.entries()].map(([key, value]) => [key, Number(value.toFixed(3))]));
    const ranked = (map) => [...map.values()]
      .sort((first, second) => second.total - first.total)
      .map((record) => ({ ...record, total: Number(record.total.toFixed(3)) }));
    const topTenPercentShare = (records) => {
      if (!records.length || provenance.total <= 0) return 0;
      const count = Math.max(1, Math.ceil(records.length * 0.1));
      return Number((records.slice(0, count).reduce((sum, record) => sum + record.total, 0) / provenance.total).toFixed(3));
    };
    const organisms = ranked(provenance.byOrganism);
    const components = ranked(provenance.byComponent);
    return {
      totalDiscarded: Number(provenance.total.toFixed(3)),
      byPhase: roundedEntries(provenance.byPhase),
      byOrigin: roundedEntries(provenance.byOrigin),
      byResource: roundedEntries(provenance.byResource),
      topTenPercentOrganismShare: topTenPercentShare(organisms),
      topTenPercentComponentShare: topTenPercentShare(components),
      topOrganisms: organisms.slice(0, 20),
      topComponents: components.slice(0, 20),
      deathsAfterOverflow: provenance.deathsAfterOverflow.slice(-50)
    };
  }

  recordEnergyDeath(organism, residueEnergy = 0) {
    const reason = organism.deathReason ?? "unknown";
    this.energyEconomics.deaths[reason] = (this.energyEconomics.deaths[reason] ?? 0) + 1;
    const storedEnergy = Math.max(0, organism.energy - residueEnergy);
    organism.energyLedger.losses.deathStoredEnergy += storedEnergy;
    this.energyEconomics.losses.deathStoredEnergy += storedEnergy;
    const overflow = this.overflowProvenance.byOrganism.get(organism.id)?.total ?? 0;
    this.overflowProvenance.deathsAfterOverflow.push({
      tick: this.simulationTicks,
      organismId: organism.id,
      lineageId: organism.lineageId,
      reason,
      priorOverflow: Number(overflow.toFixed(3))
    });
    if (this.overflowProvenance.deathsAfterOverflow.length > 1000) this.overflowProvenance.deathsAfterOverflow.shift();
  }

  energyEconomicsSnapshot() {
    const roundGroups = (groups) => Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, Number(value.toFixed(3))]));
    const foodUnits = this.world.countTilesByType(TILE_TYPES.FOOD);
    const potentialFoodEnergy = foodUnits * this.config.organism.foodEnergy;
    const totalIncome = Object.values(this.energyEconomics.income).reduce((total, value) => total + value, 0);
    const totalExpenses = Object.values(this.energyEconomics.expenses).reduce((total, value) => total + value, 0);
    const totalLosses = Object.values(this.energyEconomics.losses).reduce((total, value) => total + value, 0);
    return {
      intervalTicks: this.config.energeticEconomics.intervalTicks,
      income: roundGroups(this.energyEconomics.income),
      expenses: roundGroups(this.energyEconomics.expenses),
      allocations: roundGroups(this.energyEconomics.allocations),
      totalIncome: Number(totalIncome.toFixed(3)),
      totalExpenses: Number(totalExpenses.toFixed(3)),
      losses: roundGroups(this.energyEconomics.losses),
      totalLosses: Number(totalLosses.toFixed(3)),
      currentFoodUnits: foodUnits,
      unharvestedPotentialEnergy: Number(potentialFoodEnergy.toFixed(3)),
      deathCauses: { ...this.energyEconomics.deaths },
      intervals: this.energyEconomics.intervals
    };
  }

  captureEnergyEconomicsInterval() {
    const intervalTicks = this.config.energeticEconomics.intervalTicks;
    if (this.simulationTicks === 0 || this.simulationTicks % intervalTicks !== 0) return;
    const snapshot = this.energyEconomicsSnapshot();
    const delta = (current, previous) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, Number((value - (previous[key] ?? 0)).toFixed(3))]));
    const checkpoint = this.energyEconomics.checkpoint;
    this.energyEconomics.intervals.push({
      tick: this.simulationTicks,
      income: delta(snapshot.income, checkpoint.income),
      expenses: delta(snapshot.expenses, checkpoint.expenses),
      losses: delta(snapshot.losses, checkpoint.losses),
      allocations: delta(snapshot.allocations, checkpoint.allocations),
      population: this.organisms.length,
      unharvestedPotentialEnergy: snapshot.unharvestedPotentialEnergy,
      deathCauses: delta(snapshot.deathCauses, checkpoint.deaths)
    });
    this.energyEconomics.checkpoint = { income: snapshot.income, expenses: snapshot.expenses, losses: snapshot.losses, allocations: snapshot.allocations, deaths: snapshot.deathCauses };
    const maximum = this.config.energeticEconomics.maximumIntervals;
    if (this.energyEconomics.intervals.length > maximum) this.energyEconomics.intervals.shift();
  }

  resetEnergyLogistics() {
    this.energyLogistics = { timeSeries: [], checkpoint: null };
    this.lineageBirthTicks = new Map();
    this.completedLineageLongevities = [];
  }

  getEnergyDistribution() {
    const values = this.organisms.map((organism) => organism.energy).sort((first, second) => first - second);
    if (!values.length) return { minimum: 0, maximum: 0, mean: 0, median: 0, standardDeviation: 0, gini: 0 };
    const meanEnergy = values.reduce((total, value) => total + value, 0) / values.length;
    const median = values.length % 2
      ? values[Math.floor(values.length / 2)]
      : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    const variance = values.reduce((total, value) => total + (value - meanEnergy) ** 2, 0) / values.length;
    const totalEnergy = values.reduce((total, value) => total + value, 0);
    const weightedRankSum = values.reduce((total, value, index) => total + (index + 1) * value, 0);
    const gini = totalEnergy === 0 ? 0 : (2 * weightedRankSum) / (values.length * totalEnergy) - (values.length + 1) / values.length;
    return {
      minimum: Number(values[0].toFixed(3)),
      maximum: Number(values.at(-1).toFixed(3)),
      mean: Number(meanEnergy.toFixed(3)),
      median: Number(median.toFixed(3)),
      standardDeviation: Number(Math.sqrt(variance).toFixed(3)),
      gini: Number(gini.toFixed(4))
    };
  }

  recordCompletedLineages() {
    const active = new Set(this.organisms.map((organism) => organism.lineageId));
    for (const [lineageId, startedAt] of this.lineageBirthTicks) {
      if (active.has(lineageId)) continue;
      this.completedLineageLongevities.push(this.simulationTicks - startedAt);
      this.lineageBirthTicks.delete(lineageId);
    }
  }

  captureEnergyLogisticsTick() {
    this.recordCompletedLineages();
    const economics = this.energyEconomicsSnapshot();
    const previous = this.energyLogistics.checkpoint;
    const delta = (current, prior = {}) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, Number((value - (prior[key] ?? 0)).toFixed(3))]));
    const tickIncome = delta(economics.income, previous?.income);
    const tickExpenses = delta(economics.expenses, previous?.expenses);
    const tickLosses = delta(economics.losses, previous?.losses);
    const tickAllocations = delta(economics.allocations, previous?.allocations);
    const tickDeaths = delta(economics.deathCauses, previous?.deathCauses);
    const facets = this.getFacets();
    const bondReserve = [...this.bonds.values()].reduce((total, bond) => total + (bond.reserve ?? 0), 0);
    const facetReserve = facets.reduce((total, facet) => total + facet.reserve, 0);
    const organismEnergy = this.organisms.reduce((total, organism) => total + organism.energy, 0);
    const activeLineageLongevity = [...this.lineageBirthTicks.values()].map((startedAt) => this.simulationTicks - startedAt);
    const meanLineageLongevity = activeLineageLongevity.length
      ? average(activeLineageLongevity)
      : average(this.completedLineageLongevities);
    const bondReserveMaintenance = tickExpenses.bondReserveMaintenance;
    const entry = {
      tick: this.simulationTicks,
      population: this.organisms.length,
      births: this.births - (previous?.births ?? 0),
      deaths: this.deaths - (previous?.deaths ?? 0),
      starvationDeaths: tickDeaths["energy exhaustion"] ?? 0,
      ageDeaths: tickDeaths["maximum age"] ?? 0,
      totalEcosystemEnergy: Number((organismEnergy + bondReserve + facetReserve).toFixed(3)),
      energyStored: Number(organismEnergy.toFixed(3)),
      energyLockedInsideBonds: Number(bondReserve.toFixed(3)),
      energyHeldInFacetReserves: Number(facetReserve.toFixed(3)),
      energyHarvested: Number((tickIncome.food + tickIncome.gateWork).toFixed(3)),
      energyHarvestedFromGates: tickIncome.gateWork,
      energyDiscarded: tickLosses.capacityOverflow,
      energySpentOnMovement: tickExpenses.movement,
      energySpentOnSignaling: tickExpenses.signals,
      energySpentOnGateWork: tickExpenses.gateWork,
      energySpentMaintainingBonds: Number((tickExpenses.bonds + bondReserveMaintenance).toFixed(3)),
      energyInvestedIntoReproduction: tickAllocations.reproduction,
      bonds: this.bonds.size,
      facets: facets.length,
      gateCompletions: this.collectiveWorkCompletions,
      structuralBirths: this.structuralBirths,
      averageStructuralMaintenanceCost: Number(((tickExpenses.bonds + bondReserveMaintenance) / Math.max(1, this.bonds.size)).toFixed(3)),
      averageEnergyHeldPerFacet: Number((facetReserve / Math.max(1, facets.length)).toFixed(3)),
      averageReserveTurnover: Number(((bondReserveMaintenance + (this.bondEnergyFed - (previous?.bondEnergyFed ?? 0)) + (this.bondSupportEnergyReleased - (previous?.bondSupportEnergyReleased ?? 0))) / Math.max(1, bondReserve)).toFixed(4)),
      lineageLongevity: Number(meanLineageLongevity.toFixed(3)),
      energyDistribution: this.getEnergyDistribution()
    };
    this.energyLogistics.timeSeries.push(entry);
    if (this.energyLogistics.timeSeries.length > this.config.energeticEconomics.maximumTimeSeriesTicks) this.energyLogistics.timeSeries.shift();
    this.energyLogistics.checkpoint = {
      income: economics.income, expenses: economics.expenses, losses: economics.losses,
      allocations: economics.allocations, deathCauses: economics.deathCauses, births: this.births, deaths: this.deaths,
      bondEnergyFed: this.bondEnergyFed, bondSupportEnergyReleased: this.bondSupportEnergyReleased
    };
  }

  updateMarkers() {
    this.birthMarkers = this.birthMarkers
      .map((marker) => ({ ...marker, ttl: marker.ttl - 1 }))
      .filter((marker) => marker.ttl > 0);

    this.deathMarkers = this.deathMarkers
      .map((marker) => ({ ...marker, ttl: marker.ttl - 1 }))
      .filter((marker) => marker.ttl > 0);

    this.energyTransfers = this.energyTransfers
      .map((transfer) => ({ ...transfer, ttl: transfer.ttl - 1 }))
      .filter((transfer) => transfer.ttl > 0);

    this.primaryProductionMarkers = this.primaryProductionMarkers
      .map((marker) => ({ ...marker, ttl: marker.ttl - 1 }))
      .filter((marker) => marker.ttl > 0);
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
    this.lastTickTime = Date.now();
  }

  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  reset() {
    this.pantryTopologyCache=null;
    this.pantryStats=null;
    this.resourcePatchState=null;
    this.morphologyDemoPhase=null;
    this.morphologyStock = this.morphologyField?.reward.map(row=>row.map(()=>0));
    this.morphologyStats = { moves:0,shared:0,transferLoss:0,fieldIncome:0,fieldGenerated:0,dangerCost:0 };
    this.harvestSupportStats = { transfers: 0, delivered: 0, lost: 0 };
    this.neighbourSupportStats = { transfers: 0, delivered: 0, lost: 0 };
    this.conservationHistory = new Map();
    this.conservationMemberTicks = 0;
    this.shrinkHistory = new Map();
    this.shrinkStats = { reclaimed: 0, energyRecovered: 0, energyLost: 0 };
    this.random = createSeededRandom(this.seed);
    this.world = new World(this.config.world, this.random);
    if (this.config.hazards.fireEnabled) {
      this.world.igniteRandomFood(this.config.hazards.fireDuration, this.config.chemistry.enabled);
    }
    this.organisms = [];
    this.simulationTicks = 0;
    this.births = 0;
    this.deaths = 0;
    this.resetEnergyEconomics();
    this.resetEnergyLogistics();
    this.birthMarkers = [];
    this.deathMarkers = [];
    this.bonds.clear();
    this.componentReserves.clear();
    this.componentReserveDeposited = 0;
    this.componentReserveWithdrawn = 0;
    this.componentReserveMemberSupport = 0;
    this.componentReserveBondFunding = 0;
    this.collectiveMemoryLocations = [];
    this.collectiveMemorySuccesses.clear();
    this.topologyMotifs.clear();
    this.topologyRoleCounts = { terminal: 0, hub: 0, core: 0, interior: 0 };
    this.topologyStableTicks.clear();
    this.facetMotifMemory.clear();
    this.facetMotifStableTicks.clear();
    this.tetheredScoutEpisodes.clear();
    this.tetheredScoutDiagnostics = {
      eligibleScouts: 0,
      activeEpisodes: 0,
      departures: 0,
      returns: 0,
      leashViolations: 0,
      energyAborts: 0,
      timeoutAborts: 0
      ,valueFinds: 0
      ,successfulReturns: 0
    };
    this.bondGroupsCache = null;
    this.bondCandidates.clear();
    this.structuralBirthSeeds.clear();
    this.facetReserves.clear();
    this.telemetryEvents = [];
    this.bondsFormed = 0;
    this.bondsBroken = 0;
    this.bondBreakReasons = {};
    this.refineryProgress.clear();
    this.facetCatalysts.clear();
    this.facetNurseryCredits.clear();
    this.facetNiches.clear();
    this.refineryConversions = 0;
    this.refineryFoodReleased = 0;
    this.refineryNutrientsProduced = 0;
    this.deathResidueCreated = 0;
    this.deathResidueRecovered = 0;
    this.overflowPlumeCreated = 0;
    this.overflowPlumeCondensed = 0;
    this.overflowPlumeFoodReleased = 0;
    this.collectiveWorkCompletions = 0;
    this.collectiveWorkFoodReleased = 0;
    this.collectiveWorkAttendances = 0;
    this.collectiveWorkFieldHarvests = 0;
    this.collectiveWorkFieldHarvestsByWorkers = 0;
    this.collectiveWorkFieldHarvestsByOthers = 0;
    this.gateFacetAssignments.clear();
    this.gateDiscoveryReports.clear();
    this.gateDiscoveryTargets.clear();
    this.gateDiscoveryStats = { sightings: 0, relays: 0, consensuses: 0 };
    this.collectiveGateNavigationMoves = 0;
    this.collectivePlumeNavigationMoves = 0;
    this.collectiveGateArrivals = 0;
    this.componentLifecycle.clear();
    this.componentLifecycleDeferrals = 0;
    this.componentLifecycleMigrations = 0;
    this.collectiveCensusRecords = [];
    this.collectiveLineages.clear();
    this.collectiveLineageEvents = [];
    this.previousCollectiveCensusCandidates = [];
    this.nextCollectiveLineageId = 1;
    this.collectiveWorkHarvestLineages.clear();
    this.gateFoodCaptureRecords = [];
    this.nextGateFoodCaptureId = 1;
    this.gateFieldCycles = [];
    this.nextGateFieldCycleId = 1;
    this.componentEpisodes = [];
    this.nextComponentEpisodeId = 1;
    this.nextCourierReportId = 1;
    this.courierReportsCreated = 0;
    this.courierHandoffs = 0;
    this.nextCourierReportTick = 0;
    this.energyTransfers = [];
    this.primaryProductionMarkers = [];
    this.facetWorkTrail = Array.from({ length: this.world.height }, () => Array(this.world.width).fill(0));
    this.compoundHeadings.clear();
    this.facetTransfers = 0;
    this.facetEnergyShared = 0;
    this.facetHarvests = 0;
    this.facetHarvestEnergy = 0;
    this.facetHarvestReserveEnergy = 0;
    this.facetBirths = 0;
    this.autonomousFacetBirths = 0;
    this.facetBuddingLedgers.clear();
    this.topologyProactiveBirths = 0;
    this.topologyProactiveBirthAttempts = 0;
    this.topologyProactiveBirthDenied = { reserve: 0, memory: 0, energy: 0, cooldown: 0, site: 0 };
    this.topologyProactiveBirthTicks.clear();
    this.autonomousFacetBuddingDenied = { cooldown: 0, componentEnergy: 0, completedCycle: 0 };
    this.facetReserveSpent = 0;
    this.bondsFed = 0;
    this.bondEnergyFed = 0;
    this.bondSupportTransfers = 0;
    this.bondSupportEnergyReleased = 0;
    this.structuralBirths = 0;
    this.structuralSeedEnergy = 0;
    this.collectiveMoves = 0;
    this.collectiveResourceDirectedMoves = 0;
    this.primaryResourceUnits = 0;
    this.primaryPotentialEnergy = 0;
    this.latestPrimaryProduction = 0;
    this.environmentMemoryWrites = 0;
    this.environmentMemoryDeposited = 0;
    this.environmentMemoryEnergySpent = 0;
    this.environmentMemoryLineages.clear();
    this.structuralOverflowCaptured = 0;
    this.structuralOverflowCapturedByMode = { bond: 0, facet: 0 };
    this.overflowRoutingRecords = [];
    this.resetOverflowProvenance();
    this.satietyMigrationDeferrals = 0;
    this.resetHarvestGeometry();
    this.starvationDiagnostics = [];
    this.bondRelayTransfers = 0;
    this.bondRelayEnergyWithdrawn = 0;
    this.bondRelayEnergyDelivered = 0;
    this.bondRelayRescues = 0;
    this.guidedSupportStats = { budgetSpent: 0, memberSupport: 0, bondReserveSupport: 0, quietBondTicks: 0, supportCredits: 0, supportRewards: 0 };
    this.guidedSupportCredits = 0;
    this.initializeWorkGates();
    this.snapshotVersion += 1;
    this.seedInitialPopulation(this.config.organism.initialPopulation);
  }

  randomize() {
    this.setSeed((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  }

  setSeed(seed) {
    this.seed = normalizeSeed(seed);
    this.reset();
  }

  setWorldNumber(worldNumber) {
    const generatedWorld = this.generatorEngine.generate(this.baseConfig, worldNumber);
    const founderGenome = this.config.organism.founderGenome;
    this.worldNumber = generatedWorld.composition.number;
    this.config = generatedWorld.config;
    this.config.organism.founderGenome = founderGenome;
    this.speed = this.config.simulation.defaultSpeed;
    this.reset();
  }

  setSpeed(speed) {
    const numericSpeed = Number(speed);
    if (this.config.simulation.speedOptions.includes(numericSpeed)) {
      this.speed = numericSpeed;
    }
  }

  setFoodGrowthRate(growthRate) {
    this.config.food.growthRate = clamp(Number(growthRate), 0, 1);
  }

  setFoodTargetDensity(targetDensity) {
    this.config.world.foodTargetDensity = clamp(Number(targetDensity), 0, 0.5);
  }

  setMutationRate(mutationRate) {
    this.config.organism.mutationRate = clamp(Number(mutationRate), 0, 0.25);
  }

  setSignalEmissionCost(emissionCost) {
    this.config.signal.emissionCost = clamp(Number(emissionCost), 0, 1);
  }

  bondKey(firstId, secondId) {
    return firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;
  }

  recordTelemetry(type, message) {
    this.telemetryEvents.push({ tick: this.simulationTicks, type, message });
    if (this.telemetryEvents.length > MAX_TELEMETRY_EVENTS) this.telemetryEvents.shift();
  }

  getCoupledIds() {
    const ids = new Set([...this.bonds.values()].flatMap((bond) => [bond.firstId, bond.secondId]));
    for (const key of this.bondCandidates.keys()) {
      const [firstId, secondId] = key.split(":").map(Number);
      ids.add(firstId);
      ids.add(secondId);
    }
    return ids;
  }

  getNeighborStatesByOrganism() {
    const statesById = new Map(this.organisms
      .filter((organism) => organism.alive)
      .map((organism) => [organism.id, []]));
    const organismsById = new Map(this.organisms
      .filter((organism) => organism.alive)
      .map((organism) => [organism.id, organism]));

    for (const bond of this.bonds.values()) {
      const first = organismsById.get(bond.firstId);
      const second = organismsById.get(bond.secondId);
      if (!first || !second) continue;
      statesById.get(first.id)?.push({ id: second.id, value: second.getPersistentState() });
      statesById.get(second.id)?.push({ id: first.id, value: first.getPersistentState() });
    }
    return statesById;
  }

  getStructuralFocus(organism) {
    if (!organism.genomeProfile.traits.canCouple) return null;
    const facet = this.getStrongestFacetForMember(organism.id);
    if (!facet) return null;
    if (this.getActiveCollectiveWorkFields().some((field) => this.distanceToGate(organism, field) <= field.radius)) return "gate-field";
    if (!this.config.refinery.enabled) return null;
    return (this.facetCatalysts.get(facet.key) ?? 0) > 0 ? "material" : "catalyst";
  }

  recordEnvironmentMemoryWrite(organism, write) {
    if (write.requested <= 0) return;
    this.environmentMemoryWrites += 1;
    this.environmentMemoryDeposited += write.deposited;
    this.environmentMemoryEnergySpent += write.paidCost;
    const lineage = this.environmentMemoryLineages.get(organism.lineageId) ?? {
      lineageId: organism.lineageId, writes: 0, deposited: 0, energySpent: 0, readTicks: 0
    };
    lineage.writes += 1;
    lineage.deposited += write.deposited;
    lineage.energySpent += write.paidCost;
    this.environmentMemoryLineages.set(organism.lineageId, lineage);
  }

  recordEnvironmentMemoryReads() {
    for (const organism of this.organisms) {
      if (!organism.alive || !organism.genomeProfile.traits.canReadEnvironment) continue;
      const lineage = this.environmentMemoryLineages.get(organism.lineageId) ?? {
        lineageId: organism.lineageId, writes: 0, deposited: 0, energySpent: 0, readTicks: 0
      };
      lineage.readTicks += 1;
      this.environmentMemoryLineages.set(organism.lineageId, lineage);
    }
  }

  recordFacetWorkTrail() {
    const organismsById = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const activeFacets = this.getFacets()
      .filter((facet) => this.getFacetStrength(facet.memberIds) >= this.config.facet.minimumBondStrength);
    for (const facet of activeFacets) {
      for (const memberId of facet.memberIds) {
        const member = organismsById.get(memberId);
        if (!member) continue;
        // Observation only: this history is never consulted by simulation physics.
        this.facetWorkTrail[member.y][member.x] = Math.min(255, this.facetWorkTrail[member.y][member.x] + 1);
      }
    }
  }

  getActiveCollectiveWorkFields() {
    return this.workGates
      .filter((gate) => gate.fieldStrength > 0)
      .map((gate) => ({
        x: gate.x,
        y: gate.y,
        strength: gate.fieldStrength,
        radius: this.config.collectiveWork.gateFieldSenseRadius,
        outputMode: this.config.collectiveWork.gateOutputMode
      }));
  }

  decayCourierKnowledge() {
    if (!this.config.courier.enabled) return;
    for (const organism of this.organisms) {
      for (const key of ["courierReport", "courierMemory"]) {
        if (!organism[key]) continue;
        organism[key].ttl -= 1;
        if (organism[key].ttl <= 0) organism[key] = null;
      }
    }
    this.limitCourierReports();
  }

  limitCourierReports() {
    const activeReports = this.organisms.filter((organism) => organism.alive && organism.courierReport)
      .sort((first, second) => second.energy - first.energy || first.id - second.id);
    for (const organism of activeReports.slice(this.config.courier.maxActiveScouts)) organism.courierReport = null;
  }

  getCourierSpecialists() {
    return this.organisms
      .filter((organism) => organism.alive && !this.isActivelyBonded(organism.id)
        && organism.energy >= this.config.courier.highEnergyThreshold
        && organism.genomeProfile.traits.canShareInformation && organism.genomeProfile.traits.canPersistState)
      .sort((first, second) => second.energy - first.energy || first.id - second.id)
      .slice(0, this.config.courier.maxActiveScouts);
  }

  findCourierObservation(organism) {
    const radius = this.config.courier.observationRadius;
    const actionableGate = this.workGates
      .filter((gate) => gate.fieldStrength <= 0 && gate.phase === "observe")
      .sort((first, second) => this.distanceToGate(organism, first) - this.distanceToGate(organism, second))[0];
    if (!actionableGate || this.distanceToGate(organism, actionableGate) > radius) return null;
    return {
      x: actionableGate.x,
      y: actionableGate.y,
      type: "GATE_READY",
      phase: actionableGate.phase,
      distance: this.distanceToGate(organism, actionableGate)
    };
  }

  createCourierReport(organism) {
    if (!this.config.courier.enabled || !organism.alive || organism.energy < this.config.courier.highEnergyThreshold
      || !organism.genomeProfile.traits.canShareInformation || !organism.genomeProfile.traits.canPersistState
      || this.isActivelyBonded(organism.id)) return;
    if (!this.getCourierSpecialists().some((specialist) => specialist.id === organism.id)) return;
    if (this.simulationTicks < this.nextCourierReportTick) return;
    const observation = this.findCourierObservation(organism);
    if (!observation) return;
    // A scout carries one observation through its finite lifetime; it does not rewrite its message every tick.
    if (organism.courierReport) return;
    organism.courierReport = {
      id: this.nextCourierReportId++,
      type: observation.type,
      x: observation.x,
      y: observation.y,
      ttl: this.config.courier.reportLifetime,
      sourceId: organism.id,
      sourceLineageId: organism.lineageId
    };
    this.courierReportsCreated += 1;
    this.nextCourierReportTick = this.simulationTicks + this.config.courier.reportInterval;
    this.limitCourierReports();
    this.recordTelemetry("courier-observation", `Scout #${organism.id} recorded ${observation.type} at ${observation.x},${observation.y}.`);
  }

  updateCourierExchange() {
    if (!this.config.courier.enabled) return;
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const coupledIds = this.getCoupledIds();
    const couriers = this.organisms.filter((organism) => organism.alive && !coupledIds.has(organism.id) && organism.courierReport);
    for (const groupIds of this.getBondGroups()) {
      const members = groupIds.map((id) => byId.get(id)).filter(Boolean);
      const eligibleFacet = members.length >= 3 && members.some((member) => this.getStrongestFacetForMember(member.id));
      if (!eligibleFacet) continue;
      for (const courier of couriers) {
        if (!members.some((member) => this.areAdjacent(courier, member))) continue;
        const report = courier.courierReport;
        const existing = members.find((member) => member.courierMemory)?.courierMemory ?? null;
        if (!this.shouldAcceptCourierReport(report, existing, members)) continue;
        let accepted = false;
        for (const member of members) {
          if (member.courierMemory?.id === report.id) continue;
          member.courierMemory = { ...report };
          accepted = true;
        }
        if (accepted) {
          this.courierHandoffs += 1;
          courier.energy = Math.max(0, courier.energy - this.config.courier.handoffEnergyCost);
          this.recordTelemetry("courier-handoff", `Scout #${courier.id} passed ${report.type} location to bonded compound ${groupIds.join(",")}.`);
        }
      }
    }
  }

  courierReportPriority(report) {
    return report?.type === "GATE_READY" ? 2 : 1;
  }

  shouldAcceptCourierReport(candidate, existing, members) {
    if (!existing) return true;
    if (existing.id === candidate.id) return false;
    const candidatePriority = this.courierReportPriority(candidate);
    const existingPriority = this.courierReportPriority(existing);
    if (candidatePriority !== existingPriority) return candidatePriority > existingPriority;
    const distance = (report) => Math.min(...members.map((member) => {
      const xDistance = Math.abs(member.x - report.x);
      const yDistance = Math.abs(member.y - report.y);
      const wrappedX = this.world.wraps ? Math.min(xDistance, this.world.width - xDistance) : xDistance;
      const wrappedY = this.world.wraps ? Math.min(yDistance, this.world.height - yDistance) : yDistance;
      return Math.max(wrappedX, wrappedY);
    }));
    return existing.ttl <= this.config.courier.reportLifetime / 3 || distance(candidate) + 1 < distance(existing);
  }

  getCourierTarget(organism) {
    if (!this.config.courier.enabled || !this.isActivelyBonded(organism.id) || !this.getStrongestFacetForMember(organism.id) || !organism.courierMemory) return null;
    return organism.courierMemory;
  }

  initializeWorkGates() {
    this.workGates = [];
    if (!this.config.collectiveWork.enabled) return;
    const occupied = new Set();
    for (let index = 0; index < this.config.collectiveWork.gateCount; index += 1) {
      const position = this.world.findRandomOpenPosition(occupied);
      if (!position) break;
      occupied.add(`${position.x},${position.y}`);
      this.workGates.push({
        id: index + 1,
        ...position,
        phase: "observe",
        phaseTick: 0,
        progress: 0,
        targetState: null,
        attendingFacetKey: null,
        cooldown: 0,
        fieldStrength: 0,
        productionBudget: 0,
        energyStock: this.config.collectiveWork.gateEnergyStock,
        energyReleased: 0,
        fieldStartedTick: null,
        lastFieldLifetime: null,
        activeCycleId: null,
        exhausted: false,
        fieldFacetKey: null,
        fieldPorts: null,
        nextPortIndex: 0
      });
    }
  }

  distanceToGate(organism, gate) {
    const xDistance = Math.abs(organism.x - gate.x);
    const yDistance = Math.abs(organism.y - gate.y);
    const wrappedX = this.world.wraps ? Math.min(xDistance, this.world.width - xDistance) : xDistance;
    const wrappedY = this.world.wraps ? Math.min(yDistance, this.world.height - yDistance) : yDistance;
    return Math.max(wrappedX, wrappedY);
  }

  getCollectiveWorkCue(organism) {
    if (!this.config.collectiveWork.enabled || !organism.genomeProfile.traits.canShareInformation) return 0;
    const gate = this.workGates
      .filter((candidate) => candidate.phase === "observe" && candidate.cooldown <= 0)
      .sort((first, second) => this.distanceToGate(organism, first) - this.distanceToGate(organism, second))[0];
    if (!gate || this.distanceToGate(organism, gate) > this.config.collectiveWork.gateRadius) return 0;
    // A gate exposes three local fragments rather than one globally labelled answer.
    const fragment = Math.abs(organism.x - gate.x + 2 * (organism.y - gate.y) + 9) % 3;
    return [0.25, 0.8, 1.35][fragment];
  }

  getFacetAtWorkGate(gate) {
    const organismsById = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    return this.getFacets()
      .map((facet) => ({ ...facet, members: facet.memberIds.map((id) => organismsById.get(id)).filter(Boolean) }))
      .filter((facet) => facet.members.length === 3)
      .filter((facet) => this.getFacetStrength(facet.memberIds) >= this.config.facet.minimumBondStrength)
      .filter((facet) => facet.members.every((member) => member.genomeProfile.traits.canCouple
        && member.genomeProfile.traits.canPersistState && member.genomeProfile.traits.canShareInformation))
      .filter((facet) => facet.members.every((member) => this.distanceToGate(member, gate) <= this.config.collectiveWork.gateRadius))
      .sort((first, second) => first.key.localeCompare(second.key))[0] ?? null;
  }

  releaseCollectiveWorkFood(gate, requested = 1) {
    if (!Number.isFinite(gate.energyStock)) gate.energyStock = this.config.collectiveWork.gateEnergyStock;
    if (!Number.isFinite(gate.energyReleased)) gate.energyReleased = 0;
    if (gate.exhausted || gate.energyStock <= 0) return 0;
    const units = Math.min(requested, gate.energyStock);
    const released = this.config.collectiveWork.gateOutputMode === "port-coupled"
      ? this.releasePortCoupledFood(gate, units)
      : this.releaseDiffuseCollectiveWorkFood(gate, units);
    gate.energyStock = Math.max(0, gate.energyStock - released);
    gate.energyReleased += released;
    if (gate.energyStock <= 0) this.exhaustGate(gate);
    return released;
  }

  exhaustGate(gate) {
    if (gate.exhausted) return;
    gate.exhausted = true;
    this.closeGateFieldCycle(gate, "exhausted");
    gate.fieldStrength = 0;
    gate.productionBudget = 0;
    gate.fieldPorts = null;
    this.gateFacetAssignments.delete(gate.fieldFacetKey);
    gate.fieldFacetKey = null;
    gate.attendingFacetKey = null;
    gate.targetState = null;
    gate.progress = 0;
    gate.phase = "exhausted";
    gate.phaseTick = 0;
    gate.lastFieldLifetime = gate.fieldStartedTick === null ? null : this.simulationTicks - gate.fieldStartedTick;
    gate.fieldStartedTick = null;
    gate.cooldown = this.config.collectiveWork.gateExhaustionCooldownTicks;
    this.recordTelemetry("gate-exhausted", `Gate #${gate.id} released its finite energy stock and entered ${gate.cooldown} ticks of dormancy.`);
  }

  getGateWorkPorts(gate) {
    if (Array.isArray(gate.fieldPorts) && gate.fieldPorts.length) {
      return gate.fieldPorts.map((port, index) => ({ x: port.x, y: port.y, index }));
    }
    const offsets = [{ x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
    const seen = new Set();
    return offsets.flatMap((offset, index) => {
      const position = this.world.wrapPosition(gate.x + offset.x, gate.y + offset.y);
      const key = `${position.x},${position.y}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...position, index }];
    });
  }

  setGateFieldPorts(gate, facet) {
    // Production appears beside, never underneath, the working members.  This keeps the energy
    // physical and harvestable while making a functioning gate legible on the canvas.
    const occupiedByFacet = new Set(facet.members.map((member) => `${member.x},${member.y}`));
    const used = new Set();
    gate.fieldPorts = facet.members.map((member, index) => {
      const outwardX = Math.sign(member.x - gate.x);
      const outwardY = Math.sign(member.y - gate.y);
      const candidates = [...DIRECTIONS].sort((first, second) => {
        const firstScore = first.x * outwardX + first.y * outwardY;
        const secondScore = second.x * outwardX + second.y * outwardY;
        return secondScore - firstScore;
      });
      const position = candidates
        .map((direction) => this.world.wrapPosition(member.x + direction.x, member.y + direction.y))
        .find((candidate) => this.world.isWalkable(candidate.x, candidate.y)
          && !occupiedByFacet.has(`${candidate.x},${candidate.y}`)
          && !used.has(`${candidate.x},${candidate.y}`));
      const port = position ?? this.world.wrapPosition(member.x + 1, member.y);
      used.add(`${port.x},${port.y}`);
      return { ...port, index };
    });
  }

  releasePortCoupledFood(gate, requested = 1) {
    const ports = this.getGateWorkPorts(gate);
    let released = 0;
    for (let attempt = 0; attempt < ports.length && released < requested; attempt += 1) {
      const portIndex = (gate.nextPortIndex + attempt) % ports.length;
      const port = ports[portIndex];
      const tile = this.world.getTile(port.x, port.y);
      if (tile.type !== TILE_TYPES.EMPTY || this.world.isBurning(port.x, port.y)) continue;
      tile.type = TILE_TYPES.FOOD;
      tile.resource = [RESOURCE_TYPES.GREEN, RESOURCE_TYPES.BLUE, RESOURCE_TYPES.RED][port.index % 3];
      tile.foodEnergy = 1;
      const recordId = this.recordGateFoodRelease(gate, port);
      tile.foodOrigin = {
        type: "gate-field", mode: "port-coupled", gateId: gate.id, facetKey: gate.fieldFacetKey ?? null, portIndex: port.index,
        gateFoodRecordId: recordId, releasedTick: this.simulationTicks
      };
      gate.nextPortIndex = (portIndex + 1) % ports.length;
      released += 1;
    }
    return released;
  }

  releaseDiffuseCollectiveWorkFood(gate, requested = 1) {
    let released = 0;
    for (let radius = 0; radius <= 2 && released < requested; radius += 1) {
      for (let dy = -radius; dy <= radius && released < requested; dy += 1) {
        for (let dx = -radius; dx <= radius && released < requested; dx += 1) {
          const position = this.world.wrapPosition(gate.x + dx, gate.y + dy);
          const tile = this.world.getTile(position.x, position.y);
          if (tile.type !== TILE_TYPES.EMPTY || this.world.isBurning(position.x, position.y)) continue;
          tile.type = TILE_TYPES.FOOD;
          tile.resource = [RESOURCE_TYPES.GREEN, RESOURCE_TYPES.BLUE, RESOURCE_TYPES.RED][released % 3];
          tile.foodEnergy = 1;
          const recordId = this.recordGateFoodRelease(gate, position);
          tile.foodOrigin = {
            type: "gate-field", mode: "diffuse", gateId: gate.id, facetKey: gate.fieldFacetKey ?? null,
            gateFoodRecordId: recordId, releasedTick: this.simulationTicks
          };
          released += 1;
        }
      }
    }
    return released;
  }

  updateCollectiveWorkFields() {
    for (const gate of this.workGates) {
      if (gate.fieldStrength <= 0) continue;
      if (this.config.collectiveWork.gateOutputMode === "port-coupled") {
        const maintainingFacet = this.getFacetAtWorkGate(gate);
        if (!maintainingFacet || maintainingFacet.key !== gate.fieldFacetKey) {
          this.closeGateFieldCycle(gate, "facet-lost");
          this.gateFacetAssignments.delete(gate.fieldFacetKey);
          gate.fieldStrength = 0;
          gate.productionBudget = 0;
          gate.fieldPorts = null;
          gate.lastFieldLifetime = gate.fieldStartedTick === null ? null : this.simulationTicks - gate.fieldStartedTick;
          gate.fieldStartedTick = null;
          this.recordTelemetry("gate-field-ended", `Gate #${gate.id} production stopped because facet ${gate.fieldFacetKey ?? "unknown"} left or dissolved.`);
          continue;
        }
      }
      gate.fieldStrength = Math.max(0, gate.fieldStrength - this.config.collectiveWork.gateFieldDecay);
      if (gate.fieldStrength <= 0) {
        this.closeGateFieldCycle(gate, "field-decayed");
        this.gateFacetAssignments.delete(gate.fieldFacetKey);
        gate.fieldFacetKey = null;
        gate.fieldPorts = null;
        continue;
      }
      const productionRate = this.config.collectiveWork.gateOutputMode === "port-coupled"
        ? this.config.collectiveWork.gatePortFoodRate
        : this.config.collectiveWork.gateFieldFoodRate;
      gate.productionBudget += gate.fieldStrength * productionRate;
      while (gate.productionBudget >= 1) {
        const released = this.releaseCollectiveWorkFood(gate, 1);
        if (released <= 0) break;
        gate.productionBudget -= 1;
        this.collectiveWorkFoodReleased += released;
        if (gate.exhausted) break;
      }
    }
  }

  startGateFieldCycle(gate, facet) {
    const members = facet.members.map((member) => ({ id: member.id, energy: member.energy }));
    const memberIds = members.map((member) => member.id);
    const componentMemberIds = this.getBondGroups().find((group) => group.includes(memberIds[0])) ?? memberIds;
    const internalReserve = [...this.bonds.values()]
      .filter((bond) => memberIds.includes(bond.firstId) && memberIds.includes(bond.secondId))
      .reduce((sum, bond) => sum + (bond.reserve ?? 0), 0);
    const cycle = {
      id: this.nextGateFieldCycleId++, gateId: gate.id, facetKey: facet.key,
      startedTick: this.simulationTicks, endedTick: null, outcome: null,
      memberStartEnergy: Object.fromEntries(members.map((member) => [member.id, member.energy])),
      memberLastEnergy: Object.fromEntries(members.map((member) => [member.id, member.energy])),
      internalReserveStart: internalReserve,
      facetReserveStart: this.facetReserves.get(facet.key) ?? 0,
      componentMemberIdsAtStart: [...componentMemberIds],
      componentEnergyStart: this.getComponentEnergy(componentMemberIds),
      income: { gateWork: 0, food: 0 }, expenses: { movement: 0, maintenance: 0, perception: 0, bonds: 0, reserveMaintenance: 0, signals: 0, memory: 0, idle: 0 },
      allocations: { bondReserve: 0, externalBondReserve: 0, facetSharing: 0, externalFacetSharing: 0, facetCapital: 0 }, losses: { capacityOverflow: 0 },
      workerGateHarvests: 0, competitorGateHarvests: 0
    };
    this.gateFieldCycles.push(cycle);
    if (this.gateFieldCycles.length > MAX_GATE_CAPTURE_RECORDS) this.gateFieldCycles.shift();
    gate.activeCycleId = cycle.id;
    this.resolveComponentEpisodesWithCompletion(facet);
    this.startComponentEpisode(cycle, componentMemberIds);
  }

  startComponentEpisode(cycle, componentMemberIds) {
    this.componentEpisodes.push({
      id: this.nextComponentEpisodeId++,
      cycleId: cycle.id,
      startedTick: this.simulationTicks,
      fieldEndedTick: null,
      endedTick: null,
      outcome: null,
      originalMemberIds: [...componentMemberIds],
      startEnergy: this.getComponentEnergy(componentMemberIds),
      startMemberCount: componentMemberIds.length,
      endEnergy: null,
      endMemberCount: null,
      migration: {
        income: { food: 0, gateWork: 0, deathResidue: 0 },
        expenses: { movement: 0, maintenance: 0, perception: 0, bonds: 0, reserveMaintenance: 0, signals: 0, memory: 0, idle: 0 },
        transfers: { directSupport: 0, relayReserve: 0, relayedSupport: 0 },
        losses: { capacityOverflow: 0 }
      },
      phaseAccounting: Object.fromEntries(["harvest", "conservation", "migration", "arrival"].map((phase) => [phase, {
        startedTick: phase === "harvest" ? this.simulationTicks : null,
        income: { food: 0, gateWork: 0 },
        expenses: { movement: 0, maintenance: 0, perception: 0, bonds: 0, signals: 0, memory: 0, idle: 0, reserveMaintenance: 0 },
        losses: { capacityOverflow: 0 },
        deferredOrdinaryHarvests: 0,
        actionRecords: 0
      }]))
    });
    if (this.componentEpisodes.length > MAX_GATE_CAPTURE_RECORDS) this.componentEpisodes.shift();
  }

  markComponentEpisodeFieldEnded(cycle) {
    const episode = this.componentEpisodes.find((candidate) => candidate.cycleId === cycle.id && candidate.endedTick === null);
    if (episode) episode.fieldEndedTick = this.simulationTicks;
  }

  resolveComponentEpisodesWithCompletion(facet) {
    const completingGroup = this.getBondGroups().find((group) => group.includes(facet.memberIds[0])) ?? facet.memberIds;
    for (const episode of this.componentEpisodes) {
      if (episode.endedTick !== null || episode.fieldEndedTick === null) continue;
      if (!episode.originalMemberIds.some((id) => completingGroup.includes(id))) continue;
      episode.endedTick = this.simulationTicks;
      episode.outcome = "next-gate-completion";
      episode.endEnergy = this.getComponentEnergy(completingGroup);
      episode.endMemberCount = completingGroup.length;
      episode.totalDurationTicks = episode.endedTick - episode.startedTick;
      episode.migrationTicks = episode.endedTick - episode.fieldEndedTick;
      episode.componentEnergyDelta = Number((episode.endEnergy - episode.startEnergy).toFixed(3));
      this.finalizeComponentEpisodeMigration(episode);
    }
  }

  updateComponentEpisodes() {
    for (const episode of this.componentEpisodes) {
      if (episode.endedTick !== null || episode.fieldEndedTick === null) continue;
      const survivor = episode.originalMemberIds.find((id) => this.organisms.some((organism) => organism.alive && organism.id === id));
      if (survivor !== undefined) continue;
      episode.endedTick = this.simulationTicks;
      episode.outcome = "original-members-extinct";
      episode.endEnergy = 0;
      episode.endMemberCount = 0;
      episode.totalDurationTicks = episode.endedTick - episode.startedTick;
      episode.migrationTicks = episode.endedTick - episode.fieldEndedTick;
      episode.componentEnergyDelta = Number((-episode.startEnergy).toFixed(3));
      this.finalizeComponentEpisodeMigration(episode);
    }
  }

  getComponentEpisodeCurrentMemberIds(episode) {
    const anchorId = episode.originalMemberIds.find((id) => this.organisms.some((organism) => organism.alive && organism.id === id));
    if (anchorId === undefined) return [];
    return this.getBondGroups().find((group) => group.includes(anchorId)) ?? [anchorId];
  }

  getActiveMigrationEpisodesForMember(memberId) {
    return this.componentEpisodes.filter((episode) => (
      episode.fieldEndedTick !== null
      && episode.endedTick === null
      && this.getComponentEpisodeCurrentMemberIds(episode).includes(memberId)
    ));
  }

  getComponentEpisodePhase(episode, organism) {
    if (episode.arrivalTick !== null && episode.arrivalTick !== undefined) return "arrival";
    if (organism.componentLifecycleState === "conserve") return "conservation";
    if (episode.fieldEndedTick !== null) return "migration";
    return "harvest";
  }

  recordComponentEpisodePhaseFlow(organism, result) {
    for (const episode of this.componentEpisodes) {
      if (episode.endedTick !== null || !this.getComponentEpisodeCurrentMemberIds(episode).includes(organism.id)) continue;
      const phase = this.getComponentEpisodePhase(episode, organism);
      const ledger = episode.phaseAccounting?.[phase];
      if (!ledger) continue;
      ledger.startedTick ??= this.simulationTicks;
      ledger.actionRecords += 1;
      for (const [key, value] of Object.entries(result.energyFlow?.income ?? {})) {
        if (Object.hasOwn(ledger.income, key)) ledger.income[key] += value ?? 0;
      }
      for (const [key, value] of Object.entries(result.energyFlow?.expenses ?? {})) {
        if (Object.hasOwn(ledger.expenses, key)) ledger.expenses[key] += value ?? 0;
      }
      ledger.losses.capacityOverflow += result.energyFlow?.losses?.capacityOverflow ?? 0;
      if (result.deferredHarvest) ledger.deferredOrdinaryHarvests += 1;
    }
  }

  recordComponentEpisodeGateArrival(members, gate) {
    for (const episode of this.componentEpisodes) {
      if (episode.endedTick !== null || episode.fieldEndedTick === null || episode.arrivalTick !== undefined) continue;
      if (!episode.originalMemberIds.some((id) => members.some((member) => member.id === id))) continue;
      episode.arrivalTick = this.simulationTicks;
      episode.arrivalGateId = gate.id;
      episode.phaseAccounting.arrival.startedTick = this.simulationTicks;
    }
  }

  recordComponentEpisodeMigrationFlow(organism, energyFlow) {
    for (const episode of this.getActiveMigrationEpisodesForMember(organism.id)) {
      for (const [key, value] of Object.entries(energyFlow.income)) {
        if (Object.hasOwn(episode.migration.income, key)) episode.migration.income[key] += value ?? 0;
      }
      for (const [key, value] of Object.entries(energyFlow.expenses)) {
        if (Object.hasOwn(episode.migration.expenses, key)) episode.migration.expenses[key] += value ?? 0;
      }
      episode.migration.losses.capacityOverflow += energyFlow.losses.capacityOverflow ?? 0;
    }
  }

  recordComponentEpisodeMigrationSupport(organism, directSupport, relayReserve, relayedSupport) {
    for (const episode of this.getActiveMigrationEpisodesForMember(organism.id)) {
      episode.migration.transfers.directSupport += directSupport;
      episode.migration.transfers.relayReserve += relayReserve;
      episode.migration.transfers.relayedSupport += relayedSupport;
    }
  }

  recordComponentEpisodeMigrationResidueRecovery(memberIds, amount) {
    if (amount <= 0) return;
    for (const episode of this.componentEpisodes) {
      if (episode.fieldEndedTick === null || episode.endedTick !== null) continue;
      const currentIds = this.getComponentEpisodeCurrentMemberIds(episode);
      if (memberIds.some((id) => currentIds.includes(id))) episode.migration.income.deathResidue += amount;
    }
  }

  recordComponentEpisodeMigrationReserveMaintenance() {
    for (const episode of this.componentEpisodes) {
      if (episode.fieldEndedTick === null || episode.endedTick !== null) continue;
      const ids = new Set(this.getComponentEpisodeCurrentMemberIds(episode));
      const internalBondCount = [...this.bonds.values()].filter((bond) => ids.has(bond.firstId) && ids.has(bond.secondId)).length;
      episode.migration.expenses.reserveMaintenance += internalBondCount * this.config.bond.maintenancePerTick;
    }
  }

  recordComponentEpisodePhaseReserveMaintenance() {
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    for (const episode of this.componentEpisodes) {
      if (episode.endedTick !== null) continue;
      const memberIds = this.getComponentEpisodeCurrentMemberIds(episode);
      const representative = memberIds.map((id) => byId.get(id)).find(Boolean);
      if (!representative) continue;
      const phase = this.getComponentEpisodePhase(episode, representative);
      const ledger = episode.phaseAccounting?.[phase];
      if (!ledger) continue;
      const ids = new Set(memberIds);
      const internalBondCount = [...this.bonds.values()].filter((bond) => ids.has(bond.firstId) && ids.has(bond.secondId)).length;
      ledger.expenses.reserveMaintenance += internalBondCount * this.config.bond.maintenancePerTick;
    }
  }

  finalizeComponentEpisodeMigration(episode) {
    if (episode.budding) {
      episode.budding.offspringSurviving = episode.budding.childIds
        .filter((id) => this.organisms.some((organism) => organism.alive && organism.id === id)).length;
    }
    episode.migration.totalIncome = Number(Object.values(episode.migration.income).reduce((sum, value) => sum + value, 0).toFixed(3));
    episode.migration.totalExpenses = Number(Object.values(episode.migration.expenses).reduce((sum, value) => sum + value, 0).toFixed(3));
    episode.migration.netOperationalBalance = Number((episode.migration.totalIncome - episode.migration.totalExpenses - episode.migration.losses.capacityOverflow).toFixed(3));
    for (const phase of Object.values(episode.phaseAccounting ?? {})) {
      phase.totalIncome = Number(Object.values(phase.income).reduce((sum, value) => sum + value, 0).toFixed(3));
      phase.totalExpenses = Number(Object.values(phase.expenses).reduce((sum, value) => sum + value, 0).toFixed(3));
      phase.netOperationalBalance = Number((phase.totalIncome - phase.totalExpenses - phase.losses.capacityOverflow).toFixed(3));
    }
  }

  recordGateFieldCycleFlow(organism, energyFlow, allocations = {}) {
    for (const gate of this.workGates) {
      const cycle = this.gateFieldCycles.find((candidate) => candidate.id === gate.activeCycleId && !candidate.endedTick);
      if (!cycle || !Object.hasOwn(cycle.memberStartEnergy, organism.id)) continue;
      cycle.memberLastEnergy[organism.id] = organism.energy;
      cycle.income.gateWork += energyFlow.income.gateWork ?? 0;
      cycle.income.food += energyFlow.income.food ?? 0;
      cycle.expenses.movement += energyFlow.expenses.movement ?? 0;
      cycle.expenses.maintenance += energyFlow.expenses.maintenance ?? 0;
      cycle.expenses.perception += energyFlow.expenses.perception ?? 0;
      cycle.expenses.bonds += energyFlow.expenses.bonds ?? 0;
      cycle.expenses.signals += energyFlow.expenses.signals ?? 0;
      cycle.expenses.memory += energyFlow.expenses.memory ?? 0;
      cycle.expenses.idle += energyFlow.expenses.idle ?? 0;
      cycle.allocations.bondReserve += allocations.structuralAllocation ?? 0;
      cycle.allocations.externalBondReserve += allocations.externalBondAllocation ?? 0;
      cycle.allocations.facetSharing += allocations.facetSharing ?? 0;
      cycle.allocations.externalFacetSharing += allocations.externalFacetSharing ?? 0;
      cycle.allocations.facetCapital += allocations.facetCapital ?? 0;
      cycle.losses.capacityOverflow += energyFlow.losses.capacityOverflow ?? 0;
    }
  }

  recordGateCycleReserveMaintenance() {
    for (const gate of this.workGates) {
      const cycle = this.gateFieldCycles.find((candidate) => candidate.id === gate.activeCycleId && !candidate.endedTick);
      if (!cycle) continue;
      const ids = Object.keys(cycle.memberStartEnergy).map(Number);
      const internalBonds = [...this.bonds.values()].filter((bond) => ids.includes(bond.firstId) && ids.includes(bond.secondId));
      cycle.expenses.reserveMaintenance += internalBonds.length * this.config.bond.maintenancePerTick;
    }
  }

  closeGateFieldCycle(gate, outcome) {
    const cycle = this.gateFieldCycles.find((candidate) => candidate.id === gate.activeCycleId && !candidate.endedTick);
    if (!cycle) return;
    cycle.endedTick = this.simulationTicks;
    cycle.outcome = outcome;
    cycle.durationTicks = cycle.endedTick - cycle.startedTick;
    cycle.memberEnergyDelta = Number(Object.keys(cycle.memberStartEnergy).reduce((sum, id) => sum + ((cycle.memberLastEnergy[id] ?? 0) - cycle.memberStartEnergy[id]), 0).toFixed(3));
    const memberIds = Object.keys(cycle.memberStartEnergy).map(Number);
    const internalReserveEnd = [...this.bonds.values()]
      .filter((bond) => memberIds.includes(bond.firstId) && memberIds.includes(bond.secondId))
      .reduce((sum, bond) => sum + (bond.reserve ?? 0), 0);
    const facetReserveEnd = this.facetReserves.get(cycle.facetKey) ?? 0;
    cycle.internalReserveDelta = Number((internalReserveEnd - cycle.internalReserveStart).toFixed(3));
    cycle.facetReserveDelta = Number((facetReserveEnd - cycle.facetReserveStart).toFixed(3));
    cycle.totalStructuralEnergyDelta = Number((cycle.memberEnergyDelta + cycle.internalReserveDelta + cycle.facetReserveDelta).toFixed(3));
    cycle.gateIncome = Number(cycle.income.gateWork.toFixed(3));
    cycle.totalActionCosts = Number(Object.values(cycle.expenses).reduce((sum, value) => sum + value, 0).toFixed(3));
    cycle.netGateBalance = Number((cycle.gateIncome - cycle.totalActionCosts).toFixed(3));
    cycle.capacityOverflow = Number(cycle.losses.capacityOverflow.toFixed(3));
    cycle.bondReserveAllocation = Number(cycle.allocations.bondReserve.toFixed(3));
    cycle.externalBondReserveAllocation = Number(cycle.allocations.externalBondReserve.toFixed(3));
    cycle.facetSharingAllocation = Number(cycle.allocations.facetSharing.toFixed(3));
    cycle.externalFacetSharingAllocation = Number(cycle.allocations.externalFacetSharing.toFixed(3));
    cycle.facetCapitalGenerated = Number(cycle.allocations.facetCapital.toFixed(3));
    const anchorId = cycle.componentMemberIdsAtStart.find((id) => this.organisms.some((organism) => organism.alive && organism.id === id));
    const componentMemberIdsAtEnd = anchorId === undefined
      ? []
      : (this.getBondGroups().find((group) => group.includes(anchorId)) ?? [anchorId]);
    cycle.componentMemberCountStart = cycle.componentMemberIdsAtStart.length;
    cycle.componentMemberCountEnd = componentMemberIdsAtEnd.length;
    cycle.componentEnergyEnd = this.getComponentEnergy(componentMemberIdsAtEnd);
    cycle.componentEnergyDelta = Number((cycle.componentEnergyEnd - cycle.componentEnergyStart).toFixed(3));
    this.markComponentEpisodeFieldEnded(cycle);
    gate.activeCycleId = null;
  }

  getComponentEnergy(memberIds) {
    if (!memberIds.length) return 0;
    const ids = new Set(memberIds);
    const organismEnergy = this.organisms.filter((organism) => organism.alive && ids.has(organism.id)).reduce((sum, organism) => sum + organism.energy, 0);
    const bondReserve = [...this.bonds.values()]
      .filter((bond) => ids.has(bond.firstId) && ids.has(bond.secondId))
      .reduce((sum, bond) => sum + (bond.reserve ?? 0), 0);
    const facetReserve = this.getFacets()
      .filter((facet) => facet.memberIds.every((id) => ids.has(id)))
      .reduce((sum, facet) => sum + facet.reserve, 0);
    return organismEnergy + bondReserve + facetReserve;
  }

  recordGateFoodRelease(gate, port) {
    const facet = this.getFacets().find((candidate) => candidate.key === gate.fieldFacetKey);
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const responsibleMembers = (facet?.memberIds ?? []).map((id) => byId.get(id)).filter(Boolean)
      .map((member) => ({ id: member.id, x: member.x, y: member.y }));
    const cycle = this.gateFieldCycles.find((candidate) => candidate.id === gate.activeCycleId && !candidate.endedTick);
    const record = {
      id: this.nextGateFoodCaptureId++,
      gateId: gate.id,
      facetKey: gate.fieldFacetKey ?? null,
      releasedTick: this.simulationTicks,
      port: { x: port.x, y: port.y },
      gateStockBeforeRelease: gate.energyStock,
      responsibleMembers,
      responsibleComponentMemberIds: cycle?.componentMemberIdsAtStart ?? [],
      harvest: null
    };
    this.gateFoodCaptureRecords.push(record);
    if (this.gateFoodCaptureRecords.length > MAX_GATE_CAPTURE_RECORDS) this.gateFoodCaptureRecords.shift();
    return record.id;
  }

  distanceBetweenPositions(first, second) {
    const xDistance = Math.abs(first.x - second.x);
    const yDistance = Math.abs(first.y - second.y);
    const wrappedX = this.world.wraps ? Math.min(xDistance, this.world.width - xDistance) : xDistance;
    const wrappedY = this.world.wraps ? Math.min(yDistance, this.world.height - yDistance) : yDistance;
    return Math.max(wrappedX, wrappedY);
  }

  recordCollectiveWorkHarvest(organism, origin) {
    const facet = this.getStrongestFacetForMember(organism.id);
    const workerHarvest = Boolean(origin.facetKey && facet?.key === origin.facetKey);
    this.collectiveWorkFieldHarvests += 1;
    if (workerHarvest) this.collectiveWorkFieldHarvestsByWorkers += 1;
    else this.collectiveWorkFieldHarvestsByOthers += 1;
    const lineage = this.collectiveWorkHarvestLineages.get(organism.lineageId) ?? {
      lineageId: organism.lineageId,
      harvests: 0,
      workerHarvests: 0,
      otherHarvests: 0,
      latestGeneration: organism.generation,
      genome: organism.genomeProfile.expression
    };
    lineage.harvests += 1;
    if (workerHarvest) lineage.workerHarvests += 1;
    else lineage.otherHarvests += 1;
    lineage.latestGeneration = Math.max(lineage.latestGeneration, organism.generation);
    this.collectiveWorkHarvestLineages.set(organism.lineageId, lineage);
    this.recordTelemetry("gate-field-harvest", `Lineage ${organism.lineageId}, organism #${organism.id} (generation ${organism.generation}) harvested gate #${origin.gateId} food as ${workerHarvest ? "responsible facet member" : "local competitor"}.`);
    const record = this.gateFoodCaptureRecords.find((item) => item.id === origin.gateFoodRecordId);
    if (record) {
      const distances = record.responsibleMembers.map((member) => this.distanceBetweenPositions(organism, member));
      record.harvest = {
        tick: this.simulationTicks,
        organismId: organism.id,
        lineageId: organism.lineageId,
        responsibleMemberAtRelease: record.responsibleMembers.some((member) => member.id === organism.id),
        responsibleFacetAtHarvest: workerHarvest,
        responsibleComponentMemberAtRelease: record.responsibleComponentMemberIds.includes(organism.id),
        delayTicks: this.simulationTicks - record.releasedTick,
        distanceFromResponsibleMember: distances.length ? Math.min(...distances) : null,
        gateStockAtHarvest: this.workGates.find((gate) => gate.id === origin.gateId)?.energyStock ?? null
      };
    }
    const activeCycle = this.gateFieldCycles.find((cycle) => cycle.id === this.workGates.find((gate) => gate.id === origin.gateId)?.activeCycleId);
    if (activeCycle) {
      if (record?.responsibleMembers.some((member) => member.id === organism.id)) activeCycle.workerGateHarvests += 1;
      else activeCycle.competitorGateHarvests += 1;
    }
  }

  getGateFieldCycleDiagnostics() {
    const completed = this.gateFieldCycles.filter((cycle) => cycle.endedTick !== null);
    const mean = (values) => values.length ? Number(average(values).toFixed(3)) : 0;
    return {
      completedCycles: completed.length,
      meanDurationTicks: mean(completed.map((cycle) => cycle.durationTicks)),
      meanGateIncome: mean(completed.map((cycle) => cycle.gateIncome)),
      meanActionCosts: mean(completed.map((cycle) => cycle.totalActionCosts)),
      meanNetGateBalance: mean(completed.map((cycle) => cycle.netGateBalance)),
      meanMemberEnergyDelta: mean(completed.map((cycle) => cycle.memberEnergyDelta)),
      meanTotalStructuralEnergyDelta: mean(completed.map((cycle) => cycle.totalStructuralEnergyDelta)),
      meanComponentEnergyDelta: mean(completed.map((cycle) => cycle.componentEnergyDelta)),
      meanComponentSizeStart: mean(completed.map((cycle) => cycle.componentMemberCountStart)),
      meanComponentSizeEnd: mean(completed.map((cycle) => cycle.componentMemberCountEnd)),
      meanCapacityOverflow: mean(completed.map((cycle) => cycle.capacityOverflow)),
      meanBondReserveAllocation: mean(completed.map((cycle) => cycle.bondReserveAllocation)),
      meanExternalBondReserveAllocation: mean(completed.map((cycle) => cycle.externalBondReserveAllocation)),
      meanFacetSharingAllocation: mean(completed.map((cycle) => cycle.facetSharingAllocation)),
      meanExternalFacetSharingAllocation: mean(completed.map((cycle) => cycle.externalFacetSharingAllocation)),
      meanFacetCapitalGenerated: mean(completed.map((cycle) => cycle.facetCapitalGenerated)),
      positiveNetGateBalanceFraction: completed.length ? Number((completed.filter((cycle) => cycle.netGateBalance > 0).length / completed.length).toFixed(3)) : 0,
      outcomes: Object.fromEntries(Object.entries(Object.groupBy(completed, (cycle) => cycle.outcome)).map(([outcome, cycles]) => [outcome, cycles.length])),
      recentCompletedCycles: completed.slice(-20)
    };
  }

  getComponentEpisodeDiagnostics() {
    const completed = this.componentEpisodes.filter((episode) => episode.endedTick !== null);
    const mean = (values) => values.length ? Number(average(values).toFixed(3)) : 0;
    const nextCompletions = completed.filter((episode) => episode.outcome === "next-gate-completion");
    const phaseDiagnostics = Object.fromEntries(["harvest", "conservation", "migration", "arrival"].map((phase) => {
      const records = nextCompletions.map((episode) => episode.phaseAccounting?.[phase]).filter(Boolean);
      return [phase, {
        episodesObserved: records.filter((record) => record.actionRecords > 0).length,
        meanIncome: mean(records.map((record) => record.totalIncome ?? 0)),
        meanExpenses: mean(records.map((record) => record.totalExpenses ?? 0)),
        meanOverflow: mean(records.map((record) => record.losses.capacityOverflow ?? 0)),
        meanNetOperationalBalance: mean(records.map((record) => record.netOperationalBalance ?? 0)),
        meanDeferredOrdinaryHarvests: mean(records.map((record) => record.deferredOrdinaryHarvests ?? 0)),
        meanActionRecords: mean(records.map((record) => record.actionRecords ?? 0))
      }];
    }));
    return {
      completedEpisodes: completed.length,
      nextGateCompletions: nextCompletions.length,
      originalMemberExtinctions: completed.filter((episode) => episode.outcome === "original-members-extinct").length,
      censoredActiveEpisodes: this.componentEpisodes.filter((episode) => episode.endedTick === null).length,
      meanWholeEpisodeEnergyDelta: mean(nextCompletions.map((episode) => episode.componentEnergyDelta)),
      positiveWholeEpisodeFraction: nextCompletions.length ? Number((nextCompletions.filter((episode) => episode.componentEnergyDelta > 0).length / nextCompletions.length).toFixed(3)) : 0,
      meanMigrationTicks: mean(nextCompletions.map((episode) => episode.migrationTicks)),
      phaseDiagnostics,
      recentCompletedEpisodes: completed.slice(-20)
    };
  }

  updateCollectiveWork() {
    if (!this.config.collectiveWork.enabled) return;
    this.updateCollectiveWorkFields();
    for (const gate of this.workGates) {
      if (gate.cooldown > 0) {
        gate.cooldown -= 1;
        if (gate.cooldown === 0) {
          if (gate.exhausted) {
            gate.exhausted = false;
            gate.energyStock = this.config.collectiveWork.gateEnergyStock;
            gate.energyReleased = 0;
            this.recordTelemetry("gate-recharged", `Gate #${gate.id} restored its finite energy stock and is available again.`);
          }
          gate.phase = "observe";
          gate.phaseTick = 0;
        }
        continue;
      }
      // A live production field is already the gate's active result. It cannot be repeatedly
      // re-solved to refresh its strength; only continued structural maintenance keeps it alive.
      if (gate.fieldStrength > 0) continue;
      gate.phaseTick += 1;
      const facet = this.getFacetAtWorkGate(gate);
      if (gate.phase === "observe") {
        if (gate.phaseTick < this.config.collectiveWork.observeTicks) continue;
        gate.phase = "respond";
        gate.phaseTick = 0;
        gate.progress = 0;
        gate.attendingFacetKey = facet?.key ?? null;
        if (facet) {
          this.collectiveWorkAttendances += 1;
          this.gateFacetAssignments.set(facet.key, gate.id);
        }
        gate.targetState = facet
          ? average(facet.members.map((member) => member.getPersistentState() ?? 0))
          : null;
        continue;
      }

      const validFacet = facet && facet.key === gate.attendingFacetKey && gate.targetState !== null;
      const values = validFacet ? facet.members.map((member) => member.getPersistentState() ?? 0) : [];
      const spread = values.length ? Math.max(...values) - Math.min(...values) : Infinity;
      if (validFacet && spread <= this.config.collectiveWork.consensusTolerance) {
        gate.progress += 1;
      } else {
        gate.progress = 0;
      }
      if (gate.progress >= this.config.collectiveWork.requiredConsensusTicks) {
        this.collectiveWorkCompletions += 1;
        this.emitCollectivePulse(facet.memberIds.map((id) => this.organisms.find((organism) => organism.id === id)).find(Boolean), "gate", 1, { x: gate.x, y: gate.y });
        gate.fieldStrength = this.config.collectiveWork.gateFieldMaximum;
        gate.productionBudget = 0;
        gate.fieldStartedTick = this.simulationTicks;
        this.startGateFieldCycle(gate, facet);
        gate.fieldFacetKey = facet.key;
        this.setGateFieldPorts(gate, facet);
        gate.nextPortIndex = 0;
        // A solved gate immediately materializes one ordinary unit at a visible work port.
        // This is not energy transfer: the unit remains physical, contestable food. It prevents a
        // newly successful facet from having to survive an additional tick before its field can begin.
        if (this.config.collectiveWork.gateOutputMode === "port-coupled") {
          this.collectiveWorkFoodReleased += this.releasePortCoupledFood(
            gate,
            this.config.collectiveWork.gateStartupFoodUnits
          );
        }
        this.recordTelemetry("consensus-gate", `Facet ${facet.key} completed consensus gate #${gate.id}; its ${this.config.collectiveWork.gateOutputMode === "port-coupled" ? "three work-port" : "local production"} field is active.`);
        gate.cooldown = 0;
        gate.phase = "observe";
        gate.phaseTick = 0;
        gate.progress = 0;
        gate.targetState = null;
        gate.attendingFacetKey = null;
      } else if (gate.phaseTick >= this.config.collectiveWork.responseTicks) {
        if (gate.attendingFacetKey) this.gateFacetAssignments.delete(gate.attendingFacetKey);
        gate.phase = "observe";
        gate.phaseTick = 0;
        gate.progress = 0;
        gate.targetState = null;
        gate.attendingFacetKey = null;
      }
    }
  }

  getBondGroups() {
    if (this.bondGroupsCache) return this.bondGroupsCache;
    const links = new Map();
    for (const bond of this.bonds.values()) {
      if (!links.has(bond.firstId)) links.set(bond.firstId, new Set());
      if (!links.has(bond.secondId)) links.set(bond.secondId, new Set());
      links.get(bond.firstId).add(bond.secondId);
      links.get(bond.secondId).add(bond.firstId);
    }

    const groups = [];
    const visited = new Set();
    for (const id of links.keys()) {
      if (visited.has(id)) continue;
      const group = [];
      const queue = [id];
      visited.add(id);
      for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const currentId = queue[queueIndex];
        group.push(currentId);
        for (const neighborId of links.get(currentId) ?? []) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }
      groups.push(group);
    }
    this.bondGroupsCache = groups;
    return this.bondGroupsCache;
  }

  getComponentTopologyMetrics(memberIds, { internalBonds: suppliedBonds = null, detailLevel = "full" } = {}) {
    const ids = [...memberIds].sort((first, second) => first - second);
    const idSet = new Set(ids);
    const adjacency = new Map(ids.map((id) => [id, new Set()]));
    const internalBonds = suppliedBonds ?? [...this.bonds.values()].filter((bond) => idSet.has(bond.firstId) && idSet.has(bond.secondId));
    for (const bond of internalBonds) {
      adjacency.get(bond.firstId).add(bond.secondId);
      adjacency.get(bond.secondId).add(bond.firstId);
    }
    const degrees = ids.map((id) => adjacency.get(id).size);
    const memberCount = ids.length;
    const bondCount = internalBonds.length;
    const allBondKeys = internalBonds.map((bond) => this.bondKey(bond.firstId, bond.secondId)).sort();
    if (detailLevel !== "full") {
      const limit = Math.max(1, this.config.collectiveWork.collectiveCensus.lightweightBondSampleLimit ?? 64);
      const bondKeys = allBondKeys.length <= limit
        ? allBondKeys
        : Array.from({ length: limit }, (_, index) => allBondKeys[Math.floor(index * (allBondKeys.length - 1) / Math.max(1, limit - 1))]);
      return {
        bondCount,
        bondKeys,
        bondKeysSampled: bondKeys.length < allBondKeys.length,
        bondDensity: Number((bondCount / Math.max(1, memberCount * (memberCount - 1) / 2)).toFixed(3)),
        cycleRank: Math.max(0, bondCount - memberCount + 1),
        bridgeCount: null,
        bridgeBonds: [],
        articulationPointCount: null,
        leafCount: degrees.filter((degree) => degree === 1).length,
        branchPointCount: degrees.filter((degree) => degree >= 3).length,
        maximumDegree: Math.max(0, ...degrees),
        diameter: null,
        meanShortestPath: null,
        pathMetricSampled: true,
        pathMetricSources: 0,
        detailLevel: "lightweight"
      };
    }
    const discovery = new Map();
    const low = new Map();
    const parent = new Map();
    const articulationPoints = new Set();
    const bridges = [];
    let time = 0;
    const visit = (id) => {
      discovery.set(id, ++time);
      low.set(id, time);
      let children = 0;
      for (const neighbor of adjacency.get(id)) {
        if (!discovery.has(neighbor)) {
          parent.set(neighbor, id);
          children += 1;
          visit(neighbor);
          low.set(id, Math.min(low.get(id), low.get(neighbor)));
          if ((parent.has(id) && low.get(neighbor) >= discovery.get(id)) || (!parent.has(id) && children > 1)) articulationPoints.add(id);
          if (low.get(neighbor) > discovery.get(id)) bridges.push([Math.min(id, neighbor), Math.max(id, neighbor)]);
        } else if (neighbor !== parent.get(id)) {
          low.set(id, Math.min(low.get(id), discovery.get(neighbor)));
        }
      }
    };
    for (const id of ids) if (!discovery.has(id)) visit(id);

    let totalPathLength = 0;
    let pathPairs = 0;
    let diameter = 0;
    const sourceLimit = Math.max(1, this.config.collectiveWork.collectiveCensus.topologyPathSourceLimit ?? 48);
    const sampledPaths = ids.length > sourceLimit;
    const pathSources = sampledPaths
      ? Array.from({ length: sourceLimit }, (_, index) => ids[Math.floor(index * (ids.length - 1) / Math.max(1, sourceLimit - 1))])
      : ids;
    for (const source of pathSources) {
      const distances = new Map([[source, 0]]);
      const queue = [source];
      for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const current = queue[queueIndex];
        for (const neighbor of adjacency.get(current)) {
          if (distances.has(neighbor)) continue;
          distances.set(neighbor, distances.get(current) + 1);
          queue.push(neighbor);
        }
      }
      const targets = sampledPaths ? ids : ids.slice(ids.indexOf(source) + 1);
      for (const target of targets) {
        const distance = distances.get(target);
        if (distance === undefined) continue;
        totalPathLength += distance;
        pathPairs += 1;
        diameter = Math.max(diameter, distance);
      }
    }
    return {
      bondCount,
      bondKeys: allBondKeys,
      bondKeysSampled: false,
      bondDensity: Number((bondCount / Math.max(1, memberCount * (memberCount - 1) / 2)).toFixed(3)),
      cycleRank: Math.max(0, bondCount - memberCount + 1),
      bridgeCount: bridges.length,
      bridgeBonds: bridges.map(([firstId, secondId]) => `${firstId}:${secondId}`),
      articulationPointCount: articulationPoints.size,
      leafCount: degrees.filter((degree) => degree === 1).length,
      branchPointCount: degrees.filter((degree) => degree >= 3).length,
      maximumDegree: Math.max(0, ...degrees),
      diameter,
      meanShortestPath: Number((totalPathLength / Math.max(1, pathPairs)).toFixed(3)),
      pathMetricSampled: sampledPaths,
      pathMetricSources: pathSources.length,
      detailLevel: "full"
    };
  }

  captureCollectiveCensus() {
    const policy = this.config.collectiveWork.collectiveCensus;
    if (!policy.enabled || this.simulationTicks % policy.cadenceTicks !== 0) return;
    const organismsById = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const strongFacets = this.getFacets()
      .filter((facet) => this.getFacetStrength(facet.memberIds) >= policy.minimumFacetStrength);
    const groups = this.getBondGroups();
    const groupIndexByMemberId = new Map();
    groups.forEach((memberIds, groupIndex) => memberIds.forEach((id) => groupIndexByMemberId.set(id, groupIndex)));
    const facetsByGroupIndex = new Map();
    for (const facet of strongFacets) {
      const groupIndex = groupIndexByMemberId.get(facet.memberIds[0]);
      if (groupIndex === undefined) continue;
      const facets = facetsByGroupIndex.get(groupIndex) ?? [];
      facets.push(facet);
      facetsByGroupIndex.set(groupIndex, facets);
    }
    const bondsByGroupIndex = new Map();
    for (const bond of this.bonds.values()) {
      const groupIndex = groupIndexByMemberId.get(bond.firstId);
      if (groupIndex === undefined || groupIndex !== groupIndexByMemberId.get(bond.secondId)) continue;
      const bonds = bondsByGroupIndex.get(groupIndex) ?? [];
      bonds.push(bond);
      bondsByGroupIndex.set(groupIndex, bonds);
    }
    const candidates = [];
    for (const [groupIndex, memberIds] of groups.entries()) {
      const members = memberIds.map((id) => organismsById.get(id)).filter(Boolean);
      if (members.length !== memberIds.length) continue;
      const facets = facetsByGroupIndex.get(groupIndex) ?? [];
      if (!facets.length) continue;
      const internalBonds = bondsByGroupIndex.get(groupIndex) ?? [];
      const topology = this.getComponentTopologyMetrics(memberIds, { internalBonds, detailLevel: policy.detailLevel });
      const xs = members.map((member) => member.x);
      const ys = members.map((member) => member.y);
      const xSpan = Math.max(...xs) - Math.min(...xs);
      const ySpan = Math.max(...ys) - Math.min(...ys);
      const assignedGateIds = [...new Set(facets.map((facet) => this.gateFacetAssignments.get(facet.key)).filter((id) => id !== undefined))];
      const nearestGateDistance = this.workGates.length
        ? Math.min(...this.workGates.map((gate) => average(members.map((member) => this.distanceToGate(member, gate)))))
        : null;
      const componentKey = this.componentLifecycleKey(memberIds);
      const internalBondReserve = internalBonds.reduce((sum, bond) => sum + (bond.reserve ?? 0), 0);
      const facetReserve = facets.reduce((sum, facet) => sum + (this.facetReserves.get(facet.key) ?? 0), 0);
      candidates.push({
        tick: this.simulationTicks,
        snapshotComponentId: componentKey,
        memberIds: [...memberIds].sort((first, second) => first - second),
        memberParents: Object.fromEntries(members.map((member) => [member.id, member.parentId])),
        memberLineageIds: [...new Set(members.map((member) => member.lineageId))].sort((first, second) => first - second),
        memberCount: members.length,
        centroid: { x: Number(average(xs).toFixed(2)), y: Number(average(ys).toFixed(2)) },
        spatialExtent: { xSpan, ySpan, area: (xSpan + 1) * (ySpan + 1), elongation: Number((Math.max(xSpan, ySpan) / Math.max(1, Math.min(xSpan, ySpan))).toFixed(3)) },
        strongFacetCount: facets.length,
        strongFacetKeys: facets.map((facet) => facet.key),
        topologySignature: `${members.length}:${topology.bondCount}:${facets.length}:${topology.cycleRank}:${topology.bridgeCount}:${topology.branchPointCount}`,
        topology,
        energy: Number(members.reduce((sum, member) => sum + member.energy, 0).toFixed(3)),
        bondReserve: Number(internalBondReserve.toFixed(3)),
        facetReserve: Number(facetReserve.toFixed(3)),
        lifecycleState: this.componentLifecycle.get(componentKey)?.state ?? null,
        transportMembers: members.filter((member) => member.collectiveTransportActive).length,
        assignedGateIds,
        nearestGateDistance: nearestGateDistance === null ? null : Number(nearestGateDistance.toFixed(3))
      });
    }
    this.collectiveCensusRecords.push(...candidates);
    this.matchCollectiveCensusCandidates(candidates);
    if (this.collectiveCensusRecords.length > policy.maximumRecords) {
      this.collectiveCensusRecords.splice(0, this.collectiveCensusRecords.length - policy.maximumRecords);
    }
  }

  getCollectiveCensusDiagnostics() {
    const latestTick = this.collectiveCensusRecords.at(-1)?.tick ?? null;
    const latest = latestTick === null ? [] : this.collectiveCensusRecords.filter((record) => record.tick === latestTick);
    return {
      ...this.config.collectiveWork.collectiveCensus,
      latestTick,
      sampledComponentCount: latest.length,
      totalRecords: this.collectiveCensusRecords.length,
      latest,
      recentRecords: this.collectiveCensusRecords.slice(-120)
    };
  }

  setOverlap(firstValues, secondValues) {
    const second = new Set(secondValues);
    return firstValues.filter((value) => second.has(value)).length;
  }

  scoreCollectiveContinuity(previous, current) {
    const policy = this.config.collectiveWork.collectiveLineageTracking;
    const previousMembers = new Set(previous.memberIds);
    const exactMembers = this.setOverlap(current.memberIds, previous.memberIds);
    const descendantMembers = current.memberIds.filter((id) => {
      const parentId = current.memberParents?.[id];
      return parentId !== null && parentId !== undefined && previousMembers.has(parentId);
    }).length;
    const memberContinuity = Math.min(1, (exactMembers + descendantMembers) / Math.max(1, Math.min(previous.memberIds.length, current.memberIds.length)));
    const bondContinuity = this.setOverlap(current.topology.bondKeys, previous.topology.bondKeys) / Math.max(1, Math.min(current.topology.bondKeys.length, previous.topology.bondKeys.length));
    const facetContinuity = this.setOverlap(current.strongFacetKeys, previous.strongFacetKeys) / Math.max(1, Math.min(current.strongFacetKeys.length, previous.strongFacetKeys.length));
    const centroidDistance = this.distanceBetweenPositions(previous.centroid, current.centroid);
    const spatialContinuity = Math.max(0, 1 - centroidDistance / policy.spatialContinuityDistance);
    const score = 0.55 * memberContinuity + 0.2 * bondContinuity + 0.15 * facetContinuity + 0.1 * spatialContinuity;
    return {
      score: Number(score.toFixed(3)),
      exactMembers,
      descendantMembers,
      memberContinuity: Number(memberContinuity.toFixed(3)),
      bondContinuity: Number(bondContinuity.toFixed(3)),
      facetContinuity: Number(facetContinuity.toFixed(3)),
      centroidDistance: Number(centroidDistance.toFixed(3)),
      qualifies: score >= policy.minimumScore && memberContinuity >= policy.minimumMemberContinuity
    };
  }

  recordCollectiveLineageEvent(event) {
    this.collectiveLineageEvents.push(event);
    const maximum = this.config.collectiveWork.collectiveLineageTracking.maximumEvents;
    if (this.collectiveLineageEvents.length > maximum) this.collectiveLineageEvents.shift();
  }

  createCollectiveLineage(candidate, reason = "birth") {
    const id = this.nextCollectiveLineageId++;
    const lineage = {
      id,
      status: "active",
      birthTick: candidate.tick,
      endTick: null,
      lastSeenTick: candidate.tick,
      sampleCount: 1,
      foundingMemberIds: [...candidate.memberIds],
      currentMemberIds: [...candidate.memberIds],
      maximumPopulation: candidate.memberCount,
      maximumBonds: candidate.topology.bondCount,
      maximumFacets: candidate.strongFacetCount,
      memberTurnover: 0,
      directDescendantRecruits: 0,
      topologyChanges: 0,
      distanceTravelled: 0,
      migrationEvents: candidate.lifecycleState === "migrate" ? 1 : 0,
      gateIds: new Set(candidate.assignedGateIds),
      foundingMembersAlive: candidate.memberIds.length,
      persistedAfterFoundersDied: false,
      history: [{ ...candidate, continuity: null }]
    };
    this.collectiveLineages.set(id, lineage);
    candidate.collectiveLineageId = id;
    this.recordCollectiveLineageEvent({ tick: candidate.tick, type: reason, collectiveLineageId: id, snapshotComponentId: candidate.snapshotComponentId });
    return lineage;
  }

  continueCollectiveLineage(lineage, previous, candidate, evidence) {
    const previousMembers = new Set(previous.memberIds);
    const currentMembers = new Set(candidate.memberIds);
    const added = candidate.memberIds.filter((id) => !previousMembers.has(id));
    const departed = previous.memberIds.filter((id) => !currentMembers.has(id));
    const directDescendantRecruits = added.filter((id) => previousMembers.has(candidate.memberParents?.[id])).length;
    lineage.status = "active";
    lineage.lastSeenTick = candidate.tick;
    lineage.sampleCount += 1;
    lineage.currentMemberIds = [...candidate.memberIds];
    lineage.maximumPopulation = Math.max(lineage.maximumPopulation, candidate.memberCount);
    lineage.maximumBonds = Math.max(lineage.maximumBonds, candidate.topology.bondCount);
    lineage.maximumFacets = Math.max(lineage.maximumFacets, candidate.strongFacetCount);
    lineage.memberTurnover += added.length + departed.length;
    lineage.directDescendantRecruits += directDescendantRecruits;
    lineage.distanceTravelled = Number((lineage.distanceTravelled + evidence.centroidDistance).toFixed(3));
    lineage.topologyChanges += previous.topologySignature === candidate.topologySignature ? 0 : 1;
    lineage.migrationEvents += previous.lifecycleState !== "migrate" && candidate.lifecycleState === "migrate" ? 1 : 0;
    candidate.assignedGateIds.forEach((gateId) => lineage.gateIds.add(gateId));
    lineage.foundingMembersAlive = lineage.foundingMemberIds.filter((id) => this.organisms.some((organism) => organism.alive && organism.id === id)).length;
    if (lineage.foundingMembersAlive === 0) lineage.persistedAfterFoundersDied = true;
    lineage.history.push({ ...candidate, continuity: evidence });
    const maximumHistory = this.config.collectiveWork.collectiveLineageTracking.maximumHistoryPerLineage;
    if (lineage.history.length > maximumHistory) lineage.history.shift();
    candidate.collectiveLineageId = lineage.id;
    this.recordCollectiveLineageEvent({ tick: candidate.tick, type: "continuation", collectiveLineageId: lineage.id, snapshotComponentId: candidate.snapshotComponentId, evidence });
  }

  endCollectiveLineage(lineage, tick, reason) {
    if (!lineage || lineage.status === "ended") return;
    lineage.status = "ended";
    lineage.endTick = tick;
    this.recordCollectiveLineageEvent({ tick, type: reason, collectiveLineageId: lineage.id });
  }

  matchCollectiveCensusCandidates(candidates) {
    const policy = this.config.collectiveWork.collectiveLineageTracking;
    if (!policy.enabled) {
      this.previousCollectiveCensusCandidates = candidates.map((candidate) => ({ ...candidate }));
      return;
    }
    const previous = this.previousCollectiveCensusCandidates;
    if (!previous.length) {
      for (const candidate of candidates) this.createCollectiveLineage(candidate);
      this.previousCollectiveCensusCandidates = candidates.map((candidate) => ({ ...candidate }));
      return;
    }
    const qualifiedByCurrent = new Map(candidates.map((candidate) => [candidate.snapshotComponentId, []]));
    const qualifiedByPrevious = new Map(previous.map((candidate) => [candidate.snapshotComponentId, []]));
    const weakByCurrent = new Map(candidates.map((candidate) => [candidate.snapshotComponentId, []]));
    for (const current of candidates) {
      for (const prior of previous) {
        const evidence = this.scoreCollectiveContinuity(prior, current);
        if (evidence.qualifies) {
          qualifiedByCurrent.get(current.snapshotComponentId).push({ prior, evidence });
          qualifiedByPrevious.get(prior.snapshotComponentId).push({ current, evidence });
        } else if (evidence.score >= policy.minimumScore * 0.65) {
          weakByCurrent.get(current.snapshotComponentId).push({ prior, evidence });
        }
      }
    }
    const continuedPrevious = new Set();
    for (const current of candidates) {
      const matches = qualifiedByCurrent.get(current.snapshotComponentId);
      const singleMatch = matches.length === 1 && qualifiedByPrevious.get(matches[0].prior.snapshotComponentId).length === 1;
      if (singleMatch) {
        const { prior, evidence } = matches[0];
        const lineage = this.collectiveLineages.get(prior.collectiveLineageId);
        if (lineage) {
          this.continueCollectiveLineage(lineage, prior, current, evidence);
          continuedPrevious.add(prior.snapshotComponentId);
          continue;
        }
      }
      const reason = matches.length > 1 ? "merge" : (weakByCurrent.get(current.snapshotComponentId).length ? "uncertain-birth" : "birth");
      this.createCollectiveLineage(current, reason);
      if (matches.length > 1) this.recordCollectiveLineageEvent({ tick: current.tick, type: "merge-ambiguous", collectiveLineageId: current.collectiveLineageId, sourceLineageIds: matches.map(({ prior }) => prior.collectiveLineageId) });
    }
    for (const prior of previous) {
      if (continuedPrevious.has(prior.snapshotComponentId)) continue;
      const descendants = qualifiedByPrevious.get(prior.snapshotComponentId);
      const lineage = this.collectiveLineages.get(prior.collectiveLineageId);
      this.endCollectiveLineage(lineage, candidates[0]?.tick ?? prior.tick, descendants.length > 1 ? "split-ambiguous" : "disappeared");
    }
    this.previousCollectiveCensusCandidates = candidates.map((candidate) => ({ ...candidate }));
    if (this.collectiveLineages.size > policy.maximumLineages) {
      const removable = [...this.collectiveLineages.values()]
        .filter((lineage) => lineage.status === "ended")
        .sort((first, second) => first.endTick - second.endTick);
      while (this.collectiveLineages.size > policy.maximumLineages && removable.length) this.collectiveLineages.delete(removable.shift().id);
    }
  }

  getCollectiveLineageDiagnostics() {
    const lineages = [...this.collectiveLineages.values()];
    const active = lineages.filter((lineage) => lineage.status === "active");
    const ended = lineages.filter((lineage) => lineage.status === "ended");
    return {
      ...this.config.collectiveWork.collectiveLineageTracking,
      totalLineages: lineages.length,
      activeLineages: active.length,
      endedLineages: ended.length,
      persistedAfterFoundersDied: lineages.filter((lineage) => lineage.persistedAfterFoundersDied).length,
      summaries: lineages.map((lineage) => ({
        id: lineage.id,
        status: lineage.status,
        birthTick: lineage.birthTick,
        endTick: lineage.endTick,
        lastSeenTick: lineage.lastSeenTick,
        lifetimeTicks: (lineage.endTick ?? this.simulationTicks) - lineage.birthTick,
        sampleCount: lineage.sampleCount,
        foundingMemberIds: lineage.foundingMemberIds,
        foundingMembersAlive: lineage.foundingMembersAlive,
        persistedAfterFoundersDied: lineage.persistedAfterFoundersDied,
        maximumPopulation: lineage.maximumPopulation,
        maximumBonds: lineage.maximumBonds,
        maximumFacets: lineage.maximumFacets,
        memberTurnover: lineage.memberTurnover,
        directDescendantRecruits: lineage.directDescendantRecruits,
        topologyChanges: lineage.topologyChanges,
        distanceTravelled: lineage.distanceTravelled,
        migrationEvents: lineage.migrationEvents,
        gateIds: [...lineage.gateIds],
        currentMemberIds: lineage.currentMemberIds,
        recentHistory: lineage.history.slice(-8).map((sample) => ({
          tick: sample.tick,
          snapshotComponentId: sample.snapshotComponentId,
          memberIds: sample.memberIds,
          memberCount: sample.memberCount,
          centroid: sample.centroid,
          strongFacetCount: sample.strongFacetCount,
          topologySignature: sample.topologySignature,
          energy: sample.energy,
          bondReserve: sample.bondReserve,
          facetReserve: sample.facetReserve,
          lifecycleState: sample.lifecycleState,
          assignedGateIds: sample.assignedGateIds,
          continuity: sample.continuity
        }))
      })),
      recentEvents: this.collectiveLineageEvents.slice(-160)
    };
  }

  getFacets() {
    const links = new Map();
    for (const bond of this.bonds.values()) {
      if (!links.has(bond.firstId)) links.set(bond.firstId, new Set());
      if (!links.has(bond.secondId)) links.set(bond.secondId, new Set());
      links.get(bond.firstId).add(bond.secondId);
      links.get(bond.secondId).add(bond.firstId);
    }
    const facets = [];
    for (const [firstId, firstLinks] of links) {
      for (const secondId of firstLinks) {
        if (secondId <= firstId) continue;
        for (const thirdId of links.get(secondId) ?? []) {
          if (thirdId <= secondId || !firstLinks.has(thirdId)) continue;
          const memberIds = [firstId, secondId, thirdId];
          const key = this.facetKey(memberIds);
          facets.push({ memberIds, key, reserve: this.facetReserves.get(key) ?? 0 });
        }
      }
    }
    return facets;
  }

  facetKey(memberIds) {
    return [...memberIds].sort((first, second) => first - second).join(":");
  }

  updateFacetReserves() {
    const activeKeys = new Set(this.getFacets().map((facet) => facet.key));
    for (const key of this.facetReserves.keys()) {
      if (!activeKeys.has(key)) this.facetReserves.delete(key);
    }
    for (const key of this.facetCatalysts.keys()) {
      if (!activeKeys.has(key)) this.facetCatalysts.delete(key);
    }
    for (const key of this.facetNurseryCredits.keys()) {
      if (!activeKeys.has(key)) this.facetNurseryCredits.delete(key);
    }
  }

  storeFacetCatalyst(eater) {
    if (!this.config.refinery.enabled) return;
    const facet = this.getStrongestFacetForMember(eater.id);
    if (!facet) return;
    const stored = Math.min(this.config.refinery.catalystCapacity, (this.facetCatalysts.get(facet.key) ?? 0) + 1);
    this.facetCatalysts.set(facet.key, stored);
    this.recordTelemetry("red-catalyst", `Facet ${facet.key} retained red catalyst ${stored}/${this.config.refinery.catalystCapacity}.`);
  }

  recoverDeathResidue() {
    const chemistry = this.config.chemistry;
    if (!chemistry.deathResidueEnabled) return;
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    for (const facet of this.getFacets()) {
      if (this.getFacetStrength(facet.memberIds) < this.config.facet.minimumBondStrength) continue;
      const members = facet.memberIds.map((id) => byId.get(id)).filter(Boolean);
      if (members.length !== 3) continue;
      const candidates = [];
      for (const member of members) {
        for (let dy = -chemistry.deathResidueSenseRadius; dy <= chemistry.deathResidueSenseRadius; dy += 1) {
          for (let dx = -chemistry.deathResidueSenseRadius; dx <= chemistry.deathResidueSenseRadius; dx += 1) {
            const position = this.world.wrapPosition(member.x + dx, member.y + dy);
            const value = this.world.deathResidue[position.y][position.x];
            if (value > 0) candidates.push({ ...position, value });
          }
        }
      }
      const residue = candidates.sort((first, second) => second.value - first.value)[0];
      if (!residue) continue;
      const taken = this.world.takeDeathResidue(residue.x, residue.y, chemistry.deathResidueRecoveryRate);
      const recovered = taken * chemistry.deathResidueRecoveryEfficiency;
      if (recovered <= 0) continue;
      let remaining = recovered;
      for (const member of [...members].sort((first, second) => first.energy - second.energy)) {
        const capacity = this.config.organism.reproductionThreshold * 1.8 * (member.genomeProfile.powers[3] ?? 1);
        const granted = Math.min(remaining, Math.max(0, capacity - member.energy));
        member.energy += granted;
        member.energyLedger.income.deathResidue = (member.energyLedger.income.deathResidue ?? 0) + granted;
        this.energyEconomics.income.deathResidue = (this.energyEconomics.income.deathResidue ?? 0) + granted;
        remaining -= granted;
        if (remaining <= 0) break;
      }
      this.deathResidueRecovered += recovered - remaining;
      this.recordComponentEpisodeMigrationResidueRecovery(members.map((member) => member.id), recovered - remaining);
    }
  }

  updateFacetRefineries() {
    if (!this.config.refinery.enabled) {
      this.refineryProgress.clear();
      return;
    }
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const activeKeys = new Set();
    for (const facet of this.getFacets()) {
      if (this.getFacetStrength(facet.memberIds) < this.config.facet.minimumBondStrength) continue;
      if ((this.facetCatalysts.get(facet.key) ?? 0) < 1) continue;
      const members = facet.memberIds.map((id) => byId.get(id)).filter(Boolean);
      if (members.length !== 3) continue;
      const patch = this.findFacetRefineryPatch(members);
      if (!patch) continue;
      const key = `${facet.key}@${patch.x},${patch.y}`;
      activeKeys.add(key);
      const ticks = (this.refineryProgress.get(key) ?? 0) + 1;
      if (ticks < this.config.refinery.candidateTicks) {
        this.refineryProgress.set(key, ticks);
        continue;
      }
      const result = this.world.refineMaterial(patch.x, patch.y, this.config.refinery.nutrientYield);
      this.refineryProgress.delete(key);
      if (result.material <= 0) continue;
      this.refineryConversions += 1;
      this.facetNiches.set(facet.key, { x: patch.x, y: patch.y });
      this.facetCatalysts.set(facet.key, Math.max(0, (this.facetCatalysts.get(facet.key) ?? 0) - 1));
      const credits = Math.min(this.config.refinery.nurseryCreditCapacity, (this.facetNurseryCredits.get(facet.key) ?? 0) + 1);
      this.facetNurseryCredits.set(facet.key, credits);
      this.refineryFoodReleased += result.foodReleased;
      this.refineryNutrientsProduced += result.nutrients;
      this.recordTelemetry("facet-refinery", `Facet ${facet.key} refined ${result.material.toFixed(2)} stored material at ${patch.x},${patch.y}, releasing ${result.foodReleased} food and ${result.nutrients.toFixed(2)} nutrients.`);
    }
    for (const key of this.refineryProgress.keys()) {
      if (!activeKeys.has(key)) this.refineryProgress.delete(key);
    }
  }

  updateFacetNiches() {
    if (!this.nicheMaintenanceEnabled) return;
    const active = new Set();
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    for (const facet of this.getFacets()) {
      const niche = this.facetNiches.get(facet.key);
      const members = facet.memberIds.map((id) => byId.get(id)).filter(Boolean);
      if (!niche || members.length !== 3 || this.getFacetStrength(facet.memberIds) < this.config.facet.minimumBondStrength) continue;
      if (!members.some((member) => this.areAdjacent(member, niche))) continue;
      this.world.reinforceEngineeredFertility(
        niche.x,
        niche.y,
        this.config.environment.engineeredFertilityReinforcement,
        this.config.environment.engineeredFertilityMaximum
      );
      active.add(facet.key);
    }
    for (const key of this.facetNiches.keys()) if (!active.has(key) && !this.getFacets().some((facet) => facet.key === key)) this.facetNiches.delete(key);
  }

  findFacetRefineryPatch(members) {
    const positions = new Map();
    for (const member of members) {
      for (let deltaX = -2; deltaX <= 2; deltaX += 1) {
        for (let deltaY = -2; deltaY <= 2; deltaY += 1) {
          const position = this.world.wrapPosition(member.x + deltaX, member.y + deltaY);
          positions.set(`${position.x},${position.y}`, position);
        }
      }
    }
    let strongest = null;
    for (const position of positions.values()) {
      if (!members.every((member) => this.areAdjacent(member, position))) continue;
      const material = this.world.materialAt(position.x, position.y);
      if (material < this.config.refinery.minimumMaterial || material <= (strongest?.material ?? 0)) continue;
      strongest = { ...position, material };
    }
    return strongest;
  }

  getStrongestFacetForMember(organismId) {
    return this.getFacets()
      .filter((facet) => facet.memberIds.includes(organismId))
      .map((facet) => ({ ...facet, strength: this.getFacetStrength(facet.memberIds) }))
      .filter((facet) => facet.strength >= this.config.facet.minimumBondStrength)
      .sort((first, second) => (second.reserve - first.reserve) || (second.strength - first.strength))[0] ?? null;
  }

  getFacetStrength(memberIds) {
    const strengths = [];
    for (let first = 0; first < memberIds.length; first += 1) {
      for (let second = first + 1; second < memberIds.length; second += 1) {
        const bond = this.bonds.get(this.bondKey(memberIds[first], memberIds[second]));
        if (!bond) return 0;
        strengths.push(bond.strength);
      }
    }
    return average(strengths);
  }

  getReproductionEnergyFloor(organism) {
    return this.config.organism.reproductionThreshold
      / (1 + ((organism.genomeProfile.powers[7] ?? 1) - 1) * 0.25);
  }

  usesAlignedBudgets() {
    const policy=this.config.bond.adaptiveMorphology;
    return Boolean(policy?.enabled && policy.alignedBudgetsEnabled);
  }

  getBondFundingFloor(organism) {
    // Protect one offspring's endowment, not the whole two-member birth trigger.
    // The same floor applies to creating, maintaining and seeding connections.
    const reproduction=this.getReproductionEnergyFloor(organism);
    return this.usesAlignedBudgets()
      ? Math.max(this.config.bond.supportThreshold,reproduction*this.config.organism.reproductionCostFactor)
      : reproduction;
  }

  canAffordReproduction(parent) {
    if (!this.usesAlignedBudgets()) return true;
    const edges=[...this.bonds.values()].filter(edge=>edge.firstId===parent.id||edge.secondId===parent.id);
    const halfUpkeep=edges.reduce((sum,edge)=>sum+Math.max(0,this.bondMaintenanceBuffer(edge)-(edge.reserve??0))/2,0);
    const seedBudget=edges.length ? 4+this.config.bond.buddingReserveInvestment : 0;
    const retained=parent.energy*this.config.organism.reproductionCostFactor;
    const childEnergy=retained; // Organism.reproduce currently gives both the same split.
    const floor=this.getBondFundingFloor(parent);
    return retained>=floor+halfUpkeep+seedBudget && childEnergy>=floor;
  }

  bondMaintenanceBuffer(edge) {
    const dormant=this.config.bond.dormantBonds;
    const multiplier=dormant?.enabled && edge.dormant ? Number(dormant.maintenanceMultiplier??1) : 1;
    // One payment now and one next tick; don't lock a full birth-sized reserve
    // away from member renewal just to meet the current upkeep bill.
    return Math.min(this.config.bond.reserveCapacity,2*this.config.bond.maintenancePerTick*multiplier);
  }

  fundExistingBondReserves() {
    if (!this.usesAlignedBudgets()) return;
    const members=new Map(this.organisms.filter(member=>member.alive).map(member=>[member.id,member]));
    // Pay a minimal rolling upkeep buffer, not a new three-unit creation cost.
    // This is an internal transfer, not income, and never crosses the survival floor.
    for (const edge of this.bonds.values()) {
      const a=members.get(edge.firstId),b=members.get(edge.secondId);
      if (!a||!b||edge.dormant||!this.areAdjacent(a,b)) continue;
      const reserve=edge.reserve??this.config.bond.initialReserve;
      const deficit=Math.max(0,this.bondMaintenanceBuffer(edge)-reserve);
      if (!deficit) continue;
      const availableA=Math.max(0,a.energy-this.getBondFundingFloor(a));
      const availableB=Math.max(0,b.energy-this.getBondFundingFloor(b));
      const total=Math.min(deficit,availableA+availableB);
      if (!total) continue;
      const fromA=Math.min(availableA,total/2)+Math.max(0,total/2-availableB);
      const fromB=total-fromA;
      a.energy-=fromA;b.energy-=fromB;edge.reserve=reserve+total;
      this.recordEnergyAllocation(a,'bondFunding',fromA);
      this.recordEnergyAllocation(b,'bondFunding',fromB);
      this.bondEnergyFed+=total;this.bondsFed+=1;
    }
  }

  rewardUsefulBondWork(source, participantIds, energy, event) {
    const policy = this.config.bond.usefulWorkReward;
    if (!policy?.enabled || !source?.alive || energy <= 0) return 0;
    // Only the actual source-to-recipient edges earn credit. Gate harvest
    // rewards the harvester's connections inside the responsible facet.
    const edges = [...this.bonds.values()].filter((bond) => {
      const other = bond.firstId === source.id ? bond.secondId : bond.secondId === source.id ? bond.firstId : null;
      const partner = this.organisms.find((member) => member.id === other && member.alive);
      return participantIds.has(other) && partner && this.areAdjacent(source, partner) && !bond.dormant;
    });
    if (!edges.length) return 0;
    let total = 0;
    for (const bond of edges) {
      const spent = bond.workRewardTick === this.simulationTicks ? bond.workRewardGain ?? 0 : 0;
      const gain = Math.max(0, Math.min(policy.maximumGainPerBondPerTick - spent,
        energy * policy.commitmentPerEnergy / edges.length, 1 - (bond.componentCommitment ?? 0)));
      if (gain <= 0) continue;
      bond.componentCommitment = (bond.componentCommitment ?? 0) + gain;
      bond.workRewardTick = this.simulationTicks;
      bond.workRewardGain = spent + gain;
      bond.lastWorkRewardEvent = event;
      total += gain;
    }
    return total;
  }

  shareFacetEnergy(eater, mealEnergy, priorityMemberIds = null) {
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const eligibleFacets = this.getFacets()
      .filter((facet) => facet.memberIds.includes(eater.id))
      .map((facet) => ({ ...facet, strength: this.getFacetStrength(facet.memberIds) }))
      .filter((facet) => facet.strength >= this.config.facet.minimumBondStrength);
    if (!eligibleFacets.length) return { total: 0, external: 0 };

    const recipients = new Map();
    for (const facet of eligibleFacets) {
      for (const memberId of facet.memberIds) {
        if (memberId === eater.id) continue;
        const member = byId.get(memberId);
        if (member && member.energy < eater.energy) {
          recipients.set(memberId, { organism: member, strength: facet.strength });
        }
      }
    }
    if (!recipients.size) return { total: 0, external: 0 };

    const averageStrength = average([...recipients.values()].map((recipient) => recipient.strength));
    const floor = this.config.bond.resourceFundedSurvival?.enabled || this.config.bond.usefulWorkReward?.enabled
      || this.config.bond.surplusFirstEnergy?.enabled !== false ? this.getReproductionEnergyFloor(eater) : 0;
    const pool = Math.min(Math.max(0, eater.energy - floor), mealEnergy * this.config.facet.sharingFraction * averageStrength);
    if (pool <= 0) return { total: 0, external: 0 };

    const orderedRecipients = [...recipients.values()].sort((first, second) => first.organism.energy - second.organism.energy);
    const preferred = priorityMemberIds ? orderedRecipients.filter((recipient) => priorityMemberIds.has(recipient.organism.id)) : [];
    const ordered = priorityMemberIds ? [...preferred, ...orderedRecipients.filter((recipient) => !priorityMemberIds.has(recipient.organism.id))] : orderedRecipients;
    let remaining = pool;
    const transfers = [];
    for (let index = 0; index < ordered.length && remaining > 0; index += 1) {
      const recipient = ordered[index];
      const recipientsRemaining = priorityMemberIds && index < preferred.length
        ? preferred.length - index
        : ordered.length - index;
      const maximumEnergy = this.config.organism.reproductionThreshold * 1.8 * (recipient.organism.genomeProfile.powers[3] ?? 1);
      const transferred = Math.min(remaining / Math.max(1, recipientsRemaining), Math.max(0, maximumEnergy - recipient.organism.energy));
      if (transferred <= 0) continue;
      transfers.push({ ...recipient, transferred });
      remaining -= transferred;
    }
    const transferredTotal = transfers.reduce((total, recipient) => total + recipient.transferred, 0);
    if (transferredTotal <= 0) return { total: 0, external: 0 };

    eater.energy -= transferredTotal;
    for (const recipient of transfers) {
      const transferred = recipient.transferred;
      if (transferred <= 0) continue;
      recipient.organism.energy += transferred;
      this.rewardUsefulBondWork(eater, new Set([recipient.organism.id]), transferred, "energy-sharing");
      this.energyTransfers.push({ fromId: eater.id, toId: recipient.organism.id, amount: Number(transferred.toFixed(2)), ttl: 6 });
      this.facetTransfers += 1;
      this.facetEnergyShared += transferred;
    }
    this.recordTelemetry("facet-sharing", `Facet around organism #${eater.id} shared ${transferredTotal.toFixed(1)} meal energy with weaker members.`);
    const activeCycle = this.gateFieldCycles.find((cycle) => cycle.endedTick === null && Object.hasOwn(cycle.memberStartEnergy, eater.id));
    const external = activeCycle
      ? transfers.filter((recipient) => !Object.hasOwn(activeCycle.memberStartEnergy, recipient.organism.id)).reduce((sum, recipient) => sum + recipient.transferred, 0)
      : 0;
    return { total: transferredTotal, external };
  }

  applyFacetHarvestAdvantage(eater, mealEnergy) {
    const facet = this.getStrongestFacetForMember(eater.id);
    if (!facet) return 0;

    const potential = mealEnergy * this.config.facet.harvestBonusFraction * facet.strength;
    if (potential <= 0) return 0;
    const currentReserve = this.facetReserves.get(facet.key) ?? 0;
    const granted = Math.min(potential, Math.max(0, this.config.facet.reserveCapacity - currentReserve));
    if (granted <= 0) return 0;
    this.facetReserves.set(facet.key, currentReserve + granted);
    this.facetHarvests += 1;
    this.facetHarvestEnergy += granted;
    this.facetHarvestReserveEnergy += granted;
    this.recordTelemetry("facet-harvest", `Facet around organism #${eater.id} added ${granted.toFixed(1)} structural capital to facet ${facet.key}.`);
    return granted;
  }

  feedAttachedBonds(eater, mealEnergy, priorityMemberIds = null) {
    const attachedBonds = [...this.bonds.values()].filter((bond) => bond.firstId === eater.id || bond.secondId === eater.id);
    if (!attachedBonds.length) return { total: 0, external: 0 };

    const floor = this.config.bond.resourceFundedSurvival?.enabled || this.config.bond.usefulWorkReward?.enabled
      || this.config.bond.surplusFirstEnergy?.enabled !== false ? this.getReproductionEnergyFloor(eater) : 0;
    const availableEnergy = Math.min(Math.max(0, eater.energy - floor), mealEnergy * this.config.bond.mealEnergyFraction);
    let orderedBonds = priorityMemberIds
      ? [...attachedBonds.filter((bond) => priorityMemberIds.has(bond.firstId === eater.id ? bond.secondId : bond.firstId)), ...attachedBonds.filter((bond) => !priorityMemberIds.has(bond.firstId === eater.id ? bond.secondId : bond.firstId))]
      : attachedBonds;
    if (this.config.bond.collectiveMemory.enabled) {
      orderedBonds = [...orderedBonds].sort((a, b) => (b.bondTrace ?? 0) - (a.bondTrace ?? 0)
        || (a.reserve ?? 0) - (b.reserve ?? 0));
    }
    const proposedShare = availableEnergy / attachedBonds.length;
    let allocatedEnergy = 0;
    let externalAllocation = 0;
    const activeCycle = this.gateFieldCycles.find((cycle) => cycle.endedTick === null && Object.hasOwn(cycle.memberStartEnergy, eater.id));
    let remaining = availableEnergy;
    for (let index = 0; index < orderedBonds.length && remaining > 0; index += 1) {
      const bond = orderedBonds[index];
      const reserve = bond.reserve ?? this.config.bond.initialReserve;
      const equallyAvailable = priorityMemberIds ? remaining / (orderedBonds.length - index) : proposedShare;
      const deposited = Math.min(equallyAvailable, Math.max(0, this.config.bond.reserveCapacity - reserve));
      if (deposited <= 0) continue;
      bond.reserve = reserve + deposited;
      allocatedEnergy += deposited;
      remaining -= deposited;
      const partnerId = bond.firstId === eater.id ? bond.secondId : bond.firstId;
      if (activeCycle && !Object.hasOwn(activeCycle.memberStartEnergy, partnerId)) externalAllocation += deposited;
      this.bondsFed += 1;
      this.bondEnergyFed += deposited;
    }
    eater.energy -= allocatedEnergy;
    return { total: allocatedEnergy, external: externalAllocation };
  }

  componentReserveKey(memberIds) {
    return [...memberIds].sort((a, b) => a - b).join(":");
  }

  depositComponentReserveFromHarvest(source, mealEnergy) {
    const policy = this.config.bond.componentReserveEconomy;
    if (!policy?.enabled || mealEnergy <= 0) return 0;
    const group = this.getBondGroups().find((members) => members.includes(source.id));
    if (!group || group.length < policy.minimumComponentSize) return 0;
    const floor = this.getReproductionEnergyFloor(source);
    const resourceFunded = this.config.bond.resourceFundedSurvival?.enabled;
    const contributionFraction = resourceFunded
      ? Number(this.config.bond.resourceFundedSurvival.harvestContributionFraction ?? policy.contributionFraction)
      : policy.contributionFraction;
    const key = this.componentReserveKey(group);
    const current = this.componentReserves.get(key) ?? 0;
    const amount = Math.min(Math.max(0, source.energy - floor), mealEnergy * contributionFraction, Math.max(0, policy.maximumReserve - current));
    if (amount <= 0) return 0;
    source.energy -= amount;
    this.componentReserves.set(key, current + amount);
    this.componentReserveDeposited += amount;
    return amount;
  }

  routeComponentReservesToBonds() {
    const policy = this.config.bond.componentReserveEconomy;
    if (!policy?.enabled) return;
    const activeKeys = new Set();
    for (const group of this.getBondGroups()) {
      if (group.length < policy.minimumComponentSize) continue;
      const key = this.componentReserveKey(group); activeKeys.add(key);
      let reserve = this.componentReserves.get(key) ?? 0;
      const ids = new Set(group);
      const members = group.map((id) => this.organisms.find((organism) => organism.id === id)).filter((member) => member?.alive);
      // Reserve order is deliberate: keep the source's survival floor (handled
      // at harvest), protect a reproduction slice, then support members, then
      // fund bond reserves. A shortage must not silently consume future birth
      // capital in order to top up a transient deficit.
      const resourceFunded = Boolean(this.config.bond.resourceFundedSurvival?.enabled);
      const protectedReproduction = resourceFunded
        ? Math.min(policy.reproductionReserve, reserve * policy.reproductionReserveFraction)
        : 0;
      let spendableReserve = Math.max(0, reserve - protectedReproduction);
      const supportTarget = this.config.bond.supportThreshold;
      const memberSupportTransfer = resourceFunded
        ? Number(this.config.bond.resourceFundedSurvival.memberSupportTransferPerTick ?? policy.memberSupportTransferPerTick)
        : policy.memberSupportTransferPerTick;
      for (const member of members.sort((a, b) => a.energy - b.energy)) {
        if (spendableReserve <= 0 || member.energy >= supportTarget) continue;
        const need = supportTarget - member.energy;
        const amount = Math.min(spendableReserve, memberSupportTransfer, need);
        if (amount <= 0) continue;
        member.energy += amount;
        spendableReserve -= amount;
        this.componentReserveWithdrawn += amount;
        this.componentReserveMemberSupport += amount;
      }
      const legacyProtectedReproduction = resourceFunded
        ? 0
        : Math.min(policy.reproductionReserve, spendableReserve * policy.reproductionReserveFraction);
      let bondBudget = Math.max(0, spendableReserve - legacyProtectedReproduction);
      const maintenanceTransfer = resourceFunded
        ? Number(this.config.bond.resourceFundedSurvival.maintenanceTransferPerTick ?? policy.maintenanceTransferPerTick)
        : policy.maintenanceTransferPerTick;
      const bonds = [...this.bonds.values()].filter((bond) => ids.has(bond.firstId) && ids.has(bond.secondId))
        .sort((a, b) => (a.reserve ?? 0) - (b.reserve ?? 0));
      for (const bond of bonds) {
        if (bondBudget <= 0) break;
        const amount = Math.min(bondBudget, maintenanceTransfer, Math.max(0, this.config.bond.reserveCapacity - (bond.reserve ?? 0)));
        if (amount <= 0) continue;
        bond.reserve = (bond.reserve ?? 0) + amount;
        if (policy.commitmentEnabled) {
          bond.componentCommitment = Math.min(
            1,
            (bond.componentCommitment ?? 0) + amount * policy.commitmentGainPerEnergy
          );
        }
        spendableReserve -= amount;
        bondBudget -= amount;
        this.componentReserveWithdrawn += amount;
        this.componentReserveBondFunding += amount;
      }
      this.componentReserves.set(key, Math.max(0, (resourceFunded ? protectedReproduction + spendableReserve : spendableReserve) * (1 - policy.reserveDecayPerTick)));
    }
    for (const key of this.componentReserves.keys()) if (!activeKeys.has(key)) this.componentReserves.delete(key);
  }

  supportLowEnergyMember(member) {
    if (member.energy >= this.config.bond.supportThreshold) return 0;
    const attachedBonds = [...this.bonds.values()]
      .filter((bond) => bond.firstId === member.id || bond.secondId === member.id)
      .filter((bond) => (bond.reserve ?? 0) > this.config.bond.supportReserveFloor);
    if (!attachedBonds.length) return 0;

    const efficiency = 1 - this.config.bond.supportLossFraction;
    let remainingNeed = this.config.bond.supportThreshold - member.energy;
    let received = 0;
    for (const bond of attachedBonds) {
      if (remainingNeed <= 0) break;
      const available = Math.max(0, (bond.reserve ?? 0) - this.config.bond.supportReserveFloor);
      const withdrawn = Math.min(
        available,
        this.config.bond.maxSupportReleasePerTick,
        remainingNeed / efficiency
      );
      if (withdrawn <= 0) continue;
      const transferred = withdrawn * efficiency;
      bond.reserve -= withdrawn;
      member.energy += transferred;
      remainingNeed -= transferred;
      received += transferred;
      this.bondSupportTransfers += 1;
      this.bondSupportEnergyReleased += transferred;
    }
    return received;
  }

  getSupportContext(member) {
    const attachedBonds = [...this.bonds.values()].filter((bond) => bond.firstId === member.id || bond.secondId === member.id);
    const group = this.getBondGroups().find((memberIds) => memberIds.includes(member.id)) ?? [];
    const groupIds = new Set(group);
    const componentBonds = [...this.bonds.values()].filter((bond) => groupIds.has(bond.firstId) && groupIds.has(bond.secondId));
    const reserve = (bonds) => bonds.reduce((total, bond) => total + (bond.reserve ?? 0), 0);
    const accessible = (bonds) => bonds.reduce((total, bond) => total + Math.max(0, (bond.reserve ?? 0) - this.config.bond.supportReserveFloor), 0);
    const directAccessibleReserve = accessible(attachedBonds);
    return {
      bonded: attachedBonds.length > 0,
      componentSize: group.length,
      memberEnergy: Number(member.energy.toFixed(3)),
      componentMemberEnergy: Number(this.organisms.filter(other => other.alive && groupIds.has(other.id)).reduce((sum, other) => sum + other.energy, 0).toFixed(3)),
      neighbourSurplus: Number(this.organisms.filter(other => other.alive && other.id !== member.id
        && attachedBonds.some(edge => edge.firstId === other.id || edge.secondId === other.id))
        .reduce((sum, other) => sum + Math.max(0, other.energy - this.getReproductionEnergyFloor(other)), 0).toFixed(3)),
      attachedBondCount: attachedBonds.length,
      directReserve: Number(reserve(attachedBonds).toFixed(3)),
      directAccessibleReserve: Number(directAccessibleReserve.toFixed(3)),
      componentReserve: Number(reserve(componentBonds).toFixed(3)),
      componentAccessibleReserve: Number(accessible(componentBonds).toFixed(3)),
      supportEligible: member.energy < this.config.bond.supportThreshold && directAccessibleReserve > 0,
      energyBeforeSupport: Number(member.energy.toFixed(3))
    };
  }

  relayReserveToMember(member, context) {
    const config = this.config.bond;
    if (!config.relayEnabled || member.energy > config.relayCriticalEnergy || context.directAccessibleReserve > 0) {
      return { withdrawn: 0, delivered: 0 };
    }
    const directBonds = [...this.bonds.values()]
      .filter((bond) => bond.firstId === member.id || bond.secondId === member.id)
      .sort((first, second) => (first.reserve ?? 0) - (second.reserve ?? 0));
    for (const directBond of directBonds) {
      const connectorId = directBond.firstId === member.id ? directBond.secondId : directBond.firstId;
      const sourceBonds = [...this.bonds.values()]
        .filter((bond) => bond !== directBond && (bond.firstId === connectorId || bond.secondId === connectorId))
        .filter((bond) => (bond.reserve ?? 0) > config.supportReserveFloor)
        .sort((first, second) => (second.reserve ?? 0) - (first.reserve ?? 0));
      const sourceBond = sourceBonds[0];
      if (!sourceBond) continue;
      const directReserve = directBond.reserve ?? config.initialReserve;
      const directCapacity = Math.max(0, config.reserveCapacity - directReserve);
      const available = Math.max(0, (sourceBond.reserve ?? 0) - config.supportReserveFloor);
      const efficiency = 1 - config.relayLossFraction;
      const withdrawn = Math.min(available, config.maxRelayPerTick, directCapacity / efficiency);
      if (withdrawn <= 0) continue;
      const delivered = withdrawn * efficiency;
      sourceBond.reserve -= withdrawn;
      directBond.reserve = directReserve + delivered;
      this.bondRelayTransfers += 1;
      this.bondRelayEnergyWithdrawn += withdrawn;
      this.bondRelayEnergyDelivered += delivered;
      this.energyEconomics.losses.relayTransfer = (this.energyEconomics.losses.relayTransfer ?? 0) + (withdrawn - delivered);
      return { withdrawn, delivered, sourceBond: this.bondKey(sourceBond.firstId, sourceBond.secondId), directBond: this.bondKey(directBond.firstId, directBond.secondId) };
    }
    return { withdrawn: 0, delivered: 0 };
  }

  recordStarvationDiagnostic(member, context, supportReceived, relay = { withdrawn: 0, delivered: 0 }) {
    this.starvationDiagnostics.push({
      tick: this.simulationTicks + 1,
      organismId: member.id,
      lineageId: member.lineageId,
      generation: member.generation,
      ...context,
      relayWithdrawn: Number(relay.withdrawn.toFixed(3)),
      relayDelivered: Number(relay.delivered.toFixed(3)),
      supportReceived: Number(supportReceived.toFixed(3)),
      energyAfterSupport: Number(member.energy.toFixed(3)),
      strandedFromComponent: context.directAccessibleReserve === 0 && context.componentAccessibleReserve > 0
    });
    if (this.starvationDiagnostics.length > 1000) this.starvationDiagnostics.shift();
  }

  updateGateDiscovery() {
    const policy = this.config.collectiveWork.gateDiscovery;
    if (!policy?.enabled) {
      this.gateDiscoveryTargets.clear();
      return;
    }
    const alive = this.organisms.filter((organism) => organism.alive);
    const byId = new Map(alive.map((organism) => [organism.id, organism]));
    const reports = new Map();
    for (const organism of alive) {
      const gate = this.workGates
        .filter((candidate) => !candidate.exhausted && candidate.cooldown <= 0)
        .map((candidate) => ({ candidate, distance: this.distanceToGate(organism, candidate) }))
        .filter(({ distance }) => distance <= policy.detectionRadius)
        .sort((first, second) => first.distance - second.distance || first.candidate.id - second.candidate.id)[0];
      if (!gate) continue;
      const dx = gate.candidate.x - organism.x;
      const dy = gate.candidate.y - organism.y;
      reports.set(organism.id, {
        gateId: gate.candidate.id,
        dx, dy,
        distance: gate.distance,
        phase: gate.candidate.phase,
        stock: gate.candidate.energyStock,
        confidence: 1,
        expiresTick: this.simulationTicks + policy.reportTtlTicks,
        sourceId: organism.id
      });
      this.gateDiscoveryStats.sightings += 1;
    }
    for (let hop = 0; hop < policy.maximumHops; hop += 1) {
      for (const bond of this.bonds.values()) {
        for (const [fromId, toId] of [[bond.firstId, bond.secondId], [bond.secondId, bond.firstId]]) {
          const report = reports.get(fromId);
          if (!report || report.confidence <= policy.minimumConfidence) continue;
          const target = byId.get(toId);
          if (!target) continue;
          const relayed = { ...report, dx: report.dx + (byId.get(fromId)?.x ?? target.x) - target.x, dy: report.dy + (byId.get(fromId)?.y ?? target.y) - target.y, confidence: report.confidence * policy.pulseAttenuationPerHop, sourceId: fromId };
          const existing = reports.get(toId);
          if (!existing || relayed.confidence > existing.confidence) {
            reports.set(toId, relayed);
            this.gateDiscoveryStats.relays += 1;
          }
        }
      }
    }
    this.gateDiscoveryReports = reports;
    const activeGroups = this.getBondGroups();
    const activeKeys = new Set();
    for (const group of activeGroups) {
      const key = this.componentLifecycleKey(group);
      activeKeys.add(key);
      const votes = new Map();
      for (const id of group) {
        const report = reports.get(id);
        if (!report || report.expiresTick < this.simulationTicks || report.confidence < policy.minimumConfidence) continue;
        const vote = votes.get(report.gateId) ?? { count: 0, confidence: 0 };
        vote.count += 1; vote.confidence += report.confidence;
        votes.set(report.gateId, vote);
      }
      const winner = [...votes.entries()]
        .filter(([, vote]) => vote.count >= policy.minimumReports && vote.confidence / vote.count >= policy.minimumConfidence)
        .sort((first, second) => second[1].count - first[1].count || second[1].confidence - first[1].confidence)[0];
      if (winner) {
        const gate = this.workGates.find((candidate) => candidate.id === winner[0]);
        if (gate && !gate.exhausted && gate.cooldown <= 0) {
          if (this.gateDiscoveryTargets.get(key) !== gate.id) this.gateDiscoveryStats.consensuses += 1;
          this.gateDiscoveryTargets.set(key, gate.id);
        }
      }
    }
    for (const key of this.gateDiscoveryTargets.keys()) if (!activeKeys.has(key)) this.gateDiscoveryTargets.delete(key);
  }

  getGateNavigationTarget(members) {
    const navigation = this.config.collectiveWork.navigation;
    if (!navigation.enabled) return null;
    const memberIds = new Set(members.map((member) => member.id));
    const eligibleFacets = this.getFacets()
      .filter((facet) => facet.memberIds.every((id) => memberIds.has(id)))
      .map((facet) => ({ ...facet, strength: this.getFacetStrength(facet.memberIds) }))
      .filter((facet) => facet.strength >= navigation.minimumFacetStrength)
      .sort((first, second) => second.strength - first.strength || first.key.localeCompare(second.key));
    const facet = eligibleFacets[0];
    if (!facet) return null;
    const componentKey = this.componentLifecycleKey(members.map((member) => member.id));
    const discoveredGateId = this.gateDiscoveryTargets.get(componentKey);
    const discoveredGate = this.workGates.find((gate) => gate.id === discoveredGateId && !gate.exhausted && gate.cooldown <= 0);
    if (discoveredGate) return { gate: discoveredGate, facetKey: facet.key, committed: false, discovered: true };
    const committedGateId = this.gateFacetAssignments.get(facet.key);
    const committedGate = this.workGates.find((gate) => gate.id === committedGateId);
    if (committedGate) return { gate: committedGate, facetKey: facet.key, committed: true };
    const claimedGateIds = new Set(this.gateFacetAssignments.values());
    return this.workGates
      .filter((gate) => gate.fieldStrength <= 0 && gate.cooldown <= 0 && !claimedGateIds.has(gate.id))
      .map((gate) => ({ gate, facetKey: facet.key, committed: false, distance: average(members.map((member) => this.distanceToGate(member, gate))) }))
      .filter((candidate) => candidate.distance <= navigation.detectionRadius)
      .sort((first, second) => first.distance - second.distance || first.gate.id - second.gate.id)[0] ?? null;
  }

  getOverflowPlumeNavigationTarget(members) {
    const chemistry = this.config.chemistry;
    const navigation = chemistry.overflowPlumeNavigation;
    if (!chemistry.overflowPlumeEnabled || !navigation.enabled) return null;
    const memberIds = new Set(members.map((member) => member.id));
    const hasStrongFacet = this.getFacets()
      .filter((facet) => facet.memberIds.every((id) => memberIds.has(id)))
      .some((facet) => this.getFacetStrength(facet.memberIds) >= this.config.facet.minimumBondStrength);
    if (!hasStrongFacet) return null;
    const candidates = [];
    for (let y = 0; y < this.world.height; y += 1) {
      for (let x = 0; x < this.world.width; x += 1) {
        const charge = this.world.overflowPlume[y][x];
        if (charge < chemistry.overflowPlumeEnergyPerFood) continue;
        const distance = average(members.map((member) => this.distanceBetweenPositions(member, { x, y })));
        if (distance <= navigation.detectionRadius) candidates.push({ x, y, charge, distance });
      }
    }
    return candidates.sort((first, second) => first.distance - second.distance || second.charge - first.charge)[0] ?? null;
  }

  clearInvalidGateAssignments() {
    const activeFacetKeys = new Set(this.getFacets()
      .filter((facet) => this.getFacetStrength(facet.memberIds) >= this.config.collectiveWork.navigation.minimumFacetStrength)
      .map((facet) => facet.key));
    for (const [facetKey, gateId] of this.gateFacetAssignments) {
      const gate = this.workGates.find((candidate) => candidate.id === gateId);
      if (!activeFacetKeys.has(facetKey) || !gate || (gate.fieldStrength > 0 && gate.fieldFacetKey !== facetKey)) {
        this.gateFacetAssignments.delete(facetKey);
      }
    }
  }

  collectiveGateDistance(members, gate, direction = { x: 0, y: 0 }) {
    return average(members.map((member) => {
      const position = this.world.wrapPosition(member.x + direction.x, member.y + direction.y);
      return this.distanceToGate(position, gate);
    }));
  }

  componentLifecycleKey(memberIds) {
    return [...memberIds].sort((first, second) => first - second).join(":");
  }

  getComponentLifecycleState(members) {
    return this.componentLifecycle.get(this.componentLifecycleKey(members.map((member) => member.id))) ?? null;
  }

  updateComponentLifecycle() {
    const policy = this.config.collectiveWork.componentLifecycle;
    if (!policy.enabled) {
      this.componentLifecycle.clear();
      return;
    }
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const activeKeys = new Set();
    const facets = this.getFacets().map((facet) => ({ ...facet, strength: this.getFacetStrength(facet.memberIds) }));
    for (const memberIds of this.getBondGroups()) {
      const members = memberIds.map((id) => byId.get(id)).filter(Boolean);
      if (members.length !== memberIds.length) continue;
      const facet = facets
        .filter((candidate) => candidate.memberIds.every((id) => memberIds.includes(id)))
        .filter((candidate) => candidate.strength >= this.config.collectiveWork.navigation.minimumFacetStrength)
        .sort((first, second) => second.strength - first.strength || first.key.localeCompare(second.key))[0];
      if (!facet) continue;
      const key = this.componentLifecycleKey(memberIds);
      activeKeys.add(key);
      const record = this.componentLifecycle.get(key) ?? {
        key, state: "harvest", facetKey: facet.key, gateId: null,
        depletedSinceTick: null, migrationStartedTick: null, lastStateTick: this.simulationTicks
      };
      record.facetKey = facet.key;
      const assignedGateId = this.gateFacetAssignments.get(facet.key);
      const gate = this.workGates.find((candidate) => candidate.id === assignedGateId)
        ?? this.workGates.find((candidate) => candidate.fieldFacetKey === facet.key)
        ?? null;
      record.gateId = gate?.id ?? null;
      const depleted = Boolean(gate) && (gate.exhausted || gate.energyStock <= 0 || gate.fieldStrength <= policy.depletionFieldStrength);
      const meanEnergyFraction = average(members.map((member) => {
        const capacity = this.config.organism.reproductionThreshold * 1.8 * (member.genomeProfile.powers[3] ?? 1) * (this.config.organism.energyCapacityMultiplier ?? 1);
        return member.energy / capacity;
      }));
      const previousState = record.state;
      if (!gate) {
        record.state = "migrate";
        record.depletedSinceTick ??= this.simulationTicks;
      } else if (!depleted) {
        record.state = "harvest";
        record.depletedSinceTick = null;
        record.migrationStartedTick = null;
      } else {
        record.depletedSinceTick ??= this.simulationTicks;
        const dwellTicks = this.simulationTicks - record.depletedSinceTick;
        record.state = dwellTicks < policy.maxDwellTicksAfterDepletion
          && meanEnergyFraction >= policy.conserveMinimumMeanEnergyFraction
          ? "conserve"
          : "migrate";
      }
      record.meanEnergyFraction = Number(meanEnergyFraction.toFixed(3));
      if (record.state === "migrate") {
        record.migrationStartedTick ??= this.simulationTicks;
        if (this.gateFacetAssignments.get(facet.key) === gate?.id) this.gateFacetAssignments.delete(facet.key);
      }
      if (record.state !== previousState) {
        record.lastStateTick = this.simulationTicks;
        this.recordTelemetry("component-lifecycle", `Component ${key} entered ${record.state} near gate ${record.gateId ?? "none"}.`);
      }
      this.componentLifecycle.set(key, record);
      for (const member of members) member.componentLifecycleState = record.state;
    }
    for (const key of this.componentLifecycle.keys()) {
      if (!activeKeys.has(key)) this.componentLifecycle.delete(key);
    }
  }

  getComponentLifecycleConserveIds() {
    if (!this.config.collectiveWork.componentLifecycle.enabled) return new Set();
    const eligible = new Set();
    for (const groupIds of this.getBondGroups()) {
      const record = this.componentLifecycle.get(this.componentLifecycleKey(groupIds));
      if (record?.state === "conserve") groupIds.forEach((id) => eligible.add(id));
    }
    return eligible;
  }

  getMigrationTransportEligibleIds() {
    const transport = this.config.collectiveWork.migrationTransport;
    if (!transport.enabled || !this.config.collectiveWork.componentLifecycle.enabled) return new Set();
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const eligible = new Set();
    for (const groupIds of this.getBondGroups()) {
      if (groupIds.length < transport.minimumMembers) continue;
      const members = groupIds.map((id) => byId.get(id)).filter(Boolean);
      if (members.length !== groupIds.length) continue;
      if (this.componentLifecycle.get(this.componentLifecycleKey(groupIds))?.state !== "migrate") continue;
      const hasStrongFacet = this.getFacets()
        .filter((facet) => facet.memberIds.every((id) => groupIds.includes(id)))
        .some((facet) => this.getFacetStrength(facet.memberIds) >= transport.minimumFacetStrength);
      if (!hasStrongFacet || !this.getGateNavigationTarget(members)) continue;
      members.forEach((member) => eligible.add(member.id));
    }
    return eligible;
  }

  getCollectiveStrideEligibleIds() {
    const stride = this.config.collectiveWork.collectiveStride;
    if (!stride.enabled) return new Set();
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const eligible = new Set();
    for (const groupIds of this.getBondGroups()) {
      if (groupIds.length < stride.minimumMembers) continue;
      const members = groupIds.map((id) => byId.get(id)).filter(Boolean);
      if (members.length !== groupIds.length) continue;
      if (!members.some((member) => member.brainExecution?.effectors.move >= 0.05)) continue;
      if (!this.getGateNavigationTarget(members)) continue;
      members.forEach((member) => eligible.add(member.id));
    }
    return eligible;
  }

  getSatietyMigrationEligibleIds() {
    const policy = this.config.collectiveWork.satietyMigration;
    if (!policy.enabled) return new Set();
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const eligible = new Set();
    for (const groupIds of this.getBondGroups()) {
      const members = groupIds.map((id) => byId.get(id)).filter(Boolean);
      if (members.length !== groupIds.length || !this.getGateNavigationTarget(members)) continue;
      const meanEnergyFraction = average(members.map((member) => {
        const capacity = this.config.organism.reproductionThreshold * 1.8 * (member.genomeProfile.powers[3] ?? 1) * (this.config.organism.energyCapacityMultiplier ?? 1);
        return member.energy / capacity;
      }));
      if (meanEnergyFraction >= policy.minimumMeanEnergyFraction) members.forEach((member) => eligible.add(member.id));
    }
    return eligible;
  }

  moveCompounds() {
    if (this.config.bond.adaptiveMorphology?.enabled
      && this.simulationTicks % this.config.bond.adaptiveMorphology.collectiveMovementInterval !== 0) return;
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const occupied = new Set(this.organisms.filter((organism) => organism.alive).map((organism) => `${organism.x},${organism.y}`));

    const activeGroupKeys = new Set();
    this.clearInvalidGateAssignments();
    for (const groupIds of this.getBondGroups()) {
      const members = groupIds.map((id) => byId.get(id)).filter(Boolean);
      if (!members.length || !members.some((member) => member.brainExecution?.effectors.move >= 0.05)) continue;
      const memberPositions = new Set(members.map((member) => `${member.x},${member.y}`));
      const groupKey = [...groupIds].sort((first, second) => first - second).join(":");
      const lifecycle = this.componentLifecycle.get(groupKey) ?? null;
      activeGroupKeys.add(groupKey);
      const collectiveScores = Object.fromEntries(DIRECTIONS.map((direction) => [direction.name,
        members.reduce((total, member) => total + (member.brainExecution?.effectors.direction?.[direction.name] ?? 0), 0) / members.length
      ]));
      const morphology=this.config.bond.adaptiveMorphology;
      if (morphology?.enabled && morphology.fieldSensingEnabled!==false && morphology.environmentNavigationBias>0) {
        const value=(x,y)=>localResourceValue(this,x,y);
        const exposed=members.some(member=>fieldAt(this,member.x,member.y).danger>0);
        const metabolicBias=morphology.environmentNavigationBias*average(members.map(member=>foragingNeed(member,morphology)));
        const bias=exposed?Math.max(metabolicBias,morphology.dangerNavigationBias??0):metabolicBias;
        for(const direction of DIRECTIONS) {
          const improvement=members.reduce((sum,member)=>{
            const next=this.world.wrapPosition(member.x+direction.x,member.y+direction.y);
            return sum+value(next.x,next.y)-value(member.x,member.y);
          },0)/members.length;
          collectiveScores[direction.name]+=improvement*bias;
        }
      }
      const legalDirections = DIRECTIONS.filter((direction) => {
        const targets = members.map((member) => this.world.wrapPosition(member.x + direction.x, member.y + direction.y));
        return targets.every((target) => this.world.isWalkable(target.x, target.y)
          && (!occupied.has(`${target.x},${target.y}`) || memberPositions.has(`${target.x},${target.y}`)));
      });
      if (!legalDirections.length) continue;
      const navigationTarget = this.getGateNavigationTarget(members);
      const candidateGate = navigationTarget?.gate ?? null;
      const candidatePlume = this.getOverflowPlumeNavigationTarget(members);
      const candidateGateDistance = candidateGate ? this.collectiveGateDistance(members, candidateGate) : Infinity;
      // A plume is only an opportunistic local detour, never a replacement for a closer gate task.
      const plumeTarget = candidatePlume && candidatePlume.distance < candidateGateDistance ? candidatePlume : null;
      const navigationGate = plumeTarget ? null : candidateGate;
      const distanceBeforeNavigation = navigationGate ? this.collectiveGateDistance(members, navigationGate) : null;
      const distanceBeforePlume = plumeTarget ? average(members.map((member) => this.distanceBetweenPositions(member, plumeTarget))) : null;
      if (navigationGate) {
        for (const direction of legalDirections) {
          if (this.collectiveGateDistance(members, navigationGate, direction) < distanceBeforeNavigation) {
            collectiveScores[direction.name] += this.config.collectiveWork.navigation.directionBias;
          }
        }
      }
      if (plumeTarget) {
        for (const direction of legalDirections) {
          const nextDistance = average(members.map((member) => this.distanceBetweenPositions(this.world.wrapPosition(member.x + direction.x, member.y + direction.y), plumeTarget)));
          if (nextDistance < distanceBeforePlume) collectiveScores[direction.name] += this.config.chemistry.overflowPlumeNavigation.directionBias;
        }
      }
      const heading = this.compoundHeadings.get(groupKey) ?? members[0].direction.name;
      const strongestScore = Math.max(...legalDirections.map((direction) => collectiveScores[direction.name] ?? 0));
      const strongestDirections = legalDirections.filter((direction) => (collectiveScores[direction.name] ?? 0) === strongestScore);
      const direction = strongestDirections.find((candidate) => candidate.name === heading)
        ?? strongestDirections[0];
      this.compoundHeadings.set(groupKey, direction.name);
      const targets = members.map((member) => this.world.wrapPosition(member.x + direction.x, member.y + direction.y));
      const navigationMove = Boolean(navigationGate && this.collectiveGateDistance(members, navigationGate, direction) < distanceBeforeNavigation);
      const plumeNavigationMove = Boolean(plumeTarget && average(members.map((member) => this.distanceBetweenPositions(this.world.wrapPosition(member.x + direction.x, member.y + direction.y), plumeTarget))) < distanceBeforePlume);
      const strideActive = navigationMove
        && this.config.collectiveWork.collectiveStride.enabled
        && members.length >= this.config.collectiveWork.collectiveStride.minimumMembers;
      const decision = {
        mode: strideActive ? "collective-stride" : (navigationMove ? "collective-gate-navigation" : (plumeNavigationMove ? "collective-plume-navigation" : "collective-graph")),
        chosen: direction.name,
        scores: Object.fromEntries(Object.entries(collectiveScores).map(([name, score]) => [name, Number(score.toFixed(2))])),
        gateId: navigationMove ? navigationGate.id : null,
        plumeTarget: plumeNavigationMove ? { x: plumeTarget.x, y: plumeTarget.y } : null,
        lifecycleState: lifecycle?.state ?? null
      };
      members.forEach((member) => {
        member.collectiveDecision = decision;
        member.collectiveStrideActive = strideActive;
        member.satietyMigrationActive = strideActive && Boolean(this.satietyMigrationEligibleIds?.has(member.id));
      });
      this.collectiveMoves += 1;
      if (strongestScore > 0) this.collectiveResourceDirectedMoves += 1;
      if (navigationMove) this.collectiveGateNavigationMoves += 1;
      if (navigationMove && lifecycle?.state === "migrate") this.componentLifecycleMigrations += 1;
      if (plumeNavigationMove) this.collectivePlumeNavigationMoves += 1;

      for (const member of members) occupied.delete(`${member.x},${member.y}`);
      members.forEach((member, index) => {
        member.x = targets[index].x;
        member.y = targets[index].y;
        occupied.add(`${member.x},${member.y}`);
      });
      if (navigationMove && members.every((member) => this.distanceToGate(member, navigationGate) <= this.config.collectiveWork.gateRadius)) {
        this.collectiveGateArrivals += 1;
        this.recordComponentEpisodeGateArrival(members, navigationGate);
        this.gateFacetAssignments.set(navigationTarget.facetKey, navigationGate.id);
        this.emitCollectivePulse(members[0], "migration", 0.8, navigationGate);
      }
    }
    for (const key of this.compoundHeadings.keys()) {
      if (!activeGroupKeys.has(key)) this.compoundHeadings.delete(key);
    }
  }

  areAdjacent(first, second) {
    const xDistance = Math.abs(first.x - second.x);
    const yDistance = Math.abs(first.y - second.y);
    const wrappedX = this.world.wraps ? Math.min(xDistance, this.world.width - xDistance) : xDistance;
    const wrappedY = this.world.wraps ? Math.min(yDistance, this.world.height - yDistance) : yDistance;
    return wrappedX <= 2 && wrappedY <= 2;
  }

  hasEnvironmentalWakeCue(position) {
    const policy = this.config.bond.dormantBonds;
    if (!policy?.enabled) return false;
    const radius = Math.max(1, Math.round(policy.wakeRadius ?? 6));
    if (policy.wakeOnFood) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const target = this.world.wrapPosition(position.x + dx, position.y + dy);
          if (this.world.tiles[target.y]?.[target.x]?.type === TILE_TYPES.FOOD) return true;
        }
      }
    }
    if (policy.wakeOnGate && this.workGates.some((gate) => !gate.exhausted && this.distanceToGate(position, gate) <= radius)) return true;
    return false;
  }

  isElasticTetherBondWithinLeash(bond) {
    if (!bond?.elasticScout) return false;
    const policy = this.config.bond.topologyMemory?.tetheredScout;
    if (!policy?.enabled || !policy.elasticEnabled) return false;
    const first = this.organisms.find((organism) => organism.id === bond.firstId);
    const second = this.organisms.find((organism) => organism.id === bond.secondId);
    if (!first || !second || !first.alive || !second.alive) return false;
    return this.distanceBetweenPositions(first, second) <= policy.leashRadius;
  }

  findAdjacentCandidatePairs(candidates) {
    const cells = new Map();
    for (const candidate of candidates) {
      const key = `${candidate.x},${candidate.y}`;
      const occupants = cells.get(key) ?? [];
      occupants.push(candidate);
      cells.set(key, occupants);
    }

    const pairs = [];
    const pairKeys = new Set();
    for (const candidate of candidates) {
      // Bonds use a Chebyshev distance of two cells, so only these 25 local cells can qualify.
      for (let deltaX = -2; deltaX <= 2; deltaX += 1) {
        for (let deltaY = -2; deltaY <= 2; deltaY += 1) {
          const position = this.world.wrapPosition(candidate.x + deltaX, candidate.y + deltaY);
          for (const neighbor of cells.get(`${position.x},${position.y}`) ?? []) {
            if (neighbor.id <= candidate.id || !this.areAdjacent(candidate, neighbor)) continue;
            const key = this.bondKey(candidate.id, neighbor.id);
            if (pairKeys.has(key)) continue;
            pairKeys.add(key);
            pairs.push([candidate, neighbor]);
          }
        }
      }
    }
    return pairs;
  }

  updateBonds() {
    // Bond membership can change in this method. Calls elsewhere in the same
    // tick can safely reuse one component decomposition after it completes.
    this.bondGroupsCache = null;
    this.routeComponentReservesToBonds();
    const componentReservePolicy = this.config.bond.componentReserveEconomy;
    for (const bond of this.bonds.values()) {
      if (componentReservePolicy?.commitmentEnabled) {
        bond.componentCommitment = (bond.componentCommitment ?? 0) * componentReservePolicy.commitmentDecayRate;
      }
      const reserveBeforeMaintenance = bond.reserve ?? this.config.bond.initialReserve;
      const dormantPolicy = this.config.bond.dormantBonds;
      const maintenanceMultiplier = dormantPolicy?.enabled && bond.dormant
        ? Number(dormantPolicy.maintenanceMultiplier ?? 1)
        : 1;
      bond.reserve = Math.max(0, reserveBeforeMaintenance - this.config.bond.maintenancePerTick * maintenanceMultiplier);
      this.energyEconomics.expenses.bondReserveMaintenance += reserveBeforeMaintenance - bond.reserve;
    }
    let candidates = this.organisms.filter((organism) => organism.alive && organism.brainExecution?.effectors.bind >= 0.35);
    const memoryPolicy = this.config.bond.collectiveMemory;
    if (memoryPolicy?.enabled) {
      const minimumTrace = memoryPolicy.consolidationThreshold * memoryPolicy.reinforcementStrength;
      const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
      const consolidatedIds = new Set(candidates.map((organism) => organism.id));
      for (const bond of this.bonds.values()) {
        const first = byId.get(bond.firstId); const second = byId.get(bond.secondId);
        if (!first || !second || !this.areAdjacent(first, second) || (bond.bondTrace ?? 0) < minimumTrace) continue;
        consolidatedIds.add(first.id); consolidatedIds.add(second.id);
      }
      candidates = [...consolidatedIds].map((id) => byId.get(id)).filter(Boolean);
    }
    const adjacentPairs = this.findAdjacentCandidatePairs(candidates);
    const adjacentPairKeys = new Set(adjacentPairs.map(([first, second]) => this.bondKey(first.id, second.id)));
    const neighbors = new Map(candidates.map((organism) => [organism.id, new Set()]));
    const addAdjacentPair = (first, second) => {
      const key = this.bondKey(first.id, second.id);
      if (adjacentPairKeys.has(key)) return;
      adjacentPairKeys.add(key);
      adjacentPairs.push([first, second]);
    };
    for (const [first, second] of adjacentPairs) {
      neighbors.get(first.id).add(second.id);
      neighbors.get(second.id).add(first.id);
    }
    const eligibleIds = new Set();
    const visited = new Set();
    for (const candidate of candidates) {
      if (visited.has(candidate.id)) continue;
      const component = [];
      const queue = [candidate.id];
      visited.add(candidate.id);
      for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
        const id = queue[queueIndex];
        component.push(id);
        for (const neighborId of neighbors.get(id) ?? []) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }
      if (component.length >= 3) component.forEach((id) => eligibleIds.add(id));
    }
    const byId = new Map(this.organisms.filter((organism) => organism.alive).map((organism) => [organism.id, organism]));
    const inheritedKeys = new Set([
      ...this.structuralBirthSeeds.keys(),
      ...[...this.bonds.entries()].filter(([, bond]) => bond.inherited).map(([key]) => key)
    ]);
    for (const key of inheritedKeys) {
      const [firstId, secondId] = key.split(":").map(Number);
      const first = byId.get(firstId);
      const second = byId.get(secondId);
      if (first && second && this.areAdjacent(first, second)) {
        addAdjacentPair(first, second);
      } else if (this.structuralBirthSeeds.has(key)) {
        this.structuralBirthSeeds.delete(key);
      }
    }
    const activeKeys = new Set();
    for (const [first, second] of adjacentPairs) {
      const key = this.bondKey(first.id, second.id);
      if ((!eligibleIds.has(first.id) || !eligibleIds.has(second.id)) && !inheritedKeys.has(key)) continue;
      activeKeys.add(key);
      const ticks = (this.bondCandidates.get(key) ?? 0) + 1;
      this.bondCandidates.set(key, ticks);
      const existingBond = this.bonds.get(key);
      if (existingBond) {
        if (existingBond.reserve > 0) {
          existingBond.strength = Math.min(1, existingBond.strength + this.config.bond.repairPerTick);
        }
      } else if (ticks >= this.config.bond.buddingCandidateTicks
        && (() => {
          const support = this.config.guidedStructuralIntelligence?.supportedDevelopment;
          if (!support?.enabled) return true;
          if (this.bonds.size >= support.connectionCap) return false;
          const groups = this.getBondGroups();
          const componentFor = (id) => groups.find((members) => members.includes(id)) ?? [id];
          const componentBondCount = (members) => {
            const ids = new Set(members);
            return [...this.bonds.values()].filter((bond) => ids.has(bond.firstId) && ids.has(bond.secondId)).length;
          };
          const firstCount = componentBondCount(componentFor(first.id));
          const secondCount = componentBondCount(componentFor(second.id));
          return firstCount < support.connectionCapPerComponent && secondCount < support.connectionCapPerComponent;
        })()) {
        const seedEnergy = this.structuralBirthSeeds.get(key) ?? 0;
        if(this.config.bond.adaptiveMorphology?.enabled && this.config.bond.adaptiveMorphology.paidFormationEnabled) {
          const degree=id=>[...this.bonds.values()].filter(edge=>edge.firstId===id||edge.secondId===id).length;
          if(degree(first.id)>=this.config.bond.adaptiveMorphology.maximumDegree
            || degree(second.id)>=this.config.bond.adaptiveMorphology.maximumDegree) continue;
          const firstFloor=this.usesAlignedBudgets()?this.getBondFundingFloor(first):this.config.bond.supportThreshold;
          const secondFloor=this.usesAlignedBudgets()?this.getBondFundingFloor(second):this.config.bond.supportThreshold;
          const firstAvailable=Math.max(0,first.energy-firstFloor),secondAvailable=Math.max(0,second.energy-secondFloor);
          const cost=this.config.bond.initialReserve;
          if(firstAvailable+secondAvailable<cost) continue;
          const fromFirst=Math.min(firstAvailable,cost/2);
          const fromSecond=Math.min(secondAvailable,cost-fromFirst);
          const firstRemainder=cost-fromFirst-fromSecond;
          first.energy-=fromFirst+firstRemainder;second.energy-=fromSecond;
          this.recordEnergyAllocation(first,'structuralSeed',fromFirst+firstRemainder);
          this.recordEnergyAllocation(second,'structuralSeed',fromSecond);
        }
        this.bonds.set(key, {
          firstId: first.id,
          secondId: second.id,
          strength: 0.35,
          reserve: Math.min(this.config.bond.reserveCapacity, this.config.bond.initialReserve + seedEnergy),
          bondTrace: 0,
          componentCommitment: 0,
          topologyTrace: 0,
          topologyLastPulseTick: null,
          lastPulseTick: null,
          lastPulseEvent: null,
          dormant: false,
          inherited: this.structuralBirthSeeds.has(key)
        });
        this.structuralBirthSeeds.delete(key);
        this.bondsFormed += 1;
        this.recordTelemetry("bond-formed", `Bond formed: organisms #${first.id} and #${second.id}${seedEnergy ? " from a structural birth seed" : ""}.`);
      }
    }
    // Maintenance only: a local reserve can retain an existing adjacent edge
    // through a brief loss of bind drive, but it cannot form an extra edge.
    if (componentReservePolicy?.enabled && componentReservePolicy.commitmentEnabled) {
      const topologyPolicy = this.config.bond.topologyMemory;
      const consolidatedSignatures = topologyPolicy?.enabled
        ? new Set([...this.topologyMotifs.values()]
          .filter((motif) => motif.trace >= topologyPolicy.motifConsolidationThreshold
            && (this.topologyStableTicks.get(motif.signature) ?? 0) >= topologyPolicy.stableTicksRequired)
          .map((motif) => motif.signature))
        : new Set();
      const facetMemoryPolicy = topologyPolicy?.facetMemory;
      const facetProtectedKeys = new Set();
      if (facetMemoryPolicy?.enabled) {
        for (const facet of this.getFacets()) {
          const signature = this.getFacetMotifSignature(facet);
          const memory = this.facetMotifMemory.get(signature);
          const stable = (this.facetMotifStableTicks.get(signature) ?? 0) >= facetMemoryPolicy.stableTicksRequired;
          if (memory?.trace >= facetMemoryPolicy.consolidationThreshold && stable) {
            for (let index = 0; index < facet.memberIds.length; index += 1) {
              for (let next = index + 1; next < facet.memberIds.length; next += 1) {
                facetProtectedKeys.add(this.bondKey(facet.memberIds[index], facet.memberIds[next]));
              }
            }
          }
        }
      }
      for (const [key, bond] of this.bonds) {
        const first = byId.get(bond.firstId);
        const second = byId.get(bond.secondId);
        const group = first && this.getBondGroups().find((memberIds) => memberIds.includes(first.id));
        const motifSignature = group ? this.getTopologyMotifSignature(group) : null;
        const motifProtected = Boolean(topologyPolicy?.enabled && consolidatedSignatures.has(motifSignature));
        const facetProtected = facetProtectedKeys.has(key);
        const pathRecentlySupported = Boolean(topologyPolicy?.enabled
          && (bond.topologyTrace ?? 0) >= topologyPolicy.edgeCommitmentThreshold);
        const componentReserve = group
          ? (this.componentReserves.get(this.componentReserveKey(group)) ?? 0)
          : 0;
        const hasSharedReserve = componentReserve >= componentReservePolicy.commitmentReserveFloor;
        const membersSafe = Boolean(group?.length && group.every((id) => {
          const member = byId.get(id);
          return member && member.energy >= this.config.bond.supportThreshold;
        }));
        const isRecentlySupported = (bond.componentCommitment ?? 0) >= componentReservePolicy.commitmentThreshold
          || (hasSharedReserve && (pathRecentlySupported || motifProtected || facetProtected));
        const hasUsableReserve = (bond.reserve ?? 0) >= componentReservePolicy.commitmentReserveFloor;
        if (!first || !second || !this.areAdjacent(first, second) || !isRecentlySupported || !hasUsableReserve || !membersSafe) continue;
        activeKeys.add(key);
        this.bondCandidates.set(key, Math.max(1, this.bondCandidates.get(key) ?? 0));
        bond.strength = Math.min(1, bond.strength + this.config.bond.repairPerTick * 0.5);
      }
    }
    const scoutPolicy = this.config.bond.topologyMemory?.tetheredScout;
    if (this.config.bond.topologyMemory.enabled && scoutPolicy?.enabled && scoutPolicy.elasticEnabled) {
      for (const [key, bond] of this.bonds) {
        if (!bond.elasticScout || !this.isElasticTetherBondWithinLeash(bond)) continue;
        activeKeys.add(key);
        this.bondCandidates.set(key, Math.max(1, this.bondCandidates.get(key) ?? 0));
      }
    }
    for (const key of this.bondCandidates.keys()) {
      if (!activeKeys.has(key)) {
        this.bondCandidates.delete(key);
        this.structuralBirthSeeds.delete(key);
      }
    }
    this.removeInvalidBonds();
    this.bondGroupsCache = null;
  }

  removeInvalidBonds() {
    const byId = new Map(this.organisms.map((organism) => [organism.id, organism]));
    for (const [key, bond] of this.bonds) {
      const first = byId.get(bond.firstId);
      const second = byId.get(bond.secondId);
      if (!first || !second || !first.alive || !second.alive
        || (!this.areAdjacent(first, second) && !this.isElasticTetherBondWithinLeash(bond))) {
        this.bonds.delete(key);
        const deadMember = first && !first.alive ? first : second && !second.alive ? second : null;
        const reason = deadMember ? `organism #${deadMember.id} died: ${deadMember.deathReason ?? "unknown cause"}`
          : !first || !second ? "member was removed" : "members separated";
        this.recordBondBreak(bond, reason, deadMember ? `member died: ${deadMember.deathReason ?? "unknown cause"}` : reason);
      } else if (this.config.bond.adaptiveMorphology?.enabled && (bond.reserve ?? 0)>0) {
        // Maintaining a physical connection pays upkeep each tick; a transient
        // bind output dip need not erase an already funded connection.
        bond.strength = Math.min(1,bond.strength+this.config.bond.repairPerTick*0.25);
      } else if (!this.bondCandidates.has(key)) {
        const dormantPolicy = this.config.bond.dormantBonds;
        const wakeCue = dormantPolicy?.enabled
          && (this.hasEnvironmentalWakeCue(first) || this.hasEnvironmentalWakeCue(second));
        if (dormantPolicy?.enabled && this.areAdjacent(first, second)
          && (bond.reserve ?? 0) >= Number(dormantPolicy.minimumReserve ?? 0.5)) {
          if (bond.dormant && wakeCue) {
            bond.dormant = false;
            this.bondCandidates.set(key, 1);
            continue;
          }
          if (!wakeCue) {
            bond.dormant = true;
            bond.strength = Math.max(0.2, bond.strength);
            continue;
          }
        }
        const support = this.config.guidedStructuralIntelligence?.supportedDevelopment;
        if (support?.enabled && support.preserveExistingBonds
          && this.areAdjacent(first, second) && (bond.reserve ?? 0) > 0) {
          continue;
        }
        if (support?.enabled && (bond.quietTicks ?? 0) < support.repairWindowTicks
          && this.areAdjacent(first, second) && (bond.reserve ?? 0) > 0) {
          bond.quietTicks = (bond.quietTicks ?? 0) + 1;
          this.guidedSupportStats.quietBondTicks += 1;
          continue;
        }
        bond.strength = Math.max(0, bond.strength - 0.015);
        if (bond.strength === 0) {
          this.bonds.delete(key);
          const reason = bond.reserve <= 0 ? "bond energy reserve depleted" : "binding was no longer maintained";
          this.recordBondBreak(bond, reason);
        }
      } else if (bond.reserve <= 0) {
        bond.strength = Math.max(0, bond.strength - this.config.bond.starvationStrengthDecay);
        if (bond.strength === 0) {
          this.bonds.delete(key);
          this.recordBondBreak(bond, "bond energy reserve depleted");
        }
      }
    }
  }

  recordBondBreak(bond, reason, category = reason) {
    this.bondsBroken += 1;
    this.bondBreakReasons[category] = (this.bondBreakReasons[category] ?? 0) + 1;
    this.recordTelemetry("bond-broken", `Bond #${bond.firstId}-#${bond.secondId} broke: ${reason}.`);
  }

  setInitialPopulation(count) {
    this.config.organism.initialPopulation = clamp(Number(count), 1, this.world.width * this.world.height);
  }

  setFounderGenome(genome) {
    this.config.organism.founderGenome = this.genomeEngine.construct(genome).genome;
    this.reset();
  }

  setGridEnabled(enabled) {
    this.gridEnabled = Boolean(enabled);
  }

  setFacetTrailEnabled(enabled) {
    this.facetTrailEnabled = Boolean(enabled);
  }

  setHeadlessObservationMode(enabled) {
    this.headlessObservationMode = Boolean(enabled);
    if (this.headlessObservationMode) {
      this.birthMarkers = [];
      this.deathMarkers = [];
      this.energyTransfers = [];
      this.primaryProductionMarkers = [];
    }
  }

  setEnvironmentMemoryVisualizationEnabled(enabled) {
    this.environmentMemoryVisualizationEnabled = Boolean(enabled);
  }

  setCollectiveMemoryEnabled(enabled) {
    this.config.bond.collectiveMemory.enabled = Boolean(enabled);
  }

  setGuidedStructuralIntelligenceEnabled(enabled) {
    this.guidedInput.enabled = Boolean(enabled);
    this.config.guidedStructuralIntelligence.enabled = this.guidedInput.enabled;
  }

  setGuidedSupportedDevelopmentEnabled(enabled) {
    const mode = this.config.guidedStructuralIntelligence.supportedDevelopment;
    mode.enabled = Boolean(enabled);
    if (mode.enabled) {
      if (this._guidedOriginalMaxAge === undefined) this._guidedOriginalMaxAge = this.config.organism.maxAge;
      this.config.organism.maxAge = Number.MAX_SAFE_INTEGER;
    } else if (this._guidedOriginalMaxAge !== undefined) {
      this.config.organism.maxAge = this._guidedOriginalMaxAge;
    }
  }

  setGuidedPattern(pattern) {
    this.guidedInput = setGuidedPattern(this.guidedInput, pattern);
  }

  setGuidedGrid(grid, source = "uploaded") {
    this.guidedInput = setGuidedGrid(this.guidedInput, grid, source);
  }

  applyGuidedDevelopmentSupport() {
    if (this.config.bond.resourceFundedSurvival?.enabled) return;
    const mode = this.config.guidedStructuralIntelligence?.supportedDevelopment;
    if (!this.guidedInput.enabled || !mode?.enabled || mode.maintenanceBudgetPerTick <= 0) return;
    this.guidedSupportCredits *= Number(mode.supportCreditDecay ?? 1);
    this.guidedSupportStats.supportCredits = this.guidedSupportCredits;
    const living = this.organisms.filter((organism) => organism.alive);
    const stressed = living.some((organism) => organism.energy < this.config.bond.supportThreshold)
      || [...this.componentLifecycle.values()].some((component) => component.state === "migrate");
    if (!stressed) return;
    const unconditional = Boolean(mode.unconditionalSupportEnabled);
    if (!unconditional && !mode.conditionalSupportEnabled) return;
    let budget = unconditional
      ? mode.maintenanceBudgetPerTick
      : Math.min(mode.maintenanceBudgetPerTick, Number(mode.emergencyBudgetPerTick ?? 0) + this.guidedSupportCredits);
    for (const organism of living.filter((item) => item.energy < this.config.bond.supportThreshold).sort((a, b) => a.energy - b.energy)) {
      if (budget <= 0) break;
      const amount = Math.min(budget, mode.memberSupportPerTick, this.config.bond.supportThreshold - organism.energy);
      organism.energy += amount;
      budget -= amount;
      this.guidedSupportStats.memberSupport += amount;
    }
    for (const bond of this.bonds.values()) {
      if (budget <= 0) break;
      const amount = Math.min(budget, mode.bondReservePerTick, Math.max(0, this.config.bond.reserveCapacity - (bond.reserve ?? 0)));
      if (amount <= 0) continue;
      bond.reserve = (bond.reserve ?? 0) + amount;
      budget -= amount;
      this.guidedSupportStats.bondReserveSupport += amount;
    }
    const spent = (unconditional ? mode.maintenanceBudgetPerTick : Number(mode.emergencyBudgetPerTick ?? 0) + this.guidedSupportCredits) - budget;
    if (!unconditional) this.guidedSupportCredits = Math.max(0, this.guidedSupportCredits - Math.max(0, spent - Number(mode.emergencyBudgetPerTick ?? 0)));
    this.guidedSupportStats.supportCredits = this.guidedSupportCredits;
    this.guidedSupportStats.budgetSpent += Math.max(0, spent);
  }

  setCourierEnabled(enabled) {
    this.config.courier.enabled = Boolean(enabled);
    if (!this.config.courier.enabled) {
      for (const organism of this.organisms) {
        organism.courierReport = null;
        organism.courierMemory = null;
      }
    }
  }

  setFireSettings({ fireEnabled, fireIgnitionRate, fireSpreadChance, fireDuration }) {
    if (fireEnabled !== undefined) {
      this.config.hazards.fireEnabled = Boolean(fireEnabled);
      if (this.config.hazards.fireEnabled && this.world.fires.size === 0) {
        this.world.igniteRandomFood(this.config.hazards.fireDuration, this.config.chemistry.enabled);
      }
      if (!this.config.hazards.fireEnabled) this.world.fires.clear();
    }
    if (fireIgnitionRate !== undefined) this.config.hazards.fireIgnitionRate = clamp(Number(fireIgnitionRate), 0, 0.05);
    if (fireSpreadChance !== undefined) this.config.hazards.fireSpreadChance = clamp(Number(fireSpreadChance), 0, 1);
    if (fireDuration !== undefined) this.config.hazards.fireDuration = clamp(Math.round(Number(fireDuration)), 1, 20);
  }

  getStatistics() {
    const ages = this.organisms.map((organism) => organism.age);
    const energies = this.organisms.map((organism) => organism.energy);

    return {
      tick: this.simulationTicks,
      fps: Number(this.fpsEstimate.toFixed(1)),
      population: this.organisms.length,
      births: this.births,
      deaths: this.deaths,
      foodCount: this.world.countTilesByType(TILE_TYPES.FOOD),
      averageAge: Number(average(ages).toFixed(1)),
      oldestOrganism: ages.length ? Math.max(...ages) : 0,
      averageEnergy: Number(average(energies).toFixed(1)),
      bonds: this.bonds.size,
      simulationTime: Number((this.simulationTicks / this.config.simulation.tickRate).toFixed(1))
    };
  }

  getGateCaptureDiagnostics() {
    const released = this.gateFoodCaptureRecords;
    const harvested = released.filter((record) => record.harvest);
    const releaseMembers = harvested.filter((record) => record.harvest.responsibleMemberAtRelease);
    const activeFacetHarvests = harvested.filter((record) => record.harvest.responsibleFacetAtHarvest);
    const competitorHarvests = harvested.filter((record) => !record.harvest.responsibleMemberAtRelease);
    const mean = (values) => values.length ? Number(average(values).toFixed(2)) : 0;
    return {
      released: released.length,
      harvested: harvested.length,
      unharvested: released.length - harvested.length,
      harvestedByResponsibleMemberAtRelease: releaseMembers.length,
      harvestedByResponsibleFacetAtHarvest: activeFacetHarvests.length,
      harvestedByCompetitor: competitorHarvests.length,
      responsibleMemberCaptureFraction: harvested.length ? Number((releaseMembers.length / harvested.length).toFixed(3)) : 0,
      meanHarvestDelayTicks: mean(harvested.map((record) => record.harvest.delayTicks)),
      meanCompetitorDistanceFromResponsibleMember: mean(competitorHarvests.map((record) => record.harvest.distanceFromResponsibleMember).filter(Number.isFinite)),
      recentHarvests: harvested.slice(-20).map((record) => ({
        gateId: record.gateId,
        facetKey: record.facetKey,
        releasedTick: record.releasedTick,
        ...record.harvest
      }))
    };
  }

  getSnapshot() {
    const stateBearers = this.organisms.filter((organism) => organism.genomeProfile.traits.canPersistState);
    const activeStateInputs = this.organisms.reduce((total, organism) => total + (organism.sharedState?.contributors.length ?? 0), 0);
    const facets = this.getFacets();
    const totalFacetReserve = facets.reduce((total, facet) => total + facet.reserve, 0);
    return {
      version: this.snapshotVersion,
      morphologyEnvironment: this.config.bond.adaptiveMorphology?.enabled ? this.morphologyField : null,
      world: {
        width: this.world.width,
        height: this.world.height,
        tiles: this.world.serializeTiles(),
        resources: this.world.serializeResources(),
        foodAmounts: this.world.serializeFoodAmounts(),
        fires: this.world.serializeFires(),
        signals: this.world.serializeSignals(),
        chemistry: this.world.serializeChemistry(),
        environment: this.world.serializeEnvironment()
      },
      bonds: [...this.bonds.values()],
      facets,
      organisms: this.organisms.map((organism) => organism.serialize()),
      controls: {
        paused: this.isPaused,
        speed: this.speed,
        gridEnabled: this.gridEnabled,
        facetTrailEnabled: this.facetTrailEnabled,
        environmentMemoryVisualizationEnabled: this.environmentMemoryVisualizationEnabled,
        speedOptions: this.config.simulation.speedOptions
      },
      settings: {
        foodGrowthRate: this.config.food.growthRate,
        initialPopulation: this.config.organism.initialPopulation,
        universeSeed: this.seed,
        worldNumber: this.worldNumber,
        founderGenome: this.config.organism.founderGenome,
        founderGenomeDecimal: this.genomeEngine.construct(this.config.organism.founderGenome).number
      },
      guidedStructuralIntelligence: {
        ...serializeGuidedInput(this.guidedInput),
        localRadius: this.config.guidedStructuralIntelligence?.localRadius ?? 1,
        sensoryGain: this.config.guidedStructuralIntelligence?.sensoryGain ?? 1,
        adaptiveResponse: {
          ...this.config.guidedStructuralIntelligence?.adaptiveResponse,
          activeTraces: this.organisms.filter((organism) => (organism.guidedResponseTrace ?? 0) > 0.001).length,
          meanTrace: Number(average(this.organisms.map((organism) => organism.guidedResponseTrace ?? 0)).toFixed(3))
        },
        supportedDevelopment: {
          ...this.config.guidedStructuralIntelligence?.supportedDevelopment,
          ...this.guidedSupportStats
        }
      },
      ecology: {
        foodTargetDensity: this.config.world.foodTargetDensity,
        mutationRate: this.config.organism.mutationRate,
        maxPrimePower: 3,
        localFertility: this.config.ecology.localFertilityEnabled,
        averageFertility: Number(average(this.world.fertility.flat()).toFixed(3)),
        resources: this.world.countResources(),
        reproduction: this.getReproductionOpportunity(),
        principle: "Prime strength gains are bounded, diminishing, and carry maintenance costs."
      },
      environment: {
        ...this.config.environment,
        engineeredFertilityCells: this.world.engineeredFertility.flat().filter((value) => value >= this.config.environment.nicheGrowthThreshold).length
      },
      environmentMemory: {
        ...this.config.environmentMemory,
        ...this.world.getEnvironmentMemoryStatistics(this.config.environmentMemory),
        writes: this.environmentMemoryWrites,
        deposited: Number(this.environmentMemoryDeposited.toFixed(3)),
        energySpent: Number(this.environmentMemoryEnergySpent.toFixed(3)),
        lineages: [...this.environmentMemoryLineages.values()].map((lineage) => ({
          ...lineage,
          deposited: Number(lineage.deposited.toFixed(3)),
          energySpent: Number(lineage.energySpent.toFixed(3))
        }))
      },
      collectiveWork: {
        ...this.config.collectiveWork,
        completions: this.collectiveWorkCompletions,
        foodReleased: this.collectiveWorkFoodReleased,
        attendances: this.collectiveWorkAttendances,
        navigationMoves: this.collectiveGateNavigationMoves,
        plumeNavigationMoves: this.collectivePlumeNavigationMoves,
        navigationArrivals: this.collectiveGateArrivals,
        gateDiscovery: {
          ...this.config.collectiveWork.gateDiscovery,
          ...this.gateDiscoveryStats,
          activeTargets: this.gateDiscoveryTargets.size,
          activeReports: this.gateDiscoveryReports.size
        },
        activeAssignments: this.gateFacetAssignments.size,
        satietyMigrationDeferrals: this.satietyMigrationDeferrals,
        activeFields: this.workGates.filter((gate) => gate.fieldStrength > 0).length,
        componentLifecycle: {
          ...this.config.collectiveWork.componentLifecycle,
          ordinaryHarvestDeferrals: this.componentLifecycleDeferrals,
          migrationMoves: this.componentLifecycleMigrations,
          components: [...this.componentLifecycle.values()].map((record) => ({ ...record }))
        },
        fieldHarvests: this.collectiveWorkFieldHarvests,
        fieldHarvestsByWorkers: this.collectiveWorkFieldHarvestsByWorkers,
        fieldHarvestsByOthers: this.collectiveWorkFieldHarvestsByOthers,
        captureDiagnostics: this.getGateCaptureDiagnostics(),
        cycleDiagnostics: this.getGateFieldCycleDiagnostics(),
        componentEpisodeDiagnostics: this.getComponentEpisodeDiagnostics(),
        collectiveCensus: this.getCollectiveCensusDiagnostics(),
        collectiveLineages: this.getCollectiveLineageDiagnostics(),
        harvestingLineages: [...this.collectiveWorkHarvestLineages.values()].sort((first, second) => second.harvests - first.harvests),
        gates: this.workGates.map((gate) => ({
          id: gate.id,
          x: gate.x,
          y: gate.y,
          phase: gate.phase,
          phaseTick: gate.phaseTick,
          progress: gate.progress,
          cooldown: gate.cooldown,
          exhausted: gate.exhausted,
          energyStock: gate.energyStock,
          energyStockCapacity: this.config.collectiveWork.gateEnergyStock,
          energyReleased: gate.energyReleased,
          fieldStartedTick: gate.fieldStartedTick,
          lastFieldLifetime: gate.lastFieldLifetime,
          fieldStrength: Number(gate.fieldStrength.toFixed(2)),
          activeFacet: gate.attendingFacetKey,
          fieldFacetKey: gate.fieldFacetKey,
          assignedFacetKey: [...this.gateFacetAssignments.entries()].find(([, gateId]) => gateId === gate.id)?.[0] ?? null,
          outputMode: this.config.collectiveWork.gateOutputMode,
          ports: this.getGateWorkPorts(gate)
        }))
      },
      courier: {
        ...this.config.courier,
        reportsCreated: this.courierReportsCreated,
        handoffs: this.courierHandoffs,
        activeScouts: this.organisms.filter((organism) => organism.courierReport).length,
        informedBondedMembers: this.organisms.filter((organism) => organism.courierMemory && this.isActivelyBonded(organism.id)).length
      },
      hazards: { ...this.config.hazards },
      signal: { ...this.config.signal },
      bonding: {
        ...this.config.bond,
        foodPantries: {...this.config.bond.foodPantries,...pantrySnapshot(this)},
        adaptiveMorphology: { ...this.config.bond.adaptiveMorphology, ...this.morphologyStats,
          dangerCostPerTick:this.config.bond.adaptiveMorphology.dangerCost,
          demoPhase:this.morphologyDemoPhase??'custom',
          resourcePatches:this.resourcePatchState?{relocations:this.resourcePatchState.relocations,patches:this.resourcePatchState.patches,events:this.resourcePatchState.events}:null,
          genomeTypes:new Set(this.organisms.filter(member=>member.alive).map(member=>JSON.stringify(member.genome))).size,
          colonies:this.getBondGroups().filter(group=>group.length>=3).length,
          largestComponent:Math.max(0,...this.getBondGroups().map(group=>group.length)) },
        harvestMemberSupport: { ...this.config.bond.harvestMemberSupport, ...this.harvestSupportStats },
        neighbourSurplusSupport: { ...this.config.bond.neighbourSurplusSupport, ...this.neighbourSupportStats },
        energyConservation: { ...this.config.bond.energyConservation, memberTicks: this.conservationMemberTicks },
        adaptiveShrinking: { ...this.config.bond.adaptiveShrinking, ...this.shrinkStats },
        usefulWorkReward: { ...this.config.bond.usefulWorkReward },
        resourceFundedSurvival: {
          ...this.config.bond.resourceFundedSurvival
        },
        relayTransfers: this.bondRelayTransfers,
        relayEnergyWithdrawn: Number(this.bondRelayEnergyWithdrawn.toFixed(3)),
        relayEnergyDelivered: Number(this.bondRelayEnergyDelivered.toFixed(3)),
        relayRescues: this.bondRelayRescues,
        componentReserveEconomy: {
          ...this.config.bond.componentReserveEconomy,
          activeReserves: this.componentReserves.size,
          totalReserve: Number([...this.componentReserves.values()].reduce((sum, value) => sum + value, 0).toFixed(3)),
          deposited: Number(this.componentReserveDeposited.toFixed(3)),
          withdrawn: Number(this.componentReserveWithdrawn.toFixed(3)),
          memberSupport: Number(this.componentReserveMemberSupport.toFixed(3)),
          bondFunding: Number(this.componentReserveBondFunding.toFixed(3))
        },
        collectiveMemory: {
          ...this.config.bond.collectiveMemory,
          activeNodeTraces: this.organisms.filter((organism) => organism.nodeTrace > 0.001).length,
          activeBondTraces: [...this.bonds.values()].filter((bond) => (bond.bondTrace ?? 0) > 0.001).length,
          successfulLocations: this.collectiveMemoryLocations.length
        },
        topologyMemory: {
          ...this.config.bond.topologyMemory,
          motifCount: this.topologyMotifs.size,
          consolidatedMotifs: [...this.topologyMotifs.values()].filter((motif) => motif.trace >= this.config.bond.topologyMemory.motifConsolidationThreshold).length,
          roles: { ...this.topologyRoleCounts },
          topologyTraces: [...this.bonds.values()].filter((bond) => (bond.topologyTrace ?? 0) > 0.001).length,
          facetMemory: {
            ...this.config.bond.topologyMemory.facetMemory,
            memoryCount: this.facetMotifMemory.size,
            consolidated: [...this.facetMotifMemory.values()].filter((memory) => memory.trace >= this.config.bond.topologyMemory.facetMemory.consolidationThreshold).length,
            activeFacets: this.getFacets().length
          },
          tetheredScout: {
            ...this.config.bond.topologyMemory.tetheredScout,
            ...this.tetheredScoutDiagnostics,
            episodes: [...this.tetheredScoutEpisodes.values()].slice(-32)
          }
        }
      },
      facetCapital: {
        source: "Extra energy recovered when a strong closed facet harvests a resource.",
        rule: "Capital belongs to the three-member topology and can only seed two inherited bonds for a Prime-31 child.",
        reserveCapacity: this.config.facet.reserveCapacity,
        reserveRequiredForBirth: this.config.facet.reserveRequiredForBirth,
        activeFacets: facets.length,
        fundedFacets: facets.filter((facet) => facet.reserve > 0).length,
        totalReserve: Number(totalFacetReserve.toFixed(1)),
        averageReserve: Number((totalFacetReserve / Math.max(1, facets.length)).toFixed(1))
      },
      autonomousFacetBudding: {
        ...this.config.facet.autonomousBudding,
        births: this.autonomousFacetBirths,
        denials: { ...this.autonomousFacetBuddingDenied },
        ledgers: [...this.facetBuddingLedgers.values()].map((ledger) => ({ ...ledger }))
      },
      topologyProactiveReproduction: {
        ...this.config.bond.topologyMemory.proactiveReproduction,
        births: this.topologyProactiveBirths,
        attempts: this.topologyProactiveBirthAttempts,
        denials: { ...this.topologyProactiveBirthDenied }
      },
      primaryProduction: {
        source: "Fertility-driven resource regrowth",
        latestResourceUnits: this.latestPrimaryProduction,
        totalResourceUnits: this.primaryResourceUnits,
        totalPotentialEnergy: Number(this.primaryPotentialEnergy.toFixed(1))
      },
      energeticEconomics: {
        ...this.energyEconomicsSnapshot(),
        overflowCapture: {
          ...this.config.overflowCapture,
          captured: Number(this.structuralOverflowCaptured.toFixed(3)),
          capturedByMode: { ...this.structuralOverflowCapturedByMode },
          recentRouting: this.overflowRoutingRecords.slice(-30)
        },
        overflowProvenance: this.getOverflowProvenanceDiagnostics()
        ,harvestGeometry: this.getHarvestGeometryDiagnostics()
      },
      energyLogistics: {
        retention: "Per-tick server-side diagnostic series; oldest ticks are pruned after the configured limit.",
        timeSeries: this.energyLogistics.timeSeries,
        starvationDiagnostics: this.starvationDiagnostics
      },
      distributedState: {
        transport: "Prior-tick persistent values travel across one active bond hop.",
        stateBearers: stateBearers.length,
        activeStateInputs,
        bondedStateBearers: stateBearers.filter((organism) => (organism.sharedState?.connectedNeighbors ?? 0) > 0).length
      },
      chemistry: {
        ...this.config.chemistry,
        detritus: Number(this.world.totalMaterial(this.world.detritus).toFixed(1)),
        ash: Number(this.world.totalMaterial(this.world.ash).toFixed(1)),
        nutrients: Number(this.world.totalMaterial(this.world.nutrients).toFixed(1))
        ,deathResidue: Number(this.world.totalMaterial(this.world.deathResidue).toFixed(2)),
        deathResidueCreated: Number(this.deathResidueCreated.toFixed(2)),
        deathResidueRecovered: Number(this.deathResidueRecovered.toFixed(2)),
        overflowPlume: Number(this.world.totalMaterial(this.world.overflowPlume).toFixed(2)),
        overflowPlumeCreated: Number(this.overflowPlumeCreated.toFixed(2)),
        overflowPlumeCondensed: Number(this.overflowPlumeCondensed.toFixed(2)),
        overflowPlumeFoodReleased: this.overflowPlumeFoodReleased
      },
      refinery: {
        enabled: this.config.refinery.enabled,
        candidateTicks: this.config.refinery.candidateTicks,
        activeProcesses: this.refineryProgress.size,
        catalystsHeld: [...this.facetCatalysts.values()].reduce((total, value) => total + value, 0),
        nurseryCredits: [...this.facetNurseryCredits.values()].reduce((total, value) => total + value, 0),
        conversions: this.refineryConversions,
        foodReleased: this.refineryFoodReleased,
        nutrientsProduced: Number(this.refineryNutrientsProduced.toFixed(1)),
        principle: "Red is a low-energy catalyst. Only a maintained strong Prime-31 facet can spend it to convert existing detritus or ash into local food, nutrients, and one structural nursery opportunity."
      },
      telemetry: {
        storage: "In memory only; newest 1,000 events retained (0 bytes written to disk).",
        bondsFormed: this.bondsFormed,
        bondsBroken: this.bondsBroken,
        bondBreakReasons: { ...this.bondBreakReasons },
        facetTransfers: this.facetTransfers,
        facetEnergyShared: Number(this.facetEnergyShared.toFixed(1)),
        facetHarvests: this.facetHarvests,
        facetHarvestEnergy: Number(this.facetHarvestEnergy.toFixed(1)),
        facetHarvestReserveEnergy: Number(this.facetHarvestReserveEnergy.toFixed(1)),
        facetBirths: this.facetBirths,
        autonomousFacetBirths: this.autonomousFacetBirths,
        facetReserveSpent: Number(this.facetReserveSpent.toFixed(1)),
        bondsFed: this.bondsFed,
        bondEnergyFed: Number(this.bondEnergyFed.toFixed(1)),
        bondSupportTransfers: this.bondSupportTransfers,
        bondSupportEnergyReleased: Number(this.bondSupportEnergyReleased.toFixed(1)),
        structuralBirths: this.structuralBirths,
        structuralSeedEnergy: Number(this.structuralSeedEnergy.toFixed(1)),
        collectiveMoves: this.collectiveMoves,
        collectiveResourceDirectedMoves: this.collectiveResourceDirectedMoves,
        refineryConversions: this.refineryConversions,
        refineryFoodReleased: this.refineryFoodReleased,
        refineryNutrientsProduced: Number(this.refineryNutrientsProduced.toFixed(1)),
        collectiveWorkCompletions: this.collectiveWorkCompletions,
        collectiveWorkFoodReleased: this.collectiveWorkFoodReleased,
        collectiveWorkAttendances: this.collectiveWorkAttendances,
        collectiveWorkActiveFields: this.workGates.filter((gate) => gate.fieldStrength > 0).length,
        collectiveWorkFieldHarvests: this.collectiveWorkFieldHarvests,
        collectiveWorkFieldHarvestsByWorkers: this.collectiveWorkFieldHarvestsByWorkers,
        collectiveWorkFieldHarvestsByOthers: this.collectiveWorkFieldHarvestsByOthers,
        courierReportsCreated: this.courierReportsCreated,
        courierHandoffs: this.courierHandoffs,
        recentEvents: this.telemetryEvents.slice(-12).reverse()
      },
      genesis: {
        phase: 15.5,
        layer: "Structural lineage accounting",
        principle: "Prime 31 couples bodies into a topology that can retain harvest capital and spend it only on inheriting that topology.",
        status: "A structural mutation may still lose Prime 31, but it cannot inherit the facet's collective capital."
      },
      generators: this.generatorEngine.serialize(this.worldNumber),
      markers: {
        births: this.birthMarkers,
        deaths: this.deathMarkers,
        energyTransfers: this.energyTransfers,
        primaryProduction: this.primaryProductionMarkers,
        facetWorkTrail: this.facetWorkTrail,
        environmentMemory: this.world.environmentMemory,
        collectiveWork: this.workGates.map((gate) => ({ ...gate }))
      },
      statistics: this.getStatistics()
    };
  }
}
