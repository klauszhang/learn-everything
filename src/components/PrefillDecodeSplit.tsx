import { useState, useEffect, useRef } from "react";

const PROMPT = ["The", " sky", " is"];
const GENERATED = [" blue", " because", " shorter", " wavelengths"];

type Phase = "idle" | "prefill" | "decode";

export default function PrefillDecodeSplit() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [prefillProgress, setPrefillProgress] = useState(0);
  const [decodeStep, setDecodeStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  function reset() {
    clearInterval(timerRef.current);
    setPhase("idle");
    setPrefillProgress(0);
    setDecodeStep(0);
  }

  function start() {
    reset();
    setPhase("prefill");
    setPrefillProgress(PROMPT.length);
    let tick = 0;
    timerRef.current = setInterval(() => {
      tick++;
      if (tick === 1) {
        setPhase("decode");
        setDecodeStep(0);
      } else {
        const ds = tick - 1;
        if (ds <= GENERATED.length) {
          setDecodeStep(ds);
        } else {
          clearInterval(timerRef.current);
        }
      }
    }, 700);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  const isPrefill = phase === "prefill";
  const isDecode = phase === "decode";
  const isDone = isDecode && decodeStep >= GENERATED.length;

  return (
    <div className="pds-root">
      {/* Token sequence */}
      <div className="pds-sequence">
        {PROMPT.map((tok, i) => {
          const lit = isPrefill && i < prefillProgress;
          return (
            <span
              key={"p" + i}
              className={`pds-tok pds-tok--prompt${lit ? " pds-tok--lit" : ""}`}
            >
              {tok}
            </span>
          );
        })}
        {isDecode &&
          GENERATED.slice(0, decodeStep).map((tok, i) => (
            <span
              key={"g" + i}
              className={`pds-tok pds-tok--gen${i === decodeStep - 1 ? " pds-tok--new" : ""}`}
            >
              {tok}
            </span>
          ))}
        {isDecode && !isDone && <span className="pds-cursor">▌</span>}
      </div>

      {/* Phase comparison cards */}
      <div className="pds-cards">
        <div className={`pds-card${isPrefill ? " pds-card--active" : ""}`}>
          <div className="pds-card-header">
            <span className="pds-badge pds-badge--prefill">Prefill</span>
            <span className="pds-card-sub">1 forward pass</span>
          </div>
          <div className="pds-card-body">
            <div className="pds-meter">
              <div className="pds-meter-label">Tokens processed</div>
              <div className="pds-meter-row">
                {PROMPT.map((_, i) => (
                  <div
                    key={i}
                    className={`pds-block${isPrefill && i < prefillProgress ? " pds-block--fill" : (isDecode || isDone) ? " pds-block--fill" : ""}`}
                  />
                ))}
              </div>
              <div className="pds-meter-caption">
                {isPrefill ? `${prefillProgress}/${PROMPT.length}` : isDecode || isDone ? "All at once" : `0/${PROMPT.length}`}
              </div>
            </div>
            <ul className="pds-facts">
              <li>All prompt tokens in <strong>parallel</strong></li>
              <li>Compute-bound (GPU saturated)</li>
              <li>Fast relative to token count</li>
            </ul>
          </div>
        </div>

        <div className={`pds-card${isDecode ? " pds-card--active" : ""}`}>
          <div className="pds-card-header">
            <span className="pds-badge pds-badge--decode">Decode</span>
            <span className="pds-card-sub">1 pass per token</span>
          </div>
          <div className="pds-card-body">
            <div className="pds-meter">
              <div className="pds-meter-label">Tokens generated</div>
              <div className="pds-meter-row">
                {GENERATED.map((_, i) => (
                  <div
                    key={i}
                    className={`pds-block pds-block--gen${i < decodeStep ? " pds-block--fill" : ""}`}
                  />
                ))}
              </div>
              <div className="pds-meter-caption">
                {isDecode || isDone ? `${decodeStep}/${GENERATED.length}` : `0/${GENERATED.length}`}
              </div>
            </div>
            <ul className="pds-facts">
              <li>One token at a time, <strong>sequential</strong></li>
              <li>Memory-bound (reading KV cache)</li>
              <li>Slow per token, but each step is small</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="pds-controls">
        <button className="pds-btn pds-btn--primary" onClick={start} disabled={phase !== "idle" && !isDone}>
          {phase === "idle" ? "Run generation →" : isDone ? "Run again →" : "Running…"}
        </button>
        <button className="pds-btn" onClick={reset} disabled={phase === "idle"}>
          Reset
        </button>
      </div>

      <p className="pds-note"><em>Illustrative timing — real models process much faster.</em></p>

      <style>{`
        .pds-root {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          background: var(--color-surface);
          max-width: var(--content-max);
          margin: var(--space-6) 0;
        }

        .pds-sequence {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
          align-items: center;
          margin-bottom: var(--space-6);
          min-height: 2.2rem;
          padding: var(--space-3);
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
        }

        .pds-tok {
          font-family: var(--font-mono);
          font-size: 0.88rem;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          border: 1px solid transparent;
          transition: background 0.2s, border-color 0.2s, opacity 0.2s;
          opacity: 0.35;
        }

        .pds-tok--prompt {
          background: var(--color-accent-soft);
          border-color: var(--color-border);
          color: #1e40af;
        }

        .pds-tok--lit {
          opacity: 1;
          border-color: var(--color-accent);
        }

        .pds-tok--gen {
          background: #f0fdf4;
          border-color: #86efac;
          color: #166534;
          opacity: 1;
        }

        .pds-tok--new {
          background: var(--color-accent);
          color: #fff;
          border-color: var(--color-accent);
          animation: pds-pop 0.2s ease-out;
        }

        @keyframes pds-pop {
          from { transform: scale(0.8); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }

        .pds-cursor {
          color: var(--color-accent);
          animation: pds-blink 1s step-end infinite;
          font-family: var(--font-mono);
        }

        @keyframes pds-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        .pds-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
        }

        .pds-card {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          padding: var(--space-4);
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .pds-card--active {
          border-color: var(--color-accent);
          box-shadow: 0 0 0 2px var(--color-accent-soft);
        }

        .pds-card-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .pds-badge {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
        }

        .pds-badge--prefill {
          background: var(--color-accent-soft);
          color: #1d4ed8;
          border: 1px solid var(--color-accent);
        }

        .pds-badge--decode {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #86efac;
        }

        .pds-card-sub {
          font-size: 0.78rem;
          color: var(--color-muted);
        }

        .pds-card-body {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .pds-meter {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .pds-meter-label {
          font-size: 0.72rem;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .pds-meter-row {
          display: flex;
          gap: 4px;
        }

        .pds-block {
          width: 28px;
          height: 20px;
          border-radius: 3px;
          background: var(--color-border);
          border: 1px solid var(--color-border);
          transition: background 0.25s, border-color 0.25s;
        }

        .pds-block--fill {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
        }

        .pds-block--gen.pds-block--fill {
          background: #dcfce7;
          border-color: #86efac;
        }

        .pds-meter-caption {
          font-size: 0.72rem;
          font-family: var(--font-mono);
          color: var(--color-muted);
        }

        .pds-facts {
          margin: 0;
          padding-left: 1.1rem;
          font-size: 0.82rem;
          color: var(--color-text);
          line-height: 1.6;
        }

        .pds-facts li {
          margin-bottom: 0.15rem;
        }

        .pds-controls {
          display: flex;
          gap: var(--space-3);
        }

        .pds-btn {
          padding: 0.4rem 1rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          font-size: 0.85rem;
          cursor: pointer;
          font-family: var(--font-body);
          transition: background 0.15s;
        }

        .pds-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }

        .pds-btn--primary {
          background: var(--color-accent);
          color: #fff;
          border-color: var(--color-accent);
          font-weight: 600;
        }

        .pds-btn--primary:not(:disabled):hover {
          background: #2563eb;
        }

        .pds-btn:not(.pds-btn--primary):not(:disabled):hover {
          background: var(--color-surface);
        }

        .pds-note {
          margin: var(--space-3) 0 0;
          font-size: 0.78rem;
          color: var(--color-muted);
        }

        @media (max-width: 600px) {
          .pds-cards {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
