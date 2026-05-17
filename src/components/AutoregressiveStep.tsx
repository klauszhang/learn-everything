import { useState } from "react";
import { GENERATION_STEPS, PROMPT_TOKENS } from "../data/generation";

// AutoregressiveStep.tsx — interactive demo for Ch 5.
// Walks through prefill + 6 decode steps. Illustrative — not real model output.

export default function AutoregressiveStep() {
  const [stepIndex, setStepIndex] = useState(0);

  const step = GENERATION_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === GENERATION_STEPS.length - 1;

  function advance() {
    if (!isLast) setStepIndex((i) => i + 1);
  }

  function reset() {
    setStepIndex(0);
  }

  return (
    <div className="ar-demo" aria-label="Autoregressive generation demo (illustrative)">
      {/* Token sequence */}
      <div className="ar-sequence" aria-label="Current token sequence">
        {step.tokens.map((tok, i) => {
          const isPrompt = i < PROMPT_TOKENS.length;
          const isNew = i === step.tokens.length - 1 && !isFirst;
          return (
            <span
              key={i}
              className={
                "ar-token" +
                (isPrompt ? " ar-token--prompt" : " ar-token--generated") +
                (isNew ? " ar-token--new" : "")
              }
              title={isPrompt ? "Prompt token" : isNew ? "Newly generated token" : "Generated token"}
            >
              {tok}
            </span>
          );
        })}
        {/* Blinking cursor on decode steps */}
        {!isLast && <span className="ar-cursor" aria-hidden="true">▌</span>}
      </div>

      {/* Phase badge + note */}
      <div className="ar-status">
        <span className={"ar-phase-badge ar-phase-badge--" + step.phase}>
          {step.phase === "prefill" ? "Prefill" : "Decode"}
        </span>
        <span className="ar-note">{step.note}</span>
      </div>

      {/* Step counter */}
      <div className="ar-counter" aria-label={`Step ${stepIndex + 1} of ${GENERATION_STEPS.length}`}>
        {GENERATION_STEPS.map((_, i) => (
          <span
            key={i}
            className={"ar-dot" + (i === stepIndex ? " ar-dot--active" : i < stepIndex ? " ar-dot--done" : "")}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Controls */}
      <div className="ar-controls">
        <button
          className="ar-btn ar-btn--secondary"
          onClick={reset}
          disabled={isFirst}
          aria-label="Reset to start"
        >
          Reset
        </button>
        <button
          className="ar-btn ar-btn--primary"
          onClick={advance}
          disabled={isLast}
          aria-label={isLast ? "Generation complete" : "Generate next token"}
        >
          {isLast ? "Done" : "Step →"}
        </button>
      </div>

      <p className="ar-label">
        <em>Illustrative — not real model output.</em>
      </p>

      <style>{`
        .ar-demo {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          background: var(--color-surface);
          max-width: var(--content-max);
          margin: var(--space-6) 0;
        }

        .ar-sequence {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
          align-items: center;
          margin-bottom: var(--space-4);
          min-height: 2.5rem;
        }

        .ar-token {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          border: 1px solid transparent;
          transition: background 0.2s, border-color 0.2s;
        }

        .ar-token--prompt {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
          color: #1e40af;
        }

        .ar-token--generated {
          background: #f0fdf4;
          border-color: #86efac;
          color: #166534;
        }

        .ar-token--new {
          background: #16a34a;
          border-color: #16a34a;
          color: #fff;
          animation: pop-in 0.2s ease-out;
        }

        @keyframes pop-in {
          from { transform: scale(0.8); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }

        .ar-cursor {
          color: var(--color-accent);
          animation: blink 1s step-end infinite;
          font-family: var(--font-mono);
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        .ar-status {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .ar-phase-badge {
          flex-shrink: 0;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          margin-top: 1px;
        }

        .ar-phase-badge--prefill {
          background: var(--color-accent-soft);
          color: #1d4ed8;
          border: 1px solid var(--color-accent);
        }

        .ar-phase-badge--decode {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #86efac;
        }

        .ar-note {
          font-size: 0.875rem;
          color: var(--color-muted);
          line-height: 1.5;
        }

        .ar-counter {
          display: flex;
          gap: 6px;
          margin-bottom: var(--space-4);
        }

        .ar-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-border);
          transition: background 0.15s;
        }

        .ar-dot--done {
          background: #86efac;
        }

        .ar-dot--active {
          background: var(--color-accent);
        }

        .ar-controls {
          display: flex;
          gap: var(--space-3);
        }

        .ar-btn {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          padding: 0.45rem 1.1rem;
          border-radius: var(--radius);
          border: 1px solid var(--color-border);
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }

        .ar-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }

        .ar-btn--primary {
          background: var(--color-accent);
          color: #fff;
          border-color: var(--color-accent);
        }

        .ar-btn--primary:not(:disabled):hover {
          background: #2563eb;
        }

        .ar-btn--secondary {
          background: var(--color-bg);
          color: var(--color-text);
        }

        .ar-btn--secondary:not(:disabled):hover {
          background: var(--color-surface);
        }

        .ar-label {
          margin: var(--space-4) 0 0;
          font-size: 0.8rem;
          color: var(--color-muted);
        }
      `}</style>
    </div>
  );
}
