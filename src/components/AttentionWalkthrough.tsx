import { useState } from "react";
import styles from "./AttentionWalkthrough.module.css";

// AttentionWalkthrough.tsx — Ch 3 step-by-step QKV demo.
// Pick a query token, then click "Next" to walk through:
//   0. Input vectors
//   1. Q / K / V projection (per token)
//   2. Score: query · key dot products (with causal mask)
//   3. Softmax → weights
//   4. Blend the V vectors → output
//
// Numbers match the worked example in 03-attention.mdx.

type Vec2 = [number, number];
type Token = { name: string; input: Vec2; Q: Vec2; K: Vec2; V: Vec2 };

const TOKENS: Token[] = [
  { name: "the", input: [1, 0], Q: [1, 0], K: [0, 1], V: [1, 1] },
  { name: "cat", input: [0, 1], Q: [0, 1], K: [1, 0], V: [0, 2] },
  { name: "sat", input: [1, 1], Q: [1, 1], K: [1, 1], V: [1, 2] },
];

function dot(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

function softmax(scores: number[]): number[] {
  // mask is encoded as -Infinity
  const max = Math.max(...scores.filter((s) => Number.isFinite(s)));
  const exps = scores.map((s) => (Number.isFinite(s) ? Math.exp(s - max) : 0));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => (sum === 0 ? 0 : e / sum));
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

function Vec({ v, highlight }: { v: Vec2; highlight?: boolean }) {
  return (
    <span className={styles.vec} style={highlight ? { color: "var(--color-accent)", fontWeight: 600 } : undefined}>
      <span className={styles.vecBracket}>[</span>
      <span className={styles.vecNum}>{fmt(v[0])}</span>
      <span className={styles.vecBracket}>,</span>
      <span className={styles.vecNum}>{fmt(v[1])}</span>
      <span className={styles.vecBracket}>]</span>
    </span>
  );
}

const STEP_COUNT = 5;

export default function AttentionWalkthrough() {
  const [queryIdx, setQueryIdx] = useState(1); // default: cat
  const [step, setStep] = useState(0);

  const query = TOKENS[queryIdx];

  // Pre-compute everything for the chosen query
  const rawScores = TOKENS.map((tok, j) =>
    j > queryIdx ? Number.NEGATIVE_INFINITY : dot(query.Q, tok.K)
  );
  const weights = softmax(rawScores);
  const output: Vec2 = TOKENS.reduce<Vec2>(
    (acc, tok, j) => [acc[0] + weights[j] * tok.V[0], acc[1] + weights[j] * tok.V[1]],
    [0, 0]
  );

  function reset() {
    setStep(0);
  }
  function setQuery(idx: number) {
    setQueryIdx(idx);
    setStep(0);
  }

  return (
    <figure className={styles.figure} aria-label="Attention step-by-step walkthrough">
      <div className={styles.topBar}>
        <div className={styles.picker}>
          <span className={styles.pickerLabel}>Compute attention for:</span>
          {TOKENS.map((tok, i) => (
            <button
              key={i}
              className={`${styles.pickerBtn} ${i === queryIdx ? styles.pickerBtnActive : ""}`}
              onClick={() => setQuery(i)}
              aria-pressed={i === queryIdx}
            >
              {tok.name}
            </button>
          ))}
        </div>
        <div className={styles.stepIndicator}>
          Step {step + 1} / {STEP_COUNT}
        </div>
      </div>

      <div className={styles.stepBody}>
        {step === 0 && <Step0 />}
        {step === 1 && <Step1 queryIdx={queryIdx} />}
        {step === 2 && <Step2 queryIdx={queryIdx} rawScores={rawScores} />}
        {step === 3 && <Step3 queryIdx={queryIdx} rawScores={rawScores} weights={weights} />}
        {step === 4 && (
          <Step4 queryIdx={queryIdx} weights={weights} output={output} />
        )}
      </div>

      <div className={styles.nav}>
        <button
          className={styles.navBtn}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← Previous
        </button>
        <div className={styles.progressDots} aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${
                i === step ? styles.dotActive : i < step ? styles.dotDone : ""
              }`}
            />
          ))}
        </div>
        {step < STEP_COUNT - 1 ? (
          <button
            className={`${styles.navBtn} ${styles.navBtnPrimary}`}
            onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
          >
            Next →
          </button>
        ) : (
          <button className={styles.navBtn} onClick={reset}>
            ↺ Restart
          </button>
        )}
      </div>

      <p className={styles.caption}>
        Illustrative — toy 2-D vectors. Real models use thousands of dimensions, but the recipe is identical.
      </p>
    </figure>
  );
}

/* ─────────── STEP 0: inputs ─────────── */
function Step0() {
  return (
    <>
      <h4 className={styles.stepTitle}>Step 1 — The starting vectors</h4>
      <p className={styles.stepNarration}>
        After the embedding layer, every token is just a small list of numbers. In this toy example each token has <code>d_model = 2</code>. Real models use thousands; the recipe below is identical.
      </p>
      <div className={styles.tokenTable}>
        <div className={`${styles.tokenRow} ${styles.tokenRowHeader}`}>
          <span>token</span>
          <span>input vector</span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        {TOKENS.map((tok) => (
          <div key={tok.name} className={styles.tokenRow}>
            <span className={styles.tokenName}>{tok.name}</span>
            <Vec v={tok.input} />
            <span></span>
            <span></span>
            <span></span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────── STEP 1: Q, K, V projections ─────────── */
function Step1({ queryIdx }: { queryIdx: number }) {
  return (
    <>
      <h4 className={styles.stepTitle}>Step 2 — Each token grows three personas: Q, K, V</h4>
      <p className={styles.stepNarration}>
        Three learned weight matrices turn each input vector into a <strong>Query</strong>, <strong>Key</strong>, and <strong>Value</strong>. For this toy example we picked simple weights: <code>Q = input</code>, <code>K = input with coords swapped</code>, <code>V = input with +1 added to the 2nd coord</code>.
      </p>
      <p className={styles.stepNarration}>
        Think of it as: <strong>Q</strong> = what this token is asking, <strong>K</strong> = the label it wears, <strong>V</strong> = the payload it'll share if picked.
      </p>
      <div className={styles.tokenTable}>
        <div className={`${styles.tokenRow} ${styles.tokenRowHeader}`}>
          <span>token</span>
          <span>input</span>
          <span>Q</span>
          <span>K</span>
          <span>V</span>
        </div>
        {TOKENS.map((tok, i) => (
          <div
            key={tok.name}
            className={`${styles.tokenRow} ${i === queryIdx ? styles.tokenRowFocus : ""}`}
          >
            <span className={styles.tokenName}>{tok.name}</span>
            <Vec v={tok.input} />
            <Vec v={tok.Q} highlight={i === queryIdx} />
            <Vec v={tok.K} />
            <Vec v={tok.V} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ─────────── STEP 2: scoring ─────────── */
function Step2({ queryIdx, rawScores }: { queryIdx: number; rawScores: number[] }) {
  const query = TOKENS[queryIdx];
  const maxAbs = Math.max(1, ...rawScores.filter(Number.isFinite).map(Math.abs));

  return (
    <>
      <h4 className={styles.stepTitle}>Step 3 — Score every visible token</h4>
      <p className={styles.stepNarration}>
        Take <strong>{query.name}</strong>'s query <code>Q = [{fmt(query.Q[0])}, {fmt(query.Q[1])}]</code> and compute the <strong>dot product</strong> with each token's key. The dot product <code>[a, b] · [c, d] = a·c + b·d</code> measures how aligned two vectors are — bigger = better match. Future tokens are <strong>masked</strong> (the causal rule).
      </p>
      <div className={styles.scoreList}>
        {TOKENS.map((tok, j) => {
          const masked = j > queryIdx;
          const score = rawScores[j];
          return (
            <div
              key={tok.name}
              className={`${styles.scoreRow} ${masked ? styles.scoreRowMasked : ""}`}
            >
              <span>
                <code>
                  Q_{query.name} · K_{tok.name}
                </code>
              </span>
              <span className={styles.scoreCalc}>
                {masked ? (
                  <em>masked (future token)</em>
                ) : (
                  <>
                    [{fmt(query.Q[0])}, {fmt(query.Q[1])}] · [{fmt(tok.K[0])}, {fmt(tok.K[1])}] ={" "}
                    {fmt(query.Q[0])}·{fmt(tok.K[0])} + {fmt(query.Q[1])}·{fmt(tok.K[1])}
                    {Number.isFinite(score) && (
                      <span
                        className={styles.bar}
                        style={{ width: `${(Math.abs(score) / maxAbs) * 80}px` }}
                      />
                    )}
                  </>
                )}
              </span>
              <span className={styles.scoreResult}>
                {masked ? "—" : `= ${fmt(score)}`}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─────────── STEP 3: softmax → weights ─────────── */
function Step3({
  queryIdx,
  rawScores,
  weights,
}: {
  queryIdx: number;
  rawScores: number[];
  weights: number[];
}) {
  return (
    <>
      <h4 className={styles.stepTitle}>Step 4 — Softmax the scores into weights</h4>
      <p className={styles.stepNarration}>
        Softmax turns raw scores into positive numbers that <strong>sum to 1</strong>. Bigger scores get bigger shares. The masked tokens contribute <code>0</code>.
      </p>
      <div className={styles.scoreList}>
        {TOKENS.map((tok, j) => {
          const masked = j > queryIdx;
          const w = weights[j];
          return (
            <div key={tok.name} className={styles.weightRow}>
              <span>
                <code>{TOKENS[queryIdx].name} → {tok.name}</code>
              </span>
              <span>
                <span className={styles.scoreCalc}>
                  score {masked ? "= masked" : `= ${fmt(rawScores[j])}`}
                </span>
                <div className={styles.barTrack} style={{ marginTop: 4 }}>
                  <div className={styles.barFill} style={{ width: `${w * 100}%` }} />
                </div>
              </span>
              <span className={styles.scoreResult}>
                {(w * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
      <p className={styles.stepNarration} style={{ marginTop: "1rem" }}>
        These percentages add up to 100% — they're how much <strong>{TOKENS[queryIdx].name}</strong> will draw from each token's V in the next step.
      </p>
    </>
  );
}

/* ─────────── STEP 4: weighted sum of V ─────────── */
function Step4({
  queryIdx,
  weights,
  output,
}: {
  queryIdx: number;
  weights: number[];
  output: Vec2;
}) {
  return (
    <>
      <h4 className={styles.stepTitle}>Step 5 — Blend the V vectors</h4>
      <p className={styles.stepNarration}>
        Multiply each token's V by its weight, then add them all up. The result is <strong>{TOKENS[queryIdx].name}</strong>'s new context-aware representation, ready to flow into the next layer.
      </p>
      <div className={styles.blendStack}>
        {TOKENS.map((tok, j) => {
          const w = weights[j];
          const contrib: Vec2 = [w * tok.V[0], w * tok.V[1]];
          return (
            <div key={tok.name} className={styles.blendRow}>
              <span>
                <code>{fmt(w)} · V_{tok.name}</code>
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                {fmt(w)} · [{fmt(tok.V[0])}, {fmt(tok.V[1])}] = <Vec v={contrib} />
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.blendSum}>
        output_{TOKENS[queryIdx].name} = <Vec v={output} highlight />
      </div>
    </>
  );
}
