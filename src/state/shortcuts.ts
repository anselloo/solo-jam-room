import { useEffect, useRef } from 'react';
import type { ShortcutAction } from './settings';

export const ACTION_EVENT = 'sjr:action';

/** Fire an action at whichever game/page is listening (primary, reroll, back, escape). */
export function dispatchAction(action: ShortcutAction): void {
  window.dispatchEvent(new CustomEvent<ShortcutAction>(ACTION_EVENT, { detail: action }));
}

/** Subscribe to a shortcut action for the lifetime of a component. */
export function useAction(action: ShortcutAction, handler: () => void): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);
  useEffect(() => {
    const listener = (e: Event) => {
      if ((e as CustomEvent<ShortcutAction>).detail === action) ref.current();
    };
    window.addEventListener(ACTION_EVENT, listener);
    return () => window.removeEventListener(ACTION_EVENT, listener);
  }, [action]);
}

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Elements where typing (or arrow keys) belongs to the control, not to global shortcuts. */
export function isTextEntry(el: EventTarget | null): boolean {
  // Key events can target window or document, which are not elements.
  if (!(el instanceof Element)) return false;
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'range'].includes(el.type);
  }
  return TEXT_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable === true;
}

/** Elements that natively consume Space/Enter as a click. */
export function isActivatable(el: EventTarget | null): boolean {
  if (!(el instanceof Element)) return false;
  return (
    ['BUTTON', 'A', 'SUMMARY'].includes(el.tagName) ||
    el.getAttribute('role') === 'button' ||
    el.getAttribute('role') === 'radio'
  );
}

/**
 * Decide whether a global shortcut should fire for a key press on `target`.
 * Escape always works; typing in fields suppresses everything else; Space/Enter on a focused
 * button keeps its native click instead of triggering the primary action twice.
 */
export function shouldHandle(
  action: ShortcutAction,
  target: EventTarget | null,
  key: string,
): boolean {
  if (action === 'escape') return true;
  if (isTextEntry(target)) return false;
  if (action === 'primary' && isActivatable(target) && (key === ' ' || key === 'Enter')) {
    return false;
  }
  return true;
}
