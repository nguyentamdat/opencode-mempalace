import { beforeEach } from "bun:test";
import { _resetForTesting as resetStateManager } from "./src/shared/state.js";
import { _resetForTesting as resetLogger } from "./src/shared/logger.js";

/**
 * Centralized test setup - runs before each test
 * Resets all stateful modules to ensure test isolation
 */
beforeEach(() => {
  // Reset stateful modules
  resetStateManager?.();
  resetLogger?.();
});
