/**
 * SearchEngineChooser — deterministic 4-question wizard that highlights
 * the recommended system(s) from the comparison table.
 *
 * Questions:
 *  1. Corpus size
 *  2. Already on Postgres?
 *  3. Query shape
 *  4. Operational appetite / hosting
 *
 * Each answer combination maps to a DecisionAnswer key which drives
 * which table rows are highlighted. No external state, no backend.
 */

import { useState } from 'react';
import {
  searchSystems,
  decisionResults,
  type DecisionAnswer,
  type SearchSystem,
} from '../data/search-engines';

// ── Question model ──────────────────────────────────────────────────────────

type Step = 'size' | 'postgres' | 'query' | 'ops';

interface Question {
  id: Step;
  text: string;
  options: { value: string; label: string }[];
}

const questions: Question[] = [
  {
    id: 'size',
    text: 'How many documents will you index?',
    options: [
      { value: 'small', label: 'Fewer than 100 K' },
      { value: 'medium', label: '100 K – 10 M' },
      { value: 'large', label: 'More than 10 M' },
    ],
  },
  {
    id: 'postgres',
    text: 'Are you already running PostgreSQL?',
    options: [
      { value: 'yes', label: 'Yes, Postgres is in the stack' },
      { value: 'no', label: 'No, or I want a dedicated search service' },
    ],
  },
  {
    id: 'query',
    text: 'What kind of queries will dominate?',
    options: [
      { value: 'keyword', label: 'Keyword / phrase / filters (exact text)' },
      { value: 'semantic', label: 'Semantic / meaning-based (vector)' },
      { value: 'logs', label: 'Log / event pattern search (TB+ of events)' },
    ],
  },
  {
    id: 'ops',
    text: 'How much operational overhead can you absorb?',
    options: [
      { value: 'zero', label: 'Zero — I want a hosted SaaS, cost is fine' },
      { value: 'some', label: 'Some — I can run a binary or small cluster' },
      { value: 'full', label: 'Full — I have a dedicated infra team' },
    ],
  },
];

// ── Answer → DecisionAnswer mapping ────────────────────────────────────────

function resolveAnswer(answers: Partial<Record<Step, string>>): DecisionAnswer | null {
  const { size, postgres, query, ops } = answers;
  if (!size || !postgres || !query || !ops) return null;

  if (size === 'large') {
    if (query === 'logs') return 'large-logs';
    if (ops === 'zero') return 'large-no-ops';
    return 'large-complex';
  }

  if (size === 'medium') {
    return postgres === 'yes' ? 'medium-postgres' : 'medium-new';
  }

  // small
  return postgres === 'yes' ? 'small-postgres' : 'small-new';
}

// ── Rendering helpers ───────────────────────────────────────────────────────

function featureBadge(val: SearchSystem['fullText'] | boolean | 'limited' | 'via-extension' | 'via-plugin') {
  if (val === 'excellent') return <span className="badge badge--green">Excellent</span>;
  if (val === true) return <span className="badge badge--green">Yes</span>;
  if (val === 'good') return <span className="badge badge--blue">Good</span>;
  if (val === 'yes') return <span className="badge badge--blue">Yes</span>;
  if (val === 'limited') return <span className="badge badge--grey">Limited</span>;
  if (val === 'via-extension') return <span className="badge badge--grey">Extension</span>;
  if (val === 'via-plugin') return <span className="badge badge--grey">Plugin</span>;
  if (val === 'minimal') return <span className="badge badge--grey">Minimal</span>;
  if (val === false || val === 'none') return <span className="badge badge--red">No</span>;
  return <span className="badge badge--grey">{String(val)}</span>;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SearchEngineChooser() {
  const [answers, setAnswers] = useState<Partial<Record<Step, string>>>({});
  const [activeStep, setActiveStep] = useState<number>(0);

  const decision = resolveAnswer(answers);
  const result = decision ? decisionResults[decision] : null;
  const highlightIds = result ? new Set(result.primary) : new Set<string>();

  function handleAnswer(step: Step, value: string) {
    const next = { ...answers, [step]: value };
    setAnswers(next);
    // advance to next unanswered question
    const nextIdx = questions.findIndex(
      (q, i) => i > questions.findIndex(q2 => q2.id === step) && next[q.id] === undefined
    );
    if (nextIdx !== -1) {
      setActiveStep(nextIdx);
    } else {
      // all answered — show result
      setActiveStep(questions.length);
    }
  }

  function reset() {
    setAnswers({});
    setActiveStep(0);
  }

  const allAnswered = questions.every(q => answers[q.id] !== undefined);

  return (
    <div className="sec-chooser">
      <h3 className="sec-chooser__title">Which search engine should you deploy?</h3>

      {/* Questions */}
      <div className="sec-chooser__questions">
        {questions.map((q, idx) => {
          const answered = answers[q.id] !== undefined;
          const isActive = idx === activeStep;
          const isPast = idx < activeStep || answered;

          return (
            <div
              key={q.id}
              className={[
                'sec-q',
                isActive ? 'sec-q--active' : '',
                answered ? 'sec-q--answered' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="sec-q__label">
                <span className="sec-q__num">{idx + 1}</span>
                <span className="sec-q__text">{q.text}</span>
              </div>
              <div className="sec-q__options">
                {q.options.map(opt => (
                  <button
                    key={opt.value}
                    className={[
                      'sec-q__btn',
                      answers[q.id] === opt.value ? 'sec-q__btn--selected' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleAnswer(q.id, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Result block */}
      {result && allAnswered && (
        <div className="sec-result">
          <div className="sec-result__head">
            Recommendation:{' '}
            {result.primary.map(id => {
              const s = searchSystems.find(x => x.id === id);
              return s ? <strong key={id} style={{ marginRight: '0.5rem' }}>{s.name}</strong> : null;
            })}
          </div>
          <p className="sec-result__rationale">{result.rationale}</p>
          {result.modifiers.length > 0 && (
            <ul className="sec-result__modifiers">
              {result.modifiers.map((m, i) => (
                <li key={i}>
                  <span className="sec-result__cond">{m.condition}:</span> {m.action}
                </li>
              ))}
            </ul>
          )}
          <button className="sec-result__reset" onClick={reset}>Start over</button>
        </div>
      )}

      {/* Comparison table */}
      <div className="sec-table-wrap">
        <table className="sec-table">
          <thead>
            <tr>
              <th>System</th>
              <th>License</th>
              <th>Full-text</th>
              <th>Vector</th>
              <th>Fuzzy</th>
              <th>Distributed</th>
              <th>Sweet spot</th>
            </tr>
          </thead>
          <tbody>
            {searchSystems.map(sys => (
              <tr
                key={sys.id}
                className={highlightIds.has(sys.id) ? 'sec-table__row--highlight' : ''}
              >
                <td className="sec-table__name">
                  {sys.name}
                  {highlightIds.has(sys.id) && (
                    <span className="sec-table__pick-badge" aria-label="Recommended">✓</span>
                  )}
                </td>
                <td className="sec-table__license">{sys.license}</td>
                <td>{featureBadge(sys.fullText)}</td>
                <td>{featureBadge(sys.vector)}</td>
                <td>{featureBadge(sys.fuzzy)}</td>
                <td>{featureBadge(sys.distributed)}</td>
                <td className="sec-table__sweet">{sys.sweetSpot}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .sec-chooser {
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          padding: 1.5rem;
          background: var(--color-surface, #f9fafb);
          margin: 2rem 0;
          font-size: 0.9rem;
        }
        .sec-chooser__title {
          margin: 0 0 1.25rem;
          font-size: 1rem;
          font-weight: 700;
        }
        .sec-chooser__questions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .sec-q {
          background: white;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          padding: 0.875rem 1rem;
          opacity: 0.55;
          pointer-events: none;
          transition: opacity 0.15s;
        }
        .sec-q--active, .sec-q--answered {
          opacity: 1;
          pointer-events: auto;
        }
        .sec-q__label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.625rem;
          font-weight: 600;
        }
        .sec-q__num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.4em;
          height: 1.4em;
          background: var(--color-accent, #3b82f6);
          color: white;
          border-radius: 50%;
          font-size: 0.75rem;
          font-weight: 700;
          flex-shrink: 0;
        }
        .sec-q__text {
          color: var(--color-text, #111827);
        }
        .sec-q__options {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .sec-q__btn {
          padding: 0.375rem 0.875rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--color-text, #374151);
          transition: background 0.1s, border-color 0.1s;
        }
        .sec-q__btn:hover {
          background: var(--color-accent-soft, #eff6ff);
          border-color: var(--color-accent, #3b82f6);
        }
        .sec-q__btn--selected {
          background: var(--color-accent, #3b82f6);
          border-color: var(--color-accent, #3b82f6);
          color: white;
        }
        .sec-result {
          background: var(--color-accent-soft, #eff6ff);
          border: 1px solid var(--color-accent, #3b82f6);
          border-left-width: 4px;
          border-radius: var(--radius, 6px);
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
        }
        .sec-result__head {
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .sec-result__rationale {
          margin: 0 0 0.5rem;
          color: var(--color-text, #374151);
          line-height: 1.6;
        }
        .sec-result__modifiers {
          margin: 0.5rem 0 0.75rem 1.25rem;
          padding: 0;
          line-height: 1.7;
        }
        .sec-result__cond {
          font-style: italic;
          color: var(--color-text-muted, #6b7280);
        }
        .sec-result__reset {
          background: none;
          border: 1px solid var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          border-radius: 4px;
          padding: 0.25rem 0.75rem;
          cursor: pointer;
          font-size: 0.8rem;
        }
        .sec-result__reset:hover {
          background: var(--color-accent, #3b82f6);
          color: white;
        }
        .sec-table-wrap {
          overflow-x: auto;
        }
        .sec-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.82rem;
        }
        .sec-table th {
          text-align: left;
          padding: 0.5rem 0.75rem;
          border-bottom: 2px solid var(--color-border, #e5e7eb);
          font-weight: 700;
          white-space: nowrap;
          background: white;
        }
        .sec-table td {
          padding: 0.45rem 0.75rem;
          border-bottom: 1px solid var(--color-border, #f3f4f6);
          vertical-align: top;
        }
        .sec-table__row--highlight td {
          background: #eff6ff;
        }
        .sec-table__row--highlight .sec-table__name {
          font-weight: 700;
          color: var(--color-accent, #2563eb);
        }
        .sec-table__name {
          white-space: nowrap;
          min-width: 10rem;
        }
        .sec-table__pick-badge {
          display: inline-block;
          margin-left: 0.35rem;
          background: var(--color-accent, #2563eb);
          color: white;
          border-radius: 3px;
          font-size: 0.65rem;
          padding: 0 0.3rem;
          vertical-align: middle;
          line-height: 1.5;
        }
        .sec-table__license {
          white-space: nowrap;
          color: var(--color-text-muted, #6b7280);
          font-size: 0.78rem;
        }
        .sec-table__sweet {
          color: var(--color-text-muted, #6b7280);
          font-size: 0.78rem;
          min-width: 14rem;
        }
        .badge {
          display: inline-block;
          padding: 0.1rem 0.45rem;
          border-radius: 3px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .badge--green { background: #d1fae5; color: #065f46; }
        .badge--blue  { background: #dbeafe; color: #1e40af; }
        .badge--grey  { background: #f3f4f6; color: #4b5563; }
        .badge--red   { background: #fee2e2; color: #991b1b; }
      `}</style>
    </div>
  );
}
