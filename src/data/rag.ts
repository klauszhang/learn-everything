/**
 * src/data/rag.ts
 *
 * Hand-authored illustrative data for the RAG chapter (M-3).
 * All chunk texts, scores, and model answers are ILLUSTRATIVE — not produced
 * by a real model or retrieved from a real index. Labels are explicit.
 *
 * Simulated corpus: "Acme Workflow Platform" internal knowledge base.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Chunk = {
  id: string;
  docTitle: string;
  docDate: string;
  tags: string[];
  text: string;
  /** Same chunk with a short contextual prefix prepended (Contextual Retrieval). */
  contextualText: string;
  /** Illustrative 2-D coordinate for optional scatter visualization. */
  coord2d: [number, number];
};

export type QueryFixture = {
  question: string;
  groundTruthChunkIds: string[];
  /** Illustrative ANN cosine-similarity scores (0–1, higher = more similar). */
  annScores: Record<string, number>;
  /** Illustrative reranker scores — may differ in ranking from ANN. */
  rerankerScores: Record<string, number>;
  /** Hand-authored answer a model gives WITHOUT retrieved context (vague or wrong). */
  noRagAnswer: string;
  /** Hand-authored answer a model gives WITH the ground-truth chunk in context. */
  ragAnswer: string;
  /** True when the ground-truth chunk falls outside the top-K cutoff (§ 8.1). */
  retrievalMisses?: boolean;
};

// ---------------------------------------------------------------------------
// Corpus — 10 short documents, pre-chunked (~18 chunks total)
// ---------------------------------------------------------------------------

export const corpus: Chunk[] = [
  // ---- Pricing Guide -------------------------------------------------------
  {
    id: "chunk-01-a",
    docTitle: "Acme Workflow: Pricing Guide",
    docDate: "2025-11-01",
    tags: ["pricing", "billing", "plans"],
    text:
      "Acme Workflow is available on three plans: Starter ($29/month), Growth " +
      "($99/month), and Enterprise (custom pricing). All plans are billed monthly " +
      "by default. Annual billing is available at a 20 % discount.",
    contextualText:
      "From the Acme Workflow Platform Pricing Guide (updated November 2025), " +
      "covering plan tiers and billing cycles: " +
      "Acme Workflow is available on three plans: Starter ($29/month), Growth " +
      "($99/month), and Enterprise (custom pricing). All plans are billed monthly " +
      "by default. Annual billing is available at a 20 % discount.",
    coord2d: [0.12, 0.78],
  },
  {
    id: "chunk-01-b",
    docTitle: "Acme Workflow: Pricing Guide",
    docDate: "2025-11-01",
    tags: ["pricing", "billing", "recurring"],
    text:
      "Recurring billing runs on the 1st of each month for monthly subscribers. " +
      "Annual subscribers are charged once per year on their signup anniversary. " +
      "Failed payments trigger a 7-day grace period before the account is downgraded.",
    contextualText:
      "From the Acme Workflow Platform Pricing Guide (updated November 2025), " +
      "covering recurring billing schedules and payment failure handling: " +
      "Recurring billing runs on the 1st of each month for monthly subscribers. " +
      "Annual subscribers are charged once per year on their signup anniversary. " +
      "Failed payments trigger a 7-day grace period before the account is downgraded.",
    coord2d: [0.18, 0.74],
  },

  // ---- Refund Policy -------------------------------------------------------
  {
    id: "chunk-02-a",
    docTitle: "Acme Workflow: Refund Policy",
    docDate: "2025-10-15",
    tags: ["refunds", "billing", "cancellation"],
    text:
      "Refund requests must be submitted within 30 days of the charge. " +
      "Approved refunds are processed within 5 business days back to the original " +
      "payment method. Partial refunds are available for unused days on annual plans.",
    contextualText:
      "From the Acme Workflow Platform Refund Policy (updated October 2025), " +
      "covering refund eligibility and processing timelines: " +
      "Refund requests must be submitted within 30 days of the charge. " +
      "Approved refunds are processed within 5 business days back to the original " +
      "payment method. Partial refunds are available for unused days on annual plans.",
    coord2d: [0.22, 0.65],
  },

  // ---- SLA (Enterprise) — uses "uptime guarantee", not "SLA" ---------------
  {
    id: "chunk-03-a",
    docTitle: "Acme Workflow: Enterprise Agreement",
    docDate: "2025-09-01",
    tags: ["enterprise", "uptime", "reliability"],
    text:
      "The Acme Workflow Enterprise tier includes a 99.9 % uptime guarantee " +
      "measured monthly, excluding scheduled maintenance windows. Credits are " +
      "issued automatically when uptime falls below the guarantee threshold.",
    contextualText:
      "From the Acme Workflow Enterprise Agreement (effective September 2025), " +
      "covering the uptime guarantee and credit mechanism for Enterprise customers: " +
      "The Acme Workflow Enterprise tier includes a 99.9 % uptime guarantee " +
      "measured monthly, excluding scheduled maintenance windows. Credits are " +
      "issued automatically when uptime falls below the guarantee threshold.",
    coord2d: [0.55, 0.42],
  },

  // ---- Onboarding ----------------------------------------------------------
  {
    id: "chunk-04-a",
    docTitle: "Acme Workflow: Onboarding Guide",
    docDate: "2025-12-01",
    tags: ["onboarding", "setup", "getting-started"],
    text:
      "After signup, new users receive an onboarding email with a verification " +
      "link valid for 48 hours. Completing the onboarding checklist unlocks " +
      "advanced features including team workspaces and API access.",
    contextualText:
      "From the Acme Workflow Onboarding Guide (December 2025), covering " +
      "the new-user setup flow: " +
      "After signup, new users receive an onboarding email with a verification " +
      "link valid for 48 hours. Completing the onboarding checklist unlocks " +
      "advanced features including team workspaces and API access.",
    coord2d: [0.72, 0.81],
  },

  // ---- Features ------------------------------------------------------------
  {
    id: "chunk-05-a",
    docTitle: "Acme Workflow: Feature Overview",
    docDate: "2025-11-20",
    tags: ["features", "automation", "integrations"],
    text:
      "Acme Workflow supports automated task routing, conditional branching, " +
      "and approval chains. Native integrations are available for Slack, Jira, " +
      "GitHub, and Salesforce. Custom webhooks are available on Growth and above.",
    contextualText:
      "From the Acme Workflow Feature Overview (November 2025), covering " +
      "core automation capabilities and integrations: " +
      "Acme Workflow supports automated task routing, conditional branching, " +
      "and approval chains. Native integrations are available for Slack, Jira, " +
      "GitHub, and Salesforce. Custom webhooks are available on Growth and above.",
    coord2d: [0.85, 0.55],
  },

  // ---- API Rate Limits -----------------------------------------------------
  {
    id: "chunk-06-a",
    docTitle: "Acme Workflow: API Rate Limits",
    docDate: "2025-10-01",
    tags: ["api", "rate-limits", "developers"],
    text:
      "API rate limits are applied per API key. The Starter plan allows 100 " +
      "requests per minute. Growth allows 1,000 requests per minute. Enterprise " +
      "customers receive custom limits negotiated at contract time.",
    contextualText:
      "From the Acme Workflow API Rate Limits documentation (October 2025), " +
      "covering per-plan API throughput limits: " +
      "API rate limits are applied per API key. The Starter plan allows 100 " +
      "requests per minute. Growth allows 1,000 requests per minute. Enterprise " +
      "customers receive custom limits negotiated at contract time.",
    coord2d: [0.61, 0.29],
  },

  // ---- Support Tiers -------------------------------------------------------
  {
    id: "chunk-07-a",
    docTitle: "Acme Workflow: Support Tiers",
    docDate: "2025-11-15",
    tags: ["support", "plans", "response-time"],
    text:
      "Starter plan users have access to community forums and email support " +
      "with a 2-business-day response target. Growth plan users receive priority " +
      "email support with a 4-hour response target during business hours. " +
      "Enterprise customers are assigned a dedicated customer success manager.",
    contextualText:
      "From the Acme Workflow Support Tiers documentation (November 2025), " +
      "covering response times and channels by plan: " +
      "Starter plan users have access to community forums and email support " +
      "with a 2-business-day response target. Growth plan users receive priority " +
      "email support with a 4-hour response target during business hours. " +
      "Enterprise customers are assigned a dedicated customer success manager.",
    coord2d: [0.38, 0.57],
  },

  // ---- Security Compliance -------------------------------------------------
  {
    id: "chunk-08-a",
    docTitle: "Acme Workflow: Security & Compliance",
    docDate: "2025-08-01",
    tags: ["security", "compliance", "soc2", "gdpr"],
    text:
      "Acme Workflow maintains SOC 2 Type II certification (most recent audit: " +
      "July 2025). All data is encrypted in transit (TLS 1.3) and at rest " +
      "(AES-256). GDPR data processing agreements are available on request.",
    contextualText:
      "From the Acme Workflow Security & Compliance documentation (August 2025), " +
      "covering certification, encryption, and regulatory compliance: " +
      "Acme Workflow maintains SOC 2 Type II certification (most recent audit: " +
      "July 2025). All data is encrypted in transit (TLS 1.3) and at rest " +
      "(AES-256). GDPR data processing agreements are available on request.",
    coord2d: [0.44, 0.18],
  },

  // ---- Data Retention ------------------------------------------------------
  {
    id: "chunk-09-a",
    docTitle: "Acme Workflow: Data Retention Policy",
    docDate: "2025-07-01",
    tags: ["data", "retention", "deletion", "compliance"],
    text:
      "Workflow run logs are retained for 90 days on Starter, 1 year on Growth, " +
      "and configurable (1–7 years) on Enterprise. Deleted accounts have their " +
      "data permanently purged within 30 days of deletion confirmation.",
    contextualText:
      "From the Acme Workflow Data Retention Policy (July 2025), covering " +
      "log retention periods by plan and post-deletion purge timelines: " +
      "Workflow run logs are retained for 90 days on Starter, 1 year on Growth, " +
      "and configurable (1–7 years) on Enterprise. Deleted accounts have their " +
      "data permanently purged within 30 days of deletion confirmation.",
    coord2d: [0.29, 0.33],
  },

  // ---- Annual Plan Renewal -------------------------------------------------
  {
    id: "chunk-10-a",
    docTitle: "Acme Workflow: Annual Plan FAQ",
    docDate: "2025-11-01",
    tags: ["billing", "annual", "renewal"],
    text:
      "Annual plans renew automatically on the subscription anniversary date. " +
      "Renewal invoices are sent 30 days before the renewal date. Customers " +
      "who wish to cancel must do so at least 14 days before renewal to avoid " +
      "being charged for the next year.",
    contextualText:
      "From the Acme Workflow Annual Plan FAQ (November 2025), covering " +
      "auto-renewal timing and cancellation deadlines for annual subscribers: " +
      "Annual plans renew automatically on the subscription anniversary date. " +
      "Renewal invoices are sent 30 days before the renewal date. Customers " +
      "who wish to cancel must do so at least 14 days before renewal to avoid " +
      "being charged for the next year.",
    coord2d: [0.14, 0.68],
  },
];

// ---------------------------------------------------------------------------
// Query fixtures — ILLUSTRATIVE hand-authored data
// ---------------------------------------------------------------------------

export const queries: QueryFixture[] = [
  // ---- Fixture 1: Clean hit ------------------------------------------------
  {
    question: "How does Acme Workflow handle recurring billing?",
    groundTruthChunkIds: ["chunk-01-b"],
    annScores: {
      "chunk-01-b": 0.91,
      "chunk-01-a": 0.82,
      "chunk-10-a": 0.71,
      "chunk-02-a": 0.64,
      "chunk-07-a": 0.48,
    },
    rerankerScores: {
      "chunk-01-b": 0.94,
      "chunk-01-a": 0.79,
      "chunk-10-a": 0.68,
      "chunk-02-a": 0.55,
      "chunk-07-a": 0.31,
    },
    noRagAnswer:
      "Most SaaS platforms bill monthly or annually. Recurring charges " +
      "typically appear on a fixed date each billing period. If a payment fails, " +
      "the platform usually retries after a few days. You should check your " +
      "account settings for the exact billing date and cycle.",
    ragAnswer:
      "Recurring billing for monthly subscribers runs on the 1st of each " +
      "month. Annual subscribers are charged once per year on their signup " +
      "anniversary. If a payment fails, Acme Workflow provides a 7-day grace " +
      "period before downgrading the account. (Source: Pricing Guide, Nov 2025)",
  },

  // ---- Fixture 2: Retrieval miss (vocabulary mismatch: "SLA" vs "uptime guarantee") --
  {
    question: "What is the SLA for enterprise customers?",
    groundTruthChunkIds: ["chunk-03-a"],
    annScores: {
      "chunk-07-a": 0.74,
      "chunk-01-a": 0.61,
      "chunk-05-a": 0.57,
      "chunk-08-a": 0.53,
      "chunk-06-a": 0.49,
      // chunk-03-a scores below the top-K cutoff (illustrative ANN miss)
      "chunk-03-a": 0.41,
    },
    rerankerScores: {
      "chunk-03-a": 0.89,
      "chunk-07-a": 0.52,
      "chunk-08-a": 0.44,
      "chunk-01-a": 0.38,
      "chunk-05-a": 0.29,
    },
    noRagAnswer:
      "Enterprise SLAs typically guarantee 99.9 % uptime, though the exact " +
      "percentage varies by vendor. Most enterprise agreements include provisions " +
      "for service credits if uptime targets are missed. I'd recommend checking " +
      "your contract for the specific terms.",
    ragAnswer:
      "The Acme Workflow Enterprise tier guarantees 99.9 % uptime, measured " +
      "monthly and excluding scheduled maintenance windows. Service credits are " +
      "issued automatically when uptime falls below that threshold. " +
      "(Source: Enterprise Agreement, Sep 2025)",
    retrievalMisses: true,
  },

  // ---- Fixture 3: Reranking changes the top result -------------------------
  {
    question: "When does the annual plan renew?",
    groundTruthChunkIds: ["chunk-10-a"],
    annScores: {
      "chunk-01-b": 0.78, // ANN top — billing FAQ is tangentially relevant
      "chunk-02-a": 0.73,
      "chunk-10-a": 0.68, // ground truth at rank 3
      "chunk-01-a": 0.62,
      "chunk-07-a": 0.44,
    },
    rerankerScores: {
      "chunk-10-a": 0.93, // reranker promotes the specific renewal chunk to rank 1
      "chunk-01-b": 0.61,
      "chunk-02-a": 0.54,
      "chunk-01-a": 0.41,
      "chunk-07-a": 0.22,
    },
    noRagAnswer:
      "Annual subscriptions typically renew 12 months after sign-up. Most " +
      "platforms send a reminder email a few weeks in advance. You can usually " +
      "cancel before the renewal date to avoid being charged.",
    ragAnswer:
      "Annual plans renew automatically on your subscription anniversary date. " +
      "Acme Workflow sends a renewal invoice 30 days in advance and requires " +
      "cancellation at least 14 days before the renewal date to avoid being " +
      "charged for the next year. (Source: Annual Plan FAQ, Nov 2025)",
  },
];

// ---------------------------------------------------------------------------
// Convenience default export
// ---------------------------------------------------------------------------

const ragData = { corpus, queries };
export default ragData;
