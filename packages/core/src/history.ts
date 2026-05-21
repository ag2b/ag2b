import type { ChatMessage } from '@/messages';

export class History {
  #messages: ChatMessage[] = [];
  #snapshot: ChatMessage[] = [];
  #listeners = new Set<() => void>();

  /**
   * Subscribe to history changes.
   * Arrow property — safe to pass as a bare reference (no `this` binding loss).
   * @returns unsubscribe function
   */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /**
   * Returns an immutable snapshot of the current messages.
   * Same reference if nothing changed since last mutation.
   * Arrow property — safe to pass as a bare reference.
   */
  getSnapshot = (): ChatMessage[] => {
    return this.#snapshot;
  };

  push(message: ChatMessage) {
    this.#messages.push(message);
    this.#snapshot = [...this.#messages];
    this.#notify();
  }

  /**
   * Clear every message and notify subscribers once.
   *
   * Hazard: calling `reset` while an `Agent.chat()` is in flight is
   * undefined behavior. The next agent-loop iteration will read the
   * mutated (now-empty) snapshot.
   */
  reset() {
    this.#messages = [];
    this.#snapshot = [];
    this.#notify();
  }

  /**
   * Replace the entire history with the provided messages.
   */
  restore(messages: ChatMessage[]) {
    this.#messages = [...messages];
    this.#snapshot = [...this.#messages];
    this.#notify();
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener());
  }
}
