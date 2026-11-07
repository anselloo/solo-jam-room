import { useState } from 'react';
import {
  BAND_PARTS,
  MAX_BPM,
  MIN_BPM,
  useTransport,
  type BandPart,
  type BeatPosition,
} from '../audio/transport';
import { GROOVES } from '../audio/band/grooves';
import { chordSymbol } from '../theory/chords';
import { TIME_SIGNATURES, signatureLabel } from '../audio/scheduler';

function positionLabel(p: BeatPosition | null): string {
  if (!p) return 'Stopped';
  if (p.bar < 0) return `Count-in, beat ${p.beat + 1}`;
  const chord = p.chord ? `, chord ${chordSymbol(p.chord)}` : '';
  return `Bar ${p.bar + 1}, beat ${p.beat + 1}${chord}`;
}

const PART_LABEL: Record<BandPart, string> = { drums: 'Drums', bass: 'Bass', chords: 'Chords' };

export function TransportDock() {
  const t = useTransport();
  const [open, setOpen] = useState(false);

  return (
    <section className="dock" aria-label="Transport">
      <div className="dock__bar">
        <button
          type="button"
          className="btn"
          onClick={() => void t.toggle()}
          aria-pressed={t.running}
          title="Play or stop the backing band (P)"
        >
          {t.running ? '■ Stop' : '▶ Play band'}
        </button>

        <div className="dock__bpm" role="group" aria-label="Tempo">
          <button
            type="button"
            className="btn"
            aria-label="Slower"
            onClick={() => t.setBpm(t.bpm - 1)}
          >
            −
          </button>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={MIN_BPM}
            max={MAX_BPM}
            value={t.bpm}
            aria-label="Beats per minute"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) t.setBpm(n);
            }}
          />
          <button
            type="button"
            className="btn"
            aria-label="Faster"
            onClick={() => t.setBpm(t.bpm + 1)}
          >
            +
          </button>
          <span className="muted">BPM (speed)</span>
        </div>

        <button type="button" className="btn" onClick={() => t.tap()} title="Tap tempo (T)">
          Tap tempo
        </button>

        <label className="sr-only" htmlFor="time-signature">
          Time signature
        </label>
        <select
          id="time-signature"
          className="input"
          value={signatureLabel(t.signature)}
          onChange={(e) => {
            const sig = TIME_SIGNATURES.find((s) => signatureLabel(s) === e.target.value);
            if (sig) t.setSignature(sig);
          }}
        >
          {TIME_SIGNATURES.map((s) => (
            <option key={signatureLabel(s)} value={signatureLabel(s)}>
              {signatureLabel(s)}
            </option>
          ))}
        </select>

        {/* Visual pulse: every audio cue has a visual equivalent. */}
        <div className="dock__pulse" role="img" aria-label={positionLabel(t.position)}>
          {Array.from({ length: t.signature.beats }, (_, i) => (
            <span
              key={`${signatureLabel(t.signature)}-${i}`}
              className="pulse-dot"
              data-on={t.position?.beat === i}
              data-accent={i === 0}
            />
          ))}
        </div>

        {t.position?.chord && (
          <span className="dock__chord" aria-label="Current chord">
            {chordSymbol(t.position.chord)}
          </span>
        )}

        <button
          type="button"
          className="btn dock__spacer"
          aria-expanded={open}
          aria-controls="band-mixer"
          onClick={() => setOpen((o) => !o)}
        >
          Band mixer {open ? '▾' : '▴'}
        </button>
      </div>

      {open && (
        <div className="dock__mixer" id="band-mixer">
          <div className="mixer-row">
            <label className="row" style={{ minWidth: 90 }}>
              <input
                type="checkbox"
                checked={t.clickOn}
                onChange={(e) => t.setClickOn(e.target.checked)}
              />
              Click
            </label>
          </div>
          {BAND_PARTS.map((part) => (
            <div className="mixer-row" key={part}>
              <button
                type="button"
                className="btn"
                aria-pressed={t.mixer[part].muted}
                aria-label={`Mute ${PART_LABEL[part]}`}
                onClick={() => t.setPart(part, { muted: !t.mixer[part].muted })}
              >
                {t.mixer[part].muted ? 'Muted' : 'M'}
              </button>
              <label htmlFor={`vol-${part}`} style={{ minWidth: 56 }}>
                {PART_LABEL[part]}
              </label>
              <input
                id={`vol-${part}`}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={t.mixer[part].volume}
                onChange={(e) => t.setPart(part, { volume: Number(e.target.value) })}
              />
            </div>
          ))}
          <label className="row">
            <input
              type="checkbox"
              checked={t.bandOn}
              onChange={(e) => t.setBandOn(e.target.checked)}
            />
            Band
          </label>
          <div className="mixer-row">
            <label htmlFor="groove" style={{ minWidth: 56 }}>
              Groove
            </label>
            <select
              id="groove"
              className="input"
              value={t.grooveId}
              onChange={(e) => t.setGrooveId(e.target.value)}
            >
              {GROOVES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </section>
  );
}
