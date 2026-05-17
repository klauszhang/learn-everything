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
      </div>

      {/* Navigation at top */}
      <div className={styles.nav}>
        <button
          className={styles.navBtn}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← Prev
        </button>
        <div className={styles.stepIndicator}>
          Step {step + 1} / {STEP_COUNT}
        </div>
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

      <div className={styles.stepBody}>
        {step === 0 && <Step0 />}
        {step === 1 && <Step1 queryIdx={queryIdx} />}
        {step === 2 && <Step2 queryIdx={queryIdx} rawScores={rawScores} />}
        {step === 3 && <Step3 queryIdx={queryIdx} rawScores={rawScores} weights={weights} />}
        {step === 4 && (
          <Step4 queryIdx={queryIdx} weights={weights} output={output} />
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
      <h4 className={styles.stepTitle}>Starting vectors</h4>
      <p className={styles.stepNarration}>
        Each token is a 2-D vector (real models use thousands of dimensions — same recipe).
      </p>
      <div className={styles.tokenTable}>
        <div className={`${styles.tokenRow} ${styles.tokenRowHeader}`}>
          <span>token</span>
          <span>input</span>
          <span>Q</span>
          <span>K</span>
          <span>V</span>
        </div>
        {TOKENS.map((tok) => (
          <div key={tok.name} className={styles.tokenRow}>
            <span className={styles.tokenName}>{tok.name}</span>
            <Vec v={tok.input} />
            <Vec v={tok.Q} />
            <Vec v={tok.K} />
            <Vec v={tok.V} />
          </div>
        ))}
      </div>
      <p className={styles.stepNarration} style={{ marginTop: "0.75rem" }}>
        Each token already has its Q, K, V (projected from the input via learned weight matrices).
      </p>
    </>
  );
}

/* ─────────── STEP 1: Q, K, V roles ─────────── */
function Step1({ queryIdx }: { queryIdx: number }) {
  const query = TOKENS[queryIdx];
  return (
    <>
      <h4 className={styles.stepTitle}>The query asks, keys answer</h4>
      <p className={styles.stepNarration}>
        <strong>{query.name}</strong>'s Query <code>Q = <Vec v={query.Q} highlight /></code> is the search term. It will be compared against every token's Key to find the best matches.
      </p>
      <div className={styles.tokenTable}>
        <div className={`${styles.tokenRow} ${styles.tokenRowHeader}`}>
          <span>token</span>
          <span>K (advertises)</span>
          <span>V (payload)</span>
          <span></span>
          <span></span>
        </div>
        {TOKENS.map((tok, i) => (
          <div
            key={tok.name}
            className={`${styles.tokenRow} ${i === queryIdx ? styles.tokenRowFocus : ""}`}
          >
            <span className={styles.tokenName}>{tok.name}</span>
            <Vec v={tok.K} />
            <Vec v={tok.V} />
            <span></span>
            <span>{i === queryIdx ? "← querying" : ""}</span>
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
      <h4 className={styles.stepTitle}>Score: Q · K dot products</h4>
      <p className={styles.stepNarration}>
        How well does <strong>{query.name}</strong>'s query match each token's key? The dot product measures alignment — higher = stronger match. Future tokens are masked.
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
                  Q<sub>{query.name}</sub> · K<sub>{tok.name}</sub>
                </code>
              </span>
              {masked ? (
                <span className={styles.scoreCalc}><em>masked (future)</em></span>
              ) : (
                <span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${(Math.abs(score) / maxAbs) * 100}%` }}
                    />
                  </div>
                </span>
              )}
              <span className={styles.scoreResult}>
                {masked ? "—" : fmt(score)}
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
  weights,
}: {
  queryIdx: number;
  rawScores: number[];
  weights: number[];
}) {
  return (
    <>
      <h4 className={styles.stepTitle}>Softmax → attention weights</h4>
      <p className={styles.stepNarration}>
        Softmax converts raw scores into percentages that <strong>sum to 100%</strong>. Bigger scores get bigger shares. Masked tokens get 0%.
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
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${w * 100}%` }} />
                </div>
              </span>
              <span className={styles.scoreResult}>
                {masked ? "0%" : `${(w * 100).toFixed(0)}%`}
              </span>
            </div>
          );
        })}
      </div>
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
      <h4 className={styles.stepTitle}>Blend the Value vectors</h4>
      <p className={styles.stepNarration}>
        Multiply each token's V by its attention weight, then sum. The result is <strong>{TOKENS[queryIdx].name}</strong>'s new context-aware representation.
      </p>
      <div className={styles.blendStack}>
        {TOKENS.map((tok, j) => {
          const w = weights[j];
          const contrib: Vec2 = [w * tok.V[0], w * tok.V[1]];
          return (
            <div key={tok.name} className={styles.blendRow} style={{ opacity: w < 0.01 ? 0.3 : 1 }}>
              <span>
                <code>{(w * 100).toFixed(0)}% × V<sub>{tok.name}</sub></code>
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                = <Vec v={contrib} />
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.blendSum}>
        output<sub>{TOKENS[queryIdx].name}</sub> = <Vec v={output} highlight />
      </div>
    </>
  );
}
