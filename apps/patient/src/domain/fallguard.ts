import type { Schemas } from "@oakly/api-client";

export interface FallguardOption {
  text: string;
  /**
   * What the server's question list says this option is worth. Sent back on submit (the backend sums the scores it is given
   * and does not look them up) and NEVER shown to the patient.
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
  /** The total the server stored (the sum of the scores the app sent). */
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

/** The body of `POST /fallguard/submit`: one `{ question_id, answer, score }` per answered question, in question order. */
export function toSubmitBody(questions: FallguardQuestion[], answers: FallguardAnswers): Schemas["FallGuardAssessmentCreate"] {
  return {
    answers: questions.flatMap((q) => {
      const chosen = answers[q.id];
      const option = chosen === undefined ? undefined : q.options[chosen];
      return option ? [{ question_id: q.id, answer: option.text, score: option.score }] : [];
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
