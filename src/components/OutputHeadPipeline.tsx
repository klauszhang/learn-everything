import { useState } from "react";

const COLOR_ACCENT = "#3b82f6";
const COLOR_ACCENT_SOFT = "#dbeafe";
const COLOR_MUTED = "#6b7280";

const PREFIX = ["The", "sky", "is"];

const VOCAB = [
  { token: "blue",   logit: 4.2 },
  { token: "clear",  logit: 3.1 },
  { token: "dark",   logit: 2.5 },
  { token: "bright", logit: 1.8 },
  { token: "grey",   logit: 0.9 },
  { token: "red",    logit: -0.3 },
];

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

const PROBS = softmax(VOCAB.map((v) => v.logit));
const MAX_PROB = Math.max(...PROBS);
const TOP_IDX = PROBS.indexOf(MAX_PROB);

function Arrow() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "0.25rem 0" }}>
      <svg width="20" height="20"><path d="M10 2 L10 14 M5 10 L10 16 L15 10" stroke={COLOR_MUTED} strokeWidth="1.5" fill="none" /></svg>
    </div>
  );
}

function StageLabel({ num, title, sub }: { num: number; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.35rem" }}>
      <span style={{
        fontSize: "0.62rem", fontWeight: 700, width: 18, height: 18,
        borderRadius: "50%", display: "inline-flex", alignItems: "center",
        justifyContent: "center", background: COLOR_ACCENT, color: "#fff", flexShrink: 0,
      }}>{num}</span>
      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>{title}</span>
      <span style={{ fontSize: "0.75rem", color: COLOR_MUTED }}>{sub}</span>
    </div>
  );
}

export default function OutputHeadPipeline() {
  const [highlight, setHighlight] = useState<number | null>(null);

  return (
    <div className="ohp-root">
      {/* ① Sentence */}
      <StageLabel num={1} title="Input sequence" sub="only the last position matters" />
      <div className="ohp-sentence">
        {PREFIX.map((tok, i) => (
          <span key={i} className={`ohp-tok${i === PREFIX.length - 1 ? " ohp-tok--last" : ""}`}>
            {tok}
          </span>
        ))}
        <span className="ohp-blank">?</span>
      </div>

      <Arrow />

      {/* ② Hidden state */}
      <StageLabel num={2} title="Hidden state" sub={`d_model-dim vector for "${PREFIX[PREFIX.length - 1]}"`} />
      <div className="ohp-hidden-row">
        {[1.7, -0.3, 0.8, 2.1, -1.4, 0.6, 1.1, -0.8, 0.3, 1.5, -0.1, 0.9].map((v, i) => (
          <div key={i} className="ohp-dim" style={{
            background: `rgba(59,130,246,${0.12 + Math.abs(v) * 0.2})`,
          }}>
            {v.toFixed(1)}
          </div>
        ))}
        <span className="ohp-ellipsis">…</span>
      </div>

      <Arrow />

      {/* ③ LM head */}
      <StageLabel num={3} title="LM head" sub="linear projection → one score per vocab token" />
      <div className="ohp-lmhead-label">
        hidden state <span style={{ color: COLOR_MUTED, margin: "0 0.3rem" }}>×</span>
        <span style={{ color: "#6d28d9" }}>unembedding matrix</span>
        <span style={{ color: COLOR_MUTED, margin: "0 0.3rem" }}>=</span>
        logits
      </div>

      <Arrow />

      {/* ④ Logits → Softmax → Probabilities (the payoff) */}
      <StageLabel num={4} title="Logits → softmax → probabilities" sub="" />
      <div className="ohp-table">
        <div className="ohp-table-header">
          <span className="ohp-col-token">token</span>
          <span className="ohp-col-logit">logit</span>
          <span className="ohp-col-arrow"></span>
          <span className="ohp-col-prob">probability</span>
        </div>
        {VOCAB.map((v, i) => {
          const pct = PROBS[i] * 100;
          const isTop = i === TOP_IDX;
          const isHover = highlight === i;
          return (
            <div
              key={v.token}
              className={`ohp-table-row${isTop ? " ohp-table-row--top" : ""}${isHover ? " ohp-table-row--hover" : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseLeave={() => setHighlight(null)}
            >
              <span className="ohp-col-token" style={{ fontFamily: "ui-monospace, monospace", fontWeight: isTop ? 700 : 400 }}>
                {v.token}
              </span>
              <span className="ohp-col-logit" style={{ color: v.logit >= 0 ? "#1e40af" : "#dc2626" }}>
                {v.logit > 0 ? "+" : ""}{v.logit.toFixed(1)}
              </span>
              <span className="ohp-col-arrow">→</span>
              <span className="ohp-col-prob">
                <span className="ohp-bar-track">
                  <span
                    className="ohp-bar-fill"
                    style={{
                      width: `${(PROBS[i] / MAX_PROB) * 100}%`,
                      background: isTop ? COLOR_ACCENT : COLOR_ACCENT_SOFT,
                      borderColor: COLOR_ACCENT,
                    }}
                  />
                </span>
                <span className="ohp-bar-pct" style={{ color: isTop ? COLOR_ACCENT : "#374151", fontWeight: isTop ? 700 : 400 }}>
                  {pct < 1 ? "<1%" : pct.toFixed(0) + "%"}
                </span>
              </span>
            </div>
          );
        })}
        <div className="ohp-softmax-note">
          softmax: exp(logit) / Σ exp(all logits) — converts raw scores to probabilities that sum to 1
        </div>
      </div>

      {/* ⑤ Result */}
      <Arrow />
      <StageLabel num={5} title="Sample" sub="" />
      <div className="ohp-result">
        {PREFIX.map((tok, i) => (
          <span key={i} className="ohp-tok">{tok}</span>
        ))}
        <span className="ohp-tok ohp-tok--picked">{VOCAB[TOP_IDX].token}</span>
        <span className="ohp-result-note">
          greedy pick — or sample from the distribution for more variety
        </span>
      </div>

      <p className="ohp-note"><em>Illustrative logits — not from a real model.</em></p>

      <style>{`
        .ohp-root {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          background: var(--color-surface);
          max-width: var(--content-max);
          margin: var(--space-6) 0;
        }

        .ohp-sentence {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .ohp-tok {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          background: var(--color-accent-soft);
          border: 1px solid var(--color-accent);
          color: #1e40af;
        }

        .ohp-tok--last {
          font-weight: 700;
          box-shadow: 0 0 0 2px var(--color-accent-soft);
        }

        .ohp-tok--picked {
          background: var(--color-accent);
          color: #fff;
          font-weight: 700;
          border-color: var(--color-accent);
        }

        .ohp-blank {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          padding: 0.15rem 0.55rem;
          border-radius: 4px;
          background: var(--color-bg);
          border: 2px dashed var(--color-accent);
          color: var(--color-accent);
          font-weight: 700;
        }

        .ohp-hidden-row {
          display: flex;
          gap: 3px;
          align-items: center;
          overflow-x: auto;
        }

        .ohp-dim {
          width: 32px;
          height: 28px;
          border-radius: 4px;
          border: 1px solid ${COLOR_ACCENT};
          font-family: ui-monospace, monospace;
          font-size: 0.55rem;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1e40af;
          flex-shrink: 0;
        }

        .ohp-ellipsis {
          font-size: 0.8rem;
          color: var(--color-muted);
          margin-left: 2px;
        }

        .ohp-lmhead-label {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: #374151;
          padding: 0.5rem 0.75rem;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          text-align: center;
        }

        .ohp-table {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          overflow: hidden;
        }

        .ohp-table-header {
          display: flex;
          align-items: center;
          padding: 0.4rem 0.75rem;
          border-bottom: 1px solid var(--color-border);
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-muted);
        }

        .ohp-table-row {
          display: flex;
          align-items: center;
          padding: 0.3rem 0.75rem;
          font-size: 0.82rem;
          transition: background 0.1s;
        }

        .ohp-table-row:not(:last-of-type) {
          border-bottom: 1px solid #f3f4f6;
        }

        .ohp-table-row--hover {
          background: #f8fafc;
        }

        .ohp-table-row--top {
          background: var(--color-accent-soft);
        }

        .ohp-col-token {
          width: 64px;
          flex-shrink: 0;
        }

        .ohp-col-logit {
          width: 44px;
          flex-shrink: 0;
          font-family: var(--font-mono);
          font-size: 0.78rem;
          text-align: right;
        }

        .ohp-col-arrow {
          width: 28px;
          flex-shrink: 0;
          text-align: center;
          color: var(--color-muted);
          font-size: 0.78rem;
        }

        .ohp-col-prob {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .ohp-bar-track {
          flex: 1;
          height: 16px;
          background: #f3f4f6;
          border-radius: 3px;
          overflow: hidden;
        }

        .ohp-bar-fill {
          display: block;
          height: 100%;
          border-radius: 3px;
          border: 1px solid;
          transition: width 0.3s;
        }

        .ohp-bar-pct {
          width: 36px;
          flex-shrink: 0;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-align: right;
        }

        .ohp-softmax-note {
          padding: 0.4rem 0.75rem;
          border-top: 1px solid var(--color-border);
          font-size: 0.72rem;
          color: var(--color-muted);
          font-style: italic;
        }

        .ohp-result {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex-wrap: wrap;
        }

        .ohp-result-note {
          font-size: 0.78rem;
          color: var(--color-muted);
          margin-left: var(--space-1);
        }

        .ohp-note {
          margin: var(--space-4) 0 0;
          font-size: 0.78rem;
          color: var(--color-muted);
        }
      `}</style>
    </div>
  );
}
