/**
 * Recursively strips undefined values from objects to prevent Firestore errors.
 * Firestore does not accept undefined values - they must be either omitted or set to null.
 * 
 * @param obj - The object to strip undefined values from
 * @returns A new object with all undefined values removed
 */
export function deepStripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepStripUndefined) as T;
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = deepStripUndefined(v);
  }
  return out;
}