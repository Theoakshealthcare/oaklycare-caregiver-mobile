import { QueryClient } from "@tanstack/react-query";

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
