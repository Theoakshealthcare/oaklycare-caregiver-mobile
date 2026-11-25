import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import {
  NOT_WAITING_MESSAGE,
  PENDING,
  PENDING_FUNDED,
  STALE_MESSAGE,
  makeBankReview,
} from "@/test/bank-review-fixtures";

import { BankReviewsQueue } from "./bank-reviews-queue";

vi.mock("next/navigation", () => ({ usePathname: () => "/money/payouts/bank-reviews" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const LIST = "GET /api/v1/admin/payouts/bank-reviews";
const APPROVE = (id: string) => `POST /api/v1/admin/payouts/bank-reviews/${id}/approve`;
const REJECT = (id: string) => `POST /api/v1/admin/payouts/bank-reviews/${id}/reject`;
const FINANCE = ["payments.read", "payouts.execute"];
const READ_ONLY = ["payments.read"];

const listOf = (items: unknown[]) => jsonResponse({ items, total: items.length });

/** Fill the reason and press the dialog's confirm button. */
async function decide(user: ReturnType<typeof userEvent.setup>, confirm: string, reason: string) {
  const dialog = await screen.findByRole("dialog");
  await user.type(within(dialog).getByLabelText(/^Reason for/), reason);
  await user.click(within(dialog).getByRole("button", { name: confirm }));
  return dialog;
}

describe("BankReviewsQueue", () => {
  it("lists pending reviews with the profile name and the bank's name side by side, the masked account and the balance", async () => {
    const calls = stubFetch({ [LIST]: () => listOf([PENDING, PENDING_FUNDED]) });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    const table = await screen.findByRole("table", { name: "Pending account name reviews" });
    const first = within(table).getByRole("row", { name: /Placeholder Tosin/ });
    const cells = within(first).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Placeholder Tosin"); // profile name
    expect(cells[1]).toHaveTextContent("SAMPLE OTHERPERSON"); // name the bank holds
    expect(cells[2]).toHaveTextContent("Placeholder Bank ******0011");
    expect(cells[3]).toHaveTextContent("₦0");
    expect(within(table).getByRole("row", { name: /Placeholder Ada/ })).toHaveTextContent("₦12,500");
    // The default is the pending queue.
    expect(calls[0]?.search).toContain("status=pending");
  });

  it("approves with the reason and the review token of that row", async () => {
    const user = userEvent.setup();
    let decided = false;
    const calls = stubFetch({
      [LIST]: () => listOf(decided ? [PENDING_FUNDED] : [PENDING, PENDING_FUNDED]),
      [APPROVE(PENDING.caregiver_id)]: () => {
        decided = true;
        return jsonResponse(makeBankReview({ status: "approved", decided_at: "2026-11-25T13:29:55.491585" }));
      },
    });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    const row = await screen.findByRole("row", { name: /Placeholder Tosin/ });
    await user.click(within(row).getByRole("button", { name: /Approve/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Approve account ending 0011 for Placeholder Tosin?");
    // Both names are repeated in the dialog so the reviewer confirms what they compared.
    expect(dialog).toHaveTextContent("Placeholder Tosin");
    expect(dialog).toHaveTextContent("SAMPLE OTHERPERSON");
    await decide(user, "Approve account", "Confirmed with the caregiver by phone");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const post = calls.find((c) => c.key === APPROVE(PENDING.caregiver_id));
    expect(post?.body).toEqual({ reason: "Confirmed with the caregiver by phone", review_token: PENDING.review_token });
    expect(await screen.findByRole("status")).toHaveTextContent("Account for Placeholder Tosin was approved");
    // The queue reloads: the decided row is gone and the other is untouched.
    await waitFor(() => expect(screen.queryByRole("row", { name: /Placeholder Tosin/ })).not.toBeInTheDocument());
    expect(screen.getByRole("row", { name: /Placeholder Ada/ })).toBeInTheDocument();
  });

  it("rejects the second row with that row's own review token", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [LIST]: () => listOf([PENDING, PENDING_FUNDED]),
      [REJECT(PENDING_FUNDED.caregiver_id)]: () => jsonResponse({ ...PENDING_FUNDED, status: "rejected", decided_at: "2026-11-25T14:30:00.000000" }),
    });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    const row = await screen.findByRole("row", { name: /Placeholder Ada/ });
    await user.click(within(row).getByRole("button", { name: /Reject/ }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Reject account ending 0012 for Placeholder Ada?");
    await decide(user, "Reject account", "The caregiver could not confirm this account");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.find((c) => c.key === REJECT(PENDING_FUNDED.caregiver_id))?.body).toEqual({
      reason: "The caregiver could not confirm this account",
      review_token: PENDING_FUNDED.review_token,
    });
    expect(await screen.findByRole("status")).toHaveTextContent("was rejected");
    expect(calls.some((c) => c.key === APPROVE(PENDING_FUNDED.caregiver_id))).toBe(false);
  });

  it("will not send a decision without a reason", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [LIST]: () => listOf([PENDING]) });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    await user.click(within(await screen.findByRole("row", { name: /Placeholder Tosin/ })).getByRole("button", { name: /Approve/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Approve account" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/^Reason for/), "   ");
    expect(within(dialog).getByRole("button", { name: "Approve account" })).toBeDisabled();
    expect(calls.some((c) => c.key.startsWith("POST"))).toBe(false);
  });

  it("on a 409 because the caregiver saved another account: closes the dialog, reloads the row, and says so", async () => {
    const user = userEvent.setup();
    const changed = makeBankReview({ account_name: "A DIFFERENT HOLDER", account_number: "******4321", review_token: "0123456789abcdef0123456789abcdef" });
    let reloaded = false;
    const calls = stubFetch({
      [LIST]: () => listOf(reloaded ? [changed] : [PENDING]),
      [APPROVE(PENDING.caregiver_id)]: () => {
        reloaded = true;
        return jsonResponse({ detail: STALE_MESSAGE }, { status: 409 });
      },
    });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    await user.click(within(await screen.findByRole("row", { name: /Placeholder Tosin/ })).getByRole("button", { name: /Approve/ }));
    await decide(user, "Approve account", "Checked it");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The reviewer is told, in the server's own words, and the queue now shows the account the caregiver saved since.
    expect(await screen.findByRole("alert")).toHaveTextContent(STALE_MESSAGE);
    const row = await screen.findByRole("row", { name: /A DIFFERENT HOLDER/ });
    expect(row).toHaveTextContent("Placeholder Bank ******4321");
    expect(calls.filter((c) => c.key === LIST).length).toBeGreaterThanOrEqual(2);
    // Nothing was decided, so no success notice.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    // Looking again and deciding sends the reloaded row's token, not the stale one.
    await user.click(within(row).getByRole("button", { name: /Approve/ }));
    await decide(user, "Approve account", "Looked again");
    await waitFor(() => expect(calls.filter((c) => c.key === APPROVE(PENDING.caregiver_id))).toHaveLength(2));
    expect(calls.filter((c) => c.key === APPROVE(PENDING.caregiver_id))[1]?.body).toEqual({
      reason: "Looked again",
      review_token: "0123456789abcdef0123456789abcdef",
    });
  });

  it("on a 409 because someone already decided it: tells the reviewer and drops the row", async () => {
    const user = userEvent.setup();
    let reloaded = false;
    stubFetch({
      [LIST]: () => listOf(reloaded ? [] : [PENDING]),
      [REJECT(PENDING.caregiver_id)]: () => {
        reloaded = true;
        return jsonResponse({ detail: NOT_WAITING_MESSAGE }, { status: 409 });
      },
    });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    await user.click(within(await screen.findByRole("row", { name: /Placeholder Tosin/ })).getByRole("button", { name: /Reject/ }));
    await decide(user, "Reject account", "No match");
    expect(await screen.findByRole("alert")).toHaveTextContent(NOT_WAITING_MESSAGE);
    expect(await screen.findByText("No accounts are waiting for review")).toBeInTheDocument();
  });

  it("keeps the dialog open with the server's message when the decision is refused for another reason", async () => {
    const user = userEvent.setup();
    stubFetch({
      [LIST]: () => listOf([PENDING]),
      [APPROVE(PENDING.caregiver_id)]: () =>
        jsonResponse({ detail: "Access denied. Missing permission: payouts.execute" }, { status: 403 }),
    });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    await user.click(within(await screen.findByRole("row", { name: /Placeholder Tosin/ })).getByRole("button", { name: /Approve/ }));
    const dialog = await decide(user, "Approve account", "Looks right");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Access denied. Missing permission: payouts.execute");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows Approve and Reject only to an admin with payouts.execute", async () => {
    stubFetch({ [LIST]: () => listOf([PENDING]) });
    render(withAuth(READ_ONLY, <BankReviewsQueue />));
    const row = await screen.findByRole("row", { name: /Placeholder Tosin/ });
    // They can still read the queue and compare the names.
    expect(row).toHaveTextContent("SAMPLE OTHERPERSON");
    expect(screen.queryByRole("button", { name: /Approve|Reject/ })).not.toBeInTheDocument();
  });

  it("filters by status and offers no actions on a decided account", async () => {
    const user = userEvent.setup();
    const rejected = makeBankReview({ status: "rejected", decided_at: "2026-11-25T14:30:00.000000" });
    const calls = stubFetch({
      [LIST]: (req) => (new URL(req.url).searchParams.get("status") === "rejected" ? listOf([rejected]) : listOf([PENDING])),
    });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    await screen.findByRole("table", { name: "Pending account name reviews" });
    await user.selectOptions(screen.getByLabelText("Status"), "rejected");
    const table = await screen.findByRole("table", { name: "Rejected account name reviews" });
    const row = within(table).getByRole("row", { name: /Placeholder Tosin/ });
    expect(row).toHaveTextContent("Rejected");
    expect(row).toHaveTextContent("25 Nov 2026"); // decided_at
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    expect(calls.at(-1)?.search).toContain("status=rejected");
  });

  it("pages through a long queue with offset", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [LIST]: () => jsonResponse({ items: [PENDING], total: 120 }),
    });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    await screen.findByRole("row", { name: /Placeholder Tosin/ });
    expect(screen.getByText("1–50 of 120")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(calls.at(-1)?.search).toContain("offset=50"));
  });

  it("shows an empty state when nothing is held", async () => {
    stubFetch({ [LIST]: () => listOf([]) });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    expect(await screen.findByText("No accounts are waiting for review")).toBeInTheDocument();
  });

  it("shows an error when the queue cannot load", async () => {
    stubFetch({ [LIST]: () => jsonResponse({ detail: "Access denied. Missing permission: payments.read" }, { status: 403 }) });
    render(withAuth(FINANCE, <BankReviewsQueue />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied. Missing permission: payments.read");
  });
});
