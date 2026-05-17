import { useState } from "react";

// Palette of soft accent colors for token highlighting.
const TOKEN_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" }, // blue
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" }, // green
  { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" }, // violet
  { bg: "#fce7f3", border: "#f9a8d4", text: "#831843" }, // pink
  { bg: "#e0f2fe", border: "#7dd3fc", text: "#075985" }, // sky
  { bg: "#dcfce7", border: "#86efac", text: "#14532d" }, // emerald
  { bg: "#fef9c3", border: "#fde047", text: "#713f12" }, // yellow
  { bg: "#f3e8ff", border: "#d8b4fe", text: "#581c87" }, // purple
];

// A stable color index per token string so the same token always gets the same color.
function tokenColorIndex(token: string, vocab: string[]): number {
  const idx = vocab.indexOf(token);
  return idx >= 0 ? idx % TOKEN_COLORS.length : 0;
}

interface WordState {
  word: string;
  tokens: string[];
  count: number;
}

interface PairCount {
  pair: string;
  count: number;
}

interface StepState {
  stepLabel: string;
  mergeDescription: string; // what merge was JUST applied (empty for step 0)
  mergePair: [string, string] | null; // the pair that was just merged
  corpus: WordState[];
  pairCounts: PairCount[]; // top pairs BEFORE next merge (i.e. what's available now)
  nextMergePair: [string, string] | null; // the pair that WILL be merged next
  vocab: string[]; // ordered: base chars first, then in order of creation
  newVocabEntry: string | null; // token added in this step (for highlight)
}

// ---------------------------------------------------------------------------
// Pre-computed BPE state machine
// ---------------------------------------------------------------------------

// Helper: count adjacent pairs across the whole corpus
function countPairs(corpus: WordState[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { tokens, count } of corpus) {
    for (let i = 0; i < tokens.length - 1; i++) {
      const key = `${tokens[i]} ${tokens[i + 1]}`;
      counts.set(key, (counts.get(key) ?? 0) + count);
    }
  }
  return counts;
}

// Helper: apply a merge to the corpus
function applyMerge(
  corpus: WordState[],
  a: string,
  b: string
): WordState[] {
  return corpus.map(({ word, tokens, count }) => {
    const next: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (tokens[i] === a && i + 1 < tokens.length && tokens[i + 1] === b) {
        next.push(a + b);
        i += 2;
      } else {
        next.push(tokens[i]);
        i++;
      }
    }
    return { word, tokens: next, count };
  });
}

// Helper: top-N pairs sorted by count desc, then pair string asc (for stability)
function topPairs(pairMap: Map<string, number>, n = 5): PairCount[] {
  return [...pairMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([pair, count]) => ({ pair, count }));
}

// Build all steps
function buildSteps(): StepState[] {
  const steps: StepState[] = [];

  // Initial corpus (character-level, word-boundary approach: spaces not shown,
  // each word entry is independent).
  let corpus: WordState[] = [
    { word: "low",    tokens: ["l", "o", "w"],          count: 4 },
    { word: "lower",  tokens: ["l", "o", "w", "e", "r"], count: 2 },
    { word: "newest", tokens: ["n", "e", "w", "e", "s", "t"], count: 3 },
    { word: "widest", tokens: ["w", "i", "d", "e", "s", "t"], count: 1 },
  ];

  // Base vocabulary = all distinct characters in initial corpus, sorted
  const baseVocab: string[] = [
    ...new Set(corpus.flatMap((w) => w.tokens)),
  ].sort();

  let vocab = [...baseVocab];

  // Merges to apply in order (pre-determined)
  const merges: [string, string][] = [
    ["e", "s"],
    ["es", "t"],
    ["l", "o"],
    ["lo", "w"],
    ["n", "e"],
    ["ne", "w"],
    ["new", "est"],
    ["low", "e"],
    ["lowe", "r"],
  ];

  // Step 0: initial state (no merge applied yet)
  {
    const pairMap = countPairs(corpus);
    const [nextA, nextB] = merges[0];
    steps.push({
      stepLabel: "Initial state",
      mergeDescription: "",
      mergePair: null,
      corpus: corpus.map((w) => ({ ...w, tokens: [...w.tokens] })),
      pairCounts: topPairs(pairMap),
      nextMergePair: [nextA, nextB],
      vocab: [...vocab],
      newVocabEntry: null,
    });
  }

  // Steps 1–9: apply each merge
  for (let mi = 0; mi < merges.length; mi++) {
    const [a, b] = merges[mi];
    corpus = applyMerge(corpus, a, b);
    const merged = a + b;
    vocab = [...vocab, merged];

    const pairMap = countPairs(corpus);
    const nextMergePair =
      mi + 1 < merges.length ? merges[mi + 1] : null;

    steps.push({
      stepLabel: `Merge ${mi + 1} of ${merges.length}`,
      mergeDescription: `Merged "${a}" + "${b}" → "${merged}"`,
      mergePair: [a, b],
      corpus: corpus.map((w) => ({ ...w, tokens: [...w.tokens] })),
      pairCounts: topPairs(pairMap),
      nextMergePair,
      vocab: [...vocab],
      newVocabEntry: merged,
    });
  }

  return steps;
}

const STEPS = buildSteps();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BPEMergesStepper() {
  const [stepIdx, setStepIdx] = useState(0);
  const [highlightMerge, setHighlightMerge] = useState(false);

  const step = STEPS[stepIdx];
  const totalMerges = STEPS.length - 1; // step 0 is "initial"

  function goNext() {
    if (stepIdx < STEPS.length - 1) {
      setHighlightMerge(true);
      setStepIdx((i) => i + 1);
      setTimeout(() => setHighlightMerge(false), 800);
    }
  }

  function goPrev() {
    if (stepIdx > 0) {
      setStepIdx((i) => i - 1);
      setHighlightMerge(false);
    }
  }

  function reset() {
    setStepIdx(0);
    setHighlightMerge(false);
  }

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        /* ---- Controls ---- */
        .bpe-controls {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
        }
        .bpe-step-label {
          font-size: 0.85rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
          flex: 1 0 auto;
        }
        .tc-tab {
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
        .tc-tab:hover:not(:disabled) {
          background: var(--color-surface, #f8f9fa);
        }
        .tc-tab:disabled {
          opacity: 0.38;
          cursor: default;
        }
        .tc-tab--accent {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .tc-tab--accent:hover:not(:disabled) {
          background: var(--color-accent-soft, #dbeafe);
        }

        /* ---- Merge description banner ---- */
        .bpe-merge-banner {
          font-size: 0.88rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-accent, #3b82f6);
          background: var(--color-accent-soft, #dbeafe);
          border: 1px solid var(--color-accent, #3b82f6);
          border-radius: var(--radius, 6px);
          padding: 0.45rem 0.85rem;
          margin-bottom: 1.25rem;
          min-height: 2.1rem;
        }
        .bpe-merge-banner--empty {
          color: var(--color-muted, #6b7280);
          background: var(--color-surface, #f8f9fa);
          border-color: var(--color-border, #e5e7eb);
          font-family: var(--font-body, system-ui, sans-serif);
          font-style: italic;
        }

        /* ---- Corpus ---- */
        .bpe-corpus {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .bpe-word-block {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.45rem;
        }
        .bpe-word-label {
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .bpe-word-label strong {
          color: inherit;
          font-family: var(--font-mono, monospace);
        }
        .bpe-token-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.28rem;
        }
        .bpe-token {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-family: var(--font-mono, monospace);
          font-size: 0.88rem;
          border: 1px solid;
          white-space: pre;
          transition: box-shadow 0.15s, border-width 0.15s;
        }
        .bpe-token--highlight {
          box-shadow: 0 0 0 2px var(--color-accent, #3b82f6);
          border-color: var(--color-accent, #3b82f6) !important;
        }

        /* ---- Two-panel grid ---- */
        .bpe-panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 640px) {
          .bpe-panels {
            grid-template-columns: 1fr;
          }
        }
        .bpe-panel {
          background: var(--color-surface, #f8f9fa);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          padding: 0.85rem 1rem;
        }
        .bpe-panel-title {
          font-size: 0.78rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-muted, #6b7280);
          margin-bottom: 0.65rem;
          font-family: var(--font-body, system-ui, sans-serif);
        }

        /* ---- Pair frequencies ---- */
        .bpe-pair-list {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .bpe-pair-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          font-family: var(--font-mono, monospace);
          font-size: 0.85rem;
          color: var(--color-muted, #6b7280);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }
        .bpe-pair-row--winner {
          background: var(--color-accent-soft, #dbeafe);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .bpe-pair-count {
          font-size: 0.78rem;
          opacity: 0.75;
        }

        /* ---- Vocabulary chips ---- */
        .bpe-vocab-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-bottom: 0.5rem;
        }
        .bpe-chip {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          border: 1px solid var(--color-border, #e5e7eb);
          font-family: var(--font-mono, monospace);
          font-size: 0.78rem;
          background: var(--color-bg, #fff);
          color: var(--color-muted, #6b7280);
        }
        .bpe-chip--new {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .bpe-vocab-size {
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
        }
      `}</style>

      {/* Controls */}
      <div className="bpe-controls">
        <span className="bpe-step-label">
          {stepIdx === 0
            ? `Initial state — ${totalMerges} merges to go`
            : `Step ${stepIdx} of ${totalMerges}`}
        </span>
        <button className="tc-tab" onClick={goPrev} disabled={stepIdx === 0}>
          ← Prev
        </button>
        <button
          className="tc-tab tc-tab--accent"
          onClick={goNext}
          disabled={stepIdx === STEPS.length - 1}
        >
          Next merge →
        </button>
        <button className="tc-tab" onClick={reset} disabled={stepIdx === 0}>
          Reset
        </button>
      </div>

      {/* Merge banner */}
      <div
        className={`bpe-merge-banner${step.mergeDescription ? "" : " bpe-merge-banner--empty"}`}
      >
        {step.mergeDescription || `Click “Next merge” to begin BPE training.`}
      </div>

      {/* Corpus */}
      <div className="bpe-corpus">
        {step.corpus.map(({ word, tokens, count }) => (
          <div key={word} className="bpe-word-block">
            <div className="bpe-word-label">
              <strong>"{word}"</strong> ×{count}
            </div>
            <div className="bpe-token-row">
              {tokens.map((tok, ti) => {
                const colorIdx = tokenColorIndex(tok, step.vocab);
                const color = TOKEN_COLORS[colorIdx % TOKEN_COLORS.length];

                // Highlight this token if it IS the merged result and we just merged
                const isNewlyMerged =
                  highlightMerge &&
                  step.mergePair !== null &&
                  tok === step.mergePair[0] + step.mergePair[1];

                return (
                  <span
                    key={ti}
                    className={`bpe-token${isNewlyMerged ? " bpe-token--highlight" : ""}`}
                    style={{
                      background: color.bg,
                      borderColor: isNewlyMerged
                        ? "var(--color-accent, #3b82f6)"
                        : color.border,
                      color: color.text,
                    }}
                  >
                    {tok}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Two panels */}
      <div className="bpe-panels">
        {/* Left: Pair frequencies */}
        <div className="bpe-panel">
          <div className="bpe-panel-title">Pair frequencies (top 5)</div>
          {step.pairCounts.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "var(--color-muted, #6b7280)", fontStyle: "italic" }}>
              No pairs — all words are single tokens.
            </div>
          ) : (
            <div className="bpe-pair-list">
              {step.pairCounts.map(({ pair, count }) => {
                const [pa, pb] = pair.split(" ");
                const isWinner =
                  step.nextMergePair !== null &&
                  pa === step.nextMergePair[0] &&
                  pb === step.nextMergePair[1];
                return (
                  <div
                    key={pair}
                    className={`bpe-pair-row${isWinner ? " bpe-pair-row--winner" : ""}`}
                  >
                    <span>
                      "{pa}" + "{pb}"
                    </span>
                    <span className="bpe-pair-count">×{count}</span>
                  </div>
                );
              })}
            </div>
          )}
          {step.nextMergePair && (
            <div
              style={{
                marginTop: "0.65rem",
                fontSize: "0.75rem",
                color: "var(--color-accent, #3b82f6)",
                fontFamily: "var(--font-body, system-ui, sans-serif)",
              }}
            >
              Next: merge "{step.nextMergePair[0]}" + "{step.nextMergePair[1]}"
            </div>
          )}
        </div>

        {/* Right: Vocabulary */}
        <div className="bpe-panel">
          <div className="bpe-panel-title">Vocabulary</div>
          <div className="bpe-vocab-chips">
            {step.vocab.map((tok) => (
              <span
                key={tok}
                className={`bpe-chip${tok === step.newVocabEntry ? " bpe-chip--new" : ""}`}
              >
                {tok}
              </span>
            ))}
          </div>
          <div className="bpe-vocab-size">{step.vocab.length} tokens</div>
        </div>
      </div>
    </div>
  );
}
