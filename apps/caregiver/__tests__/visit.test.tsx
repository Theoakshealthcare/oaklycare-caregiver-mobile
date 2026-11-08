import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

import { queryKeys } from "../src/api/keys";
import { useBookingAction } from "../src/hooks/queries";
import { bookingService } from "../src/services/booking.service";
import { ApiError, formatCountdown, isSuspendedStop, messageForError, visitCodeFailure } from "../src/api/errors";
import { InProgressStep, OnMyWayStep, VisitCodeStep, VisitDoneStep } from "../src/screens/visit/VisitSteps";
import {
  DROP_OUT_CONFIRM,
  isOnMyWayOpen,
  onMyWayUnlocksAt,
  createCodeLocks,
  isCompleteCode,
  sanitizeCode,
  secondsLeft,
  stepForStatus,
  submitVisitCode,
} from "../src/visit/visitFlow";

const wrong1 = new ApiError(400, { detail: "Incorrect visit code. 2 attempts left before the code is locked" }, "x");
const wrong2 = new ApiError(400, { detail: "Incorrect visit code. 1 attempt left before the code is locked" }, "x");
const locked = new ApiError(
  423,
  { detail: "Too many incorrect attempts. The visit code is locked for 15 minutes" },
  "x",
  900,
);

describe("stepForStatus", () => {
  it.each([
    ["accepted", "on_my_way"],
    ["en_route", "enter_code"],
    ["in_progress", "in_progress"],
    ["completed", "done"],
    ["cancelled", "closed"],
    ["pending", "closed"],
  ])("%s -> %s", (status, step) => expect(stepForStatus(status)).toBe(step));
});

describe("code input", () => {
  it("keeps four digits only", () => {
    expect(sanitizeCode("12a3 4-5")).toBe("1234");
    expect(isCompleteCode("1234")).toBe(true);
    expect(isCompleteCode("123")).toBe(false);
    expect(isCompleteCode("12ab")).toBe(false);
  });
});

describe("visit error mapping (exact backend strings)", () => {
  const map = (status: number, detail: string, retry: number | null = null) =>
    messageForError(new ApiError(status, { detail }, "x", retry), "visit");

  it("wrong code with attempts left", () => {
    expect(map(400, "Incorrect visit code. 2 attempts left before the code is locked")).toBe(
      "That code isn't right. 2 tries left before the code is locked. Ask the patient to check the code in their Oakly app.",
    );
    expect(map(400, "Incorrect visit code. 1 attempt left before the code is locked")).toContain("1 try left");
  });

  it("423 lock shows the Retry-After countdown, 15:00 when the header is missing", () => {
    expect(map(423, "Too many incorrect attempts. The visit code is locked for 15 minutes", 900)).toContain("15:00");
    expect(map(423, "Too many incorrect attempts. The visit code is locked for 15 minutes", 90)).toContain("1:30");
    expect(map(423, "Too many incorrect attempts. The visit code is locked for 15 minutes")).toContain("15:00");
  });

  it("suspension 403 keeps the backend wording and sends them to support", () => {
    const error = new ApiError(403, { detail: "Your account is not approved to start visits" }, "x");
    expect(messageForError(error, "visit")).toBe("Your account is not approved to start visits. Contact Oakly support.");
    expect(isSuspendedStop(error)).toBe(true);
    expect(isSuspendedStop(new ApiError(403, { detail: "This booking is not assigned to you" }, "x"))).toBe(false);
  });

  it.each([
    [403, "This booking is not assigned to you", "This visit isn't assigned to you."],
    [409, "Only an accepted booking can be marked on the way", "This visit has already moved past this step. We've refreshed it."],
    [409, "Only an accepted booking can be started", "This visit can't be started right now. We've refreshed it."],
    [409, "Only a booking in progress can be completed", "This visit isn't in progress, so it can't be completed yet."],
    [409, "This booking has no visit code. Contact support", "This visit has no visit code. Please contact Oakly support."],
    [400, "A visit code is required to start the visit", "Enter the 4-digit visit code."],
  ])("%i %s", (status, detail, expected) => expect(map(status, detail)).toBe(expected));

  it("maps the too-early On my way 409 to a friendly sentence, following the policy window", () => {
    expect(map(409, "You can mark yourself on the way from 2 hours before the visit")).toBe(
      "You can mark yourself on the way from 2 hours before the visit.",
    );
    expect(map(409, "You can mark yourself on the way from 90 minutes before the visit")).toBe(
      "You can mark yourself on the way from 90 minutes before the visit.",
    );
    // Not an exact sentence: falls through to the server's own text, not the friendly one.
    expect(map(409, "You can mark yourself on the way from tomorrow before the visit")).toBe(
      "You can mark yourself on the way from tomorrow before the visit",
    );
  });

  it("parses failures", () => {
    expect(visitCodeFailure(wrong1)).toEqual({ kind: "incorrect", attemptsLeft: 2 });
    expect(visitCodeFailure(wrong2)).toEqual({ kind: "incorrect", attemptsLeft: 1 });
    expect(visitCodeFailure(locked)).toEqual({ kind: "locked", retryAfterSeconds: 900 });
    expect(visitCodeFailure(new Error("x"))).toBeNull();
    expect(visitCodeFailure(new ApiError(409, { detail: "Only an accepted booking can be started" }, "x"))).toBeNull();
  });

  it("formats the countdown", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(61)).toBe("1:01");
    expect(formatCountdown(0.2)).toBe("0:01");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("submitVisitCode: 3-attempt lock with countdown", () => {
  const BOOKING = "d4055373-bee6-431e-977a-11b01af19a96";

  it("walks the captured sequence: wrong, wrong, lock, then refuses locally until the lock ends", async () => {
    let clock = 1_000_000;
    const locks = createCodeLocks(() => clock);
    const start = jest
      .fn<Promise<unknown>, [string, string]>()
      .mockRejectedValueOnce(wrong1)
      .mockRejectedValueOnce(wrong2)
      .mockRejectedValueOnce(locked);

    const first = await submitVisitCode(BOOKING, "0000", { start, locks });
    expect(first).toMatchObject({ kind: "incorrect", attemptsLeft: 2 });

    const second = await submitVisitCode(BOOKING, "1111", { start, locks });
    expect(second).toMatchObject({ kind: "incorrect", attemptsLeft: 1 });

    const third = await submitVisitCode(BOOKING, "2222", { start, locks });
    expect(third).toMatchObject({ kind: "locked", lockedUntil: 1_000_000 + 900_000 });
    expect(third.kind === "locked" && secondsLeft(third.lockedUntil, clock)).toBe(900);

    // While locked even the right code is not sent: the backend would answer 423 anyway.
    clock += 60_000;
    const refused = await submitVisitCode(BOOKING, "1092", { start, locks });
    expect(refused.kind).toBe("locked");
    expect(start).toHaveBeenCalledTimes(3);
    expect(refused.kind === "locked" && secondsLeft(refused.lockedUntil, clock)).toBe(840);

    // After the lock ends the caregiver gets fresh tries and a correct code starts the visit.
    clock += 840_000;
    start.mockResolvedValueOnce({ status: "in_progress" });
    await expect(submitVisitCode(BOOKING, "1092", { start, locks })).resolves.toEqual({ kind: "started" });
    expect(start).toHaveBeenLastCalledWith(BOOKING, "1092");
    expect(locks.get(BOOKING)).toBeNull();
  });

  it("falls back to the 15 minute lock when the 423 carries no Retry-After", async () => {
    const locks = createCodeLocks(() => 0);
    const noHeader = new ApiError(423, { detail: "Too many incorrect attempts. The visit code is locked for 15 minutes" }, "x");
    const result = await submitVisitCode("b", "1234", { start: async () => Promise.reject(noHeader), locks });
    expect(result).toMatchObject({ kind: "locked", lockedUntil: 900_000 });
  });

  it("does not send a malformed code (the backend would 422)", async () => {
    const start = jest.fn();
    await expect(submitVisitCode("b", "12", { start, locks: createCodeLocks() })).resolves.toMatchObject({ kind: "error" });
    expect(start).not.toHaveBeenCalled();
  });

  it("maps the suspension 403 to a stop, and other errors to messages", async () => {
    const locks = createCodeLocks();
    const suspended = new ApiError(403, { detail: "Your account is not approved to start visits" }, "x");
    await expect(submitVisitCode("b", "1234", { start: () => Promise.reject(suspended), locks })).resolves.toEqual({
      kind: "suspended",
      message: "Your account is not approved to start visits. Contact Oakly support.",
    });
    const stale = new ApiError(409, { detail: "Only an accepted booking can be started" }, "x");
    await expect(submitVisitCode("b", "1234", { start: () => Promise.reject(stale), locks })).resolves.toEqual({
      kind: "error",
      message: "This visit can't be started right now. We've refreshed it.",
    });
    const offline = new ApiError(0, null, "x");
    await expect(submitVisitCode("b", "1234", { start: () => Promise.reject(offline), locks })).resolves.toMatchObject({
      kind: "error",
      message: "Can't reach Oakly. Check your internet connection and try again.",
    });
  });
});

describe("VisitCodeStep", () => {
  const visit = { patientName: "Placeholder Patient", address: "12 Placeholder Street, Lekki", when: "Tue 6 Oct" };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("enables Start only for four digits and submits them", async () => {
    const onSubmit = jest.fn();
    await render(
      <VisitCodeStep visit={visit} busy={false} lockedUntil={null} attemptsLeft={null} error={null} onSubmit={onSubmit} />,
    );
    const input = screen.getByTestId("visit-code-input");
    await fireEvent.changeText(input, "12ab34567");
    expect(input.props.value).toBe("1234");
    await fireEvent.press(screen.getByText("Start visit"));
    expect(onSubmit).toHaveBeenCalledWith("1234");
  });

  it("shows attempts left and the exact error after a wrong code", async () => {
    await render(
      <VisitCodeStep
        visit={visit}
        busy={false}
        lockedUntil={null}
        attemptsLeft={1}
        error="That code isn't right. 1 try left before the code is locked. Ask the patient to check the code in their Oakly app."
        onSubmit={jest.fn()}
      />,
    );
    // The exact error already says how many tries are left: the hint must not repeat it (DP1-32).
    expect(screen.getAllByText(/1 try left/)).toHaveLength(1);
    expect(screen.getByText(/That code isn't right/)).toBeTruthy();
  });

  it("shows the tries-left hint only when there is no error to carry it", async () => {
    await render(
      <VisitCodeStep visit={visit} busy={false} lockedUntil={null} attemptsLeft={2} error={null} onSubmit={jest.fn()} />,
    );
    expect(screen.getAllByText(/2 tries left/)).toHaveLength(1);
  });

  it("replaces the input with a ticking countdown while locked, then offers the input again", async () => {
    const now = () => Date.now();
    const lockedUntil = Date.now() + 3_000;
    await render(
      <VisitCodeStep
        visit={visit}
        busy={false}
        lockedUntil={lockedUntil}
        attemptsLeft={null}
        error={null}
        onSubmit={jest.fn()}
        now={now}
      />,
    );
    expect(screen.getByTestId("lock-countdown").props.children).toBe("0:03");
    expect(screen.queryByTestId("visit-code-input")).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("lock-countdown").props.children).toBe("0:02");

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId("lock-countdown")).toBeNull();
    expect(screen.getByTestId("visit-code-input")).toBeTruthy();
  });
});

describe("OnMyWayStep: unlocks two hours before the visit", () => {
  const visit = { patientName: "Placeholder Patient", address: "12 Placeholder Street, Lekki", when: "Tue 6 Oct" };
  const start = Date.parse("2026-10-06T12:00:00Z");

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("computes the unlock time and boundary", () => {
    expect(onMyWayUnlocksAt(start)).toBe(Date.parse("2026-10-06T10:00:00Z"));
    expect(isOnMyWayOpen(start, Date.parse("2026-10-06T09:59:59Z"))).toBe(false);
    expect(isOnMyWayOpen(start, Date.parse("2026-10-06T10:00:00Z"))).toBe(true);
  });

  it("is disabled with a hint before the window and enables once it opens", async () => {
    jest.setSystemTime(Date.parse("2026-10-06T09:50:00Z"));
    const onOnMyWay = jest.fn();
    const onArrived = jest.fn();
    await render(
      <OnMyWayStep visit={visit} scheduledDate="2026-10-06T12:00:00" busy={false} onOnMyWay={onOnMyWay} onArrived={onArrived} channel="whatsapp" onCantMakeIt={jest.fn()} onContactSupport={jest.fn()} />,
    );
    expect(screen.getByTestId("on-my-way-hint")).toBeTruthy();
    await fireEvent.press(screen.getByText("On my way"));
    expect(onOnMyWay).not.toHaveBeenCalled();
    // The code entry stays available.
    await fireEvent.press(screen.getByText("I've arrived"));
    expect(onArrived).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(11 * 60_000);
    });
    expect(screen.queryByTestId("on-my-way-hint")).toBeNull();
    await fireEvent.press(screen.getByText("On my way"));
    expect(onOnMyWay).toHaveBeenCalledTimes(1);
  });

  const renderStep = (channel: string, onCant = jest.fn(), onSupport = jest.fn()) =>
    render(
      <OnMyWayStep visit={visit} scheduledDate="2026-10-06T12:00:00" busy={false} onOnMyWay={jest.fn()} onArrived={jest.fn()} channel={channel} onCantMakeIt={onCant} onContactSupport={onSupport} />,
    );

  it("shows the drop-out button for a WhatsApp booking more than 2 h out, then swaps it for support inside 2 h", async () => {
    jest.setSystemTime(Date.parse("2026-10-06T09:50:00Z"));
    const onCant = jest.fn();
    const onSupport = jest.fn();
    await renderStep("whatsapp", onCant, onSupport);
    expect(screen.queryByTestId("contact-support-link")).toBeNull();
    await fireEvent.press(screen.getByText("I can't make this visit"));
    expect(onCant).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(11 * 60_000);
    });
    expect(screen.queryByText("I can't make this visit")).toBeNull();
    await fireEvent.press(screen.getByText("Need to cancel? Contact support"));
    expect(onSupport).toHaveBeenCalledTimes(1);
  });

  it.each(["app", "admin"])("hides the drop-out button for a %s booking and shows the support link", async (channel) => {
    jest.setSystemTime(Date.parse("2026-10-06T08:00:00Z"));
    await renderStep(channel);
    expect(screen.queryByText("I can't make this visit")).toBeNull();
    expect(screen.getByTestId("contact-support-link")).toBeTruthy();
  });

  it("maps the too-close-to-cancel 409", () => {
    expect(
      messageForError(
        new ApiError(409, { detail: "It's too close to the visit to cancel in the app. Please contact support." }, "x"),
        "visit",
      ),
    ).toContain("too close to the visit to cancel in the app");
  });

  it("is enabled straight away inside the window", async () => {
    jest.setSystemTime(Date.parse("2026-10-06T11:00:00Z"));
    const onOnMyWay = jest.fn();
    await render(
      <OnMyWayStep visit={visit} scheduledDate="2026-10-06T12:00:00" busy={false} onOnMyWay={onOnMyWay} onArrived={jest.fn()} channel="whatsapp" onCantMakeIt={jest.fn()} onContactSupport={jest.fn()} />,
    );
    expect(screen.queryByTestId("on-my-way-hint")).toBeNull();
    await fireEvent.press(screen.getByText("On my way"));
    expect(onOnMyWay).toHaveBeenCalledTimes(1);
  });
});

describe("caregiver drop-out", () => {
  it("confirmation copy promises nothing about money and says what happens next", () => {
    expect(DROP_OUT_CONFIRM.message).toBe("We'll let the family know and find another professional.");
    expect(DROP_OUT_CONFIRM.done).toContain("find another professional");
    for (const text of Object.values(DROP_OUT_CONFIRM)) expect(text.toLowerCase()).not.toMatch(/refund|fee|charge|paid/);
  });

  it("a successful cancel refetches the lists, the booking and home", async () => {
    jest.spyOn(bookingService, "act").mockResolvedValue({ status: "pending", arrivedAt: null, actualStartTime: null, actualEndTime: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useBookingAction(), { wrapper });
    await act(async () => {
      result.current.mutate({ bookingId: "b-1", action: "cancel" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bookingService.act).toHaveBeenCalledWith("b-1", "cancel", undefined);
    const keys = invalidate.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([queryKeys.allBookings, queryKeys.booking("b-1"), queryKeys.home]));
  });
});

describe("visit in progress and completed screens (DP1-19)", () => {
  const visit = { patientName: "Placeholder Patient", address: "12 Placeholder Street, Lekki", when: "Tue 6 Oct" };
  const base = { visit, busy: false, onComplete: jest.fn(), onNotes: jest.fn() };

  it("says nothing about location sharing when it never started", async () => {
    await render(<InProgressStep {...base} />);
    expect(screen.queryByText(/location sharing/i)).toBeNull();
  });

  it("explains that completing stops location sharing only when it is being shared", async () => {
    await render(<InProgressStep {...base} sharingLocation />);
    expect(screen.getByText(/This stops location sharing/)).toBeTruthy();
  });

  it("links to the care plan and to vitals from the visit, so they are not only reachable at clock-out", async () => {
    const onCarePlan = jest.fn();
    const onVitals = jest.fn();
    await render(<InProgressStep {...base} onCarePlan={onCarePlan} onVitals={onVitals} />);
    await fireEvent.press(screen.getByText("Care plan"));
    await fireEvent.press(screen.getByText("Record vitals"));
    expect(onCarePlan).toHaveBeenCalledTimes(1);
    expect(onVitals).toHaveBeenCalledTimes(1);
  });

  it("omits the care plan link when the client has no plan", async () => {
    await render(<InProgressStep {...base} onVitals={jest.fn()} />);
    expect(screen.queryByText("Care plan")).toBeNull();
    expect(screen.getByText("Record vitals")).toBeTruthy();
  });

  it("the completed screen claims 'sharing has stopped' only if it was shared", async () => {
    const first = await render(<VisitDoneStep onHome={jest.fn()} />);
    expect(screen.queryByText(/Location sharing has stopped/)).toBeNull();
    await first.unmount();
    await render(<VisitDoneStep onHome={jest.fn()} sharedLocation />);
    expect(screen.getByText(/Location sharing has stopped/)).toBeTruthy();
  });
});
