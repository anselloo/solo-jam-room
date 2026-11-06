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
    blurb: 'Spin the reels. Get a key, mode, tempo and groove, then jam with the band.',
    minutes: '3-10 min',
    difficulty: 'All levels',
    milestone: 3,
    mvp: true,
  },
  {
    path: '/trade-fours',
    title: 'Trade Fours',
    icon: '🔁',
    blurb: 'You play a phrase, the app answers, you answer back.',
    minutes: '5-10 min',
    difficulty: 'All levels',
    milestone: 3,
    mvp: true,
  },
  {
    path: '/progressions',
    title: 'Chord Dealer',
    icon: '🃏',
    blurb: 'Deal a progression, loop it with the band, and play over the changes.',
    minutes: '5-10 min',
    difficulty: 'All levels',
    milestone: 3,
    mvp: true,
  },
  {
    path: '/constraints',
    title: 'Constraint Cards',
    icon: '🎴',
    blurb: 'Draw a card that changes how you have to play.',
    minutes: '3-10 min',
    difficulty: 'All levels',
    milestone: 3,
    mvp: true,
  },
  {
    path: '/missing-member',
    title: 'Missing Member',
    icon: '🕳️',
    blurb: 'The band is one short. Cover the missing part.',
    minutes: '5-10 min',
    difficulty: 'Intermediate+',
    milestone: 4,
  },
  {
    path: '/hold-the-pulse',
    title: 'Hold the Pulse',
    icon: '⏱️',
    blurb: 'The click drops out. Can you keep time on your own?',
    minutes: '3-5 min',
    difficulty: 'All levels',
    milestone: 4,
  },
  {
    path: '/genre-flip',
    title: 'Genre Flip',
    icon: '🔀',
    blurb: 'Take a familiar old tune and play it in a totally different style.',
    minutes: '3 min a round',
    difficulty: 'All levels',
    milestone: 4,
  },
  {
    path: '/song-sprint',
    title: 'Song Sprint',
    icon: '✍️',
    blurb: 'Write a tiny song before the timer runs out.',
    minutes: '5-20 min',
    difficulty: 'All levels',
    milestone: 4,
  },
];

export const DAILY: GameInfo = {
  path: '/daily',
  title: 'Daily Jam',
  icon: '📅',
  blurb: 'One fresh challenge a day. Keep your streak alive.',
  minutes: '5-10 min',
  difficulty: 'All levels',
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
