import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const status = typeof error === "object" && error !== null && "status" in error
            ? Number((error as { status?: unknown }).status)
            : 0;

          if (status === 401 || status === 403 || status === 404) {
            return false;
          }

          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 30000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
