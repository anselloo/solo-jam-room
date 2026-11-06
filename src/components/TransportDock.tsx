import { useState } from 'react';
import { BAND_PARTS, MAX_BPM, MIN_BPM, useTransport, type BandPart } from '../audio/transport';
import { TIME_SIGNATURES, signatureLabel } from '../audio/scheduler';

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
          title="Play / stop (P)"
        >
          {t.running ? '■ Stop' : '▶ Play'}
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
          <span className="muted">BPM</span>
        </div>

        <button type="button" className="btn" onClick={() => t.tap()} title="Tap tempo (T)">
          Tap
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
        <div
          className="dock__pulse"
          role="img"
          aria-label={
            t.position ? `Bar ${t.position.bar + 1}, beat ${t.position.beat + 1}` : 'Stopped'
          }
        >
          {Array.from({ length: t.signature.beats }, (_, i) => (
            <span
              key={`${signatureLabel(t.signature)}-${i}`}
              className="pulse-dot"
              data-on={t.position?.beat === i}
              data-accent={i === 0}
            />
          ))}
        </div>

        <button
          type="button"
          className="btn dock__spacer"
          aria-expanded={open}
          aria-controls="band-mixer"
          onClick={() => setOpen((o) => !o)}
        >
          Mixer {open ? '▾' : '▴'}
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
          <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
            The backing band arrives in the next update. For now the click keeps time.
          </p>
        </div>
      )}
    </section>
  );
}
