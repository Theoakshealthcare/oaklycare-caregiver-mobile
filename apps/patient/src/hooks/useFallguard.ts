import { useMutation, useQuery } from "@tanstack/react-query";

import { useSession } from "@/src/auth";
import { toQuestions, toResult, toSubmitBody, type FallguardAnswers, type FallguardQuestion, type FallguardResult } from "@/src/domain/fallguard";
import { fallguardService } from "@/src/services/fallguard.service";

/** The real question list. Kept for ten minutes and not refetched on focus, so the list cannot change under a half-done assessment. */
export function useFallguardQuestions() {
  const signedIn = useSession((s) => s.status === "signedIn");
  return useQuery({
    queryKey: ["fallguard", "questions"],
    enabled: signedIn,
    queryFn: fallguardService.questions,
    select: toQuestions,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Sends the answers (with the option scores from the question list, which the server sums) and returns the server's result. */
export function useSubmitFallguard() {
  return useMutation({
    mutationFn: async ({ questions, answers }: { questions: FallguardQuestion[]; answers: FallguardAnswers }): Promise<FallguardResult> => {
      const row = await fallguardService.submit(toSubmitBody(questions, answers));
      return toResult(row, questions);
    },
  });
}
