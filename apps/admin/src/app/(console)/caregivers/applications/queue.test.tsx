import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import { QUEUE_ROW, queue } from "@/test/identity-fixtures";

import { ApplicationsQueue } from "./queue";

// A URL the component can read and replace, so the filter chips drive real re-renders.
const url = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    search: "",
    listeners,
    set(next: string) {
      url.search = next;
      listeners.forEach((l) => l());
    },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/caregivers/applications",
  useRouter: () => ({ replace: (to: string) => url.set(to.split("?")[1] ?? "") }),
  useSearchParams: () =>
    new URLSearchParams(
      React.useSyncExternalStore(
        (cb) => {
          url.listeners.add(cb);
          return () => url.listeners.delete(cb);
        },
        () => url.search,
        () => url.search,
      ),
    ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LIST = "GET /api/v1/admin/caregivers";
const READER = ["caregivers.read"];
const COUNTS = { needs_review_count: 4, stuck_count: 1 };

const chip = (name: RegExp | string) => screen.getByRole("button", { name });

beforeEach(() => url.set(""));

describe("ApplicationsQueue: identity filter", () => {
  it("asks for the under_review tab with no identity filter, and badges the chips from the response counts", async () => {
    const calls = stubFetch({ [LIST]: () => jsonResponse(queue([QUEUE_ROW], COUNTS)) });
    render(withAuth(READER, <ApplicationsQueue />));
    expect(await screen.findByRole("link", { name: "Placeholder Bola Adeyemi" })).toBeInTheDocument();
    expect(calls[0]?.search).toContain("profile_status=under_review");
    expect(calls[0]?.search).not.toContain("identity=");
    expect(chip(/^Identity needs review/)).toHaveTextContent("4");
    expect(chip(/^Identity stuck/)).toHaveTextContent("1");
    expect(chip("Everyone")).toHaveAttribute("aria-pressed", "true");
    // the failed bucket has no badge: the API sends no count for it
    expect(chip(/^Identity failed/)).toHaveTextContent(/^Identity failed$/);
  });

  it("filters by identity bucket, back on the first page, and keeps the badges (they ignore the filter)", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [LIST]: (req) => {
        const identity = new URL(req.url).searchParams.get("identity");
        return jsonResponse(queue(identity === "stuck" ? [] : [QUEUE_ROW], COUNTS));
      },
    });
    render(withAuth(READER, <ApplicationsQueue />));
    await screen.findByRole("link", { name: "Placeholder Bola Adeyemi" });

    await user.click(chip(/^Identity needs review/));
    await waitFor(() => expect(calls.some((c) => c.search.includes("identity=needs_review") && c.search.includes("offset=0"))).toBe(true));
    expect(chip(/^Identity needs review/)).toHaveAttribute("aria-pressed", "true");
    expect(chip("Everyone")).toHaveAttribute("aria-pressed", "false");
    expect(chip(/^Identity needs review/)).toHaveTextContent("4");
    expect(chip(/^Identity stuck/)).toHaveTextContent("1");

    await user.click(chip(/^Identity stuck/));
    await waitFor(() => expect(calls.some((c) => c.search.includes("identity=stuck"))).toBe(true));
    expect(await screen.findByText(/with "identity stuck"/)).toBeInTheDocument();
    expect(chip(/^Identity needs review/)).toHaveTextContent("4");

    await user.click(chip(/^Identity failed/));
    await waitFor(() => expect(calls.some((c) => c.search.includes("identity=failed"))).toBe(true));

    await user.click(chip("Everyone"));
    await waitFor(() => expect(calls.at(-1)?.search).not.toContain("identity="));
  });

  it("keeps the badge counts on screen while another filter loads", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let n = 0;
    globalThis.fetch = (async () => {
      n += 1;
      if (n > 1) await gate;
      return jsonResponse(queue([QUEUE_ROW], COUNTS));
    }) as typeof fetch;
    render(withAuth(READER, <ApplicationsQueue />));
    await screen.findByRole("link", { name: "Placeholder Bola Adeyemi" });
    await user.click(chip(/^Identity failed/));
    expect(chip(/^Identity needs review/)).toHaveTextContent("4");
    release?.();
  });

  it("reads the filter from the URL, and ignores an unknown value", async () => {
    url.set("identity=failed&status=suspended");
    const calls = stubFetch({ [LIST]: () => jsonResponse(queue([], COUNTS)) });
    render(withAuth(READER, <ApplicationsQueue />));
    expect(await screen.findByText(/No suspended applications with "identity failed"/)).toBeInTheDocument();
    expect(calls[0]?.search).toContain("identity=failed");
    expect(calls[0]?.search).toContain("profile_status=suspended");
    expect(chip(/^Identity failed/)).toHaveAttribute("aria-pressed", "true");
  });

  it("treats an unknown identity value as no filter", async () => {
    url.set("identity=everything");
    const calls = stubFetch({ [LIST]: () => jsonResponse(queue([QUEUE_ROW], COUNTS)) });
    render(withAuth(READER, <ApplicationsQueue />));
    await screen.findByRole("link", { name: "Placeholder Bola Adeyemi" });
    expect(calls[0]?.search).not.toContain("identity=");
    expect(chip("Everyone")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows each row's identity status", async () => {
    stubFetch({ [LIST]: () => jsonResponse(queue([QUEUE_ROW], COUNTS)) });
    render(withAuth(READER, <ApplicationsQueue />));
    const row = await screen.findByRole("row", { name: /Placeholder Bola Adeyemi/ });
    expect(within(row).getByText("Needs review")).toBeInTheDocument();
  });

  it("shows no badge on a chip whose count is zero as a number zero, and still renders", async () => {
    stubFetch({ [LIST]: () => jsonResponse(queue([], { needs_review_count: 0, stuck_count: 0 })) });
    render(withAuth(READER, <ApplicationsQueue />));
    await screen.findByText(/No under review applications/);
    expect(chip(/^Identity needs review/)).toHaveTextContent("0");
    expect(chip(/^Identity stuck/)).toHaveTextContent("0");
  });

  it("surfaces a server refusal of the filter as an error with a retry", async () => {
    stubFetch({ [LIST]: () => jsonResponse({ detail: "Access denied." }, { status: 403 }) });
    render(withAuth(READER, <ApplicationsQueue />));
    expect(await screen.findByRole("button", { name: /retry|try again/i })).toBeInTheDocument();
  });
});
