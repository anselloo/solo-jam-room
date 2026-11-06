/** localStorage wrapper that never throws and falls back to defaults when storage is unavailable. */

const PREFIX = 'sjr:';

export function loadJson<T>(key: string, fallback: T, validate?: (v: unknown) => T | null): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate) return validate(parsed) ?? fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Returns false when the write failed (private mode, quota, disabled storage). */
export function saveJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage unavailable: nothing to remove */
  }
}
