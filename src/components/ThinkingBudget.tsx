import { useState } from "react";
import { THINKING_EXAMPLES, SAMPLE_PROBLEM } from "../data/extended-thinking";
import type { EffortLevel } from "../data/extended-thinking";

// ThinkingBudget.tsx — interactive demo for the Extended Thinking chapter.
// Illustrative — hand-authored data, not from a real API call.

const EFFORT_LEVELS: EffortLevel[] = ["none", "low", "medium", "high"];

function Bar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="tb-bar-row">
      <span className="tb-bar-label">{label}</span>
      <div className="tb-bar-track">
        <div
          className="tb-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="tb-bar-value">{value.toLocaleString()}</span>
    </div>
  );
}

export default function ThinkingBudget() {
  const [effort, setEffort] = useState<EffortLevel>("medium");

  const example = THINKING_EXAMPLES.find((e) => e.effort === effort)!;
  const maxTokens = Math.max(...THINKING_EXAMPLES.map((e) => e.thinkingTokens + e.answerTokens));
  const maxLatency = Math.max(...THINKING_EXAMPLES.map((e) => e.latencyMs));

  return (
    <div className="tb-root" aria-label="Thinking budget demo (illustrative)">
      <p className="tb-illustrative-note">
        Illustrative — hand-authored for teaching. Numbers are approximate.
      </p>

      {/* Prompt */}
      <div className="tb-prompt-box">
        <span className="tb-prompt-label">Sample problem</span>
        <p className="tb-prompt-text">{SAMPLE_PROBLEM}</p>
      </div>

      {/* Effort selector */}
      <div className="tb-effort-selector" role="group" aria-label="Select effort level">
        {EFFORT_LEVELS.map((lvl) => (
          <button
            key={lvl}
            className={"tb-effort-btn" + (lvl === effort ? " tb-effort-btn--active" : "")}
            onClick={() => setEffort(lvl)}
            aria-pressed={lvl === effort}
          >
            {lvl === "none" ? "No thinking" : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
          </button>
        ))}
      </div>

      {/* API mode */}
      <div className="tb-api-mode">
        <span className="tb-api-label">API call:</span>
        <code className="tb-api-code">{example.apiMode}</code>
      </div>

      {/* Token & latency bars */}
      <div className="tb-bars">
        <Bar
          value={example.thinkingTokens}
          max={maxTokens}
          color="#64748b"
          label="Thinking tokens"
        />
        <Bar
          value={example.answerTokens}
          max={maxTokens}
          color="#3b82f6"
          label="Answer tokens"
        />
        <Bar
          value={example.latencyMs}
          max={maxLatency}
          color="#f59e0b"
          label="Latency (ms)"
        />
      </div>

      <p className="tb-cost-note">
        Illustrative cost (Opus 4.7, $25/MTok output):{" "}
        <strong>${(example.costCents / 100).toFixed(4)}</strong>
      </p>

      {/* Thinking stream */}
      {example.thinkingText && (
        <details className="tb-thinking-details" open>
          <summary className="tb-thinking-summary">
            Thinking block ({example.thinkingTokens} tokens, illustrative)
          </summary>
          <pre className="tb-thinking-pre">{example.thinkingText}</pre>
        </details>
      )}

      {/* Answer */}
      <div className="tb-answer-box">
        <span className="tb-answer-label">Answer</span>
        <p className="tb-answer-text">{example.answerText}</p>
      </div>

      <style>{`
        .tb-root {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          background: var(--color-surface);
          max-width: var(--content-max);
          margin: var(--space-6) 0;
          font-size: 0.9rem;
        }

        .tb-illustrative-note {
          font-size: 0.75rem;
          color: var(--color-muted);
          font-style: italic;
          margin: 0 0 var(--space-4);
        }

        .tb-prompt-box {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-3) var(--space-4);
          margin-bottom: var(--space-4);
        }

        .tb-prompt-label {
          display: block;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-muted);
          margin-bottom: var(--space-1);
        }

        .tb-prompt-text {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.82rem;
          line-height: 1.5;
          color: var(--color-text);
        }

        .tb-effort-selector {
          display: flex;
          gap: var(--space-2);
          flex-wrap: wrap;
          margin-bottom: var(--space-4);
        }

        .tb-effort-btn {
          padding: var(--space-2) var(--space-4);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          background: var(--color-bg);
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--color-text);
          transition: background 0.1s, border-color 0.1s;
        }

        .tb-effort-btn:hover {
          background: var(--color-accent-soft);
          border-color: var(--color-accent);
        }

        .tb-effort-btn--active {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: #fff;
          font-weight: 600;
        }

        .tb-api-mode {
          display: flex;
          align-items: baseline;
          gap: var(--space-2);
          margin-bottom: var(--space-4);
          flex-wrap: wrap;
        }

        .tb-api-label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-muted);
          flex-shrink: 0;
        }

        .tb-api-code {
          font-family: var(--font-mono);
          font-size: 0.78rem;
          color: #1e40af;
          background: var(--color-accent-soft);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          word-break: break-all;
        }

        .tb-bars {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .tb-bar-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .tb-bar-label {
          font-size: 0.78rem;
          color: var(--color-muted);
          width: 120px;
          flex-shrink: 0;
        }

        .tb-bar-track {
          flex: 1;
          height: 12px;
          background: var(--color-border);
          border-radius: 6px;
          overflow: hidden;
        }

        .tb-bar-fill {
          height: 100%;
          border-radius: 6px;
          transition: width 0.3s ease;
          min-width: 2px;
        }

        .tb-bar-value {
          font-family: var(--font-mono);
          font-size: 0.78rem;
          color: var(--color-text);
          width: 60px;
          text-align: right;
          flex-shrink: 0;
        }

        .tb-cost-note {
          font-size: 0.82rem;
          color: var(--color-muted);
          margin: 0 0 var(--space-4);
        }

        .tb-thinking-details {
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          margin-bottom: var(--space-4);
          overflow: hidden;
        }

        .tb-thinking-summary {
          padding: var(--space-2) var(--space-4);
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-muted);
          user-select: none;
          list-style: none;
        }

        .tb-thinking-summary::marker,
        .tb-thinking-summary::-webkit-details-marker {
          display: none;
        }

        .tb-thinking-summary::before {
          content: "▶ ";
          font-size: 0.7em;
        }

        details[open] .tb-thinking-summary::before {
          content: "▼ ";
        }

        .tb-thinking-pre {
          margin: 0;
          padding: var(--space-3) var(--space-4);
          font-family: var(--font-mono);
          font-size: 0.78rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
          color: #374151;
          border-top: 1px solid var(--color-border);
          background: #fafafa;
        }

        .tb-answer-box {
          background: var(--color-bg);
          border: 1px solid var(--color-accent);
          border-left-width: 3px;
          border-radius: var(--radius);
          padding: var(--space-3) var(--space-4);
        }

        .tb-answer-label {
          display: block;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-accent);
          margin-bottom: var(--space-1);
        }

        .tb-answer-text {
          margin: 0;
          font-size: 0.88rem;
          line-height: 1.6;
          color: var(--color-text);
        }
      `}</style>
    </div>
  );
}
