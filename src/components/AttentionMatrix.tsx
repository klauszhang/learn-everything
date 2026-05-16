import { useState } from "react";
import { attentionData } from "../data/attention";
import styles from "./AttentionMatrix.module.css";

const { tokens, weights } = attentionData;
const N = tokens.length;

/**
 * AttentionMatrix — interactive attention weight grid for Ch 3.
 *
 * Click any token label (column header OR row label) to select it as the
 * "query" token. The selected row highlights — showing which earlier tokens
 * it attends to. Weight intensity drives cell background opacity.
 *
 * Data is illustrative (hand-authored), not from a real model.
 */
export default function AttentionMatrix() {
  const [selected, setSelected] = useState<number | null>(null);

  function handleSelect(i: number) {
    setSelected((prev) => (prev === i ? null : i));
  }

  function cellOpacity(row: number, col: number): number {
    // Upper triangle is masked — always transparent
    if (col > row) return 0;
    return weights[row][col];
  }

  function isMasked(row: number, col: number): boolean {
    return col > row;
  }

  return (
    <figure className={styles.figure}>
      <div className={styles.wrapper} role="group" aria-label="Attention weight matrix — illustrative">
        {/* Top-left corner spacer */}
        <div className={styles.corner} />

        {/* Column headers — tokens as keys */}
        {tokens.map((tok, j) => (
          <button
            key={j}
            className={`${styles.colHeader} ${selected === j ? styles.colSelected : ""}`}
            onClick={() => handleSelect(j)}
            aria-label={`Select token ${tok} (position ${j})`}
            title={`Key token: ${tok}`}
          >
            <span className={styles.tokenLabel}>{tok}</span>
          </button>
        ))}

        {/* Rows — one per query token */}
        {tokens.map((tok, i) => (
          <>
            {/* Row header */}
            <button
              key={`row-${i}`}
              className={`${styles.rowHeader} ${selected === i ? styles.rowSelected : ""}`}
              onClick={() => handleSelect(i)}
              aria-label={`Select token ${tok} as query (position ${i})`}
              title={`Query token: ${tok}`}
            >
              <span className={styles.tokenLabel}>{tok}</span>
            </button>

            {/* Row cells */}
            {tokens.map((_, j) => {
              const masked = isMasked(i, j);
              const opacity = cellOpacity(i, j);
              const isActive = selected === i && !masked;
              const isAttended = selected !== null && selected === i && !masked && j <= i;

              return (
                <div
                  key={`cell-${i}-${j}`}
                  className={`${styles.cell} ${masked ? styles.masked : ""} ${isActive ? styles.activeRow : ""}`}
                  style={
                    !masked
                      ? {
                          backgroundColor: isAttended
                            ? `rgba(59, 130, 246, ${opacity * 0.85 + 0.08})`
                            : `rgba(59, 130, 246, ${opacity * 0.55})`,
                          outline: isAttended && opacity > 0.1 ? "1px solid var(--color-accent)" : undefined,
                        }
                      : undefined
                  }
                  title={
                    masked
                      ? `Masked (future token — causal mask)`
                      : `${tokens[i]} → ${tokens[j]}: ${(weights[i][j] * 100).toFixed(0)}%`
                  }
                  aria-label={
                    masked
                      ? `Cell (${i},${j}) masked`
                      : `${tokens[i]} attends to ${tokens[j]}: ${(weights[i][j] * 100).toFixed(0)}%`
                  }
                />
              );
            })}
          </>
        ))}
      </div>

      {/* Axis labels */}
      <div className={styles.axisLabels}>
        <span className={styles.axisY}>↑ Query token (row)</span>
        <span className={styles.axisX}>Key token (column) →</span>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendSwatch} style={{ background: "rgba(59,130,246,0.65)" }} />
        <span>Attention weight (darker = higher)</span>
        <span className={styles.legendMasked} />
        <span>Masked (future tokens — causal mask)</span>
      </div>

      {selected !== null ? (
        <p className={styles.hint}>
          <strong>{tokens[selected]}</strong> (position {selected}) attends to:{" "}
          {tokens
            .slice(0, selected + 1)
            .map((t, j) => `${t} (${(weights[selected][j] * 100).toFixed(0)}%)`)
            .join(", ")}
          . Click again to deselect.
        </p>
      ) : (
        <p className={styles.hint}>Click a token label to highlight its attention row.</p>
      )}

      <figcaption className={styles.caption}>
        Illustrative attention weights — not from a real model. Each row shows how one query token distributes attention across earlier (visible) key tokens. Upper-right triangle is empty because of the <strong>causal mask</strong>: a token cannot attend to tokens that come after it.
      </figcaption>
    </figure>
  );
}
