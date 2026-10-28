import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import React from "react";

/** Renders a screen inside a fresh query client (no retries, so a failed call shows its error at once). */
export async function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client, ...view };
}

/** Props a stack screen receives; only `route` is read by the care plan screens. */
export const routeProps = <T,>(params: unknown) => ({ route: { params }, navigation: {} }) as unknown as T;
