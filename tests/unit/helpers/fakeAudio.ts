/* A silent stand-in for the Web Audio API with a clock the test controls. */

const clock = { now: 0 };

/** An object that accepts any property access, call or assignment. */
function anything(): unknown {
  const handler: ProxyHandler<() => void> = {
    get: (_t, p) => {
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === 'then') return undefined;
      return anything();
    },
    apply: () => anything(),
    set: () => true,
  };
  return new Proxy(() => undefined, handler);
}

export interface Recorded {
  oscillators: { type: string; start: number }[];
}
export const recorded: Recorded = { oscillators: [] };

class FakeAudioContext {
  sampleRate = 44100;
  state = 'running';
  destination = anything();

  constructor() {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop === 'currentTime') return clock.now;
        if (prop in target) return Reflect.get(target, prop, receiver);
        if (typeof prop === 'string' && prop.startsWith('create')) {
          if (prop === 'createOscillator') {
            return () => {
              const rec = { type: '', start: -1 };
              recorded.oscillators.push(rec);
              return new Proxy(
                {},
                {
                  get: (_t, p) => {
                    if (p === 'start') return (t: number) => void (rec.start = t);
                    if (p === 'connect') return (dest: unknown) => dest;
                    if (p === 'frequency' || p === 'detune') return anything();
                    return () => undefined;
                  },
                  set: (_t, p, v) => {
                    if (p === 'type') rec.type = String(v);
                    return true;
                  },
                },
              );
            };
          }
          return () => anything();
        }
        return undefined;
      },
    });
  }

  resume() {
    return Promise.resolve();
  }

  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
}

export function installFakeAudio(): void {
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  clock.now = 0;
  recorded.oscillators = [];
}

export const audioNow = (): number => clock.now;
export const setAudioNow = (t: number): void => {
  clock.now = t;
};
