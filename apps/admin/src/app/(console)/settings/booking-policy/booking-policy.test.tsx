import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { POLICY } from "@/test/booking-fixtures";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";

import { BookingPolicyView } from "./booking-policy";

const PATH = "/api/v1/admin/booking-policy";

describe("BookingPolicyView", () => {
  it("shows every policy value, and the short-visit threshold with its Edit button for settings.write", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(POLICY) });
    render(withAuth(["bookings.read", "settings.write"], <BookingPolicyView />));
    await screen.findByRole("heading", { level: 1, name: "Booking policy" });
    expect(screen.getByText("More than 12 hours before the visit")).toBeInTheDocument();
    expect(screen.getByText("Under 50% of the booked time")).toBeInTheDocument();
    expect(screen.getByText("₦5,000")).toBeInTheDocument();
    expect(screen.getByText("weekly")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit the short-visit threshold/ })).toBeInTheDocument();
  });

  it("is read-only without settings.write", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse(POLICY) });
    render(withAuth(["bookings.read"], <BookingPolicyView />));
    await screen.findByRole("heading", { level: 1, name: "Booking policy" });
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.getByText(/needs the settings.write permission/)).toBeInTheDocument();
  });

  it("saves a new threshold with its reason and shows the new value", async () => {
    let policy = POLICY;
    const calls = stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(policy),
      [`PATCH ${PATH}`]: () => {
        policy = { ...POLICY, short_visit_min_percent: 40 };
        return jsonResponse(policy);
      },
    });
    const user = userEvent.setup();
    render(withAuth(["bookings.read", "settings.write"], <BookingPolicyView />));
    await user.click(await screen.findByRole("button", { name: /Edit the short-visit threshold/ }));
    const dialog = within(await screen.findByRole("dialog"));
    const field = dialog.getByLabelText(/Minimum time on site/);
    await user.clear(field);
    await user.type(field, "40");
    expect(dialog.getByRole("button", { name: "Save threshold" })).toBeDisabled(); // a reason is required
    await user.type(dialog.getByLabelText("Why are you changing it?"), "Placeholder: pilot threshold");
    await user.click(dialog.getByRole("button", { name: "Save threshold" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const patch = calls.find((c) => c.key === `PATCH ${PATH}`);
    expect(patch?.body).toEqual({ reason: "Placeholder: pilot threshold", short_visit_min_percent: 40 });
    expect(await screen.findByText("Under 40% of the booked time")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("The short-visit threshold is now 40%");
  });

  it("does not let a value outside 0 to 100 or a non-number be saved", async () => {
    const calls = stubFetch({ [`GET ${PATH}`]: () => jsonResponse(POLICY) });
    const user = userEvent.setup();
    render(withAuth(["bookings.read", "settings.write"], <BookingPolicyView />));
    await user.click(await screen.findByRole("button", { name: /Edit the short-visit threshold/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Why are you changing it?"), "Placeholder reason");
    const field = dialog.getByLabelText(/Minimum time on site/);
    for (const bad of ["101", "4.5", "abc", ""]) {
      await user.clear(field);
      if (bad) await user.type(field, bad);
      expect(dialog.getByRole("button", { name: "Save threshold" })).toBeDisabled();
    }
    await user.clear(field);
    await user.type(field, "0");
    expect(dialog.getByRole("button", { name: "Save threshold" })).toBeEnabled();
    expect(calls.some((c) => c.key.startsWith("PATCH"))).toBe(false);
  });

  it("keeps the dialog open and shows the server's message when the save is refused", async () => {
    stubFetch({
      [`GET ${PATH}`]: () => jsonResponse(POLICY),
      [`PATCH ${PATH}`]: () => jsonResponse({ detail: "short_visit_min_percent must be between 0 and 100" }, { status: 400 }),
    });
    const user = userEvent.setup();
    render(withAuth(["bookings.read", "settings.write"], <BookingPolicyView />));
    await user.click(await screen.findByRole("button", { name: /Edit the short-visit threshold/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Why are you changing it?"), "Placeholder reason");
    await user.click(dialog.getByRole("button", { name: "Save threshold" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent("short_visit_min_percent must be between 0 and 100");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows an error with a retry when the policy can't be loaded", async () => {
    stubFetch({ [`GET ${PATH}`]: () => jsonResponse({ detail: "boom" }, { status: 500 }) });
    render(withAuth(["bookings.read"], <BookingPolicyView />));
    expect(await screen.findByText(/We couldn't load the booking policy/)).toBeInTheDocument();
  });
});
