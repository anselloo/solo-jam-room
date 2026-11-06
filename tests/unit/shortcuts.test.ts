import { describe, expect, it } from 'vitest';
import { isActivatable, isTextEntry, shouldHandle } from '../../src/state/shortcuts';

const el = (html: string): Element => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.firstElementChild as Element;
};

describe('shortcut targeting', () => {
  it('detects text entry and activatable elements', () => {
    expect(isTextEntry(el('<input type="text">'))).toBe(true);
    expect(isTextEntry(el('<input type="number">'))).toBe(true);
    expect(isTextEntry(el('<textarea></textarea>'))).toBe(true);
    expect(isTextEntry(el('<select></select>'))).toBe(true);
    expect(isTextEntry(el('<input type="checkbox">'))).toBe(false);
    expect(isTextEntry(el('<input type="range">'))).toBe(false);
    expect(isTextEntry(el('<button>x</button>'))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
    expect(isActivatable(el('<button>x</button>'))).toBe(true);
    expect(isActivatable(el('<a href="#">x</a>'))).toBe(true);
    expect(isActivatable(el('<div role="button"></div>'))).toBe(true);
    expect(isActivatable(el('<p>x</p>'))).toBe(false);
    expect(isActivatable(null)).toBe(false);
  });
  it('only lets Escape through while typing', () => {
    const input = el('<input type="text">');
    expect(shouldHandle('escape', input, 'Escape')).toBe(true);
    expect(shouldHandle('primary', input, ' ')).toBe(false);
    expect(shouldHandle('reroll', input, 'r')).toBe(false);
  });
  it('leaves Space on a focused button to the button itself', () => {
    const button = el('<button>Spin</button>');
    expect(shouldHandle('primary', button, ' ')).toBe(false);
    expect(shouldHandle('primary', button, 'Enter')).toBe(false);
    expect(shouldHandle('reroll', button, 'r')).toBe(true);
    expect(shouldHandle('primary', document.body, ' ')).toBe(true);
    // A remapped pedal key on a button still fires the primary action.
    expect(shouldHandle('primary', button, 'PageDown')).toBe(true);
  });
});

describe('non-element key targets', () => {
  it('treats window and document as neither text entry nor activatable', () => {
    expect(isTextEntry(window)).toBe(false);
    expect(isActivatable(window)).toBe(false);
    expect(isTextEntry(document)).toBe(false);
    expect(shouldHandle('primary', window, ' ')).toBe(true);
  });
});
