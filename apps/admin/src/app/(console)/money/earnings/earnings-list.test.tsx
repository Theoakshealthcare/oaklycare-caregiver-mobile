import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ADMIN_HOLD, NO_SHOW, PENDING, RELEASED, SHORT_VISIT, VOIDED, makeEarning } from "@/test/earning-fixtures";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";

import { EarningsList } from "./earnings-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LIST = "GET /api/v1/admin/earnings";
const READER = ["payments.read"];
const FINANCE = ["payments.read", "ledger.adjust_request"];
const SUPER = ["payments.read", "ledger.adjust_request", "ledger.adjust"];

const rowOf = (name: RegExp) => screen.findByRole("row", { name });
const post = (id: string, action: string) => `POST /api/v1/admin/earnings/${id}/${action}`;

/** The list handler: answers by the `status` filter the page sends, like the API. */
function byStatus(all = [PENDING, SHORT_VISIT, NO_SHOW, ADMIN_HOLD, RELEASED, VOIDED]) {
  return (req: Request) => {
    const status = new URL(req.url).searchParams.get("status");
    const items = status ? all.filter((e) => e.status === status) : all;
    return jsonResponse({ items, total: items.length });
  };
}

async function openReview(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(within(await rowOf(name)).getByRole("button", { name: /^Review/ }));
  return screen.findByRole("dialog", { name: /₦/ });
}

describe("EarningsList", () => {
  it("opens on Held for review: system and no-show holds with why, booking link, amount and dates; not admin holds", async () => {
    const calls = stubFetch({ [LIST]: byStatus() });
    render(withAuth(READER, <EarningsList />));
    const short = await rowOf(/Placeholder Short/);
    expect(short).toHaveTextContent("₦8,000");
    expect(short).toHaveTextContent("Held");
    expect(short).toHaveTextContent("Short visit");
    expect(short).toHaveTextContent("under 50% of the booked time was spent on site");
    expect(short).toHaveTextContent("Credited 24 Nov 2026, 11:00 WAT");
    expect(within(short).getByRole("link", { name: "BKG-SHORT02" })).toHaveAttribute("href", "/bookings/9f000000-0000-4000-8000-000000000002");
    expect(await rowOf(/Placeholder NoShow/)).toHaveTextContent("No-show flag");
    expect(screen.queryByRole("row", { name: /Placeholder AdminHold/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Placeholder Pending/ })).not.toBeInTheDocument();
    expect(calls.map((c) => c.search)).toEqual(["?status=held&limit=200&offset=0"]);
  });

  it("On hold by admin shows only what an admin held, with their reason", async () => {
    const user = userEvent.setup();
    stubFetch({ [LIST]: byStatus() });
    render(withAuth(READER, <EarningsList />));
    await rowOf(/Placeholder Short/);
    await user.click(screen.getByRole("tab", { name: "On hold by admin" }));
    const row = await rowOf(/Placeholder AdminHold/);
    expect(row).toHaveTextContent("Held by an admin");
    expect(row).toHaveTextContent("Family disputes the visit; waiting for the call-back");
    expect(screen.queryByRole("row", { name: /Placeholder Short/ })).not.toBeInTheDocument();
  });

  it.each([
    ["Pending", "?status=pending_clearance&limit=50&offset=0", /Placeholder Pending/],
    ["Released", "?status=successful&limit=50&offset=0", /Placeholder Released/],
    ["All", "?limit=50&offset=0", /Placeholder Voided/],
  ])("%s tab asks the API for the matching status", async (label, search, expected) => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: byStatus() });
    render(withAuth(READER, <EarningsList />));
    await rowOf(/Placeholder Short/);
    await user.click(screen.getByRole("tab", { name: label }));
    expect(await rowOf(expected)).toBeInTheDocument();
    expect(calls.some((c) => c.search === search)).toBe(true);
  });

  it("shows a late-cancel compensation as such, and a voided earning's reason", async () => {
    const user = userEvent.setup();
    const late = makeEarning({ id: "late", type: "late_cancel_compensation", caregiver_name: "Placeholder Late", booking_code: "BKG-LATE07" });
    stubFetch({ [LIST]: byStatus([late, VOIDED]) });
    render(withAuth(READER, <EarningsList />));
    await user.click(await screen.findByRole("tab", { name: "All" }));
    expect(await rowOf(/Placeholder Late/)).toHaveTextContent("Late-cancel compensation");
    expect(await rowOf(/Placeholder Voided/)).toHaveTextContent("Voided: Visit never took place");
  });

  it("shows empty and error states", async () => {
    stubFetch({ [LIST]: byStatus([]) });
    const { unmount } = render(withAuth(READER, <EarningsList />));
    expect(await screen.findByText("No earnings")).toBeInTheDocument();
    expect(screen.getByText(/Nothing is waiting for review/)).toBeInTheDocument();
    unmount();
    stubFetch({ [LIST]: () => jsonResponse({ detail: "Access denied. Missing permission: payments.read" }, { status: 403 }) });
    render(withAuth(READER, <EarningsList />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied. Missing permission: payments.read");
  });

  describe("permissions in the detail drawer", () => {
    it("shows a reader the details and no actions", async () => {
      const user = userEvent.setup();
      stubFetch({ [LIST]: byStatus() });
      render(withAuth(READER, <EarningsList />));
      const drawer = await openReview(user, /Placeholder Short/);
      expect(drawer).toHaveTextContent("Short visit");
      expect(drawer).toHaveTextContent("80% of ₦15,000");
      expect(within(drawer).queryByRole("button", { name: /^(Release hold|Hold|Void)$/ })).not.toBeInTheDocument();
    });

    it("gives Finance Release hold on a held earning and Hold on a pending one, never Void", async () => {
      const user = userEvent.setup();
      stubFetch({ [LIST]: byStatus() });
      render(withAuth(FINANCE, <EarningsList />));
      const drawer = await openReview(user, /Placeholder Short/);
      expect(within(drawer).getByRole("button", { name: "Release hold" })).toBeInTheDocument();
      expect(within(drawer).queryByRole("button", { name: "Hold" })).not.toBeInTheDocument();
      expect(within(drawer).queryByRole("button", { name: "Void" })).not.toBeInTheDocument();
      await user.click(within(drawer).getByRole("button", { name: "Close" }));
      await user.click(screen.getByRole("tab", { name: "Pending" }));
      const pending = await openReview(user, /Placeholder Pending/);
      expect(within(pending).getByRole("button", { name: "Hold" })).toBeInTheDocument();
      expect(within(pending).queryByRole("button", { name: "Release hold" })).not.toBeInTheDocument();
    });

    it("tells Finance a no-show hold needs ledger.adjust instead of offering the release", async () => {
      const user = userEvent.setup();
      stubFetch({ [LIST]: byStatus() });
      render(withAuth(FINANCE, <EarningsList />));
      const drawer = await openReview(user, /Placeholder NoShow/);
      expect(within(drawer).queryByRole("button", { name: "Release hold" })).not.toBeInTheDocument();
      expect(drawer).toHaveTextContent("Releasing its hold needs the ledger.adjust permission");
    });

    it("gives a Super Admin Release hold on a no-show hold, and Void", async () => {
      const user = userEvent.setup();
      stubFetch({ [LIST]: byStatus() });
      render(withAuth(SUPER, <EarningsList />));
      const drawer = await openReview(user, /Placeholder NoShow/);
      expect(within(drawer).getByRole("button", { name: "Release hold" })).toBeInTheDocument();
      expect(within(drawer).getByRole("button", { name: "Void" })).toBeInTheDocument();
    });

    it("offers nothing on a released or voided earning, and says why", async () => {
      const user = userEvent.setup();
      stubFetch({ [LIST]: byStatus() });
      render(withAuth(SUPER, <EarningsList />));
      await user.click(await screen.findByRole("tab", { name: "Released" }));
      const drawer = await openReview(user, /Placeholder Released/);
      expect(within(drawer).queryByRole("button", { name: /^(Release hold|Hold|Void)$/ })).not.toBeInTheDocument();
      expect(drawer).toHaveTextContent("cannot be changed here");
    });
  });

  describe("actions", () => {
    it("release hold: names the earning, requires a reason, sends it to that earning, refreshes and says so", async () => {
      const user = userEvent.setup();
      let released = false;
      const calls = stubFetch({
        [LIST]: (req) => (released ? byStatus([{ ...SHORT_VISIT, status: "pending_clearance" }])(req) : byStatus()(req)),
        [post(SHORT_VISIT.id, "release-hold")]: () => {
          released = true;
          return jsonResponse({ ...SHORT_VISIT, status: "pending_clearance", status_reason: "Checked the visit log" });
        },
      });
      render(withAuth(FINANCE, <EarningsList />));
      const drawer = await openReview(user, /Placeholder Short/);
      await user.click(within(drawer).getByRole("button", { name: "Release hold" }));
      const dialog = await screen.findByRole("dialog", { name: /Release the hold on ₦8,000 for Placeholder Short \(booking BKG-SHORT02\)\?/ });
      const confirm = within(dialog).getByRole("button", { name: "Release hold" });
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText(/Reason for releasing/), "Checked the visit log");
      await user.click(confirm);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key.endsWith("/release-hold"))?.body).toEqual({ reason: "Checked the visit log" });
      expect(await screen.findByRole("status")).toHaveTextContent("Hold released");
      await waitFor(() => expect(screen.queryByRole("row", { name: /Placeholder Short/ })).not.toBeInTheDocument());
    });

    it("hold: sends the reason to the hold endpoint", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [LIST]: byStatus(),
        [post(PENDING.id, "hold")]: () => jsonResponse({ ...PENDING, status: "held", status_reason: "Family disputes the visit" }),
      });
      render(withAuth(FINANCE, <EarningsList />));
      await user.click(await screen.findByRole("tab", { name: "Pending" }));
      const drawer = await openReview(user, /Placeholder Pending/);
      await user.click(within(drawer).getByRole("button", { name: "Hold" }));
      const dialog = await screen.findByRole("dialog", { name: /Hold ₦12,000 for Placeholder Pending/ });
      expect(dialog).toHaveTextContent("stays out of the caregiver's available balance");
      await user.type(within(dialog).getByLabelText(/Reason for holding/), "Family disputes the visit");
      await user.click(within(dialog).getByRole("button", { name: "Hold earning" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key.endsWith("/hold"))?.body).toEqual({ reason: "Family disputes the visit" });
      expect(await screen.findByRole("status")).toHaveTextContent("is on hold");
    });

    it("void: warns that it is permanent and sends the reason", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [LIST]: byStatus(),
        [post(SHORT_VISIT.id, "void")]: () => jsonResponse({ ...SHORT_VISIT, status: "voided", status_reason: "Visit never happened" }),
      });
      render(withAuth(SUPER, <EarningsList />));
      const drawer = await openReview(user, /Placeholder Short/);
      await user.click(within(drawer).getByRole("button", { name: "Void" }));
      const dialog = await screen.findByRole("dialog", { name: /Void ₦8,000 for Placeholder Short/ });
      expect(dialog).toHaveTextContent("the caregiver is never paid this money");
      await user.type(within(dialog).getByLabelText(/Reason for voiding/), "Visit never happened");
      await user.click(within(dialog).getByRole("button", { name: "Void earning" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key.endsWith("/void"))?.body).toEqual({ reason: "Visit never happened" });
      expect(await screen.findByRole("status")).toHaveTextContent("was voided");
    });

    it.each([
      ["a conflict", 409, "This earning has already been released to the caregiver's balance; correct it with a ledger adjustment"],
      ["a forbidden release", 403, "This booking is flagged as a no-show; releasing its hold needs the ledger.adjust permission"],
      ["a missing earning", 404, "Earning not found"],
    ])("shows the API's refusal for %s verbatim and keeps the dialog open", async (_name, status, detail) => {
      const user = userEvent.setup();
      stubFetch({
        [LIST]: byStatus(),
        [post(SHORT_VISIT.id, "release-hold")]: () => jsonResponse({ detail }, { status }),
      });
      render(withAuth(SUPER, <EarningsList />));
      const drawer = await openReview(user, /Placeholder Short/);
      await user.click(within(drawer).getByRole("button", { name: "Release hold" }));
      const dialog = await screen.findByRole("dialog", { name: /Release the hold/ });
      await user.type(within(dialog).getByLabelText(/Reason for releasing/), "x");
      await user.click(within(dialog).getByRole("button", { name: "Release hold" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(detail);
      expect(dialog).toBeInTheDocument();
    });

    it("refreshes the list even when an action is refused (the earning may have moved)", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [LIST]: byStatus(),
        [post(SHORT_VISIT.id, "void")]: () => jsonResponse({ detail: "This earning has been voided" }, { status: 409 }),
      });
      render(withAuth(SUPER, <EarningsList />));
      const drawer = await openReview(user, /Placeholder Short/);
      await user.click(within(drawer).getByRole("button", { name: "Void" }));
      const dialog = await screen.findByRole("dialog", { name: /Void/ });
      await user.type(within(dialog).getByLabelText(/Reason for voiding/), "x");
      await user.click(within(dialog).getByRole("button", { name: "Void earning" }));
      await within(dialog).findByRole("alert");
      await waitFor(() => expect(calls.filter((c) => c.key === LIST).length).toBeGreaterThan(1));
    });
  });
});
