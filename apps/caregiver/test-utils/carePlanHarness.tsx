import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react-native";
import React from "react";

const clients: QueryClient[] = [];

// The care plan hooks keep a 2-minute `gcTime` (health data leaves memory quickly), and every cached query and
// mutation holds a timer for that long. Clearing the clients after each test cancels them, so a single-worker run
// (CI) ends when the tests do instead of two minutes later.
afterEach(async () => {
  // Unmount first: a screen still mounted would start a new fetch (and a new timer) as soon as its query is dropped.
  await cleanup();
  for (const client of clients.splice(0)) {
    // `clear()` drops the entries but leaves their gc timers armed; destroying each entry cancels the timer.
    for (const query of client.getQueryCache().getAll()) {
      // A call still in flight would re-arm the timer when it ends, so stop it first.
      void query.cancel({ silent: true });
      query.destroy();
    }
    for (const mutation of client.getMutationCache().getAll()) mutation.destroy();
    client.clear();
  }
});

/** Renders a screen inside a fresh query client (no retries, so a failed call shows its error at once). */
export async function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const view = await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client, ...view };
}

/** Props a stack screen receives; only `route` is read by the care plan screens. */
export const routeProps = <T,>(params: unknown) => ({ route: { params }, navigation: {} }) as unknown as T;
