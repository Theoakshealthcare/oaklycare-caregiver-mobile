import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";

import { DocumentationList } from "./documentation-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LIST = "GET /api/v1/admin/visit-documentation";
const BOOKING = "9f000000-0000-4000-8000-000000000002";
const CAREGIVER = "9f000000-0000-4000-8000-000000000003";

const entry = (over: Record<string, unknown> = {}) => ({
  id: "9f000000-0000-4000-8000-000000000001",
  booking_id: BOOKING,
  plan_id: null,
  body: "Placeholder entry: client ate well and walked in the garden.",
  created_at: "2026-11-25T10:00:00",
  caregiver: { id: CAREGIVER, name: "Placeholder Caregiver" },
  ...over,
});

describe("DocumentationList", () => {
  it("lists entries with the caregiver, the time in WAT, the text and a link to the visit", async () => {
    stubFetch({ [LIST]: () => jsonResponse({ items: [entry()], total: 1, limit: 20, offset: 0 }) });
    render(withAuth(["careplans.read"], <DocumentationList />));
    const row = await screen.findByRole("listitem", { name: "Entry by Placeholder Caregiver" });
    expect(row).toHaveTextContent("25 Nov 2026, 11:00 WAT");
    expect(row).toHaveTextContent("Placeholder entry: client ate well and walked in the garden.");
    expect(within(row).getByRole("link", { name: "Open the visit" })).toHaveAttribute("href", `/bookings/${BOOKING}`);
  });

  it("says so when nothing was written yet, and when a filter matches nothing", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: () => jsonResponse({ items: [], total: 0, limit: 20, offset: 0 }) });
    render(withAuth(["careplans.read"], <DocumentationList />));
    expect(await screen.findByText("No documentation yet.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Visit (booking id)"), BOOKING);
    expect(await screen.findByText("Nothing matches that filter.")).toBeInTheDocument();
    await waitFor(() => expect(calls.at(-1)?.search).toBe(`?booking_id=${BOOKING}&limit=20&offset=0`));
  });

  it("ignores a filter that is not an id instead of sending a request that would be a 422", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: () => jsonResponse({ items: [entry()], total: 1, limit: 20, offset: 0 }) });
    render(withAuth(["careplans.read"], <DocumentationList />));
    await screen.findByRole("listitem");
    await user.type(screen.getByLabelText("Caregiver id"), "not-an-id");
    expect(calls.every((c) => c.search === "?limit=20&offset=0")).toBe(true);
  });

  it("shows an erased entry as erased and an API failure with a retry", async () => {
    stubFetch({ [LIST]: () => jsonResponse({ items: [entry({ body: "" })], total: 1, limit: 20, offset: 0 }) });
    const { unmount } = render(withAuth(["careplans.read"], <DocumentationList />));
    expect(await screen.findByText("Erased.")).toBeInTheDocument();
    unmount();
    stubFetch({ [LIST]: () => jsonResponse({ detail: "boom" }, { status: 500 }) });
    render(withAuth(["careplans.read"], <DocumentationList />));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
