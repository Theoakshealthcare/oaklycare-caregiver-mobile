import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import {
  CASE_CHANGED_BODY,
  IDENTITY_DUPLICATE,
  IDENTITY_EXHAUSTED,
  IDENTITY_FAILED,
  IDENTITY_PASSED,
  NEEDS_REVIEW_ID,
  RESET_NOT_ALLOWED_BODY,
  detailWith,
} from "@/test/identity-fixtures";

import { ApplicationDetailView } from "./detail";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const GET = `GET /api/v1/admin/caregivers/${NEEDS_REVIEW_ID}`;
const DECISION = `POST /api/v1/admin/caregivers/${NEEDS_REVIEW_ID}/identity-decision`;
const RESET = `POST /api/v1/admin/caregivers/${NEEDS_REVIEW_ID}/identity-reset`;
const VERIFICATION = ["caregivers.read", "caregivers.approve"];
const READER = ["caregivers.read"];

// Capture 602-d / 602-f / 603-f response bodies.
const DECIDED = (status: string) => ({
  id: NEEDS_REVIEW_ID,
  profile_status: "under_review",
  identity_verification_status: status,
  background_check_status: "pending",
  auto_suspended: false,
  affected_bookings: [],
});
const RESET_DONE = {
  id: NEEDS_REVIEW_ID,
  profile_status: "under_review",
  identity_verification_status: "pending",
  background_check_status: "pending",
  attempts_used: 0,
  attempts_max: 3,
};

const identityCard = () => screen.findByTestId("identity-card");
const dialog = () => screen.findByRole("dialog");
const getCalls = (calls: { key: string }[]) => calls.filter((c) => c.key === GET).length;

async function openDialog(user: ReturnType<typeof userEvent.setup>, button: string) {
  await user.click(within(await identityCard()).getByRole("button", { name: button }));
  return dialog();
}

async function confirm(user: ReturnType<typeof userEvent.setup>, dlg: HTMLElement, button: string, notes = "Placeholder: checked on the provider dashboard.") {
  await user.type(within(dlg).getByLabelText(/^Notes/), notes);
  await user.click(within(dlg).getByRole("button", { name: button }));
}

describe("ApplicationDetailView: identity card", () => {
  it("renders the identity block from the detail response", async () => {
    stubFetch({ [GET]: () => jsonResponse(detailWith(IDENTITY_DUPLICATE)) });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const card = await identityCard();
    expect(card).toHaveTextContent("Needs review");
    expect(within(card).getByTestId("review-reason")).toHaveTextContent("already passed for another account");
    expect(within(card).getByRole("link", { name: "Open that caregiver" })).toBeInTheDocument();
  });

  it("verifies with notes and the status the admin was looking at (expected_status)", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [GET]: () => jsonResponse(detailWith(IDENTITY_DUPLICATE)),
      [DECISION]: () => jsonResponse(DECIDED("verified")),
    });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const dlg = await openDialog(user, "Mark verified");
    expect(dlg).toHaveTextContent("Another account already passed with this ID number");
    await confirm(user, dlg, "Mark verified");

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Identity marked verified."));
    expect(calls.find((c) => c.key === DECISION)?.body).toEqual({
      decision: "verified",
      notes: "Placeholder: checked on the provider dashboard.",
      expected_status: "needs_review",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(getCalls(calls)).toBe(2));
  });

  it("asks for a confirmation with required notes before failing, and sends nothing until then", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [GET]: () => jsonResponse(detailWith(IDENTITY_DUPLICATE)),
      [DECISION]: () => jsonResponse(DECIDED("failed")),
    });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const dlg = await openDialog(user, "Mark failed");
    expect(dlg).toHaveTextContent("Records a failed identity check");
    const submit = within(dlg).getByRole("button", { name: "Mark failed" });
    expect(submit).toBeDisabled();
    expect(calls.some((c) => c.key === DECISION)).toBe(false);

    await confirm(user, dlg, "Mark failed", "Placeholder: same person, second account.");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Identity marked failed."));
    expect(calls.find((c) => c.key === DECISION)?.body).toMatchObject({ decision: "failed", expected_status: "needs_review" });
  });

  it("warns that failing an approved caregiver suspends them", async () => {
    const user = userEvent.setup();
    stubFetch({ [GET]: () => jsonResponse(detailWith(IDENTITY_PASSED, { profile_status: "approved" })) });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const dlg = await openDialog(user, "Mark failed");
    expect(dlg).toHaveTextContent("suspends them immediately");
  });

  it("on IDENTITY_CASE_CHANGED: closes the dialog, reloads, and shows the server's words (no blind retry)", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [GET]: () => jsonResponse(detailWith(IDENTITY_DUPLICATE)),
      [DECISION]: () => jsonResponse(CASE_CHANGED_BODY, { status: 409 }),
    });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const dlg = await openDialog(user, "Mark verified");
    await confirm(user, dlg, "Mark verified");

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("The identity case changed since you opened it. Reload and decide again");
    expect(notice).toHaveTextContent("Identity is now needs_review");
    expect(notice).toHaveTextContent("The page was reloaded.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(getCalls(calls)).toBe(2));
    expect(calls.filter((c) => c.key === DECISION)).toHaveLength(1);
  });

  it("keeps the dialog open with the message on any other refusal (403)", async () => {
    const user = userEvent.setup();
    stubFetch({
      [GET]: () => jsonResponse(detailWith(IDENTITY_DUPLICATE)),
      [DECISION]: () => jsonResponse({ detail: "Access denied. Missing permission: caregivers.approve" }, { status: 403 }),
    });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const dlg = await openDialog(user, "Mark verified");
    await confirm(user, dlg, "Mark verified");
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("Access denied. Missing permission: caregivers.approve");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("allows another attempt after a confirmation with notes, and says what happened", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [GET]: () => jsonResponse(detailWith(IDENTITY_EXHAUSTED)),
      [RESET]: () => jsonResponse(RESET_DONE),
    });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const dlg = await openDialog(user, "Allow another attempt");
    expect(dlg).toHaveTextContent("fresh set of 3 attempts");
    expect(dlg).toHaveTextContent("Nobody is told");
    expect(within(dlg).getByRole("button", { name: "Allow another attempt" })).toBeDisabled();
    expect(calls.some((c) => c.key === RESET)).toBe(false);

    await confirm(user, dlg, "Allow another attempt", "Placeholder: photos were dark, allow another go.");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Another attempt allowed."));
    expect(calls.find((c) => c.key === RESET)?.body).toEqual({ notes: "Placeholder: photos were dark, allow another go." });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(getCalls(calls)).toBe(2));
  });

  it("offers a reset for a failed caregiver too", async () => {
    stubFetch({ [GET]: () => jsonResponse(detailWith(IDENTITY_FAILED)) });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    expect(await within(await identityCard()).findByRole("button", { name: "Allow another attempt" })).toBeInTheDocument();
  });

  it("on IDENTITY_RESET_NOT_ALLOWED: closes the dialog, reloads and shows the server's words", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [GET]: () => jsonResponse(detailWith(IDENTITY_EXHAUSTED)),
      [RESET]: () => jsonResponse(RESET_NOT_ALLOWED_BODY, { status: 409 }),
    });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const dlg = await openDialog(user, "Allow another attempt");
    await confirm(user, dlg, "Allow another attempt");

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Identity can only be reset when it has failed or its attempts ran out");
    expect(notice).toHaveTextContent("Identity is verified");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(getCalls(calls)).toBe(2));
  });

  it("does not offer a reset when the server says the caregiver cannot be reset", async () => {
    stubFetch({ [GET]: () => jsonResponse(detailWith(IDENTITY_DUPLICATE)) });
    render(withAuth(VERIFICATION, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    await identityCard();
    expect(screen.queryByRole("button", { name: "Allow another attempt" })).not.toBeInTheDocument();
  });

  it("gives a reader (caregivers.read only) the evidence but no way to decide or reset", async () => {
    stubFetch({ [GET]: () => jsonResponse(detailWith(IDENTITY_EXHAUSTED)) });
    render(withAuth(READER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const card = await identityCard();
    expect(within(card).getAllByText(/^Attempt \d$/)).toHaveLength(3);
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });
});
