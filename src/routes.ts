export interface GameInfo {
  path: string;
  title: string;
  icon: string;
  blurb: string;
  minutes: string;
  /** Which skill levels the game is tuned for. */
  difficulty: string;
  /** Milestone in which the game ships, shown on placeholder pages. */
  milestone: number;
  mvp?: boolean;
}

export const GAMES: readonly GameInfo[] = [
  {
    path: '/roulette',
    title: 'Jam Roulette',
    icon: '🎰',
    blurb: 'Spin for a random key, speed and band style, then play along. The best place to start.',
    minutes: '3-10 min',
    difficulty: 'Any level',
    milestone: 3,
    mvp: true,
  },
  {
    path: '/trade-fours',
    title: 'Trade Fours',
    icon: '🔁',
    blurb: 'Take turns with the app: it plays a short phrase, then you answer.',
    minutes: '5-10 min',
    difficulty: 'Any level',
    milestone: 3,
    mvp: true,
  },
  {
    path: '/progressions',
    title: 'Chord Dealer',
    icon: '🃏',
    blurb: 'Get four chords and loop them with the band. Play along or solo over the top.',
    minutes: '5-10 min',
    difficulty: 'Any level',
    milestone: 3,
    mvp: true,
  },
  {
    path: '/constraints',
    title: 'Constraint Cards',
    icon: '🎴',
    blurb: 'Draw a card with a rule, like “only three notes”, and play by it.',
    minutes: '3-10 min',
    difficulty: 'Any level',
    milestone: 3,
    mvp: true,
  },
  {
    path: '/missing-member',
    title: 'Missing Member',
    icon: '🕳️',
    blurb: 'One band member drops out. You play their part.',
    minutes: '5-10 min',
    difficulty: 'Some experience',
    milestone: 4,
  },
  {
    path: '/hold-the-pulse',
    title: 'Hold the Pulse',
    icon: '⏱️',
    blurb: 'The beat goes quiet. See how steady your timing stays.',
    minutes: '3-5 min',
    difficulty: 'Any level',
    milestone: 4,
  },
  {
    path: '/genre-flip',
    title: 'Genre Flip',
    icon: '🔀',
    blurb: 'Play a tune you know in a style you would never expect.',
    minutes: '3 min a round',
    difficulty: 'Any level',
    milestone: 4,
  },
  {
    path: '/song-sprint',
    title: 'Song Sprint',
    icon: '✍️',
    blurb: 'Write a tiny song before the timer runs out.',
    minutes: '5-20 min',
    difficulty: 'Any level',
    milestone: 4,
  },
];

export const DAILY: GameInfo = {
  path: '/daily',
  title: 'Daily Jam',
  icon: '📅',
  blurb: 'One new challenge every day. Come back daily to build a streak.',
  minutes: '5-10 min',
  difficulty: 'Any level',
  milestone: 4,
};

export type PageId = 'home' | 'game' | 'profile' | 'settings' | 'about' | 'notFound';

export interface ResolvedRoute {
  page: PageId;
  game?: GameInfo;
}

/** `#/roulette?x=1` -> `/roulette`. Empty or malformed hashes resolve to the home route. */
export function pathFromHash(hash: string): string {
  const raw = hash.replace(/^#/, '').split('?')[0];
  if (raw === '' || raw === '/') return '/';
  const withSlash = raw.startsWith('/') ? raw : '/' + raw;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}

export function resolveRoute(path: string): ResolvedRoute {
  if (path === '/') return { page: 'home' };
  if (path === '/profile') return { page: 'profile' };
  if (path === '/settings') return { page: 'settings' };
  if (path === '/about') return { page: 'about' };
  const game = [...GAMES, DAILY].find((g) => g.path === path);
  return game ? { page: 'game', game } : { page: 'notFound' };
}
