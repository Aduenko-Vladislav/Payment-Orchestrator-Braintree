/**
 * Domain rule: one merchantReference → one payment.
 * Status merging policy:
 *  - Never downgrade SUCCESS to FAILED/PENDING
 *  - Allow upgrade FAILED/PENDING → SUCCESS
 *  - If priorities are equal or lower, keep previous state as-is
 */

export const STATUS_PRIORITY = { PENDING: 1, FAILED: 1, SUCCESS: 2 };

/**
 * @typedef {Object} PaymentState
 * @property {string} merchantReference
 * @property {"PENDING"|"FAILED"|"SUCCESS"} status
 * @property {string} [transactionId]
 * @property {string} [amount]
 * @property {string} [currency]
 * @property {string} [timestamp]
 * @property {any}    [error]
 * @property {string} [updatedAt]
 */

/**
 * Merge previous and incoming states respecting “no downgrade from SUCCESS”.
 * If no change should be applied, returns the previous object as-is (same reference).
 * If an upgrade occurs, returns a new merged object.
 *
 * Why return the same object when unchanged?
 * - Callers can check `const changed = merged !== prev` to detect updates
 *   without having to re-compare fields or run extra logic.
 *
 * @param {PaymentState | undefined} prev
 * @param {PaymentState} incoming
 * @returns {PaymentState}
 */
export function mergedResult(prev, incoming) {
  if (!prev) return incoming;

  const prevP = STATUS_PRIORITY[prev.status] ?? 0;
  const inP = STATUS_PRIORITY[incoming.status] ?? 0;

  if (prev.status === "SUCCESS" && incoming.status !== "SUCCESS") {
    return prev;
  }

  if (inP > prevP) {
    return { ...prev, ...incoming, updatedAt: new Date().toISOString() };
  }

  return prev;
}
