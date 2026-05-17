import { useState } from "react";
import {
  haystack,
  needle,
  naiveSteps,
  kmpSteps,
  bmSteps,
  type AlgorithmStep,
} from "../data/pattern-matching";

type Algorithm = "naive" | "kmp" | "bm";

const ALGO_LABELS: Record<Algorithm, string> = {
  naive: "Naive",
  kmp: "KMP",
  bm: "Boyer-Moore",
};

const ALGO_STEPS: Record<Algorithm, AlgorithmStep[]> = {
  naive: naiveSteps,
  kmp: kmpSteps,
  bm: bmSteps,
};

const ALGO_DESC: Record<Algorithm, string> = {
  naive:
    "On mismatch: back up one position and restart from the beginning of the pattern.",
  kmp: "On mismatch: consult the failure table to find the furthest safe restart — never re-scan the text.",
  bm: "Compare from the right end of the pattern. On mismatch: use the bad-character rule to skip multiple positions.",
};

export default function PatternMatchStepper() {
  const [algo, setAlgo] = useState<Algorithm>("naive");
  const [stepIdx, setStepIdx] = useState(0);

  const steps = ALGO_STEPS[algo];
  const step = steps[Math.min(stepIdx, steps.length - 1)];
  const done = stepIdx >= steps.length;

  function handleAlgoChange(next: Algorithm) {
    setAlgo(next);
    setStepIdx(0);
  }

  function handleNext() {
    setStepIdx((i) => Math.min(i + 1, steps.length));
  }

  function handleReset() {
    setStepIdx(0);
  }

  // Which text chars are "in the window" for current alignment
  const windowStart = step?.textPos ?? 0;
  const windowEnd = windowStart + needle.length;

  return (
    <div className="pm-stepper" aria-label="Pattern match step-through demo (illustrative)">
      <p className="pm-illustrative">Illustrative trace — not real engine output.</p>

      {/* Algorithm picker */}
      <div className="pm-algo-row">
        {(["naive", "kmp", "bm"] as Algorithm[]).map((a) => (
          <button
            key={a}
            className={`pm-algo-btn${algo === a ? " pm-algo-btn--active" : ""}`}
            onClick={() => handleAlgoChange(a)}
          >
            {ALGO_LABELS[a]}
          </button>
        ))}
      </div>

      <p className="pm-desc">{ALGO_DESC[algo]}</p>

      {/* Text display */}
      <div className="pm-text-row" aria-label="Haystack">
        {haystack.split("").map((ch, i) => {
          let cls = "pm-char";
          if (!done && i >= windowStart && i < windowEnd) {
            const patIdx = i - windowStart;
            if (patIdx < step.patternPos) cls += " pm-char--matched-prev";
            else if (patIdx === step.patternPos) {
              cls += step.isMatch ? " pm-char--match" : " pm-char--mismatch";
            } else {
              cls += " pm-char--window";
            }
          }
          return (
            <span key={i} className={cls} aria-hidden="true">
              {ch}
            </span>
          );
        })}
      </div>
      <div className="pm-text-row pm-text-row--indices" aria-hidden="true">
        {haystack.split("").map((_, i) => (
          <span key={i} className="pm-char pm-char--idx">
            {i}
          </span>
        ))}
      </div>

      {/* Pattern display */}
      <div className="pm-pattern-label">Pattern:</div>
      <div className="pm-text-row pm-text-row--pattern" aria-label="Needle pattern">
        {needle.split("").map((ch, i) => {
          let cls = "pm-char";
          if (!done) {
            if (i < step.patternPos) cls += " pm-char--matched-prev";
            else if (i === step.patternPos) {
              cls += step.isMatch ? " pm-char--match" : " pm-char--mismatch";
            }
          }
          return (
            <span key={i} className={cls} aria-hidden="true">
              {ch}
            </span>
          );
        })}
      </div>

      {/* Status / note */}
      <div className="pm-status">
        {done ? (
          <span className="pm-status--done">All matches found in {steps.length} steps.</span>
        ) : (
          <>
            <span>
              Step {stepIdx + 1}/{steps.length} — align at {step.textPos}, compare pattern[{step.patternPos}]
              {step.isMatch ? (
                <span className="pm-ok"> ✓ match</span>
              ) : (
                <span className="pm-fail"> ✗ mismatch</span>
              )}
            </span>
            {step.jumped != null && (
              <span className="pm-skip"> → skip {step.jumped} positions</span>
            )}
            {step.note && <div className="pm-note">{step.note}</div>}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="pm-controls">
        <button onClick={handleReset} className="pm-btn">
          Reset
        </button>
        <button onClick={handleNext} disabled={done} className="pm-btn pm-btn--primary">
          Next step →
        </button>
        <span className="pm-step-count">
          {stepIdx}/{steps.length}
        </span>
      </div>

      <style>{`
        .pm-stepper {
          font-family: var(--font-body);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          margin: var(--space-6) 0;
        }
        .pm-illustrative {
          font-size: 0.75rem;
          color: var(--color-muted);
          margin: 0 0 var(--space-4);
          font-style: italic;
        }
        .pm-algo-row {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
          margin-bottom: var(--space-4);
        }
        .pm-algo-btn {
          padding: 0.35rem 0.9rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--color-text);
        }
        .pm-algo-btn--active {
          background: var(--color-accent);
          color: #fff;
          border-color: var(--color-accent);
        }
        .pm-desc {
          font-size: 0.875rem;
          color: var(--color-muted);
          margin: 0 0 var(--space-4);
        }
        .pm-text-row {
          display: flex;
          flex-wrap: nowrap;
          gap: 2px;
          margin-bottom: 2px;
          overflow-x: auto;
        }
        .pm-text-row--indices { margin-bottom: var(--space-2); }
        .pm-text-row--pattern { margin-bottom: var(--space-4); }
        .pm-pattern-label {
          font-size: 0.75rem;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 2px;
        }
        .pm-char {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 28px;
          border-radius: 3px;
          font-family: var(--font-mono);
          font-size: 0.85rem;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .pm-char--idx {
          font-size: 0.65rem;
          color: var(--color-muted);
          border: none;
          background: transparent;
          height: 16px;
        }
        .pm-char--window { background: #f0f4ff; border-color: #bfdbfe; }
        .pm-char--matched-prev { background: #dcfce7; border-color: #86efac; }
        .pm-char--match { background: #dcfce7; border-color: #22c55e; outline: 2px solid #22c55e; }
        .pm-char--mismatch { background: #fee2e2; border-color: #ef4444; outline: 2px solid #ef4444; }
        .pm-status {
          font-size: 0.875rem;
          min-height: 2.5rem;
          margin-bottom: var(--space-4);
          color: var(--color-text);
        }
        .pm-status--done { font-weight: 600; color: #166534; }
        .pm-ok { color: #166534; font-weight: 600; }
        .pm-fail { color: #b91c1c; font-weight: 600; }
        .pm-skip { color: var(--color-accent); font-weight: 600; }
        .pm-note {
          font-size: 0.8rem;
          color: var(--color-muted);
          font-style: italic;
          margin-top: 2px;
        }
        .pm-controls {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .pm-btn {
          padding: 0.4rem 1rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          cursor: pointer;
          font-size: 0.875rem;
          color: var(--color-text);
        }
        .pm-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .pm-btn--primary {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: #fff;
        }
        .pm-step-count {
          font-size: 0.8rem;
          color: var(--color-muted);
          margin-left: auto;
        }
      `}</style>
    </div>
  );
}
