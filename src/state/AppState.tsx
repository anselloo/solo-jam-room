import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setMasterVolume, setMuted } from '../audio/engine';
import { loadProfile, saveProfile, type Profile } from './profile';
import { loadSettings, saveSettings, type Settings } from './settings';
import { loadStats, saveStats, type Stats } from './stats';

interface AppState {
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  stats: Stats;
  /** Apply a pure update to the stats and persist the result. */
  updateStats: (fn: (s: Stats) => Stats) => void;
  focus: boolean;
  setFocus: (on: boolean) => void;
  toggleFocus: () => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [focus, setFocusState] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      saveProfile(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateStats = useCallback((fn: (s: Stats) => Stats) => {
    setStats((prev) => {
      const next = fn(prev);
      if (next !== prev) saveStats(next);
      return next;
    });
  }, []);

  // Keep the audio engine and document in step with settings.
  useEffect(() => {
    setMuted(settings.muted);
    setMasterVolume(settings.volume);
  }, [settings.muted, settings.volume]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const setFocus = useCallback((on: boolean) => {
    setFocusState(on);
    const doc = document as Document & { fullscreenEnabled?: boolean };
    try {
      if (on && doc.fullscreenEnabled && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen().catch(() => undefined);
      } else if (!on && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
      }
    } catch {
      /* Fullscreen is optional: Focus Mode still works without it. */
    }
  }, []);

  const toggleFocus = useCallback(() => setFocus(!focus), [focus, setFocus]);

  // If the browser leaves fullscreen (e.g. the player pressed Esc), leave Focus Mode too.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFocusState(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      profile,
      updateProfile,
      settings,
      updateSettings,
      stats,
      updateStats,
      focus,
      setFocus,
      toggleFocus,
      helpOpen,
      setHelpOpen,
    }),
    [
      profile,
      updateProfile,
      settings,
      updateSettings,
      stats,
      updateStats,
      focus,
      setFocus,
      toggleFocus,
      helpOpen,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
