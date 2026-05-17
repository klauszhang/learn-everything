import { useState } from "react";
import { TOKEN_EXAMPLES } from "../data/tokens";

// Palette of soft accent colors for token highlighting.
// Amber (--color-cache) is reserved for cache-hit highlights — never used here.
const TOKEN_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" }, // blue
  { bg: "#d1fae5", border: "#6ee7b7", text: "#065f46" }, // green
  { bg: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" }, // violet
  { bg: "#fce7f3", border: "#f9a8d4", text: "#831843" }, // pink
  { bg: "#e0f2fe", border: "#7dd3fc", text: "#075985" }, // sky
  { bg: "#dcfce7", border: "#86efac", text: "#14532d" }, // emerald
  { bg: "#fef9c3", border: "#fde047", text: "#713f12" }, // yellow (not amber)
  { bg: "#f3e8ff", border: "#d8b4fe", text: "#581c87" }, // purple
];

const SPECIAL_TOKEN_COLOR = { bg: "#f3f4f6", border: "#9ca3af", text: "#4b5563" };

function isSpecialToken(chunk: string): boolean {
  return chunk.startsWith("<") && chunk.endsWith(">");
}

export default function TokenChunks() {
  const [activeId, setActiveId] = useState(TOKEN_EXAMPLES[0].id);
  const [showIds, setShowIds] = useState(false);
  const example = TOKEN_EXAMPLES.find((e) => e.id === activeId)!;

  const idsPreview = showIds
    ? (() => {
        const preview = example.ids.slice(0, 5);
        const suffix = example.ids.length > 5 ? ", ..." : "";
        return ` → [${preview.join(", ")}${suffix}]`;
      })()
    : "";

  return (
    <div style={{ maxWidth: "var(--content-max, 720px)" }}>
      <style>{`
        .tc-tabs {
          display: flex;
          align-items: center;
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
        .tc-description {
          font-size: 0.88rem;
          color: var(--color-muted, #6b7280);
          margin-bottom: 1rem;
          font-style: italic;
        }
        .tc-chunks {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
          margin-bottom: 0.75rem;
        }
        .tc-chunk {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          padding: 0.3rem 0.55rem;
          border-radius: 4px;
          font-family: var(--font-mono, monospace);
          font-size: 0.9rem;
          border: 1px solid;
          white-space: pre;
        }
        .tc-chunk-text {
          /* inherits font from parent */
        }
        .tc-chunk-id {
          font-size: 0.65rem;
          opacity: 0.7;
          font-family: var(--font-mono, monospace);
        }
        .tc-count {
          font-size: 0.8rem;
          color: var(--color-muted, #6b7280);
        }
        .tc-note {
          font-size: 0.75rem;
          color: var(--color-muted, #6b7280);
          margin-top: 1rem;
          font-style: italic;
        }
      `}</style>

      <div className="tc-tabs">
        {TOKEN_EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            className={`tc-tab${activeId === ex.id ? " tc-tab--active" : ""}`}
            onClick={() => setActiveId(ex.id)}
          >
            {ex.label}
          </button>
        ))}
        <button
          className={`tc-tab${showIds ? " tc-tab--active" : ""}`}
          onClick={() => setShowIds(!showIds)}
          style={{ marginLeft: "auto" }}
        >
          {showIds ? "Hide IDs" : "Show IDs"}
        </button>
      </div>

      <p className="tc-description">{example.description}</p>

      <div className="tc-chunks">
        {example.chunks.map((chunk, i) => {
          const special = isSpecialToken(chunk);
          const color = special
            ? SPECIAL_TOKEN_COLOR
            : TOKEN_COLORS[i % TOKEN_COLORS.length];
          return (
            <span
              key={i}
              className="tc-chunk"
              style={{
                background: color.bg,
                borderColor: color.border,
                color: color.text,
                borderStyle: special ? "dashed" : "solid",
              }}
            >
              <span className="tc-chunk-text">{chunk}</span>
              {showIds && (
                <span className="tc-chunk-id">{example.ids[i]}</span>
              )}
            </span>
          );
        })}
      </div>

      <div className="tc-count">
        {example.chunks.length} token{example.chunks.length !== 1 ? "s" : ""}
        {idsPreview}
      </div>

      <p className="tc-note">
        Illustrative only — hand-authored to show tokenization patterns, not
        real model output.
      </p>
    </div>
  );
}
