import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import { MEDICATION_NOTICE } from "../src/careplan/carePlanModel";
import CarePlanDetails from "../src/screens/careplan/CarePlanDetails";
import CarePlanSuccess from "../src/screens/careplan/CarePlanSuccess";
import { carePlansService } from "../src/services/carePlans.service";
import { clientsService } from "../src/services/clients.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import {
  INVALID_END_DATE,
  MEDICATION_A,
  MEDICATION_B,
  MEDICATION_VALIDATION_NAME,
  NOT_A_NURSE,
  NO_ACCESS,
  PLAN_EXISTS,
  PLAN_ID,
  PLAN_NOT_EDITABLE,
  dayView,
  medication,
  minimalMedication,
  notePage,
  plan,
  readOnlyPlan,
  stoppedMedication,
  versionConflict,
} from "../test-utils/carePlanFixtures";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: mockGoBack, replace: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
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

const renderDetails = () =>
  renderWithClient(<CarePlanDetails {...routeProps<React.ComponentProps<typeof CarePlanDetails>>({ planId: PLAN_ID })} />);

describe("Care plan details: medication schedules (the list and the notice)", () => {
  it("always shows the notice, with the words as the backend gives them, even with no medications", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    await renderDetails();
    expect(await screen.findByTestId("medication-notice")).toHaveTextContent(MEDICATION_NOTICE);
    expect(screen.getByTestId("medications-empty")).toHaveTextContent("No medications recorded yet.");
    expect(screen.queryByTestId("medications-stopped")).toBeNull();
  });

  it("shows the notice and the list to a caregiver who cannot edit, with no add button", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(readOnlyPlan({ medications: [medication()] }));
    await renderDetails();
    expect(await screen.findByTestId("medication-notice")).toHaveTextContent(MEDICATION_NOTICE);
    expect(screen.getByText("Placeholder medicine A")).toBeTruthy();
    expect(screen.queryByTestId("medication-add")).toBeNull();
  });

  it("shows each medicine as it was recorded: dose, schedule, reason, prescriber, dates and note", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan({ medications: [medication(), minimalMedication()] }));
    await renderDetails();
    expect(await screen.findByText("Placeholder medicine A")).toBeTruthy();
    expect(screen.getByText("500 mg · 1 tablet · oral")).toBeTruthy();
    expect(screen.getByText("Twice daily · 8:00 AM, 8:00 PM")).toBeTruthy();
    expect(screen.getByText("For: Placeholder reason")).toBeTruthy();
    expect(screen.getByText("Prescribed by Placeholder prescriber")).toBeTruthy();
    expect(screen.getByText("From 28 Oct 2026 to 25 Nov 2026")).toBeTruthy();
    expect(screen.getByText("Placeholder note")).toBeTruthy();
    // The minimal one: only what was recorded, no empty lines.
    expect(screen.getByText("Placeholder medicine B")).toBeTruthy();
    expect(screen.getByText("As needed")).toBeTruthy();
    expect(screen.getByText("From 28 Oct 2026")).toBeTruthy();
    expect(screen.queryByTestId("medications-empty")).toBeNull();
  });

  it("lists stopped medicines greyed under a Stopped heading, after the active ones, with when they were stopped", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan({ medications: [minimalMedication(), stoppedMedication()] }));
    await renderDetails();
    expect(await screen.findByTestId("medications-stopped")).toBeTruthy();
    expect(screen.getByText("Stopped")).toBeTruthy();
    expect(screen.getByTestId(`medication-stopped-${MEDICATION_A}`)).toHaveTextContent(/^Stopped 28 Oct, \d{2}:\d{2}$/);
    // A stopped medicine has no controls at all in this slice.
    expect(screen.queryByTestId(`medication-stopped-${MEDICATION_B}`)).toBeNull();
  });

  it("offers nothing that treats a medicine as an instruction: no reminders, no given ticks, no due or overdue", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan({ medications: [medication()] }));
    await renderDetails();
    await screen.findByText("Placeholder medicine A");
    expect(screen.queryByText(/remind(er)? me|overdue|due now|mark as given|next dose/i)).toBeNull();
    expect(screen.queryByTestId(`task-toggle-${MEDICATION_A}`)).toBeNull();
  });

  it("keeps the section out of the way of the read-only banner on a completed plan", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(readOnlyPlan({ status: "completed", medications: [medication()] }));
    await renderDetails();
    expect(await screen.findByTestId("details-read-only")).toBeTruthy();
    expect(screen.getByTestId("medication-notice")).toBeTruthy();
    expect(screen.getByText("Placeholder medicine A")).toBeTruthy();
    expect(screen.queryByTestId("medication-add")).toBeNull();
  });
});

describe("Care plan details: add medication (authors)", () => {
  const openModal = async () => {
    await fireEvent.press(await screen.findByTestId("medication-add"));
    expect(screen.getByTestId("medication-modal")).toBeTruthy();
  };

  it("adds a medicine with only a name and goes to the success page, sending no version", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest.spyOn(carePlansService, "addMedication").mockResolvedValue({ medication: minimalMedication(), plan_version: 2 });
    await renderDetails();
    await openModal();

    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(screen.getByText("Enter the name of the medicine.")).toBeTruthy();
    expect(add).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId("medication-name"), "  Placeholder medicine B ");
    await fireEvent.press(screen.getByTestId("medication-frequency-as_needed"));
    await fireEvent.press(screen.getByTestId("medication-save"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("CarePlanSuccess", { kind: "medication_added", planId: PLAN_ID }));
    expect(add).toHaveBeenCalledWith(PLAN_ID, { name: "Placeholder medicine B", frequency: "as_needed" });
    expect(screen.queryByTestId("medication-modal")).toBeNull();
  });

  it("sends every filled field, and the new medicine appears in the list from the server's answer", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest.spyOn(carePlansService, "addMedication").mockResolvedValue({ medication: medication(), plan_version: 2 });
    const { client } = await renderDetails();
    await openModal();
    const type = (id: string, text: string) => fireEvent.changeText(screen.getByTestId(id), text);
    await type("medication-name", "Placeholder medicine A");
    await type("medication-strength", "500 mg");
    await type("medication-dose-amount", "1");
    await type("medication-dose-unit", "tablet");
    await type("medication-route", "oral");
    await type("medication-reason", "Placeholder reason");
    await type("medication-prescribed-by", "Placeholder prescriber");
    await fireEvent.press(screen.getByTestId("medication-frequency-twice_daily"));
    await type("medication-times", "20:00, 08:00");
    await type("medication-start", "2026-10-28");
    await type("medication-end", "2026-11-25");
    await type("medication-note", "Placeholder note");
    await fireEvent.press(screen.getByTestId("medication-save"));

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    expect(add).toHaveBeenCalledWith(PLAN_ID, {
      name: "Placeholder medicine A",
      strength: "500 mg",
      dose_amount: "1",
      dose_unit: "tablet",
      route: "oral",
      reason: "Placeholder reason",
      prescribed_by: "Placeholder prescriber",
      note: "Placeholder note",
      frequency: "twice_daily",
      times_of_day: ["08:00", "20:00"],
      start_date: "2026-10-28",
      end_date: "2026-11-25",
    });
    // The cached plan took the new medicine and the new version (no reload was needed).
    await waitFor(() => expect(screen.getByText("Placeholder medicine A")).toBeTruthy());
    const cached = client.getQueryData<{ version: number; medications: unknown[] }>(["care-plan", PLAN_ID]);
    expect(cached?.version).toBe(2);
    expect(cached?.medications).toHaveLength(1);
  });

  it("checks the times and the dates before sending", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest.spyOn(carePlansService, "addMedication");
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.changeText(screen.getByTestId("medication-times"), "8am");
    await fireEvent.changeText(screen.getByTestId("medication-start"), "2026-11-25");
    await fireEvent.changeText(screen.getByTestId("medication-end"), "2026-10-28");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(screen.getByText(/24-hour format HH:MM/)).toBeTruthy();
    expect(screen.getByText("The end date can't be before the start date.")).toBeTruthy();
    expect(add).not.toHaveBeenCalled();
  });

  it("closes without saving and keeps nothing", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest.spyOn(carePlansService, "addMedication");
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.press(screen.getByTestId("medication-modal-close"));
    expect(screen.queryByTestId("medication-modal")).toBeNull();
    await openModal();
    expect(screen.getByTestId("medication-name").props.value).toBe("");
    expect(add).not.toHaveBeenCalled();
  });

  it("says only nurses can change a plan when the server refuses with not_a_nurse, and keeps the form", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addMedication").mockRejectedValue(NOT_A_NURSE);
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(await screen.findByTestId("medication-error")).toHaveTextContent("Only nurses can change a care plan.");
    expect(screen.getByTestId("medication-name").props.value).toBe("Placeholder medicine");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows the end-date refusal on the end date field and keeps the form", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addMedication").mockRejectedValue(INVALID_END_DATE);
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.changeText(screen.getByTestId("medication-end"), "2020-01-01");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(await screen.findByText("The end date can't be before the start date.")).toBeTruthy();
    expect(screen.getByTestId("medication-end").props.value).toBe("2020-01-01");
  });

  it("shows the server's words for another invalid_care_plan refusal above the button (the wording of the 40-medicine limit is an assumed shape: that case is not live in the guide)", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addMedication").mockRejectedValue(
      new ApiError(422, { detail: { code: "invalid_care_plan", message: "A plan can hold at most 40 active medications" } }, "A plan can hold at most 40 active medications"),
    );
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(await screen.findByTestId("medication-error")).toHaveTextContent("A plan can hold at most 40 active medications");
  });

  it("shows a field the server rejects on that field", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addMedication").mockRejectedValue(MEDICATION_VALIDATION_NAME);
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(await screen.findByText("String should have at least 1 character")).toBeTruthy();
  });

  it("shows an offline failure and lets the nurse try again; nothing is queued", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    const add = jest
      .spyOn(carePlansService, "addMedication")
      .mockRejectedValueOnce(new ApiError(0, null, "You're offline."))
      .mockResolvedValue({ medication: minimalMedication(), plan_version: 2 });
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine B");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(await screen.findByTestId("medication-error")).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId("medication-save"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("CarePlanSuccess", { kind: "medication_added", planId: PLAN_ID }));
    expect(add).toHaveBeenCalledTimes(2);
  });

  it("shows the notice and drops the plan when adding finds the visit has ended (404)", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addMedication").mockRejectedValue(NO_ACCESS);
    const { client } = await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(await screen.findByText("This care plan isn't available")).toBeTruthy();
    await waitFor(() => expect(client.getQueryData(["care-plan", PLAN_ID])).toBeUndefined());
  });

  it("reloads the plan when it was completed elsewhere, so the add button goes away", async () => {
    const get = jest.spyOn(carePlansService, "getPlan").mockResolvedValueOnce(plan()).mockResolvedValue(readOnlyPlan({ status: "completed" }));
    jest.spyOn(carePlansService, "addMedication").mockRejectedValue(PLAN_NOT_EDITABLE);
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.press(screen.getByTestId("medication-save"));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId("medication-add")).toBeNull());
    expect(screen.queryByTestId("medication-modal")).toBeNull();
  });

  it("keeps the newer plan if a version_conflict ever arrives (adding sends no version, so the shared handler is only a safety net)", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addMedication").mockRejectedValue(versionConflict(plan({ version: 5, medications: [medication()] })));
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(await screen.findByText("Placeholder medicine A")).toBeTruthy();
  });

  it("does not trust its cached version when the answer skips one: another nurse changed the plan, so it reloads", async () => {
    // Held version 1; the server answers 3, so version 2 (someone else's edit) is not in the cache.
    const get = jest.spyOn(carePlansService, "getPlan").mockResolvedValueOnce(plan({ version: 1 })).mockResolvedValue(plan({ version: 3, medications: [medication()] }));
    jest.spyOn(carePlansService, "addMedication").mockResolvedValue({ medication: medication(), plan_version: 3 });
    const { client } = await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine A");
    await fireEvent.press(screen.getByTestId("medication-save"));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(client.getQueryData<{ version: number }>(["care-plan", PLAN_ID])?.version).toBe(3));
  });

  it("takes the new version without a reload when the answer is exactly one past the cached one", async () => {
    const get = jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan({ version: 1 }));
    jest.spyOn(carePlansService, "addMedication").mockResolvedValue({ medication: medication(), plan_version: 2 });
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine A");
    await fireEvent.press(screen.getByTestId("medication-save"));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("sends one request when Add is pressed twice, and ignores Close while it is open", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    // The call must settle before the test ends (a pending mutation re-arms its gc timer and keeps a single-worker run alive).
    let resolve: (value: Awaited<ReturnType<typeof carePlansService.addMedication>>) => void = () => {};
    const add = jest.spyOn(carePlansService, "addMedication").mockReturnValue(new Promise((r) => (resolve = r)));
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine B");
    await fireEvent.press(screen.getByTestId("medication-save"));
    await fireEvent.press(screen.getByTestId("medication-save"));
    await fireEvent.press(screen.getByTestId("medication-modal-close"));
    expect(add).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("medication-modal")).toBeTruthy();
    await act(async () => resolve({ medication: minimalMedication(), plan_version: 2 }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("CarePlanSuccess", { kind: "medication_added", planId: PLAN_ID }));
  });

  it("clears a field's message when the nurse types in it again", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    await renderDetails();
    await openModal();
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(screen.getByText("Enter the name of the medicine.")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "P");
    expect(screen.queryByText("Enter the name of the medicine.")).toBeNull();
  });

  it("names every field for a screen reader", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    await renderDetails();
    await openModal();
    for (const id of ["name", "strength", "dose-amount", "dose-unit", "route", "reason", "prescribed-by", "times", "start", "end", "note"]) {
      expect(screen.getByTestId(`medication-${id}`).props.accessibilityLabel).toBeTruthy();
    }
  });

  it("does not treat another plan refusal as access lost", async () => {
    jest.spyOn(carePlansService, "getPlan").mockResolvedValue(plan());
    jest.spyOn(carePlansService, "addMedication").mockRejectedValue(PLAN_EXISTS);
    await renderDetails();
    await openModal();
    await fireEvent.changeText(screen.getByTestId("medication-name"), "Placeholder medicine");
    await fireEvent.press(screen.getByTestId("medication-save"));
    expect(await screen.findByTestId("medication-error")).toBeTruthy();
    expect(screen.queryByText("This care plan isn't available")).toBeNull();
  });
});

describe("Care plan success page: medication added", () => {
  it("says the medicine is recorded, promises nothing more, and returns to the plan", async () => {
    await renderWithClient(<CarePlanSuccess {...routeProps<React.ComponentProps<typeof CarePlanSuccess>>({ kind: "medication_added", planId: PLAN_ID })} />);
    expect(screen.getByTestId("success-title")).toHaveTextContent("Medication added successfully");
    expect(screen.getByText("The medication is now recorded on the client's care plan.")).toBeTruthy();
    expect(screen.queryByText(/remind/i)).toBeNull();
    await fireEvent.press(screen.getByTestId("success-action"));
    expect(screen.getByText("View Medications")).toBeTruthy();
    expect(mockGoBack).toHaveBeenCalled();
  });
});
