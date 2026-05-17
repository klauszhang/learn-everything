import { useState } from "react";
import { LAYER_ANNOTATIONS } from "../data/layers";

const TOKEN_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" },
  { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
];

const ZONE_LABELS: Record<string, string> = {
  early: "Early layers",
  middle: "Middle layers",
  late: "Late layers",
};
const ZONE_COLORS: Record<string, string> = {
  early: "#3b82f6",
  middle: "#8b5cf6",
  late: "#f59e0b",
};

type Preset = "river" | "savings";

const EVOLUTION: Record<Preset, Record<number, { neighbors: string[]; note: string }>> = {
  river: {
    1: { neighbors: ["bank", "banks", "banking"], note: "Still the generic word — no context yet" },
    2: { neighbors: ["bank", "river", "banks"], note: "Starting to notice \"river\" nearby" },
    3: { neighbors: ["shore", "river", "bank"], note: "\"shore\" appears — context shifting meaning" },
    4: { neighbors: ["shore", "riverbank", "creek"], note: "Now clearly in the geography cluster" },
    5: { neighbors: ["muddy", "shore", "riverbank"], note: "Absorbing the predicate — \"was muddy\"" },
    6: { neighbors: ["muddy", "wet", "shore"], note: "Tuned for prediction: what follows?" },
  },
  savings: {
    1: { neighbors: ["bank", "banks", "banking"], note: "Same starting point — identical to river bank" },
    2: { neighbors: ["bank", "savings", "banks"], note: "Starting to notice \"savings\" nearby" },
    3: { neighbors: ["bank", "financial", "account"], note: "\"financial\" appears — meaning diverging" },
    4: { neighbors: ["institution", "financial", "branch"], note: "Now clearly in the finance cluster" },
    5: { neighbors: ["closed", "institution", "branch"], note: "Absorbing the predicate — \"was closed\"" },
    6: { neighbors: ["closed", "shut", "reopened"], note: "Tuned for prediction: what comes next?" },
  },
};

export default function LayerStack() {
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  const [pinnedLayer, setPinnedLayer] = useState<number | null>(null);
  const [preset, setPreset] = useState<Preset>("river");

  const activeLayer = pinnedLayer ?? hoveredLayer;

  const layers = [...LAYER_ANNOTATIONS].reverse();

  const activeEntry =
    activeLayer !== null
      ? LAYER_ANNOTATIONS.find((l) => l.layer === activeLayer)
      : null;

  const evolution = activeLayer !== null ? EVOLUTION[preset][activeLayer] : null;
  const neighborsMatch = activeLayer !== null
    && EVOLUTION.river[activeLayer].neighbors.join() === EVOLUTION.savings[activeLayer].neighbors.join();

  return (
    <div className="ls-demo">
      {/* Preset toggle */}
      <div className="ls-preset-row">
        <span className="ls-preset-label">Track "bank" in:</span>
        <button className={`ls-tab${preset === "river" ? " ls-tab--active" : ""}`} onClick={() => setPreset("river")}>
          "The river bank was muddy"
        </button>
        <button className={`ls-tab${preset === "savings" ? " ls-tab--active" : ""}`} onClick={() => setPreset("savings")}>
          "The savings bank was closed"
        </button>
      </div>

      <div className="ls-layout">
        {/* Left: layer stack */}
        <div className="ls-stack">
          <div className="ls-io-label">→ prediction</div>
          {layers.map(({ layer }) => {
            const isActive = activeLayer === layer;
            return (
              <div
                key={layer}
                className={`ls-layer${isActive ? " ls-layer--active" : ""}`}
                onMouseEnter={() => setHoveredLayer(layer)}
                onMouseLeave={() => setHoveredLayer(null)}
                tabIndex={0}
                onClick={() => setPinnedLayer((prev) => prev === layer ? null : layer)}
                onFocus={() => setHoveredLayer(layer)}
                onBlur={() => setHoveredLayer(null)}
              >
                <span className="ls-layer-num">L{layer}</span>
                <span className="ls-layer-chips">
                  <span className="ls-chip ls-chip--norm">Norm</span>
                  <span className="ls-chip-arrow">→</span>
                  <span className="ls-chip ls-chip--attn">Attn</span>
                  <span className="ls-chip ls-chip--res">+</span>
                  <span className="ls-chip ls-chip--norm">Norm</span>
                  <span className="ls-chip-arrow">→</span>
                  <span className="ls-chip ls-chip--ffn">FFN</span>
                  <span className="ls-chip ls-chip--res">+</span>
                </span>
              </div>
            );
          })}
          <div className="ls-io-label">↑ embeddings</div>
        </div>

        {/* Right: detail panel */}
        <div className={`ls-panel${activeEntry ? " ls-panel--active" : ""}`}>
          {activeEntry && evolution ? (
            <>
              <div className="ls-panel-header">
                <span className="ls-panel-layer">Layer {activeLayer}</span>
                <span className="ls-panel-zone" style={{ color: ZONE_COLORS[activeEntry.zone], borderColor: ZONE_COLORS[activeEntry.zone] }}>
                  {ZONE_LABELS[activeEntry.zone]}
                </span>
              </div>
              <div className="ls-panel-note">{activeEntry.note}</div>

              <div className="ls-evolution">
                <div className="ls-evo-label">"bank" is nearest to:</div>
                <div className="ls-evo-neighbors">
                  {evolution.neighbors.map((word, i) => (
                    <span key={word} className="ls-evo-chip" style={{ background: TOKEN_COLORS[i].bg, borderColor: TOKEN_COLORS[i].border, color: TOKEN_COLORS[i].text }}>
                      {word}
                    </span>
                  ))}
                  {neighborsMatch && <span className="ls-evo-badge">= same in both sentences</span>}
                </div>
                <div className="ls-evo-note">{evolution.note}</div>
              </div>
            </>
          ) : (
            <div className="ls-panel-placeholder">
              Hover a layer to see how "bank" evolves at that depth.
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ls-demo {
          font-family: var(--font-body);
          margin: var(--space-6) 0;
          max-width: var(--content-max, 720px);
        }
        .ls-preset-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }
        .ls-preset-label {
          font-size: 0.78rem;
          color: var(--color-muted);
        }
        .ls-tab {
          padding: 0.3rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: 999px;
          font-size: 0.78rem;
          font-family: var(--font-body);
          background: var(--color-bg);
          color: var(--color-muted);
          cursor: pointer;
          transition: all 0.12s;
        }
        .ls-tab:hover { background: var(--color-surface); }
        .ls-tab--active {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
          color: var(--color-accent);
          font-weight: 600;
        }

        .ls-layout {
          display: flex;
          gap: 0.75rem;
          align-items: stretch;
        }
        @media (max-width: 640px) {
          .ls-layout { flex-direction: column; }
        }

        /* Stack */
        .ls-stack {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex-shrink: 0;
        }
        .ls-io-label {
          font-size: 0.65rem;
          color: var(--color-muted);
          font-style: italic;
          text-align: center;
          padding: 2px 0;
        }
        .ls-layer {
          border: 1.5px solid var(--color-border);
          border-radius: 4px;
          padding: 4px 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: border-color 0.15s, background 0.15s;
          background: var(--color-surface);
          outline: none;
        }
        .ls-layer:hover, .ls-layer:focus, .ls-layer--active {
          border-color: var(--color-accent);
          background: var(--color-accent-soft);
        }
        .ls-layer-num {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--color-muted);
          font-family: var(--font-mono);
          min-width: 18px;
        }
        .ls-layer--active .ls-layer-num { color: var(--color-accent); }
        .ls-layer-chips {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-wrap: wrap;
        }
        .ls-chip {
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 0.6rem;
          font-weight: 600;
          border: 1px solid;
          white-space: nowrap;
        }
        .ls-chip--norm { color: #854d0e; background: #fefce8; border-color: #fde68a; }
        .ls-chip--attn { color: #1e40af; background: #eff6ff; border-color: #bfdbfe; }
        .ls-chip--ffn  { color: #166534; background: #f0fdf4; border-color: #bbf7d0; }
        .ls-chip--res  { color: #7e22ce; background: #fdf4ff; border-color: #e9d5ff; }
        .ls-chip-arrow { font-size: 0.55rem; color: var(--color-muted); }

        /* Panel */
        .ls-panel {
          flex: 1;
          min-width: 0;
          padding: 0.6rem 0.75rem;
          border-radius: var(--radius);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          transition: border-color 0.15s;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .ls-panel--active {
          border-color: var(--color-accent);
        }
        .ls-panel-placeholder {
          font-size: 0.82rem;
          color: var(--color-muted);
          font-style: italic;
          text-align: center;
        }
        .ls-panel-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.3rem;
        }
        .ls-panel-layer {
          font-weight: 700;
          color: var(--color-accent);
          font-size: 0.85rem;
        }
        .ls-panel-zone {
          font-size: 0.65rem;
          font-weight: 600;
          padding: 1px 6px;
          border: 1px solid;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .ls-panel-note {
          font-size: 0.82rem;
          line-height: 1.5;
          color: var(--color-text);
          margin-bottom: 0.5rem;
        }

        /* Evolution */
        .ls-evolution {
          padding-top: 0.5rem;
          border-top: 1px dashed var(--color-border);
        }
        .ls-evo-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.3rem;
        }
        .ls-evo-neighbors {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          flex-wrap: wrap;
          margin-bottom: 0.3rem;
        }
        .ls-evo-chip {
          padding: 2px 8px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 0.78rem;
          border: 1px solid;
          transition: all 0.2s;
        }
        .ls-evo-badge {
          font-size: 0.65rem;
          color: #6b7280;
          border: 1px dashed #9ca3af;
          border-radius: 999px;
          padding: 1px 6px;
          background: #f9fafb;
        }
        .ls-evo-note {
          font-size: 0.78rem;
          color: var(--color-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
