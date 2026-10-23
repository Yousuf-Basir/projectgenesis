import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { DEFAULT_CONFIG } from "./simulation/config.js";
import { Simulation } from "./simulation/simulation.js";
import { ExperimentRunner } from "./experiments/experiment-runner.js";
import { GuidedImageTaskRunner } from "./experiments/guided-image-task-runner.js";
import { ReincarnationController } from "./simulation/reincarnation.js";

const serverSessionId = randomUUID();
const simulation = new Simulation(DEFAULT_CONFIG);
const reincarnation = new ReincarnationController({ cycleTicks: 1000, seed: DEFAULT_CONFIG.universe.initialSeed, enabled: true });
const originalSimulationStep = simulation.step.bind(simulation);
simulation.stop();
simulation.step = () => {
  originalSimulationStep();
  reincarnation.observe(simulation);
};
reincarnation.applyRecipe(simulation, reincarnation.chooseRecipe());
simulation.start();
const publicDir = join(process.cwd(), "public");
const experimentRunner = new ExperimentRunner(join(process.cwd(), "data", "experiment-history.json"));
const guidedImageTaskRunner = new GuidedImageTaskRunner({ root: process.cwd() });

// Optional visual bridge for the isolated bonded-memory experiment. It is
// opt-in so normal Genesis ecology remains unchanged.
function configureVisualRelayDemo() {
  simulation.stop();
  simulation.setSeed(160120);
  simulation.stop();
  simulation.organisms = simulation.organisms.slice(0, 3);
  const [sender, relay, receiver] = simulation.organisms;
  const brain = (role) => {
    const source = role === "sender" ? "p19-input" : "p31-neighbor-state";
    return {
      nodes: [
        { id: source, kind: "sensor", prime: role === "sender" ? 19 : 31 },
        { id: "p13-persistence", kind: "persistent", prime: 13 },
        { id: "p19-output", kind: "effector", prime: 19 }
      ],
      edges: [
        { from: source, to: "p13-persistence", weight: 1 },
        { from: "p13-persistence", to: "p13-persistence", weight: 1 },
        { from: "p13-persistence", to: "p19-output", weight: 1 }
      ]
    };
  };
  for (const [organism, role, x] of [[sender, "sender", 10], [relay, "relay", 11], [receiver, "receiver", 12]]) {
    organism.x = x;
    organism.y = 10;
    organism.brain = brain(role);
    organism.energy = 1000;
  }
  const bond = (firstId, secondId) => ({
    firstId, secondId, strength: 1, reserve: 100, bondTrace: 1,
    componentCommitment: 1, topologyTrace: 0, topologyLastPulseTick: null,
    lastPulseTick: null, lastPulseEvent: "visual-relay-demo"
  });
  simulation.bonds.clear();
  simulation.bonds.set(simulation.bondKey(sender.id, relay.id), bond(sender.id, relay.id));
  simulation.bonds.set(simulation.bondKey(relay.id, receiver.id), bond(relay.id, receiver.id));
  simulation.world.addSignal(sender.x, sender.y, 255, 255);
  // Keep the diagnostic scene paused so the relay topology is inspectable, but
  // leave its timer allocated so the normal Resume control can play it.
  simulation.start();
  simulation.pause();
}

if (process.env.GENESIS_VISUAL_RELAY === "1") configureVisualRelayDemo();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, payload) {
  if (payload && typeof payload === "object" && payload.version !== undefined) {
    payload = { ...payload, serverSessionId };
  }
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, { ...simulation.getSnapshot(), reincarnation: reincarnation.snapshot(simulation) });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/experiments") {
    sendJson(response, 200, experimentRunner.snapshot());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/experiments") {
    const body = await readRequestBody(request);
    try {
      const snapshot = body.action === "cancel"
        ? experimentRunner.cancel()
        : await experimentRunner.start(body);
      sendJson(response, 200, snapshot);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Unable to run experiment." });
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/control") {
    const body = await readRequestBody(request);

    switch (body.action) {
      case "pause":
        simulation.pause();
        break;
      case "resume":
        simulation.resume();
        break;
      case "toggle":
        simulation.togglePause();
        break;
      case "step":
        simulation.step();
        break;
      case "reset":
        simulation.reset();
        break;
      case "randomize":
        simulation.randomize();
        break;
      default:
        sendJson(response, 400, { error: "Unknown control action." });
        return true;
    }

    sendJson(response, 200, simulation.getSnapshot());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/settings") {
    const body = await readRequestBody(request);

    if (body.speed !== undefined) {
      simulation.setSpeed(body.speed);
    }

    if (body.foodGrowthRate !== undefined) {
      simulation.setFoodGrowthRate(body.foodGrowthRate);
    }

    if (body.foodTargetDensity !== undefined) {
      simulation.setFoodTargetDensity(body.foodTargetDensity);
    }

    if (body.mutationRate !== undefined) {
      simulation.setMutationRate(body.mutationRate);
    }

    if (body.signalEmissionCost !== undefined) {
      simulation.setSignalEmissionCost(body.signalEmissionCost);
    }

    if (body.initialPopulation !== undefined) {
      simulation.setInitialPopulation(body.initialPopulation);
    }

    if (body.gridEnabled !== undefined) {
      simulation.setGridEnabled(body.gridEnabled);
    }

    if (body.facetTrailEnabled !== undefined) {
      simulation.setFacetTrailEnabled(body.facetTrailEnabled);
    }

    if (body.environmentMemoryVisualizationEnabled !== undefined) {
      simulation.setEnvironmentMemoryVisualizationEnabled(body.environmentMemoryVisualizationEnabled);
    }

    if (body.collectiveMemoryEnabled !== undefined) {
      simulation.setCollectiveMemoryEnabled(body.collectiveMemoryEnabled);
    }

    if (body.guidedStructuralIntelligenceEnabled !== undefined) {
      simulation.setGuidedStructuralIntelligenceEnabled(body.guidedStructuralIntelligenceEnabled);
    }

    if (body.guidedSupportedDevelopmentEnabled !== undefined) {
      simulation.setGuidedSupportedDevelopmentEnabled(body.guidedSupportedDevelopmentEnabled);
    }

    if (body.guidedUnconditionalSupportEnabled !== undefined) {
      simulation.config.guidedStructuralIntelligence.supportedDevelopment.unconditionalSupportEnabled = Boolean(body.guidedUnconditionalSupportEnabled);
    }

    if (body.guidedMovementSuppressionEnabled !== undefined) {
      simulation.config.guidedStructuralIntelligence.supportedDevelopment.suppressMovement = Boolean(body.guidedMovementSuppressionEnabled);
    }

    if (body.resourceFundedSurvivalEnabled !== undefined) {
      simulation.config.bond.resourceFundedSurvival.enabled = Boolean(body.resourceFundedSurvivalEnabled);
    }

    if (body.courierEnabled !== undefined) {
      simulation.setCourierEnabled(body.courierEnabled);
    }

    if (body.universeSeed !== undefined) {
      simulation.setSeed(body.universeSeed);
    }

    if (body.worldNumber !== undefined) {
      try {
        simulation.setWorldNumber(body.worldNumber);
      } catch (error) {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : "Invalid world recipe."
        });
        return true;
      }
    }

    if (body.founderGenome !== undefined) {
      try {
        simulation.setFounderGenome(body.founderGenome);
      } catch (error) {
        sendJson(response, 400, {
          error: error instanceof Error ? error.message : "Invalid founder genome."
        });
        return true;
      }
    }

    if (body.fireEnabled !== undefined || body.fireIgnitionRate !== undefined || body.fireSpreadChance !== undefined || body.fireDuration !== undefined) {
      simulation.setFireSettings(body);
    }

    sendJson(response, 200, simulation.getSnapshot());
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/guided-task") {
    sendJson(response, 200, await guidedImageTaskRunner.load());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/guided-task") {
    const body = await readRequestBody(request);
    try {
      const result = body.action === "start"
        ? await guidedImageTaskRunner.start(body)
        : body.action === "stop" ? guidedImageTaskRunner.stop() : await guidedImageTaskRunner.load();
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Unable to control guided task." });
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/guided-input") {
    const body = await readRequestBody(request);
    try {
      if (body.pattern) simulation.setGuidedPattern(body.pattern);
      if (body.grid) simulation.setGuidedGrid(body.grid, body.source ?? "uploaded");
      if (body.enabled !== undefined) simulation.setGuidedStructuralIntelligenceEnabled(body.enabled);
      sendJson(response, 200, simulation.getSnapshot());
    } catch (error) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : "Invalid guided input." });
    }
    return true;
  }

  sendJson(response, 404, { error: "API route not found." });
  return true;
}

async function serveStatic(request, response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { error: "Forbidden path." });
    return;
  }

  try {
    const fileContents = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    response.end(fileContents);
  } catch (error) {
    sendJson(response, 404, { error: "File not found." });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(request, response, url);
  } catch (error) {
    sendJson(response, 500, {
      error: "Internal server error.",
      detail: error instanceof Error ? error.message : "Unknown error."
    });
  }
});

server.listen(DEFAULT_CONFIG.server.port, DEFAULT_CONFIG.server.host, () => {
  console.log(
    `Project Genesis Phase 3 server running at http://${DEFAULT_CONFIG.server.host}:${DEFAULT_CONFIG.server.port}`
  );
});
