import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { session } from "../src/auth";
import CarePlanDetails from "../src/screens/careplan/CarePlanDetails";
import { carePlansService } from "../src/services/carePlans.service";
import { clientsService } from "../src/services/clients.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import { NOT_A_NURSE, NO_ACCESS, PLAN_ID, TASK_A, dayView, note, notePage, plan, readOnlyPlan } from "../test-utils/carePlanFixtures";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: mockGoBack, replace: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useFocusEffect: jest.fn(),
}));

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView());
  jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([]));
  jest.spyOn(clientsService, "getClientProfile").mockRejectedValue(new Error("not needed here"));
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  await session.signOut();
});

const renderDetails = (params: { from?: "clock_out" } = {}) =>
  renderWithClient(<CarePlanDetails {...routeProps<React.ComponentProps<typeof CarePlanDetails>>({ planId: PLAN_ID, ...params })} />);

describe("Care plan details: daily tasks section", () => {
  it("shows the tasks open by default, the notes section closed, and links to View progress", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    await renderDetails();
    expect(await screen.findByText("Placeholder morning task")).toBeTruthy();
    expect(screen.queryByTestId("notes-observation")).toBeNull();
    await fireEvent.press(screen.getByTestId("details-progress"));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanProgress", { planId: PLAN_ID, clientName: "Placeholder Client" });
  });

  it("lets a caregiver who is not an author tick but not add a task", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan({ capabilities: { can_edit_plan: false, can_tick_tasks: true, can_add_observation: true } }));
    await renderDetails();
    await screen.findByText("Placeholder morning task");
    expect(screen.queryByTestId("task-add")).toBeNull();
    expect(screen.getByTestId(`task-toggle-${TASK_A}`).props.accessibilityState.disabled).toBe(false);
  });

  it("shows a completed plan read-only: banner, no add, no ticking", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(readOnlyPlan({ status: "completed" }));
    jest.spyOn(carePlansService, "getTaskDay").mockResolvedValue(dayView({ can_tick: false }));
    await renderDetails();
    expect(await screen.findByTestId("details-read-only")).toBeTruthy();
    expect(screen.queryByTestId("task-add")).toBeNull();
    expect((await screen.findByTestId(`task-toggle-${TASK_A}`)).props.accessibilityState.disabled).toBe(true);
  });

  it("shows the not-available notice when the day view answers 404 (the visit ended)", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "getTaskDay").mockRejectedValue(NO_ACCESS);
    const { client } = await renderDetails();
    expect(await screen.findByText("This care plan isn't available")).toBeTruthy();
    await waitFor(() => expect(client.getQueryData(["care-plan", PLAN_ID])).toBeUndefined());
    expect(client.getQueryCache().findAll({ queryKey: ["care-plan-tasks", PLAN_ID] })).toHaveLength(0);
  });
});

describe("Care plan details: add task (authors)", () => {
  const openModal = async () => {
    await fireEvent.press(await screen.findByTestId("task-add"));
    expect(screen.getByTestId("task-modal")).toBeTruthy();
  };

  it("adds a daily task and goes to the success page", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest.spyOn(carePlansService, "addTask").mockResolvedValue({
      task: { id: "t9", title: "Physiotherapy appointment", time_slot: "afternoon", time_of_day: "13:00", days_of_week: [1, 3, 5] },
      plan_version: 2,
    });
    await renderDetails();
    await openModal();

    await fireEvent.press(screen.getByTestId("task-save"));
    expect(screen.getByText("Enter the task.")).toBeTruthy();
    expect(add).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId("task-title"), "  Physiotherapy appointment ");
    await fireEvent.press(screen.getByTestId("task-slot-afternoon"));
    await fireEvent.changeText(screen.getByTestId("task-time"), "13:00");
    await fireEvent.press(screen.getByTestId("task-days-weekdays"));
    // Weekdays minus Tuesday and Thursday.
    await fireEvent.press(screen.getByTestId("task-day-2"));
    await fireEvent.press(screen.getByTestId("task-day-4"));
    await fireEvent.press(screen.getByTestId("task-save"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("CarePlanSuccess", { kind: "task_added", planId: PLAN_ID }));
    // Adding never overwrites anything, so no version is sent.
    expect(add).toHaveBeenCalledWith(PLAN_ID, {
      title: "Physiotherapy appointment",
      time_slot: "afternoon",
      time_of_day: "13:00",
      days_of_week: [1, 3, 5],
    });
    expect(screen.queryByTestId("task-modal")).toBeNull();
  });

  it("sends no time when it is left blank, and every day by default", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest.spyOn(carePlansService, "addTask").mockResolvedValue({
      task: { id: "t9", title: "Walk", time_slot: "morning", time_of_day: null, days_of_week: [1, 2, 3, 4, 5, 6, 7] },
      plan_version: 2,
    });
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("task-title"), "Walk");
    await fireEvent.press(screen.getByTestId("task-save"));
    await waitFor(() => expect(add).toHaveBeenCalledWith(PLAN_ID, { title: "Walk", time_slot: "morning", days_of_week: [1, 2, 3, 4, 5, 6, 7] }));
  });

  it("checks the time and the days before sending", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest.spyOn(carePlansService, "addTask");
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("task-title"), "Walk");
    await fireEvent.changeText(screen.getByTestId("task-time"), "9am");
    await fireEvent.press(screen.getByTestId("task-save"));
    expect(screen.getByText(/24-hour format HH:MM/)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("task-time"), "");
    for (let day = 1; day <= 7; day++) await fireEvent.press(screen.getByTestId(`task-day-${day}`));
    await fireEvent.press(screen.getByTestId("task-save"));
    expect(screen.getByTestId("task-days-error")).toHaveTextContent("Choose at least one day.");
    expect(add).not.toHaveBeenCalled();
  });

  it("says only nurses can change a plan when the server refuses with not_a_nurse, and keeps the form", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addTask").mockRejectedValue(NOT_A_NURSE);
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("task-title"), "Walk");
    await fireEvent.press(screen.getByTestId("task-save"));
    expect(await screen.findByTestId("task-error")).toHaveTextContent("Only nurses can change a care plan.");
    expect(screen.getByTestId("task-title").props.value).toBe("Walk");
  });

  it("shows the notice and drops the plan when adding finds the visit has ended (404)", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addTask").mockRejectedValue(NO_ACCESS);
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("task-title"), "Walk");
    await fireEvent.press(screen.getByTestId("task-save"));
    expect(await screen.findByText("This care plan isn't available")).toBeTruthy();
  });
});

describe("Care plan details: notes sections", () => {
  it("opens notes and special notes where the design puts them and adds to each", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const list = jest.spyOn(carePlansService, "listNotes").mockImplementation(async (_id, category) =>
      notePage(category === "observation" ? [note({ body: "Placeholder observation text" })] : [note({ id: "s1", category: "special_note", body: "Placeholder special text" })]),
    );
    await renderDetails();
    await screen.findByText("Placeholder morning task");
    // Collapsed sections do not load until opened.
    expect(list).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("section-observations-toggle"));
    expect(await screen.findByText("Placeholder observation text")).toBeTruthy();
    expect(list).toHaveBeenCalledWith(PLAN_ID, "observation", undefined);

    await fireEvent.press(screen.getByTestId("section-notes-toggle"));
    expect(await screen.findByText("Placeholder special text")).toBeTruthy();
    expect(list).toHaveBeenCalledWith(PLAN_ID, "special_note", undefined);
    expect(screen.getByTestId("note-submit-special_note")).toBeTruthy();
    expect(screen.getByTestId("note-submit-observation")).toBeTruthy();
  });

  it("keeps a half-written note when the section is closed and opened again", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    await renderDetails();
    await screen.findByText("Placeholder morning task");
    await fireEvent.press(screen.getByTestId("section-observations-toggle"));
    await fireEvent.changeText(await screen.findByTestId("note-input-observation"), "Placeholder draft");
    await fireEvent.press(screen.getByTestId("section-observations-toggle"));
    await fireEvent.press(screen.getByTestId("section-observations-toggle"));
    expect(screen.getByTestId("note-input-observation").props.value).toBe("Placeholder draft");
  });

  it("opens the notes first when the caregiver came from the clock-out prompt", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    await renderDetails({ from: "clock_out" });
    expect(await screen.findByTestId("notes-observation")).toBeTruthy();
    expect(screen.getByText("Placeholder morning task")).toBeTruthy();
  });
});
