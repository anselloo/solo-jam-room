export const ANNOUNCE_EVENT = 'sjr:announce';

/** Politely announce a result to screen readers, e.g. "Key: D, Mode: Dorian, Tempo: 96". */
export function announce(message: string): void {
  window.dispatchEvent(new CustomEvent<string>(ANNOUNCE_EVENT, { detail: message }));
}
