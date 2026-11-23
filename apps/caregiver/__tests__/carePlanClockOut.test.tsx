import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import CarePlanSuccess from "../src/screens/careplan/CarePlanSuccess";
import VisitFlow from "../src/screens/visit/VisitFlow";
import { carePlansService } from "../src/services/carePlans.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import { BOOKING, NO_ACCESS, PLAN_ID, visitPlan, visitSummary } from "../test-utils/carePlanFixtures";

jest.mock("../src/components/StatusBar/FocusedStatusBar", () => ({ __esModule: true, default: () => null }));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

const mockBookingStatus = { value: "in_progress" };
const mockComplete = jest.fn();
jest.mock("../src/hooks/queries", () => ({
  useBooking: () => ({
    data: {
      status: mockBookingStatus.value,
      patient_details: { full_name: "Placeholder Client" },
      patient_address: "1 Test Street",
      scheduled_date: "2026-10-28T10:00:00",
      channel: "app",
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useBookingAction: () => ({ isPending: false, mutate: mockComplete }),
}));

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: mockGoBack, replace: mockReplace } }),
}));

beforeEach(async () => {
  mockBookingStatus.value = "in_progress";
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockComplete.mockClear();
  mockGoBack.mockClear();
  mockReplace.mockClear();
  await session.signOut();
});

const navigate = jest.fn();
const renderVisit = () =>
  renderWithClient(
    <VisitFlow
      {...(({ route: { params: { bookingId: BOOKING } }, navigation: { popTo: jest.fn(), navigate, goBack: jest.fn() } }) as unknown as React.ComponentProps<typeof VisitFlow>)}
    />,
  );

/** Waits for the plan lookup that the screen starts on mount to finish (answer or failure) before "Complete visit" is pressed. */
const lookupDone = async (client: { getQueryState: (key: readonly unknown[]) => { status: string } | undefined }) => {
  await waitFor(() => expect(["success", "error"]).toContain(client.getQueryState(["visit-care-plan", BOOKING])?.status));
  // ...and for the screen to re-render with the answer.
  await act(async () => {});
};

const CLOCK_OUT_TITLE = "Are you sure you want to clock out of this appointment ?";

describe("Clock-out dialog (Complete visit)", () => {
  it("reminds the caregiver of the care plan inside the dialog, and lets them review it", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: visitSummary }));
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { client } = await renderVisit();
    await lookupDone(client);
    await fireEvent.press(screen.getByText("Complete visit"));
    expect(screen.getByText(CLOCK_OUT_TITLE)).toBeTruthy();
    expect(screen.getByTestId("dialog-notice")).toHaveTextContent(/can no longer tick tasks or add notes/);
    expect(alert).not.toHaveBeenCalled(); // no native alert any more

    await fireEvent.press(screen.getByText("Review care plan"));
    expect(navigate).toHaveBeenCalledWith("CarePlanDetails", { planId: PLAN_ID, from: "clock_out" });
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("still lets them clock out from the dialog", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: visitSummary }));
    const { client } = await renderVisit();
    await lookupDone(client);
    await fireEvent.press(screen.getByText("Complete visit"));
    await fireEvent.press(screen.getByText("Yes, Clock out"));
    expect(mockComplete).toHaveBeenCalledWith({ bookingId: BOOKING, action: "complete" }, expect.anything());
  });

  it("'No, Go Back' closes the dialog and completes nothing", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: null }));
    await renderVisit();
    await fireEvent.press(await screen.findByText("Complete visit"));
    await fireEvent.press(screen.getByText("No, Go Back"));
    expect(mockComplete).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText(CLOCK_OUT_TITLE)).toBeNull());
  });

  it.each([
    ["no plan yet", () => jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: null }))],
    ["a completed plan", () => jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: { ...visitSummary, status: "completed" } }))],
    ["no access to the plan", () => jest.spyOn(carePlansService, "getVisitPlan").mockRejectedValue(NO_ACCESS)],
    ["a failed lookup", () => jest.spyOn(carePlansService, "getVisitPlan").mockRejectedValue(new ApiError(0, null, "offline"))],
  ])("shows the plain dialog, without a care plan reminder, when there is %s", async (_name, arrange) => {
    arrange();
    const { client } = await renderVisit();
    await lookupDone(client);
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(screen.getByText(CLOCK_OUT_TITLE)).toBeTruthy();
    expect(screen.queryByText("Review care plan")).toBeNull();
    expect(screen.getByTestId("dialog-notice")).toHaveTextContent(/^This ends the visit/);
  });

  it("does not look up the plan before the visit is in progress", async () => {
    mockBookingStatus.value = "en_route";
    const get = jest.spyOn(carePlansService, "getVisitPlan");
    await renderVisit();
    expect(get).not.toHaveBeenCalled();
  });

  it("never blocks clocking out while the lookup is still loading", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockReturnValue(new Promise(() => {}));
    await renderVisit();
    await fireEvent.press(await screen.findByText("Complete visit"));
    expect(screen.getByText(CLOCK_OUT_TITLE)).toBeTruthy();
    await fireEvent.press(screen.getByText("Yes, Clock out"));
    expect(mockComplete).toHaveBeenCalled();
  });
});

describe("Success page: task added", () => {
  it("uses the shared page with the task wording and goes back to the details", async () => {
    await renderWithClient(<CarePlanSuccess {...routeProps<React.ComponentProps<typeof CarePlanSuccess>>({ kind: "task_added", planId: PLAN_ID })} />);
    expect(screen.getByTestId("success-title")).toHaveTextContent("New Daily Task added successfully");
    expect(screen.getByText("View Task")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("success-action"));
    expect(mockGoBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
