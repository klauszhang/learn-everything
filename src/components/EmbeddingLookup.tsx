import { useState } from "react";

const TOKENS = [
  { text: "king", id: 4721 },
  { text: "queen", id: 6587 },
  { text: "cat", id: 5765 },
  { text: "the", id: 791 },
  { text: "atom", id: 17390 },
  { text: "run", id: 3220 },
];

const VECTORS: Record<number, number[]> = {
  4721: [0.23, -1.47, 0.82, -0.31, 2.14, -0.67, 0.45, 1.08],   // king
  6587: [0.19, -1.52, 0.78, -0.28, 2.09, -0.71, 0.51, 1.12],   // queen
  5765: [-0.84, 0.62, 1.93, 0.15, -0.47, 1.28, -0.33, 0.76],   // cat
  791:  [0.05, 0.02, -0.11, 0.03, 0.08, -0.04, 0.01, -0.06],   // the
  17390: [1.41, -0.53, -1.67, 2.08, 0.34, -0.92, 1.73, -0.28], // atom
  3220: [-0.37, 1.14, 0.28, -1.83, 0.67, 0.49, -1.21, 0.93],   // run
};

// Deterministic but visually varied fake row data for non-selected rows
function fakeRowValues(seed: number): number[] {
  const vals: number[] = [];
  for (let i = 0; i < 12; i++) {
    const x = Math.sin(seed * 9301 + i * 49297 + 233720) * 2.5;
    vals.push(Math.round(x * 100) / 100);
  }
  return vals;
}

// Map a float value to a color. Negative = cool blue, positive = warm red.
function valueToColor(v: number, active: boolean): string {
  const clamped = Math.max(-2.5, Math.min(2.5, v));
  const t = (clamped + 2.5) / 5; // 0..1
  if (!active) {
    // muted grayscale
    const l = Math.round(88 - t * 20);
    return `hsl(0,0%,${l}%)`;
  }
  // active: cool blue (220) → warm red (10)
  const hue = Math.round(220 - t * 210);
  const sat = 65;
  const light = Math.round(62 - Math.abs(t - 0.5) * 20);
  return `hsl(${hue},${sat}%,${light}%)`;
}

// Build the schematic row list around the selected token id
function buildRows(selectedId: number) {
  const rows: Array<{ label: string; seed: number; gap?: boolean }> = [];
  rows.push({ label: "0", seed: 0 });
  rows.push({ label: "1", seed: 1 });
  rows.push({ label: "2", seed: 2 });
  rows.push({ label: "...", seed: -1, gap: true });
  // Show 2 rows above, the selected, 2 rows below
  for (let offset = -2; offset <= 2; offset++) {
    const id = selectedId + offset;
    if (id < 0 || id > 99999) continue;
    rows.push({ label: String(id), seed: id });
  }
  rows.push({ label: "...", seed: -2, gap: true });
  rows.push({ label: "99,999", seed: 99999 });
  return rows;
}

export default function EmbeddingLookup() {
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]);

  const vector = VECTORS[selectedToken.id];
  const rows = buildRows(selectedToken.id);

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .el-tabs {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }
        .el-tab {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.35rem 0.9rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 999px;
          background: var(--color-bg, #fff);
          color: var(--color-muted, #6b7280);
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
          gap: 0.1rem;
        }
        .el-tab:hover {
          background: var(--color-surface, #f8f9fa);
        }
        .el-tab--active {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
        }
        .el-tab-text {
          font-size: 0.88rem;
          font-family: var(--font-mono, monospace);
          font-weight: 600;
        }
        .el-tab-id {
          font-size: 0.65rem;
          font-family: var(--font-mono, monospace);
          opacity: 0.75;
        }
        .el-matrix-wrap {
          position: relative;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          background: var(--color-surface, #f8f9fa);
          padding: 1rem 0.75rem 0.75rem 0.75rem;
          margin-bottom: 1.25rem;
          overflow: hidden;
        }
        .el-axis-top {
          font-size: 0.7rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
          margin-bottom: 0.5rem;
          margin-left: 5.5rem;
          user-select: none;
        }
        .el-matrix-inner {
          display: flex;
          gap: 0;
        }
        .el-axis-left {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          padding-right: 0.5rem;
          gap: 2px;
          min-width: 4.5rem;
        }
        .el-axis-left-label {
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          font-size: 0.68rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
          position: absolute;
          left: 0.25rem;
          top: 50%;
          transform: rotate(180deg) translateX(50%);
          user-select: none;
          white-space: nowrap;
        }
        .el-row-label {
          font-size: 0.68rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          transition: color 0.2s, font-weight 0.2s;
          white-space: nowrap;
        }
        .el-row-label--active {
          color: var(--color-accent, #3b82f6);
          font-weight: 700;
        }
        .el-row-label--gap {
          opacity: 0.4;
          height: 14px;
        }
        .el-rows {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }
        .el-row {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 22px;
          transition: transform 0.2s;
        }
        .el-row--active {
          transform: scaleY(1.18);
          z-index: 1;
        }
        .el-row--gap {
          height: 14px;
          justify-content: center;
          opacity: 0.4;
        }
        .el-cell {
          width: 20px;
          height: 20px;
          border-radius: 3px;
          flex-shrink: 0;
          transition: background 0.25s;
        }
        .el-cell--active {
          box-shadow: 0 0 0 1px rgba(59,130,246,0.4);
        }
        .el-ellipsis-cell {
          font-size: 0.7rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-mono, monospace);
          padding: 0 0.25rem;
          align-self: center;
          flex-shrink: 0;
        }
        .el-gap-row-dots {
          font-size: 0.75rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
          letter-spacing: 0.15em;
        }
        .el-arrow {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 1rem;
          font-size: 0.8rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-accent, #3b82f6);
        }
        .el-arrow-line {
          flex: 1;
          height: 1px;
          background: var(--color-accent, #3b82f6);
          opacity: 0.35;
        }
        .el-extracted {
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          background: var(--color-bg, #fff);
          padding: 0.9rem 1rem;
        }
        .el-extracted-title {
          font-size: 0.82rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
          margin-bottom: 0.6rem;
        }
        .el-extracted-title strong {
          color: var(--color-accent, #3b82f6);
        }
        .el-vector {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          margin-bottom: 0.75rem;
          align-items: center;
        }
        .el-vec-bracket {
          font-size: 1.3rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-mono, monospace);
          line-height: 1;
        }
        .el-vec-val {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }
        .el-vec-cell {
          width: 48px;
          height: 32px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.68rem;
          font-family: var(--font-mono, monospace);
          font-weight: 600;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          transition: background 0.3s;
          flex-shrink: 0;
        }
        .el-vec-ellipsis {
          font-size: 0.85rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-mono, monospace);
          align-self: center;
          padding: 0 0.1rem;
        }
        .el-note {
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
          font-style: italic;
        }
        @media (max-width: 480px) {
          .el-cell {
            width: 14px;
            height: 14px;
          }
          .el-row {
            height: 16px;
          }
          .el-row--gap {
            height: 10px;
          }
          .el-row-label {
            height: 16px;
            font-size: 0.6rem;
          }
          .el-row-label--gap {
            height: 10px;
          }
          .el-vec-cell {
            width: 38px;
            height: 28px;
            font-size: 0.6rem;
          }
          .el-axis-left {
            min-width: 3.5rem;
          }
        }
      `}</style>

      {/* Token selector */}
      <div className="el-tabs">
        {TOKENS.map((token) => (
          <button
            key={token.id}
            className={`el-tab${selectedToken.id === token.id ? " el-tab--active" : ""}`}
            onClick={() => setSelectedToken(token)}
          >
            <span className="el-tab-text">{token.text}</span>
            <span className="el-tab-id">ID {token.id}</span>
          </button>
        ))}
      </div>

      {/* Embedding matrix */}
      <div className="el-matrix-wrap">
        <div className="el-axis-top">
          d_model (4,096 dimensions) →
        </div>
        <div style={{ position: "relative" }}>
          <span className="el-axis-left-label">vocab_size (100,000 rows) ↕</span>
        </div>
        <div className="el-matrix-inner">
          {/* Row labels */}
          <div className="el-axis-left" style={{ paddingLeft: "1.1rem" }}>
            {rows.map((row, i) => (
              <div
                key={i}
                className={[
                  "el-row-label",
                  row.gap ? "el-row-label--gap" : "",
                  !row.gap && String(selectedToken.id) === row.label ? "el-row-label--active" : "",
                ].filter(Boolean).join(" ")}
              >
                {row.label}
              </div>
            ))}
          </div>

          {/* Rows of cells */}
          <div className="el-rows">
            {rows.map((row, i) => {
              if (row.gap) {
                return (
                  <div key={i} className="el-row el-row--gap">
                    <span className="el-gap-row-dots">· · ·</span>
                  </div>
                );
              }
              const isActive = String(selectedToken.id) === row.label;
              const vals = isActive
                ? [...vector, ...fakeRowValues(row.seed + 99).slice(0, 4)]
                : fakeRowValues(row.seed);
              return (
                <div
                  key={i}
                  className={`el-row${isActive ? " el-row--active" : ""}`}
                >
                  {vals.slice(0, 12).map((v, ci) => (
                    <div
                      key={ci}
                      className={`el-cell${isActive ? " el-cell--active" : ""}`}
                      style={{ background: valueToColor(v, isActive) }}
                    />
                  ))}
                  <span className="el-ellipsis-cell">···</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Arrow / connector */}
      <div className="el-arrow">
        <span>row {selectedToken.id} extracted</span>
        <span className="el-arrow-line" />
        <span>↓</span>
      </div>

      {/* Extracted vector */}
      <div className="el-extracted">
        <div className="el-extracted-title">
          <strong>"{selectedToken.text}"</strong> (ID {selectedToken.id})
        </div>
        <div className="el-vector">
          <span className="el-vec-bracket">[</span>
          {vector.map((v, i) => (
            <div key={i} className="el-vec-val">
              <div
                className="el-vec-cell"
                style={{ background: valueToColor(v, true) }}
              >
                {v.toFixed(2)}
              </div>
            </div>
          ))}
          <span className="el-vec-ellipsis">···</span>
          <span className="el-vec-bracket">]</span>
        </div>
        <p className="el-note">
          Same token → same vector, always. No context, no computation — just a table lookup.
        </p>
      </div>
    </div>
  );
}
