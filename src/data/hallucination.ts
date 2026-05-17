/**
 * Hand-authored data for the Hallucination & calibration chapter.
 * All examples are illustrative — not from a real model.
 * Ground-truth notes include real-world references; illustrative answers
 * are fabricated to demonstrate confabulation patterns.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FactualExample {
  id: string;
  question: string;
  groundTruth: string;       // correct answer with source note
  hallucination: string;     // plausible wrong answer — illustrative
  hallucinationType: "factual" | "faithfulness";
  riskFactor: string;
  illustrativeConfidence: number; // what the model might verbally express
}

export interface FaithfulnessExample {
  id: string;
  sourceText: string;
  query: string;
  modelAnswer: string;       // unfaithful answer
  faithfulAnswer: string;    // what a faithful answer would say
  mismatchDescription: string;
}

export interface ConsistencySet {
  topic: string;
  phrasings: string[];
  responses: string[];
  inconsistentDetail: string;
  consistentFact: string;
}

export interface CalibrationBucket {
  statedConfidenceMin: number;
  statedConfidenceMax: number;
  label: string;
  actualAccuracy: number; // illustrative — not real model output
}

// ---------------------------------------------------------------------------
// Factual hallucination examples
// ---------------------------------------------------------------------------

export const FACTUAL_EXAMPLES: FactualExample[] = [
  {
    id: "biographical-date",
    question: "In what year was Ada Lovelace born?",
    groundTruth:
      "1815. (Source: Oxford Dictionary of National Biography; Lovelace's birth records.)",
    hallucination:
      "Ada Lovelace was born in 1820 in London, the daughter of poet Lord Byron.",
    hallucinationType: "factual",
    riskFactor: "biographical date — training data may conflate similar figures",
    illustrativeConfidence: 0.88,
  },
  {
    id: "statistic",
    question:
      "What percentage of global freshwater is stored in glaciers and ice caps, according to the USGS?",
    groundTruth:
      "About 69% (68.7%). (Source: USGS Water Science School, 'Where is Earth's Water?')",
    hallucination:
      "According to the USGS, approximately 87% of Earth's freshwater is stored in glaciers and polar ice, with the remainder split between groundwater and surface water.",
    hallucinationType: "factual",
    riskFactor: "numerical statistic — models generate plausible-sounding percentages",
    illustrativeConfidence: 0.82,
  },
  {
    id: "temporal-boundary",
    question:
      "Which model did Anthropic announce at its developer day in October 2025?",
    groundTruth:
      "This is a temporal-boundary question. The correct answer depends on events after typical training cutoffs — the model cannot reliably recall or infer it.",
    hallucination:
      "At Anthropic's October 2025 developer day, the company announced Claude 3.7 Sonnet, featuring a 1 million token context window and a new 'reasoning mode' toggle.",
    hallucinationType: "factual",
    riskFactor:
      "training cutoff — plausible details fabricated from known product patterns",
    illustrativeConfidence: 0.75,
  },
  {
    id: "api-version",
    question:
      "What is the maximum number of cache breakpoints allowed per request in Anthropic's Messages API?",
    groundTruth:
      "4 breakpoints per request. (Source: Anthropic prompt caching documentation, current as of 2026-05-17.)",
    hallucination:
      "Anthropic's Messages API supports up to 8 cache breakpoints per request, which can be placed at any position in the system prompt, user turn, or tool definitions.",
    hallucinationType: "factual",
    riskFactor:
      "product specification detail — specific numbers drift as APIs evolve",
    illustrativeConfidence: 0.79,
  },
  {
    id: "consistency-base",
    question: "When was the Voyager 1 spacecraft launched?",
    groundTruth:
      "September 5, 1977. (Source: NASA Jet Propulsion Laboratory, Voyager mission pages.)",
    hallucination:
      "Voyager 1 was launched on August 20, 1977, just over two weeks after its twin Voyager 2.",
    hallucinationType: "factual",
    riskFactor:
      "date near sibling event — Voyager 2 launched August 20; details swap between the two",
    illustrativeConfidence: 0.85,
  },
];

// ---------------------------------------------------------------------------
// Faithfulness hallucination examples
// ---------------------------------------------------------------------------

export const FAITHFULNESS_EXAMPLES: FaithfulnessExample[] = [
  {
    id: "faithfulness-hedge-stretch",
    sourceText:
      "In a controlled trial with 42 participants, participants who used the new study technique scored an average of 8% higher on retention tests compared to those using standard review. The authors note that the sample size is small and caution against generalizing to broader populations.",
    query: "Does this study prove the new technique improves learning?",
    modelAnswer:
      "Yes — the study demonstrates that the new technique improves learning, with participants scoring 8% higher on retention tests. This provides strong evidence for its effectiveness.",
    faithfulAnswer:
      "The study found an 8% improvement in retention test scores in a 42-person trial, but the authors themselves caution against generalizing due to the small sample size. It suggests potential benefit but does not prove effectiveness at scale.",
    mismatchDescription:
      "Model asserts 'strong evidence' and 'proves'; source explicitly cautions against generalization due to small sample size.",
  },
  {
    id: "faithfulness-synthesis",
    sourceText:
      "Section 4.2: The deployment was completed on March 3rd. Section 7.1: The performance degradation was first observed on March 7th.",
    query:
      "Did the deployment cause the performance degradation?",
    modelAnswer:
      "According to the document, the deployment on March 3rd caused the performance degradation observed on March 7th.",
    faithfulAnswer:
      "The document records the deployment on March 3rd and the performance degradation starting March 7th, but does not state a causal relationship between them.",
    mismatchDescription:
      "Model asserts causality; source only establishes temporal sequence across two separate sections.",
  },
  {
    id: "faithfulness-contradiction",
    sourceText:
      "Our current recommendation is to place stable tool definitions early in the system prompt. This placement maximizes cache hit rates because cache lookups match on exact token-level prefixes from the start of the context.",
    query:
      "Where should I put tool definitions that change frequently?",
    modelAnswer:
      "According to this document, tool definitions should always be placed early in the system prompt for best results.",
    faithfulAnswer:
      "The document recommends placing *stable* tool definitions early to maximize cache hits. It does not address placement for frequently-changing tool definitions — the recommendation is specifically scoped to stable content.",
    mismatchDescription:
      "Model drops the 'stable' qualifier, applying a scoped recommendation universally — the opposite of what a faithful reading requires.",
  },
];

// ---------------------------------------------------------------------------
// Consistency comparison set (for Inconsistency demo)
// ---------------------------------------------------------------------------

export const CONSISTENCY_SET: ConsistencySet = {
  topic: "Voyager 1 launch date",
  phrasings: [
    "When was Voyager 1 launched?",
    "What year did NASA launch the Voyager 1 probe?",
    "I'm trying to figure out the exact date Voyager 1 left Earth — when was it?",
    "Tell me about the Voyager 1 mission and when it began.",
    "Voyager 1 — launch date?",
  ],
  responses: [
    "Voyager 1 was launched on September 5, 1977.",
    "NASA launched Voyager 1 in 1977, several weeks after its twin Voyager 2.",
    "Voyager 1 launched on August 20, 1977 — a date chosen to take advantage of a rare planetary alignment.",
    "The Voyager 1 mission began on September 5, 1977. The spacecraft was designed to fly past Jupiter and Saturn before continuing into interstellar space.",
    "September 5, 1977.",
  ],
  inconsistentDetail:
    "Phrasing 3 gives August 20 (Voyager 2's launch date); phrasings 1, 4, and 5 correctly give September 5.",
  consistentFact: "All responses agree the year was 1977.",
};

// ---------------------------------------------------------------------------
// Calibration data — illustrative overconfidence curve
// Shape guidance from dossier §9 (diagram option A):
//   - 90–100% bucket: ~63% accuracy (clear overconfidence at top)
//   - 40–60% bucket: close to stated confidence (better calibrated in uncertain range)
//   - 0–20% bucket: reasonably close (model rarely expresses very low confidence)
// ---------------------------------------------------------------------------

export const CALIBRATION_BUCKETS: CalibrationBucket[] = [
  // illustrative — not real model output
  { statedConfidenceMin: 0.0, statedConfidenceMax: 0.1, label: "0–10%",   actualAccuracy: 0.08 },
  { statedConfidenceMin: 0.1, statedConfidenceMax: 0.2, label: "10–20%",  actualAccuracy: 0.17 },
  { statedConfidenceMin: 0.2, statedConfidenceMax: 0.3, label: "20–30%",  actualAccuracy: 0.24 },
  { statedConfidenceMin: 0.3, statedConfidenceMax: 0.4, label: "30–40%",  actualAccuracy: 0.33 },
  { statedConfidenceMin: 0.4, statedConfidenceMax: 0.5, label: "40–50%",  actualAccuracy: 0.42 },
  { statedConfidenceMin: 0.5, statedConfidenceMax: 0.6, label: "50–60%",  actualAccuracy: 0.53 },
  { statedConfidenceMin: 0.6, statedConfidenceMax: 0.7, label: "60–70%",  actualAccuracy: 0.58 },
  { statedConfidenceMin: 0.7, statedConfidenceMax: 0.8, label: "70–80%",  actualAccuracy: 0.62 },
  { statedConfidenceMin: 0.8, statedConfidenceMax: 0.9, label: "80–90%",  actualAccuracy: 0.64 },
  { statedConfidenceMin: 0.9, statedConfidenceMax: 1.0, label: "90–100%", actualAccuracy: 0.63 },
];
