import { useState } from "react";

const TOKEN_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" },
  { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
  { bg: "#fce7f3", border: "#f9a8d4", text: "#831843" },
  { bg: "#e0f2fe", border: "#7dd3fc", text: "#075985" },
  { bg: "#dcfce7", border: "#86efac", text: "#14532d" },
  { bg: "#fef9c3", border: "#fde047", text: "#713f12" },
  { bg: "#f3e8ff", border: "#d8b4fe", text: "#581c87" },
];

const UNK_COLOR = { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" };

interface WordToken {
  text: string;
  isUnk: boolean;
}

interface Preset {
  id: string;
  label: string;
  text: string;
  charTokens: string[];
  wordTokens: WordToken[];
  bpeTokens: string[];
}

const PRESETS: Preset[] = [
  {
    id: "simple",
    label: "Simple",
    text: "The cat sat on the mat",
    charTokens: "The cat sat on the mat".split(""),
    wordTokens: [
      { text: "The", isUnk: false },
      { text: "cat", isUnk: false },
      { text: "sat", isUnk: false },
      { text: "on", isUnk: false },
      { text: "the", isUnk: false },
      { text: "mat", isUnk: false },
    ],
    bpeTokens: ["The", " cat", " sat", " on", " the", " mat"],
  },
  {
    id: "rare-name",
    label: "Rare name",
    text: "Llaurentiu studied transformers",
    charTokens: "Llaurentiu studied transformers".split(""),
    wordTokens: [
      { text: "Llaurentiu", isUnk: true },
      { text: "studied", isUnk: false },
      { text: "transformers", isUnk: false },
    ],
    bpeTokens: ["Ll", "aurent", "iu", " studied", " transform", "ers"],
  },
  {
    id: "code",
    label: "Code",
    text: "getData(userId)",
    charTokens: "getData(userId)".split(""),
    wordTokens: [{ text: "getData(userId)", isUnk: true }],
    bpeTokens: ["get", "Data", "(", "user", "Id", ")"],
  },
  {
    id: "mixed",
    label: "Mixed",
    text: "The hyperparameter is non-trivial",
    charTokens: "The hyperparameter is non-trivial".split(""),
    wordTokens: [
      { text: "The", isUnk: false },
      { text: "hyperparameter", isUnk: true },
      { text: "is", isUnk: false },
      { text: "non-trivial", isUnk: true },
    ],
    bpeTokens: ["The", " hyper", "parameter", " is", " non", "-", "trivial"],
  },
];

// ~50 common words for the word-level UNK heuristic
const COMMON_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with",
  "is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","shall","can","not",
  "no","yes","i","you","he","she","it","we","they","this","that","these",
  "those","my","your","his","her","its","our","their","what","which","who",
  "how","when","where","why","if","then","than","so","as","by","from","up",
  "about","into","through","after","before","out","over","under","between",
  "cat","sat","mat","studied","transformers","get","data","user","trivial",
]);

function bpeFromText(text: string): string[] {
  // Tokenize by splitting on non-alpha boundaries, preserving spaces as prefixes
  const result: string[] = [];
  const regex = /\s*[^\s]+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const leadingSpaces = raw.match(/^\s*/)?.[0] ?? "";
    const word = raw.slice(leadingSpaces.length);

    if (word.length === 0) continue;

    // Split punctuation off
    const parts = word.split(/(?=[^a-zA-Z0-9])|(?<=[^a-zA-Z0-9])/);
    const alphaParts: string[] = [];

    for (const p of parts) {
      if (p === "") continue;
      if (!/[a-zA-Z0-9]/.test(p)) {
        if (alphaParts.length === 0 && leadingSpaces && result.length === 0) {
          result.push(leadingSpaces + p);
        } else {
          result.push(p);
        }
      } else {
        alphaParts.push(p);
      }
    }

    for (let pi = 0; pi < alphaParts.length; pi++) {
      const ap = alphaParts[pi];
      const prefix = pi === 0 ? leadingSpaces : "";

      if (COMMON_WORDS.has(ap.toLowerCase()) || ap.length <= 5) {
        result.push(prefix + ap);
      } else {
        // split long word
        const mid = Math.ceil(ap.length / 2);
        result.push(prefix + ap.slice(0, mid));
        result.push(ap.slice(mid));
      }
    }
  }

  return result.filter((t) => t.length > 0);
}

function charTokenize(text: string): string[] {
  return text.split("");
}

function wordTokenize(text: string): WordToken[] {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => ({
      text: w,
      isUnk: !COMMON_WORDS.has(w.toLowerCase()),
    }));
}

export default function EncodingCompare() {
  const [activeId, setActiveId] = useState<string | "custom">(PRESETS[0].id);
  const [customText, setCustomText] = useState("");

  const preset = PRESETS.find((p) => p.id === activeId);

  let charTokens: string[];
  let wordTokens: WordToken[];
  let bpeTokens: string[];

  if (preset) {
    charTokens = preset.charTokens;
    wordTokens = preset.wordTokens;
    bpeTokens = preset.bpeTokens;
  } else {
    const text = customText || "";
    charTokens = charTokenize(text);
    wordTokens = wordTokenize(text);
    bpeTokens = text.length > 0 ? bpeFromText(text) : [];
  }

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .ec-tabs {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
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
        .tc-tab:hover {
          background: var(--color-surface, #f8f9fa);
        }
        .tc-tab--active {
          background: var(--color-accent-soft, #dbeafe);
          border-color: var(--color-accent, #3b82f6);
          color: var(--color-accent, #3b82f6);
          font-weight: 600;
        }
        .ec-custom-input {
          width: 100%;
          box-sizing: border-box;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 6px;
          font-family: var(--font-mono, monospace);
          font-size: 0.9rem;
          background: var(--color-bg, #fff);
          color: inherit;
          margin-bottom: 1rem;
        }
        .ec-custom-input:focus {
          outline: 2px solid var(--color-accent, #3b82f6);
          outline-offset: 1px;
        }
        .ec-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 640px) {
          .ec-grid {
            grid-template-columns: 1fr;
          }
        }
        .ec-col {
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 8px;
          padding: 0.875rem;
          background: var(--color-surface, #f8f9fa);
        }
        .ec-col-header {
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-muted, #6b7280);
          margin-bottom: 0.75rem;
        }
        .ec-tokens {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          margin-bottom: 0.65rem;
          min-height: 2rem;
        }
        .ec-token {
          display: inline-block;
          padding: 0.25rem 0.45rem;
          border-radius: 4px;
          font-family: var(--font-mono, monospace);
          font-size: 0.82rem;
          border: 1px solid;
          white-space: pre;
          line-height: 1.3;
        }
        .ec-count {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-muted, #6b7280);
          margin-bottom: 0.5rem;
        }
        .ec-caption {
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          font-style: italic;
          line-height: 1.4;
        }
        .ec-note {
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          margin-top: 1rem;
          font-style: italic;
        }
      `}</style>

      <div className="ec-tabs">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`tc-tab${activeId === p.id ? " tc-tab--active" : ""}`}
            onClick={() => setActiveId(p.id)}
          >
            {p.label}
          </button>
        ))}
        <button
          className={`tc-tab${activeId === "custom" ? " tc-tab--active" : ""}`}
          onClick={() => setActiveId("custom")}
        >
          Custom
        </button>
      </div>

      {activeId === "custom" && (
        <input
          className="ec-custom-input"
          type="text"
          placeholder="Type any text..."
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
        />
      )}

      <div className="ec-grid">
        {/* Column 1 — Character */}
        <div className="ec-col">
          <div className="ec-col-header">Character</div>
          <div className="ec-tokens">
            {charTokens.map((ch, i) => {
              const color = TOKEN_COLORS[i % TOKEN_COLORS.length];
              return (
                <span
                  key={i}
                  className="ec-token"
                  style={{
                    background: color.bg,
                    borderColor: color.border,
                    color: color.text,
                  }}
                >
                  {ch === " " ? " " : ch}
                </span>
              );
            })}
          </div>
          <div className="ec-count">
            {charTokens.length} token{charTokens.length !== 1 ? "s" : ""}
          </div>
          <div className="ec-caption">
            Every character = 1 token. Sequences get very long.
          </div>
        </div>

        {/* Column 2 — Word */}
        <div className="ec-col">
          <div className="ec-col-header">Word</div>
          <div className="ec-tokens">
            {wordTokens.map((wt, i) => {
              const color = wt.isUnk
                ? UNK_COLOR
                : TOKEN_COLORS[i % TOKEN_COLORS.length];
              return (
                <span
                  key={i}
                  className="ec-token"
                  style={{
                    background: color.bg,
                    borderColor: color.border,
                    color: color.text,
                  }}
                >
                  {wt.isUnk ? "⟨UNK⟩" : wt.text}
                </span>
              );
            })}
          </div>
          <div className="ec-count">
            {wordTokens.length} token{wordTokens.length !== 1 ? "s" : ""}
          </div>
          <div className="ec-caption">
            Compact, but rare words become ⟨UNK⟩.
          </div>
        </div>

        {/* Column 3 — Subword (BPE) */}
        <div className="ec-col">
          <div className="ec-col-header">Subword (BPE)</div>
          <div className="ec-tokens">
            {bpeTokens.map((tok, i) => {
              const color = TOKEN_COLORS[i % TOKEN_COLORS.length];
              return (
                <span
                  key={i}
                  className="ec-token"
                  style={{
                    background: color.bg,
                    borderColor: color.border,
                    color: color.text,
                  }}
                >
                  {tok}
                </span>
              );
            })}
          </div>
          <div className="ec-count">
            {bpeTokens.length} token{bpeTokens.length !== 1 ? "s" : ""}
          </div>
          <div className="ec-caption">
            Best of both — rare words split into known pieces.
          </div>
        </div>
      </div>

      <p className="ec-note">
        Illustrative only — preset splits are hand-authored; custom text uses a
        simple heuristic, not a real BPE model.
      </p>
    </div>
  );
}
