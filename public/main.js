import { Renderer } from "./renderer.js";

const canvas = document.getElementById("world-canvas");
const statsGrid = document.getElementById("stats-grid");
const statusPill = document.getElementById("status-pill");
const tickCounter = document.getElementById("tick-counter");
const canvasTickCounter = document.getElementById("canvas-tick-counter");
const reincarnationCounter = document.getElementById("reincarnation-counter");
const worldConfigHint = document.getElementById("world-config-hint");
const colonyStatus = document.getElementById('colony-status');
const speedSelect = document.getElementById("speed-select");
const foodGrowthInput = document.getElementById("food-growth");
const foodGrowthValue = document.getElementById("food-growth-value");
const initialPopulationInput = document.getElementById("initial-population");
const initialPopulationValue = document.getElementById("initial-population-value");
const universeSeedInput = document.getElementById("universe-seed");
const worldNumberInput = document.getElementById("world-number");
const founderGenomeInput = document.getElementById("founder-genome");
const toggleGridButton = document.getElementById("toggle-grid");
const generatorStatus = document.getElementById("generator-status");
const generatorList = document.getElementById("generator-list");
const generatorNote = document.getElementById("generator-note");
const recipeExpression = document.getElementById("recipe-expression");
const genomeInspector = document.getElementById("genome-inspector");
const liveBrainTitle = document.getElementById("live-brain-title");
const liveBrainContent = document.getElementById("live-brain-content");
const telemetryPanel = document.getElementById("telemetry-panel");
const ecologyNote = document.getElementById("ecology-note");
const productivityNote = document.getElementById("productivity-note");
const chemistryNote = document.getElementById("chemistry-note");
const fireEnabledInput = document.getElementById("fire-enabled");
const fireIgnitionInput = document.getElementById("fire-ignition");
const fireIgnitionValue = document.getElementById("fire-ignition-value");
const fireSpreadInput = document.getElementById("fire-spread");
const fireSpreadValue = document.getElementById("fire-spread-value");
const foodTargetInput = document.getElementById("food-target");
const foodTargetValue = document.getElementById("food-target-value");
const fireDurationInput = document.getElementById("fire-duration");
const fireDurationValue = document.getElementById("fire-duration-value");
const mutationRateInput = document.getElementById("mutation-rate");
const mutationRateValue = document.getElementById("mutation-rate-value");
const signalCostInput = document.getElementById("signal-cost");
const signalCostValue = document.getElementById("signal-cost-value");
const guideButton = document.getElementById("guide-button");
const guideDialog = document.getElementById("guide-dialog");
const guideCloseButton = document.getElementById("guide-close");
const experimentPanel = document.getElementById("experiment-panel");
const runExperimentsButton = document.getElementById("run-experiments");
const cancelExperimentsButton = document.getElementById("cancel-experiments");
const courierEnabledInput = document.getElementById("courier-enabled");
const facetTrailEnabledInput = document.getElementById("facet-trail-enabled");
const environmentMemoryEnabledInput = document.getElementById("environment-memory-enabled");
const energyEconomicsPanel = document.getElementById("energy-economics-panel");
const guidedInputEnabledInput = document.getElementById("guided-input-enabled");
const guidedSupportEnabledInput = document.getElementById("guided-support-enabled");
const guidedUnconditionalSupportEnabledInput = document.getElementById("guided-unconditional-support-enabled");
const guidedPatternInput = document.getElementById("guided-pattern");
const guidedImageUploadInput = document.getElementById("guided-image-upload");
const guidedInputPreview = document.getElementById("guided-input-preview");
const guidedInputNote = document.getElementById("guided-input-note");
const guidedTaskStart = document.getElementById("guided-task-start");
const guidedTaskStop = document.getElementById("guided-task-stop");
const guidedTaskLoad = document.getElementById("guided-task-load");
const guidedTaskEvaluate = document.getElementById("guided-task-evaluate");
const guidedTaskStatus = document.getElementById("guided-task-status");

const renderer = new Renderer(canvas);
let currentSnapshot = null;
let selectedOrganismId = null;
let snapshotRequestInFlight = false;
let lastRenderedSnapshotVersion = -1;
let lastServerSessionId = null;

function renderGuidedTaskStatus(status) {
  if (!guidedTaskStatus || !status) return;
  const result = status.result;
  const runs = result?.runs ?? [];
  const mean = runs.length ? runs.reduce((sum, run) => sum + Number(run.evaluation?.accuracy ?? 0), 0) / runs.length : null;
  const targetCount = runs.filter((run) => Number(run.evaluation?.accuracy ?? 0) >= 0.8).length;
  guidedTaskStatus.textContent = status.running
    ? `Training running (pid ${status.pid ?? "?"}) · saved artifact will appear at ${status.artifact}`
    : result
      ? `Saved result · ${targetCount}/${runs.length} seeds ≥80% · mean unseen accuracy ${(mean * 100).toFixed(1)}% · controls included`
      : "No benchmark has been run.";
}

async function refreshGuidedTaskStatus() {
  try { renderGuidedTaskStatus(await fetchJson("/api/guided-task")); } catch { /* server may be starting */ }
}

const statLabels = {
  fps: "FPS",
  population: "Population",
  births: "Births",
  deaths: "Deaths",
  foodCount: "Food",
  averageAge: "Avg Age",
  oldestOrganism: "Oldest",
  averageEnergy: "Avg Energy",
  simulationTime: "Sim Time"
  ,bonds: "Bonds"
};

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function renderStats(statistics) {
  statsGrid.innerHTML = "";

  for (const [key, label] of Object.entries(statLabels)) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = statistics[key];
    wrapper.append(dt, dd);
    statsGrid.appendChild(wrapper);
  }
}

function renderGuidedInput(input = {}) {
  if (!guidedInputPreview) return;
  const context = guidedInputPreview.getContext("2d");
  const size = input.size ?? 16;
  const cell = guidedInputPreview.width / size;
  context.clearRect(0, 0, guidedInputPreview.width, guidedInputPreview.height);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = input.grid?.[y]?.[x] ?? 0;
      context.fillStyle = `rgb(${Math.round(value * 255)},${Math.round(value * 255)},${Math.round(value * 255)})`;
      context.fillRect(x * cell, y * cell, cell + 0.2, cell + 0.2);
    }
  }
  context.strokeStyle = "rgba(117, 234, 255, 0.55)";
  context.strokeRect(0.5, 0.5, guidedInputPreview.width - 1, guidedInputPreview.height - 1);
  guidedInputNote.textContent = `Pattern ${input.pattern ?? "blank"} · ${input.source ?? "built-in"} · revision ${input.revision ?? 0} · ${input.enabled ? "active local sensing" : "disabled"} · mean trace ${(input.adaptiveResponse?.meanTrace ?? 0).toFixed(3)} · active traces ${input.adaptiveResponse?.activeTraces ?? 0}`;
}

function renderTelemetry(telemetry, distributedState = {}, facetCapital = {}, refinery = {}, collectiveWork = {}, courier = {}, environmentMemory = {}, energeticEconomics = {}) {
  const latestEnergyInterval = energeticEconomics.intervals?.at(-1);
  const energyExpenses = latestEnergyInterval?.expenses ?? energeticEconomics.expenses ?? {};
  const energyLosses = latestEnergyInterval?.losses ?? energeticEconomics.losses ?? {};
  telemetryPanel.innerHTML = `
    <p class="telemetry-summary">Formed ${telemetry.bondsFormed} | Broken ${telemetry.bondsBroken}</p>
    <p class="telemetry-summary">Facet transfers ${telemetry.facetTransfers ?? 0} | Energy shared ${telemetry.facetEnergyShared ?? 0}</p>
    <p class="telemetry-summary">Facet harvests ${telemetry.facetHarvests ?? 0} | Structural capital earned ${telemetry.facetHarvestEnergy ?? 0}</p>
    <p class="telemetry-summary">Funded facets ${facetCapital.fundedFacets ?? 0}/${facetCapital.activeFacets ?? 0} | Capital held ${facetCapital.totalReserve ?? 0}</p>
    <p class="telemetry-summary">Bonds fed ${telemetry.bondsFed ?? 0} | Structural energy ${telemetry.bondEnergyFed ?? 0}</p>
    <p class="telemetry-summary">Reserve support ${telemetry.bondSupportTransfers ?? 0} transfers | Energy returned ${telemetry.bondSupportEnergyReleased ?? 0}</p>
    <p class="telemetry-summary">Structural births ${telemetry.structuralBirths ?? 0} | Facet births ${telemetry.facetBirths ?? 0} | Capital spent ${telemetry.facetReserveSpent ?? 0}</p>
    <p class="telemetry-summary">Collective moves ${telemetry.collectiveMoves ?? 0} | Resource-scored moves ${telemetry.collectiveResourceDirectedMoves ?? 0}</p>
    <p class="telemetry-summary">Facet refinery ${telemetry.refineryConversions ?? 0} conversions | ${telemetry.refineryFoodReleased ?? 0} food released | ${telemetry.refineryNutrientsProduced ?? 0} nutrients recovered</p>
    <p class="telemetry-summary">Consensus gates ${telemetry.collectiveWorkCompletions ?? 0} completed | ${telemetry.collectiveWorkFoodReleased ?? 0} field food released | ${collectiveWork.activeFields ?? 0} active fields</p>
    <p class="telemetry-summary">Field harvests ${collectiveWork.fieldHarvests ?? 0} | Responsible facet ${collectiveWork.fieldHarvestsByWorkers ?? 0} | Local competitors ${collectiveWork.fieldHarvestsByOthers ?? 0}</p>
    <p class="telemetry-summary">Courier reports ${courier.reportsCreated ?? 0} | Handoffs ${courier.handoffs ?? 0} | Active scouts ${courier.activeScouts ?? 0}</p>
    <p class="telemetry-summary">Environmental memory ${environmentMemory.enabled ? `mean ${(environmentMemory.average ?? 0).toFixed(3)} | coverage ${Math.round((environmentMemory.coverage ?? 0) * 100)}% | writes ${environmentMemory.writes ?? 0}` : "disabled"}</p>
    <p class="telemetry-summary">Energy ledger${latestEnergyInterval ? `, latest ${energeticEconomics.intervalTicks}-tick window` : ""}: food +${latestEnergyInterval?.income?.food ?? energeticEconomics.income?.food ?? 0} | costs -${Object.values(energyExpenses).reduce((total, value) => total + value, 0).toFixed(1)} | unharvested potential ${latestEnergyInterval?.unharvestedPotentialEnergy ?? energeticEconomics.unharvestedPotentialEnergy ?? 0}</p>
    <p class="telemetry-summary">Energy costs: move ${energyExpenses.movement ?? 0} | maintenance ${energyExpenses.maintenance ?? 0} | bonds ${energyExpenses.bonds ?? 0} | memory ${energyExpenses.memory ?? 0} | signals ${energyExpenses.signals ?? 0} | overflow ${energyLosses.capacityOverflow ?? 0} | reproduction allocated ${latestEnergyInterval?.allocations?.reproduction ?? energeticEconomics.allocations?.reproduction ?? 0}</p>
    <p class="telemetry-summary">State bearers ${distributedState.stateBearers ?? 0} | One-hop state inputs ${distributedState.activeStateInputs ?? 0}</p>
    <p class="telemetry-storage">${telemetry.storage}</p>
    <div class="telemetry-events">
      <p class="telemetry-storage">Active bond strength: ${currentSnapshot?.bonds?.length ? (currentSnapshot.bonds.reduce((total, bond) => total + bond.strength, 0) / currentSnapshot.bonds.length).toFixed(2) : "0.00"}</p>
      <p class="telemetry-storage">Active bond reserve: ${currentSnapshot?.bonds?.length ? (currentSnapshot.bonds.reduce((total, bond) => total + (bond.reserve ?? 0), 0) / currentSnapshot.bonds.length).toFixed(2) : "0.00"}</p>
      ${telemetry.recentEvents.length
        ? telemetry.recentEvents.map((event) => `<p><strong>${event.type}</strong> at tick ${event.tick}: ${event.message}</p>`).join("")
        : "<p>No bond events recorded in this experiment yet.</p>"}
    </div>
  `;
}

function renderEnergyEconomics(economics = {}, logistics = {}) {
  const interval = economics.intervals?.at(-1);
  const income = interval?.income ?? economics.income ?? {};
  const expenses = interval?.expenses ?? economics.expenses ?? {};
  const losses = interval?.losses ?? economics.losses ?? {};
  const allocations = interval?.allocations ?? economics.allocations ?? {};
  const logisticsEntry = logistics.timeSeries?.at(-1);
  const total = Math.max(1, ...Object.values(income), ...Object.values(expenses), ...Object.values(losses), ...Object.values(allocations));
  const flow = (label, value, kind) => `<div class="energy-flow ${kind}"><span>${label}</span><i style="width:${Math.max(2, value / total * 100)}%"></i><b>${Number(value ?? 0).toFixed(1)}</b></div>`;
  energyEconomicsPanel.innerHTML = `
    <p class="telemetry-summary">${interval ? `Tick ${interval.tick}; latest ${economics.intervalTicks}-tick window.` : "Accumulating the first accounting window."}</p>
    <div class="energy-flows">
      ${flow("Food income", income.food ?? 0, "income")}
      ${flow("Gate-work income", income.gateWork ?? 0, "income")}
      ${Object.entries(expenses).map(([key, value]) => flow(key, value, "expense")).join("")}
      ${Object.entries(losses).map(([key, value]) => flow(key, value, "expense")).join("")}
      ${Object.entries(allocations).map(([key, value]) => flow(`${key} allocation`, value, "allocation")).join("")}
    </div>
    <p class="telemetry-storage">Unharvested physical food potential: ${interval?.unharvestedPotentialEnergy ?? economics.unharvestedPotentialEnergy ?? 0}. Death causes: ${Object.entries(interval?.deathCauses ?? economics.deathCauses ?? {}).filter(([, value]) => value).map(([key, value]) => `${key} ${value}`).join(" | ") || "none recorded"}.</p>
    <p class="telemetry-storage">Energy distribution: min ${logisticsEntry?.energyDistribution?.minimum ?? 0} | median ${logisticsEntry?.energyDistribution?.median ?? 0} | mean ${logisticsEntry?.energyDistribution?.mean ?? 0} | max ${logisticsEntry?.energyDistribution?.maximum ?? 0} | Gini ${logisticsEntry?.energyDistribution?.gini ?? 0}.</p>`;
}

function renderExperiments(experiments) {
  const status = experiments.status ?? { state: "idle" };
  const latest = experiments.latest;
  runExperimentsButton.disabled = status.state === "running" || status.state === "cancelling";
  cancelExperimentsButton.disabled = status.state !== "running";
  const progress = status.state === "running"
    ? `<p class="experiment-status">Running ${status.scenario}: ${status.completedRuns}/${status.totalRuns} completed, tick ${status.tick}/${status.ticks}</p>`
    : `<p class="experiment-status">${latest ? "Latest screen complete." : "No completed screens yet."}</p>`;
  const summary = latest?.summary?.length
    ? `<div class="experiment-results">${latest.summary.map((result) => `
      <article>
        <strong>${result.label}</strong>
        ${result.meanPopulation !== undefined ? `<span>Population ${result.meanPopulation} | Energy ${result.meanAverageEnergy} | Generation ${result.meanHighestGeneration}</span>` : ""}
        <span>Prime 31 ${Math.round(result.meanP31Frequency * 100)}% | Bonds ${result.meanBonds}</span>
        <span>Facet births ${result.meanFacetBirths} | Extinctions ${result.p31Extinctions}/${result.runs}</span>
        ${result.meanGateCompletions !== undefined ? `<span>Gate attendance ${result.meanGateAttendances} | Completions ${result.meanGateCompletions} | Gate food ${result.meanGateFoodReleased}</span><span>Field harvests ${result.meanGateFieldHarvests} | Workers ${result.meanGateFieldWorkerHarvests} | Competitors ${result.meanGateFieldOtherHarvests}</span>` : ""}
        ${result.meanMemoryAverage !== undefined ? `<span>Memory mean ${result.meanMemoryAverage} | Coverage ${Math.round(result.meanMemoryCoverage * 100)}% | Largest region ${result.meanMemoryLargestRegion}</span><span>Prime 41 ${result.meanP41Carriers} | Prime 43 ${result.meanP43Carriers} | Writes ${result.meanMemoryWrites}</span>` : ""}
        ${result.meanRefineryConversions !== undefined ? `<span>Refinery conversions ${result.meanRefineryConversions} | Food released ${result.meanRefineryFoodReleased}</span>` : ""}
      </article>`).join("")}</div>`
    : "<p class=\"telemetry-storage\">The current batch compares the unmodified ecology with the delayed topology-only refinery.</p>";
  const storage = experiments.storage ?? {};
  experimentPanel.innerHTML = `${progress}${summary}<p class="telemetry-storage">${storage.policy ?? "Aggregate storage pending."} Records: ${storage.records ?? 0}; limit ${Math.round((storage.limitBytes ?? 0) / 1024 / 1024)} MB.</p>`;
}

function renderGenerators(generators) {
  generatorStatus.textContent = generators.status;
  generatorNote.textContent = generators.registryStatus;
  recipeExpression.textContent = generators.composition.expression;
  generatorList.innerHTML = "";

  for (const generator of generators.generators) {
    const item = document.createElement("article");
    item.className = "generator-item";
    item.innerHTML = `
      <span class="prime-badge">${generator.prime}</span>
      <div>
        <h3>Prime ${generator.prime}: ${generator.name}</h3>
        <p>${generator.description}</p>
      </div>
    `;
    generatorList.appendChild(item);
  }
}

function renderGenomeInspector(snapshot) {
  let organism = snapshot.organisms.find((item) => item.id === selectedOrganismId);

  if (!organism && snapshot.organisms.length > 0) {
    organism = snapshot.organisms[0];
    selectedOrganismId = organism.id;
  }

  if (!organism) {
    selectedOrganismId = null;
    genomeInspector.innerHTML = "<p>Select an organism to inspect its genome.</p>";
    return;
  }

  const capabilities = organism.capabilities
    .map((capability) => `<li><strong>${capability.prime}${capability.power > 1 ? `^${capability.power}` : ""}: ${capability.name}</strong> - ${capability.description}</li>`)
    .join("");
  const perception = organism.perception
    ? `
      <h3>Effective World: Prime 17</h3>
      <p class="perception-key">Directional values: 0 means no usable resource; positive values are this genome's local metabolic opportunity.</p>
      <div class="perception-grid">
        ${["nw", "n", "ne", "w", "center", "e", "sw", "s", "se"].map((cell) => `
          <span class="${cell === "center" ? "perception-center" : ""}">${cell === "center" ? "O" : organism.perception[cell]}</span>
        `).join("")}
      </div>`
    : `<h3>Effective World</h3><p>Without Prime 17, this organism perceives only its own energy and food beneath it.</p>`;
  const directionScores = organism.movementDecision?.scores ?? {};
  const directionChoice = organism.movementDecision
    ? `Direction scores: N ${directionScores.N ?? 0} | E ${directionScores.E ?? 0} | S ${directionScores.S ?? 0} | W ${directionScores.W ?? 0} -> ${organism.movementDecision.chosen} (${organism.movementDecision.mode})`
    : "Direction choice: waiting for the next server tick.";
  const collectiveChoice = organism.collectiveDecision
    ? `Collective scores: N ${organism.collectiveDecision.scores.N} | E ${organism.collectiveDecision.scores.E} | S ${organism.collectiveDecision.scores.S} | W ${organism.collectiveDecision.scores.W} -> ${organism.collectiveDecision.chosen}`
    : "Collective direction: not currently in a moving bonded group.";
  const persistentState = organism.persistentState === null
    ? "No Prime-13 persistent state"
    : `Persistent state ${organism.persistentState}`;
  const sharedState = organism.sharedState ?? { connectedNeighbors: 0, contributors: [], mean: 0 };
  const sharedStateDescription = sharedState.contributors.length
    ? `Neighbor state input ${sharedState.mean} from ${sharedState.contributors.map((neighbor) => `#${neighbor.id}: ${neighbor.value}`).join(", ")}`
    : `Neighbor state input 0 (${sharedState.connectedNeighbors} bonded neighbors, none expose Prime-13 state)`;

  genomeInspector.innerHTML = `
    <p class="selected-organism">Organism #${organism.id}, generation ${organism.generation}</p>
    <p class="genome-expression">${organism.genomeExpression}</p>
    <p>Energy ${organism.energy} | Age ${organism.age}</p>
    <p>Guided input ${organism.guidedInputSignal ?? 0} | Response trace ${organism.guidedResponseTrace ?? 0}</p>
    <p>${persistentState}</p>
    <p>${sharedStateDescription}</p>
    <p>${organism.mutation ? `Birth mutation: ${organism.mutation.description}` : "Birth mutation: inherited unchanged."}</p>
    <h3>Generated Capabilities</h3>
    <ul>${capabilities}</ul>
    ${perception}
    <h3>Generated Brain</h3>
    <p class="brain-status">${organism.brain.status}</p>
    <p class="brain-output">Move ${organism.brain.execution?.effectors.move ?? 0} | Consume ${organism.brain.execution?.effectors.consume ?? 0} | Reproduce ${organism.brain.execution?.effectors.reproduce ?? 0}</p>
    <p class="brain-output">${directionChoice}</p>
    <p class="brain-output">${collectiveChoice}</p>
    <div class="brain-graph" id="brain-graph"></div>
  `;

  renderBrainGraph(organism.brain, document.getElementById("brain-graph"));
}

function renderBrainGraph(brain, container) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "xMinYMid meet");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Generated live brain graph");
  const nodesById = new Map(brain.nodes.map((item) => [item.id, item]));

  for (const connection of brain.edges) {
    const from = nodesById.get(connection.from);
    const to = nodesById.get(connection.to);
    const line = document.createElementNS(namespace, "line");
    line.setAttribute("x1", from.x);
    line.setAttribute("y1", from.y);
    line.setAttribute("x2", to.x);
    line.setAttribute("y2", to.y);
    line.setAttribute("class", "brain-edge");
    svg.appendChild(line);
  }

  for (const brainNode of brain.nodes) {
    const group = document.createElementNS(namespace, "g");
    group.setAttribute("class", `brain-node ${brainNode.kind} prime-${brainNode.prime}`);
    const circle = document.createElementNS(namespace, "circle");
    circle.setAttribute("cx", brainNode.x);
    circle.setAttribute("cy", brainNode.y);
    circle.setAttribute("r", "7");
    const nodeValue = brain.execution?.nodeValues[brainNode.id] ?? 0;
    circle.setAttribute("opacity", String(Math.min(1, 0.35 + nodeValue * 0.45)));
    const text = document.createElementNS(namespace, "text");
    text.setAttribute("x", brainNode.x);
    text.setAttribute("y", brainNode.y + 11);
    text.textContent = `${brainNode.label} ${nodeValue}`;
    group.append(circle, text);
    svg.appendChild(group);
  }

  container.replaceChildren(svg);
}

function renderLiveBrain(snapshot) {
  const organism = snapshot.organisms.find((item) => item.id === selectedOrganismId);

  if (!organism) {
    liveBrainTitle.textContent = "Generated Brain";
    liveBrainContent.textContent = "No living organism is currently available to inspect.";
    return;
  }

  liveBrainTitle.textContent = `Organism #${organism.id} Brain: ${organism.genomeExpression}`;
  liveBrainContent.innerHTML = "";
  renderBrainGraph(organism.brain, liveBrainContent);
}

function syncControls(snapshot) {
  if (speedSelect.options.length === 0) {
    for (const speed of snapshot.controls.speedOptions) {
      const option = document.createElement("option");
      option.value = String(speed);
      option.textContent = `${speed}x`;
      speedSelect.appendChild(option);
    }
  }

  speedSelect.value = String(snapshot.controls.speed);
  foodGrowthInput.value = String(snapshot.settings.foodGrowthRate);
  foodGrowthValue.textContent = Number(snapshot.settings.foodGrowthRate).toFixed(2);
  foodTargetInput.value = String(snapshot.ecology.foodTargetDensity);
  foodTargetValue.textContent = Number(snapshot.ecology.foodTargetDensity).toFixed(2);
  mutationRateInput.value = String(snapshot.ecology.mutationRate);
  mutationRateValue.textContent = `${Math.round(snapshot.ecology.mutationRate * 100)}%`;
  signalCostInput.value = String(snapshot.signal.emissionCost);
  signalCostValue.textContent = Number(snapshot.signal.emissionCost).toFixed(2);
  initialPopulationInput.value = String(snapshot.settings.initialPopulation);
  initialPopulationValue.textContent = snapshot.settings.initialPopulation;
  universeSeedInput.value = String(snapshot.settings.universeSeed);
  worldNumberInput.value = String(snapshot.settings.worldNumber);
  founderGenomeInput.value = JSON.stringify(snapshot.settings.founderGenome);
  statusPill.textContent = snapshot.controls.paused ? "Paused" : "Running";
  tickCounter.textContent = `Tick ${snapshot.statistics.tick ?? 0}`;
  canvasTickCounter.textContent = `Tick ${snapshot.statistics.tick ?? 0}`;
  const reincarnation = snapshot.reincarnation;
  if (reincarnationCounter && reincarnation) {
    const recipe = reincarnation.currentRecipe?.name ?? "initializing";
    const lastScore = reincarnation.lastResult?.score;
    reincarnationCounter.textContent = `Cycle ${reincarnation.cycle} · ${recipe}${lastScore === undefined ? "" : ` · score ${lastScore}`}`;
    reincarnationCounter.title = `Automatic world renewal every ${reincarnation.cycleTicks} ticks. ${reincarnation.nextReason}`;
    if (worldConfigHint) {
      const currentRecipe = reincarnation.currentRecipe ?? {};
      const carry = reincarnation.lastCarry;
      const carryText = carry?.members
        ? `carry ${carry.members} members/${carry.bonds ?? 0} bonds`
        : "no carried structure yet";
      const navigation = currentRecipe.navigation ? "navigation on" : "navigation off";
      const discovery = currentRecipe.gateDiscovery ? "gate sensing on" : "gate sensing off";
      worldConfigHint.textContent = `World ${snapshot.settings.worldNumber} · seed ${snapshot.settings.universeSeed} · ${recipe} · ${discovery} · ${navigation} · ${carryText}`;
      const inherited = reincarnation.inheritance;
      if (snapshot.bonding?.adaptiveMorphology?.enabled) worldConfigHint.textContent += ` · adaptive shape · field: ${snapshot.morphologyEnvironment?.source??'initializing'}`;
      if (inherited?.descendants) worldConfigHint.textContent += ` · descendants ${inherited.descendants} (${inherited.mutations} mutations)`;
      const mutation = currentRecipe.mutation;
      worldConfigHint.title = mutation
        ? `Selected from ${currentRecipe.parentRecipe}: ${mutation.parameter} ${mutation.before} → ${mutation.after}. Full history: /api/state.`
        : "Compact live recipe hint; full configuration and cycle history are available from /api/state.";
    }
  }
  const guided = snapshot.guidedStructuralIntelligence ?? {};
  const morphology=snapshot.bonding?.adaptiveMorphology;
  if(colonyStatus) {
    colonyStatus.hidden=!morphology?.enabled;
    if(morphology?.enabled) colonyStatus.textContent=`${morphology.name??'Adaptive world'} · ${morphology.demoPhase??'custom field'} · ${morphology.colonies??0} colonies · largest ${morphology.largestComponent??0} members · ${morphology.moves??0} shape moves · ${morphology.renewalBirths??0} renewal births`;
  }
  guidedInputEnabledInput.checked = Boolean(guided.enabled);
  guidedSupportEnabledInput.checked = Boolean(guided.supportedDevelopment?.enabled);
  guidedUnconditionalSupportEnabledInput.checked = Boolean(guided.supportedDevelopment?.unconditionalSupportEnabled);
  guidedPatternInput.value = ["horizontal-boundary", "vertical-boundary", "closed-outline", "blank"].includes(guided.pattern) ? guided.pattern : "horizontal-boundary";
  renderGuidedInput(guided);
  if (snapshot.morphologyEnvironment) {
    const field=snapshot.morphologyEnvironment;
    renderGuidedInput({grid:field.reward,size:field.size,enabled:true,source:field.source,pattern:'environment'});
    guidedInputNote.textContent=`Environment: ${field.source}. Image brightness supplies reward; red excess marks danger. Rewards replenish from a finite external budget.`;
  }
  const resources = snapshot.ecology.resources ?? {};
  const resourceSummary = `Resources G:${resources.GREEN ?? 0} B:${resources.BLUE ?? 0} R:${resources.RED ?? 0}`;
  const fertilitySummary = snapshot.ecology.localFertility
    ? ` | Mean fertility ${(snapshot.ecology.averageFertility * 100).toFixed(0)}%`
    : "";
  ecologyNote.textContent = `Food target ${(snapshot.ecology.foodTargetDensity * 100).toFixed(0)}% | ${resourceSummary}${fertilitySummary} | Mutation ${(snapshot.ecology.mutationRate * 100).toFixed(0)}% per birth | Reproduction opportunity ${(snapshot.ecology.reproduction.opportunity * 100).toFixed(0)}% | Soft capacity ${snapshot.ecology.reproduction.carryingCapacity}`;
  const productivity = snapshot.primaryProduction ?? {};
  productivityNote.textContent = `Primary productivity: ${productivity.latestResourceUnits ?? 0} resource units this tick | ${productivity.totalResourceUnits ?? 0} since reset | ${productivity.totalPotentialEnergy ?? 0} potential energy created by fertility-driven regrowth.`;
  chemistryNote.textContent = snapshot.chemistry.enabled
    ? `Prime 37 chemistry: detritus ${snapshot.chemistry.detritus} | ash ${snapshot.chemistry.ash} | nutrients ${snapshot.chemistry.nutrients}. ${snapshot.refinery?.enabled ? `Red is a low-energy facet catalyst. Catalyst-poor facets seek red; catalyst-loaded facets seek detritus/ash. They hold ${snapshot.refinery.catalystsHeld} catalysts and ${snapshot.refinery.nurseryCredits} nursery credits; ${snapshot.refinery.conversions} restorations released ${snapshot.refinery.foodReleased} food.` : "Nutrients and recovering fertility support local food regrowth."}`
    : "Prime 37 chemistry is inactive in this world recipe.";
  fireEnabledInput.checked = snapshot.hazards.fireEnabled;
  fireIgnitionInput.value = String(snapshot.hazards.fireIgnitionRate);
  fireIgnitionValue.textContent = Number(snapshot.hazards.fireIgnitionRate).toFixed(3);
  fireSpreadInput.value = String(snapshot.hazards.fireSpreadChance);
  fireSpreadValue.textContent = Number(snapshot.hazards.fireSpreadChance).toFixed(2);
  fireDurationInput.value = String(snapshot.hazards.fireDuration);
  fireDurationValue.textContent = snapshot.hazards.fireDuration;
  courierEnabledInput.checked = snapshot.courier?.enabled ?? false;
  facetTrailEnabledInput.checked = snapshot.controls.facetTrailEnabled ?? true;
  environmentMemoryEnabledInput.checked = snapshot.controls.environmentMemoryVisualizationEnabled ?? true;
  chemistryNote.textContent += ` Couriers ${snapshot.courier?.enabled ? "on" : "off"}: ${snapshot.courier?.activeScouts ?? 0} scouts, ${snapshot.courier?.handoffs ?? 0} handoffs.`;
}

function renderSnapshot(snapshot) {
  currentSnapshot = snapshot;
  syncControls(snapshot);
  renderStats(snapshot.statistics);
  renderTelemetry(snapshot.telemetry, snapshot.distributedState, snapshot.facetCapital, snapshot.refinery, snapshot.collectiveWork, snapshot.courier, snapshot.environmentMemory, snapshot.energeticEconomics);
  renderEnergyEconomics(snapshot.energeticEconomics, snapshot.energyLogistics);
  renderGenerators(snapshot.generators);
  renderGenomeInspector(snapshot);
  renderLiveBrain(snapshot);
  renderer.render(snapshot);
}

async function loadSnapshot() {
  // State snapshots contain the full world and can be expensive to serialize
  // and draw. Keep polling single-flight so a slow response cannot be overtaken
  // by a newer request and rendered out of order.
  if (snapshotRequestInFlight) return;
  snapshotRequestInFlight = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4000);
  try {
    const snapshot = await fetchJson("/api/state", { signal: controller.signal });
    if (snapshot.serverSessionId && snapshot.serverSessionId !== lastServerSessionId) {
      lastServerSessionId = snapshot.serverSessionId;
      lastRenderedSnapshotVersion = -1;
    }
    const version = Number(snapshot.version ?? 0);
    if (version >= lastRenderedSnapshotVersion) {
      lastRenderedSnapshotVersion = version;
      renderSnapshot(snapshot);
    }
  } catch (error) {
    statusPill.textContent = "Connection Error";
  } finally {
    window.clearTimeout(timeout);
    snapshotRequestInFlight = false;
  }
}

async function loadExperiments() {
  try {
    renderExperiments(await fetchJson("/api/experiments"));
  } catch (error) {
    experimentPanel.innerHTML = "<p>Experiment service unavailable.</p>";
  }
}

async function postJson(url, payload) {
  const snapshot = await fetchJson(url, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  renderSnapshot(snapshot);
  return snapshot;
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    postJson("/api/control", { action: button.dataset.action });
  });
});

toggleGridButton.addEventListener("click", () => {
  postJson("/api/settings", {
    gridEnabled: !currentSnapshot?.controls.gridEnabled
  });
});

guideButton.addEventListener("click", () => guideDialog.showModal());
guideCloseButton.addEventListener("click", () => guideDialog.close());
guideDialog.addEventListener("click", (event) => {
  if (event.target === guideDialog) guideDialog.close();
});

runExperimentsButton.addEventListener("click", async () => {
  await fetchJson("/api/experiments", { method: "POST", body: JSON.stringify({ action: "start", replicates: 3, ticks: 1000 }) });
  loadExperiments();
});

cancelExperimentsButton.addEventListener("click", async () => {
  await fetchJson("/api/experiments", { method: "POST", body: JSON.stringify({ action: "cancel" }) });
  loadExperiments();
});

speedSelect.addEventListener("change", () => {
  postJson("/api/settings", { speed: Number(speedSelect.value) });
});

foodGrowthInput.addEventListener("input", () => {
  foodGrowthValue.textContent = Number(foodGrowthInput.value).toFixed(2);
});

foodGrowthInput.addEventListener("change", () => {
  postJson("/api/settings", { foodGrowthRate: Number(foodGrowthInput.value) });
});

foodTargetInput.addEventListener("change", () => {
  postJson("/api/settings", { foodTargetDensity: Number(foodTargetInput.value) });
});
foodTargetInput.addEventListener("input", () => {
  foodTargetValue.textContent = Number(foodTargetInput.value).toFixed(2);
});
mutationRateInput.addEventListener("input", () => {
  mutationRateValue.textContent = `${Math.round(Number(mutationRateInput.value) * 100)}%`;
});
mutationRateInput.addEventListener("change", () => {
  postJson("/api/settings", { mutationRate: Number(mutationRateInput.value) });
});
signalCostInput.addEventListener("input", () => {
  signalCostValue.textContent = Number(signalCostInput.value).toFixed(2);
});
signalCostInput.addEventListener("change", () => {
  postJson("/api/settings", { signalEmissionCost: Number(signalCostInput.value) });
});

initialPopulationInput.addEventListener("input", () => {
  initialPopulationValue.textContent = initialPopulationInput.value;
});

initialPopulationInput.addEventListener("change", () => {
  postJson("/api/settings", { initialPopulation: Number(initialPopulationInput.value) });
});

universeSeedInput.addEventListener("change", () => {
  postJson("/api/settings", { universeSeed: Number(universeSeedInput.value) });
});

worldNumberInput.addEventListener("change", () => {
  postJson("/api/settings", { worldNumber: Number(worldNumberInput.value) }).catch(() => {
    worldNumberInput.value = String(currentSnapshot.settings.worldNumber);
  });
});

founderGenomeInput.addEventListener("change", () => {
  const value = founderGenomeInput.value.trim();
  const founderGenome = value.startsWith("{") ? JSON.parse(value) : Number(value);
  postJson("/api/settings", { founderGenome }).catch(() => {
    founderGenomeInput.value = JSON.stringify(currentSnapshot.settings.founderGenome);
  });
});

fireEnabledInput.addEventListener("change", () => postJson("/api/settings", { fireEnabled: fireEnabledInput.checked }));
fireIgnitionInput.addEventListener("change", () => postJson("/api/settings", { fireIgnitionRate: Number(fireIgnitionInput.value) }));
fireSpreadInput.addEventListener("change", () => postJson("/api/settings", { fireSpreadChance: Number(fireSpreadInput.value) }));
fireDurationInput.addEventListener("change", () => postJson("/api/settings", { fireDuration: Number(fireDurationInput.value) }));
courierEnabledInput.addEventListener("change", () => postJson("/api/settings", { courierEnabled: courierEnabledInput.checked }));
facetTrailEnabledInput.addEventListener("change", () => postJson("/api/settings", { facetTrailEnabled: facetTrailEnabledInput.checked }));
environmentMemoryEnabledInput.addEventListener("change", () => postJson("/api/settings", { environmentMemoryVisualizationEnabled: environmentMemoryEnabledInput.checked }));
guidedInputEnabledInput.addEventListener("change", () => postJson("/api/settings", { guidedStructuralIntelligenceEnabled: guidedInputEnabledInput.checked }));
guidedSupportEnabledInput.addEventListener("change", () => postJson("/api/settings", { guidedSupportedDevelopmentEnabled: guidedSupportEnabledInput.checked }));
guidedUnconditionalSupportEnabledInput.addEventListener("change", () => postJson("/api/settings", { guidedUnconditionalSupportEnabled: guidedUnconditionalSupportEnabledInput.checked }));
guidedPatternInput.addEventListener("change", () => postJson("/api/guided-input", { pattern: guidedPatternInput.value }));
guidedImageUploadInput.addEventListener("change", () => {
  const file = guidedImageUploadInput.files?.[0];
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    const scratch = document.createElement("canvas");
    scratch.width = 16; scratch.height = 16;
    const context = scratch.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 16, 16);
    const pixels = context.getImageData(0, 0, 16, 16).data;
    const grid = Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
      const offset = (y * 16 + x) * 4;
      return Number(((pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255).toFixed(4));
    }));
    if (currentSnapshot?.bonding?.adaptiveMorphology?.enabled) {
      const danger=Array.from({length:16},(_,y)=>Array.from({length:16},(_,x)=>{
        const offset=(y*16+x)*4;
        return Math.max(0,(pixels[offset]-Math.max(pixels[offset+1],pixels[offset+2]))/255);
      }));
      postJson('/api/environment-field',{reward:grid,danger,source:file.name});
    } else postJson("/api/guided-input", { grid, source: file.name });
  };
  image.src = URL.createObjectURL(file);
});
guidedTaskStart?.addEventListener("click", async () => {
  const status = await postJson("/api/guided-task", { action: "start" });
  renderGuidedTaskStatus(status);
});
guidedTaskStop?.addEventListener("click", async () => {
  const status = await postJson("/api/guided-task", { action: "stop" });
  renderGuidedTaskStatus(status);
});
guidedTaskLoad?.addEventListener("click", refreshGuidedTaskStatus);
guidedTaskEvaluate?.addEventListener("click", refreshGuidedTaskStatus);
fireIgnitionInput.addEventListener("input", () => { fireIgnitionValue.textContent = Number(fireIgnitionInput.value).toFixed(3); });
fireSpreadInput.addEventListener("input", () => { fireSpreadValue.textContent = Number(fireSpreadInput.value).toFixed(2); });
fireDurationInput.addEventListener("input", () => { fireDurationValue.textContent = fireDurationInput.value; });

canvas.addEventListener("click", (event) => {
  const organism = renderer.findOrganismAt(event.clientX, event.clientY);
  selectedOrganismId = organism?.id ?? null;
  if (currentSnapshot) {
    renderGenomeInspector(currentSnapshot);
  }
});

loadSnapshot();
loadExperiments();
refreshGuidedTaskStatus();
// A complete canvas/world redraw is intentionally throttled. The simulation
// continues at its configured speed while the UI samples it at a stable rate.
const snapshotPollIntervalMs = 500;
const scheduleSnapshotPoll = () => {
  window.setTimeout(async () => {
    await loadSnapshot();
    scheduleSnapshotPoll();
  }, snapshotPollIntervalMs);
};
scheduleSnapshotPoll();
setInterval(loadExperiments, 1000);
setInterval(refreshGuidedTaskStatus, 2000);
