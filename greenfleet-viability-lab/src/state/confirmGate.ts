/**
 * Destructive actions (reset, replace with demo) never run directly. They go through a gate:
 * `request()` only marks the action as pending; nothing happens until `confirm()`.
 * Framework-free so the rule can be tested without a browser.
 */
export interface ConfirmGate {
  readonly pending: boolean;
  request(): void;
  confirm(): boolean;
  cancel(): void;
}

export function createConfirmGate(action: () => void): ConfirmGate {
  let pending = false;
  return {
    get pending() {
      return pending;
    },
    request() {
      pending = true;
    },
    confirm() {
      if (!pending) return false;
      pending = false;
      action();
      return true;
    },
    cancel() {
      pending = false;
    },
  };
}
