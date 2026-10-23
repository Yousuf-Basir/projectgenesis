import assert from "node:assert/strict";
import { Simulation } from "../server/simulation/simulation.js";

const simulation = new Simulation();
const originalMaxAge = simulation.config.organism.maxAge;
simulation.setGuidedStructuralIntelligenceEnabled(true);
simulation.setGuidedSupportedDevelopmentEnabled(true);
assert.equal(simulation.config.guidedStructuralIntelligence.supportedDevelopment.enabled, true);
assert.equal(simulation.config.organism.maxAge, Number.MAX_SAFE_INTEGER);
assert.ok(simulation.config.guidedStructuralIntelligence.supportedDevelopment.maintenanceBudgetPerTick > 0);
simulation.setGuidedSupportedDevelopmentEnabled(false);
assert.equal(simulation.config.organism.maxAge, originalMaxAge);
simulation.stop();
console.log("Guided support accounting/configuration checks passed");
