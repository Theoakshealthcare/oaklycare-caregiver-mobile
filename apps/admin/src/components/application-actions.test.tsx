import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationActions } from "@/components/application-actions";
import { ApiError } from "@/lib/api";
import * as caregivers from "@/lib/caregivers";
import type { ApplicationDetail, ProfileStatus } from "@/lib/caregivers";
import { withAuth } from "@/test/helpers";

vi.mock("@/lib/caregivers", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/caregivers")>();
  return {
    ...actual,
    approveCaregiver: vi.fn(),
    rejectCaregiver: vi.fn(),
    requestChanges: vi.fn(),
    suspendCaregiver: vi.fn(),
    reinstateCaregiver: vi.fn(),
  };
});

const DECIDER = ["caregivers.read", "caregivers.approve", "caregivers.suspend"];

function detail(status: ProfileStatus): ApplicationDetail {
  return {
    profile: {
      id: "cg-1",
      email: "nurse@example.test",
      full_name: "Ngozi Placeholder",
      phone_number: null,
      date_of_birth: null,
      gender: null,
      state: "Lagos",
      address: null,
      emergency_contact_phone: null,
      specialization: "nurse",
      years_of_experience: 4,
      preferred_work_hours: null,
      service_areas: null,
      profile_status: status,
      identity_verification_status: "pending",
      background_check_status: "pending",
      created_at: "2026-10-01T09:00:00",
    },
    consents: { terms_accepted: true, privacy_policy_accepted: true, background_check_consent: true, consent_date: null },
    documents: [],
    identity: { status: "pending", document_verification_result: null, face_verification_status: null, face_verification_result: null },
    background_check: { status: "pending", evidence: null, decided_by: null, decided_at: null },
    decision: { approved_by: null, approved_at: null, suspended_at: null, suspension_reason: null, rejection_reason: null, changes_requested: null },
    skills: [],
    audit_history: [],
  };
}

beforeEach(() => vi.resetAllMocks());

describe("approve", () => {
  it("renders every unmet requirement inline when the backend answers 409", async () => {
    vi.mocked(caregivers.approveCaregiver).mockRejectedValue(
      new ApiError("Cannot approve yet", 409, {
        detail: {
          message: "Cannot approve yet",
          unmet: [
            { code: "BACKGROUND_CHECK_NOT_CLEARED", message: "Background check has not been cleared" },
            { code: "NO_SKILLS", message: "At least one skill is required" },
          ],
        },
      }),
    );
    const user = userEvent.setup();
    render(withAuth(DECIDER, <ApplicationActions detail={detail("under_review")} />));

    await user.click(screen.getByRole("button", { name: "Approve" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Cannot approve yet");
    const items = within(alert).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Background check has not been cleared",
      "At least one skill is required",
    ]);
    // Still under review: the approve button stays available for the retry.
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("confirms success and clears an earlier unmet list", async () => {
    vi.mocked(caregivers.approveCaregiver)
      .mockRejectedValueOnce(
        new ApiError("x", 409, { detail: { message: "Cannot approve yet", unmet: [{ code: "NO_SKILLS", message: "At least one skill is required" }] } }),
      )
      .mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(withAuth(DECIDER, <ApplicationActions detail={detail("under_review")} />));
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await screen.findByText("At least one skill is required");
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("status")).toHaveTextContent("is approved");
    expect(screen.queryByText("At least one skill is required")).not.toBeInTheDocument();
  });

  it("shows a plain error for a non-unmet failure", async () => {
    vi.mocked(caregivers.approveCaregiver).mockRejectedValue(new ApiError("Caregiver not found", 404, { detail: "Caregiver not found" }));
    const user = userEvent.setup();
    render(withAuth(DECIDER, <ApplicationActions detail={detail("under_review")} />));
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Caregiver not found");
  });
});

describe("destructive actions need a reason", () => {
  it("reject: the confirm button stays disabled until a non-blank reason is typed, then sends it", async () => {
    vi.mocked(caregivers.rejectCaregiver).mockResolvedValue({});
    const user = userEvent.setup();
    render(withAuth(DECIDER, <ApplicationActions detail={detail("under_review")} />));

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Reject application" });
    // States the side effect before confirming.
    expect(dialog).toHaveTextContent("emails Ngozi Placeholder your reason");
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Reason for rejection"), "   ");
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Reason for rejection"), "Licence expired");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(caregivers.rejectCaregiver).toHaveBeenCalledWith("cg-1", "Licence expired"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("suspend: requires a reason, warns about bookings, and reports affected bookings", async () => {
    vi.mocked(caregivers.suspendCaregiver).mockResolvedValue({ affected_bookings: ["b1", "b2"] });
    const user = userEvent.setup();
    render(withAuth(DECIDER, <ApplicationActions detail={detail("approved")} />));
    await user.click(screen.getByRole("button", { name: "Suspend" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("upcoming accepted bookings are listed for reassignment");
    const confirm = within(dialog).getByRole("button", { name: "Suspend caregiver" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Reason for suspension"), "Complaint under review");
    await user.click(confirm);
    await waitFor(() => expect(caregivers.suspendCaregiver).toHaveBeenCalledWith("cg-1", "Complaint under review"));
    expect(await screen.findByRole("status")).toHaveTextContent("2 upcoming accepted bookings need reassignment");
  });

  it("request changes: needs at least one item and a note", async () => {
    vi.mocked(caregivers.requestChanges).mockResolvedValue({});
    const user = userEvent.setup();
    render(withAuth(DECIDER, <ApplicationActions detail={detail("under_review")} />));
    await user.click(screen.getByRole("button", { name: "Request changes" }));
    const dialog = await screen.findByRole("dialog");
    const send = within(dialog).getByRole("button", { name: "Send request" });
    await user.type(within(dialog).getByLabelText("Note to the caregiver"), "Please re-upload");
    expect(send).toBeDisabled(); // no items yet
    await user.type(within(dialog).getByLabelText(/What needs fixing/), "Licence photo is blurry{Enter}Address is incomplete");
    expect(send).toBeEnabled();
    await user.click(send);
    await waitFor(() =>
      expect(caregivers.requestChanges).toHaveBeenCalledWith("cg-1", ["Licence photo is blurry", "Address is incomplete"], "Please re-upload"),
    );
  });

  it("keeps the dialog open and shows the error when the request fails", async () => {
    vi.mocked(caregivers.rejectCaregiver).mockRejectedValue(new ApiError("Cannot reject from this state", 409, { detail: "Cannot reject from this state" }));
    const user = userEvent.setup();
    render(withAuth(DECIDER, <ApplicationActions detail={detail("under_review")} />));
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Reason for rejection"), "Because");
    await user.click(within(dialog).getByRole("button", { name: "Reject application" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Cannot reject from this state");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("state machine and permissions", () => {
  it("offers only the actions the backend allows for the status", () => {
    const { rerender } = render(withAuth(DECIDER, <ApplicationActions detail={detail("approved")} />));
    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();

    rerender(withAuth(DECIDER, <ApplicationActions detail={detail("suspended")} />));
    expect(screen.getByRole("button", { name: "Reinstate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("hides decisions from a read-only admin and says why", () => {
    render(withAuth(["caregivers.read"], <ApplicationActions detail={detail("under_review")} />));
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.getByText(/can't decide it/)).toBeInTheDocument();
  });

  it("lets Operations (suspend only) suspend but not approve", () => {
    render(withAuth(["caregivers.read", "caregivers.suspend"], <ApplicationActions detail={detail("approved")} />));
    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
    const { unmount } = render(withAuth(["caregivers.read", "caregivers.suspend"], <ApplicationActions detail={detail("under_review")} />));
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    unmount();
  });

  it("reinstate shows the unmet list when the checks no longer hold", async () => {
    vi.mocked(caregivers.reinstateCaregiver).mockRejectedValue(
      new ApiError("x", 409, { detail: { message: "Cannot reinstate", unmet: [{ code: "LICENSE_NOT_VERIFIED", message: "A verified licence is required" }] } }),
    );
    const user = userEvent.setup();
    render(withAuth(DECIDER, <ApplicationActions detail={detail("suspended")} />));
    await user.click(screen.getByRole("button", { name: "Reinstate" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reinstate caregiver" }));
    expect(await screen.findByText("A verified licence is required")).toBeInTheDocument();
  });
});
