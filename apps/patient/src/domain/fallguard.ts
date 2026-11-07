import type { Schemas } from "@oakly/api-client";

import { ApiError } from "@/src/api/errors";

export interface FallguardOption {
  text: string;
  /**
   * What the server's question list says this option is worth. Used only for the "out of N" denominator on the result and
   * NEVER shown to the patient. It is not sent on submit: the server scores from its own stored options.
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
