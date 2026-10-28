import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError, NETWORK_MESSAGE } from "../src/api/errors";
import { session } from "../src/auth";
import DailyTasks from "../src/components/careplan/DailyTasks";
import { carePlansService } from "../src/services/carePlans.service";
import { renderWithClient } from "../test-utils/carePlanHarness";
import {
  NO_ACCESS,
  PLAN_ID,
  PLAN_NOT_EDITABLE,
  TASK_A,
  TASK_B,
  TASK_DATE_NOT_TODAY,
  TASK_NOT_SCHEDULED,
  TODAY_DATE,
  VISIT_NOT_IN_PROGRESS,
  completion,
  dayView,
  plan,
  tickedDay,
} from "../test-utils/carePlanFixtures";

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await session.signOut();
});

const renderTasks = async (props: Partial<React.ComponentProps<typeof DailyTasks>> = {}, p = plan()) => {
  const onNoAccess = jest.fn();
  const view = await renderWithClient(<DailyTasks plan={p} onNoAccess={onNoAccess} {...props} />);
  return { onNoAccess, ...view };
};

/** Presses the button with this label on the most recent Alert. */
const answerAlert = (spy: jest.SpyInstance, label: string) => {
  const buttons = spy.mock.calls[spy.mock.calls.length - 1][2] as { text: string; onPress?: () => void }[];
  buttons.find((b) => b.text === label)?.onPress?.();
};

describe("Daily care tasks: the day view", () => {
  it("shows Monday to Sunday around the server's today, and the tasks by slot with their time", async () => {
    const get = jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    await renderTasks();
    expect(await screen.findByText("Morning (8:00 AM)")).toBeTruthy();
    expect(screen.getByText("Evening")).toBeTruthy();
    expect(screen.getByText("Placeholder morning task")).toBeTruthy();
    for (const d of ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]) {
      expect(screen.getByTestId(`day-tab-${d}`)).toBeTruthy();
    }
    expect(screen.getByTestId("day-tab-2026-10-28").props.accessibilityState.selected).toBe(true);
    // No date is sent for today: the backend's Lagos date decides, never the phone's clock.
    expect(get).toHaveBeenCalledWith(PLAN_ID, undefined);
    expect(screen.queryByTestId("tasks-hint")).toBeNull();
  });

  it("shows another day read-only with a hint, and the same call carries its date", async () => {
    const get = jest.spyOn(carePlansService, "getTaskDay").mockImplementation(async (_id, date) =>
      date ? dayView({ date, is_today: false, can_tick: false }) : dayView(),
    );
    await renderTasks();
    await fireEvent.press(await screen.findByTestId("day-tab-2026-10-29"));
    expect(await screen.findByText("Only today's tasks can be ticked. Other days are read-only.")).toBeTruthy();
    expect(get).toHaveBeenCalledWith(PLAN_ID, "2026-10-29");
    expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.disabled).toBe(true);

    // Back to today: the default day again.
    await fireEvent.press(screen.getByTestId("day-tab-2026-10-28"));
    await waitFor(() => expect(screen.queryByTestId("tasks-hint")).toBeNull());
    expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.disabled).toBe(false);
  });

  it("says a day with nothing due has no tasks", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView({ slots: [] }));
    await renderTasks();
    expect(await screen.findByTestId("tasks-empty")).toHaveTextContent("No tasks on this day.");
  });

  it("explains why the boxes are disabled before the visit has started", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView({ can_tick: false }));
    await renderTasks();
    expect(await screen.findByTestId("tasks-hint")).toHaveTextContent("Available during an active visit.");
    expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.disabled).toBe(true);
  });

  it("adds no hint on a completed plan (the details screen carries the read-only banner)", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView({ can_tick: false }));
    await renderTasks({}, plan({ status: "completed" }));
    await screen.findByText("Placeholder morning task");
    expect(screen.queryByTestId("tasks-hint")).toBeNull();
  });

  it("shows who ticked a task and when", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(tickedDay());
    await renderTasks();
    expect(await screen.findByTestId(`task-done-${TASK_A}`)).toHaveTextContent(/^Done by Placeholder Nurse, \d{2}:\d{2}$/);
    expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.checked).toBe(true);
    expect(screen.queryByTestId(`task-done-${TASK_B}`)).toBeNull();
  });

  it("shows an error with a retry when the day fails to load", async () => {
    const get = jest.spyOn(carePlansService, "getTaskDay").mockRejectedValueOnce(new ApiError(0, null, "You're offline.")).mockResolvedValue(dayView());
    await renderTasks();
    expect(await screen.findByText("Try again")).toBeTruthy();
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByText("Placeholder morning task")).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("hands over a 404 (the visit ended) to the screen", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockRejectedValue(NO_ACCESS);
    const { onNoAccess } = await renderTasks();
    await waitFor(() => expect(onNoAccess).toHaveBeenCalled());
    expect(screen.queryByTestId("daily-tasks")).toBeNull();
  });

  it("offers Add New Task only when the screen passes it (authors)", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    const onAddTask = jest.fn();
    await renderTasks({ onAddTask });
    await fireEvent.press(await screen.findByTestId("task-add"));
    expect(onAddTask).toHaveBeenCalled();
  });

  it("hides Add New Task from a caregiver who is not an author", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    await renderTasks();
    await screen.findByText("Placeholder morning task");
    expect(screen.queryByTestId("task-add")).toBeNull();
  });
});

describe("Daily care tasks: ticking", () => {
  it("ticks only after the server answers, with today's date from the day view, and shows the server's who and when", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    let resolve: (value: ReturnType<typeof completion>) => void = () => {};
    const set = jest.spyOn(carePlansService, "setCompletion").mockReturnValue(new Promise((r) => (resolve = r)));
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));

    expect(set).toHaveBeenCalledWith(TASK_A, TODAY_DATE, true);
    // Never optimistic: the box is still empty while the call is open, and busy.
    expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState).toMatchObject({ checked: false, busy: true });
    await act(async () => resolve(completion()));
    await waitFor(() => expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.checked).toBe(true));
    expect(screen.getByTestId(`task-done-${TASK_A}`)).toHaveTextContent(/Done by Placeholder Nurse/);
  });

  it("shows a colleague's earlier tick, not an error, when they got there first", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    jest.spyOn(carePlansService, "setCompletion").mockResolvedValue(completion({ done_by: "Placeholder Caregiver" }));
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    expect(await screen.findByTestId(`task-done-${TASK_A}`)).toHaveTextContent(/Done by Placeholder Caregiver/);
    expect(screen.queryByTestId("tasks-error")).toBeNull();
  });

  it("disables the other boxes while a tick is in flight, so its refusal is never lost", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    jest.spyOn(carePlansService, "setCompletion").mockReturnValue(new Promise(() => {}));
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    expect(screen.getByTestId(`task-toggle-${TASK_B}`).props.accessibilityState.disabled).toBe(true);
  });

  it("asks before unticking, and does nothing when the nurse keeps it", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(tickedDay());
    const set = jest.spyOn(carePlansService, "setCompletion");
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    expect(alert).toHaveBeenCalledWith("Untick this task?", expect.stringContaining("recorded"), expect.any(Array));
    answerAlert(alert, "Keep it ticked");
    expect(set).not.toHaveBeenCalled();
  });

  it("unticks after the confirmation", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(tickedDay());
    const set = jest
      .spyOn(carePlansService, "setCompletion")
      .mockResolvedValue(completion({ done: false, done_by: null, done_at: null }));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    await act(async () => answerAlert(alert, "Untick"));
    await waitFor(() => expect(set).toHaveBeenCalledWith(TASK_A, TODAY_DATE, false));
    await waitFor(() => expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.checked).toBe(false));
    expect(screen.queryByTestId(`task-done-${TASK_A}`)).toBeNull();
  });

  it("does not send a tick from a disabled box", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView({ can_tick: false }));
    const set = jest.spyOn(carePlansService, "setCompletion");
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    expect(set).not.toHaveBeenCalled();
  });

  it("on visit_not_in_progress says so, leaves the box unticked and reloads the day", async () => {
    const get = jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    jest.spyOn(carePlansService, "setCompletion").mockRejectedValue(VISIT_NOT_IN_PROGRESS);
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    expect(await screen.findByTestId("tasks-error")).toHaveTextContent("Available during an active visit.");
    expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.checked).toBe(false);
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1));
  });

  it("on task_date_not_today (midnight) says the tick was not saved and reloads the day", async () => {
    const get = jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    const set = jest.spyOn(carePlansService, "setCompletion").mockRejectedValue(TASK_DATE_NOT_TODAY);
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    expect(await screen.findByTestId("tasks-error")).toHaveTextContent(/day changed, so your tick was not saved/);
    // Not retried on its own.
    expect(set).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(1));
  });

  it.each([
    ["task_not_scheduled", TASK_NOT_SCHEDULED, /not scheduled/],
    ["plan_not_editable", PLAN_NOT_EDITABLE, /completed or archived/],
  ])("on %s shows its message", async (_name, error, message) => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    jest.spyOn(carePlansService, "setCompletion").mockRejectedValue(error);
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    expect(await screen.findByTestId("tasks-error")).toHaveTextContent(message);
  });

  it("hands a 404 on a tick to the screen (the visit ended)", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    jest.spyOn(carePlansService, "setCompletion").mockRejectedValue(NO_ACCESS);
    const { onNoAccess } = await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    await waitFor(() => expect(onNoAccess).toHaveBeenCalled());
  });

  it("shows the plain network message when the tick cannot be sent, and does not queue it", async () => {
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
    const set = jest.spyOn(carePlansService, "setCompletion").mockRejectedValue(new ApiError(0, null, NETWORK_MESSAGE));
    await renderTasks();
    await fireEvent.press(await screen.findByTestId(`task-toggle-${TASK_A}`));
    expect(await screen.findByTestId("tasks-error")).toHaveTextContent(NETWORK_MESSAGE);
    expect(set).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.checked).toBe(false);
  });
});
