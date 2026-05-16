// layers.ts — illustrative per-layer hover annotations for Ch 4 (04-layers.mdx).
// This data is hand-authored for pedagogical purposes and does NOT represent
// real model internals. Layer specialization is an active research area and
// the findings are not as tidy as popular descriptions suggest.
//
// CRITICAL: Avoid the contested "low=syntax / mid=semantic / high=task" taxonomy.
// All notes are hedged — framing what "some studies" or "layers like this" tend
// to show, not confident per-layer role claims.

export interface LayerAnnotation {
  layer: number;   // 1-indexed display label
  note: string;    // one-sentence hedged annotation
}

// Six illustrative layers. In a real large model there are many more (e.g. 32–96).
export const LAYER_ANNOTATIONS: LayerAnnotation[] = [
  {
    layer: 1,
    note: "Early layers tend to produce representations that are strongly influenced by individual token identity — though even here, context already matters.",
  },
  {
    layer: 2,
    note: "Some studies find that relatively shallow layers are sensitive to surface-level patterns like punctuation and common word endings, but findings vary across model families.",
  },
  {
    layer: 3,
    note: "Mid-range layers often show richer contextual blending — tokens start to 'know about' their neighbors — though what exactly is encoded is still an open research question.",
  },
  {
    layer: 4,
    note: "Research on probing classifiers suggests some mid-to-upper layers carry information useful for tasks like part-of-speech, but results depend heavily on the model and the probe design.",
  },
  {
    layer: 5,
    note: "Layers like this often show activation patterns that differ across semantic categories in some studies, but the mapping is noisy and not reliably reproducible across architectures.",
  },
  {
    layer: 6,
    note: "Final layers tend to produce representations most useful for predicting the next token — but the 'higher = more task-specific' story is an oversimplification, not a clean rule.",
  },
];
