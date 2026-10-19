import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import { FAILING, LATE_SUCCESS, OTP_STUCK, makePayout } from "@/test/payout-fixtures";

import { AllPayouts } from "./all-payouts";

vi.mock("next/navigation", () => ({ usePathname: () => "/money/payouts/all" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LIST = "GET /api/v1/admin/payouts";
const SUPER = ["payments.read", "payouts.execute", "ledger.adjust"];
const FINANCE = ["payments.read", "payouts.execute"];
const WAITING = makePayout();

function list(items: ReturnType<typeof makePayout>[]) {
  return () => jsonResponse({ items, total: items.length });
}

const rowOf = (name: RegExp) => screen.findByRole("row", { name });

describe("AllPayouts", () => {
  it("lists payouts and filters by status", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: list([WAITING, FAILING]) });
    render(withAuth(SUPER, <AllPayouts />));
    expect(await rowOf(/Placeholder Failing/)).toHaveTextContent("₦30,000");
    await user.selectOptions(screen.getByLabelText("Status"), "needs_attention");
    await waitFor(() => expect(calls.some((c) => c.search.includes("status=needs_attention"))).toBe(true));
  });

  it("shows empty and error states", async () => {
    stubFetch({ [LIST]: list([]) });
    const { unmount } = render(withAuth(SUPER, <AllPayouts />));
    expect(await screen.findByText("No payouts")).toBeInTheDocument();
    unmount();
    stubFetch({ [LIST]: () => jsonResponse({ detail: "Access denied. Missing permission: payments.read" }, { status: 403 }) });
    render(withAuth(SUPER, <AllPayouts />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied. Missing permission: payments.read");
  });

  it("offers only the actions that fit each status", async () => {
    stubFetch({ [LIST]: list([WAITING, FAILING, OTP_STUCK, LATE_SUCCESS, { ...WAITING, id: "x", caregiver_name: "Done", status: "success" }]) });
    render(withAuth(SUPER, <AllPayouts />));
    const waiting = await rowOf(/Placeholder Paid/);
    expect(within(waiting).getByRole("button", { name: /^Cancel/ })).toBeInTheDocument();
    expect(within(waiting).queryByRole("button", { name: /^Retry/ })).not.toBeInTheDocument();
    const failed = await rowOf(/Placeholder Failing/);
    expect(within(failed).getByRole("button", { name: /^Retry/ })).toBeInTheDocument();
    expect(within(failed).queryByRole("button", { name: /^Resolve/ })).not.toBeInTheDocument();
    expect(within(await rowOf(/Stuck At Otp/)).getByRole("button", { name: /^Resolve/ })).toBeInTheDocument();
    const attention = await rowOf(/Late Success/);
    expect(within(attention).getByRole("button", { name: /^Resolve/ })).toBeInTheDocument();
    expect(within(attention).getByRole("alert")).toHaveTextContent("Needs a person");
    expect(attention).toHaveTextContent("Caregiver frozen since");
    expect(attention).toHaveTextContent("Shortfall: ₦8,000");
    expect(within(await rowOf(/Done/)).queryByRole("button")).not.toBeInTheDocument();
  });

  it("never offers Retry for a failed payout whose caregiver is frozen", async () => {
    stubFetch({ [LIST]: list([{ ...FAILING, caregiver_payouts_frozen_at: "2026-10-12T16:52:20.042261", caregiver_payouts_frozen_reason: "r" }]) });
    render(withAuth(SUPER, <AllPayouts />));
    expect(within(await rowOf(/Placeholder Failing/)).queryByRole("button", { name: /^Retry/ })).not.toBeInTheDocument();
  });

  it("shows Finance only Cancel: Retry and Resolve need ledger.adjust", async () => {
    stubFetch({ [LIST]: list([WAITING, FAILING, OTP_STUCK, LATE_SUCCESS]) });
    render(withAuth(FINANCE, <AllPayouts />));
    expect(within(await rowOf(/Placeholder Paid/)).getByRole("button", { name: /^Cancel/ })).toBeInTheDocument();
    await rowOf(/Placeholder Failing/);
    expect(screen.queryByRole("button", { name: /Retry|Resolve/ })).not.toBeInTheDocument();
  });

  it("hides every action from an admin with neither payouts.execute nor ledger.adjust", async () => {
    stubFetch({ [LIST]: list([WAITING, FAILING, OTP_STUCK, LATE_SUCCESS]) });
    render(withAuth(["payments.read"], <AllPayouts />));
    await rowOf(/Placeholder Failing/);
    expect(screen.queryByRole("button", { name: /Cancel|Retry|Resolve/ })).not.toBeInTheDocument();
  });

  describe("cancel", () => {
    it("names the payout, sends the reason to that payout's id and refreshes the list", async () => {
      const user = userEvent.setup();
      let cancelled = false;
      const calls = stubFetch({
        [LIST]: () => jsonResponse({ items: [cancelled ? { ...WAITING, status: "cancelled" } : WAITING], total: 1 }),
        [`POST /api/v1/admin/payouts/${WAITING.id}/cancel`]: () => {
          cancelled = true;
          return jsonResponse({ ...WAITING, status: "cancelled" });
        },
      });
      render(withAuth(SUPER, <AllPayouts />));
      await user.click(within(await rowOf(/Placeholder Paid/)).getByRole("button", { name: /^Cancel/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Cancel payout of ₦12,000 to Placeholder Paid (batch 2026-10-19)?");
      await user.type(within(dialog).getByLabelText(/Reason for cancelling/), "Caregiver asked us to hold this payout");
      await user.click(within(dialog).getByRole("button", { name: "Cancel payout" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key.endsWith("/cancel"))?.body).toEqual({ reason: "Caregiver asked us to hold this payout" });
      expect(await screen.findByRole("status")).toHaveTextContent("was cancelled");
      expect(await rowOf(/Placeholder Paid/)).toHaveTextContent("Cancelled");
    });

    it("shows the server's refusal verbatim", async () => {
      const user = userEvent.setup();
      stubFetch({
        [LIST]: list([WAITING]),
        [`POST /api/v1/admin/payouts/${WAITING.id}/cancel`]: () =>
          jsonResponse({ detail: "Only a payout that has not been approved can be cancelled" }, { status: 409 }),
      });
      render(withAuth(SUPER, <AllPayouts />));
      await user.click(within(await rowOf(/Placeholder Paid/)).getByRole("button", { name: /^Cancel/ }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/Reason for cancelling/), "x");
      await user.click(within(dialog).getByRole("button", { name: "Cancel payout" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Only a payout that has not been approved can be cancelled");
    });
  });

  describe("retry", () => {
    it("explains that Paystack is asked first, then retries that payout", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [LIST]: list([FAILING]),
        [`POST /api/v1/admin/payouts/${FAILING.id}/retry`]: () => jsonResponse({ ...FAILING, status: "processing", attempts: 2 }),
      });
      render(withAuth(SUPER, <AllPayouts />));
      await user.click(within(await rowOf(/Placeholder Failing/)).getByRole("button", { name: /^Retry/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Retry payout of ₦30,000 to Placeholder Failing");
      expect(dialog).toHaveTextContent("asks Paystack about the last attempt");
      await user.type(within(dialog).getByLabelText(/Reason for retrying/), "Paystack balance topped up");
      await user.click(within(dialog).getByRole("button", { name: "Retry payout" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key.endsWith("/retry"))?.body).toEqual({ reason: "Paystack balance topped up" });
    });

    it("shows Paystack's refusal verbatim", async () => {
      const user = userEvent.setup();
      const msg = "Paystack says this transfer is still pending (pending), so it cannot be retried. Wait for Paystack's answer.";
      stubFetch({
        [LIST]: list([FAILING]),
        [`POST /api/v1/admin/payouts/${FAILING.id}/retry`]: () => jsonResponse({ detail: msg }, { status: 409 }),
      });
      render(withAuth(SUPER, <AllPayouts />));
      await user.click(within(await rowOf(/Placeholder Failing/)).getByRole("button", { name: /^Retry/ }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/Reason for retrying/), "x");
      await user.click(within(dialog).getByRole("button", { name: "Retry payout" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(msg);
    });

    it("refreshes the list even when the retry is refused (the server may have moved the payout)", async () => {
      const user = userEvent.setup();
      let state: "failed" | "needs_attention" = "failed";
      const calls = stubFetch({
        [LIST]: () => jsonResponse({ items: [{ ...FAILING, status: state }], total: 1 }),
        [`POST /api/v1/admin/payouts/${FAILING.id}/retry`]: () => {
          state = "needs_attention";
          return jsonResponse({ detail: "Paystack reports this transfer as successful, so it was not sent again. The payout now needs attention: check it before doing anything else" }, { status: 409 });
        },
      });
      render(withAuth(SUPER, <AllPayouts />));
      await user.click(within(await rowOf(/Placeholder Failing/)).getByRole("button", { name: /^Retry/ }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/Reason for retrying/), "x");
      await user.click(within(dialog).getByRole("button", { name: "Retry payout" }));
      await within(dialog).findByRole("alert");
      await waitFor(() => expect(calls.filter((c) => c.key === LIST).length).toBeGreaterThan(1));
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      await waitFor(async () => expect(await rowOf(/Placeholder Failing/)).toHaveTextContent("Needs attention"));
    });
  });

  describe("resolve", () => {
    it("requires an explicit outcome before it can be submitted, and sends force only when ticked", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [LIST]: list([OTP_STUCK]),
        [`POST /api/v1/admin/payouts/${OTP_STUCK.id}/resolve`]: () => jsonResponse({ ...OTP_STUCK, status: "failed" }),
      });
      render(withAuth(SUPER, <AllPayouts />));
      await user.click(within(await rowOf(/Stuck At Otp/)).getByRole("button", { name: /^Resolve/ }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText(/Reason \(how you checked Paystack\)/), "Checked the dashboard: no OTP entered in an hour");
      expect(within(dialog).getByRole("button", { name: "Resolve" })).toBeDisabled();
      await user.click(within(dialog).getByLabelText(/Failed: the transfer did not go through/));
      expect(dialog).toHaveTextContent("returns the reserved money");
      await user.click(within(dialog).getByLabelText(/Force\./));
      await user.click(within(dialog).getByRole("button", { name: "Resolve as failed" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key.endsWith("/resolve"))?.body).toEqual({
        outcome: "failed",
        reason: "Checked the dashboard: no OTP entered in an hour",
        force: true,
      });
    });

    it("sends force: false by default", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [LIST]: list([OTP_STUCK]),
        [`POST /api/v1/admin/payouts/${OTP_STUCK.id}/resolve`]: () => jsonResponse({ ...OTP_STUCK, status: "success" }),
      });
      render(withAuth(SUPER, <AllPayouts />));
      await user.click(within(await rowOf(/Stuck At Otp/)).getByRole("button", { name: /^Resolve/ }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByLabelText(/Paid: Paystack shows the transfer succeeded/));
      await user.type(within(dialog).getByLabelText(/Reason/), "OTP entered; Paystack shows success");
      await user.click(within(dialog).getByRole("button", { name: "Resolve as paid" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key.endsWith("/resolve"))?.body).toEqual({
        outcome: "paid",
        reason: "OTP entered; Paystack shows success",
        force: false,
      });
    });

    it("shows Paystack's answer-not-final refusal verbatim", async () => {
      const user = userEvent.setup();
      const msg =
        "Paystack is waiting for an OTP to release this transfer, so there is no proof for either answer. Resolve it only with force and a reason that says how you checked";
      stubFetch({
        [LIST]: list([OTP_STUCK]),
        [`POST /api/v1/admin/payouts/${OTP_STUCK.id}/resolve`]: () => jsonResponse({ detail: msg }, { status: 409 }),
      });
      render(withAuth(SUPER, <AllPayouts />));
      await user.click(within(await rowOf(/Stuck At Otp/)).getByRole("button", { name: /^Resolve/ }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByLabelText(/Failed:/));
      await user.type(within(dialog).getByLabelText(/Reason/), "stuck for an hour");
      await user.click(within(dialog).getByRole("button", { name: "Resolve as failed" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(msg);
    });
  });
});
