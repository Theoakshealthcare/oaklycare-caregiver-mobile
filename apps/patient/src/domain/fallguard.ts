import type { Schemas } from "@oakly/api-client";

import { ApiError } from "@/src/api/errors";

export interface FallguardOption {
  text: string;
  /**
   * What the server's question list says this option is worth. Shown beside the option ("Score : 2", owner decision 2026-11-23)
   * exactly as the server sent it, and used for the "out of N" total on the result. Never computed here, and not sent on submit:
   * the server scores from its own stored options.
   */
  score: number;
}

export interface FallguardQuestion {
  id: string;
  prompt: string;
  options: FallguardOption[];
}

/** The answers, keyed by question id, as the index of the chosen option. */
export type FallguardAnswers = Record<string, number>;

export interface FallguardResult {
  /** The total the server computed from its own stored options (never summed on the phone). */
  totalScore: number;
  /** The most the questions could add up to, so "20" reads as "20 of 40". Computed from the question list. */
  maxScore: number;
  /** The AI summary, or null when the server had none or its "Unable to analyze" stand-in. */
  summary: string | null;
  recommendations: string[];
}

type ApiQuestion = Schemas["FallGuardQuestionResponse"];
type ApiAssessment = Schemas["FallGuardAssessmentResponse"];

/** In the server's own order (`order`), which is the order the questions were written to be asked in. */
export function toQuestions(rows: ApiQuestion[]): FallguardQuestion[] {
  return rows
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((row) => ({ id: row.id, prompt: row.question, options: row.options.map((o) => ({ text: o.text, score: o.score })) }));
}

/**
 * The body of `POST /fallguard/submit`: one `{ question_id, answer }` per answered question, in question order. `answer` is
 * the option's text exactly as the server sent it. No `score`: the server looks it up and ignores any the client sends.
 */
export function toSubmitBody(questions: FallguardQuestion[], answers: FallguardAnswers): Schemas["FallGuardAssessmentCreate"] {
  return {
    answers: questions.flatMap((q) => {
      const chosen = answers[q.id];
      const option = chosen === undefined ? undefined : q.options[chosen];
      return option ? [{ question_id: q.id, answer: option.text }] : [];
    }),
  };
}

/** The most the questions could add up to: each one's highest option. */
export function maxScore(questions: FallguardQuestion[]): number {
  return questions.reduce((sum, q) => sum + Math.max(0, ...q.options.map((o) => o.score)), 0);
}

/** The backend writes this when its AI call failed; it is not a summary and is never shown as one. */
const AI_FAILED = /^unable to analy[sz]e/i;

export function toResult(row: ApiAssessment, questions: FallguardQuestion[]): FallguardResult {
  const summary = row.ai_summary?.trim() ?? "";
  return {
    totalScore: row.total_score,
    maxScore: maxScore(questions),
    summary: summary && !AI_FAILED.test(summary) ? summary : null,
    recommendations: (row.ai_recommendations ?? []).map((r) => r.trim()).filter(Boolean),
  };
}

/**
 * What to do about a refused `POST /fallguard/submit` (`422`, `detail = { code, message, question_id? }`, nothing stored). Branches
 * on `detail.code`. `reload`: the questionnaire changed under the person, so the questions are fetched again and the person
 * answers afresh. `message`: show the sentence and stay put. Null for any other error (offline, 5xx, a malformed body): the
 * caller shows `messageForError`.
 */
export type FallguardRefusal = { kind: "reload"; message: string } | { kind: "message"; message: string };

export function fallguardRefusal(error: unknown): FallguardRefusal | null {
  if (!(error instanceof ApiError)) return null;
  switch (error.code) {
    case "fallguard_no_answers":
      return { kind: "message", message: "Please answer at least one question before you submit." };
    case "fallguard_unknown_question":
    case "fallguard_invalid_option":
      return { kind: "reload", message: "The questions have been updated since you started. We've loaded the new ones, so please answer them again." };
    case "fallguard_duplicate_question":
      return { kind: "message", message: "Something went wrong with your answers. Please go back to the first question and try again." };
    default:
      return null;
  }
}

// --- the question screens' section headings ------------------------------------------------------------------------------

export interface FallguardSection {
  title: string;
  /** The grey line under the title (only the first three sections have one in the design). */
  subtitle?: string;
}

/** The seeded questionnaire's size. The headings below are the design's grouping of THESE 24 questions. */
export const SEEDED_QUESTION_COUNT = 24;

const SECTIONS: { upTo: number; section: FallguardSection }[] = [
  { upTo: 4, section: { title: "General Information", subtitle: "Let's start with some basic information about you" } },
  { upTo: 10, section: { title: "Physical Risk Factors", subtitle: "Now, let's assess your physical mobility and stability" } },
  { upTo: 14, section: { title: "Cognitive & Sensory Function", subtitle: "These questions help us understand your cognitive and sensory function" } },
  { upTo: 19, section: { title: "Environmental Risk Factors" } },
  { upTo: 24, section: { title: "Behavioral & Lifestyle Factors" } },
];

/**
 * The heading over question number `position` (1 based). The server's questions carry no section, so the design's grouping
 * (1-4, 5-10, 11-14, 15-19, 20-24) is applied by position, and only while the list is the 24 the design was drawn for: once an
 * admin adds or removes a question the positions no longer mean the same questions, so no heading is shown rather than a wrong one.
 */
export function sectionFor(position: number, total: number): FallguardSection | null {
  if (total !== SEEDED_QUESTION_COUNT) return null;
  return SECTIONS.find((s) => position <= s.upTo)?.section ?? null;
}

// --- result: the risk band (off) ---------------------------------------------------------------------------------------------

export interface RiskBand {
  /** "Moderate Risk". */
  label: string;
  /** The "What does this mean?" sentence for this band. */
  meaning: string;
  /** The colour of the score badge. */
  color: string;
  /** Lowest total score in the band, inclusive. */
  from: number;
}

/**
 * The Low / Moderate / High bands of the result badge ("11 / Moderate Risk"). EMPTY on purpose: the server returns no band and the
 * scoring has not been signed by a clinician (`backend/docs/clinical/clinician-review-pack.md`, section 4: the old bands do not fit
 * a 0 to 40 score and three questions look reversed). The patient sees the server's total, never a label made up on the phone.
 * Fill this in, in ascending `from`, only with bands a clinician has signed.
 */
export const RISK_BANDS: readonly RiskBand[] = [];

/** The band a total falls in, or null while there are none. */
export function riskBandFor(totalScore: number, bands: readonly RiskBand[] = RISK_BANDS): RiskBand | null {
  return bands.reduce<RiskBand | null>((found, band) => (totalScore >= band.from ? band : found), null);
}
