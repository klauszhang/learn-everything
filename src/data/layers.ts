export interface LayerAnnotation {
  layer: number;
  zone: "early" | "middle" | "late";
  note: string;
}

export const LAYER_ANNOTATIONS: LayerAnnotation[] = [
  {
    layer: 1,
    zone: "early",
    note: "Tends to encode token identity and local n-gram patterns — the model is still close to raw embeddings. \"bank\" in \"river bank\" and \"savings bank\" look nearly identical here.",
  },
  {
    layer: 2,
    zone: "early",
    note: "Surface-level syntax starts to emerge — punctuation roles, word boundaries, basic part-of-speech signals. Attention heads often focus on immediate neighbors.",
  },
  {
    layer: 3,
    zone: "middle",
    note: "Contextual blending deepens. Probing studies find this is where representations of \"bank\" in different contexts start to diverge. Some factual recall circuits begin here.",
  },
  {
    layer: 4,
    zone: "middle",
    note: "Mid-range layers often carry the richest semantic content. Circuits for tasks like indirect object identification and coreference resolution have been traced to layers in this range.",
  },
  {
    layer: 5,
    zone: "late",
    note: "The model is now shaping its representation toward a decision: which token comes next? Less about understanding context, more about narrowing down the answer.",
  },
  {
    layer: 6,
    zone: "late",
    note: "The last layer's output is a d_model vector. A linear projection maps it to vocabulary-size scores (logits) — one number per possible next token. Softmax turns those into probabilities. Ch 6 walks through this step by step.",
  },
];
