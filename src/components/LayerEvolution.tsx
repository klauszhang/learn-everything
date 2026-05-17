import { useState } from "react";

const TOKEN_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" },
  { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
];

type LayerRow = {
  layer: number;
  neighbors: [string, string, string];
  note: string;
};

const EVOLUTION: Record<"river" | "savings", LayerRow[]> = {
  river: [
    { layer: 1, neighbors: ["bank", "banks", "banking"], note: "Still looks like the generic word — no context yet" },
    { layer: 2, neighbors: ["bank", "river", "banks"], note: "Starting to notice \"river\" nearby" },
    { layer: 3, neighbors: ["shore", "river", "bank"], note: "\"shore\" appears — context is shifting meaning" },
    { layer: 4, neighbors: ["shore", "riverbank", "creek"], note: "Now clearly in the geography cluster" },
    { layer: 5, neighbors: ["muddy", "shore", "riverbank"], note: "Absorbing the predicate — \"was muddy\"" },
    { layer: 6, neighbors: ["muddy", "wet", "shore"], note: "Tuned for prediction: what word follows this context?" },
  ],
  savings: [
    { layer: 1, neighbors: ["bank", "banks", "banking"], note: "Same starting point — identical to \"river bank\"" },
    { layer: 2, neighbors: ["bank", "savings", "banks"], note: "Starting to notice \"savings\" nearby" },
    { layer: 3, neighbors: ["bank", "financial", "account"], note: "\"financial\" appears — meaning is diverging" },
    { layer: 4, neighbors: ["institution", "financial", "branch"], note: "Now clearly in the finance cluster" },
    { layer: 5, neighbors: ["closed", "institution", "branch"], note: "Absorbing the predicate — \"was closed\"" },
    { layer: 6, neighbors: ["closed", "shut", "reopened"], note: "Tuned for prediction: what comes next?" },
  ],
};

function neighborsAreIdentical(layerIndex: number): boolean {
  const r = EVOLUTION.river[layerIndex].neighbors;
  const s = EVOLUTION.savings[layerIndex].neighbors;
  return r[0] === s[0] && r[1] === s[1] && r[2] === s[2];
}

type Preset = "river" | "savings";

export default function LayerEvolution() {
  const [preset, setPreset] = useState<Preset>("river");

  const rows = EVOLUTION[preset];

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .le-tabs {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
        }
        .le-tab {
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
        .le-tab:hover {
          background: var(--color-surface, #f8f9fa);
        }
        .le-tab--active {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .le-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-body, system-ui, sans-serif);
          font-size: 0.88rem;
        }
        .le-table th {
          text-align: left;
          padding: 0.45rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-muted, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }
        .le-table td {
          padding: 0.6rem 0.75rem;
          vertical-align: middle;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }
        .le-row--even td {
          background: var(--color-surface, #f8f9fa);
        }
        .le-row--odd td {
          background: var(--color-bg, #fff);
        }
        .le-layer-badge {
          display: inline-block;
          font-family: var(--font-mono, monospace);
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-accent, #3b82f6);
          background: var(--color-accent-soft, #dbeafe);
          border: 1px solid var(--color-accent, #3b82f6);
          border-radius: 4px;
          padding: 0.1rem 0.45rem;
          min-width: 2.4rem;
          text-align: center;
        }
        .le-neighbors {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-wrap: wrap;
        }
        .le-chip {
          display: inline-block;
          padding: 0.18rem 0.55rem;
          border-radius: 4px;
          font-family: var(--font-mono, monospace);
          font-size: 0.82rem;
          border: 1px solid;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .le-identical-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.7rem;
          font-family: var(--font-body, system-ui, sans-serif);
          color: #6b7280;
          border: 1px dashed #9ca3af;
          border-radius: 999px;
          padding: 0.1rem 0.5rem;
          white-space: nowrap;
          background: #f9fafb;
        }
        .le-note {
          color: var(--color-muted, #6b7280);
          font-style: italic;
          font-size: 0.82rem;
        }
        .le-diverge-marker {
          display: inline-block;
          font-size: 0.7rem;
          background: #fef3c7;
          border: 1px solid #fbbf24;
          color: #92400e;
          border-radius: 999px;
          padding: 0.1rem 0.5rem;
          margin-left: 0.4rem;
          white-space: nowrap;
        }
        .le-insight {
          margin-top: 1.25rem;
          font-size: 0.85rem;
          color: var(--color-muted, #6b7280);
          font-style: italic;
          border-top: 1px solid var(--color-border, #e5e7eb);
          padding-top: 0.85rem;
        }
      `}</style>

      {/* Preset selector */}
      <div className="le-tabs">
        <button
          className={`le-tab${preset === "river" ? " le-tab--active" : ""}`}
          onClick={() => setPreset("river")}
        >
          river bank
        </button>
        <button
          className={`le-tab${preset === "savings" ? " le-tab--active" : ""}`}
          onClick={() => setPreset("savings")}
        >
          savings bank
        </button>
      </div>

      {/* Layer evolution table */}
      <table className="le-table">
        <thead>
          <tr>
            <th style={{ width: "3.5rem" }}>Layer</th>
            <th>"bank" is close to</th>
            <th>What changed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isIdentical = neighborsAreIdentical(i);
            const isDivergePoint = i === 2; // layer 3 (index 2) is first divergence
            return (
              <tr key={row.layer} className={i % 2 === 0 ? "le-row--even" : "le-row--odd"}>
                <td>
                  <span className="le-layer-badge">L{row.layer}</span>
                </td>
                <td>
                  <div className="le-neighbors">
                    {row.neighbors.map((word, wi) => (
                      <span
                        key={wi}
                        className="le-chip"
                        style={{
                          background: TOKEN_COLORS[wi].bg,
                          borderColor: TOKEN_COLORS[wi].border,
                          color: TOKEN_COLORS[wi].text,
                        }}
                      >
                        {word}
                      </span>
                    ))}
                    {isIdentical && (
                      <span className="le-identical-badge">= identical</span>
                    )}
                    {isDivergePoint && !isIdentical && (
                      <span className="le-diverge-marker">diverging</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="le-note">{row.note}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Bottom insight */}
      <p className="le-insight">
        Same token, same embedding — but by layer 4, context has pushed the representations apart. This is what depth gives you.
      </p>
    </div>
  );
}
