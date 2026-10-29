import { QueryClient, QueryClientProvider, type Mutation, type Query } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react-native";
import React from "react";

const clients: QueryClient[] = [];
// Every query and mutation a client ever held, including ones the screen later removed from the cache
// (`removeQueries` on lost access): a removed entry can no longer be found through the cache, but a call still
// settling re-arms its gc timer, and that timer keeps a single-worker run alive.
const entries = new Set<Query | Mutation>();

// The care plan hooks keep a 2-minute `gcTime` (health data leaves memory quickly), and every cached query and
// mutation holds a timer for that long. Clearing the clients after each test cancels them, so a single-worker run
// (CI) ends when the tests do instead of two minutes later.
afterEach(async () => {
  // Unmount first: a screen still mounted would start a new fetch (and a new timer) as soon as its query is dropped.
  await cleanup();
  for (const client of clients.splice(0)) {
    // `clear()` drops the entries but leaves their gc timers armed; destroying each entry cancels the timer.
    for (const query of client.getQueryCache().getAll()) entries.add(query);
    for (const mutation of client.getMutationCache().getAll()) entries.add(mutation);
  }
  for (const entry of entries) {
    // A call still in flight would re-arm the timer when it ends, so stop it first.
    if ("cancel" in entry) void entry.cancel({ silent: true });
    entry.destroy();
  }
  entries.clear();
});

/** Renders a screen inside a fresh query client (no retries, so a failed call shows its error at once). */
export async function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  client.getQueryCache().subscribe((event) => {
    if (event.type === "added") entries.add(event.query);
  });
  client.getMutationCache().subscribe((event) => {
    if (event.type === "added") entries.add(event.mutation);
  });
  const view = await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client, ...view };
}

/** Props a stack screen receives; only `route` is read by the care plan screens. */
export const routeProps = <T,>(params: unknown) => ({ route: { params }, navigation: {} }) as unknown as T;
