import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RefundDetail } from "@/lib/refunds";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import { ATTEMPT, COMPLETED, FAILED, NEEDS_ATTENTION, NEEDS_REVIEW, REFUND_ID, makeDetail } from "@/test/refund-fixtures";

import { RefundView } from "./refund-detail";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const GET = `GET /api/v1/admin/refunds/${REFUND_ID}`;
const post = (action: string) => `POST /api/v1/admin/refunds/${REFUND_ID}/${action}`;
const FINANCE = ["refunds.approve", "payments.read"];
const SUPER = [...FINANCE, "refunds.request", "refunds.approve_above_limit"];
const ME = "00000000-0000-0000-0000-000000000001";

const serve = (detail: RefundDetail) => () => jsonResponse(detail);
const buttons = () => screen.queryAllByRole("button").map((b) => b.textContent?.replace(/\s*refund of .*$/, "").trim());

describe("RefundView", () => {
  it("shows a pending system refund: amounts in naira, booking link, rules and the Finance limit", async () => {
    stubFetch({ [GET]: serve(makeDetail()) });
    render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Refund for booking 780212EB");
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    expect(screen.getByText("Waiting for a person to approve or reject it.")).toBeInTheDocument();
    const amount = screen.getByRole("region", { name: "Amount" });
    expect(amount).toHaveTextContent("Suggested₦55,000");
    expect(amount).toHaveTextContent("Set by the admin who cancelled the booking.");
    expect(amount).toHaveTextContent("Approved amountNot approved yet");
    expect(amount).toHaveTextContent("You can approve up to₦50,000");
    expect(amount).toHaveTextContent("Finance limit₦50,000 per booking, cumulative");
    const booking = screen.getByRole("region", { name: "Booking" });
    expect(within(booking).getByRole("link", { name: "780212EB" })).toHaveAttribute("href", `/bookings/${makeDetail().booking_id}`);
    expect(booking).toHaveTextContent("Paid₦55,000");
    expect(booking).toHaveTextContent("Still refundable₦55,000");
    expect(booking).toHaveTextContent("Paystack fee₦825");
    const rules = screen.getByRole("complementary", { name: "Refund rules" });
    expect(rules).toHaveTextContent("Finance approves up to the cumulative limit per booking (₦50,000)");
    expect(rules).toHaveTextContent("A Super Admin approves anything above the limit, and every refund to the Oakly wallet.");
    expect(rules).toHaveTextContent("A refund raised by staff has to be approved by a different admin.");
  });

  it("renders only the buttons in available_actions", async () => {
    const cases: [RefundDetail, string[]][] = [
      [makeDetail(), ["Approve", "Reject"]],
      [FAILED, ["Retry", "Close refund"]],
      [{ ...FAILED, available_actions: ["retry", "switch_to_wallet", "close"] }, ["Retry", "Switch to wallet", "Close refund"]],
      [NEEDS_ATTENTION, ["Enter bank details"]],
      [NEEDS_REVIEW, ["Resolve"]],
      [makeDetail({ status: "processing", available_actions: [] }), []],
      [makeDetail({ status: "pending_approval", available_actions: ["reject"] }), ["Reject"]],
    ];
    for (const [detail, expected] of cases) {
      stubFetch({ [GET]: serve(detail) });
      const { unmount } = render(withAuth(SUPER, <RefundView id={REFUND_ID} />));
      await screen.findByRole("heading", { level: 1 });
      expect(buttons().filter((b) => b !== "Refresh")).toEqual(expected);
      unmount();
    }
  });

  it("does not re-derive permissions: a Super Admin sees no Approve when the server does not offer it", async () => {
    stubFetch({ [GET]: serve(makeDetail({ available_actions: ["reject"] })) });
    render(withAuth(SUPER, <RefundView id={REFUND_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: /^Approve/ })).not.toBeInTheDocument();
  });

  it("tells the admin who raised a refund that another admin must approve it", async () => {
    stubFetch({ [GET]: serve(makeDetail({ origin: "staff", requested_by: ME, available_actions: ["reject"], needs_super_admin: false })) });
    render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    expect(await screen.findByRole("note")).toHaveTextContent("Another admin must approve this refund.");
    expect(screen.getByRole("button", { name: /^Reject/ })).toBeInTheDocument();
  });

  it("says a Super Admin must approve when the refund is above what the caller may approve", async () => {
    stubFetch({ [GET]: serve(makeDetail()) });
    render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    expect(await screen.findByRole("note")).toHaveTextContent("A Super Admin must approve this. It is ₦55,000, above the ₦50,000 you can approve now.");
  });

  it("shows the review flag, even on a refund that already finished", async () => {
    stubFetch({
      [GET]: serve({ ...NEEDS_REVIEW, status: "succeeded", available_actions: [], failure_reason: null }),
    });
    render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Flagged for review since");
    expect(alert).toHaveTextContent("Paystack reported processed for 5400000 kobo, but this refund is 5500000 kobo.");
  });

  it("explains each in-flight and finished state without calling it refunded too early", async () => {
    const cases: [Partial<RefundDetail>, RegExp][] = [
      [{ status: "approved", available_actions: [] }, /Approved, not sent yet/],
      [{ status: "processing", available_actions: [] }, /Sent to Paystack, waiting for its answer. It is not refunded yet./],
      [{ status: "succeeded", destination: "original_method", available_actions: [], processed_at: "2026-10-21T14:29:10.693794" }, /up to 10 business days/],
      [{ status: "succeeded", destination: "wallet", available_actions: [] }, /wallet was credited/],
      [{ status: "rejected", available_actions: [], rejected_reason: "Raised by mistake" }, /Raised by mistake/],
      [{ status: "closed", available_actions: [], note: "Closed: the family asked us to stop" }, /Closed: the family asked us to stop/],
    ];
    for (const [overrides, text] of cases) {
      stubFetch({ [GET]: serve(makeDetail(overrides)) });
      const { unmount } = render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await screen.findByRole("heading", { level: 1 });
      expect(document.body).toHaveTextContent(text);
      unmount();
    }
  });

  it("lists attempts, with holder fields null for a role that cannot see them and last four digits for one that can", async () => {
    const visible = { ...ATTEMPT, status: "needs_attention", failure_reason: null, paystack_refund_id: "1001", bank_code: "058", account_last4: "0077", account_name: "PLACEHOLDER ACCOUNT 0077" };
    stubFetch({ [GET]: serve({ ...NEEDS_ATTENTION, available_actions: [], attempts: [ATTEMPT, visible] }) });
    const { unmount } = render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    const table = await screen.findByRole("table", { name: /Attempts to refund/ });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Failed");
    expect(rows[1]).toHaveTextContent("Paystack reported the refund as failed");
    expect(rows[1]).toHaveTextContent("1005");
    expect(rows[2]).toHaveTextContent("058");
    expect(rows[2]).toHaveTextContent("•••• 0077");
    expect(rows[2]).toHaveTextContent("PLACEHOLDER ACCOUNT 0077");
    expect(table).not.toHaveTextContent(/\d{10}/);
    unmount();
    stubFetch({ [GET]: serve({ ...NEEDS_ATTENTION, available_actions: [], attempts: [{ ...visible, bank_code: null, account_last4: null, account_name: null }] }) });
    render(withAuth(["refunds.request"], <RefundView id={REFUND_ID} />));
    const hidden = within(await screen.findByRole("table", { name: /Attempts to refund/ })).getAllByRole("row")[1];
    expect(hidden).not.toHaveTextContent("••••");
    expect(hidden).not.toHaveTextContent("058");
  });

  it("shows the take-back preview for a completed visit and, after the money left, debited versus owed", async () => {
    stubFetch({ [GET]: serve(COMPLETED) });
    const { unmount } = render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    expect(await screen.findByRole("region", { name: "Caregiver take-back" })).toHaveTextContent("Would be taken back₦14,545.45");
    unmount();
    stubFetch({
      [GET]: serve({
        ...COMPLETED,
        status: "succeeded",
        available_actions: [],
        take_back_from_caregiver: true,
        take_back_naira: 14545.45,
        take_back_reason: "The caregiver left the visit early",
        take_back_debited_naira: 1000.0,
        take_back_owed_naira: 13545.45,
        take_back_preview_naira: null,
      }),
    });
    render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    const section = await screen.findByRole("region", { name: "Caregiver take-back" });
    expect(section).toHaveTextContent("Agreed at approval₦14,545.45");
    expect(section).toHaveTextContent("The caregiver left the visit early");
    expect(section).toHaveTextContent("Debited from the wallet₦1,000");
    expect(section).toHaveTextContent("Owed, recovered from next earnings₦13,545.45");
    expect(section).not.toHaveTextContent("Would be taken back");
  });

  it("shows no take-back section for a booking that was not completed", async () => {
    stubFetch({ [GET]: serve(makeDetail()) });
    render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("region", { name: "Caregiver take-back" })).not.toBeInTheDocument();
  });

  it("shows the load error and retries", async () => {
    const user = userEvent.setup();
    let ok = false;
    stubFetch({
      [GET]: () => (ok ? jsonResponse(makeDetail()) : jsonResponse({ detail: "Refund not found" }, { status: 404 })),
    });
    render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load this refund. Refund not found");
    ok = true;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  describe("approve", () => {
    it("approves a lower amount than suggested, sends it with the note, swaps in the returned refund", async () => {
      const user = userEvent.setup();
      const approved = makeDetail({ status: "approved", amount_naira: 20000.0, destination: "original_method", available_actions: [] });
      const calls = stubFetch({ [GET]: serve(makeDetail()), [post("approve")]: serve(approved) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Approve refund for booking 780212EB?");
      expect(dialog).toHaveTextContent("above the most you can approve now (₦50,000)");
      const amount = within(dialog).getByLabelText(/Amount to refund/);
      expect(amount).toHaveValue("50000");
      await user.clear(amount);
      await user.type(amount, "20000");
      await user.type(within(dialog).getByLabelText(/Note/), "Approving 20,000 now");
      await user.click(within(dialog).getByRole("button", { name: "Approve refund" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === post("approve"))?.body).toEqual({
        amount_naira: 20000,
        destination: "original_method",
        take_back_from_caregiver: false,
        note: "Approving 20,000 now",
      });
      expect(await screen.findByRole("status")).toHaveTextContent("Approved ₦20,000 for booking 780212EB.");
      expect(screen.getByText("Approved, not sent yet. The send job runs about every minute.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Approve/ })).not.toBeInTheDocument();
    });

    it("never lets the amount go above the most this admin may approve, or below a kobo", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({ [GET]: serve(makeDetail()) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      const dialog = await screen.findByRole("dialog");
      const amount = within(dialog).getByLabelText(/Amount to refund/);
      const confirm = within(dialog).getByRole("button", { name: "Approve refund" });
      for (const bad of ["50000.01", "55000", "0", "12.345", "abc", ""]) {
        await user.clear(amount);
        if (bad) await user.type(amount, bad);
        expect(confirm).toBeDisabled();
      }
      await user.clear(amount);
      await user.type(amount, "50,000.00");
      expect(confirm).toBeEnabled();
      expect(calls.some((c) => c.key === post("approve"))).toBe(false);
    });

    it("starts from the suggestion when it is within the limit, and needs a typed amount when none was suggested", async () => {
      const user = userEvent.setup();
      stubFetch({ [GET]: serve(makeDetail({ suggested_amount_naira: 12000.0, needs_super_admin: false })) });
      const { unmount } = render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      expect(await screen.findByLabelText(/Amount to refund/)).toHaveValue("12000");
      unmount();
      stubFetch({ [GET]: serve(makeDetail({ suggested_amount_naira: null, needs_super_admin: false })) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByLabelText(/Amount to refund/)).toHaveValue("");
      expect(dialog).toHaveTextContent("No amount was suggested: enter the one to refund.");
      expect(within(dialog).getByRole("button", { name: "Approve refund" })).toBeDisabled();
    });

    it("offers the wallet only to a Super Admin on an app booking", async () => {
      const user = userEvent.setup();
      stubFetch({ [GET]: serve(makeDetail()) });
      const { unmount } = render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      await screen.findByRole("dialog");
      expect(screen.queryByLabelText(/Oakly wallet/)).not.toBeInTheDocument();
      unmount();

      stubFetch({ [GET]: serve(makeDetail({ booking: { ...makeDetail().booking, channel: "whatsapp" } })) });
      const whatsapp = render(withAuth(SUPER, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      await screen.findByRole("dialog");
      expect(screen.queryByLabelText(/Oakly wallet/)).not.toBeInTheDocument();
      whatsapp.unmount();

      const credited = makeDetail({ status: "succeeded", amount_naira: 55000.0, destination: "wallet", available_actions: [] });
      const calls = stubFetch({ [GET]: serve(makeDetail({ needs_super_admin: false, max_approvable_naira: 55000.0 })), [post("approve")]: serve(credited) });
      render(withAuth(SUPER, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByLabelText(/Oakly wallet/));
      expect(dialog).toHaveTextContent("Credits the family's Oakly wallet at once");
      await user.click(within(dialog).getByRole("button", { name: "Approve and credit wallet" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === post("approve"))?.body).toMatchObject({ amount_naira: 55000, destination: "wallet" });
      expect(await screen.findByText(/The family's Oakly wallet was credited\./)).toBeInTheDocument();
    });

    it("previews the take-back, requires a reason when it is chosen, and sends both", async () => {
      const user = userEvent.setup();
      const done = makeDetail({ ...COMPLETED, status: "approved", amount_naira: 20000.0, available_actions: [] });
      const calls = stubFetch({ [GET]: serve(COMPLETED), [post("approve")]: serve(done) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Taking back the caregiver's share would be ₦14,545.45");
      expect(dialog).toHaveTextContent("proportional");
      const confirm = within(dialog).getByRole("button", { name: "Approve refund" });
      expect(confirm).toBeEnabled();
      await user.click(within(dialog).getByLabelText("Take the caregiver's share back"));
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText("Reason for taking it back"), "The caregiver left the visit early");
      await user.click(confirm);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === post("approve"))?.body).toEqual({
        amount_naira: 20000,
        destination: "original_method",
        take_back_from_caregiver: true,
        take_back_reason: "The caregiver left the visit early",
      });
    });

    it("does not offer a take-back for a booking that was not completed", async () => {
      const user = userEvent.setup();
      stubFetch({ [GET]: serve(makeDetail()) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      await screen.findByRole("dialog");
      expect(screen.queryByLabelText(/caregiver's share/)).not.toBeInTheDocument();
    });

    it("shows the server's refusal verbatim and keeps the dialog open", async () => {
      const user = userEvent.setup();
      const message = "Refunds on this booking would total ₦55,000, above the ₦50,000 limit for Finance. A Super Admin must approve it.";
      stubFetch({ [GET]: serve(makeDetail({ needs_super_admin: false })), [post("approve")]: () => jsonResponse({ detail: message }, { status: 403 }) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Approve refund" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
    });

    it("sends a double click once", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [GET]: serve(makeDetail({ needs_super_admin: false })),
        [post("approve")]: () => jsonResponse(makeDetail({ status: "approved", amount_naira: 50000.0, available_actions: [] })),
      });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Approve/ }));
      const dialog = await screen.findByRole("dialog");
      await user.dblClick(within(dialog).getByRole("button", { name: "Approve refund" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.filter((c) => c.key === post("approve"))).toHaveLength(1);
    });
  });

  describe("reject, retry, close and switch to the wallet", () => {
    it("rejects with a required reason", async () => {
      const user = userEvent.setup();
      const rejected = makeDetail({ status: "rejected", rejected_reason: "Raised by mistake", available_actions: [] });
      const calls = stubFetch({ [GET]: serve(makeDetail()), [post("reject")]: serve(rejected) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Reject/ }));
      const dialog = await screen.findByRole("dialog");
      const confirm = within(dialog).getByRole("button", { name: "Reject refund" });
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText(/Reason for rejecting/), "Raised by mistake");
      await user.click(confirm);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === post("reject"))?.body).toEqual({ reason: "Raised by mistake" });
      expect(await screen.findByText("Rejected")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Rejected");
    });

    it("retries a failed refund with no body, and shows the server's refusal when Paystack disagrees", async () => {
      const user = userEvent.setup();
      let refuse = true;
      const calls = stubFetch({
        [GET]: serve(FAILED),
        [post("retry")]: () =>
          refuse
            ? jsonResponse({ detail: "Paystack shows this refund as processed, not failed. Check the Paystack dashboard." }, { status: 409 })
            : jsonResponse({ ...FAILED, status: "approved", failure_reason: null, available_actions: [] }),
      });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Retry/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("asks Paystack whether the last attempt really failed");
      await user.click(within(dialog).getByRole("button", { name: "Retry refund" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Paystack shows this refund as processed, not failed.");
      refuse = false;
      await user.click(within(dialog).getByRole("button", { name: "Retry refund" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.filter((c) => c.key === post("retry")).map((c) => c.body)).toEqual([undefined, undefined]);
      expect(await screen.findByText(/Approved, not sent yet/)).toBeInTheDocument();
    });

    it("closes a failed refund with a required reason", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [GET]: serve(FAILED),
        [post("close")]: serve({ ...FAILED, status: "closed", note: "Closed: The family asked us to stop", available_actions: [] }),
      });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Close refund/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("the booking can be refunded again");
      await user.type(within(dialog).getByLabelText(/Reason for closing/), "The family asked us to stop");
      await user.click(within(dialog).getByRole("button", { name: "Close refund" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === post("close"))?.body).toEqual({ reason: "The family asked us to stop" });
      expect(await screen.findByText("Closed. No money moved.")).toBeInTheDocument();
    });

    it("switches an app booker's failed refund to the wallet (Super Admin) with no body", async () => {
      const user = userEvent.setup();
      const failedApp = { ...FAILED, available_actions: ["retry", "switch_to_wallet", "close"] as RefundDetail["available_actions"], booking: { ...FAILED.booking, channel: "app" } };
      const calls = stubFetch({
        [GET]: serve(failedApp),
        [post("switch-to-wallet")]: serve({ ...failedApp, status: "succeeded", destination: "wallet", available_actions: [] }),
      });
      render(withAuth(SUPER, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Switch to wallet/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Only for app bookers");
      await user.click(within(dialog).getByRole("button", { name: "Credit the wallet" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === post("switch-to-wallet"))?.body).toBeUndefined();
      expect(await screen.findByRole("status")).toHaveTextContent("Credited the family's wallet");
    });
  });

  describe("bank details", () => {
    it("takes a bank code and exactly 10 digits, sends them, and afterwards shows only the last four", async () => {
      const user = userEvent.setup();
      const after = {
        ...NEEDS_ATTENTION,
        status: "processing" as const,
        available_actions: [] as RefundDetail["available_actions"],
        attempts: [{ ...ATTEMPT, failure_reason: null, paystack_refund_id: "1001", status: "processing", bank_code: "058", account_last4: "0077", account_name: "PLACEHOLDER ACCOUNT 0077" }],
      };
      const calls = stubFetch({ [GET]: serve(NEEDS_ATTENTION), [post("bank-details")]: serve(after) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Enter bank details/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Oakly never stores or shows it again");
      const confirm = within(dialog).getByRole("button", { name: "Send bank details" });
      await user.type(within(dialog).getByLabelText("Bank code"), "058");
      await user.type(within(dialog).getByLabelText("Account number"), "000000007");
      expect(confirm).toBeDisabled();
      await user.type(within(dialog).getByLabelText("Account number"), "7xx");
      expect(within(dialog).getByLabelText("Account number")).toHaveValue("0000000077");
      await user.click(confirm);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === post("bank-details"))?.body).toEqual({ bank_code: "058", account_number: "0000000077" });
      expect(await screen.findByRole("status")).toHaveTextContent("Bank details sent to Paystack");
      expect(await screen.findByText("•••• 0077")).toBeInTheDocument();
      expect(document.body).not.toHaveTextContent("0000000077");
    });

    it("shows the server's refusal (an unknown bank) without clearing the form", async () => {
      const user = userEvent.setup();
      stubFetch({ [GET]: serve(NEEDS_ATTENTION), [post("bank-details")]: () => jsonResponse({ detail: "Choose a bank from the list." }, { status: 422 }) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Enter bank details/ }));
      const dialog = await screen.findByRole("dialog");
      await user.type(within(dialog).getByLabelText("Bank code"), "999");
      await user.type(within(dialog).getByLabelText("Account number"), "0000000077");
      await user.click(within(dialog).getByRole("button", { name: "Send bank details" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose a bank from the list.");
      expect(within(dialog).getByLabelText("Bank code")).toHaveValue("999");
    });

    it("offers no bank-details button when the server does not (the admin who approved it)", async () => {
      stubFetch({ [GET]: serve({ ...NEEDS_ATTENTION, available_actions: [] }) });
      render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
      await screen.findByRole("heading", { level: 1 });
      expect(screen.queryByRole("button", { name: /bank details/i })).not.toBeInTheDocument();
    });
  });

  describe("resolve", () => {
    it("needs an explicit outcome and a note, and shows why the refund needs a person", async () => {
      const user = userEvent.setup();
      const calls = stubFetch({
        [GET]: serve(NEEDS_REVIEW),
        [post("resolve")]: serve({ ...NEEDS_REVIEW, status: "failed", failure_reason: "Marked failed after review: no refund for this payment", review_flagged_at: null, review_reason: null, available_actions: ["retry", "switch_to_wallet", "close"] }),
      });
      render(withAuth(SUPER, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Resolve/ }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent("Why it needs a person: Paystack reported processed for 5400000 kobo");
      const confirm = within(dialog).getByRole("button", { name: "Resolve" });
      await user.type(within(dialog).getByLabelText(/Note/), "Checked the dashboard: no refund for this payment");
      expect(confirm).toBeDisabled();
      await user.click(within(dialog).getByLabelText(/Failed: no refund went out/));
      await user.click(within(dialog).getByRole("button", { name: "Resolve as failed" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === post("resolve"))?.body).toEqual({
        outcome: "failed",
        note: "Checked the dashboard: no refund for this payment",
      });
      expect(await screen.findByRole("button", { name: /^Retry/ })).toBeInTheDocument();
    });

    it("on Paystack's different-amount 409, asks for the amount (prefilled in naira) and resolves again with it", async () => {
      const user = userEvent.setup();
      const message =
        "Paystack processed a different amount from this refund's. To record what Paystack confirmed, resolve again with that amount (5400000 kobo).";
      let attempt = 0;
      const calls = stubFetch({
        [GET]: serve(NEEDS_REVIEW),
        [post("resolve")]: () =>
          ++attempt === 1
            ? jsonResponse({ detail: message }, { status: 409 })
            : jsonResponse({ ...NEEDS_REVIEW, status: "succeeded", amount_naira: 54000.0, review_flagged_at: null, review_reason: null, available_actions: [] }),
      });
      render(withAuth(SUPER, <RefundView id={REFUND_ID} />));
      await user.click(await screen.findByRole("button", { name: /^Resolve/ }));
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).queryByLabelText(/Amount Paystack processed/)).not.toBeInTheDocument();
      await user.click(within(dialog).getByLabelText(/Succeeded: the refund was processed/));
      await user.type(within(dialog).getByLabelText(/Note/), "Checked the Paystack dashboard: 54,000.00 NGN processed");
      await user.click(within(dialog).getByRole("button", { name: "Resolve as succeeded" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("Paystack processed a different amount");
      expect(within(dialog).getByLabelText(/Amount Paystack processed/)).toHaveValue("54000");
      await user.click(within(dialog).getByRole("button", { name: "Resolve as succeeded" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(calls.filter((c) => c.key === post("resolve")).map((c) => c.body)).toEqual([
        { outcome: "succeeded", note: "Checked the Paystack dashboard: 54,000.00 NGN processed" },
        { outcome: "succeeded", note: "Checked the Paystack dashboard: 54,000.00 NGN processed", amount_naira: 54000 },
      ]);
      expect(await screen.findByText("Succeeded")).toBeInTheDocument();
    });
  });

  it("re-reads a refund the server refused to change", async () => {
    const user = userEvent.setup();
    let gets = 0;
    stubFetch({
      [GET]: () => jsonResponse(++gets === 1 ? FAILED : { ...FAILED, status: "needs_review", available_actions: ["resolve"], review_flagged_at: "2026-10-21T14:29:21.705900", review_reason: "Paystack shows an earlier attempt as processed" }),
      [post("retry")]: () => jsonResponse({ detail: "Paystack shows an earlier attempt of this refund as processed, so the money has already left." }, { status: 409 }),
    });
    render(withAuth(FINANCE, <RefundView id={REFUND_ID} />));
    await user.click(await screen.findByRole("button", { name: /^Retry/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Retry refund" }));
    await within(dialog).findByRole("alert");
    expect(await screen.findByText("Needs review")).toBeInTheDocument();
  });
});
