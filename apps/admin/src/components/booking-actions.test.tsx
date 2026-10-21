import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingActions } from "@/components/booking-actions";
import type { BookingAction, BookingDetail } from "@/lib/bookings";
import {
  BOOKING_ID,
  CANDIDATES,
  CAREGIVER_ONE,
  CAREGIVER_TWO,
  POLICY,
  makeActionResult,
  makeDetail,
} from "@/test/booking-fixtures";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";

const BASE = `/api/v1/admin/bookings/${BOOKING_ID}`;
const POLICY_PATH = "/api/v1/admin/booking-policy";

function renderActions(booking: BookingDetail, onDone = vi.fn()) {
  render(withAuth([], <BookingActions booking={booking} onDone={onDone} />));
  return onDone;
}

function withActions(actions: BookingAction[], overrides: Partial<BookingDetail> = {}) {
  return makeDetail({ available_actions: actions, ...overrides });
}

async function dialogOf(user: ReturnType<typeof userEvent.setup>, button: string) {
  await user.click(screen.getByRole("button", { name: button }));
  return screen.findByRole("dialog");
}

async function typeReason(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, text = "Because") {
  await user.type(within(dialog).getByRole("textbox", { name: /^Reason/ }), text);
}

const ACCEPTED = {
  status: "accepted" as const,
  caregiver: { id: CAREGIVER_ONE, full_name: "Placeholder Nurse One", phone: "+2340000000001", masked: false },
  dispatch: { state: "matched" as const, started_at: null, waves: [], offers: [] },
};

afterEach(() => {
  vi.useRealTimers();
});

describe("BookingActions: which buttons", () => {
  it("renders nothing for no available actions", () => {
    renderActions(withActions([]));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders exactly the buttons for the listed actions", () => {
    renderActions(withActions(["cancel", "confirm_address"]));
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Cancel booking", "Confirm address"]);
  });

  it("has a button for each of the seven actions and none for force_assign", () => {
    renderActions(
      withActions(["redispatch", "assign", "force_assign", "reassign", "cancel", "confirm_address", "flag_no_show", "correct_status"]),
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Re-dispatch",
      "Assign caregiver",
      "Reassign",
      "Cancel booking",
      "Confirm address",
      "Flag no-show",
      "Correct status",
    ]);
  });
});

describe("Re-dispatch", () => {
  it("posts the reason, radius and the include flag, then reports who was offered", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [`POST ${BASE}/redispatch`]: () => jsonResponse(makeActionResult({ notified_caregivers: 2 })) });
    const onDone = renderActions(withActions(["redispatch"]));
    const dialog = await dialogOf(user, "Re-dispatch");
    expect(dialog).toHaveTextContent("Starts a new dispatch wave for this paid booking. Caregivers get a push and must accept in the app.");
    await user.type(within(dialog).getByLabelText("Search radius (km)"), "20");
    await user.click(within(dialog).getByLabelText(/Also offer it to caregivers an earlier wave/));
    await typeReason(user, dialog, "Nobody answered");
    await user.click(within(dialog).getByRole("button", { name: "Re-dispatch" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Offered to 2 caregivers."));
    expect(calls.filter((c) => c.key.startsWith("POST"))).toEqual([
      {
        key: `POST ${BASE}/redispatch`,
        search: "",
        body: { reason: "Nobody answered", radius_km: 20, include_previously_notified: true },
      },
    ]);
  });

  it("omits the radius when empty and says no one was available for 0 notified", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`POST ${BASE}/redispatch`]: () => jsonResponse(makeActionResult({ notified_caregivers: 0, dispatch_state: "unmatched" })),
    });
    const onDone = renderActions(withActions(["redispatch"]));
    const dialog = await dialogOf(user, "Re-dispatch");
    await typeReason(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Re-dispatch" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onDone.mock.calls[0]?.[0]).toMatch(/^No one available: nobody eligible was found/);
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({ reason: "Because", include_previously_notified: false });
  });

  it("disables confirm for a radius outside 1 to 100", async () => {
    const user = userEvent.setup();
    stubFetch({});
    renderActions(withActions(["redispatch"]));
    const dialog = await dialogOf(user, "Re-dispatch");
    await typeReason(user, dialog);
    const confirm = within(dialog).getByRole("button", { name: "Re-dispatch" });
    expect(confirm).toBeEnabled();
    await user.type(within(dialog).getByLabelText("Search radius (km)"), "101");
    expect(confirm).toBeDisabled();
  });
});

describe("Assign", () => {
  const candidatesHandler = () => jsonResponse({ items: CANDIDATES });

  it("lists candidates with nothing preselected and offers to one, without force", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${BASE}/candidates`]: candidatesHandler,
      [`POST ${BASE}/assign`]: () => jsonResponse(makeActionResult({ notified_caregivers: 1 })),
    });
    const onDone = renderActions(withActions(["assign"]));
    const dialog = await dialogOf(user, "Assign caregiver");
    expect(dialog).toHaveTextContent("The visit is offered to this caregiver only; they get a push and must still accept in the app.");
    expect(dialog).toHaveTextContent("use Refresh to see their answer");
    const one = await within(dialog).findByRole("radio", { name: /Placeholder Nurse One.*0\.22 km.*ETA 5 min/ });
    expect(one).not.toBeChecked();
    expect(within(dialog).queryByLabelText(/Assign now, without waiting/)).not.toBeInTheDocument();
    await typeReason(user, dialog, "Closest");
    const confirm = within(dialog).getByRole("button", { name: "Offer to caregiver" });
    expect(confirm).toBeDisabled();
    await user.click(one);
    await user.click(confirm);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Offered to Placeholder Nurse One. Waiting for them to accept."));
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({ caregiver_id: CAREGIVER_ONE, reason: "Closest", force: false });
  });

  it("shows the force checkbox only with force_assign and sends force: true", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${BASE}/candidates`]: candidatesHandler,
      [`POST ${BASE}/assign`]: () => jsonResponse(makeActionResult({ status: "accepted", notified_caregivers: 0 })),
    });
    const onDone = renderActions(withActions(["assign", "force_assign"]));
    const dialog = await dialogOf(user, "Assign caregiver");
    await user.click(await within(dialog).findByRole("radio", { name: /Placeholder Nurse Two/ }));
    await user.click(within(dialog).getByLabelText("Assign now, without waiting for them to accept (Super Admin)"));
    expect(dialog).toHaveTextContent("a visit code is generated, every other open offer is closed and the caregiver is told");
    await typeReason(user, dialog, "Urgent");
    await user.click(within(dialog).getByRole("button", { name: "Assign now" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Assigned to Placeholder Nurse Two."));
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({ caregiver_id: CAREGIVER_TWO, reason: "Urgent", force: true });
  });

  it("passes the typed radius when searching", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [`GET ${BASE}/candidates`]: candidatesHandler });
    renderActions(withActions(["assign"]));
    const dialog = await dialogOf(user, "Assign caregiver");
    await within(dialog).findByRole("radio", { name: /Nurse One/ });
    await user.type(within(dialog).getByLabelText("Search radius (km)"), "30");
    await user.click(within(dialog).getByRole("button", { name: "Search" }));
    await waitFor(() => expect(calls.filter((c) => c.key === `GET ${BASE}/candidates`).map((c) => c.search)).toEqual(["", "?radius_km=30"]));
  });

  it("shows the empty and error states", async () => {
    const user = userEvent.setup();
    stubFetch({ [`GET ${BASE}/candidates`]: () => jsonResponse({ items: [] }) });
    renderActions(withActions(["assign"]));
    const dialog = await dialogOf(user, "Assign caregiver");
    expect(await within(dialog).findByText("No approved, available caregiver with a recent location is nearby. Widen the radius.")).toBeInTheDocument();
  });

  it("shows a failed candidate load", async () => {
    const user = userEvent.setup();
    stubFetch({ [`GET ${BASE}/candidates`]: () => jsonResponse({ detail: "Address is on hold" }, { status: 409 }) });
    renderActions(withActions(["assign"]));
    const dialog = await dialogOf(user, "Assign caregiver");
    expect(await within(dialog).findByText(/We couldn't load caregivers/)).toBeInTheDocument();
  });

  it("shows a 409 verbatim, keeps the dialog open and does not report success", async () => {
    const user = userEvent.setup();
    stubFetch({
      [`GET ${BASE}/candidates`]: candidatesHandler,
      [`POST ${BASE}/assign`]: () =>
        jsonResponse({ detail: "Only a pending booking without a caregiver can be offered" }, { status: 409 }),
    });
    const onDone = renderActions(withActions(["assign"]));
    const dialog = await dialogOf(user, "Assign caregiver");
    await user.click(await within(dialog).findByRole("radio", { name: /Nurse One/ }));
    await typeReason(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Offer to caregiver" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Only a pending booking without a caregiver can be offered");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("shows the force-as-ops 403 verbatim", async () => {
    const user = userEvent.setup();
    stubFetch({
      [`GET ${BASE}/candidates`]: candidatesHandler,
      [`POST ${BASE}/assign`]: () => jsonResponse({ detail: "Only a Super Admin can force an assignment" }, { status: 403 }),
    });
    renderActions(withActions(["assign", "force_assign"]));
    const dialog = await dialogOf(user, "Assign caregiver");
    await user.click(await within(dialog).findByRole("radio", { name: /Nurse One/ }));
    await user.click(within(dialog).getByLabelText(/Assign now, without waiting/));
    await typeReason(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Assign now" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Only a Super Admin can force an assignment");
  });
});

describe("Reassign", () => {
  it("excludes the current caregiver and posts the new one", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${BASE}/candidates`]: () => jsonResponse({ items: CANDIDATES }),
      [`POST ${BASE}/reassign`]: () => jsonResponse(makeActionResult({ status: "accepted", notified_caregivers: 0 })),
    });
    const onDone = renderActions(withActions(["reassign"], ACCEPTED));
    const dialog = await dialogOf(user, "Reassign");
    expect(dialog).toHaveTextContent(
      "The new caregiver is assigned directly and told; Placeholder Nurse One is told the visit was reassigned. The status goes back to accepted, any no-show flag is cleared, and the patient's visit code stays the same.",
    );
    const two = await within(dialog).findByRole("radio", { name: /Placeholder Nurse Two/ });
    expect(within(dialog).queryByRole("radio", { name: /Placeholder Nurse One/ })).not.toBeInTheDocument();
    await user.click(two);
    await typeReason(user, dialog, "Late");
    await user.click(within(dialog).getByRole("button", { name: "Reassign" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls.find((c) => c.key.startsWith("POST"))).toEqual({
      key: `POST ${BASE}/reassign`,
      search: "",
      body: { caregiver_id: CAREGIVER_TWO, reason: "Late" },
    });
  });
});

describe("Cancel", () => {
  const policyHandler = () => jsonResponse(POLICY);

  it("preselects nothing and sends a full refund with the reason code", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${POLICY_PATH}`]: policyHandler,
      [`POST ${BASE}/cancel`]: () =>
        jsonResponse(makeActionResult({ status: "cancelled", refund_required: true, refund_amount_kobo: 5500000 })),
    });
    const onDone = renderActions(withActions(["cancel"]));
    const dialog = await dialogOf(user, "Cancel booking");
    expect(dialog).toHaveTextContent("Cancelling can't be undone. It does not refund anyone");
    for (const r of within(dialog).getAllByRole("radio")) expect(r).not.toBeChecked();
    expect(within(dialog).getByLabelText("Reason code")).toHaveValue("");
    await typeReason(user, dialog, "Patient called");
    const confirm = within(dialog).getByRole("button", { name: "Cancel booking" });
    expect(confirm).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("Reason code"), "patient_request");
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: /Full refund/ }));
    await user.click(confirm);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Booking cancelled. Refund requested: ₦55,000."));
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({
      reason_code: "patient_request",
      reason: "Patient called",
      refund: "full",
    });
  });

  it("offers only No refund for an unpaid booking and warns the patient is not messaged", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${POLICY_PATH}`]: policyHandler,
      [`POST ${BASE}/cancel`]: () => jsonResponse(makeActionResult({ status: "cancelled", payment_status: "pending" })),
    });
    const onDone = renderActions(
      withActions(["cancel"], { payment: { ...makeDetail().payment, status: "pending" } }),
    );
    const dialog = await dialogOf(user, "Cancel booking");
    expect(within(dialog).getAllByRole("radio")).toHaveLength(1);
    expect(within(dialog).getByText("Not paid, so there is nothing to refund.")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Policy guide/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("radio", { name: "No refund" }));
    expect(dialog).toHaveTextContent("The patient is not sent any cancellation message when there is no refund. Contact them yourself.");
    await user.selectOptions(within(dialog).getByLabelText("Reason code"), "duplicate");
    await typeReason(user, dialog, "Dup");
    await user.click(within(dialog).getByRole("button", { name: "Cancel booking" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Booking cancelled. No refund."));
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({ reason_code: "duplicate", reason: "Dup", refund: "none" });
  });

  it("validates a partial amount: positive and below the total", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${POLICY_PATH}`]: policyHandler,
      [`POST ${BASE}/cancel`]: () => jsonResponse(makeActionResult({ status: "cancelled", refund_required: true })),
    });
    const onDone = renderActions(withActions(["cancel"]));
    const dialog = await dialogOf(user, "Cancel booking");
    await user.selectOptions(within(dialog).getByLabelText("Reason code"), "other");
    await typeReason(user, dialog);
    await user.click(within(dialog).getByRole("radio", { name: "Partial refund" }));
    const confirm = within(dialog).getByRole("button", { name: "Cancel booking" });
    const amount = within(dialog).getByLabelText("Refund amount (₦)");
    expect(confirm).toBeDisabled();
    await user.type(amount, "0");
    expect(confirm).toBeDisabled();
    expect(dialog).toHaveTextContent("Enter an amount above ₦0 and below the ₦55,000 paid.");
    await user.clear(amount);
    await user.type(amount, "55000");
    expect(confirm).toBeDisabled();
    await user.clear(amount);
    await user.type(amount, "12,500.50");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Booking cancelled. Refund requested: ₦12,500.50."));
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({
      reason_code: "other",
      reason: "Because",
      refund: "partial",
      refund_amount_kobo: 1250050,
    });
  });

  it("shows the policy guide for an accepted booking 11 hours before the visit and uses its amount", async () => {
    // Visit at 2026-10-08T01:38:05Z; now is 11 hours before: inside the 12 h free window, so the standard tier (20%).
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T14:38:05Z"));
    const user = userEvent.setup();
    stubFetch({ [`GET ${POLICY_PATH}`]: policyHandler });
    renderActions(withActions(["cancel"], ACCEPTED));
    const dialog = await dialogOf(user, "Cancel booking");
    expect(await within(dialog).findByText(/Policy guide \(estimate\)/)).toHaveTextContent(
      "Policy guide (estimate): Standard fee — fee 20% of the service fee = ₦10,000; the family would get ₦45,000 back.",
    );
    expect(dialog).toHaveTextContent("Based on the current policy; this booking may have been quoted different terms.");
    expect(dialog).not.toHaveTextContent("on-my-way");
    await user.click(within(dialog).getByRole("button", { name: "Use this amount" }));
    expect(within(dialog).getByRole("radio", { name: "Partial refund" })).toBeChecked();
    expect(within(dialog).getByLabelText("Refund amount (₦)")).toHaveValue("45000");
  });

  it("selects Full when the guide refunds everything", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
    const user = userEvent.setup();
    stubFetch({ [`GET ${POLICY_PATH}`]: policyHandler });
    renderActions(withActions(["cancel"], ACCEPTED));
    const dialog = await dialogOf(user, "Cancel booking");
    expect(await within(dialog).findByText(/Policy guide/)).toHaveTextContent("Free cancellation — fee 0% of the service fee = ₦0; the family would get ₦55,000 back.");
    await user.click(within(dialog).getByRole("button", { name: "Use this amount" }));
    expect(within(dialog).getByRole("radio", { name: /Full refund/ })).toBeChecked();
  });

  it("adds the on-my-way caveat for an en-route booking", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T20:00:00Z"));
    const user = userEvent.setup();
    stubFetch({ [`GET ${POLICY_PATH}`]: policyHandler });
    renderActions(withActions(["cancel"], { ...ACCEPTED, status: "en_route" }));
    const dialog = await dialogOf(user, "Cancel booking");
    expect(await within(dialog).findByText(/Policy guide/)).toHaveTextContent("Late fee — fee 50%");
    expect(dialog).toHaveTextContent("Only if the caregiver's on-my-way tap qualifies; otherwise the standard tier applies.");
  });

  it("carries on when the policy can't be loaded", async () => {
    const user = userEvent.setup();
    stubFetch({ [`GET ${POLICY_PATH}`]: () => jsonResponse({ detail: "boom" }, { status: 500 }) });
    renderActions(withActions(["cancel"]));
    const dialog = await dialogOf(user, "Cancel booking");
    expect(await within(dialog).findByText("Couldn't load the cancellation policy")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /Full refund/ })).toBeEnabled();
  });

  it("shows the server's 422 for a partial refund with no amount verbatim", async () => {
    const user = userEvent.setup();
    stubFetch({
      [`GET ${POLICY_PATH}`]: policyHandler,
      [`POST ${BASE}/cancel`]: () =>
        jsonResponse(
          { detail: [{ type: "value_error", loc: ["body"], msg: "Value error, refund_amount_kobo is required for a partial refund" }] },
          { status: 422 },
        ),
    });
    renderActions(withActions(["cancel"]));
    const dialog = await dialogOf(user, "Cancel booking");
    await user.selectOptions(within(dialog).getByLabelText("Reason code"), "other");
    await user.click(within(dialog).getByRole("radio", { name: /Full refund/ }));
    await typeReason(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Cancel booking" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("refund_amount_kobo is required for a partial refund");
  });
});

describe("Confirm address", () => {
  const held = () =>
    withActions(["confirm_address"], {
      address: { ...makeDetail().address, needs_address_check: true, line: "Old line" },
    });

  it("prefills the street address and posts coordinates", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [`POST ${BASE}/confirm-address`]: () => jsonResponse(makeActionResult({ notified_caregivers: 2 })) });
    const onDone = renderActions(held());
    const dialog = await dialogOf(user, "Confirm address");
    expect(dialog).toHaveTextContent("Clears the hold, saves the coordinates and starts dispatch immediately");
    expect(within(dialog).getByLabelText("Street address")).toHaveValue("Old line");
    await user.type(within(dialog).getByLabelText("Latitude"), "6.5");
    await user.type(within(dialog).getByLabelText("Longitude"), "3.4");
    await typeReason(user, dialog, "Called the booker");
    await user.click(within(dialog).getByRole("button", { name: "Confirm address" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Address confirmed. Offered to 2 caregivers."));
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({
      reason: "Called the booker",
      latitude: 6.5,
      longitude: 3.4,
      address: "Old line",
    });
  });

  it("omits a blank street address", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [`POST ${BASE}/confirm-address`]: () => jsonResponse(makeActionResult({ notified_caregivers: 0 })) });
    const onDone = renderActions(held());
    const dialog = await dialogOf(user, "Confirm address");
    await user.clear(within(dialog).getByLabelText("Street address"));
    await user.type(within(dialog).getByLabelText("Latitude"), "6.5");
    await user.type(within(dialog).getByLabelText("Longitude"), "3.4");
    await typeReason(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Confirm address" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("Address confirmed."));
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({ reason: "Because", latitude: 6.5, longitude: 3.4 });
  });

  it("blocks a swapped pair with a hint", async () => {
    const user = userEvent.setup();
    stubFetch({});
    renderActions(held());
    const dialog = await dialogOf(user, "Confirm address");
    await user.type(within(dialog).getByLabelText("Latitude"), "3.4");
    await user.type(within(dialog).getByLabelText("Longitude"), "51.5");
    await typeReason(user, dialog);
    expect(within(dialog).getByRole("button", { name: "Confirm address" })).toBeDisabled();
    expect(dialog).toHaveTextContent("Outside Nigeria. Check the latitude and longitude are not swapped.");
  });

  it("says dispatch waits for payment on an unpaid booking", async () => {
    const user = userEvent.setup();
    stubFetch({});
    renderActions({ ...held(), payment: { ...makeDetail().payment, status: "pending" } });
    const dialog = await dialogOf(user, "Confirm address");
    expect(dialog).toHaveTextContent("Dispatch starts once the booking is paid.");
  });
});

describe("Flag no-show", () => {
  it("posts the reason and tells the admin what to do next", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [`POST ${BASE}/no-show`]: () => jsonResponse(makeActionResult({ status: "accepted" })) });
    const onDone = renderActions(withActions(["flag_no_show"], ACCEPTED));
    const dialog = await dialogOf(user, "Flag no-show");
    expect(dialog).toHaveTextContent("It does not cancel or reassign the booking: do that next.");
    await typeReason(user, dialog, "Not there");
    await user.click(within(dialog).getByRole("button", { name: "Flag no-show" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls.find((c) => c.key.startsWith("POST"))).toEqual({ key: `POST ${BASE}/no-show`, search: "", body: { reason: "Not there" } });
  });
});

describe("Correct status", () => {
  it("offers the forward targets for an accepted booking, nothing preselected", async () => {
    const user = userEvent.setup();
    stubFetch({});
    renderActions(withActions(["correct_status"], ACCEPTED));
    const dialog = await dialogOf(user, "Correct status");
    const select = within(dialog).getByLabelText("New status");
    expect(select).toHaveValue("");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a status", "En route", "In progress", "Completed"]);
  });

  it("offers only completed for an in-progress booking and adds the earning line", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [`POST ${BASE}/correct-status`]: () => jsonResponse(makeActionResult({ status: "completed" })) });
    const onDone = renderActions(withActions(["correct_status"], { ...ACCEPTED, status: "in_progress" }));
    const dialog = await dialogOf(user, "Correct status");
    const select = within(dialog).getByLabelText("New status");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a status", "Completed"]);
    const confirm = within(dialog).getByRole("button", { name: "Correct status" });
    await typeReason(user, dialog, "Forgot to check out");
    expect(confirm).toBeDisabled();
    await user.selectOptions(select, "completed");
    expect(dialog).toHaveTextContent("Moves the booking forward to completed and sets the same start/end times the caregiver's app would. Corrections only move forward and can't be undone.");
    expect(dialog).toHaveTextContent("Completing credits the caregiver's earning for this visit.");
    await user.click(confirm);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({ status: "completed", reason: "Forgot to check out" });
  });

  it("does not mention earnings for en route and shows the 403 verbatim", async () => {
    const user = userEvent.setup();
    stubFetch({
      [`POST ${BASE}/correct-status`]: () =>
        jsonResponse({ detail: "Access denied. Missing permission: bookings.correct_status" }, { status: 403 }),
    });
    renderActions(withActions(["correct_status"], ACCEPTED));
    const dialog = await dialogOf(user, "Correct status");
    await user.selectOptions(within(dialog).getByLabelText("New status"), "en_route");
    expect(dialog).not.toHaveTextContent("earning");
    await typeReason(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Correct status" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Access denied. Missing permission: bookings.correct_status");
  });
});

describe("BookingActions: a refetched detail that no longer offers the action", () => {
  it("closes the open dialog when its action is dropped", async () => {
    const user = userEvent.setup();
    stubFetch({ [`GET ${BASE}/candidates`]: () => jsonResponse({ items: CANDIDATES }) });
    const { rerender } = render(withAuth([], <BookingActions booking={withActions(["assign", "cancel"])} />));
    await dialogOf(user, "Assign caregiver");
    // Someone else assigned first: the refetched detail offers reassign and cancel only.
    rerender(withAuth([], <BookingActions booking={withActions(["reassign", "cancel"], ACCEPTED)} />));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Reassign" })).toBeInTheDocument();
  });

  it("never sends force: true once force_assign is withdrawn, even with the box ticked", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${BASE}/candidates`]: () => jsonResponse({ items: CANDIDATES }),
      [`POST ${BASE}/assign`]: () => jsonResponse(makeActionResult({ notified_caregivers: 1 })),
    });
    const { rerender } = render(withAuth([], <BookingActions booking={withActions(["assign", "force_assign"])} />));
    const dialog = await dialogOf(user, "Assign caregiver");
    await user.click(await within(dialog).findByRole("radio", { name: /Placeholder Nurse One/ }));
    await user.click(within(dialog).getByLabelText("Assign now, without waiting for them to accept (Super Admin)"));
    rerender(withAuth([], <BookingActions booking={withActions(["assign"])} />));
    const fresh = screen.getByRole("dialog");
    expect(within(fresh).queryByLabelText(/Assign now, without waiting/)).not.toBeInTheDocument();
    await typeReason(user, fresh, "Closest");
    await user.click(within(fresh).getByRole("button", { name: "Offer to caregiver" }));
    await waitFor(() => expect(calls.some((c) => c.key === `POST ${BASE}/assign`)).toBe(true));
    expect(calls.find((c) => c.key === `POST ${BASE}/assign`)?.body).toMatchObject({ force: false });
  });
});
