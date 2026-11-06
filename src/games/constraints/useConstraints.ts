import { useCallback, useEffect, useRef, useState } from 'react';
import { useTransport } from '../../audio/transport';
import { announce } from '../../components/announce';
import { History } from '../../random/deck';
import { createRng, type Rng } from '../../random/rng';
import { playerInstruments } from '../../state/profile';
import { loadJson, saveJson } from '../../state/storage';
import { useApp } from '../../state/AppState';
import {
  CATEGORIES,
  DEFAULT_FILTER,
  createConstraintDeck,
  type ConstraintCard,
  type ConstraintCategory,
  type ConstraintFilter,
} from './deck';

export interface ConstraintPrefs extends ConstraintFilter {
  /** Draw a new card every N bars while the band plays; 0 = off. */
  autoBars: number;
}

const DEFAULT_PREFS: ConstraintPrefs = { ...DEFAULT_FILTER, autoBars: 0 };

function sanitize(v: unknown): ConstraintPrefs | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  const cats = Array.isArray(o.categories)
    ? (o.categories.filter((c) =>
        CATEGORIES.includes(c as ConstraintCategory),
      ) as ConstraintCategory[])
    : DEFAULT_PREFS.categories;
  return {
    categories: cats,
    beginnerSafe: o.beginnerSafe === true,
    autoBars:
      typeof o.autoBars === 'number' && o.autoBars >= 0 && o.autoBars <= 64 ? o.autoBars : 0,
  };
}

export interface ConstraintsApi {
  prefs: ConstraintPrefs;
  setPrefs: (patch: Partial<ConstraintPrefs>) => void;
  current: ConstraintCard | null;
  kept: ConstraintCard[];
  /** Number of eligible cards under the current filters. */
  poolSize: number;
  notice: string | null;
  draw: () => void;
  back: () => void;
  keep: () => void;
  discard: () => void;
  unkeep: (id: string) => void;
}

/** Shared by the Constraint Cards page and the overlay used inside other games. */
export function useConstraints(seed?: number): ConstraintsApi {
  const { profile } = useApp();
  const transport = useTransport();
  const instruments = playerInstruments(profile);
  const instrumentKey = instruments.join(',');

  const [rng] = useState<Rng>(() => createRng(seed ?? Date.now()));

  const [prefs, setPrefsState] = useState<ConstraintPrefs>(() =>
    loadJson('constraints', DEFAULT_PREFS, sanitize),
  );
  const [deck, setDeck] = useState(() => createConstraintDeck(rng, prefs, instruments));
  const [history] = useState(() => new History<ConstraintCard>(10));
  const [current, setCurrent] = useState<ConstraintCard | null>(null);
  const [kept, setKept] = useState<ConstraintCard[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const currentRef = useRef<ConstraintCard | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const rebuild = useCallback(
    (p: ConstraintPrefs, inst: string[]) => setDeck(createConstraintDeck(rng, p, inst)),
    [rng],
  );

  // Rebuild the deck when the player's instruments change (e.g. profile edited elsewhere).
  const [deckInstruments, setDeckInstruments] = useState(instrumentKey);
  if (deckInstruments !== instrumentKey) {
    setDeckInstruments(instrumentKey);
    setDeck(createConstraintDeck(rng, prefs, instruments));
  }

  const setPrefs = useCallback(
    (patch: Partial<ConstraintPrefs>) => {
      const next = { ...prefs, ...patch };
      setPrefsState(next);
      saveJson('constraints', next);
      rebuild(next, instruments);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs, instrumentKey, rebuild],
  );

  const show = useCallback((card: ConstraintCard) => {
    currentRef.current = card;
    setCurrent(card);
    announce(`Constraint card: ${card.text}`);
  }, []);

  const draw = useCallback(() => {
    if (deck.size === 0) {
      setNotice('No cards match your filters.');
      return;
    }
    const { item, reshuffled } = deck.draw();
    history.push(item);
    show(item);
    if (reshuffled) {
      setNotice('Reshuffled!');
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(null), 3000);
    } else setNotice(null);
  }, [deck, history, show]);

  const back = useCallback(() => {
    const prev = history.back();
    if (prev) show(prev);
  }, [history, show]);

  const keep = useCallback(() => {
    const c = currentRef.current;
    if (c) setKept((k) => (k.some((x) => x.id === c.id) ? k : [...k, c]));
  }, []);

  const discard = useCallback(() => {
    currentRef.current = null;
    setCurrent(null);
  }, []);
  const unkeep = useCallback((id: string) => setKept((k) => k.filter((c) => c.id !== id)), []);

  // Auto-draw every N bars while the backing band plays.
  useEffect(() => {
    if (prefs.autoBars <= 0) return;
    return transport.onBeat((e) => {
      if (e.bar > 0 && e.beat === 0 && e.bar % prefs.autoBars === 0) draw();
    });
  }, [prefs.autoBars, transport, draw]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  return {
    prefs,
    setPrefs,
    current,
    kept,
    poolSize: deck.size,
    notice,
    draw,
    back,
    keep,
    discard,
    unkeep,
  };
}
