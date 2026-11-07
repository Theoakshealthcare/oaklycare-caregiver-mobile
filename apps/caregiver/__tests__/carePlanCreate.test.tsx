import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { session } from "../src/auth";
import { routesAfterPlanCreated } from "../src/navigation/carePlanStack";
import CarePlanSuccess from "../src/screens/careplan/CarePlanSuccess";
import CreateCarePlan from "../src/screens/careplan/CreateCarePlan";
import { carePlansService } from "../src/services/carePlans.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import {
  BOOKING,
  NOT_A_NURSE,
  NOT_IDENTIFIED,
  NO_ACCESS,
  PLAN_EXISTS,
  PLAN_ID,
  TEMPLATE_ID,
  VALIDATION_DIAGNOSIS,
  plan,
  template,
} from "../test-utils/carePlanFixtures";

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: mockGoBack, replace: mockReplace, dispatch: mockDispatch } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
  useFocusEffect: jest.fn(),
}));

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  mockReplace.mockClear();
  mockGoBack.mockClear();
  mockDispatch.mockClear();
  await session.signOut();
});

const renderForm = (params: { bookingId: string; templateId?: string; clientName?: string } = { bookingId: BOOKING }) =>
  renderWithClient(<CreateCarePlan {...routeProps<React.ComponentProps<typeof CreateCarePlan>>(params)} />);

const type = (testID: string, text: string) => fireEvent.changeText(screen.getByTestId(testID), text);

describe("Create care plan: blank", () => {
  it("checks the diagnosis and risk level before sending anything", async () => {
    const create = jest.spyOn(carePlansService, "createPlan");
    await renderForm();
    await fireEvent.press(screen.getByTestId("create-submit"));
    expect(screen.getByText("Enter the diagnosis.")).toBeTruthy();
    expect(screen.getByTestId("create-risk-error")).toHaveTextContent("Choose a risk level.");
    expect(create).not.toHaveBeenCalled();
  });

  it("creates the plan and moves to the success page", async () => {
    const create = jest.spyOn(carePlansService, "createPlan").mockResolvedValue(plan());
    await renderForm({ bookingId: BOOKING, clientName: "Placeholder Client" });
    expect(screen.getByText("Placeholder Client")).toBeTruthy();

    await type("create-diagnosis", "Placeholder diagnosis");
    await fireEvent.press(screen.getByTestId("risk-high"));
    await type("create-duration", "30");
    await type("create-review", "14");
    await type("create-allergies", "Placeholder allergen\nSecond allergen");
    await fireEvent.press(screen.getByTestId("create-submit"));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("CarePlanSuccess", { kind: "created", planId: PLAN_ID }));
    expect(create).toHaveBeenCalledWith(BOOKING, {
      diagnosis: "Placeholder diagnosis",
      risk_level: "high",
      start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      duration_days: 30,
      review_every_days: 14,
      goals: [],
      tasks: [],
      allergies: ["Placeholder allergen", "Second allergen"],
      special_instructions: [],
    });
  });

  it("adds a goal and a task in the form and sends them", async () => {
    const create = jest.spyOn(carePlansService, "createPlan").mockResolvedValue(plan());
    await renderForm();
    await type("create-diagnosis", "Placeholder diagnosis");
    await fireEvent.press(screen.getByTestId("risk-low"));

    await fireEvent.press(screen.getByTestId("create-goal-add"));
    expect(screen.getByTestId("create-goal-problem")).toHaveTextContent("Enter the goal.");
    await type("create-goal-title", "Placeholder goal");
    await type("create-goal-target", "Placeholder target");
    await fireEvent.press(screen.getByTestId("create-goal-frequency-weekly"));
    await fireEvent.press(screen.getByTestId("create-goal-add"));
    expect(screen.getByTestId("create-goal-0")).toBeTruthy();

    await type("create-task-title", "Placeholder task");
    await fireEvent.press(screen.getByTestId("create-task-slot-evening"));
    await fireEvent.press(screen.getByTestId("create-task-days-weekdays"));
    await fireEvent.press(screen.getByTestId("create-task-add"));
    expect(screen.getByTestId("create-task-0")).toHaveTextContent(/Evening · Weekdays/);

    await fireEvent.press(screen.getByTestId("create-submit"));
    await waitFor(() => expect(create).toHaveBeenCalled());
    const body = create.mock.calls[0]?.[1];
    expect(body?.goals).toEqual([{ title: "Placeholder goal", target: "Placeholder target", frequency: "weekly" }]);
    expect(body?.tasks).toEqual([{ title: "Placeholder task", time_slot: "evening", time_of_day: null, days_of_week: [1, 2, 3, 4, 5] }]);
  });

  it("rejects an out-of-range duration", async () => {
    const create = jest.spyOn(carePlansService, "createPlan");
    await renderForm();
    await type("create-diagnosis", "Placeholder diagnosis");
    await fireEvent.press(screen.getByTestId("risk-low"));
    await type("create-duration", "400");
    await fireEvent.press(screen.getByTestId("create-submit"));
    expect(screen.getByText(/whole number of days from 1 to 365/)).toBeTruthy();
    expect(create).not.toHaveBeenCalled();
  });

  it("shows real defaults, not grey placeholders: start today, 30 days, review every 14 (DP1-25)", async () => {
    await renderForm();
    expect(screen.getByTestId("create-duration").props.value).toBe("30");
    expect(screen.getByTestId("create-review").props.value).toBe("14");
    // The start date is a picker row showing today in the shared format, not a free-text box.
    expect(screen.queryByPlaceholderText(/YYYY-MM-DD/)).toBeNull();
    expect(screen.getByTestId("create-start").props.accessibilityLabel).toMatch(/^Start date: \d{1,2} \w{3} \d{4}$/);
  });
});

describe("Create care plan: from a template", () => {
  it("pre-fills from the template, lets the nurse remove items and sends the template id", async () => {
    jest.spyOn(carePlansService, "getTemplate").mockResolvedValue(template());
    const create = jest.spyOn(carePlansService, "createPlan").mockResolvedValue(plan());
    await renderForm({ bookingId: BOOKING, templateId: TEMPLATE_ID });

    expect(await screen.findByTestId("create-goal-0")).toHaveTextContent(/Safe mobility and transfers/);
    expect(screen.getByTestId("create-task-1")).toHaveTextContent(/Evening 18:00 · Daily/);
    expect(screen.getByTestId("create-diagnosis").props.value).toBe("");
    expect(screen.getByTestId("create-duration").props.value).toBe("30");
    expect(screen.getByTestId("create-review").props.value).toBe("14");
    expect(screen.getByTestId("create-instructions").props.value).toBe("Follow the therapist's exercise sheet");
    expect(screen.getByText("Stroke Recovery template")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("create-goal-remove-1"));
    await fireEvent.press(screen.getByTestId("create-task-remove-0"));
    await type("create-diagnosis", "Placeholder diagnosis");
    await fireEvent.press(screen.getByTestId("create-submit"));

    await waitFor(() => expect(create).toHaveBeenCalled());
    const body = create.mock.calls[0]?.[1];
    expect(body?.template_id).toBe(TEMPLATE_ID);
    expect(body?.risk_level).toBe("high");
    expect(body?.goals).toHaveLength(1);
    expect(body?.tasks).toEqual([{ title: "Skin and pressure-point check", time_slot: "evening", time_of_day: "18:00", days_of_week: [1, 2, 3, 4, 5, 6, 7] }]);
    expect(body?.special_instructions).toEqual(["Follow the therapist's exercise sheet"]);
  });

  it("shows an error with retry when the template cannot be loaded", async () => {
    const get = jest.spyOn(carePlansService, "getTemplate").mockRejectedValueOnce(new Error("boom"));
    await renderForm({ bookingId: BOOKING, templateId: TEMPLATE_ID });
    expect(await screen.findByText("Try again")).toBeTruthy();
    get.mockResolvedValue(template());
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByTestId("create-goal-0")).toBeTruthy();
  });
});

describe("Create care plan: refusals", () => {
  const fillAndSubmit = async () => {
    await type("create-diagnosis", "Placeholder diagnosis typed by the nurse");
    await fireEvent.press(screen.getByTestId("risk-medium"));
    await fireEvent.press(screen.getByTestId("create-submit"));
  };

  it("opens the existing plan when the client already has one", async () => {
    jest.spyOn(carePlansService, "createPlan").mockRejectedValue(PLAN_EXISTS);
    await renderForm();
    await fillAndSubmit();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("CarePlanDetails", { planId: PLAN_ID }));
  });

  it("explains an unidentified client and keeps what was typed", async () => {
    jest.spyOn(carePlansService, "createPlan").mockRejectedValue(NOT_IDENTIFIED);
    await renderForm();
    await fillAndSubmit();
    expect(await screen.findByTestId("create-error")).toHaveTextContent(/We can't tell who this visit is for/);
    expect(screen.getByTestId("create-diagnosis").props.value).toBe("Placeholder diagnosis typed by the nurse");
  });

  it("says only nurses can change a plan on a 403", async () => {
    jest.spyOn(carePlansService, "createPlan").mockRejectedValue(NOT_A_NURSE);
    await renderForm();
    await fillAndSubmit();
    expect(await screen.findByTestId("create-error")).toHaveTextContent("Only nurses can change a care plan.");
  });

  it("shows the not-available notice on a 404", async () => {
    jest.spyOn(carePlansService, "createPlan").mockRejectedValue(NO_ACCESS);
    await renderForm();
    await fillAndSubmit();
    expect(await screen.findByTestId("care-plan-notice")).toBeTruthy();
    expect(screen.getByText("This care plan isn't available")).toBeTruthy();
    await fireEvent.press(screen.getByText("Go back"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("puts a server validation message under its field", async () => {
    jest.spyOn(carePlansService, "createPlan").mockRejectedValue(VALIDATION_DIAGNOSIS);
    await renderForm();
    await fillAndSubmit();
    expect(await screen.findByText("String should have at least 1 character")).toBeTruthy();
  });
});

describe("Success page", () => {
  const renderSuccess = (kind: "created" | "goal_added") =>
    renderWithClient(<CarePlanSuccess {...routeProps<React.ComponentProps<typeof CarePlanSuccess>>({ kind, planId: PLAN_ID })} />);

  it("after a plan is created, opens its details over the hub: the creation screens leave the stack (DP1-26)", async () => {
    await renderSuccess("created");
    expect(screen.getByTestId("success-title")).toHaveTextContent("Care plan created");
    await fireEvent.press(screen.getByText("View care plan"));
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    // What the dispatched action does to a real stack: hub, picker, form, success -> hub, plan.
    const action = mockDispatch.mock.calls[0]?.[0] as (state: unknown) => { payload: { routes: { name: string }[]; index: number } };
    const next = action({
      index: 3,
      routes: [{ name: "BottomNavigation" }, { name: "CarePlans" }, { name: "CarePlanClients" }, { name: "CreateCarePlan" }, { name: "CarePlanSuccess" }],
    });
    expect(next.payload.routes.map((r) => r.name)).toEqual(["BottomNavigation", "CarePlans", "CarePlanDetails"]);
    expect(next.payload.index).toBe(2);
  });

  it("after a goal is added, returns to the details underneath", async () => {
    await renderSuccess("goal_added");
    expect(screen.getByTestId("success-title")).toHaveTextContent("New Care Goal has been added");
    await fireEvent.press(screen.getByText("View Care Goal"));
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("routesAfterPlanCreated", () => {
  it("keeps what was under the creation flow, e.g. the client profile when started from there", () => {
    const routes = routesAfterPlanCreated(
      [{ name: "BottomNavigation" }, { name: "ClientProfile" }, { name: "CreateCarePlan" }, { name: "CarePlanSuccess" }],
      "p1",
    );
    expect(routes.map((r) => r.name)).toEqual(["BottomNavigation", "ClientProfile", "CarePlanDetails"]);
    expect(routes[2]?.params).toEqual({ planId: "p1" });
  });
});
