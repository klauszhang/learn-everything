// LayerStack.tsx — interactive layer-hover demo for Ch 4.
// Hover a layer box to see a hedged one-sentence annotation.
// Data comes from src/data/layers.ts; all notes are illustrative.

import { useState } from "react";
import { LAYER_ANNOTATIONS } from "../data/layers";

export default function LayerStack() {
  const [activeLayer, setActiveLayer] = useState<number | null>(null);

  const layers = [...LAYER_ANNOTATIONS].reverse(); // render top layer first visually

  const activeNote =
    activeLayer !== null
      ? LAYER_ANNOTATIONS.find((l) => l.layer === activeLayer)?.note
      : null;

  return (
    <div className="layer-stack-demo" aria-label="Interactive layer stack diagram">
      <p className="layer-stack-hint">
        Hover a layer to see a note. All notes are illustrative — real layer
        specialization is messier than any simple label suggests.
      </p>

      <div className="layer-stack-layout">
        {/* Left column: residual stream arrow */}
        <div className="residual-stream" aria-hidden="true">
          <div className="residual-label">residual stream</div>
          <div className="residual-arrow">
            <svg
              width="24"
              height="100%"
              viewBox="0 0 24 300"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1="12"
                y1="290"
                x2="12"
                y2="16"
                stroke="var(--color-muted)"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              <polygon points="4,20 12,4 20,20" fill="var(--color-muted)" />
            </svg>
          </div>
        </div>

        {/* Right column: stacked layer boxes */}
        <div className="layer-boxes">
          {layers.map(({ layer, note }) => {
            const isActive = activeLayer === layer;
            return (
              <div
                key={layer}
                className={`layer-box${isActive ? " layer-box--active" : ""}`}
                onMouseEnter={() => setActiveLayer(layer)}
                onMouseLeave={() => setActiveLayer(null)}
                onFocus={() => setActiveLayer(layer)}
                onBlur={() => setActiveLayer(null)}
                tabIndex={0}
                role="button"
                aria-pressed={isActive}
                aria-label={`Layer ${layer} — hover for note`}
              >
                <span className="layer-box__label">Layer {layer}</span>
                <span className="layer-box__internals">
                  <span className="layer-box__block layer-box__attn">Attention</span>
                  <span className="layer-box__plus">+</span>
                  <span className="layer-box__block layer-box__ffn">FFN</span>
                </span>
              </div>
            );
          })}

          {/* Input embeddings at the bottom */}
          <div className="layer-input" aria-label="Input embeddings enter at the bottom">
            <span className="layer-input__label">↑ input embeddings</span>
          </div>
        </div>
      </div>

      {/* Note panel */}
      <div
        className={`layer-note-panel${activeNote ? " layer-note-panel--visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {activeNote ? (
          <>
            <span className="layer-note-panel__layer">Layer {activeLayer}</span>
            {" — "}
            {activeNote}
          </>
        ) : (
          <span className="layer-note-panel__placeholder">
            Hover a layer above to see a note.
          </span>
        )}
      </div>

      <style>{`
        .layer-stack-demo {
          font-family: var(--font-body);
          margin: var(--space-6) 0;
        }

        .layer-stack-hint {
          font-size: 0.875rem;
          color: var(--color-muted);
          margin-bottom: var(--space-4);
          font-style: italic;
        }

        .layer-stack-layout {
          display: flex;
          gap: var(--space-3);
          align-items: stretch;
        }

        /* Residual stream column */
        .residual-stream {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 64px;
          flex-shrink: 0;
          gap: var(--space-1);
        }

        .residual-label {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
          font-size: 0.7rem;
          color: var(--color-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .residual-arrow {
          flex: 1;
          width: 24px;
          min-height: 200px;
        }

        /* Layer boxes column */
        .layer-boxes {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .layer-box {
          border: 2px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-3) var(--space-4);
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          gap: var(--space-4);
          transition: border-color 0.15s ease, background 0.15s ease;
          background: var(--color-surface);
          outline: none;
        }

        .layer-box:hover,
        .layer-box:focus {
          border-color: var(--color-accent);
          background: var(--color-accent-soft);
        }

        .layer-box--active {
          border-color: var(--color-accent);
          background: var(--color-accent-soft);
        }

        .layer-box__label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-muted);
          min-width: 48px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .layer-box--active .layer-box__label {
          color: var(--color-accent);
        }

        .layer-box__internals {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
        }

        .layer-box__block {
          padding: var(--space-1) var(--space-3);
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
          border: 1px solid var(--color-border);
          background: var(--color-bg);
        }

        .layer-box__attn {
          color: #1e40af;
          border-color: #bfdbfe;
          background: #eff6ff;
        }

        .layer-box__ffn {
          color: #166534;
          border-color: #bbf7d0;
          background: #f0fdf4;
        }

        .layer-box__plus {
          color: var(--color-muted);
          font-size: 0.85rem;
          font-weight: 700;
        }

        .layer-input {
          border: 2px dashed var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-2) var(--space-4);
          text-align: center;
          margin-top: var(--space-1);
        }

        .layer-input__label {
          font-size: 0.8rem;
          color: var(--color-muted);
          font-style: italic;
        }

        /* Note panel */
        .layer-note-panel {
          margin-top: var(--space-4);
          min-height: 3.5rem;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          font-size: 0.9rem;
          line-height: 1.55;
          color: var(--color-muted);
          transition: border-color 0.15s ease;
        }

        .layer-note-panel--visible {
          border-color: var(--color-accent);
          color: var(--color-text);
        }

        .layer-note-panel__layer {
          font-weight: 700;
          color: var(--color-accent);
        }

        .layer-note-panel__placeholder {
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
