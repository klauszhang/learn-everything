import { useState } from "react";

// TransformerBlock.tsx — Ch 4 interactive transformer block step-through.
// 6 steps walk the user through one full transformer block:
//   0. Input (residual stream enters)
//   1. LayerNorm → Multi-Head Attention
//   2. Residual Add (after attention)
//   3. LayerNorm → FFN
//   4. Residual Add (after FFN)
//   5. Output / Repeat (feeds next block)

const STEP_COUNT = 6;

// Which block diagram rows are highlighted at each step.
// Rows (top-to-bottom in the diagram, bottom-up in the visual stack):
//   "res2"   → + Residual (after FFN)
//   "ffn"    → FFN
//   "norm2"  → LayerNorm (before FFN)
//   "res1"   → + Residual (after attention)
//   "mha"    → Multi-Head Attention
//   "norm1"  → LayerNorm (before attention)
//   "input"  → the input arrow
type RowKey = "res2" | "ffn" | "norm2" | "res1" | "mha" | "norm1" | "input";

const STEP_ACTIVE: Record<number, RowKey[]> = {
  0: ["input"],
  1: ["norm1", "mha"],
  2: ["res1"],
  3: ["norm2", "ffn"],
  4: ["res2"],
  5: ["res2", "ffn", "norm2", "res1", "mha", "norm1"], // all lit, output leaving
};

const ROWS: { key: RowKey; label: string; type: "norm" | "mha" | "ffn" | "res" }[] = [
  { key: "res2",  label: "+ Residual",          type: "res"  },
  { key: "ffn",   label: "FFN",                  type: "ffn"  },
  { key: "norm2", label: "LayerNorm",            type: "norm" },
  { key: "res1",  label: "+ Residual",           type: "res"  },
  { key: "mha",   label: "Multi-Head Attn",      type: "mha"  },
  { key: "norm1", label: "LayerNorm",            type: "norm" },
];

const ROW_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  norm: { bg: "#fefce8", text: "#854d0e", border: "#fde68a" },
  mha:  { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  ffn:  { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" },
  res:  { bg: "#fdf4ff", text: "#7e22ce", border: "#e9d5ff" },
};

// Step captions and side-panel content descriptor
type StepMeta = {
  title: string;
  caption: string;
  panel: "input" | "heads" | "residual-attn" | "ffn-expand" | "residual-ffn" | "stack";
};

const STEPS: StepMeta[] = [
  {
    title: "Input — The Residual Stream",
    caption:
      "Each token enters as a vector of d_model numbers (e.g. 4,096 dimensions). This vector carries everything previous layers have accumulated. Think of it as a data highway — each block reads from it and adds updates back, but never overwrites it.",
    panel: "input",
  },
  {
    title: "LayerNorm → Multi-Head Attention",
    caption:
      "First, LayerNorm rescales the vector so values don't drift too large or small — it subtracts the mean, divides by standard deviation, then applies learned scale/shift. Then the normalized vector is split across h parallel attention heads (e.g. 32 heads, each working on 128 dimensions). Each head computes its own Q/K/V and runs the attention recipe from Ch 3 independently. This lets the model track multiple relationships simultaneously — one head might link pronouns to nouns, another might track sentence boundaries. Finally, all head outputs are concatenated and projected back to d_model.",
    panel: "heads",
  },
  {
    title: "Residual Add (after Attention)",
    caption:
      "The attention output is element-wise added to the original input — the skip connection. This is critical: without it, gradients would vanish across 80+ layers during training. The additive design means each sublayer only needs to learn a useful delta, not reconstruct the full representation from scratch.",
    panel: "residual-attn",
  },
  {
    title: "LayerNorm → Feed-Forward Network",
    caption:
      "After another LayerNorm, each token passes independently through a two-layer network. The first layer expands the vector to 4× width (e.g. 4,096 → 16,384), applies a nonlinearity (ReLU, GELU, or SwiGLU), and the second layer compresses back to d_model. No mixing between tokens happens here — this is per-token processing. The FFN is where most parameters live (~⅔ of total) and where mechanistic interpretability research finds stored knowledge: individual neurons that fire on French verbs, hex colors, or Python syntax.",
    panel: "ffn-expand",
  },
  {
    title: "Residual Add (after FFN)",
    caption:
      "The FFN output is added back to the stream, just like after attention. The vector now carries the original embedding information, plus contextual updates from attention, plus knowledge-recall updates from the FFN. This two-residual pattern (attend, then transform) repeats identically in every block.",
    panel: "residual-ffn",
  },
  {
    title: "Output → Next Block",
    caption:
      "This block's output vector feeds directly into the next block's LayerNorm. Stack 32–96 of these identical blocks (each with its own learned weights) and you have a full transformer. The next chapter shows what different layers tend to learn.",
    panel: "stack",
  },
];

// HEAD_COLORS for the multi-head visualization
const HEAD_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" },
  { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
  { bg: "#fce7f3", border: "#f9a8d4", text: "#831843" },
];

/* ─── Side panel components ─── */

const EXAMPLE_INPUT  = [2.1, -0.8, 3.5, 0.2, -1.4, 1.9, 0.6, -0.3];

function VecCells({ values, colors }: { values: (string | number)[]; colors?: { bg: string; border: string; text: string } }) {
  const c = colors ?? { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" };
  return (
    <div className="tb-vector-row">
      {values.map((v, i) => (
        <div key={i} className="tb-vector-cell" style={{ background: c.bg, borderColor: c.border, color: c.text }}>
          {typeof v === "number" ? v.toFixed(1) : v}
        </div>
      ))}
    </div>
  );
}

function PanelInput() {
  return (
    <div className="tb-panel-section">
      <div className="tb-panel-label">The residual stream</div>
      <div className="tb-panel-desc">
        Each token is a vector of <strong>d_model</strong> numbers. In a mid-size model, d_model = 4,096 — here we show 8 dimensions for clarity:
      </div>
      <VecCells values={EXAMPLE_INPUT} />
      <div className="tb-panel-desc" style={{ marginTop: "0.5rem" }}>
        This vector is the token's entire state — its identity, position, and everything previous layers have added. It flows through the block like a data highway: each sublayer reads from it and adds updates back, but <strong>never overwrites it</strong>.
      </div>
    </div>
  );
}

function PanelHeads() {
  return (
    <div className="tb-panel-section">
      <div className="tb-panel-label">LayerNorm + Multi-Head Attention</div>

      <div className="tb-panel-subsection">
        <div className="tb-panel-subtitle" style={{ color: "#854d0e" }}>① LayerNorm</div>
        <div className="tb-panel-desc">
          Subtract the mean, divide by standard deviation, then apply learned scale (γ) and shift (β). This keeps every sublayer's input in a consistent range regardless of what earlier layers produced.
        </div>
        <div className="tb-norm-example">
          <div className="tb-norm-step">
            <span className="tb-norm-label">before:</span>
            <VecCells values={EXAMPLE_INPUT} colors={{ bg: "#fefce8", border: "#fde68a", text: "#854d0e" }} />
          </div>
          <div className="tb-norm-step">
            <span className="tb-norm-label">after:</span>
            <VecCells values={[0.5, -1.2, 1.5, -0.3, -1.0, 0.8, -0.1, -0.5]} colors={{ bg: "#fefce8", border: "#fde68a", text: "#854d0e" }} />
          </div>
        </div>
      </div>

      <div className="tb-panel-subsection">
        <div className="tb-panel-subtitle" style={{ color: "#1e40af" }}>② Multi-Head Attention</div>
        <div className="tb-panel-desc">
          The normalized vector is split across <strong>h parallel heads</strong>. Each head has its own W_Q, W_K, W_V matrices and runs attention independently on a d_k-dimensional slice. Why multiple heads? Each one learns to track a <em>different kind</em> of relationship. Consider the sentence:
        </div>

        <div className="tb-head-sentence">
          <span className="tb-head-tok">The</span>
          <span className="tb-head-tok">cat</span>
          <span className="tb-head-tok">sat</span>
          <span className="tb-head-tok">on</span>
          <span className="tb-head-tok">the</span>
          <span className="tb-head-tok">mat</span>
          <span className="tb-head-tok">because</span>
          <span className="tb-head-tok tb-head-tok--query">it</span>
          <span className="tb-head-tok">was</span>
          <span className="tb-head-tok">tired</span>
        </div>

        <div className="tb-panel-desc" style={{ marginTop: "0.35rem", marginBottom: "0.35rem" }}>
          When processing <strong>"it"</strong>, different heads attend to different tokens:
        </div>

        <div className="tb-head-examples">
          {[
            { head: 1, color: HEAD_COLORS[0], role: "Coreference", focus: "cat", weight: "72%", desc: "Links \"it\" back to its referent — the cat." },
            { head: 2, color: HEAD_COLORS[1], role: "Syntax / subject", focus: "sat", weight: "58%", desc: "Tracks the main verb this pronoun relates to." },
            { head: 3, color: HEAD_COLORS[2], role: "Positional / local", focus: "because", weight: "64%", desc: "Attends to the nearest clause boundary." },
            { head: 4, color: HEAD_COLORS[3], role: "Broad context", focus: "mat, was", weight: "31%, 28%", desc: "Distributes attention across multiple tokens for general context." },
          ].map((h) => (
            <div key={h.head} className="tb-head-example-row" style={{ borderLeftColor: h.color.border, background: h.color.bg + "33" }}>
              <div className="tb-head-example-header">
                <span className="tb-head-example-badge" style={{ background: h.color.bg, borderColor: h.color.border, color: h.color.text }}>Head {h.head}</span>
                <span className="tb-head-example-role">{h.role}</span>
              </div>
              <div className="tb-head-example-body">
                <span className="tb-head-example-focus">"it" → <strong>{h.focus}</strong> ({h.weight})</span>
                <span className="tb-head-example-desc">{h.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="tb-heads-layout" style={{ marginTop: "0.75rem" }}>
          <div className="tb-heads-input">
            <div className="tb-heads-input-box">normalized input</div>
            <div className="tb-heads-input-label">d_model = 4096</div>
          </div>
          <div className="tb-heads-fan">
            {HEAD_COLORS.map((c, i) => (
              <div key={i} className="tb-head-col">
                <div className="tb-head-box" style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
                  <div className="tb-head-title">Head {i + 1}</div>
                  <div className="tb-head-sub">d_k = 128</div>
                </div>
              </div>
            ))}
          </div>
          <div className="tb-heads-concat">
            <div className="tb-heads-concat-box">Concat all heads → W_O</div>
            <div className="tb-heads-input-label">back to d_model = 4096</div>
          </div>
        </div>
        <div className="tb-panel-note">
          No head is told which role to play — specialization emerges from training. Real models use 32–128+ heads.
        </div>
      </div>
    </div>
  );
}

function PanelResidualAttn() {
  const attnOut = [0.3, -0.1, 0.7, 0.0, -0.2, 0.4, 0.1, -0.1];
  const result = EXAMPLE_INPUT.map((v, i) => v + attnOut[i]);
  return (
    <div className="tb-panel-section">
      <div className="tb-panel-label">Residual Connection (skip connection)</div>
      <div className="tb-panel-desc">
        The attention output is <strong>element-wise added</strong> to the original input — not replacing it. Each dimension is simply summed:
      </div>
      <div className="tb-res-example">
        <div className="tb-res-row">
          <span className="tb-res-label">original x:</span>
          <VecCells values={EXAMPLE_INPUT} colors={{ bg: "#f3f4f6", border: "#d1d5db", text: "#374151" }} />
        </div>
        <div className="tb-res-row">
          <span className="tb-res-label tb-res-label--plus">+ Attn(x):</span>
          <VecCells values={attnOut} colors={{ bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" }} />
        </div>
        <div className="tb-res-row">
          <span className="tb-res-label tb-res-label--result">= result:</span>
          <VecCells values={result} colors={{ bg: "#fdf4ff", border: "#e9d5ff", text: "#7e22ce" }} />
        </div>
      </div>
      <div className="tb-panel-desc" style={{ marginTop: "0.5rem" }}>
        <strong>Why this matters:</strong> without residual connections, gradients vanish across 80+ layers during training. The additive path gives gradients a direct shortcut from top to bottom. It also means each sublayer only needs to learn a useful <em>delta</em>, not reconstruct everything from scratch.
      </div>
    </div>
  );
}

function PanelFFNExpand() {
  const input2d = [1.0, 0.5];
  const expanded = [1.5, 0.5, -0.5, 1.0];
  const activated = [1.5, 0.5, 0.0, 1.0];
  const output2d = [1.0, 0.8];

  return (
    <div className="tb-panel-section">
      <div className="tb-panel-label">LayerNorm + Feed-Forward Network</div>

      <div className="tb-panel-subsection">
        <div className="tb-panel-subtitle" style={{ color: "#854d0e" }}>① LayerNorm (again)</div>
        <div className="tb-panel-desc">
          Same normalization as before — keeps input scale consistent for the FFN.
        </div>
      </div>

      <div className="tb-panel-subsection">
        <div className="tb-panel-subtitle" style={{ color: "#166534" }}>② FFN: what it does</div>
        <div className="tb-panel-desc">
          Attention lets tokens <em>talk to each other</em>. The FFN lets each token <em>think by itself</em> — processing what it gathered from attention, independently, with no mixing between tokens. It works in three steps:
        </div>

        <div className="tb-ffn-steps">
          <div className="tb-ffn-step">
            <div className="tb-ffn-step-header">
              <span className="tb-ffn-step-num">1</span>
              <span className="tb-ffn-step-title">Expand (W₁ · x)</span>
            </div>
            <div className="tb-panel-desc">
              Multiply by a weight matrix W₁ to project into a wider space — typically <strong>4× wider</strong>. This creates room for the model to represent more nuanced features.
            </div>
            <div className="tb-ffn-worked">
              <div className="tb-ffn-worked-row">
                <span className="tb-ffn-worked-label">input:</span>
                <VecCells values={input2d} colors={{ bg: "#f3f4f6", border: "#d1d5db", text: "#374151" }} />
                <span className="tb-ffn-worked-dim">d_model = 2</span>
              </div>
              <div className="tb-ffn-worked-row">
                <span className="tb-ffn-worked-label">W₁ · x:</span>
                <VecCells values={expanded} colors={{ bg: "#d1fae5", border: "#6ee7b7", text: "#166534" }} />
                <span className="tb-ffn-worked-dim">d_ff = 4 (2×2)</span>
              </div>
            </div>
          </div>

          <div className="tb-ffn-step">
            <div className="tb-ffn-step-header">
              <span className="tb-ffn-step-num">2</span>
              <span className="tb-ffn-step-title">Activate (ReLU / GELU)</span>
            </div>
            <div className="tb-panel-desc">
              Apply a nonlinearity — without this, stacking linear layers would just be one big linear layer. <strong>ReLU</strong> clips negatives to zero. This is where the network decides which features "fire" for this token.
            </div>
            <div className="tb-ffn-worked">
              <div className="tb-ffn-worked-row">
                <span className="tb-ffn-worked-label">before:</span>
                <div className="tb-vector-row">
                  {expanded.map((v, i) => (
                    <div key={i} className="tb-vector-cell" style={{
                      background: v < 0 ? "#fef2f2" : "#d1fae5",
                      borderColor: v < 0 ? "#fca5a5" : "#6ee7b7",
                      color: v < 0 ? "#991b1b" : "#166534",
                    }}>
                      {v.toFixed(1)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="tb-ffn-worked-row">
                <span className="tb-ffn-worked-label">after:</span>
                <div className="tb-vector-row">
                  {activated.map((v, i) => (
                    <div key={i} className="tb-vector-cell" style={{
                      background: v === 0 ? "#f3f4f6" : "#d1fae5",
                      borderColor: v === 0 ? "#d1d5db" : "#6ee7b7",
                      color: v === 0 ? "#9ca3af" : "#166534",
                      textDecoration: v === 0 ? "line-through" : "none",
                    }}>
                      {v.toFixed(1)}
                    </div>
                  ))}
                </div>
                <span className="tb-ffn-worked-dim">-0.5 → 0.0 (clipped)</span>
              </div>
            </div>
          </div>

          <div className="tb-ffn-step">
            <div className="tb-ffn-step-header">
              <span className="tb-ffn-step-num">3</span>
              <span className="tb-ffn-step-title">Compress (W₂ · h)</span>
            </div>
            <div className="tb-panel-desc">
              Project back to d_model dimensions with a second weight matrix W₂. The model keeps only the transformed features that fit back into the residual stream.
            </div>
            <div className="tb-ffn-worked">
              <div className="tb-ffn-worked-row">
                <span className="tb-ffn-worked-label">W₂ · h:</span>
                <VecCells values={output2d} colors={{ bg: "#bbf7d0", border: "#86efac", text: "#166534" }} />
                <span className="tb-ffn-worked-dim">back to d_model = 2</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tb-ffn-scale-note">
          <div className="tb-panel-subtitle" style={{ color: "#166534", marginTop: "0.75rem" }}>At real scale</div>
          <div className="tb-ffn-scale-grid">
            <div className="tb-ffn-scale-item">
              <span className="tb-ffn-scale-val">4,096 → 16,384 → 4,096</span>
              <span className="tb-ffn-scale-label">typical dimensions</span>
            </div>
            <div className="tb-ffn-scale-item">
              <span className="tb-ffn-scale-val">~268M params / layer</span>
              <span className="tb-ffn-scale-label">W₁ + W₂ combined</span>
            </div>
            <div className="tb-ffn-scale-item">
              <span className="tb-ffn-scale-val">~⅔ of model</span>
              <span className="tb-ffn-scale-label">FFN share of total params</span>
            </div>
          </div>
          <div className="tb-panel-desc" style={{ marginTop: "0.35rem" }}>
            Research suggests individual neurons in the expanded layer activate on specific concepts — French verbs, hex color codes, Python list comprehensions. The FFN is where the model <strong>stores and recalls knowledge</strong>; attention is where it <strong>routes and combines context</strong>.
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelResidualFFN() {
  const ffnOut = [-0.1, 0.3, 0.5, -0.2, 0.1, 0.2, -0.3, 0.4];
  const prevStream = EXAMPLE_INPUT.map((v, i) => v + 0.3 - i * 0.05);
  const result = prevStream.map((v, i) => v + ffnOut[i]);
  return (
    <div className="tb-panel-section">
      <div className="tb-panel-label">Residual Connection (after FFN)</div>
      <div className="tb-panel-desc">
        Same pattern as after attention — FFN output is added to the stream:
      </div>
      <div className="tb-res-example">
        <div className="tb-res-row">
          <span className="tb-res-label">stream y:</span>
          <VecCells values={prevStream} colors={{ bg: "#f3f4f6", border: "#d1d5db", text: "#374151" }} />
        </div>
        <div className="tb-res-row">
          <span className="tb-res-label tb-res-label--plus">+ FFN(y):</span>
          <VecCells values={ffnOut} colors={{ bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" }} />
        </div>
        <div className="tb-res-row">
          <span className="tb-res-label tb-res-label--result">= output:</span>
          <VecCells values={result} colors={{ bg: "#fdf4ff", border: "#e9d5ff", text: "#7e22ce" }} />
        </div>
      </div>
      <div className="tb-panel-desc" style={{ marginTop: "0.5rem" }}>
        The vector now carries three layers of information: the <strong>original embedding</strong>, <strong>contextual updates from attention</strong> (which tokens were relevant), and <strong>knowledge-recall updates from FFN</strong> (what the model "knows" about this context). This two-residual pattern repeats in every block.
      </div>
    </div>
  );
}

function PanelStack() {
  return (
    <div className="tb-panel-section">
      <div className="tb-panel-label">This block repeats</div>
      <div className="tb-panel-desc">
        The block you just explored repeats 32–96 times in a full model. Each copy has its own learned weights (different W_Q, W_K, W_V, W₁, W₂, γ, β) but the exact same structure.
      </div>
      <div className="tb-stack-layout">
        {["Block 1", "Block 2", "This block", "Block 4", "Block 5"].map((label, i) => (
          <div
            key={i}
            className="tb-stack-block"
            style={
              i === 2
                ? { background: "#eff6ff", border: "2px solid #3b82f6", color: "#1e40af", fontWeight: 600 }
                : { background: "var(--color-surface, #f8f9fa)", border: "1px solid var(--color-border, #e5e7eb)", color: "var(--color-muted, #6b7280)", opacity: 0.55 }
            }
          >
            {label}
          </div>
        ))}
        <div className="tb-stack-label">× 32–96 blocks total</div>
      </div>
      <div className="tb-panel-desc" style={{ marginTop: "0.5rem" }}>
        <strong>The complete flow:</strong> token embeddings + position → Block 1 → Block 2 → … → Block N → final LayerNorm → linear projection → vocabulary probabilities → sample next token. The next chapter shows what different layers tend to learn.
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export default function TransformerBlock() {
  const [step, setStep] = useState(0);

  const meta = STEPS[step];
  const activeRows = STEP_ACTIVE[step];

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .tb-wrap {
          display: flex;
          gap: 1.5rem;
          align-items: flex-start;
        }
        @media (max-width: 640px) {
          .tb-wrap {
            flex-direction: column;
          }
        }

        /* ── Block diagram ── */
        .tb-diagram {
          flex: 0 0 180px;
          min-width: 140px;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0;
          position: relative;
        }
        .tb-diagram-row {
          padding: 0.5rem 0.6rem;
          border: 1px solid;
          border-radius: 0;
          font-size: 0.78rem;
          font-family: var(--font-body, system-ui, sans-serif);
          font-weight: 500;
          text-align: center;
          transition: opacity 0.2s, box-shadow 0.2s;
          position: relative;
          z-index: 1;
        }
        .tb-diagram-row:first-child {
          border-radius: 6px 6px 0 0;
        }
        .tb-diagram-row:last-child {
          border-radius: 0 0 6px 6px;
        }
        .tb-diagram-row--active {
          box-shadow: 0 0 0 2px currentColor, 0 0 12px 2px rgba(0,0,0,0.12);
          opacity: 1 !important;
          z-index: 2;
        }
        .tb-diagram-row--inactive {
          opacity: 0.35;
        }

        .tb-arrow-in {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
          padding: 0.35rem 0;
          transition: opacity 0.2s;
        }
        .tb-arrow-in--active {
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .tb-arrow-in svg {
          flex-shrink: 0;
        }

        .tb-arrow-out {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
          padding: 0.35rem 0;
          transition: opacity 0.2s;
        }
        .tb-arrow-out--active {
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }

        /* ── Explanation panel ── */
        .tb-panel {
          flex: 1;
          min-width: 0;
        }
        .tb-step-title {
          font-family: var(--font-body, system-ui, sans-serif);
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--color-accent, #3b82f6);
          margin: 0 0 0.5rem 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .tb-caption {
          font-family: var(--font-body, system-ui, sans-serif);
          font-size: 0.88rem;
          color: var(--color-muted, #6b7280);
          line-height: 1.55;
          margin: 0 0 1rem 0;
        }
        .tb-panel-section {
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 6px);
          padding: 0.75rem;
          background: var(--color-surface, #f8f9fa);
        }
        .tb-panel-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-muted, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.6rem;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .tb-panel-note {
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          font-style: italic;
          margin-top: 0.6rem;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .tb-panel-desc {
          font-size: 0.82rem;
          color: var(--color-text, #1f2937);
          line-height: 1.5;
          margin-bottom: 0.5rem;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .tb-panel-subsection {
          margin-top: 0.75rem;
          padding-top: 0.75rem;
          border-top: 1px dashed var(--color-border, #e5e7eb);
        }
        .tb-panel-subsection:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
        }
        .tb-panel-subtitle {
          font-size: 0.78rem;
          font-weight: 700;
          margin-bottom: 0.35rem;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .tb-norm-example {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          margin-top: 0.35rem;
        }
        .tb-norm-step {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .tb-norm-label {
          font-size: 0.72rem;
          color: var(--color-muted, #6b7280);
          min-width: 44px;
          font-family: var(--font-mono, monospace);
        }
        .tb-res-example {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .tb-res-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .tb-res-label {
          font-size: 0.72rem;
          color: var(--color-muted, #6b7280);
          min-width: 68px;
          font-family: var(--font-mono, monospace);
          white-space: nowrap;
        }
        .tb-res-label--plus {
          color: #1e40af;
        }
        .tb-res-label--result {
          color: #7e22ce;
          font-weight: 600;
        }

        /* Head attention examples */
        .tb-head-sentence {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin: 0.35rem 0;
        }
        .tb-head-tok {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.78rem;
          font-family: var(--font-mono, monospace);
          background: var(--color-bg, #fff);
          border: 1px solid var(--color-border, #e5e7eb);
          color: var(--color-text, #1f2937);
        }
        .tb-head-tok--query {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #1e40af;
          font-weight: 700;
        }
        .tb-head-examples {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tb-head-example-row {
          border-left: 3px solid;
          border-radius: 0 4px 4px 0;
          padding: 5px 8px;
        }
        .tb-head-example-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 2px;
        }
        .tb-head-example-badge {
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 700;
          border: 1px solid;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .tb-head-example-role {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--color-text, #1f2937);
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .tb-head-example-body {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding-left: 2px;
        }
        .tb-head-example-focus {
          font-size: 0.72rem;
          font-family: var(--font-mono, monospace);
          color: var(--color-text, #1f2937);
        }
        .tb-head-example-desc {
          font-size: 0.7rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
        }

        /* FFN stepped walkthrough */
        .tb-ffn-steps {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .tb-ffn-step {
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 4px;
          padding: 8px 10px;
          background: var(--color-bg, #fff);
        }
        .tb-ffn-step-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .tb-ffn-step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #d1fae5;
          color: #166534;
          font-size: 0.68rem;
          font-weight: 700;
          font-family: var(--font-mono, monospace);
          flex-shrink: 0;
        }
        .tb-ffn-step-title {
          font-size: 0.78rem;
          font-weight: 600;
          color: #166534;
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .tb-ffn-worked {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-top: 0.3rem;
        }
        .tb-ffn-worked-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .tb-ffn-worked-label {
          font-size: 0.7rem;
          color: var(--color-muted, #6b7280);
          min-width: 44px;
          font-family: var(--font-mono, monospace);
        }
        .tb-ffn-worked-dim {
          font-size: 0.65rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-mono, monospace);
          font-style: italic;
        }
        .tb-ffn-scale-grid {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.35rem;
        }
        .tb-ffn-scale-item {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 4px 8px;
          border-radius: 4px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          flex: 1;
          min-width: 100px;
        }
        .tb-ffn-scale-val {
          font-size: 0.75rem;
          font-weight: 600;
          color: #166534;
          font-family: var(--font-mono, monospace);
        }
        .tb-ffn-scale-label {
          font-size: 0.65rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
        }

        /* Input vector display */
        .tb-vector-row {
          display: flex;
          gap: 0.25rem;
          flex-wrap: wrap;
        }
        .tb-vector-cell {
          padding: 0.25rem 0.4rem;
          border-radius: 4px;
          background: #dbeafe;
          border: 1px solid #93c5fd;
          color: #1e40af;
          font-size: 0.75rem;
          font-family: var(--font-mono, monospace);
        }
        .tb-vector-ellipsis {
          background: #f3f4f6;
          border-color: #d1d5db;
          color: #6b7280;
        }

        /* Multi-head attention visualization */
        .tb-heads-layout {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        .tb-heads-input {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
        }
        .tb-heads-input-box {
          padding: 0.3rem 1rem;
          border-radius: 4px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          color: #374151;
          font-size: 0.78rem;
          font-family: var(--font-body, system-ui, sans-serif);
          font-weight: 500;
        }
        .tb-heads-input-label {
          font-size: 0.68rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-mono, monospace);
        }
        .tb-heads-fan {
          display: flex;
          gap: 0.4rem;
          justify-content: center;
        }
        .tb-head-col {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .tb-head-box {
          padding: 0.3rem 0.4rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-family: var(--font-body, system-ui, sans-serif);
          text-align: center;
          min-width: 44px;
        }
        .tb-head-title {
          font-weight: 600;
          font-size: 0.68rem;
        }
        .tb-head-sub {
          font-size: 0.65rem;
          opacity: 0.8;
        }
        .tb-heads-concat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
        }
        .tb-heads-concat-box {
          padding: 0.3rem 0.75rem;
          border-radius: 4px;
          background: #fdf4ff;
          border: 1px solid #e9d5ff;
          color: #7e22ce;
          font-size: 0.75rem;
          font-family: var(--font-body, system-ui, sans-serif);
          font-weight: 500;
        }

        /* Residual add visualization */
        .tb-residual-layout {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .tb-res-term {
          flex: 1;
          min-width: 70px;
          text-align: center;
        }
        .tb-res-box {
          padding: 0.35rem 0.4rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-family: var(--font-body, system-ui, sans-serif);
          font-weight: 500;
          text-align: center;
        }
        .tb-res-plus {
          font-size: 1.2rem;
          font-weight: 700;
          color: #7e22ce;
          font-family: var(--font-body, system-ui, sans-serif);
          flex-shrink: 0;
        }
        .tb-res-arrow {
          font-size: 1rem;
          color: var(--color-muted, #6b7280);
          flex-shrink: 0;
        }

        /* FFN expand visualization */
        .tb-ffn-layout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .tb-ffn-bar-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }
        .tb-ffn-bar {
          width: 36px;
          border-radius: 4px;
        }
        .tb-ffn-bar-label {
          font-size: 0.65rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-mono, monospace);
          text-align: center;
        }
        .tb-ffn-bar-sublabel {
          font-size: 0.6rem;
          color: #166534;
          font-family: var(--font-body, system-ui, sans-serif);
          text-align: center;
          max-width: 60px;
        }
        .tb-ffn-arrow {
          font-size: 1rem;
          color: var(--color-muted, #6b7280);
          align-self: center;
        }

        /* Stack visualization */
        .tb-stack-layout {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          align-items: stretch;
        }
        .tb-stack-block {
          padding: 0.35rem 0.75rem;
          border-radius: 4px;
          font-size: 0.78rem;
          font-family: var(--font-body, system-ui, sans-serif);
          text-align: center;
          transition: all 0.15s;
        }
        .tb-stack-label {
          font-size: 0.72rem;
          color: var(--color-muted, #6b7280);
          text-align: center;
          margin-top: 0.25rem;
          font-style: italic;
          font-family: var(--font-body, system-ui, sans-serif);
        }

        /* ── Navigation ── */
        .tb-nav {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px dashed var(--color-border, #e5e7eb);
        }
        .tb-nav-btn {
          padding: 0.4rem 1rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 999px;
          font-size: 0.82rem;
          font-family: var(--font-body, system-ui, sans-serif);
          background: var(--color-bg, #fff);
          color: var(--color-muted, #6b7280);
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }
        .tb-nav-btn:hover:not(:disabled) {
          background: var(--color-surface, #f8f9fa);
        }
        .tb-nav-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .tb-nav-btn--primary {
          background: var(--color-accent, #3b82f6);
          border-color: var(--color-accent, #3b82f6);
          color: #fff;
          font-weight: 600;
        }
        .tb-nav-btn--primary:hover:not(:disabled) {
          background: #2563eb;
          border-color: #2563eb;
        }
        .tb-step-indicator {
          font-size: 0.78rem;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
          white-space: nowrap;
        }
        .tb-dots {
          display: flex;
          gap: 0.35rem;
          align-items: center;
          margin-left: auto;
        }
        .tb-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-border, #e5e7eb);
          transition: background 0.15s;
        }
        .tb-dot--active {
          background: var(--color-accent, #3b82f6);
        }
        .tb-dot--done {
          background: var(--color-muted, #6b7280);
          opacity: 0.4;
        }

        /* Pulse animation for active rows */
        @keyframes tb-pulse {
          0%, 100% { box-shadow: 0 0 0 2px currentColor, 0 0 8px 1px rgba(59,130,246,0.15); }
          50%       { box-shadow: 0 0 0 2px currentColor, 0 0 16px 4px rgba(59,130,246,0.3); }
        }
        .tb-diagram-row--active {
          animation: tb-pulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* ── Navigation (top, stays fixed between steps) ── */}
      <div className="tb-nav">
        <button
          className="tb-nav-btn"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          ← Prev
        </button>
        <span className="tb-step-indicator">Step {step + 1} of {STEP_COUNT}</span>
        {step < STEP_COUNT - 1 ? (
          <button
            className="tb-nav-btn tb-nav-btn--primary"
            onClick={() => setStep((s) => Math.min(STEP_COUNT - 1, s + 1))}
          >
            Next →
          </button>
        ) : (
          <button
            className="tb-nav-btn"
            onClick={() => setStep(0)}
          >
            ↺ Restart
          </button>
        )}
        <div className="tb-dots" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span
              key={i}
              className={`tb-dot${i === step ? " tb-dot--active" : i < step ? " tb-dot--done" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="tb-wrap">
        {/* ── Left: block diagram ── */}
        <div className="tb-diagram">
          {/* Output arrow (top) */}
          <div className={`tb-arrow-out${step === 5 ? " tb-arrow-out--active" : ""}`}>
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
              <path d="M5 0v10M1 6l4 5 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>output</span>
          </div>

          {/* Block rows */}
          {ROWS.map((row) => {
            const colors = ROW_COLORS[row.type];
            const isActive = activeRows.includes(row.key);
            return (
              <div
                key={row.key}
                className={`tb-diagram-row${isActive ? " tb-diagram-row--active" : " tb-diagram-row--inactive"}`}
                style={{
                  background: colors.bg,
                  color: colors.text,
                  borderColor: isActive ? colors.text : colors.border,
                }}
              >
                {row.label}
              </div>
            );
          })}

          {/* Input arrow (bottom) */}
          <div className={`tb-arrow-in${step === 0 ? " tb-arrow-in--active" : ""}`}>
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
              <path d="M5 12V2M1 6l4-5 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>input</span>
          </div>
        </div>

        {/* ── Right: explanation panel ── */}
        <div className="tb-panel">
          <div className="tb-step-title">{meta.title}</div>
          <p className="tb-caption">{meta.caption}</p>

          {meta.panel === "input"          && <PanelInput />}
          {meta.panel === "heads"          && <PanelHeads />}
          {meta.panel === "residual-attn"  && <PanelResidualAttn />}
          {meta.panel === "ffn-expand"     && <PanelFFNExpand />}
          {meta.panel === "residual-ffn"   && <PanelResidualFFN />}
          {meta.panel === "stack"          && <PanelStack />}
        </div>
      </div>

    </div>
  );
}
