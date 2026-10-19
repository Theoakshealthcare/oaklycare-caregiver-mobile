import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import { BATCH_ID, makeBatchDetail, makePayout } from "@/test/payout-fixtures";

import { BatchView } from "./batch-detail";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PATH = `/api/v1/admin/payouts/batches/${BATCH_ID}`;
const A = makePayout();
const B = makePayout({
  id: "93d04961-704d-4177-abfa-39f35a0b7b76",
  caregiver_id: "86f02657-cb3e-40b0-8870-a924cd8ff1d9",
  caregiver_name: "Placeholder Failing",
  amount_kobo: 3000000,
});
const C = makePayout({
  id: "3f98faae-3f42-479f-8cab-0e34f2a4d8dc",
  caregiver_id: "e951bd23-f92e-4e47-a449-a90f907e8ef3",
  caregiver_name: "Placeholder Cancelled",
  amount_kobo: 800000,
});
const SUPER = ["payments.read", "ledger.adjust"];
const FINANCE = ["payments.read"];

describe("BatchView", () => {
  it("shows the batch with its payouts, naira totals and per-status counts", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeBatchDetail([A, B, C])) });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    expect(await screen.findByRole("heading", { name: /Batch 2026-10-19/ })).toBeInTheDocument();
    expect(screen.getByText(/3 payouts · ₦50,000/)).toBeInTheDocument();
    expect(screen.getByText("3 pending approval")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Placeholder Failing/ })).toHaveTextContent("₦30,000");
    expect(screen.getByRole("row", { name: /Placeholder Failing/ })).toHaveTextContent("Placeholder Bank ******0011");
  });

  it("approves after re-reading the batch: the dialog shows the FRESH count and total, and sends the reason", async () => {
    const user = userEvent.setup();
    let gets = 0;
    const calls = stubFetch({
      [`GET ${PATH}`]: () => {
        gets += 1;
        // The page loads with 3 payouts; by the time the dialog opens one was cancelled elsewhere.
        return jsonResponse(
          gets === 1
            ? makeBatchDetail([A, B, C])
            : gets === 2
              ? makeBatchDetail([A, B, { ...C, status: "cancelled" }])
              : makeBatchDetail([A, B], { status: "approved", approval_reason: "Totals checked" }),
        );
      },
      [`POST ${PATH}/approve`]: () => jsonResponse(makeBatchDetail([A, B], { status: "approved" })),
    });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    await user.click(await screen.findByRole("button", { name: "Approve batch" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Approve ₦42,000 to 2 caregivers?")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Approving 2 payouts totalling ₦42,000");
    await user.type(within(dialog).getByLabelText(/Reason for approving/), "Totals checked");
    await user.click(within(dialog).getByRole("button", { name: "Approve and send" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.filter((c) => c.key === `POST ${PATH}/approve`)).toEqual([
      { key: `POST ${PATH}/approve`, search: "", body: { reason: "Totals checked" } },
    ]);
    expect(await screen.findByRole("status")).toHaveTextContent("Batch approved");
  });

  it("keeps approve disabled until the fresh read arrives", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    let gets = 0;
    globalThis.fetch = (async (input: Request) => {
      if (input.method === "GET") {
        gets += 1;
        if (gets > 1) await new Promise<void>((r) => (release = r));
        return jsonResponse(makeBatchDetail([A, B]));
      }
      throw new Error("unexpected");
    }) as typeof fetch;
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    await user.click(await screen.findByRole("button", { name: "Approve batch" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Checking the batch's current totals");
    await user.type(within(dialog).getByLabelText(/Reason for approving/), "x");
    expect(within(dialog).getByRole("button", { name: "Approve and send" })).toBeDisabled();
    release?.();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Approve and send" })).toBeEnabled());
  });

  it("will not approve a batch that is no longer waiting when re-read", async () => {
    const user = userEvent.setup();
    let gets = 0;
    stubFetch({
      [`GET ${PATH}`]: () => {
        gets += 1;
        return jsonResponse(gets === 1 ? makeBatchDetail([A, B]) : makeBatchDetail([A, B], { status: "approved" }));
      },
    });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    await user.click(await screen.findByRole("button", { name: "Approve batch" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/there is nothing to approve/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason for approving/), "x");
    expect(within(dialog).getByRole("button", { name: "Approve and send" })).toBeDisabled();
  });

  it("shows the server's refusal verbatim and keeps the dialog open", async () => {
    const user = userEvent.setup();
    stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeBatchDetail([A, B])),
      [`POST ${PATH}/approve`]: () => jsonResponse({ detail: "This batch is already approved" }, { status: 409 }),
    });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    await user.click(await screen.findByRole("button", { name: "Approve batch" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Approve ₦42,000 to 2 caregivers?");
    await user.type(await within(dialog).findByLabelText(/Reason for approving/), "ok");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Approve and send" })).toBeEnabled());
    await user.click(within(dialog).getByRole("button", { name: "Approve and send" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This batch is already approved");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sends the approval once even when the confirm button is hit twice", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeBatchDetail([A, B])),
      [`POST ${PATH}/approve`]: () => jsonResponse(makeBatchDetail([A, B], { status: "approved" })),
    });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    await user.click(await screen.findByRole("button", { name: "Approve batch" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(await within(dialog).findByLabelText(/Reason for approving/), "ok");
    const confirm = within(dialog).getByRole("button", { name: "Approve and send" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.dblClick(confirm);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.filter((c) => c.key === `POST ${PATH}/approve`)).toHaveLength(1);
  });

  it("cancels the whole batch with a reason after naming how many payouts and how much", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeBatchDetail([A, B])),
      [`POST ${PATH}/cancel`]: () => jsonResponse(makeBatchDetail([A, B], { status: "cancelled" })),
    });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    await user.click(await screen.findByRole("button", { name: "Cancel batch" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Cancels all 2 payouts still waiting (₦42,000)");
    await user.type(within(dialog).getByLabelText(/Reason for cancelling/), "Totals are wrong");
    await user.click(within(dialog).getByRole("button", { name: "Cancel batch" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.find((c) => c.key === `POST ${PATH}/cancel`)?.body).toEqual({ reason: "Totals are wrong" });
  });

  it("shows the server's refusal when cancelling an approved batch", async () => {
    const user = userEvent.setup();
    stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeBatchDetail([A, B])),
      [`POST ${PATH}/cancel`]: () => jsonResponse({ detail: "This batch is already approved" }, { status: 409 }),
    });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    await user.click(await screen.findByRole("button", { name: "Cancel batch" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Reason for cancelling/), "x");
    await user.click(within(dialog).getByRole("button", { name: "Cancel batch" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This batch is already approved");
  });

  it("hides every money action from an admin without ledger.adjust (Finance can read only)", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeBatchDetail([A, B])) });
    render(withAuth(FINANCE, <BatchView id={BATCH_ID} />));
    await screen.findByRole("heading", { name: /Batch 2026-10-19/ });
    expect(screen.queryByRole("button", { name: /Approve batch|Cancel batch/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cancel/ })).not.toBeInTheDocument();
  });

  it("offers no batch actions once the batch is approved", async () => {
    stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeBatchDetail([{ ...A, status: "processing" }], { status: "approved", approval_reason: "Totals checked" })),
    });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    await screen.findByRole("heading", { name: /Batch 2026-10-19/ });
    expect(screen.getByText("Approved: Totals checked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve batch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel batch" })).not.toBeInTheDocument();
  });

  it("shows a load error with the server's message", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse({ detail: "Payout batch not found" }, { status: 404 }) });
    render(withAuth(SUPER, <BatchView id={BATCH_ID} />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Payout batch not found");
  });
});
