import { useState } from "react";

type Config = "deep-narrow" | "balanced" | "wide-shallow";

const CONFIGS: Record<Config, { label: string; layers: number; width: number; desc: string }> = {
  "deep-narrow":  { label: "Deep & narrow",  layers: 6, width: 2, desc: "Many thinking steps, limited capacity each step" },
  "balanced":     { label: "Balanced",        layers: 4, width: 4, desc: "Moderate depth and width — the common sweet spot" },
  "wide-shallow": { label: "Wide & shallow",  layers: 2, width: 6, desc: "Few steps, but each step has high capacity" },
};

const DEPTH_EXAMPLES = [
  { task: "\"The trophy didn't fit in the suitcase because it was too big.\" — what does \"it\" refer to?", why: "Resolving \"it\" requires linking across clauses: find the pronoun, find candidates, check \"too big\" against each. Each step needs a separate layer." },
  { task: "\"Alice gave Bob the book that Carol wrote.\" — who wrote the book?", why: "Tracking nested relationships (give → book → wrote → Carol) requires composing information across multiple layers." },
];

const WIDTH_EXAMPLES = [
  { task: "\"The capital of the country that borders France to the east is ___\"", why: "Recalling \"Germany borders France to the east\" and \"Berlin is Germany's capital\" relies on the FFN's stored knowledge — wider FFN = more facts." },
  { task: "Translating between distant languages with different syntax", why: "Representing both source and target grammar simultaneously requires rich per-token vectors — more dimensions = more room." },
];

export default function DepthWidth() {
  const [config, setConfig] = useState<Config>("balanced");
  const c = CONFIGS[config];

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .dw-tabs {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }
        .dw-tab {
          padding: 0.35rem 0.75rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 999px;
          font-size: 0.78rem;
          font-family: var(--font-body, system-ui, sans-serif);
          background: var(--color-bg, #fff);
          color: var(--color-muted, #6b7280);
          cursor: pointer;
          transition: all 0.12s;
        }
        .dw-tab:hover { background: var(--color-surface, #f8f9fa); }
        .dw-tab--active {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }

        .dw-main {
          display: flex;
          gap: 1.5rem;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        /* Visual model shape */
        .dw-shape-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .dw-shape {
          display: flex;
          flex-direction: column;
          gap: 3px;
          transition: all 0.3s;
        }
        .dw-block {
          border-radius: 4px;
          background: #dbeafe;
          border: 1.5px solid #93c5fd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6rem;
          font-family: var(--font-mono, monospace);
          color: #1e40af;
          transition: all 0.3s;
        }
        .dw-axis-label {
          font-size: 0.65rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-mono, monospace);
        }
        .dw-shape-desc {
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          text-align: center;
          max-width: 160px;
          font-style: italic;
        }

        /* Explanation panel */
        .dw-panel {
          flex: 1;
          min-width: 260px;
        }
        .dw-section {
          margin-bottom: 0.75rem;
          padding: 0.6rem 0.75rem;
          border-radius: var(--radius, 6px);
          border: 1px solid var(--color-border, #e5e7eb);
          background: var(--color-surface, #f8f9fa);
        }
        .dw-section-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.3rem;
        }
        .dw-section-body {
          font-size: 0.8rem;
          color: var(--color-text, #1f2937);
          line-height: 1.5;
        }
        .dw-example {
          margin-top: 0.4rem;
          padding: 0.4rem 0.6rem;
          border-radius: 4px;
          background: var(--color-bg, #fff);
          border: 1px solid var(--color-border, #e5e7eb);
        }
        .dw-example-task {
          font-size: 0.78rem;
          font-style: italic;
          color: var(--color-text, #1f2937);
          margin-bottom: 0.2rem;
        }
        .dw-example-why {
          font-size: 0.72rem;
          color: var(--color-muted, #6b7280);
        }

        .dw-tradeoff {
          margin-top: 0.75rem;
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
          line-height: 1.5;
          padding: 0.5rem 0.75rem;
          border-left: 3px solid var(--color-accent, #3b82f6);
          background: var(--color-surface, #f8f9fa);
          border-radius: 0 4px 4px 0;
        }
      `}</style>

      <div className="dw-tabs">
        {(Object.entries(CONFIGS) as [Config, typeof CONFIGS[Config]][]).map(([key, val]) => (
          <button
            key={key}
            className={`dw-tab${config === key ? " dw-tab--active" : ""}`}
            onClick={() => setConfig(key)}
          >
            {val.label}
          </button>
        ))}
      </div>

      <div className="dw-main">
        {/* Visual shape */}
        <div className="dw-shape-wrap">
          <div className="dw-shape">
            {Array.from({ length: c.layers }, (_, i) => (
              <div
                key={i}
                className="dw-block"
                style={{
                  width: `${c.width * 28}px`,
                  height: `${Math.max(20, 120 / c.layers)}px`,
                }}
              >
                L{i + 1}
              </div>
            ))}
          </div>
          <div className="dw-axis-label">{c.layers} layers × d={c.width * 1024}</div>
          <div className="dw-shape-desc">{c.desc}</div>
        </div>

        {/* Explanation */}
        <div className="dw-panel">
          <div className="dw-section">
            <div className="dw-section-title" style={{ color: "#3b82f6" }}>
              Depth = thinking steps
            </div>
            <div className="dw-section-body">
              Each layer is another chance to transform and compose features. Multi-step reasoning — resolving pronouns, tracking nested clauses, chaining facts — needs multiple passes.
            </div>
            <div className="dw-example">
              <div className="dw-example-task">{DEPTH_EXAMPLES[0].task}</div>
              <div className="dw-example-why">{DEPTH_EXAMPLES[0].why}</div>
            </div>
          </div>

          <div className="dw-section">
            <div className="dw-section-title" style={{ color: "#10b981" }}>
              Width = thinking capacity
            </div>
            <div className="dw-section-body">
              Wider vectors mean richer representations per token and larger FFNs that store more factual knowledge. More attention heads can track more relationships in parallel.
            </div>
            <div className="dw-example">
              <div className="dw-example-task">{WIDTH_EXAMPLES[0].task}</div>
              <div className="dw-example-why">{WIDTH_EXAMPLES[0].why}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dw-tradeoff">
        <strong>The tradeoff:</strong> depth serializes (each layer waits for the previous one), while width parallelizes efficiently on GPUs. Recent research shows that scaling width faster than depth often produces better results — many early models were deeper than necessary.
      </div>
    </div>
  );
}
