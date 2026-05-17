/**
 * RagDemo.tsx — "No RAG vs. RAG" toggle demo (Demo option A from dossier §10).
 *
 * Shows the same question answered with and without retrieved context.
 * All data is ILLUSTRATIVE — hand-authored, not produced by a real model.
 *
 * Demo choice rationale: Option A makes the core value proposition immediate
 * and visceral. The reader can see exactly which retrieved chunk is responsible
 * for the grounded answer, making cause-and-effect concrete on a single screen.
 */

import { useState } from "react";
import { queries, corpus } from "../data/rag";

const fixture = queries[0]; // "How does Acme Workflow handle recurring billing?"
const groundTruthChunk = corpus.find(
  (c) => c.id === fixture.groundTruthChunkIds[0]
)!;

const styles: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "inherit",
    maxWidth: 720,
    margin: "0 auto",
  },
  toggleRow: {
    display: "flex",
    gap: 0,
    marginBottom: 20,
    borderRadius: 8,
    overflow: "hidden",
    border: "1.5px solid #d1d5db",
    width: "fit-content",
  },
  toggleBtn: {
    padding: "8px 20px",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    background: "#f9fafb",
    color: "#6b7280",
    transition: "background 0.15s, color 0.15s",
  },
  toggleBtnActive: {
    background: "#1e40af",
    color: "#fff",
  },
  toggleBtnActiveRag: {
    background: "#166534",
    color: "#fff",
  },
  question: {
    background: "#f8fafc",
    border: "1.5px solid #e2e8f0",
    borderRadius: 8,
    padding: "10px 16px",
    marginBottom: 16,
    fontSize: "0.9rem",
    color: "#374151",
  },
  questionLabel: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "#94a3b8",
    marginBottom: 4,
  },
  chunkBox: {
    background: "#ecfdf5",
    border: "1.5px solid #6ee7b7",
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 16,
    fontSize: "0.85rem",
    lineHeight: 1.6,
    color: "#1f2937",
  },
  chunkLabel: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "#059669",
    marginBottom: 6,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chunkMeta: {
    fontSize: "0.72rem",
    color: "#6b7280",
    fontStyle: "italic",
  },
  answerBox: {
    borderRadius: 8,
    padding: "14px 16px",
    fontSize: "0.9rem",
    lineHeight: 1.65,
    color: "#1f2937",
  },
  answerLabel: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    marginBottom: 8,
  },
  noRagAnswer: {
    background: "#fef2f2",
    border: "1.5px solid #fca5a5",
  },
  ragAnswer: {
    background: "#f0fdf4",
    border: "1.5px solid #86efac",
  },
  noRagLabel: { color: "#dc2626" },
  ragLabel: { color: "#16a34a" },
  legend: {
    display: "flex",
    gap: 20,
    flexWrap: "wrap" as const,
    marginTop: 14,
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    display: "inline-block",
    flexShrink: 0,
  },
  promptBox: {
    background: "#fffbeb",
    border: "1.5px solid #f59e0b",
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 16,
    fontSize: "0.78rem",
    lineHeight: 1.5,
    color: "#78350f",
  },
  promptLabel: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "#b45309",
    marginBottom: 8,
  },
  promptSegment: {
    padding: "5px 8px",
    borderRadius: 5,
    marginBottom: 4,
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.78rem",
  },
  promptSegCached: {
    background: "#fef3c7",
    borderLeft: "3px solid #f59e0b",
    color: "#78350f",
  },
  promptSegUncached: {
    background: "#f1f5f9",
    borderLeft: "3px solid #94a3b8",
    color: "#475569",
  },
  promptArrow: {
    textAlign: "center" as const,
    fontSize: "0.8rem",
    color: "#94a3b8",
    margin: "2px 0",
  },
  illustrative: {
    fontSize: "0.7rem",
    color: "#94a3b8",
    textAlign: "right" as const,
    marginTop: 12,
    fontStyle: "italic",
  },
};

export default function RagDemo() {
  const [ragOn, setRagOn] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div style={styles.root}>
      {/* Toggle */}
      <div style={styles.toggleRow} role="group" aria-label="Toggle RAG mode">
        <button
          style={{
            ...styles.toggleBtn,
            ...(ragOn ? {} : styles.toggleBtnActive),
          }}
          onClick={() => setRagOn(false)}
          aria-pressed={!ragOn}
        >
          Without RAG
        </button>
        <button
          style={{
            ...styles.toggleBtn,
            ...(ragOn ? styles.toggleBtnActiveRag : {}),
          }}
          onClick={() => setRagOn(true)}
          aria-pressed={ragOn}
        >
          With RAG
        </button>
      </div>

      {/* Question */}
      <div style={styles.question}>
        <div style={styles.questionLabel}>Question</div>
        {fixture.question}
      </div>

      {/* Retrieved chunk (shown only in RAG mode) */}
      {ragOn && (
        <div style={styles.chunkBox}>
          <div style={styles.chunkLabel}>
            <span>Retrieved chunk (rank 1 of top-5)</span>
            <span style={styles.chunkMeta}>
              {groundTruthChunk.docTitle} · {groundTruthChunk.docDate}
            </span>
          </div>
          {groundTruthChunk.text}
        </div>
      )}

      {/* Prompt assembly detail (RAG mode only) */}
      {ragOn && (
        <div>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            style={{
              fontSize: "0.78rem",
              color: "#b45309",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 0 8px",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            {showPrompt ? "Hide" : "Show"} prompt assembly ↕
          </button>

          {showPrompt && (
            <div style={styles.promptBox}>
              <div style={styles.promptLabel}>
                Assembled prompt (echoes Ch 7 anatomy)
              </div>
              <div
                style={{ ...styles.promptSegment, ...styles.promptSegCached }}
              >
                System prompt — stable, cached ✦
              </div>
              <div style={styles.promptArrow}>↓</div>
              <div
                style={{ ...styles.promptSegment, ...styles.promptSegCached }}
              >
                Stable knowledge bundle (optional) — cached ✦
              </div>
              <div style={styles.promptArrow}>↓ cache breakpoint</div>
              <div
                style={{ ...styles.promptSegment, ...styles.promptSegUncached }}
              >
                Retrieved chunk: "{groundTruthChunk.text.slice(0, 60)}…"
                &nbsp;— per-query, NOT cached
              </div>
              <div style={styles.promptArrow}>↓</div>
              <div
                style={{ ...styles.promptSegment, ...styles.promptSegUncached }}
              >
                User question: "{fixture.question}" — NOT cached
              </div>
            </div>
          )}
        </div>
      )}

      {/* Answer */}
      <div
        style={{
          ...styles.answerBox,
          ...(ragOn ? styles.ragAnswer : styles.noRagAnswer),
        }}
      >
        <div
          style={{
            ...styles.answerLabel,
            ...(ragOn ? styles.ragLabel : styles.noRagLabel),
          }}
        >
          {ragOn ? "Grounded answer (with retrieved chunk)" : "Answer without context (vague / wrong)"}
        </div>
        {ragOn ? fixture.ragAnswer : fixture.noRagAnswer}
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span style={{ ...styles.swatch, background: "#fef3c7", border: "1.5px solid #f59e0b" }} />
          Cached (stable) — amber, same color as cached segments in Ch 7
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.swatch, background: "#f1f5f9", border: "1.5px solid #94a3b8" }} />
          Uncached (per-query retrieval + question)
        </span>
      </div>

      <p style={styles.illustrative}>
        Illustrative — all data hand-authored; no real model or retrieval involved.
      </p>
    </div>
  );
}
