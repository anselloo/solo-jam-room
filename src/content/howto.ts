/** Plain-language instructions for first-timers, one entry per game. No jargon without an explanation. */
export interface HowToContent {
  /** One sentence: what this game is for. */
  goal: string;
  steps: string[];
  /** An optional extra tip. */
  tip?: string;
}

export const HOWTO: Record<string, HowToContent> = {
  roulette: {
    goal: 'Get a random starting point for a jam, so you never have to decide what to play.',
    steps: [
      'Press Spin. The reels pick a key (your home note), a mode (the mood of the scale), a speed, a time signature (how many beats in each bar) and a band style.',
      'Press Play. The band counts you in, then starts.',
      'Play anything on your instrument using the notes shown. There are no wrong notes.',
    ],
    tip: 'Like one of the picks? Press Lock under it, then spin again to re-roll only the rest.',
  },
  'trade-fours': {
    goal: 'Take turns with the app, like two musicians trading solos. A “four” is four bars of music.',
    steps: [
      'Press Start. The band counts you in.',
      "When the screen says APP'S TURN, listen to the short phrase it plays.",
      'When it says YOUR TURN, play your own phrase in answer.',
      'Keep trading until the rounds run out.',
    ],
    tip: 'Turn on Echo mode below to copy the app’s phrase by ear instead of making up your own.',
  },
  progressions: {
    goal: 'Get a set of chords (a chord progression) and loop it, so you can play over the top.',
    steps: [
      'Press Deal to get four chords.',
      'Press Play. The band loops the chords.',
      'Play along: strum the chords, or play single notes that fit.',
    ],
    tip: 'The chord lit up in yellow is the one playing right now. Changes Challenge, below, swaps the chords every few loops to keep you on your toes.',
  },
  constraints: {
    goal: 'Draw a card that gives you a rule to play by. Limits make you more creative.',
    steps: [
      'Press Draw a card.',
      'Play anything you like, but follow the rule on the card.',
      'Press Keep to pin a card you like, or draw again for a new one.',
    ],
    tip: 'Start the band with the Play band button at the bottom of the screen to play along.',
  },
  'missing-member': {
    goal: 'The backing band is one player short, and you fill in.',
    steps: [
      'Press Start. One part (drums, bass or chords) goes silent.',
      'Play that part on your instrument: keep the beat for drums, play low notes for bass, play chords for chords.',
      'Each round a different part goes missing.',
    ],
  },
  'hold-the-pulse': {
    goal: 'Train your sense of time by keeping the beat after the click stops.',
    steps: [
      'Press Start. A click plays so you can feel the beat.',
      'When the screen says LISTEN, the click drops out. Keep going.',
      'Tap the big pad (or press Space) on every beat, or play steadily on your instrument.',
      'At the end you see how steady you were.',
    ],
  },
  'genre-flip': {
    goal: 'Play a tune you already know in a style you would never expect.',
    steps: [
      'Press Draw. You get an old tune and a style, such as reggae or waltz.',
      'Play the tune from memory in that style. The band plays along if you press Play band.',
      'You have three minutes, then draw the next one.',
    ],
  },
  'song-sprint': {
    goal: 'Write a tiny song before the timer runs out. Finishing matters more than perfect.',
    steps: [
      'Read your prompt: a title, a theme and a shape for the song.',
      'Press Start the sprint. Jot lyrics, chords or ideas in the notes box.',
      'When time is up, play your song through once with the band.',
    ],
  },
  daily: {
    goal: 'One small challenge a day, the same for everyone. Do it daily to build a streak.',
    steps: [
      'Read today’s challenge below.',
      'Try it with the band: press Play band at the bottom of the screen.',
      'Press “I did it” to add a day to your streak.',
    ],
  },
};

export interface GlossaryTerm {
  term: string;
  meaning: string;
}

/** Words that appear in the games, in the order a beginner is likely to meet them. */
export const GLOSSARY: readonly GlossaryTerm[] = [
  {
    term: 'Key',
    meaning:
      'The home note a piece of music feels like it belongs to. In the key of G, G is “home”.',
  },
  {
    term: 'Mode',
    meaning:
      'The flavour of a scale. Major sounds bright, minor sounds darker, and others like Dorian or Mixolydian sit in between.',
  },
  {
    term: 'Scale',
    meaning:
      'The set of notes that sound good together in a key and mode. Stick to them and you will sound right.',
  },
  {
    term: 'Tempo, BPM',
    meaning:
      'How fast the music goes, in beats per minute. 60 is slow and relaxed, 120 is a brisk walk, 160 and up is fast.',
  },
  {
    term: 'Time signature',
    meaning: 'How many beats are in each bar. 4/4 counts 1-2-3-4. 3/4 is a waltz, 1-2-3.',
  },
  {
    term: 'Bar',
    meaning: 'One group of beats, counted 1-2-3-4 and then around again. Also called a measure.',
  },
  {
    term: 'Groove',
    meaning:
      'The style of the band: rock, funk, reggae and so on. It changes the drum and bass pattern.',
  },
  {
    term: 'Chord progression',
    meaning: 'A short loop of chords the band plays over and over, like Am – F – C – G.',
  },
  {
    term: 'Roman numerals',
    meaning:
      'A way of naming chords by their job in the key, so the same progression works in any key. I is the home chord, V is the chord that pulls back to it.',
  },
  {
    term: 'Phrase',
    meaning:
      'A short musical idea, a bit like a sentence. In Trade Fours a phrase is a few bars long.',
  },
  { term: 'Click', meaning: 'A steady tick that marks every beat, like a metronome.' },
  {
    term: 'Count-in',
    meaning: 'A bar of clicks before the music starts, so you can get ready on the beat.',
  },
  {
    term: 'Capo',
    meaning:
      'A clamp that guitarists and ukulele players put on the neck to raise the pitch and use easier chord shapes.',
  },
  {
    term: 'Constraint card',
    meaning:
      'A rule you play by, such as “only three notes”. Restrictions push you to try new ideas.',
  },
];
