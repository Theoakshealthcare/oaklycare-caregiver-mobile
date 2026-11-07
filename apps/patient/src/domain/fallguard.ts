export interface FallguardOption {
  text: string;
}

export interface FallguardQuestion {
  id: string;
  prompt: string;
  options: FallguardOption[];
}

/** The answers, keyed by question id, as the index of the chosen option. */
export type FallguardAnswers = Record<string, number>;

export interface FallguardResult {
  /** Computed by the server (the app never sends or shows a per-option score). */
  totalScore: number;
  recommendations: { title: string; text: string }[];
}
