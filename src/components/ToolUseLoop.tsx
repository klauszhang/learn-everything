import { useState } from "react";
import { toolUseSteps, type ConversationStep, type StepKind } from "../data/tool-use";

// ── Style constants ────────────────────────────────────────────────────────────

const KIND_STYLES: Record<
  StepKind,
  { bg: string; border: string; labelColor: string; icon: string }
> = {
  user: {
    bg: "#f0f9ff",
    border: "#38bdf8",
    labelColor: "#0369a1",
    icon: "→",
  },
  assistant_text: {
    bg: "#f5f3ff",
    border: "#a78bfa",
    labelColor: "#6d28d9",
    icon: "◆",
  },
  tool_use: {
    bg: "#fef3c7",
    border: "#f59e0b",
    labelColor: "#92400e",
    icon: "⚙",
  },
  tool_result: {
    bg: "#ecfdf5",
    border: "#34d399",
    labelColor: "#065f46",
    icon: "←",
  },
  assistant_final: {
    bg: "#f5f3ff",
    border: "#7c3aed",
    labelColor: "#4c1d95",
    icon: "✓",
  },
};

// ── Step block ─────────────────────────────────────────────────────────────────

function StepBlock({
  step,
  index,
  isNew,
}: {
  step: ConversationStep;
  index: number;
  isNew: boolean;
}) {
  const s = KIND_STYLES[step.kind];
  const isCode =
    step.kind === "tool_use" || step.kind === "tool_result";

  return (
    <div
      style={{
        background: s.bg,
        border: `1.5px solid ${s.border}`,
        borderRadius: "7px",
        padding: "10px 12px",
        marginBottom: "8px",
        transition: "opacity 0.25s",
        opacity: isNew ? 1 : 0.85,
        animation: isNew ? "fadeIn 0.3s ease" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "5px",
        }}
      >
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: s.labelColor,
            background: `${s.border}22`,
            border: `1px solid ${s.border}`,
            borderRadius: "4px",
            padding: "1px 6px",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {s.icon} {step.label}
        </span>
        {step.subLabel && (
          <span
            style={{
              fontSize: "0.68rem",
              color: s.labelColor,
              fontFamily: "ui-monospace, monospace",
              opacity: 0.8,
            }}
          >
            {step.subLabel}
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.6rem",
            color: "#9ca3af",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          step {index + 1}
        </span>
      </div>

      {isCode ? (
        <pre
          style={{
            margin: 0,
            fontSize: "0.71rem",
            lineHeight: 1.5,
            color: "#1e293b",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            fontFamily: "ui-monospace, monospace",
            background: "rgba(255,255,255,0.5)",
            borderRadius: "4px",
            padding: "6px 8px",
          }}
        >
          {step.content}
        </pre>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: "0.82rem",
            lineHeight: 1.55,
            color: "#1e293b",
          }}
        >
          {step.content}
        </p>
      )}
    </div>
  );
}

// ── Harness panel ──────────────────────────────────────────────────────────────

function HarnessPanel({
  steps,
  currentIndex,
}: {
  steps: ConversationStep[];
  currentIndex: number;
}) {
  const visibleSteps = steps.slice(0, currentIndex + 1).filter((s) => s.harnessNote);

  return (
    <div
      style={{
        background: "#1e293b",
        borderRadius: "8px",
        padding: "14px",
        height: "100%",
        minHeight: "260px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "#94a3b8",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "4px",
          borderBottom: "1px solid #334155",
          paddingBottom: "6px",
        }}
      >
        Harness execution log
      </div>

      {visibleSteps.length === 0 && (
        <p style={{ color: "#475569", fontSize: "0.75rem", margin: 0, fontStyle: "italic" }}>
          Waiting for first API call…
        </p>
      )}

      {visibleSteps.map((step, i) => {
        const s = KIND_STYLES[step.kind];
        return (
          <div
            key={i}
            style={{
              fontSize: "0.72rem",
              color: "#cbd5e1",
              lineHeight: 1.5,
              padding: "6px 8px",
              borderLeft: `3px solid ${s.border}`,
              background: "rgba(255,255,255,0.04)",
              borderRadius: "0 4px 4px 0",
            }}
          >
            {step.harnessNote}
          </div>
        );
      })}
    </div>
  );
}

// ── Loop indicator ─────────────────────────────────────────────────────────────

function LoopIndicator({ step }: { step: ConversationStep }) {
  const isLooping = step.kind === "tool_use" || step.kind === "tool_result";
  const isDone = step.kind === "assistant_final";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderRadius: "6px",
        fontSize: "0.76rem",
        fontWeight: 600,
        background: isDone ? "#f0fdf4" : isLooping ? "#fffbeb" : "#f8fafc",
        border: `1px solid ${isDone ? "#86efac" : isLooping ? "#fcd34d" : "#e2e8f0"}`,
        color: isDone ? "#166534" : isLooping ? "#92400e" : "#475569",
        marginBottom: "16px",
      }}
    >
      <span style={{ fontSize: "1rem" }}>
        {isDone ? "✓" : isLooping ? "↻" : "→"}
      </span>
      {isDone
        ? "Loop complete — stop_reason: \"end_turn\""
        : isLooping
        ? "Loop active — stop_reason: \"tool_use\""
        : "Loop not yet started"}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ToolUseLoop() {
  const [currentStep, setCurrentStep] = useState(0);
  const total = toolUseSteps.length;

  function advance() {
    setCurrentStep((s) => Math.min(s + 1, total - 1));
  }

  function reset() {
    setCurrentStep(0);
  }

  const visibleSteps = toolUseSteps.slice(0, currentStep + 1);
  const current = toolUseSteps[currentStep];
  const isDone = currentStep === total - 1;

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        maxWidth: "720px",
        margin: "0 auto",
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Status bar */}
      <LoopIndicator step={current} />

      {/* Two-panel layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "16px",
          alignItems: "start",
        }}
      >
        {/* Left: conversation */}
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#6b7280",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Conversation history
          </div>
          {visibleSteps.map((step, i) => (
            <StepBlock
              key={i}
              step={step}
              index={i}
              isNew={i === currentStep}
            />
          ))}
        </div>

        {/* Right: harness log */}
        <div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#6b7280",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Harness (your code)
          </div>
          <HarnessPanel steps={toolUseSteps} currentIndex={currentStep} />
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          marginTop: "16px",
        }}
      >
        <button
          onClick={advance}
          disabled={isDone}
          style={{
            padding: "8px 20px",
            background: isDone ? "#e5e7eb" : "#3b82f6",
            color: isDone ? "#9ca3af" : "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: isDone ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {isDone ? "Done" : "Next step →"}
        </button>

        <button
          onClick={reset}
          style={{
            padding: "8px 16px",
            background: "transparent",
            color: "#6b7280",
            border: "1.5px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "0.82rem",
            cursor: "pointer",
          }}
        >
          Reset
        </button>

        <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginLeft: "4px" }}>
          Step {currentStep + 1} of {total}
        </span>
      </div>

      <p
        style={{
          marginTop: "12px",
          fontSize: "0.7rem",
          color: "#9ca3af",
          fontStyle: "italic",
        }}
      >
        Illustrative only — conversation and tool outputs are hand-authored to
        demonstrate the mechanic. Each click is one turn in the loop.
      </p>
    </div>
  );
}
