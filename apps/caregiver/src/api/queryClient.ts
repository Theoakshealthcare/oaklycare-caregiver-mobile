import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";

import { ApiError } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Do not hammer the server on auth/permission/validation failures; retry only transient ones.
      retry: (failureCount, error) =>
        failureCount < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
  },
});

// React Native has no window focus: treat "app came to the foreground" as focus, so home and the
// offer lists refetch when the caregiver returns to the app (backend guide, section 13).
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => subscription.remove();
});
