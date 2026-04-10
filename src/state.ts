/**
 * Per-session message counter + mining locks.
 *
 * Tracks how many chat messages have passed per session since the last
 * mining operation, and provides atomic acquire/release semantics to
 * prevent concurrent `mine()` invocations against the same session.
 *
 * Ported from option-K/opencode-plugin-mempalace src/state.ts.
 */
export class StateManager {
  private counts: Map<string, number> = new Map();
  private miningLocks: Map<string, boolean> = new Map();
  private threshold: number;

  constructor(threshold: number = 15) {
    this.threshold = threshold;
  }

  /**
   * Increment the message counter for a session.
   * Returns `true` and resets the counter if the threshold has been reached.
   */
  incrementAndCheck(sessionId: string): boolean {
    const current = this.counts.get(sessionId) ?? 0;
    const next = current + 1;
    if (next >= this.threshold) {
      this.counts.set(sessionId, 0);
      return true;
    }
    this.counts.set(sessionId, next);
    return false;
  }

  /** True if any messages have been counted for this session since the last mine/reset. */
  hasPendingMessages(sessionId: string): boolean {
    return (this.counts.get(sessionId) ?? 0) > 0;
  }

  /** Reset a session's counter to zero (call after a successful mine). */
  resetCount(sessionId: string): void {
    this.counts.set(sessionId, 0);
  }

  /**
   * Returns all session IDs that have pending messages AND are not currently
   * locked for mining. Used by exit handlers to flush unsaved state.
   */
  getDirtySessions(): string[] {
    const dirty: string[] = [];
    for (const [sessionId, count] of this.counts.entries()) {
      if (count > 0 && !this.miningLocks.get(sessionId)) {
        dirty.push(sessionId);
      }
    }
    return dirty;
  }

  /**
   * Attempt to acquire the mining lock for a session.
   * Returns `false` if the lock is already held (another mine is in flight).
   */
  acquireMiningLock(sessionId: string): boolean {
    if (this.miningLocks.get(sessionId)) {
      return false;
    }
    this.miningLocks.set(sessionId, true);
    return true;
  }

  /** Release the mining lock for a session. Safe to call even if not held. */
  releaseMiningLock(sessionId: string): void {
    this.miningLocks.set(sessionId, false);
  }
}
