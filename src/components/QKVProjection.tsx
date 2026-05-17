import { useState } from "react";

interface Token {
  name: string;
  Q: number[];
  K: number[];
  V: number[];
}

const TOKENS: Token[] = [
  { name: "The",  Q: [0.30, -0.10, 0.20, 0.15], K: [0.80, 0.10, -0.20, 0.30],  V: [0.15, 0.05, -0.10, 0.20] },
  { name: "cat",  Q: [0.90, 0.50, 0.10, -0.30], K: [0.20, 0.90, 0.60, -0.10],  V: [-0.40, 1.20, 0.80, -0.30] },
  { name: "sat",  Q: [0.10, 0.80, 0.50, 0.20],  K: [0.50, 0.30, 0.80, 0.40],   V: [0.60, -0.50, 1.10, 0.25] },
  { name: "on",   Q: [0.40, 0.20, 0.70, 0.50],  K: [-0.10, 0.60, 0.30, 0.70],  V: [0.10, 0.30, -0.15, 0.40] },
  { name: "the",  Q: [-0.20, 0.30, 0.60, 0.80], K: [0.70, 0.20, -0.10, 0.40],  V: [0.12, 0.08, -0.05, 0.15] },
  { name: "mat",  Q: [0.60, 0.70, 0.30, -0.20], K: [-0.30, 0.40, 0.50, 0.90],  V: [0.35, 0.95, -0.45, 0.70] },
];

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}


export default function QKVProjection() {
  const [queryIdx, setQueryIdx] = useState(1); // default: "cat"
  const query = TOKENS[queryIdx];

  const rawScores = TOKENS.map((t) => dot(query.Q, t.K));
  const maxScore = Math.max(...rawScores.map(Math.abs), 0.01);
  const weights = softmax(rawScores);


  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .qkv-token-row {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .qkv-tok {
          padding: 4px 10px;
          border: 1.5px solid var(--color-border, #e5e7eb);
          border-radius: 4px;
          font-size: 0.82rem;
          font-family: var(--font-mono, monospace);
          cursor: pointer;
          background: var(--color-bg, #fff);
          color: var(--color-text, #1f2937);
          transition: all 0.12s;
        }
        .qkv-tok:hover {
          border-color: var(--color-accent, #3b82f6);
        }
        .qkv-tok--active {
          background: #dbeafe;
          border-color: #3b82f6;
          color: #1e40af;
          font-weight: 600;
        }
        .qkv-tok--dim {
          opacity: 0.5;
        }

        /* Sections */
        .qkv-sections {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .qkv-section {
          padding: 0.75rem 1rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          background: var(--color-surface, #f8f9fa);
        }
        .qkv-section-title {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.35rem;
        }
        .qkv-section-desc {
          font-size: 0.8rem;
          color: var(--color-muted, #6b7280);
          line-height: 1.5;
          margin-bottom: 0.5rem;
        }

        /* Bar charts */
        .qkv-bar-chart {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .qkv-bar-row {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 18px;
        }
        .qkv-bar-val {
          font-size: 0.65rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-muted, #6b7280);
          min-width: 36px;
          text-align: right;
        }
        .qkv-bar-track {
          flex: 1;
          height: 12px;
          background: rgba(0,0,0,0.04);
          border-radius: 2px;
          overflow: hidden;
          display: flex;
        }
        .qkv-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        /* Score rows */
        .qkv-score-rows {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .qkv-score-row {
          display: grid;
          grid-template-columns: auto 1fr auto auto;
          gap: 0.5rem;
          align-items: center;
          padding: 4px 8px;
          border-radius: 4px;
          background: var(--color-bg, #fff);
          border: 1px solid var(--color-border, #e5e7eb);
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
        }
        .qkv-score-label {
          white-space: nowrap;
          min-width: 90px;
        }
        .qkv-score-bar-track {
          height: 14px;
          background: rgba(59, 130, 246, 0.08);
          border-radius: 3px;
          overflow: hidden;
        }
        .qkv-score-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        .qkv-score-val {
          font-weight: 700;
          min-width: 36px;
          text-align: right;
        }
        .qkv-score-weight {
          font-size: 0.68rem;
          color: var(--color-muted, #6b7280);
          min-width: 32px;
          text-align: right;
        }

        /* Q vector display */
        .qkv-query-display {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .qkv-query-vec-wrap {
          flex: 1;
          min-width: 160px;
        }

        /* V blend */
        .qkv-query-vec {
          font-family: var(--font-mono, monospace);
          font-size: 0.85rem;
          font-weight: 600;
          color: #1e40af;
          padding: 0.5rem 0.75rem;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 4px;
          display: inline-block;
        }
        .qkv-blend-note {
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
          font-style: italic;
          margin-top: 0.5rem;
          line-height: 1.5;
        }
        .qkv-legend {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-top: 0.5rem;
          font-size: 0.72rem;
          color: var(--color-muted, #6b7280);
        }
        .qkv-legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .qkv-swatch {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .qkv-output-box {
          margin-top: 0.75rem;
          padding: 0.75rem 1rem;
          border: 2px solid #8b5cf6;
          border-radius: var(--radius, 6px);
          background: #faf5ff;
        }
        .qkv-output-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #8b5cf6;
          margin-bottom: 0.25rem;
        }
        .qkv-output-vec {
          font-family: var(--font-mono, monospace);
          font-size: 0.85rem;
          font-weight: 600;
          color: #5b21b6;
          margin-bottom: 0.4rem;
        }
        .qkv-output-desc {
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .qkv-score-row {
            grid-template-columns: auto 1fr auto;
            font-size: 0.7rem;
          }
          .qkv-score-weight {
            display: none;
          }
        }
      `}</style>

      <div className="qkv-section-desc">
        Click a token to use as the <strong>query</strong> — the one asking "what should I attend to?"
      </div>

      <div className="qkv-token-row">
        {TOKENS.map((t, i) => (
          <button
            key={t.name + i}
            className={`qkv-tok${i === queryIdx ? " qkv-tok--active" : ""}`}
            onClick={() => setQueryIdx(i)}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="qkv-sections">
        {/* Step 1: Query */}
        <div className="qkv-section">
          <div className="qkv-section-title" style={{ color: "#3b82f6" }}>
            ① Query — "{query.name}" asks: what context do I need?
          </div>
          <div className="qkv-section-desc">
            The token's embedding is multiplied by a learned matrix W<sub>Q</sub> to produce a <strong>Query vector</strong> — a numeric encoding of what information this token is searching for.
          </div>
          <div className="qkv-query-vec">
            Q<sub>{query.name}</sub> = [{query.Q.map((v) => v.toFixed(2)).join(", ")}]
          </div>
        </div>

        {/* Step 2: Key matching */}
        <div className="qkv-section">
          <div className="qkv-section-title" style={{ color: "#10b981" }}>
            ② Keys — match the query against every token
          </div>
          <div className="qkv-section-desc">
            Every token has a <strong>Key vector</strong> (from W<sub>K</sub>) that advertises what it's about.
            The <strong>dot product</strong> <span style={{ color: "#3b82f6" }}>Q</span> · <span style={{ color: "#10b981" }}>K</span> measures alignment: when the query and key point in similar directions, the score is high. Each row below shows one token's match score.
          </div>
          <div className="qkv-score-rows">
            {TOKENS.map((t, i) => {
              const score = rawScores[i];
              const barPct = (Math.abs(score) / maxScore) * 100;
              const weight = weights[i];
              return (
                <div key={t.name + i} className="qkv-score-row">
                  <span className="qkv-score-label">
                    <span style={{ color: "#3b82f6" }}>Q<sub>{query.name}</sub></span>
                    {" · "}
                    <span style={{ color: "#10b981" }}>K<sub>{t.name}</sub></span>
                  </span>
                  <div className="qkv-score-bar-track">
                    <div
                      className="qkv-score-bar-fill"
                      style={{
                        width: `${barPct}%`,
                        background: "#3b82f6",
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="qkv-score-val">{score.toFixed(2)}</span>
                  <span className="qkv-score-weight">{(weight * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
          <div className="qkv-legend">
            <span className="qkv-legend-item"><span className="qkv-swatch" style={{ background: "#3b82f6" }} /> longer bar = stronger match</span>
            <span className="qkv-legend-item"><strong>%</strong> = attention weight after softmax</span>
          </div>
          <div className="qkv-blend-note">
            {(() => {
              const sorted = TOKENS
                .map((t, i) => ({ name: t.name, weight: weights[i] }))
                .sort((a, b) => b.weight - a.weight);
              const topWeight = sorted[0].weight;
              const bottomWeight = sorted[sorted.length - 1].weight;
              const spread = topWeight - bottomWeight;

              if (spread < 0.10) {
                return <><strong>Result:</strong> "{query.name}" spreads attention roughly evenly — no single token dominates.</>;
              }
              const top2 = sorted.slice(0, 2);
              if (top2[0].weight > top2[1].weight * 1.4) {
                return <><strong>Result:</strong> "{query.name}" attends most to "{top2[0].name}" ({(top2[0].weight * 100).toFixed(0)}%).</>;
              }
              return <><strong>Result:</strong> "{query.name}" attends most to "{top2[0].name}" ({(top2[0].weight * 100).toFixed(0)}%) and "{top2[1].name}" ({(top2[1].weight * 100).toFixed(0)}%).</>;
            })()}
          </div>
        </div>

        {/* Step 3: Value blend */}
        <div className="qkv-section">
          <div className="qkv-section-title" style={{ color: "#8b5cf6" }}>
            ③ Value — the blended output
          </div>
          <div className="qkv-section-desc">
            Each token has a <strong>Value vector</strong> (from W<sub>V</sub>) — the actual content it contributes.
            Using the attention weights from ②, all Value vectors are scaled and summed into a single output:
          </div>
          {(() => {
            const blended = TOKENS[0].V.map((_, d) =>
              TOKENS.reduce((sum, t, i) => sum + weights[i] * t.V[d], 0)
            );
            const sorted = TOKENS
              .map((t, i) => ({ name: t.name, weight: weights[i] }))
              .sort((a, b) => b.weight - a.weight);
            const top2 = sorted.slice(0, 2);
            return (
              <div className="qkv-output-box">
                <div className="qkv-output-label">Output for "{query.name}"</div>
                <div className="qkv-output-vec">
                  [{blended.map((v) => v.toFixed(2)).join(", ")}]
                </div>
                <div className="qkv-output-desc">
                  This vector replaces "{query.name}"'s original representation. It's no longer just the word "{query.name}" — it now encodes "{query.name}" <em>in the context of this sentence</em>, shaped most by the Values of "{top2[0].name}" and "{top2[1].name}." This context-aware vector flows into the next layer.
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
