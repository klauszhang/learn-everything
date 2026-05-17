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

const SPECIAL_TOKEN_COLOR = { bg: "#f3f4f6", border: "#9ca3af", text: "#4b5563" };

// Simple heuristic tokenizer: split on spaces, punctuation gets its own token,
// long words split at midpoint. Mirrors the approach in EncodingCompare.tsx.
function heuristicTokenize(text: string): string[] {
  if (text.length === 0) return [];

  const result: string[] = [];
  const regex = /\s*[^\s]+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const leadingSpaces = raw.match(/^\s*/)?.[0] ?? "";
    const word = raw.slice(leadingSpaces.length);

    if (word.length === 0) continue;

    // Split on punctuation boundaries
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

      if (ap.length <= 5) {
        result.push(prefix + ap);
      } else {
        // Split long word at midpoint
        const mid = Math.ceil(ap.length / 2);
        result.push(prefix + ap.slice(0, mid));
        result.push(ap.slice(mid));
      }
    }
  }

  return result.filter((t) => t.length > 0);
}

// Assign a stable fake token ID based on index and text content
function fakeTokenId(text: string, index: number): number {
  let hash = index * 1000;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) & 0xffff;
  }
  return (hash % 50000) + 1000;
}

interface TokenChipProps {
  text: string;
  colorIndex: number;
  isSpecial?: boolean;
  tokenId: number;
}

function TokenChip({ text, colorIndex, isSpecial = false, tokenId }: TokenChipProps) {
  const color = isSpecial ? SPECIAL_TOKEN_COLOR : TOKEN_COLORS[colorIndex % TOKEN_COLORS.length];
  return (
    <span
      className="stw-chip"
      style={{
        background: color.bg,
        borderColor: color.border,
        color: color.text,
        borderStyle: isSpecial ? "dashed" : "solid",
      }}
    >
      <span className="stw-chip-text">{text}</span>
      <span className="stw-chip-id">{tokenId}</span>
    </span>
  );
}

export default function SpecialTokensWrap() {
  const [inputText, setInputText] = useState("The cat sat on the mat");

  const contentTokens = heuristicTokenize(inputText);

  // Total = BOS + content tokens + EOS
  const totalCount = 1 + contentTokens.length + 1;

  // Fake IDs: BOS is always 1, EOS is always 2, content tokens get heuristic IDs
  const bosId = 1;
  const eosId = 2;

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .stw-input {
          width: 100%;
          box-sizing: border-box;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 6px;
          font-family: var(--font-mono, monospace);
          font-size: 0.9rem;
          background: var(--color-bg, #fff);
          color: inherit;
          margin-bottom: 1.25rem;
        }
        .stw-input:focus {
          outline: 2px solid var(--color-accent, #3b82f6);
          outline-offset: 1px;
        }
        .stw-rows {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .stw-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .stw-row-label {
          flex-shrink: 0;
          width: 7.5rem;
          padding-top: 0.35rem;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--color-muted, #6b7280);
          font-family: var(--font-body, system-ui, sans-serif);
        }
        .stw-row-content {
          flex: 1;
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius, 8px);
          padding: 0.65rem 0.75rem;
          background: var(--color-surface, #f8f9fa);
          font-family: var(--font-mono, monospace);
          font-size: 0.9rem;
          min-height: 2.5rem;
          word-break: break-all;
          line-height: 1.5;
          color: inherit;
        }
        .stw-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }
        .stw-chip {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 0.12rem;
          padding: 0.3rem 0.55rem;
          border-radius: 4px;
          font-family: var(--font-mono, monospace);
          font-size: 0.88rem;
          border: 1px solid;
          white-space: pre;
        }
        .stw-chip-text {
          /* inherits font */
        }
        .stw-chip-id {
          font-size: 0.62rem;
          opacity: 0.65;
          font-family: var(--font-mono, monospace);
        }
        .stw-count {
          margin-top: 0.75rem;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-muted, #6b7280);
        }
        .stw-note {
          margin-top: 1rem;
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          font-style: italic;
        }
        @media (max-width: 520px) {
          .stw-row {
            flex-direction: column;
            gap: 0.35rem;
          }
          .stw-row-label {
            width: auto;
            padding-top: 0;
          }
        }
      `}</style>

      <input
        className="stw-input"
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Type something..."
        aria-label="Input text"
      />

      <div className="stw-rows">
        {/* Row 1: You type */}
        <div className="stw-row">
          <div className="stw-row-label">You type:</div>
          <div className="stw-row-content">
            {inputText || <span style={{ opacity: 0.4 }}>(empty)</span>}
          </div>
        </div>

        {/* Row 2: Model sees */}
        <div className="stw-row">
          <div className="stw-row-label">Model sees:</div>
          <div className="stw-row-content">
            <div className="stw-chips">
              {/* BOS */}
              <TokenChip
                text="<BOS>"
                colorIndex={0}
                isSpecial
                tokenId={bosId}
              />

              {/* Content tokens */}
              {contentTokens.map((tok, i) => (
                <TokenChip
                  key={i}
                  text={tok}
                  colorIndex={i}
                  tokenId={fakeTokenId(tok, i)}
                />
              ))}

              {/* EOS */}
              <TokenChip
                text="<EOS>"
                colorIndex={0}
                isSpecial
                tokenId={eosId}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="stw-count">
        {totalCount} token{totalCount !== 1 ? "s" : ""} total (1 BOS + {contentTokens.length} content + 1 EOS)
      </div>

      <p className="stw-note">
        Illustrative — token splits use a simple heuristic, not a real BPE model.
      </p>
    </div>
  );
}
