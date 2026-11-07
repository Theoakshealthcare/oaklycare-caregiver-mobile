import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export const fallguardService = {
  /** `GET /fallguard/questions`: the active questions with their options and scores (a patient account only: 403 otherwise). */
  questions() {
    return unwrap(api.GET("/api/v1/fallguard/questions"));
  },

  /**
   * `POST /fallguard/submit` with `{ question_id, answer: option text }` per answer. The SERVER looks each score up from its
   * stored options and computes the total (a `score` sent by the client is ignored). A refused submission is `422`
   * `detail = { code, message, question_id? }` and stores nothing: see `fallguardRefusal`. The AI summary is written before
   * the answer returns, so this can take a few seconds.
   */
  submit(body: Schemas["FallGuardAssessmentCreate"]) {
    return unwrap(api.POST("/api/v1/fallguard/submit", { body }));
  },
};
