import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  BOOKING_ID,
  CANCEL_TERMS_APPLIED,
  CANCEL_TERMS_UNPAID,
  CANDIDATES,
  CLINICAL_VISIBLE,
  DISPATCHING,
  HIDDEN_ADDRESS,
  MASKED_PATIENT,
  makeActionResult,
  makeDetail,
} from "@/test/booking-fixtures";
import { SHORT_VISIT } from "@/test/earning-fixtures";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";

import { BookingView } from "./booking-detail";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PATH = `/api/v1/admin/bookings/${BOOKING_ID}`;
const detailCalls = (calls: { key: string }[]) => calls.filter((c) => c.key === `GET ${PATH}`);

function card(name: string) {
  return within(screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement);
}

describe("BookingView", () => {
  it("shows the header and the ops view of every card", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail({ note_count: 3 })) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    const heading = await screen.findByRole("heading", { level: 1, name: /Booking 12FF3CB2/ });
    expect(heading).toHaveTextContent("Pending");
    expect(screen.getByRole("link", { name: /All bookings/ })).toHaveAttribute("href", "/bookings");
    expect(screen.getByText(/App · created 7 Oct 2026, 20:58 WAT · 40 min/)).toBeInTheDocument();

    expect(card("Visit").getByText("Placeholder assistance")).toBeInTheDocument();
    expect(card("Visit").getByText(/8 Oct 2026, 02:38 WAT to 8 Oct 2026, 04:38 WAT/)).toBeInTheDocument();
    expect(card("Visit").getByText("2 hours")).toBeInTheDocument();
    expect(card("Visit").getByText("3 visit notes (not shown here)")).toBeInTheDocument();
    expect(card("People").getByText(/Ada Okafor · \+2340000302011/)).toBeInTheDocument();
    expect(card("People").getByText("Not assigned yet")).toBeInTheDocument();
    expect(card("People").queryByText(/people.pii/)).not.toBeInTheDocument();
    expect(card("Address").getByText("12 Placeholder Street, Lekki")).toBeInTheDocument();
    expect(card("Address").getByText("6.4474, 3.4723")).toBeInTheDocument();
    expect(card("Price & payment").getByText("₦55,000")).toBeInTheDocument();
    expect(card("Price & payment").getByText("₦50,000")).toBeInTheDocument();
    expect(card("Price & payment").getByText("₦5,000")).toBeInTheDocument();
    expect(card("Price & payment").getByText("BKG_12FF3CB2_dddf1043")).toBeInTheDocument();
    expect(card("Dispatch").getByText("Unmatched")).toBeInTheDocument();
    expect(card("No-show").getByText(/No no-show/)).toBeInTheDocument();
  });

  it("shows the booking's cancel terms: tiers, the fee that applies now and where the terms come from", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail({ status: "accepted" })) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    const terms = card("Cancellation terms");
    expect(terms.getByText("The current booking policy (nothing is saved on this booking yet)")).toBeInTheDocument();
    expect(terms.getByText("More than 24 h before the visit")).toBeInTheDocument();
    expect(terms.getByText("25% of the service fee, from 24 h to 6 h before")).toBeInTheDocument();
    expect(terms.getByText("60% of the service fee, inside 6 h or once the caregiver is on the way")).toBeInTheDocument();
    expect(
      terms.getByText("Late fee, 60% of the service fee: the family pays ₦12,000 and is refunded ₦10,000."),
    ).toBeInTheDocument();
    expect(terms.queryByText("Applied")).not.toBeInTheDocument();
    expect(terms.getByText(/cancelling as an admin chooses its own refund/)).toBeInTheDocument();
  });

  it("shows what a booker cancel applied, from the terms saved on the booking", async () => {
    stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeDetail({ status: "cancelled", cancel_terms: CANCEL_TERMS_APPLIED })),
    });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    const terms = card("Cancellation terms");
    expect(terms.getByText("Saved on this booking")).toBeInTheDocument();
    expect(terms.getByText("Cancelled by the family under the standard fee: ₦5,000 kept.")).toBeInTheDocument();
    expect(terms.getByText("Not possible: the booking is closed.")).toBeInTheDocument();
  });

  it("says an unpaid booking has nothing to refund instead of showing a fee", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail({ cancel_terms: CANCEL_TERMS_UNPAID })) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(
      card("Cancellation terms").getByText("Not applicable: not paid yet, so the family cancels for free."),
    ).toBeInTheDocument();
  });

  it("hides the clinical text from an admin without clinical.read", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail()) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    const clinical = card("Clinical");
    expect(clinical.getByText("A condition was recorded.")).toBeInTheDocument();
    expect(clinical.getByText("Special instructions were recorded.")).toBeInTheDocument();
    expect(clinical.getByText(/They are hidden: reading them needs the clinical.read permission./)).toBeInTheDocument();
  });

  it("shows the clinical text and the audit note to a clinical reader", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail({ clinical: CLINICAL_VISIBLE })) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(card("Clinical").getByText(CLINICAL_VISIBLE.condition)).toBeInTheDocument();
    expect(card("Clinical").getByText(CLINICAL_VISIBLE.special_instructions)).toBeInTheDocument();
    expect(card("Clinical").getByText("Your view of this was recorded in the audit log.")).toBeInTheDocument();
  });

  it("shows Finance's view: area only and shortened names", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail({ address: HIDDEN_ADDRESS, patient: MASKED_PATIENT })) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(card("Address").getByText("Area only. The full address needs the bookings.address permission.")).toBeInTheDocument();
    expect(card("Address").queryByText(/Placeholder Street/)).not.toBeInTheDocument();
    expect(card("People").getByText(/Chidi E\. · \+234\*\*\*\*2013/)).toBeInTheDocument();
    expect(card("People").getByText("Names and phones are shortened: you need the people.pii permission.")).toBeInTheDocument();
  });

  it("warns about a held address", async () => {
    stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeDetail({ address: { ...makeDetail().address, needs_address_check: true } })),
    });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(card("Address").getByText(/Held: this WhatsApp booking's map pin is a city-centre placeholder/)).toBeInTheDocument();
  });

  it("shows a requested refund as requested, not refunded", async () => {
    const base = makeDetail().payment;
    stubFetch({
      [`GET ${PATH}`]: () =>
        jsonResponse(
          makeDetail({
            status: "cancelled",
            cancel_reason: "patient_request",
            payment: { ...base, refund_required: true, refund_required_reason: "admin_cancelled_full", refund_amount_kobo: 5500000 },
          }),
        ),
    });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(card("Price & payment").getByText(/Refund requested: ₦55,000 \(Admin cancelled full\)\. Not refunded yet: Finance's refund queue pays it\./)).toBeInTheDocument();
    expect(card("Visit").getByText("Patient request")).toBeInTheDocument();
  });

  it("says the refund amount is decided by the refund queue when it is null", async () => {
    const base = makeDetail().payment;
    stubFetch({
      [`GET ${PATH}`]: () =>
        jsonResponse(makeDetail({ payment: { ...base, refund_required: true, refund_required_reason: "paid_after_expiry" } })),
    });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(card("Price & payment").getByText(/amount decided by the refund queue/)).toBeInTheDocument();
  });

  it("shows waves and offers, with 'No answer yet' for an open offer", async () => {
    stubFetch({
      [`GET ${PATH}`]: () =>
        jsonResponse(
          makeDetail({
            dispatch: {
              ...DISPATCHING,
              offers: [
                DISPATCHING.offers[0]!,
                { ...DISPATCHING.offers[1]!, response: "auto_declined", response_at: "2026-10-07T20:40:00" },
              ],
            },
          }),
        ),
    });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    const dispatch = card("Dispatch");
    expect(dispatch.getByText("Dispatching")).toBeInTheDocument();
    expect(dispatch.getByText(/Wave 1 sent 7 Oct 2026, 21:38 WAT · 2 caregivers/)).toBeInTheDocument();
    expect(dispatch.getByRole("row", { name: /Placeholder Nurse One/ })).toHaveTextContent("No answer yet");
    expect(dispatch.getByRole("row", { name: /Placeholder Nurse Two/ })).toHaveTextContent("Auto declined");
  });

  it("shows a suspected no-show", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail({ status: "accepted", no_show_suspected: true })) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(card("No-show").getByText("Possible no-show: the caregiver has not started 15 minutes after the start time.")).toBeInTheDocument();
  });

  it("lists the timeline oldest first as returned", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail()) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    const items = card("Timeline").getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Dispatch started");
    expect(items[0]).toHaveTextContent("7 Oct 2026, 20:08 WAT");
    expect(items[1]).toHaveTextContent("Booking created via app");
  });

  it("shows the server's message for an unknown booking", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse({ detail: "Booking not found" }, { status: 404 }) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Booking not found");
  });

  it("fetches once, never on focus, and Refresh fetches again", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail()) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    await new Promise((r) => setTimeout(r, 50));
    expect(detailCalls(calls)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(detailCalls(calls)).toHaveLength(2));
  });

  it("shows only the listed action buttons", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail({ available_actions: ["cancel"] })) });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Re-dispatch" })).not.toBeInTheDocument();
  });

  it("shows the action's notice and refetches the detail after success", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeDetail({ available_actions: ["redispatch"] })),
      [`POST ${PATH}/redispatch`]: () => jsonResponse(makeActionResult({ notified_caregivers: 0 })),
    });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await user.click(await screen.findByRole("button", { name: "Re-dispatch" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: /^Reason/ }), "Retry");
    await user.click(within(dialog).getByRole("button", { name: "Re-dispatch" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No one available");
    await waitFor(() => expect(detailCalls(calls)).toHaveLength(2));
  });

  it("refetches the detail when an action fails with a 409, and shows the error verbatim", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(makeDetail({ available_actions: ["assign"] })),
      [`GET ${PATH}/candidates`]: () => jsonResponse({ items: CANDIDATES }),
      [`POST ${PATH}/assign`]: () =>
        jsonResponse({ detail: "Only a pending booking without a caregiver can be offered" }, { status: 409 }),
    });
    render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
    await user.click(await screen.findByRole("button", { name: "Assign caregiver" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("radio", { name: /Nurse One/ }));
    await user.type(within(dialog).getByRole("textbox", { name: /^Reason/ }), "Closest");
    await user.click(within(dialog).getByRole("button", { name: "Offer to caregiver" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Only a pending booking without a caregiver can be offered");
    await waitFor(() => expect(detailCalls(calls)).toHaveLength(2));
  });
  describe("caregiver earning card", () => {
    const EARNINGS = "GET /api/v1/admin/earnings";

    it("shows a held earning and why, from the earnings read for this booking, with a link to Earnings", async () => {
      const calls = stubFetch({
        [`GET ${PATH}`]: () => jsonResponse(makeDetail()),
        [EARNINGS]: () => jsonResponse({ items: [SHORT_VISIT], total: 1 }),
      });
      render(withAuth(["bookings.read", "payments.read"], <BookingView id={BOOKING_ID} />));
      await screen.findByRole("heading", { level: 1, name: /Booking 12FF3CB2/ });
      await screen.findByRole("heading", { level: 2, name: "Caregiver earning" });
      const earning = card("Caregiver earning");
      expect(await earning.findByText("Held")).toBeInTheDocument();
      expect(earning.getByText("₦8,000", { exact: false })).toBeInTheDocument();
      expect(earning.getByText("Short visit")).toBeInTheDocument();
      expect(earning.getByText(/under 50% of the booked time/)).toBeInTheDocument();
      expect(earning.getByRole("link", { name: "Review in Earnings" })).toHaveAttribute("href", "/money/earnings");
      expect(calls.find((c) => c.key === EARNINGS)?.search).toBe(`?booking_id=${BOOKING_ID}&limit=10&offset=0`);
    });

    it("is not requested, and not shown, without payments.read", async () => {
      const calls = stubFetch({ [`GET ${PATH}`]: () => jsonResponse(makeDetail()) });
      render(withAuth(["bookings.read"], <BookingView id={BOOKING_ID} />));
      await screen.findByRole("heading", { level: 1, name: /Booking 12FF3CB2/ });
      expect(screen.queryByRole("heading", { level: 2, name: "Caregiver earning" })).not.toBeInTheDocument();
      expect(calls.some((c) => c.key === EARNINGS)).toBe(false);
    });

    it("stays out of the way when there is no earning yet or the read fails", async () => {
      stubFetch({
        [`GET ${PATH}`]: () => jsonResponse(makeDetail()),
        [EARNINGS]: () => jsonResponse({ detail: "boom" }, { status: 500 }),
      });
      render(withAuth(["bookings.read", "payments.read"], <BookingView id={BOOKING_ID} />));
      await screen.findByRole("heading", { level: 1, name: /Booking 12FF3CB2/ });
      await waitFor(() => expect(screen.queryByRole("heading", { level: 2, name: "Caregiver earning" })).not.toBeInTheDocument());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
