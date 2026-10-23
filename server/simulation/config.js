export const TILE_TYPES = {
  EMPTY: "EMPTY",
  FOOD: "FOOD",
  WALL: "WALL"
};

export const RESOURCE_TYPES = {
  GREEN: "GREEN",
  BLUE: "BLUE",
  RED: "RED"
};

export const DIRECTIONS = [
  { x: 0, y: -1, name: "N" },
  { x: 1, y: 0, name: "E" },
  { x: 0, y: 1, name: "S" },
  { x: -1, y: 0, name: "W" }
];

export const BASE_CONFIG = {
  server: {
    host: "0.0.0.0",
    port: 3000
  },
  universe: {
    // A seed makes every Phase 1 experiment reproducible and inspectable.
    initialSeed: 160103,
    worldNumber: 85470
  },
  world: {
    width: 64,
    height: 64,
    wraps: false,
    wallChance: 0,
    initialFoodChance: 0,
    foodTargetDensity: 0
  },
  simulation: {
    tickRate: 5,
    snapshotFrequency: 5,
    speedOptions: [1, 2, 5, 10, 50],
    defaultSpeed: 1
  },
  organism: {
    initialPopulation: 24,
    founderGenome: { 2: 1, 3: 1, 5: 1, 7: 1, 13: 1, 17: 1, 19: 1, 31: 1 },
    startingEnergy: 0,
    maxAge: 0,
    moveCost: 0,
    idleCost: 0,
    foodEnergy: 0,
    reproductionThreshold: 0,
    reproductionCostFactor: 0,
    // Experimental multiplier; the live ecology remains at one normal energy store.
    energyCapacityMultiplier: 1,
    mutationHueJitter: 0,
    mutationRate: 0,
    genomeMaintenancePerStrength: 0,
    persistenceMaintenance: 0,
    perceptionMaintenance: 0
    ,couplingMaintenance: 0.1
  },
  food: {
    growthRate: 0,
    maxGrowthAttemptsPerTick: 0
  },
  hazards: {
    fireEnabled: false,
    fireIgnitionRate: 0.002,
    fireSpreadChance: 0.18,
    fireDuration: 7,
    fireMaxActive: 24
  },
  signal: {
    decay: 0.65,
    emissionCost: 0.1,
    activationThreshold: 0.35,
    maxIntensity: 120
  },
  chemistry: {
    enabled: false,
    foodDecayRate: 0,
    detritusToNutrients: 0,
    ashToNutrients: 0,
    nutrientGrowthBoost: 0,
    nutrientCostPerFood: 0,
    recoveryAttemptsPerMissingFood: 0,
    maxRecoveryAttempts: 0
    ,deathResidueEnabled: false,
    deathResidueFraction: 0.08,
    deathResidueMaximum: 8,
    deathResidueDecay: 0.04,
    deathResidueRecoveryRate: 0.7,
    deathResidueRecoveryEfficiency: 0.7,
    deathResidueSenseRadius: 2,
    // Experimental: harvest overflow can become a visible, short-lived environmental charge.
    overflowPlumeEnabled: false,
    overflowPlumeFraction: 0.15,
    overflowPlumeMaximum: 40,
    overflowPlumeDecay: 0.5,
    overflowPlumeSenseRadius: 2,
    overflowPlumeEnergyPerFood: 40,
    overflowPlumeNavigation: {
      enabled: false,
      detectionRadius: 8,
      directionBias: 0.8
    }
  },
  refinery: {
    // Red is a low-energy catalyst. Prime-31 facets spend it to recover existing chemical material.
    enabled: false,
    minimumMaterial: 0.6,
    candidateTicks: 12,
    nutrientYield: 0.65,
    catalystCapacity: 3,
    nurseryCreditCapacity: 2
  },
  environment: {
    // Maintained facets create a bounded local primary-production gradient.
    // It is environmental state, never an organism energy transfer.
    engineeredFertilityDecay: 0.006,
    engineeredFertilityReinforcement: 0.08,
    engineeredFertilityMaximum: 0.8,
    nicheGrowthAttemptsPerTick: 0,
    nicheGrowthThreshold: 0.25,
    nicheGrowthRate: 0
  },
  environmentMemory: {
    // Phase 16: neutral, server-owned scalar state. It has no ecological interpretation.
    enabled: true,
    decayRate: 0.9995,
    diffusionRate: 0.01,
    writeEnergyCost: 0.12,
    writeGain: 0.18,
    coverageThreshold: 0.05,
    regionThreshold: 0.12
  },
  guidedStructuralIntelligence: {
    // Package A: explicitly supported, local image input. Disabled so the
    // historical ecology remains a direct regression control.
    enabled: false,
    gridSize: 16,
    localRadius: 1,
    sensoryGain: 1.5,
    adaptiveResponse: {
      enabled: true,
      traceLearningRate: 0.22,
      traceDecayRate: 0.94,
      maximumTrace: 1,
      bindGain: 0.65,
      signalGain: 0.35
    },
    supportedDevelopment: {
      enabled: false,
      unconditionalSupportEnabled: false,
      conditionalSupportEnabled: true,
      maintenanceBudgetPerTick: 192,
      memberSupportPerTick: 8,
      bondReservePerTick: 0.12,
      emergencyBudgetPerTick: 0.25,
      supportCreditPerPulse: 1.5,
      supportCreditDecay: 0.985,
      maximumSupportCredits: 48,
      repairWindowTicks: 12,
      suppressMovement: false,
      preserveExistingBonds: true,
      populationCap: 48,
      connectionCap: 96,
      connectionCapPerComponent: 48
    }
  },
  energeticEconomics: {
    // Observation only: these intervals never alter organism behavior or world physics.
    intervalTicks: 100,
    maximumIntervals: 40,
    maximumTimeSeriesTicks: 5000
  },
  collectiveWork: {
    enabled: true,
    gateCount: 7,
    gateRadius: 3,
    observeTicks: 8,
    responseTicks: 8,
    requiredConsensusTicks: 2,
    // Consensus is a shared state band, not an exact floating-point recall task.
    consensusTolerance: 0.45,
    gateFieldMaximum: 1,
    gateFieldDecay: 0.035,
    gateFieldFoodRate: 0.36,
    // Kept separate from diffuse output so port-coupled ecology can be calibrated without changing its control.
    gatePortFoodRate: 0.9,
    // A completed gate must pay its first maintenance interval before its gradual field can accumulate.
    gateStartupFoodUnits: 1,
    // Each gate is a finite local opportunity. Stock is spent only when physical food is released.
    gateEnergyStock: 18,
    gateExhaustionCooldownTicks: 140,
    // Experimental field-local accounting boundary. Physical gate food remains open to every harvester.
    prioritizeResponsibleFacetEnergy: false,
    gateFieldSenseRadius: 5,
    navigation: {
      // Experimental: only a strong closed facet receives this shared, non-forcing directional cue.
      enabled: true,
      detectionRadius: 14,
      directionBias: 0.8,
      minimumFacetStrength: 0.7
    },
    gateDiscovery: {
      // Local, switchable gate reports exchanged through nearby contacts/bonds.
      enabled: true,
      detectionRadius: 10,
      maximumHops: 4,
      pulseAttenuationPerHop: 0.82,
      reportTtlTicks: 36,
      minimumReports: 2,
      minimumConfidence: 0.35,
      confidenceDecay: 0.96
    },
    collectiveStride: {
      // Experimental logistics mechanism: an intact gate-seeking component avoids redundant individual locomotion.
      // It reduces only the already-paid movement cost; it never creates or transfers energy.
      enabled: true,
      movementCostMultiplier: 0.65,
      minimumMembers: 3
    },
    satietyMigration: {
      // Experimental harvest restraint: an energy-secure component leaves ordinary food for a sensed gate opportunity.
      enabled: false,
      minimumMeanEnergyFraction: 0.72
    },
    componentLifecycle: {
      // Experimental collective logistics: a facet may conserve at its own
      // weakening field for a bounded interval, then release that commitment
      // and use the existing local gate-navigation cue to migrate.
      enabled: true,
      depletionFieldStrength: 0.25,
      maxDwellTicksAfterDepletion: 18,
      conserveMinimumMeanEnergyFraction: 0.55
    },
    migrationTransport: {
      // Experimental physical logistics: a coherent strong component shares
      // displacement during the explicit migration phase. This reduces only
      // its existing movement charge; it does not add or transfer energy.
      enabled: true,
      movementCostMultiplier: 0.4,
      minimumMembers: 3,
      minimumFacetStrength: 0.7
    },
    collectiveCensus: {
      // Observation only: samples raw component topology and economics before
      // any longitudinal identity matching is introduced.
      enabled: true,
      cadenceTicks: 20,
      maximumRecords: 1200,
      minimumFacetStrength: 0.7,
      // The browser uses full topology. Headless longitudinal batches can
      // request lightweight evidence without changing the simulated world.
      detailLevel: "full",
      lightweightBondSampleLimit: 64,
      // Exact all-pairs paths become needlessly expensive in very large
      // components. Larger components use a deterministic sample of sources.
      topologyPathSourceLimit: 48
    },
    collectiveLineageTracking: {
      // Observation only: conservative matching of consecutive census samples.
      // Ambiguous split/merge evidence never becomes a forced continuation.
      enabled: true,
      minimumScore: 0.62,
      minimumMemberContinuity: 0.5,
      spatialContinuityDistance: 12,
      maximumLineages: 500,
      maximumEvents: 1000,
      maximumHistoryPerLineage: 120
    },
    // Food is produced at the three visible gate ports while the responsible facet remains intact.
    // "diffuse" is retained only as the matched experimental control.
    gateOutputMode: "port-coupled"
  },
  courier: {
    // Mobile Prime-19/13 scouts can carry rare gate-state information to bonded compounds.
    enabled: false,
    highEnergyThreshold: 90,
    maxActiveScouts: 3,
    observationRadius: 5,
    reportLifetime: 24,
    reportInterval: 6,
    handoffRadius: 2,
    handoffEnergyCost: 0.15
  },
  ecology: {
    reproductionFoodUnitsPerOrganism: 0,
    reproductionHabitatFraction: 0,
    maximumReproductionOpportunity: 0,
    localFertilityEnabled: false,
    fertilityRecoveryPerTick: 0,
    fertilityLossPerHarvest: 0,
    minimumFertilityForGrowth: 0
    ,harvestRestraint: {
      // Experimental: a forager leaves an ordinary meal in place when the whole meal cannot fit in its store.
      enabled: false,
      ordinaryFoodOnly: true
    },
    partialHarvesting: {
      // Experimental: a food tile retains any part of its energy that the current consumer cannot store.
      enabled: false
    }
  },
  facet: {
    // Closed bond triangles retain collective harvest capital for structural reproduction.
    sharingFraction: 0.3,
    minimumBondStrength: 0.45,
    harvestBonusFraction: 0.16,
    reserveCapacity: 30,
    reserveRequiredForBirth: 4,
    reserveInvestmentPerBirth: 4,
    autonomousBudding: {
      // Experimental: an energized strong facet can reproduce its local triangular motif without an individual brain impulse.
      enabled: false,
      reserveThreshold: 14,
      memberEnergyFloor: 110,
      // Budgeted mode is a separate hypothesis: a component may grow only after
      // it has demonstrated a positive completed gate-to-gate energy cycle.
      requirePositiveCompletedCycle: false,
      minimumComponentEnergy: 0,
      minimumCycleEnergyDelta: 0,
      completedCycleFreshnessTicks: 0,
      cooldownTicks: 0
    }
  },
  bond: {
    // A meal should keep a maintained structure viable long enough to find its next resource.
    reserveCapacity: 10,
    initialReserve: 3,
    mealEnergyFraction: 0.18,
    maintenancePerTick: 0.04,
    repairPerTick: 0.025,
    starvationStrengthDecay: 0.03,
    supportThreshold: 24,
    supportReserveFloor: 1.5,
    maxSupportReleasePerTick: 0.35,
    supportLossFraction: 0.15,
    // Experimental default: ordinary support runs first; this is only an emergency one-hop fallback.
    relayEnabled: true,
    relayCriticalEnergy: 2,
    maxRelayPerTick: 0.5,
    relayLossFraction: 0.2,
    surplusFirstEnergy: {
      enabled: false
    },
    // Resource-funded comparison mode: physical harvest may fund local
    // component reserves, while the legacy guided support wallet is bypassed.
    resourceFundedSurvival: {
      enabled: false,
      // These are bounded physical-transfer limits, not generated energy.
      harvestContributionFraction: 0.2,
      memberSupportTransferPerTick: 1.2,
      maintenanceTransferPerTick: 0.6
    },
    dormantBonds: {
      enabled: true,
      maintenanceMultiplier: 0.2,
      wakeRadius: 6,
      minimumReserve: 0.5,
      wakeOnFood: true,
      wakeOnGate: true
    },
    componentReserveEconomy: {
      enabled: true,
      contributionFraction: 0.08,
      maximumReserve: 24,
      maintenanceTransferPerTick: 0.3,
      reserveDecayPerTick: 0.01,
      minimumComponentSize: 3,
      reproductionReserve: 8,
      reproductionReserveFraction: 0.35,
      memberSupportTransferPerTick: 0.45,
      // A funded edge can bridge a short binding-drive dip, never bypassing
      // adjacency or its local energy requirement.
      commitmentEnabled: true,
      commitmentGainPerEnergy: 0.5,
      commitmentDecayRate: 0.94,
      commitmentThreshold: 0.12,
      commitmentReserveFloor: 0.5
    },
    usefulWorkReward: {
      enabled: false,
      commitmentPerEnergy: 0.04,
      maximumGainPerBondPerTick: 0.08
    },
    adaptiveShrinking: {
      enabled: false,
      minimumRemainingMembers: 3,
      minimumSamples: 8,
      forecastTicks: 30,
      cooldownTicks: 80,
      recoveryEfficiency: 0.65
    },
    energyConservation: {
      enabled: false,
      entryEnergyMultiplier: 2,
      exitEnergyMultiplier: 3,
      decliningTicks: 8,
      periodTicks: 10,
      probeTicks: 2,
      operatingCostMultiplier: 0.35
    },
    neighbourSurplusSupport: {
      enabled: false,
      donorSharingEnabled: false,
      reserveRelayEnabled: true,
      maximumHops: 4,
      targetEnergy: 6,
      maximumWithdrawalPerMemberPerTick: 1.5,
      efficiency: 0.85
    },
    harvestMemberSupport: {
      enabled: false,
      maximumMealFraction: 0.25,
      efficiency: 0.98
    },
    adaptiveMorphology: {
      enabled: false,
      alignedBudgetsEnabled: false,
      learningEnabled: true,
      reshapingEnabled: true,
      collectiveMovementInterval: 5,
      environmentNavigationBias: 0,
      fieldSensingEnabled: true,
      dangerNavigationBias: 0,
      fieldDemoEnabled: false,
      resourcePatchesEnabled: false,
      patchCapacity: 240,
      smoothFieldSensing: false,
      stockSensingWeight: 0,
      scarcitySensingEnabled: false,
      fieldHarvestRoutingEnabled: false,
      reshapeMinimumGain: 0.02,
      renewalEnabled: false,
      paidFormationEnabled: false,
      maximumDegree: 4,
      stationaryOperatingMultiplier: 0.25,
      edgeFlow: 0.75,
      flowEfficiency: 0.98,
      fieldBudgetPerTick: 4,
      cellCapacity: 12,
      maximumFieldHarvest: 0.8,
      dangerCost: 2
    },
    collectiveMemory: {
      enabled: false,
      maximumHops: 6,
      traceDecayRate: 0.985,
      pulseAttenuationPerHop: 0.78,
      reinforcementStrength: 0.08,
      maximumTrace: 1,
      maximumMovementBias: 0.18,
      inheritanceFraction: 0.12,
      consolidationThreshold: 2,
      maximumLocationRecords: 128
    },
    topologyMemory: {
      enabled: true,
      maximumHops: 12,
      pulseAttenuationPerHop: 0.82,
      traceDecayRate: 0.985,
      reinforcementStrength: 0.06,
      maximumTrace: 1,
      motifConsolidationThreshold: 0.35,
      motifReinforcement: 0.08,
      motifForgettingRate: 0.99,
      maximumMotifs: 256,
      motifMaintenanceBias: 0.18,
      edgeCommitmentThreshold: 0.08,
      stableTicksRequired: 12,
      reproductionReserve: 8,
      inheritanceFraction: 0.12,
      inheritanceNoise: 0.02,
      proactiveReproduction: {
        enabled: true,
        reserveThreshold: 8,
        postBirthReserve: 3,
        reserveInvestment: 1,
        memberEnergyFloor: 6,
        cooldownTicks: 160,
        maxBirthsPerTick: 1,
        maxTotalBirths: 8
      },
      facetMemory: {
        enabled: true,
        maximumTrace: 1,
        traceDecayRate: 0.985,
        reinforcementStrength: 0.1,
        consolidationThreshold: 0.35,
        stableTicksRequired: 8,
        maintenanceBias: 0.12
      },
      tetheredScout: {
        enabled: true,
        maximumExcursionTicks: 24,
        leashRadius: 2,
        energyFloor: 6,
        minimumCoreSize: 3,
        minimumCoreBonds: 4,
        minimumCoreCycleRank: 1,
        minimumCoreStrength: 0.65,
        minimumCoreReserve: 6,
        elasticEnabled: false,
        excursionMovementCost: 0.15,
        returnPulseStrength: 0.9,
        returnReserveFraction: 0.12,
        departureProbability: 0.08,
        minimumComponentReserve: 3,
        returnCooldownTicks: 24
      }
    },
    buddingReserveInvestment: 1.2,
    buddingCandidateTicks: 3
  },
  overflowCapture: {
    // Experimental only. The live ecology discards overflow unless a matched screen enables a mode.
    mode: "disabled",
    captureFraction: 0.75,
    transferEfficiency: 0.85
  },
  render: {
    background: "#08131a",
    grid: "#16303b",
    empty: "#0d1c23",
    food: "#73f0a8",
    wall: "#31414a"
  }
};

// Phase 2 generators construct the concrete physics used by the server.
export const DEFAULT_CONFIG = DEFAULT_GENERATOR_ENGINE.generate(
  BASE_CONFIG,
  BASE_CONFIG.universe.worldNumber
).config;
import { DEFAULT_GENERATOR_ENGINE } from "./generator-engine.js";
