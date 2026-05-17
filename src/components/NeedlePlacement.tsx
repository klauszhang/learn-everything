import { useState } from 'react';
import { needleRecall } from '../data/long-context';

/** Return a color class label based on recall value */
function recallCategory(recall: number): 'safe' | 'caution' | 'risk' {
  if (recall >= 75) return 'safe';
  if (recall >= 65) return 'caution';
  return 'risk';
}

export default function NeedlePlacement() {
  const [step, setStep] = useState(0); // 0-based index into needleRecall (20 points)

  const point = needleRecall[step];
  const pct = Math.round(point.position * 100);
  const category = recallCategory(point.recall);

  const colorMap: Record<string, string> = {
    safe:    '#2563eb', // blue
    caution: '#d97706', // amber
    risk:    '#dc2626', // red
  };
  const labelMap: Record<string, string> = {
    safe:    'Higher recall zone',
    caution: 'Caution zone',
    risk:    'Risk zone — middle of context',
  };

  return (
    <div className="needle-demo">
      <style>{`
        .needle-demo {
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: var(--space-6);
          max-width: 520px;
          background: var(--color-surface);
          margin: var(--space-6) 0;
        }
        .needle-demo h3 {
          margin: 0 0 var(--space-2);
          font-size: 1rem;
          color: var(--color-text);
        }
        .needle-demo .nd-instruction {
          font-size: 0.85rem;
          color: var(--color-muted);
          margin-bottom: var(--space-4);
        }
        .needle-demo .nd-slider-row {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }
        .needle-demo .nd-slider {
          flex: 1;
          accent-color: var(--color-accent);
          cursor: pointer;
        }
        .needle-demo .nd-pos-label {
          font-size: 0.8rem;
          color: var(--color-muted);
          font-family: var(--font-mono);
          white-space: nowrap;
          min-width: 2.5rem;
          text-align: right;
        }
        .needle-demo .nd-doc {
          display: flex;
          height: 14px;
          border-radius: 4px;
          overflow: hidden;
          background: #e5e7eb;
          margin-bottom: var(--space-3);
          position: relative;
        }
        .needle-demo .nd-doc-needle {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 4px;
          border-radius: 2px;
          background: #111;
          transform: translateX(-50%);
          transition: left 0.15s ease;
        }
        .needle-demo .nd-readout {
          display: flex;
          align-items: baseline;
          gap: var(--space-3);
          margin-top: var(--space-2);
        }
        .needle-demo .nd-recall-val {
          font-size: 2rem;
          font-weight: 700;
          font-family: var(--font-mono);
          line-height: 1;
          transition: color 0.15s ease;
        }
        .needle-demo .nd-recall-label {
          font-size: 0.85rem;
          font-weight: 600;
          transition: color 0.15s ease;
        }
        .needle-demo .nd-zone {
          font-size: 0.8rem;
          color: var(--color-muted);
          margin-top: var(--space-1);
        }
        .needle-demo .nd-disclaimer {
          font-size: 0.75rem;
          color: var(--color-muted);
          margin-top: var(--space-4);
          line-height: 1.5;
          border-top: 1px solid var(--color-border);
          padding-top: var(--space-3);
        }
        .needle-demo .nd-axis {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: var(--color-muted);
          margin-top: 2px;
        }
      `}</style>

      <h3>Place the needle</h3>
      <p className="nd-instruction">
        Drag the slider to choose where an important fact sits inside a 50-section document.
        Watch how position affects illustrative recall probability.
      </p>

      {/* Slider */}
      <div className="nd-slider-row">
        <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>Start</span>
        <input
          type="range"
          className="nd-slider"
          min={0}
          max={needleRecall.length - 1}
          value={step}
          onChange={e => setStep(Number(e.target.value))}
          aria-label="Needle position in document"
        />
        <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>End</span>
        <span className="nd-pos-label">{pct}%</span>
      </div>

      {/* Document bar */}
      <div className="nd-doc" role="img" aria-label={`Needle at ${pct}% into document`}>
        <div
          className="nd-doc-needle"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="nd-axis">
        <span>0% (start)</span>
        <span>50% (middle)</span>
        <span>100% (end)</span>
      </div>

      {/* Recall readout */}
      <div className="nd-readout" style={{ marginTop: 'var(--space-4)' }}>
        <span
          className="nd-recall-val"
          style={{ color: colorMap[category] }}
        >
          {point.recall}%
        </span>
        <span
          className="nd-recall-label"
          style={{ color: colorMap[category] }}
        >
          illustrative recall
        </span>
      </div>
      <div className="nd-zone" style={{ color: colorMap[category] }}>
        {labelMap[category]}
      </div>

      <p className="nd-disclaimer">
        Illustrative recall probability based on the research direction in Liu et al. (2023) and subsequent work —
        not a live model measurement. In practice, recall varies by model, task type, and context content.
        Place load-bearing content near the start or end of your context for best results.
      </p>
    </div>
  );
}
