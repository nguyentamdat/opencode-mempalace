import { describe, it, expect, beforeEach } from "bun:test";
import { StateManager } from "../src/state.js";

describe("StateManager", () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  describe("constructor", () => {
    it("should use default threshold of 15 when not specified", () => {
      const sm = new StateManager();
      for (let i = 0; i < 14; i++) {
        sm.incrementAndCheck("test-session");
      }
      expect(sm.incrementAndCheck("test-session")).toBe(true);
    });

    it("should use custom threshold when specified", () => {
      const sm = new StateManager(5);
      for (let i = 0; i < 4; i++) {
        sm.incrementAndCheck("test-session");
      }
      expect(sm.incrementAndCheck("test-session")).toBe(true);
    });
  });

  describe("incrementAndCheck", () => {
    it("should increment counter and return false before threshold", () => {
      expect(stateManager.incrementAndCheck("session-1")).toBe(false);
      expect(stateManager.incrementAndCheck("session-1")).toBe(false);
    });

    it("should reset counter and return true at threshold", () => {
      for (let i = 0; i < 14; i++) {
        stateManager.incrementAndCheck("session-1");
      }
      expect(stateManager.incrementAndCheck("session-1")).toBe(true);
    });

    it("should reset counter after threshold is reached", () => {
      for (let i = 0; i < 15; i++) {
        stateManager.incrementAndCheck("session-1");
      }
      expect(stateManager.incrementAndCheck("session-1")).toBe(false);
    });

    it("should track different sessions independently", () => {
      stateManager.incrementAndCheck("session-1");
      stateManager.incrementAndCheck("session-1");
      stateManager.incrementAndCheck("session-2");
      expect(stateManager.hasPendingMessages("session-1")).toBe(true);
      expect(stateManager.hasPendingMessages("session-2")).toBe(true);
    });
  });

  describe("hasPendingMessages", () => {
    it("should return false for unknown session", () => {
      expect(stateManager.hasPendingMessages("unknown-session")).toBe(false);
    });

    it("should return true for session with pending messages", () => {
      stateManager.incrementAndCheck("session-1");
      expect(stateManager.hasPendingMessages("session-1")).toBe(true);
    });
  });

  describe("resetCount", () => {
    it("should reset counter to zero", () => {
      stateManager.incrementAndCheck("session-1");
      stateManager.incrementAndCheck("session-1");
      stateManager.resetCount("session-1");
      expect(stateManager.hasPendingMessages("session-1")).toBe(false);
    });
  });

  describe("getDirtySessions", () => {
    it("should return empty array when no sessions have pending messages", () => {
      expect(stateManager.getDirtySessions()).toEqual([]);
    });

    it("should return session IDs with pending messages", () => {
      stateManager.incrementAndCheck("session-1");
      stateManager.incrementAndCheck("session-2");
      const dirty = stateManager.getDirtySessions();
      expect(dirty).toContain("session-1");
      expect(dirty).toContain("session-2");
      expect(dirty).toHaveLength(2);
    });

    it("should not include sessions with mining lock held", () => {
      stateManager.incrementAndCheck("session-1");
      stateManager.incrementAndCheck("session-2");
      stateManager.acquireMiningLock("session-1");
      const dirty = stateManager.getDirtySessions();
      expect(dirty).not.toContain("session-1");
      expect(dirty).toContain("session-2");
    });
  });

  describe("acquireMiningLock", () => {
    it("should return true when acquiring a free lock", () => {
      expect(stateManager.acquireMiningLock("session-1")).toBe(true);
    });

    it("should return false when lock is already held", () => {
      stateManager.acquireMiningLock("session-1");
      expect(stateManager.acquireMiningLock("session-1")).toBe(false);
    });
  });

  describe("releaseMiningLock", () => {
    it("should release the lock for a session", () => {
      stateManager.acquireMiningLock("session-1");
      stateManager.releaseMiningLock("session-1");
      expect(stateManager.acquireMiningLock("session-1")).toBe(true);
    });
  });
});
