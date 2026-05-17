/**
 * SamplingDials — interactive temperature slider that reshapes a next-token
 * probability bar chart in real time.
 *
 * All data is hand-authored and illustrative (not from a real model).
 */
import { useState, useMemo } from "react";
import { CANDIDATES, PREFIX, softmax } from "../data/sampling";

const LOGITS = CANDIDATES.map((c) => c.logit);

interface Preset {
  label: string;
  temperature: number;
  description: string;
}

const PRESETS: Preset[] = [
  { label: "Greedy (T≈0)", temperature: 0.05, description: "Near-argmax: almost all probability on the top token." },
  { label: "Precise (T=0.5)", temperature: 0.5, description: "Sharp distribution — good for structured tasks." },
  { label: "Balanced (T=1.0)", temperature: 1.0, description: "Model's raw distribution — the API default." },
  { label: "Exploratory (T=2.0)", temperature: 2.0, description: "Flat distribution — lower-ranked tokens get a real shot." },
];

export default function SamplingDials() {
  const [temperature, setTemperature] = useState(1.0);
  const [activePreset, setActivePreset] = useState<number | null>(2);

  const probs = useMemo(() => softmax(LOGITS, temperature), [temperature]);
  const maxProb = Math.max(...probs);

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    setTemperature(parseFloat(e.target.value));
    setActivePreset(null);
  }

  function applyPreset(preset: Preset, idx: number) {
    setTemperature(preset.temperature);
    setActivePreset(idx);
  }

  const greedyToken = CANDIDATES[probs.indexOf(maxProb)].token;
  const displayTemp = temperature < 0.1 ? "≈0" : temperature.toFixed(2);

  return (
    <div className="sd-root">
      <p className="sd-prefix">
        Prefix: <code className="sd-code">{PREFIX}</code>
        <span className="sd-note"> — illustrative logits, not a real model</span>
      </p>

      {/* Bar chart */}
      <div className="sd-chart" role="img" aria-label="Next-token probability distribution">
        {CANDIDATES.map((cand, i) => {
          const pct = probs[i] * 100;
          const isTop = probs[i] === maxProb;
          return (
            <div key={cand.token} className="sd-bar-group">
              <div className="sd-bar-track">
                <div
                  className={`sd-bar${isTop ? " sd-bar--top" : ""}`}
                  style={{ height: `${Math.max(pct * 2.2, 2)}px` }}
                  title={`${cand.token}: ${pct.toFixed(1)}%`}
                />
              </div>
              <div className="sd-bar-pct">{pct < 1 ? "<1" : pct.toFixed(0)}%</div>
              <div className="sd-bar-label">{cand.token}</div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="sd-controls">
        <div className="sd-slider-row">
          <label className="sd-slider-label" htmlFor="temp-slider">
            Temperature: <strong>{displayTemp}</strong>
          </label>
          <input
            id="temp-slider"
            type="range"
            min="0.05"
            max="2.0"
            step="0.05"
            value={temperature}
            onChange={handleSlider}
            className="sd-slider"
          />
          <div className="sd-slider-ends">
            <span>decisive</span>
            <span>exploratory</span>
          </div>
        </div>

        <div className="sd-presets">
          {PRESETS.map((p, idx) => (
            <button
              key={p.label}
              className={`sd-preset-btn${activePreset === idx ? " sd-preset-btn--active" : ""}`}
              onClick={() => applyPreset(p, idx)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {activePreset !== null && (
          <p className="sd-preset-desc">{PRESETS[activePreset].description}</p>
        )}
      </div>

      {/* Greedy pick callout */}
      <p className="sd-greedy-note">
        Greedy pick at this temperature:{" "}
        <strong>
          <code className="sd-code">{greedyToken}</code>
        </strong>{" "}
        ({(maxProb * 100).toFixed(1)}% probability)
      </p>

      <style>{`
        .sd-root {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          background: var(--color-surface);
          max-width: var(--content-max);
          margin: var(--space-6) 0;
        }

        .sd-prefix {
          margin: 0 0 var(--space-4);
          font-size: 0.9rem;
        }

        .sd-code {
          font-family: var(--font-mono);
          background: #f1f5f9;
          padding: 0.1em 0.35em;
          border-radius: 3px;
          font-size: 0.88em;
        }

        .sd-note {
          color: var(--color-muted);
          font-size: 0.8rem;
          margin-left: 0.5em;
        }

        /* Bar chart */
        .sd-chart {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 240px;
          padding-bottom: 52px;
          position: relative;
          border-bottom: 1px solid var(--color-border);
          margin-bottom: var(--space-4);
        }

        .sd-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          height: 100%;
          justify-content: flex-end;
          position: relative;
        }

        .sd-bar-track {
          width: 100%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          height: 188px;
        }

        .sd-bar {
          width: 85%;
          background: var(--color-accent-soft);
          border: 1px solid var(--color-accent);
          border-radius: 3px 3px 0 0;
          transition: height 0.25s ease;
          min-height: 2px;
        }

        .sd-bar--top {
          background: var(--color-accent);
        }

        .sd-bar-pct {
          font-size: 0.65rem;
          color: var(--color-muted);
          margin-top: 2px;
          white-space: nowrap;
        }

        .sd-bar-label {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          color: var(--color-text);
          margin-top: 2px;
          white-space: nowrap;
          position: absolute;
          bottom: 0;
        }

        /* Controls */
        .sd-controls {
          margin-bottom: var(--space-4);
        }

        .sd-slider-row {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          margin-bottom: var(--space-4);
        }

        .sd-slider-label {
          font-size: 0.9rem;
        }

        .sd-slider {
          width: 100%;
          accent-color: var(--color-accent);
          cursor: pointer;
        }

        .sd-slider-ends {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--color-muted);
        }

        .sd-presets {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .sd-preset-btn {
          padding: 0.3rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          font-size: 0.82rem;
          cursor: pointer;
          color: var(--color-text);
          transition: background 0.15s, border-color 0.15s;
        }

        .sd-preset-btn:hover {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
        }

        .sd-preset-btn--active {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
          font-weight: 600;
        }

        .sd-preset-desc {
          font-size: 0.85rem;
          color: var(--color-muted);
          margin: 0;
          font-style: italic;
        }

        .sd-greedy-note {
          margin: 0;
          font-size: 0.88rem;
          color: var(--color-text);
        }
      `}</style>
    </div>
  );
}
