import { useState } from "react";

// Palette matching TokenChunks.tsx
const TOKEN_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" }, // blue
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" }, // green
  { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" }, // violet
];

const TOKENS = ["The", " cat", " sat"];

const EMBEDDINGS: Record<string, number[]> = {
  "The":  [0.05, 0.02, -0.11, 0.03, 0.08, -0.04, 0.01, -0.06],
  " cat": [-0.84, 0.62, 1.93, 0.15, -0.47, 1.28, -0.33, 0.76],
  " sat": [-0.37, 1.14, 0.28, -1.83, 0.67, 0.49, -1.21, 0.93],
};

// Sinusoidal-style positional encodings (hand-crafted to show the pattern)
const POS_ENCODINGS: number[][] = [
  [0.00, 1.00, 0.00, 1.00, 0.00, 1.00, 0.00, 1.00],  // pos 0
  [0.84, 0.54, 0.09, 0.99, 0.01, 1.00, 0.00, 1.00],  // pos 1
  [0.91, -0.42, 0.18, 0.98, 0.02, 1.00, 0.00, 1.00], // pos 2
];

function valueToColor(v: number): string {
  // Diverging scale: negative → blue, zero → white, positive → orange
  // Clamp to [-2, 2]
  const clamped = Math.max(-2, Math.min(2, v));
  const t = Math.abs(clamped) / 2; // 0..1 intensity
  if (clamped < 0) {
    // Blue: hsl(220, 70%, lightness)
    const lightness = Math.round(98 - t * 40); // 98% (white-ish) → 58% (blue)
    return `hsl(220, ${Math.round(t * 70)}%, ${lightness}%)`;
  } else if (clamped > 0) {
    // Orange: hsl(25, 85%, lightness)
    const lightness = Math.round(98 - t * 40); // 98% → 58%
    return `hsl(25, ${Math.round(t * 85)}%, ${lightness}%)`;
  }
  return "#fff";
}

interface HeatmapStripProps {
  values: number[];
  highlight?: boolean;
  label?: string;
}

function HeatmapStrip({ values, highlight, label }: HeatmapStripProps) {
  return (
    <div
      className="pe-strip"
      style={{
        outline: highlight ? "2px solid var(--color-accent, #3b82f6)" : "none",
        outlineOffset: "2px",
        borderRadius: 4,
        transition: "outline 0.3s",
      }}
    >
      {label && <div className="pe-strip-label">{label}</div>}
      <div className="pe-cells">
        {values.map((v, i) => (
          <div
            key={i}
            className="pe-cell"
            style={{
              background: valueToColor(v),
              transition: "background 0.4s ease",
            }}
            title={v.toFixed(2)}
          />
        ))}
      </div>
    </div>
  );
}

export default function PositionalEncoding() {
  // token order: indices into TOKENS array
  const [order, setOrder] = useState<number[]>([0, 1, 2]);
  const [swapped, setSwapped] = useState(false);
  const [highlightSwapped, setHighlightSwapped] = useState(false);

  function handleSwap() {
    const newOrder = [...order];
    // Swap positions 1 and 2 (cat and sat)
    const tmp = newOrder[1];
    newOrder[1] = newOrder[2];
    newOrder[2] = tmp;
    setOrder(newOrder);
    setSwapped(!swapped);
    setHighlightSwapped(true);
    setTimeout(() => setHighlightSwapped(false), 1200);
  }

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .pe-tokens-row {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        .pe-token-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }
        .pe-token {
          padding: 0.35rem 0.75rem;
          border-radius: var(--radius, 6px);
          font-family: var(--font-mono, monospace);
          font-size: 0.95rem;
          border: 1px solid;
          white-space: pre;
          font-weight: 600;
        }
        .pe-pos-label {
          font-size: 0.72rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
        }

        .pe-columns {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 540px) {
          .pe-columns {
            grid-template-columns: 1fr;
          }
        }

        .pe-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        .pe-column-title {
          font-size: 0.75rem;
          font-family: var(--font-body, system-ui, sans-serif);
          color: var(--color-muted, #6b7280);
          text-align: center;
          font-weight: 500;
        }

        .pe-equation {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          width: 100%;
        }
        .pe-op {
          font-size: 1.4rem;
          font-weight: 300;
          color: var(--color-muted, #6b7280);
          line-height: 1;
          user-select: none;
        }
        .pe-eq-label {
          font-size: 0.68rem;
          font-family: var(--font-body, system-ui, sans-serif);
          color: var(--color-muted, #6b7280);
          text-align: center;
        }

        .pe-strip {
          width: 100%;
        }
        .pe-strip-label {
          font-size: 0.65rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
          text-align: center;
          margin-bottom: 2px;
        }
        .pe-cells {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 2px;
          width: 100%;
        }
        .pe-cell {
          aspect-ratio: 1;
          border-radius: 2px;
          border: 1px solid rgba(0,0,0,0.06);
        }

        .pe-insight {
          background: var(--color-surface, #f8f9fa);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          padding: 0.75rem 1rem;
          font-size: 0.85rem;
          font-style: italic;
          color: var(--color-muted, #6b7280);
          margin-bottom: 1rem;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .pe-insight strong {
          font-style: normal;
          color: inherit;
        }

        .pe-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .pe-btn {
          padding: 0.35rem 0.9rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 999px;
          font-size: 0.82rem;
          font-family: var(--font-body, system-ui, sans-serif);
          background: var(--color-bg, #fff);
          color: var(--color-muted, #6b7280);
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }
        .pe-btn:hover {
          background: var(--color-surface, #f8f9fa);
        }
        .pe-btn--active {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .pe-swap-note {
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
          font-style: italic;
          font-family: var(--font-body, system-ui, sans-serif);
        }
      `}</style>

      {/* Top: token boxes */}
      <div className="pe-tokens-row">
        {order.map((tokenIdx, pos) => {
          const color = TOKEN_COLORS[pos % TOKEN_COLORS.length];
          const isChangedPos = swapped && (pos === 1 || pos === 2);
          return (
            <div key={pos} className="pe-token-box">
              <div
                className="pe-token"
                style={{
                  background: color.bg,
                  borderColor: isChangedPos && highlightSwapped
                    ? "var(--color-accent, #3b82f6)"
                    : color.border,
                  color: color.text,
                  transition: "border-color 0.4s",
                }}
              >
                {TOKENS[tokenIdx]}
              </div>
              <span className="pe-pos-label">pos {pos}</span>
            </div>
          );
        })}
      </div>

      {/* Middle: addition visualization */}
      <div className="pe-columns">
        {order.map((tokenIdx, pos) => {
          const token = TOKENS[tokenIdx];
          const emb = EMBEDDINGS[token];
          const pe = POS_ENCODINGS[pos];
          const input = emb.map((e, i) => e + pe[i]);
          const isChangedPos = swapped && (pos === 1 || pos === 2);

          return (
            <div key={pos} className="pe-column">
              <div className="pe-column-title">
                position {pos}
              </div>
              <div className="pe-equation">
                <HeatmapStrip
                  values={emb}
                  highlight={false}
                />
                <div className="pe-eq-label">embedding("{token}")</div>

                <div className="pe-op">+</div>

                <HeatmapStrip
                  values={pe}
                  highlight={isChangedPos && highlightSwapped}
                />
                <div className="pe-eq-label">pos_encoding[{pos}]</div>

                <div className="pe-op">=</div>

                <HeatmapStrip
                  values={input}
                  highlight={isChangedPos && highlightSwapped}
                />
                <div className="pe-eq-label">input_vector</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom: insight + swap button */}
      <div className="pe-insight">
        <strong>Key insight:</strong> Same token at different positions → different input
        vectors. The model can distinguish word order.
      </div>

      <div className="pe-controls">
        <button
          className={`pe-btn${swapped ? " pe-btn--active" : ""}`}
          onClick={handleSwap}
        >
          {swapped ? "Restore order" : "Swap positions (cat ↔ sat)"}
        </button>
        {swapped && (
          <span className="pe-swap-note">
            Embeddings unchanged — positional encodings swapped — input vectors differ.
          </span>
        )}
      </div>
    </div>
  );
}
