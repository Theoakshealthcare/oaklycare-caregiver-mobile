import { useMutation } from "@tanstack/react-query";

import type { FallguardAnswers, FallguardResult } from "@/src/domain/fallguard";
import { SAMPLE_QUESTIONS, SAMPLE_RECOMMENDATIONS } from "@/src/fixtures/fallguard";

import { useFixtureQuery } from "./fixture";

/** Sample questions until the FallGuard slice reads `GET /fallguard/questions`. */
export function useFallguardQuestions() {
  return useFixtureQuery(["fallguard-questions"], () => SAMPLE_QUESTIONS);
}

/** Submits the answers. Sample: no server, so `totalScore` is only a stand-in (the sum of the chosen positions); the real slice posts to `/fallguard/submit` and shows the server's score. */
export function useSubmitFallguard() {
  return useMutation({
    mutationFn: async (answers: FallguardAnswers): Promise<FallguardResult> => ({
      totalScore: Object.values(answers).reduce((sum, index) => sum + index, 0),
      recommendations: SAMPLE_RECOMMENDATIONS,
    }),
  });
}
