import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import AddVitals from "../src/screens/vitals/AddVitals";
import VitalDetail from "../src/screens/vitals/VitalDetail";
import VitalHistory from "../src/screens/vitals/VitalHistory";
import Vitals from "../src/screens/vitals/Vitals";
import { authService } from "../src/services/auth.service";
import { bookingService, type Booking } from "../src/services/booking.service";
import { clientsService } from "../src/services/clients.service";
import { heldReport, dropReport } from "../src/vitals/reportStore";
import { vitalsService, type PatientVital } from "../src/services/vitals.service";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
  useFocusEffect: jest.fn(),
}));

const PATIENT = "11111111-1111-4111-8111-111111111111";
const ACCESS_DENIED = new ApiError(403, { detail: "Access denied" }, "Forbidden");

const booking = (over: Partial<Booking>): Booking =>
  ({
    id: "b1",
    patient_id: PATIENT,
    status: "in_progress",
    patient_details: { full_name: "Placeholder Patient" },
    ...over,
  }) as Booking;

const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString().replace(/\.\d+Z$/, "");
const vital = (over: Partial<PatientVital>): PatientVital => ({
  id: `v-${Math.random()}`,
  patient_id: PATIENT,
  recorded_by_user_id: "user-1",
  vital_type: "heart_rate",
  value: "84",
  unit: "bpm",
  source: "manual",
  recorded_at: iso(1),
  notes: null,
  ...over,
});

const FLAG = {
  normal: { status: "normal", label: "Normal", reason: null, emergency: false, message: null },
  high: { status: "high", label: "High", reason: "Blood pressure above 140/90 mmHg.", emergency: false, message: null },
  low: { status: "low", label: "Low", reason: "Breathing rate below 12 per minute.", emergency: false, message: null },
  critical: { status: "critical", label: "Critical", reason: null, emergency: true, message: "This may be an emergency. Call 112 now." },
};

// react-query keeps a 5 minute garbage-collection timer per query; without clearing the clients the Jest process idles for
// five minutes after the last test before it exits.
const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((c) => c.clear()));

async function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

let alertSpy: jest.SpyInstance;
let listSpy: jest.SpyInstance;
beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  jest.spyOn(bookingService, "listActive").mockResolvedValue([booking({})]);
  listSpy = jest.spyOn(vitalsService, "list").mockResolvedValue([]);
  jest
    .spyOn(clientsService, "getClientProfile")
    .mockResolvedValue({ age: 32, gender: "male", profile_image_url: null } as Awaited<ReturnType<typeof clientsService.getClientProfile>>);
  jest.spyOn(authService, "getMe").mockResolvedValue({ id: "user-1" } as Awaited<ReturnType<typeof authService.getMe>>);
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  dropReport();
  await session.signOut();
});

describe("Vitals tab", () => {
  it("shows a spinner while the visits load", async () => {
    jest.spyOn(bookingService, "listActive").mockReturnValue(new Promise(() => undefined));
    await renderWith(<Vitals />);
    expect(screen.getByTestId("vitals-loading")).toBeTruthy();
  });

  it("says there is no active visit when the caregiver has none", async () => {
    jest.spyOn(bookingService, "listActive").mockResolvedValue([]);
    await renderWith(<Vitals />);
    expect(await screen.findByText("No active visit")).toBeTruthy();
    expect(screen.queryByTestId("add-readings")).toBeNull();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("shows 'available during an active visit' when visits are accepted but not started, and asks for nothing", async () => {
    jest.spyOn(bookingService, "listActive").mockResolvedValue([booking({ status: "accepted" }), booking({ id: "b2", status: "en_route" })]);
    await renderWith(<Vitals />);
    expect(await screen.findByText("Available during an active visit")).toBeTruthy();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it("shows the same state when the backend refuses with 403 (the visit just ended)", async () => {
    listSpy.mockRejectedValue(ACCESS_DENIED);
    await renderWith(<Vitals />);
    expect(await screen.findByText("Available during an active visit")).toBeTruthy();
    expect(screen.queryByTestId("vital-tile-heart_rate")).toBeNull();
  });

  it("shows the latest reading of each vital for the patient on the visit", async () => {
    listSpy.mockResolvedValue([
      vital({ id: "hr-new", value: "84", recorded_at: iso(1) }),
      vital({ id: "hr-old", value: "70", recorded_at: iso(30) }),
      vital({ id: "bp", vital_type: "blood_pressure", value: "138/85", unit: "mmHg", recorded_at: iso(2) }),
      vital({ id: "gl", vital_type: "blood_glucose", value: "110", unit: "mg/dL", notes: "FBS", recorded_at: iso(3) }),
    ]);
    await renderWith(<Vitals />);

    expect(await screen.findByTestId("vitals-patient-name")).toHaveTextContent("Placeholder Patient");
    expect(screen.getByTestId("vital-value-heart_rate")).toHaveTextContent("84");
    expect(screen.getByTestId("vital-value-blood_pressure")).toHaveTextContent("138/85");
    expect(screen.getByTestId("vital-value-blood_glucose")).toHaveTextContent("110");
    for (const kind of ["temperature", "respiratory_rate", "sleep_duration"]) {
      expect(screen.getByTestId(`vital-empty-${kind}`)).toHaveTextContent("No reading yet");
    }
    // These rows carry no flag (the server sent none): the app does not rate them itself.
    expect(screen.queryAllByTestId(/^vital-status-/)).toHaveLength(0);

    expect(listSpy).toHaveBeenCalledWith(PATIENT, expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/));
  });

  it("offers a switch between patients when two visits are in progress", async () => {
    jest
      .spyOn(bookingService, "listActive")
      .mockResolvedValue([booking({}), booking({ id: "b2", patient_id: "22222222-2222-4222-8222-222222222222", patient_details: { full_name: "Second Patient" } as Booking["patient_details"] })]);
    await renderWith(<Vitals />);
    await screen.findByTestId("vitals-patient-name");
    await fireEvent.press(screen.getByText("Second Patient"));
    await waitFor(() => expect(screen.getByTestId("vitals-patient-name")).toHaveTextContent("Second Patient"));
    expect(listSpy).toHaveBeenLastCalledWith("22222222-2222-4222-8222-222222222222", expect.any(String));
  });

  it("opened for one patient (client profile View all): shows that patient, no switcher, and a Back button (DP1-30)", async () => {
    const goBack = jest.fn();
    const second = "22222222-2222-4222-8222-222222222222";
    jest
      .spyOn(bookingService, "listActive")
      .mockResolvedValue([booking({}), booking({ id: "b2", patient_id: second, patient_details: { full_name: "Second Patient" } as Booking["patient_details"] })]);
    await renderWith(<Vitals patientId={second} onBack={goBack} />);
    expect(await screen.findByTestId("vitals-patient-name")).toHaveTextContent("Second Patient");
    expect(screen.queryByText("Placeholder Patient")).toBeNull();
    await fireEvent.press(screen.getByTestId("vitals-back"));
    expect(goBack).toHaveBeenCalled();
  });

  it("offers a retry on a server error and loads on the second try", async () => {
    listSpy.mockRejectedValueOnce(new ApiError(500, null, "boom"));
    await renderWith(<Vitals />);
    expect(await screen.findByText("Try again")).toBeTruthy();
    listSpy.mockResolvedValue([vital({})]);
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByTestId("vital-value-heart_rate")).toBeTruthy();
  });

  it("opens a vital's chart and the manual entry list", async () => {
    await renderWith(<Vitals />);
    await fireEvent.press(await screen.findByTestId("vital-tile-temperature"));
    expect(mockNavigate).toHaveBeenCalledWith("VitalDetail", { patientId: PATIENT, patientName: "Placeholder Patient", kind: "temperature" });
    await fireEvent.press(screen.getByTestId("add-readings"));
    expect(mockNavigate).toHaveBeenCalledWith("AddVitals", { patientId: PATIENT, patientName: "Placeholder Patient" });
  });

  it("fetches nothing until its tab is shown", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (active: boolean) => (
      <QueryClientProvider client={client}>
        <Vitals active={active} />
      </QueryClientProvider>
    );
    const view = await render(tree(false));
    await act(async () => undefined);
    expect(listSpy).not.toHaveBeenCalled();
    await view.rerender(tree(true));
    await waitFor(() => expect(listSpy).toHaveBeenCalled());
  });

  describe("report", () => {
    it("downloads into memory and opens the success page, which shares it (the CSV never goes in the route)", async () => {
      const csv = jest.spyOn(vitalsService, "downloadCsv").mockResolvedValue("id,vital_type\n1,heart_rate\n");
      await renderWith(<Vitals />);
      await fireEvent.press(await screen.findByText("Download Report"));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("VitalReportDownloaded", { patientId: PATIENT }));
      expect(csv).toHaveBeenCalledWith(PATIENT);
      expect(heldReport(PATIENT)).toBe("id,vital_type\n1,heart_rate\n");
      expect(heldReport("someone-else")).toBeNull();
    });

    it("keeps the one Download Report button: a report can only be shared after it is downloaded", async () => {
      await renderWith(<Vitals />);
      expect(await screen.findByText("Download Report")).toBeTruthy();
      expect(screen.queryByText(/Share Report/i)).toBeNull();
      expect(screen.queryByTestId("vitals-downloaded")).toBeNull();
    });

    it("explains a refused download in the same terms", async () => {
      jest.spyOn(vitalsService, "downloadCsv").mockRejectedValue(ACCESS_DENIED);
      await renderWith(<Vitals />);
      await fireEvent.press(await screen.findByText("Download Report"));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't download the report", "Reports are available during an active visit."));
      expect(mockNavigate).not.toHaveBeenCalledWith("VitalReportDownloaded", expect.anything());
    });
  });

  describe("Figma header and client row", () => {
    it("is titled Clients Vitals with + Add New Readings", async () => {
      await renderWith(<Vitals />);
      expect(await screen.findByText("Clients Vitals")).toBeTruthy();
      expect(await screen.findByText("Add New Readings")).toBeTruthy();
    });

    it("shows age and sex from the client profile and when the newest reading was taken", async () => {
      listSpy.mockResolvedValue([vital({ id: "hr", recorded_at: iso(1) })]);
      await renderWith(<Vitals />);
      expect(await screen.findByTestId("vitals-age-sex")).toHaveTextContent("32, Male");
      // The readings come from a second query: wait for them too.
      expect(await screen.findByTestId("vitals-last-updated")).toHaveTextContent(/^Last updated: /);
      expect(screen.queryByText("Patient")).toBeNull();
    });

    it("shows the name alone when the profile is not available, and no last-updated line without readings", async () => {
      jest.spyOn(clientsService, "getClientProfile").mockRejectedValue(new ApiError(404, null, "gone"));
      await renderWith(<Vitals />);
      expect(await screen.findByTestId("vitals-patient-name")).toHaveTextContent("Placeholder Patient");
      expect(screen.queryByTestId("vitals-age-sex")).toBeNull();
      expect(screen.queryByTestId("vitals-last-updated")).toBeNull();
    });

    it("draws no status on a tile whose reading has no flag", async () => {
      listSpy.mockResolvedValue([vital({ id: "hr" })]);
      await renderWith(<Vitals />);
      await screen.findByTestId("vital-value-heart_rate");
      expect(screen.queryByTestId("vital-status-heart_rate")).toBeNull();
    });

    it("shows the server's Normal / High / Low / Critical flag on each tile, and the 112 message on a critical one", async () => {
      listSpy.mockResolvedValue([
        vital({ id: "hr", value: "45", flag: { ...FLAG.critical, reason: "Heart rate below 50 bpm." } }),
        vital({ id: "bp", vital_type: "blood_pressure", value: "150/95", unit: "mmHg", flag: FLAG.high }),
        vital({ id: "rr", vital_type: "respiratory_rate", value: "10", unit: "breaths/min", flag: FLAG.low }),
        vital({ id: "t", vital_type: "temperature", value: "36.8", unit: "°C", flag: FLAG.normal }),
        vital({ id: "sl", vital_type: "sleep_duration", value: "5", unit: "hrs", flag: null }),
      ]);
      await renderWith(<Vitals />);
      await screen.findByTestId("vital-value-heart_rate");
      expect(screen.getByTestId("vital-status-heart_rate")).toHaveTextContent(/Critical/);
      expect(screen.getByTestId("vital-status-heart_rate-emergency")).toHaveTextContent(/Call 112 now/);
      expect(screen.getByTestId("vital-status-blood_pressure")).toHaveTextContent(/High/);
      expect(screen.getByTestId("vital-status-respiratory_rate")).toHaveTextContent(/Low/);
      expect(screen.getByTestId("vital-status-temperature")).toHaveTextContent(/Normal/);
      expect(screen.queryByTestId("vital-status-sleep_duration")).toBeNull(); // sleep is never flagged
      expect(screen.queryByTestId("vital-status-blood_glucose")).toBeNull(); // no reading yet
    });
  });
});

/** Readings drawn on the chart: a dot each, the newest one highlighted. */
const chartReadings = () => screen.queryAllByTestId("chart-point").length + screen.queryAllByTestId("chart-last-point").length;

describe("VitalDetail", () => {
  const route = (kind = "heart_rate") =>
    ({ params: { patientId: PATIENT, patientName: "Placeholder Patient", kind } }) as unknown as React.ComponentProps<typeof VitalDetail>["route"];
  const nav = {} as React.ComponentProps<typeof VitalDetail>["navigation"];

  beforeEach(() => {
    listSpy.mockResolvedValue([
      vital({ id: "a", value: "84", recorded_at: iso(1) }),
      vital({ id: "b", value: "76", recorded_at: iso(60) }),
      vital({ id: "c", value: "90", recorded_at: iso(24 * 20) }),
      vital({ id: "bp", vital_type: "blood_pressure", value: "138/85", unit: "mmHg" }),
    ]);
  });

  it("charts this vital only, with the latest value and its history", async () => {
    await renderWith(<VitalDetail route={route()} navigation={nav} />);
    expect(await screen.findByTestId("vital-chart")).toBeTruthy();
    expect(screen.getByTestId("vital-detail-current")).toHaveTextContent("84 bpm");
    // Week is the default: the 1 h and 60 h readings, not the 20-day one, and not the blood pressure.
    expect(chartReadings()).toBe(2);
    expect(screen.getByTestId("chart-last-point")).toBeTruthy();
    expect(screen.getAllByTestId("history-row")).toHaveLength(2);
    expect(screen.queryByText("138/85 mmHg")).toBeNull();
  });

  it("follows the Figma header and card: '<Vital> Monitoring', 'Vital Monitoring', the patient and Last synced on the card, Current", async () => {
    await renderWith(<VitalDetail route={route()} navigation={nav} />);
    await screen.findByTestId("vital-chart");
    expect(screen.getByText("Heart Rate Monitoring")).toBeTruthy();
    expect(screen.getByText("Vital Monitoring")).toBeTruthy();
    expect(screen.getByTestId("vital-detail-patient")).toHaveTextContent("Placeholder Patient");
    expect(screen.getByTestId("vital-detail-updated")).toHaveTextContent("Last synced: 1 hr ago");
    expect(screen.getByText("Current")).toBeTruthy();
    expect(screen.queryByText("Latest")).toBeNull();
    expect(screen.getByTestId("chart-last-label")).toHaveTextContent("84");
    expect(screen.getByText("History")).toBeTruthy();
  });

  it("names the respiratory rate as Figma does on its monitoring page", async () => {
    listSpy.mockResolvedValue([vital({ id: "rr", vital_type: "respiratory_rate", value: "16", unit: "breaths/min" })]);
    await renderWith(<VitalDetail route={route("respiratory_rate")} navigation={nav} />);
    expect(await screen.findByText("Respiratory Rate Monitoring")).toBeTruthy();
  });

  it("switches between Day, Week and Month", async () => {
    await renderWith(<VitalDetail route={route()} navigation={nav} />);
    await screen.findByTestId("vital-chart");
    await fireEvent.press(screen.getByTestId("range-day"));
    expect(chartReadings()).toBe(1);
    await fireEvent.press(screen.getByTestId("range-month"));
    expect(chartReadings()).toBe(3);
  });

  it("says so when a vital has no readings in the period", async () => {
    await renderWith(<VitalDetail route={route("temperature")} navigation={nav} />);
    expect(await screen.findByTestId("chart-empty")).toBeTruthy();
    expect(screen.getByTestId("vital-detail-current")).toHaveTextContent("No reading yet");
    expect(screen.getAllByText("No readings in this period").length).toBeGreaterThan(0);
  });

  it("shows 'available during an active visit' on 403 and offers a retry on other errors", async () => {
    listSpy.mockRejectedValue(ACCESS_DENIED);
    const first = await renderWith(<VitalDetail route={route()} navigation={nav} />);
    expect(await screen.findByText("Available during an active visit")).toBeTruthy();
    await first.unmount();

    listSpy.mockRejectedValue(new ApiError(0, null, "offline"));
    await renderWith(<VitalDetail route={route()} navigation={nav} />);
    expect(await screen.findByText("Try again")).toBeTruthy();
  });
});

describe("VitalDetail: blood pressure and sleep", () => {
  const route = (kind: string) =>
    ({ params: { patientId: PATIENT, patientName: "Placeholder Patient", kind } }) as unknown as React.ComponentProps<typeof VitalDetail>["route"];
  const nav = {} as React.ComponentProps<typeof VitalDetail>["navigation"];

  it("charts blood pressure as a line of the top number with the bottom number as a second line, and a hint", async () => {
    listSpy.mockResolvedValue([
      vital({ id: "bp1", vital_type: "blood_pressure", value: "138/85", unit: "mmHg", recorded_at: iso(1) }),
      vital({ id: "bp2", vital_type: "blood_pressure", value: "120/78", unit: "mmHg", recorded_at: iso(30) }),
      vital({ id: "hr", value: "84" }),
    ]);
    await renderWith(<VitalDetail route={route("blood_pressure")} navigation={nav} />);
    expect(await screen.findByTestId("vital-chart")).toBeTruthy();
    expect(chartReadings()).toBe(2);
    expect(screen.getByLabelText("120/78")).toBeTruthy();
    expect(screen.getByLabelText("Latest 138/85")).toBeTruthy();
    expect(screen.getByTestId("chart-pressure-hint")).toBeTruthy();
    expect(screen.getByTestId("vital-detail-current")).toHaveTextContent("138/85 mmHg");
  });

  it("does not show the pressure hint on other charts", async () => {
    listSpy.mockResolvedValue([vital({ id: "hr" })]);
    await renderWith(<VitalDetail route={route("heart_rate")} navigation={nav} />);
    await screen.findByTestId("vital-chart");
    expect(screen.queryByTestId("chart-pressure-hint")).toBeNull();
  });

  it("charts sleep in hours", async () => {
    listSpy.mockResolvedValue([vital({ id: "s", vital_type: "sleep_duration", value: "6.5", unit: "hrs" })]);
    await renderWith(<VitalDetail route={route("sleep_duration")} navigation={nav} />);
    expect(await screen.findByTestId("vital-detail-current")).toHaveTextContent("6.5 hrs");
    expect(chartReadings()).toBe(1);
  });

  it("shows the flag of the current reading, with the 112 message when it is critical", async () => {
    listSpy.mockResolvedValue([vital({ id: "bp", vital_type: "blood_pressure", value: "85/50", unit: "mmHg", flag: FLAG.critical })]);
    await renderWith(<VitalDetail route={route("blood_pressure")} navigation={nav} />);
    expect(await screen.findByTestId("vital-detail-status")).toHaveTextContent(/Critical/);
    expect(screen.getByTestId("vital-detail-status-emergency")).toHaveTextContent(/Call 112 now/);
  });

  it("opens the full history of this vital", async () => {
    await renderWith(<VitalDetail route={route("blood_pressure")} navigation={nav} />);
    await fireEvent.press(await screen.findByTestId("view-all-history"));
    expect(mockNavigate).toHaveBeenCalledWith("VitalHistory", { patientId: PATIENT, patientName: "Placeholder Patient", kind: "blood_pressure" });
  });
});

describe("VitalHistory flags", () => {
  const route = () =>
    ({ params: { patientId: PATIENT, patientName: "Placeholder Patient", kind: "heart_rate" } }) as unknown as React.ComponentProps<typeof VitalHistory>["route"];
  const nav = {} as React.ComponentProps<typeof VitalHistory>["navigation"];

  it("marks each row with the flag the server sent", async () => {
    listSpy.mockResolvedValue([
      vital({ id: "a", value: "110", flag: { ...FLAG.high, reason: "Heart rate above 100 bpm." }, recorded_at: iso(1) }),
      vital({ id: "b", value: "72", flag: FLAG.normal, recorded_at: iso(2) }),
    ]);
    await renderWith(<VitalHistory route={route()} navigation={nav} />);
    const marks = await screen.findAllByTestId("history-status");
    expect(marks.map((m) => m.props.accessibilityLabel)).toEqual(["High", "Normal"]);
  });
});

describe("VitalHistory (view all history)", () => {
  const route = (kind = "heart_rate") =>
    ({ params: { patientId: PATIENT, patientName: "Placeholder Patient", kind } }) as unknown as React.ComponentProps<typeof VitalHistory>["route"];
  const nav = {} as React.ComponentProps<typeof VitalHistory>["navigation"];

  it("asks for every reading, not just the last 30 days, and lists this vital grouped by day", async () => {
    listSpy.mockResolvedValue([
      vital({ id: "a", value: "84", recorded_at: iso(1) }),
      vital({ id: "b", value: "76", recorded_at: iso(2) }),
      vital({ id: "old", value: "90", recorded_at: iso(24 * 90) }),
      vital({ id: "bp", vital_type: "blood_pressure", value: "138/85", unit: "mmHg" }),
    ]);
    await renderWith(<VitalHistory route={route()} navigation={nav} />);
    expect(await screen.findAllByTestId("history-row")).toHaveLength(3);
    expect(listSpy).toHaveBeenCalledWith(PATIENT);
    expect(screen.getAllByTestId("history-day").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("90 bpm")).toBeTruthy();
    expect(screen.queryByText("138/85 mmHg")).toBeNull();
    expect(screen.getByText("Heart Rate history")).toBeTruthy();
  });

  it("shows the glucose context on its readings", async () => {
    listSpy.mockResolvedValue([vital({ vital_type: "blood_glucose", value: "110", unit: "mg/dL", notes: "FBS" })]);
    await renderWith(<VitalHistory route={route("blood_glucose")} navigation={nav} />);
    expect(await screen.findByText("Fasting")).toBeTruthy();
  });

  it("says so when there are no readings, and handles 403 and other errors", async () => {
    const empty = await renderWith(<VitalHistory route={route()} navigation={nav} />);
    expect(await screen.findByText("No readings yet")).toBeTruthy();
    await empty.unmount();

    listSpy.mockRejectedValue(ACCESS_DENIED);
    const denied = await renderWith(<VitalHistory route={route()} navigation={nav} />);
    expect(await screen.findByText("Available during an active visit")).toBeTruthy();
    await denied.unmount();

    listSpy.mockRejectedValue(new ApiError(0, null, "offline"));
    await renderWith(<VitalHistory route={route()} navigation={nav} />);
    expect(await screen.findByText("Try again")).toBeTruthy();
  });
});

describe("AddVitals (manual entry)", () => {
  const route = { params: { patientId: PATIENT, patientName: "Placeholder Patient" } } as unknown as React.ComponentProps<typeof AddVitals>["route"];
  const nav = {} as React.ComponentProps<typeof AddVitals>["navigation"];
  let createSpy: jest.SpyInstance;
  beforeEach(() => {
    createSpy = jest.spyOn(vitalsService, "create").mockResolvedValue(vital({}));
  });

  async function openEntry(kind: string) {
    await renderWith(<AddVitals route={route} navigation={nav} />);
    await fireEvent.press(screen.getByTestId(`entry-row-${kind}`));
    await screen.findByTestId("entry-close");
    // The caregiver's user id comes from /auth/me.
    await waitFor(() => expect(authService.getMe).toHaveBeenCalled());
  }

  it("is titled Add Manual Vital Readings, with the Figma row hints", async () => {
    await renderWith(<AddVitals route={route} navigation={nav} />);
    expect(screen.getByText("Add Manual Vital Readings")).toBeTruthy();
    expect(screen.getByTestId("entry-hint-heart_rate")).toHaveTextContent("Enter Heart Rate Manually");
  });

  it("the heart rate popup has the Figma title, sub-line and label, with the real unit (bpm, not the Figma 'pm')", async () => {
    await openEntry("heart_rate");
    expect(screen.getByTestId("entry-title")).toHaveTextContent("Heart Rate");
    expect(screen.getByTestId("entry-subtitle")).toHaveTextContent("Your Current Heart Rate");
    expect(screen.getByText("Enter Heart Rate (bpm)")).toBeTruthy();
    expect(screen.getByTestId("entry-icon")).toBeTruthy();
  });

  it("the blood pressure popup has one label over the two numbers", async () => {
    await openEntry("blood_pressure");
    expect(screen.getByTestId("entry-subtitle")).toHaveTextContent("Enter Blood Pressure Readings");
    expect(screen.getByTestId("entry-label")).toHaveTextContent("Enter Blood Pressure (mmHg)");
  });

  it("the respiratory rate popup is labelled for respiratory rate, not the Figma copy-paste 'Heart Rate'", async () => {
    await openEntry("respiratory_rate");
    expect(screen.getByTestId("entry-title")).toHaveTextContent("Respiratory Rate");
    expect(screen.getByText("Enter Respiratory Rate (breaths/min)")).toBeTruthy();
    expect(screen.queryByText("Enter Heart Rate (bpm)")).toBeNull();
  });

  it("lists the six vitals", async () => {
    await renderWith(<AddVitals route={route} navigation={nav} />);
    for (const kind of ["heart_rate", "blood_pressure", "temperature", "respiratory_rate", "blood_glucose", "sleep_duration"]) {
      expect(screen.getByTestId(`entry-row-${kind}`)).toBeTruthy();
    }
  });

  it("saves a heart rate for the patient, recorded by the caregiver, then marks the row saved", async () => {
    await openEntry("heart_rate");
    await fireEvent.changeText(screen.getByTestId("entry-value"), "82");
    await waitFor(() => expect(screen.getByText("Update Heart Rate")).toBeTruthy());
    await fireEvent.press(screen.getByText("Update Heart Rate"));
    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        patientId: PATIENT,
        recordedByUserId: "user-1",
        vital_type: "heart_rate",
        value: "82",
        unit: "bpm",
        notes: null,
      }),
    );
    await waitFor(() => expect(screen.queryByTestId("entry-close")).toBeNull());
    expect(screen.getByTestId("entry-hint-heart_rate")).toHaveTextContent("Saved");
  });

  it("does not send an invalid reading and says why", async () => {
    await openEntry("heart_rate");
    await fireEvent.changeText(screen.getByTestId("entry-value"), "abc");
    await fireEvent.press(screen.getByText("Update Heart Rate"));
    expect(await screen.findByTestId("entry-error")).toHaveTextContent("Enter a number for heart rate.");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("clears an old error as soon as the reading is edited (pass 2: the 300/20 message stayed over a valid 120/80)", async () => {
    createSpy.mockRejectedValue(new ApiError(0, null, "offline"));
    await openEntry("blood_pressure");
    await fireEvent.changeText(screen.getByTestId("entry-systolic"), "300");
    await fireEvent.changeText(screen.getByTestId("entry-diastolic"), "20");
    await fireEvent.press(screen.getByText("Update Blood Pressure"));
    expect(await screen.findByTestId("entry-error")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("entry-systolic"), "120");
    expect(screen.queryByTestId("entry-error")).toBeNull();
  });

  it("takes blood pressure as two numbers", async () => {
    await openEntry("blood_pressure");
    await fireEvent.changeText(screen.getByTestId("entry-systolic"), "120");
    await fireEvent.changeText(screen.getByTestId("entry-diastolic"), "80");
    await fireEvent.press(screen.getByText("Update Blood Pressure"));
    await waitFor(() => expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ vital_type: "blood_pressure", value: "120/80", unit: "mmHg" })));
  });

  it("takes glucose in mmol/L with when it was taken", async () => {
    await openEntry("blood_glucose");
    await fireEvent.press(screen.getByTestId("unit-mmol/L"));
    await fireEvent.press(screen.getByTestId("context-FBS"));
    await fireEvent.changeText(screen.getByTestId("entry-value"), "5.5");
    await fireEvent.press(screen.getByText("Update Blood Glucose"));
    await waitFor(() => expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ vital_type: "blood_glucose", value: "5.5", unit: "mmol/L", notes: "FBS" })));
  });

  it("takes temperature in °F when chosen", async () => {
    await openEntry("temperature");
    await fireEvent.press(screen.getByTestId("unit-°F"));
    await fireEvent.changeText(screen.getByTestId("entry-value"), "98.6");
    await fireEvent.press(screen.getByText("Update Temperature"));
    await waitFor(() => expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ value: "98.6", unit: "°F" })));
  });

  it("explains a 403 as 'during an active visit' and keeps the entry open", async () => {
    createSpy.mockRejectedValue(ACCESS_DENIED);
    await openEntry("sleep_duration");
    await fireEvent.changeText(screen.getByTestId("entry-value"), "6.5");
    await fireEvent.press(screen.getByText("Update Sleep Duration"));
    expect(await screen.findByTestId("entry-error")).toHaveTextContent(/while a visit with the patient is in progress/);
    expect(screen.getByTestId("entry-close")).toBeTruthy();
  });

  it("shows other failures with the standard wording", async () => {
    createSpy.mockRejectedValue(new ApiError(0, null, "offline"));
    await openEntry("respiratory_rate");
    await fireEvent.changeText(screen.getByTestId("entry-value"), "16");
    await fireEvent.press(screen.getByText("Update Respiratory Rate"));
    expect(await screen.findByTestId("entry-error")).toHaveTextContent(/Can't reach Oakly/);
  });

  it("closes without saving", async () => {
    await openEntry("heart_rate");
    await fireEvent.press(screen.getByTestId("entry-close"));
    await waitFor(() => expect(screen.queryByTestId("entry-close")).toBeNull());
    expect(createSpy).not.toHaveBeenCalled();
  });
});
