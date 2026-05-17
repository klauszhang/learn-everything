/**
 * Inconsistency — interactive demo showing the same factual question phrased
 * five ways, with hand-authored responses that disagree on one specific detail.
 *
 * All data is illustrative — not from a real model.
 * Topic: Voyager 1 launch date.
 */
import { useState } from "react";
import { CONSISTENCY_SET } from "../data/hallucination";

const { phrasings, responses, inconsistentDetail, consistentFact } =
  CONSISTENCY_SET;

// Which response indices contain the inconsistency (August 20 vs September 5)
const INCONSISTENT_IDX = new Set([2]); // phrasing index 2 gives wrong date

export default function Inconsistency() {
  const [selected, setSelected] = useState<number | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const isInconsistent = selected !== null && INCONSISTENT_IDX.has(selected);

  return (
    <div className="inc-root">
      <p className="inc-intro">
        Select a phrasing to see an illustrative model response. The same
        question — five ways. Notice whether the answers agree.
        <span className="inc-note"> Illustrative — not real model output.</span>
      </p>

      <div className="inc-phrasings">
        {phrasings.map((p, i) => (
          <button
            key={i}
            className={`inc-phrasing${selected === i ? " inc-phrasing--active" : ""}`}
            onClick={() => {
              setSelected(i);
              setShowAnalysis(false);
            }}
          >
            <span className="inc-phrasing-num">{i + 1}</span>
            <span className="inc-phrasing-text">{p}</span>
          </button>
        ))}
      </div>

      {selected !== null && (
        <div className={`inc-response${isInconsistent ? " inc-response--flagged" : ""}`}>
          <div className="inc-response-label">
            {isInconsistent ? (
              <span className="inc-flag">Inconsistency detected</span>
            ) : (
              <span className="inc-ok">Response</span>
            )}
          </div>
          <p className="inc-response-text">{responses[selected]}</p>
          {isInconsistent && (
            <p className="inc-response-hint">
              Compare this response to phrasings 1, 4, and 5. One date doesn't match.
            </p>
          )}
        </div>
      )}

      <button
        className="inc-analysis-btn"
        onClick={() => setShowAnalysis((v) => !v)}
      >
        {showAnalysis ? "Hide analysis" : "Show analysis"}
      </button>

      {showAnalysis && (
        <div className="inc-analysis">
          <p>
            <strong>Inconsistent detail:</strong> {inconsistentDetail}
          </p>
          <p>
            <strong>What all responses agree on:</strong> {consistentFact}
          </p>
          <p className="inc-analysis-note">
            Inconsistency across phrasings is a signal of hallucination, not
            proof. Consistent wrong answers exist too — the model can be
            systematically wrong. Consistency is a necessary condition for
            confidence, not a sufficient one.
          </p>
        </div>
      )}

      <style>{`
        .inc-root {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          background: var(--color-surface);
          max-width: var(--content-max);
          margin: var(--space-6) 0;
        }

        .inc-intro {
          margin: 0 0 var(--space-4);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .inc-note {
          color: var(--color-muted);
          font-size: 0.8rem;
          margin-left: 0.25em;
        }

        .inc-phrasings {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
        }

        .inc-phrasing {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          cursor: pointer;
          text-align: left;
          transition: background 0.15s, border-color 0.15s;
          font-size: 0.9rem;
          color: var(--color-text);
        }

        .inc-phrasing:hover {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
        }

        .inc-phrasing--active {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
          font-weight: 500;
        }

        .inc-phrasing-num {
          flex-shrink: 0;
          width: 1.4em;
          height: 1.4em;
          border-radius: 50%;
          background: var(--color-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-muted);
        }

        .inc-phrasing--active .inc-phrasing-num {
          background: var(--color-accent);
          color: #fff;
        }

        .inc-phrasing-text {
          line-height: 1.4;
          font-family: var(--font-mono);
          font-size: 0.85rem;
        }

        .inc-response {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-4);
          background: var(--color-bg);
          margin-bottom: var(--space-4);
          transition: border-color 0.2s;
        }

        .inc-response--flagged {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .inc-response-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: var(--space-2);
        }

        .inc-ok {
          color: var(--color-muted);
        }

        .inc-flag {
          color: #b91c1c;
        }

        .inc-response-text {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .inc-response-hint {
          margin: var(--space-2) 0 0;
          font-size: 0.82rem;
          color: #b91c1c;
          font-style: italic;
        }

        .inc-analysis-btn {
          padding: 0.35rem 0.9rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          font-size: 0.82rem;
          cursor: pointer;
          color: var(--color-text);
          margin-bottom: var(--space-4);
          transition: background 0.15s, border-color 0.15s;
        }

        .inc-analysis-btn:hover {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
        }

        .inc-analysis {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-4);
          background: var(--color-bg);
          font-size: 0.88rem;
          line-height: 1.6;
        }

        .inc-analysis p {
          margin: 0 0 var(--space-3);
        }

        .inc-analysis p:last-child {
          margin-bottom: 0;
        }

        .inc-analysis-note {
          color: var(--color-muted);
          font-style: italic;
          font-size: 0.82rem;
        }
      `}</style>
    </div>
  );
}
