import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export const fallguardService = {
  /** `GET /fallguard/questions`: the active questions with their options and scores (a patient account only: 403 otherwise). */
  questions() {
    return unwrap(api.GET("/api/v1/fallguard/questions"));
  },

  /**
   * `POST /fallguard/submit`. The server stores and sums the `score` of each answer AS SENT; it does not check them against
   * the question's options (a captured score of 99 was kept), and answers for an unknown question id are a 500. The AI summary
   * is written before the answer returns, so this can take a few seconds.
   */
  submit(body: Schemas["FallGuardAssessmentCreate"]) {
    return unwrap(api.POST("/api/v1/fallguard/submit", { body }));
  },
};
