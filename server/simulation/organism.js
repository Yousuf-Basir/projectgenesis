import { DEFAULT_CONFIG, DIRECTIONS, RESOURCE_TYPES, TILE_TYPES } from "./config.js";
import { clamp, hueToColor, randomChoice } from "./utils.js";
import { sampleGuidedInput } from "./guided-input.js";

function resourceYield(resource, strengths) {
  const digestion = strengths[5] ?? 0;
  const energy = strengths[3] ?? 0;
  const signal = strengths[19] ?? 0;

  if (resource === RESOURCE_TYPES.BLUE) return 0.55 + energy * 0.25 + digestion * 0.2;
  // Red is catalytic material: modest alone, ecologically valuable when a strong facet can retain it.
  if (resource === RESOURCE_TYPES.RED) return 0.15 + signal * 0.1 + digestion * 0.1;
  return 0.55 + digestion * 0.45;
}

export class Organism {
  constructor({
    id,
    x,
    y,
    generation = 1,
    lineageId = id,
    parentId = null,
    energy = DEFAULT_CONFIG.organism.startingEnergy,
    age = 0,
    genomeProfile,
    brain,
    brainExecution = null,
    mutation = null,
    hue,
    direction,
    random,
    nodeTrace = 0,
    lastPulseTick = null,
    memoryEvent = null,
    memoryLocation = null,
    memoryRepeats = 0
  }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.random = random;
    this.direction = direction ?? randomChoice(DIRECTIONS, this.random);
    this.energy = energy;
    this.age = age;
    this.generation = generation;
    this.lineageId = lineageId;
    this.parentId = parentId;
    this.genome = genomeProfile.genome;
    this.genomeProfile = genomeProfile;
    this.brain = brain;
    this.brainExecution = brainExecution;
    this.mutation = mutation;
    this.perception = null;
    this.hue = hue ?? Math.floor(this.random() * 360);
    this.color = hueToColor(this.hue);
    this.alive = true;
    this.deathReason = null;
    this.movementDecision = null;
    this.lastConsumedResource = null;
    this.sharedState = { connectedNeighbors: 0, contributors: [], mean: 0 };
    this.collectiveDecision = null;
    this.nodeTrace = nodeTrace;
    this.lastPulseTick = lastPulseTick;
    this.memoryEvent = memoryEvent;
    this.memoryLocation = memoryLocation;
    this.memoryRepeats = memoryRepeats;
    this.guidedInputSignal = 0;
    this.guidedResponseTrace = 0;
    this.guidedResponseActivity = 0;
    this.collectiveStrideActive = false;
    this.collectiveTransportActive = false;
    this.satietyMigrationActive = false;
    this.courierReport = null;
    this.courierMemory = null;
    this.energyLedger = {
      income: { food: 0, gateWork: 0 },
      expenses: { movement: 0, maintenance: 0, perception: 0, bonds: 0, bondReserveMaintenance: 0, gateWork: 0, memory: 0, signals: 0, idle: 0 },
      losses: { capacityOverflow: 0, deathStoredEnergy: 0 },
      allocations: { reproduction: 0, structuralSeed: 0, structuralOverflow: 0, bondFunding: 0 }
    };
  }

  chooseRandomDirection() {
    this.direction = randomChoice(DIRECTIONS, this.random);
    return this.direction;
  }

  chooseGraphDirection(world, occupiedKeys, memoryDirectionScores = null) {
    const scores = this.brainExecution?.effectors.direction ?? {};
    const legalDirections = DIRECTIONS.filter((candidate) => {
      const target = world.wrapPosition(this.x + candidate.x, this.y + candidate.y);
      return world.isWalkable(target.x, target.y) && !occupiedKeys.has(`${target.x},${target.y}`);
    });
    if (!legalDirections.length) {
      this.movementDecision = { mode: "graph", chosen: this.direction.name, scores };
      return this.direction;
    }

    const combinedScores = Object.fromEntries(legalDirections.map((candidate) => [candidate.name,
      (scores[candidate.name] ?? 0) + (memoryDirectionScores?.[candidate.name] ?? 0)]));
    const strongestScore = Math.max(...legalDirections.map((candidate) => combinedScores[candidate.name] ?? 0));
    const strongestDirections = legalDirections.filter((candidate) => (combinedScores[candidate.name] ?? 0) === strongestScore);
    // Keeping the current heading on a tie avoids adding a hidden random movement rule.
    const chosen = strongestDirections.find((candidate) => candidate.name === this.direction.name) ?? strongestDirections[0];
    this.direction = chosen;
    this.movementDecision = { mode: "graph", chosen: chosen.name, scores: combinedScores };
    return chosen;
  }

  getPersistentState() {
    if (!this.genomeProfile.traits.canPersistState) return null;
    const value = Number(this.brainExecution?.persistentState?.["p13-persistence"]);
    return Number.isFinite(value) ? clamp(value, 0, 1.8) : null;
  }

  act({ world, occupiedKeys, config, ecologyConfig, signalConfig, environmentMemoryConfig, guidedInput = null, guidedInputConfig = {}, brainExecutor, coupled, collectiveStrideMultiplier = 1, deferOrdinaryHarvest = false, harvestRestraint = null, neighborStates = [], structuralFocus = null, collectiveWorkCue = 0, collectiveWorkFields = [], courierTarget = null, memoryDirectionScores = null, energyConservation = null, stationaryOperatingMultiplier = 1 }) {
    let consumedEnergy = 0;
    let consumedResource = null;
    const energyFlow = { income: { food: 0, gateWork: 0 }, expenses: { movement: 0, maintenance: 0, perception: 0, bonds: 0, bondReserveMaintenance: 0, gateWork: 0, memory: 0, signals: 0, idle: 0 }, losses: { capacityOverflow: 0, deathStoredEnergy: 0 } };
    if (world.isBurning(this.x, this.y)) {
      this.alive = false;
      this.deathReason = "fire";
      return { consumedEnergy };
    }

    const currentTile = world.getTile(this.x, this.y);
    const contributors = neighborStates.filter((neighbor) => Number.isFinite(neighbor.value));
    const neighborState = contributors.length
      ? contributors.reduce((total, neighbor) => total + neighbor.value, 0) / contributors.length
      : 0;
    this.sharedState = {
      connectedNeighbors: neighborStates.length,
      contributors: contributors.map((neighbor) => ({ id: neighbor.id, value: Number(neighbor.value.toFixed(2)) })),
      mean: Number(neighborState.toFixed(2))
    };
    const terrainSignal = DIRECTIONS.filter((candidate) => {
      const position = world.wrapPosition(this.x + candidate.x, this.y + candidate.y);
      return !world.isWalkable(position.x, position.y);
    }).length / DIRECTIONS.length;
    const neighborhoodDirections = [
      ["nw", -1, -1], ["n", 0, -1], ["ne", 1, -1], ["w", -1, 0],
      ["e", 1, 0], ["sw", -1, 1], ["s", 0, 1], ["se", 1, 1]
    ];
    const guidedSignal = sampleGuidedInput(guidedInput, this.x, this.y, world.width, world.height, guidedInputConfig.localRadius ?? 0);
    this.guidedInputSignal = Number(guidedSignal.toFixed(3));
    const tileSignal = (x, y) => {
      const tile = world.getTile(x, y);
      let courierOpportunity = 0;
      if (courierTarget) {
        const distance = (fromX, fromY) => {
          const xDistance = Math.abs(fromX - courierTarget.x);
          const yDistance = Math.abs(fromY - courierTarget.y);
          const wrappedX = world.wraps ? Math.min(xDistance, world.width - xDistance) : xDistance;
          const wrappedY = world.wraps ? Math.min(yDistance, world.height - yDistance) : yDistance;
          return Math.max(wrappedX, wrappedY);
        };
        const currentDistance = distance(this.x, this.y);
        const nextDistance = distance(x, y);
        if (nextDistance < currentDistance) courierOpportunity = Math.min(1.25, (currentDistance - nextDistance) * 1.25);
      }
      // The value is metabolic opportunity for this organism, not a global ordering of resource colors.
      let fieldOpportunity = 0;
      if (structuralFocus === "gate-field") {
        fieldOpportunity = Math.max(0, ...collectiveWorkFields.map((field) => {
          const xDistance = Math.abs(x - field.x);
          const yDistance = Math.abs(y - field.y);
          const wrappedX = world.wraps ? Math.min(xDistance, world.width - xDistance) : xDistance;
          const wrappedY = world.wraps ? Math.min(yDistance, world.height - yDistance) : yDistance;
          const distance = Math.max(wrappedX, wrappedY);
          return distance <= field.radius ? field.strength * (1 - distance / (field.radius + 1)) * 1.25 : 0;
        }));
      }
      const localImage = sampleGuidedInput(guidedInput, x, y, world.width, world.height, 0)
        * (guidedInputConfig.sensoryGain ?? 1);
      if (tile.type === TILE_TYPES.FOOD) {
        if (structuralFocus === "catalyst" && tile.resource === RESOURCE_TYPES.RED) return 1.8;
        return Math.max(courierOpportunity + fieldOpportunity + resourceYield(tile.resource, this.genomeProfile.powers), localImage);
      }
      if (structuralFocus === "material") return courierOpportunity + fieldOpportunity + Math.min(1.8, world.materialAt(x, y) * 1.8);
      return Math.max(courierOpportunity + fieldOpportunity, localImage);
    };
    this.perception = this.genomeProfile.traits.canSenseNeighborhood
      ? Object.fromEntries(neighborhoodDirections.map(([id, dx, dy]) => [id, tileSignal(this.x + dx, this.y + dy)]))
      : null;
    this.brainExecution = brainExecutor.execute(this.brain, {
      "p3-energy": this.energy / (config.reproductionThreshold / (this.genomeProfile.powers[7] ?? 1)),
      "p5-food": currentTile.type === TILE_TYPES.FOOD ? 1 : 0,
      "p11-terrain": terrainSignal,
      "p19-input": world.getSignal(this.x, this.y) / 255 * 8 + collectiveWorkCue,
      "p31-neighbor-state": neighborState,
      "p43-environment-memory": this.genomeProfile.traits.canReadEnvironment && environmentMemoryConfig.enabled
        ? world.readEnvironmentMemory(this.x, this.y)
        : 0,
      ...Object.fromEntries(Object.entries(this.perception ?? {}).map(([id, value]) => [`p17-${id}`, value]))
    }, this.brainExecution?.persistentState);

    const adaptiveResponse = guidedInputConfig.adaptiveResponse ?? {};
    if (guidedInput?.enabled && adaptiveResponse.enabled !== false) {
      const learningRate = clamp(Number(adaptiveResponse.traceLearningRate ?? 0.22), 0, 1);
      const maximumTrace = Math.max(0, Number(adaptiveResponse.maximumTrace ?? 1));
      this.guidedResponseTrace = clamp(
        this.guidedResponseTrace * (1 - learningRate) + guidedSignal * learningRate,
        0,
        maximumTrace
      );
    } else {
      const decayRate = clamp(Number(adaptiveResponse.traceDecayRate ?? 0.94), 0, 1);
      this.guidedResponseTrace *= decayRate;
    }
    this.guidedResponseActivity = Number(this.guidedResponseTrace.toFixed(3));
    if (guidedInput?.enabled && adaptiveResponse.enabled !== false) {
      this.brainExecution.effectors.bind = clamp(
        this.brainExecution.effectors.bind + this.guidedResponseTrace * Number(adaptiveResponse.bindGain ?? 0.65),
        0,
        8
      );
      this.brainExecution.effectors.signal = clamp(
        this.brainExecution.effectors.signal + this.guidedResponseTrace * Number(adaptiveResponse.signalGain ?? 0.35),
        0,
        8
      );
    }

    const supportedDevelopment = guidedInputConfig.supportedDevelopment ?? {};
    const movementAllowed = !energyConservation && !(supportedDevelopment.enabled && supportedDevelopment.suppressMovement);
    const shouldMove = movementAllowed && !coupled && this.brainExecution.effectors.move >= 0.05;
    const direction = shouldMove
      ? (this.genomeProfile.traits.canSenseNeighborhood
        ? this.chooseGraphDirection(world, occupiedKeys, memoryDirectionScores)
        : this.chooseRandomDirection())
      : this.direction;
    if (shouldMove && !this.genomeProfile.traits.canSenseNeighborhood) {
      this.movementDecision = { mode: "random-fallback", chosen: direction.name, scores: {} };
    }
    const target = world.wrapPosition(this.x + direction.x, this.y + direction.y);
    const targetKey = `${target.x},${target.y}`;
    const canMove = shouldMove
      && world.isWalkable(target.x, target.y)
      && !occupiedKeys.has(targetKey);

    this.age += 1;
    const strengths = this.genomeProfile.powers;
    const amplifiedGenes = [3, 5, 7]
      .reduce((total, prime) => total + Math.max(0, (strengths[prime] ?? 0) - 1), 0);
    const maintenanceCost = amplifiedGenes * config.genomeMaintenancePerStrength
      + ((strengths[13] ?? 0) * config.persistenceMaintenance);
    const perceptionCost = (strengths[17] ?? 0) * config.perceptionMaintenance;
    const couplingCost = coupled ? config.couplingMaintenance : 0;

    const movementCost = config.moveCost * collectiveStrideMultiplier * (energyConservation?.operatingCostMultiplier ?? 1)
      * (canMove ? 1 : stationaryOperatingMultiplier);
    this.energy -= movementCost + maintenanceCost + perceptionCost + couplingCost;
    energyFlow.expenses.movement += movementCost;
    energyFlow.expenses.maintenance += maintenanceCost;
    energyFlow.expenses.perception += perceptionCost;
    energyFlow.expenses.bonds += couplingCost;

    let memoryWrite = null;
    if (environmentMemoryConfig.enabled && this.genomeProfile.traits.canWriteEnvironment) {
      const requested = clamp(this.brainExecution.effectors.environmentWrite, 0, 1);
      const requestedCost = requested * environmentMemoryConfig.writeEnergyCost;
      const paidCost = Math.min(Math.max(0, this.energy), requestedCost);
      const paidFraction = requestedCost > 0 ? paidCost / requestedCost : 0;
      const deposited = world.writeEnvironmentMemory(this.x, this.y, requested * paidFraction * environmentMemoryConfig.writeGain);
      this.energy -= paidCost;
      energyFlow.expenses.memory += paidCost;
      memoryWrite = { requested, paidCost, deposited };
    }

    const signalOutput = this.brainExecution.effectors.signal;
    if (!energyConservation && signalOutput > signalConfig.activationThreshold) {
      const intensity = clamp(
        (signalOutput - signalConfig.activationThreshold) / (8 - signalConfig.activationThreshold) * signalConfig.maxIntensity,
        0,
        signalConfig.maxIntensity
      );
      world.addSignal(this.x, this.y, intensity, signalConfig.maxIntensity);
      const signalCost = intensity / signalConfig.maxIntensity * signalConfig.emissionCost;
      this.energy -= signalCost;
      energyFlow.expenses.signals += signalCost;
    }

    if (canMove) {
      this.x = target.x;
      this.y = target.y;
    } else if (!coupled && movementAllowed) {
      this.energy -= config.idleCost;
      energyFlow.expenses.idle += config.idleCost;
    }

    const harvestAttempt = this.brainExecution.effectors.consume >= 0.5 && currentTile.type === TILE_TYPES.FOOD;
    const availableFoodAmount = harvestAttempt ? Math.max(0, Math.min(1, currentTile.foodEnergy ?? 1)) : 0;
    const unitMealEnergy = harvestAttempt ? config.foodEnergy * resourceYield(currentTile.resource ?? RESOURCE_TYPES.GREEN, this.genomeProfile.powers) : 0;
    const projectedMealEnergy = unitMealEnergy * availableFoodAmount;
    const energyCapacity = config.reproductionThreshold * 1.8 * (this.genomeProfile.powers[3] ?? 1) * (config.energyCapacityMultiplier ?? 1);
    const wouldOverflowHarvest = harvestAttempt && this.energy + projectedMealEnergy > energyCapacity;
    const restraintApplies = Boolean(harvestRestraint?.enabled)
      && (!harvestRestraint.ordinaryFoodOnly || currentTile.foodOrigin?.type !== "gate-field");
    const deferredHarvest = harvestAttempt
      && currentTile.type === TILE_TYPES.FOOD
      && deferOrdinaryHarvest
      && currentTile.foodOrigin?.type !== "gate-field";
    const restrainedHarvest = harvestAttempt && restraintApplies && wouldOverflowHarvest;
    const partialHarvesting = Boolean(ecologyConfig.partialHarvesting?.enabled);
    const requestedFoodAmount = partialHarvesting
      ? Math.min(availableFoodAmount, Math.max(0, energyCapacity - this.energy) / Math.max(1e-9, unitMealEnergy))
      : availableFoodAmount;
    const harvestDecision = harvestAttempt ? {
      origin: currentTile.foodOrigin?.type ?? "ordinary-food",
      resource: currentTile.resource ?? RESOURCE_TYPES.GREEN,
      energyBeforeHarvest: this.energy,
      energyCapacity,
      projectedMealEnergy,
      wouldOverflow: wouldOverflowHarvest,
      reproductionEligibleBeforeHarvest: this.canReproduce(config),
      restrained: restrainedHarvest,
      deferredForMigration: deferredHarvest,
      availableFoodAmount,
      requestedFoodAmount
    } : null;
    if (harvestAttempt && requestedFoodAmount > 0.000001 && !deferredHarvest && !restrainedHarvest) {
      const harvested = world.harvestFood(currentTile.x, currentTile.y, ecologyConfig, requestedFoodAmount);
      if (harvested) {
        consumedEnergy = config.foodEnergy * resourceYield(harvested.resource, this.genomeProfile.powers) * harvested.amount;
        harvestDecision.harvestedAmount = harvested.amount;
        harvestDecision.remainingFoodAmount = harvested.remainingAmount;
        harvestDecision.partial = harvested.remainingAmount > 0;
        this.energy += consumedEnergy;
        energyFlow.income[harvested.foodOrigin?.type === "gate-field" ? "gateWork" : "food"] += consumedEnergy;
        consumedResource = harvested.resource;
        this.lastConsumedResource = harvested.resource;
        return this.finishAct({
          consumedEnergy,
          consumedResource,
          consumedFoodOrigin: harvested.foodOrigin,
          overflowContext: { phase: "harvest", origin: harvested.foodOrigin?.type ?? "ordinary-food", resource: harvested.resource },
          memoryWrite, harvestDecision,
          energyFlow
        }, config);
      }
    }

    return this.finishAct({ consumedEnergy, consumedResource, deferredHarvest, restrainedHarvest, harvestDecision, overflowContext: { phase: "metabolic", origin: "none", resource: null }, memoryWrite, energyFlow }, config);
  }

  finishAct(result, config) {
    const energyCapacity = config.reproductionThreshold * 1.8 * (this.genomeProfile.powers[3] ?? 1) * (config.energyCapacityMultiplier ?? 1);
    result.overflowEnergy = Math.max(0, this.energy - energyCapacity);
    result.energyFlow.losses.capacityOverflow += result.overflowEnergy;
    this.energy = clamp(this.energy, 0, energyCapacity);
    for (const [kind, values] of Object.entries(result.energyFlow ?? {})) {
      for (const [key, value] of Object.entries(values)) this.energyLedger[kind][key] += value;
    }
    if (this.age >= config.maxAge) {
      this.alive = false;
      this.deathReason = "maximum age";
    }
    return result;
  }

  canReproduce(config) {
    return this.alive
      && this.brainExecution?.effectors.reproduce >= 1
      && this.energy >= config.reproductionThreshold / (1 + ((this.genomeProfile.powers[7] ?? 1) - 1) * 0.25);
  }

  reproduce(newId, childPosition, config, { genomeEngine, brainGenerator, mutationEngine }) {
    const energyBefore = this.energy;
    const sharedEnergy = this.energy * config.reproductionCostFactor;
    this.energy = sharedEnergy;
    this.energyLedger.allocations.reproduction += Math.max(0, energyBefore - sharedEnergy);
    const mutation = this.random() < config.mutationRate
      ? mutationEngine.mutate(this.genome, this.random, config.mutationPrimes)
      : null;
    const childGenomeProfile = genomeEngine.construct(mutation?.after ?? this.genome);

    return new Organism({
      id: newId,
      x: childPosition.x,
      y: childPosition.y,
      generation: this.generation + 1,
      lineageId: this.lineageId,
      parentId: this.id,
      energy: sharedEnergy,
      genomeProfile: childGenomeProfile,
      brain: brainGenerator.generate(childGenomeProfile),
      hue: mutation ? this.hue + (this.random() - 0.5) * config.mutationHueJitter : this.hue,
      direction: randomChoice(DIRECTIONS, this.random),
      random: this.random,
      mutation
    });
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      direction: this.direction.name,
      energy: Number(this.energy.toFixed(2)),
      age: this.age,
      generation: this.generation,
      lineageId: this.lineageId,
      parentId: this.parentId,
      genome: this.genome,
      genomeDecimal: this.genomeProfile.number,
      genomeExpression: this.genomeProfile.expression,
      capabilities: this.genomeProfile.capabilities,
      brain: {
        ...this.brain,
        execution: this.brainExecution
      },
      mutation: this.mutation,
      perception: this.perception,
      morphologyPreferences: this.morphologyPreferences ?? {},
      lastMorphologyDirection: this.lastMorphologyDirection ?? null,
      persistentState: this.getPersistentState(),
      sharedState: this.sharedState,
      lastConsumedResource: this.lastConsumedResource,
      signalOutput: Number((this.brainExecution?.effectors.signal ?? 0).toFixed(2)),
      movementDecision: this.movementDecision,
      guidedInputSignal: this.guidedInputSignal ?? 0,
      guidedResponseTrace: this.guidedResponseTrace ?? 0,
      guidedResponseActivity: this.guidedResponseActivity ?? 0,
      nodeTrace: Number(this.nodeTrace.toFixed(3)),
      lastPulseTick: this.lastPulseTick,
      memoryEvent: this.memoryEvent,
      memoryLocation: this.memoryLocation,
      memoryRepeats: this.memoryRepeats,
      collectiveDecision: this.collectiveDecision,
      collectiveStrideActive: this.collectiveStrideActive,
      collectiveTransportActive: this.collectiveTransportActive,
      satietyMigrationActive: this.satietyMigrationActive,
      courierReport: this.courierReport,
      courierMemory: this.courierMemory,
      energyLedger: structuredClone(this.energyLedger),
      color: this.color
    };
  }
}
