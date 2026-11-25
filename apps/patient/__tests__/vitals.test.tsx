import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { formatAgo, formatUpdated } from "../src/domain/format";
import { toFlag } from "../src/domain/vitalStatus";
import { convertUnit, durationLabel, entryToInputs, sleepHours, timeLabel, toCreateBody, toInsights, toReading, validateEntry } from "../src/domain/vitals";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { live, liveBody, liveReply } from "../test-utils/live";
import { capture } from "../test-utils/captures";
import { renderSignedIn } from "../test-utils/renderApp";

const mockShare = jest.fn(async (_uri: string, _options?: unknown) => undefined);
const mockWritten: string[] = [];
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: (...args: [string, unknown]) => mockShare(...args) }));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache/" },
  File: class {
    uri: string;
    constructor(dir: string, name: string) {
      this.uri = `${dir}${name}`;
    }
    create() {}
    write(text: string) {
      mockWritten.push(text);
    }
    delete() {}
  },
}));

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const tab = (name: string) => fireEvent.press(screen.getByRole("tab", { name }));
const type = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

const me = () => liveBody("me");
const PATIENT_ID: string = me().patient.id;
const USER_ID: string = me().id;
const LIST = `GET /api/v1/vitals/${PATIENT_ID}`;

/** The captured list, with every reading moved to `hoursAgo` (the backend sends zone-less UTC). */
const listAt = (hoursAgo: number) =>
  liveReply("vitals-list", (rows: any[]) =>
    rows.map((r) => ({ ...r, recorded_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString().replace("Z", "") })),
  );

describe("vitals (live-shaped)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());
  beforeEach(() => {
    mockShare.mockClear();
    mockWritten.length = 0;
  });

  const INSIGHTS = `GET /api/v1/vitals/${PATIENT_ID}/insights`;
  const DOWNLOAD = `GET /api/v1/vitals/${PATIENT_ID}/download`;
  /** The captured insights answer is the server's "Unable to analyze" stand-in (no Gemini key locally); the success shape below is not captured. */
  const insightsOk = () => ({ status: 200, body: { summary: "Your readings look steady.", concerns: ["Blood pressure was a little high on Monday."], recommendations: ["Aim for 7 to 8 hours of sleep."], key_vitals: ["blood_pressure"] } });

  describe("domain", () => {
    it("reads the captured rows: blood pressure as two numbers, units, glucose context and sleep times from notes, anything else dropped", () => {
      const rows = liveBody<any[]>("vitals-list");
      const readings = rows.map(toReading);
      const bp = readings.find((r) => r?.kind === "blood_pressure" && r.value === 120);
      expect(bp).toMatchObject({ value: 120, secondary: 80, unit: "mmHg" });
      expect(readings.find((r) => r?.glucoseContext === "FBS")).toMatchObject({ value: 92, unit: "mg/dL" });
      expect(readings.find((r) => r?.kind === "sleep_duration")).toMatchObject({ value: 7.5, sleepStart: "22:30", sleepWake: "06:00" });
      // the server accepted a "banana" vital with value "not a number": the app cannot show it, so it does not
      expect(rows.some((r) => r.vital_type === "banana")).toBe(true);
      expect(readings.filter((r) => r === null)).toHaveLength(1);
      expect(toReading({ ...rows[0], value: "12o/80" })).toBeNull();
      // a reading saved in °F keeps its unit
      expect(toReading({ ...rows.find((r) => r.vital_type === "temperature"), unit: "°F", value: "98.6" })).toMatchObject({ value: 98.6, unit: "°F" });
    });

    it("builds a create body with the same keys as the captured request", () => {
      const captured = live("vital-blood-pressure").request.body as Record<string, unknown>;
      const body = toCreateBody({ kind: "blood_pressure", value: 120, secondary: 80 }, { patientId: PATIENT_ID, userId: USER_ID }, new Date("2026-11-07T15:33:58.737Z"));
      expect(Object.keys(body).sort()).toEqual(Object.keys(captured).sort());
      expect(body).toMatchObject({ vital_type: "blood_pressure", value: "120/80", unit: "mmHg", source: "manual", patient_id: PATIENT_ID, recorded_by_user_id: USER_ID });
      expect(toCreateBody({ kind: "blood_glucose", value: 7.8, unit: "mmol/L", glucoseContext: "PP" }, { patientId: PATIENT_ID, userId: USER_ID })).toMatchObject({ value: "7.8", unit: "mmol/L", notes: "PP" });
    });

    it("refuses what the server accepted: 300/20 blood pressure (DP1-16)", () => {
      // the captured server answer: 200, stored as sent
      expect(live("vital-absurd-bp-accepted").response.status).toBe(200);
      expect(live("vital-absurd-bp-accepted").response.body.value).toBe("300/20");
      // the app's own check
      expect(validateEntry("blood_pressure", { value: "300", secondary: "20" })).toEqual({
        value: "Enter a number from 50 to 260",
        secondary: "Enter a number from 30 to 160",
      });
      expect(validateEntry("blood_pressure", { value: "90", secondary: "90" }).secondary).toBe("The bottom number must be lower than the top number");
      expect(validateEntry("blood_pressure", { value: "120", secondary: "80" })).toEqual({});
      expect(validateEntry("heart_rate", { value: "1e2" }).value).toBe("Enter a number from 20 to 250");
      expect(validateEntry("temperature", { value: "36,8" })).toEqual({});
      expect(validateEntry("sleep_duration", { start: "", wake: "06:00" }).start).toBe("Select a time");
      expect(validateEntry("sleep_duration", { start: "22:30", wake: "22:30" }).wake).toMatch(/less than 30 minutes/);
      expect(validateEntry("sleep_duration", { start: "22:30", wake: "06:30" })).toEqual({});
    });

    it("checks each unit against its own range (the server's: 30 to 45 °C or 86 to 113 °F, 20 to 600 mg/dL or 1.1 to 33.3 mmol/L)", () => {
      expect(validateEntry("temperature", { value: "98.6" }, "°C").value).toBe("Enter a number from 30 to 45");
      expect(validateEntry("temperature", { value: "98.6" }, "°F")).toEqual({});
      expect(validateEntry("temperature", { value: "36.8" }, "°F").value).toBe("Enter a number from 86 to 113");
      expect(validateEntry("blood_glucose", { RBS: "7.3" }, "mmol/L")).toEqual({});
      expect(validateEntry("blood_glucose", { RBS: "7.3" }, "mg/dL").RBS).toBe("Enter a number from 20 to 600");
      expect(validateEntry("blood_glucose", {}, "mg/dL")).toEqual({ RBS: "Enter at least one reading" });
      expect(validateEntry("blood_glucose", { RBS: "", FBS: "5.1", PP: "" }, "mmol/L")).toEqual({});
    });

    it("glucose sends one reading per filled box, each with its own context and the unit chosen; sleep sends the hours between the two times", () => {
      expect(entryToInputs("blood_glucose", { RBS: "7.3", FBS: "", PP: "4,1" }, "mmol/L")).toEqual([
        { kind: "blood_glucose", value: 7.3, unit: "mmol/L", glucoseContext: "RBS" },
        { kind: "blood_glucose", value: 4.1, unit: "mmol/L", glucoseContext: "PP" },
      ]);
      expect(entryToInputs("sleep_duration", { start: "22:00", wake: "5:00" })).toEqual([{ kind: "sleep_duration", value: 7, sleepStart: "22:00", sleepWake: "05:00" }]);
      expect(entryToInputs("temperature", { value: "98.6" }, "°F")).toEqual([{ kind: "temperature", value: 98.6, unit: "°F" }]);
      expect(entryToInputs("heart_rate", { value: "82" })).toEqual([{ kind: "heart_rate", value: 82 }]);
    });

    it("converts temperature and glucose between units, and writes times and durations as the design does", () => {
      expect(convertUnit("temperature", 98.6, "°F", "°C")).toBe(37);
      expect(convertUnit("temperature", 37, "°C", "°F")).toBe(98.6);
      expect(convertUnit("blood_glucose", 7.8, "mmol/L", "mg/dL")).toBe(141);
      expect(convertUnit("blood_glucose", 90, "mg/dL", "mmol/L")).toBe(5);
      expect(convertUnit("heart_rate", 72, "bpm", "bpm")).toBe(72);
      expect([timeLabel("22:00"), timeLabel("05:00"), timeLabel("00:15"), timeLabel("12:30")]).toEqual(["10:00 pm", "5:00 am", "12:15 am", "12:30 pm"]);
      expect([durationLabel(8), durationLabel(7.5), durationLabel(0.75), durationLabel(1)]).toEqual(["8 hours", "7 hours 30 minutes", "45 minutes", "1 hour"]);
      expect(sleepHours("22:00", "05:00")).toBe(7);
    });

    it("reads the AI's notes as sentences (summary, concerns, recommendations) and treats the 'Unable to analyze' stand-in as none", () => {
      expect(toInsights(liveBody("vitals-insights"))).toEqual([]);
      expect(toInsights(insightsOk().body)).toEqual(["Your readings look steady.", "Blood pressure was a little high on Monday.", "Aim for 7 to 8 hours of sleep."]);
      expect(toInsights({ summary: "Unable to analyze vitals.", concerns: ["Real concern."] })).toEqual(["Real concern."]);
      expect(toInsights({ concerns: [{ text: "From an object." }, 5, null], recommendations: "not a list" })).toEqual(["From an object."]);
      expect(toInsights(null)).toEqual([]);
      expect(toInsights("nope")).toEqual([]);
    });

    it("says how long ago a reading was, and when a tile was updated", () => {
      const now = new Date("2026-11-07T15:00:00");
      expect(formatAgo("2026-11-07T14:58:00", now.getTime())).toBe("2 mins ago");
      expect(formatAgo("2026-11-07T14:59:50", now.getTime())).toBe("just now");
      expect(formatAgo("2026-11-07T12:00:00", now.getTime())).toBe("3 hrs ago");
      expect(formatAgo("2026-11-05T15:00:00", now.getTime())).toBe("2 days ago");
      expect(formatUpdated("2026-11-07T10:45:00", now)).toBe("Updated at 10:45am");
      expect(formatUpdated("2026-11-07T22:05:00", now)).toBe("Updated at 10:05pm");
      expect(formatUpdated("2026-11-03T10:45:00", now)).toBe("Updated 3 Nov");
    });

    it("takes the rating from the server's flag and never works one out from a number", () => {
      const row = { ...liveBody<any[]>("vitals-list").find((r) => r.vital_type === "heart_rate") };
      expect(toReading({ ...row, value: "300" })?.flag).toBeNull(); // the captured rows carry no flag: unrated, not Normal
      expect(toReading({ ...row, value: "72" })?.flag).toBeNull();
      // a flag exactly as the API sends it (docs/fe-captures/vitals-flags/002 in the backend)
      const critical = { status: "critical", label: "Critical", reason: "Heart rate below 50 bpm. Contact the family and arrange an ambulance.", emergency: true, message: "This may be an emergency. Call 112 now." };
      expect(toReading({ ...row, value: "45", flag: critical })?.flag).toEqual(critical);
      expect(toFlag({ status: "urgent", label: "Urgent", emergency: false })).toBeNull(); // a status this build does not know
      expect(toFlag(null)).toBeNull();
    });
  });

  describe("screens", () => {
    const listRoutes = (extra: Record<string, any> = {}) => ({ [LIST]: () => liveReply("vitals-list"), [INSIGHTS]: () => liveReply("vitals-insights"), ...extra });

    it("shows the six tiles with the latest captured readings and units, no badges and no wearable parts; the id sent is the PATIENT id", async () => {
      const { calls, view } = await renderSignedIn(listRoutes(), me());
      await tab("Vitals");
      for (const label of ["Heart Rate", "Blood Pressure", "Temperature", "Respiration Rate", "Blood Glucose", "Sleep Duration"]) {
        expect(await screen.findByRole("button", { name: label })).toBeTruthy();
      }
      expect(screen.getByText("Real-time Health Metrics")).toBeTruthy();
      expect(await screen.findByText("72")).toBeTruthy(); // heart rate
      expect(screen.getByText("36.8")).toBeTruthy();
      expect(screen.getByText("7.5")).toBeTruthy();
      expect(screen.getByText("mmHg")).toBeTruthy();
      expect(screen.getByText("°C")).toBeTruthy();
      expect(screen.getByText("mg/dL")).toBeTruthy();
      expect(screen.getAllByText(/^Updated /).length).toBeGreaterThanOrEqual(5);
      // not built, or built and off
      expect(screen.queryByText(/Connect to Wearable|Wearable Device|Manual Device|Heart Alerts|Recent Caregiver Access/)).toBeNull();
      expect(screen.queryByText(/^(Normal|Critical)$/)).toBeNull();
      expect(screen.queryByText(/bpr|mgd\/dl|banana|shows sample information/i)).toBeNull();
      expect(calls.find((c) => c.path.startsWith("/api/v1/vitals/"))?.path).toBe(`/api/v1/vitals/${PATIENT_ID}`);
      expect(calls.some((c) => c.path.includes(USER_ID) && c.path.includes("vitals"))).toBe(false);
      view.unmount();
    });

    it("shows 'No reading yet' on every tile for a patient with none (captured empty list), and no insights are asked for", async () => {
      const { calls, view } = await renderSignedIn({ [LIST]: () => liveReply("vitals-empty") }, me());
      await tab("Vitals");
      await waitFor(() => expect(screen.getAllByText("No reading yet")).toHaveLength(6));
      expect(calls.some((c) => c.path.endsWith("/insights"))).toBe(false);
      view.unmount();
    });

    it("says so, and can retry, when the readings cannot be loaded (captured 403)", async () => {
      let fail = true;
      const { view } = await renderSignedIn({ [LIST]: () => (fail ? liveReply("vitals-list-other-patient") : liveReply("vitals-empty")) }, me());
      await tab("Vitals");
      expect(await screen.findByText("We couldn't load your vitals")).toBeTruthy();
      fail = false;
      await press("Try again");
      await waitFor(() => expect(screen.queryByText("We couldn't load your vitals")).toBeNull());
      view.unmount();
    });

    it("History & Insights on the home: the AI's first two notes with 'View all History' (not live: the success shape is not captured)", async () => {
      const { view } = await renderSignedIn(listRoutes({ [INSIGHTS]: insightsOk }), me());
      await tab("Vitals");
      expect(await screen.findByText("Your readings look steady.")).toBeTruthy();
      expect(screen.getByText("Blood pressure was a little high on Monday.")).toBeTruthy();
      expect(screen.queryByText("Aim for 7 to 8 hours of sleep.")).toBeNull();
      await press("View all History");
      expect(await screen.findByText("Aim for 7 to 8 hours of sleep.")).toBeTruthy();
      view.unmount();
    });

    it("blood pressure sheet: the design's title, help line and button, one '120 / 80' row; checks the numbers, then posts the captured shape and shows the new reading", async () => {
      let created = false;
      const { calls, view } = await renderSignedIn(
        {
          [LIST]: () => (created ? liveReply("vitals-list", (rows: any[]) => [...rows, { ...live("vital-blood-pressure").response.body, value: "118/76", recorded_at: new Date().toISOString().replace("Z", "") }]) : liveReply("vitals-empty")),
          [INSIGHTS]: () => liveReply("vitals-insights"),
          "POST /api/v1/vitals/": () => {
            created = true;
            return liveReply("vital-blood-pressure", (b) => ({ ...b, value: "118/76" }));
          },
        },
        me(),
      );
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Blood Pressure reading" }));
      expect(await screen.findByText("Enter Blood Pressure Readings")).toBeTruthy();
      expect(screen.getByText("Enter Blood Pressure (mmHg)")).toBeTruthy();
      await press("Update Blood Pressure");
      expect(await screen.findAllByText("Enter a value")).toHaveLength(2);
      await type("Systolic, top number (mmHg)", "300");
      await type("Diastolic, bottom number (mmHg)", "20");
      await press("Update Blood Pressure");
      expect(await screen.findByText("Enter a number from 50 to 260")).toBeTruthy();
      expect(calls.some((c) => c.method === "POST")).toBe(false);
      await type("Systolic, top number (mmHg)", "80");
      await type("Diastolic, bottom number (mmHg)", "120");
      await press("Update Blood Pressure");
      expect(await screen.findByText("The bottom number must be lower than the top number")).toBeTruthy();
      await type("Systolic, top number (mmHg)", "118");
      await type("Diastolic, bottom number (mmHg)", "76");
      await press("Update Blood Pressure");

      expect(await screen.findByText("118/76")).toBeTruthy();
      expect(screen.queryByText("Enter Blood Pressure Readings")).toBeNull(); // the sheet closed
      const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/vitals/");
      const captured = live("vital-blood-pressure").request.body as Record<string, unknown>;
      expect(Object.keys(post?.body as object).sort()).toEqual(Object.keys(captured).sort());
      expect(post?.body).toMatchObject({ vital_type: "blood_pressure", value: "118/76", unit: "mmHg", source: "manual", patient_id: PATIENT_ID, recorded_by_user_id: USER_ID });
      view.unmount();
    });

    it("heart rate sheet: 'Update Heart Rate', and Close leaves without sending anything", async () => {
      const { calls, view } = await renderSignedIn({ [LIST]: () => liveReply("vitals-empty") }, me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Heart Rate reading" }));
      expect(await screen.findByText("Your Current Heart Rate")).toBeTruthy();
      expect(screen.getByText("Enter Heart Rate (bpm)")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Update Heart Rate" })).toBeTruthy();
      await press("Close");
      await waitFor(() => expect(screen.queryByText("Your Current Heart Rate")).toBeNull());
      expect(calls.some((c) => c.method === "POST")).toBe(false);
      view.unmount();
    });

    it("glucose sheet: a unit choice and three boxes; each filled box is one reading with its context in notes and the unit chosen", async () => {
      const { calls, view } = await renderSignedIn({ [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-glucose-fasting") }, me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Blood Glucose reading" }));
      expect(await screen.findByText("Enter Blood Glucose Readings")).toBeTruthy();
      await press("Update Blood Glucose");
      expect(await screen.findByText("Enter at least one reading")).toBeTruthy();
      await fireEvent.press(screen.getByRole("checkbox", { name: "mmol/L" }));
      await type("Random Blood Sugar (RBS)", "7.3");
      await type("Post-prandial (2 hours after meal)", "4.1");
      await press("Update Blood Glucose");
      await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(2));
      const [first, second] = calls.filter((c) => c.method === "POST").map((c) => c.body);
      expect(first).toMatchObject({ vital_type: "blood_glucose", value: "7.3", unit: "mmol/L", notes: "RBS" });
      expect(second).toMatchObject({ vital_type: "blood_glucose", value: "4.1", unit: "mmol/L", notes: "PP" });
      view.unmount();

      const mg = await renderSignedIn({ [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-glucose-fasting") }, me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Blood Glucose reading" }));
      await type("Fasting Blood Sugar (FBS)", "92");
      await press("Update Blood Glucose");
      await waitFor(() => expect(mg.calls.filter((c) => c.method === "POST")).toHaveLength(1));
      expect(mg.calls.find((c) => c.method === "POST")?.body).toMatchObject({ value: "92", unit: "mg/dL", notes: "FBS" });
      mg.view.unmount();
    });

    it("sleep sheet: two time pickers, the hours between them shown, hours as the value and the times in notes", async () => {
      const { calls, view } = await renderSignedIn({ [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-sleep") }, me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Sleep Duration reading" }));
      expect(await screen.findByText("Enter your sleep duration and wake-up time.")).toBeTruthy();
      await press("Update Sleep Pattern");
      expect(await screen.findAllByText("Select a time")).toHaveLength(2);
      await press("Sleep Start Time");
      await press("10:00 pm");
      await press("Wake-Up Time");
      await press("5:00 am");
      expect(screen.getByLabelText("Total Sleep Duration (HRS/MINS)").props.value).toBe("7 hours");
      await press("Update Sleep Pattern");
      await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
      expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ vital_type: "sleep_duration", value: "7", unit: "hrs", notes: "22:00-05:00" });
      view.unmount();
    });

    it("temperature sheet: °C or °F, checked against that unit and sent with it", async () => {
      const { calls, view } = await renderSignedIn({ [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-temperature") }, me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Temperature reading" }));
      await type("Temperature Reading (°C)", "98.6");
      await press("Update Temperature");
      expect(await screen.findByText("Enter a number from 30 to 45")).toBeTruthy();
      await fireEvent.press(screen.getByRole("checkbox", { name: "°F" }));
      await type("Temperature Reading (°F)", "98.6");
      await press("Update Temperature");
      await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
      expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ vital_type: "temperature", value: "98.6", unit: "°F" });
      view.unmount();
    });

    it("keeps the server's refusal in view: a 403 on save shows an error dialog, not success", async () => {
      const { view } = await renderSignedIn(
        { [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-wrong-patient") },
        me(),
      );
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Heart Rate reading" }));
      await type("Enter Heart Rate (bpm)", "70");
      await press("Update Heart Rate");
      expect(await screen.findByText("Could not save")).toBeTruthy();
      expect(screen.getByText("Access denied")).toBeTruthy();
      view.unmount();
    });

    it("monitoring page: '<Vital> Monitoring', last synced, the chart, current value, and Day / Week / Month from the readings' own times", async () => {
      const { view } = await renderSignedIn(listRoutes({ [LIST]: () => listAt(2) }), me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Blood Glucose" }));
      expect(await screen.findByText("Blood Glucose Monitoring")).toBeTruthy();
      expect(screen.getByText("Vital Monitoring")).toBeTruthy();
      expect(screen.getByText(/^Last synced: 2 hrs ago$/)).toBeTruthy();
      expect(screen.getByText("Current")).toBeTruthy();
      // the captured list holds two glucose readings (random 110, fasting 92), both 2 hours old here
      expect(await screen.findByLabelText("Blood Glucose chart, 2 readings")).toBeTruthy();
      expect(screen.queryByText(/^(Normal|Critical)$/)).toBeNull();
      view.unmount();

      const old = await renderSignedIn(listRoutes({ [LIST]: () => listAt(24 * 3) }), me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Blood Glucose" }));
      await fireEvent.press(await screen.findByRole("tab", { name: "Day" }));
      expect(screen.queryByLabelText(/Blood Glucose chart/)).toBeNull();
      expect(screen.getByText("No readings in this period")).toBeTruthy();
      await fireEvent.press(screen.getByRole("tab", { name: "Week" }));
      expect(screen.getByLabelText("Blood Glucose chart, 2 readings")).toBeTruthy();
      old.view.unmount();
    });

    it("a temperature saved in °F is drawn in the unit of the latest reading", async () => {
      const rows = (hoursAgo: number, value: string, unit: string) => ({
        ...liveBody<any[]>("vitals-list").find((r) => r.vital_type === "temperature"),
        id: `${hoursAgo}-${value}`,
        value,
        unit,
        recorded_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString().replace("Z", ""),
      });
      const { view } = await renderSignedIn(listRoutes({ [LIST]: () => ({ status: 200, body: [rows(5, "36.8", "°C"), rows(1, "98.6", "°F")] }) }), me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Temperature" }));
      expect(await screen.findByLabelText("Temperature chart, 2 readings")).toBeTruthy();
      // the value under "Current" and the marker on the chart
      expect(screen.getAllByText("98.6")).toHaveLength(2);
      expect(screen.getByText("°F")).toBeTruthy();
      view.unmount();
    });

    describe("flags", () => {
      // The flags are the ones the backend returned in docs/fe-captures/vitals-flags (001, 002, 003, 004, 010).
      const flagged = (kind: string, value: string, unit: string, flag: any) => ({
        ...liveBody<any[]>("vitals-list").find((r) => r.vital_type === kind),
        id: `flag-${kind}`,
        value,
        unit,
        flag,
        recorded_at: new Date(Date.now() - 3_600_000).toISOString().replace("Z", ""),
      });
      const FLAGS = {
        critical: { status: "critical", label: "Critical", reason: "Heart rate below 50 bpm. Contact the family and arrange an ambulance.", emergency: true, message: "This may be an emergency. Call 112 now." },
        normal: { status: "normal", label: "Normal", reason: null, emergency: false, message: null },
        low: { status: "low", label: "Low", reason: "Blood pressure below 100/60 mmHg.", emergency: false, message: null },
        high: { status: "high", label: "High", reason: "Heart rate above 100 bpm. Tell the family or the patient's doctor for a medical review.", emergency: false, message: null },
      };

      it("draws Normal / High / Low / Critical on the tiles, the 112 message on a critical one, and nothing on sleep", async () => {
        const body = [
          flagged("heart_rate", "45", "bpm", FLAGS.critical),
          flagged("blood_pressure", "96/58", "mmHg", FLAGS.low),
          flagged("temperature", "36.8", "°C", FLAGS.normal),
          flagged("respiratory_rate", "22", "breaths/min", { ...FLAGS.high, reason: "Breathing rate above 20 per minute." }),
          flagged("sleep_duration", "5", "hrs", null),
        ];
        const { view } = await renderSignedIn(listRoutes({ [LIST]: () => ({ status: 200, body }) }), me());
        await tab("Vitals");
        expect(await screen.findByTestId("vital-status-heart_rate")).toHaveTextContent(/Critical/);
        expect(screen.getByTestId("vital-status-heart_rate-emergency")).toHaveTextContent(/Call 112 now/);
        expect(screen.getByTestId("vital-status-blood_pressure")).toHaveTextContent(/Low/);
        expect(screen.getByTestId("vital-status-temperature")).toHaveTextContent(/Normal/);
        expect(screen.getByTestId("vital-status-respiratory_rate")).toHaveTextContent(/High/);
        expect(screen.queryByTestId("vital-status-sleep_duration")).toBeNull();
        expect(screen.queryByTestId("vital-status-blood_glucose")).toBeNull();
        view.unmount();
      });

      it("shows the flag on the monitoring page, with the 112 message when critical", async () => {
        const body = [flagged("heart_rate", "45", "bpm", FLAGS.critical)];
        const { view } = await renderSignedIn(listRoutes({ [LIST]: () => ({ status: 200, body }) }), me());
        await tab("Vitals");
        await fireEvent.press(await screen.findByRole("button", { name: "Heart Rate" }));
        expect(await screen.findByTestId("vital-detail-status")).toHaveTextContent(/Critical/);
        expect(screen.getByTestId("vital-detail-status-emergency")).toHaveTextContent(/Call 112 now/);
        view.unmount();
      });

      it("marks each reading in the history with its flag", async () => {
        const body = [flagged("heart_rate", "110", "bpm", FLAGS.high), { ...flagged("temperature", "36.8", "°C", FLAGS.normal), id: "t" }];
        const { view } = await renderSignedIn(listRoutes({ [LIST]: () => ({ status: 200, body }), [INSIGHTS]: insightsOk }), me());
        await tab("Vitals");
        await fireEvent.press(await screen.findByRole("button", { name: "View all History" }));
        const marks = await screen.findAllByTestId("history-status");
        expect(marks.map((m) => m.props.accessibilityLabel).sort()).toEqual(["Status: High", "Status: Normal"]);
        view.unmount();
      });
    });

    it("history shows the AI's notes first, then every shown reading with its glucose context and sleep times", async () => {
      const { view } = await renderSignedIn(listRoutes({ [INSIGHTS]: insightsOk }), me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "View all History" }));
      expect(await screen.findByText("Aim for 7 to 8 hours of sleep.")).toBeTruthy();
      expect(await screen.findByText("Heart Rate: 72 bpm")).toBeTruthy();
      expect(screen.getByText("Fasting")).toBeTruthy();
      expect(screen.getByText("Random")).toBeTruthy();
      expect(screen.getByText("22:30 to 06:00")).toBeTruthy();
      expect(screen.queryByText(/shows sample information/)).toBeNull();
      view.unmount();
    });

    it("history with only the 'Unable to analyze' stand-in shows no notes, just the readings", async () => {
      const { view } = await renderSignedIn(listRoutes(), me());
      await tab("Vitals");
      await press("History");
      expect(await screen.findByText("Heart Rate: 72 bpm")).toBeTruthy();
      expect(screen.queryByText(/Unable to analy/)).toBeNull();
      view.unmount();
    });

    it("Download Report: fetches the CSV for the PATIENT id, hands it to the share sheet, then shows the success page (not live: no CSV capture)", async () => {
      const { calls, view } = await renderSignedIn(listRoutes({ [DOWNLOAD]: () => ({ status: 200, body: "type,value,unit,recorded_at" }) }), me());
      await tab("Vitals");
      await press("Download Report");
      expect(await screen.findByText("Vital Report Downloaded Successfully")).toBeTruthy();
      expect(calls.some((c) => c.method === "GET" && c.path === `/api/v1/vitals/${PATIENT_ID}/download`)).toBe(true);
      expect(mockShare).toHaveBeenCalledTimes(1);
      expect(mockWritten.join("")).toContain("type,value,unit,recorded_at");
      await press("Close");
      await waitFor(() => expect(screen.queryByText("Vital Report Downloaded Successfully")).toBeNull());
      view.unmount();
    });

    it("Download Report: a refusal (403) says so and shows no success page", async () => {
      const { view } = await renderSignedIn(listRoutes({ [DOWNLOAD]: () => liveReply("vitals-list-other-patient") }), me());
      await tab("Vitals");
      await press("Download Report");
      expect(await screen.findByText("Could not download your report")).toBeTruthy();
      expect(screen.queryByText("Vital Report Downloaded Successfully")).toBeNull();
      expect(mockShare).not.toHaveBeenCalled();
      view.unmount();
    });
  });

  describe("who can see my vitals (the backend's grant / list / revoke, fixed in backend #43)", () => {
    const GRANT = "POST /api/v1/vitals/access/grant";
    const REVOKE = "POST /api/v1/vitals/access/revoke";
    const ACCESS_LIST = "GET /api/v1/vitals/access/list";
    const BOOKINGS = "GET /api/v1/booking/patient/bookings";
    // Real answers from `backend/docs/fe-captures/patient-profile-vitals` (copied to `test-utils/captures`). Their ids are the
    // backend run's own; the screen is driven with the same ones so the request bodies can be compared exactly.
    const grantCap = capture("pv-301-grant");
    // `capture()` returns only the response; the request body of the grant is in the same file.
    const GRANT_BODY = require("../test-utils/captures/pv-301-grant.json").request.body;
    const listCap = capture("pv-303-patient-lists-grants");
    const revokeCap = capture("pv-320-revoke");
    const CAREGIVER_ID: string = grantCap.body.caregiver_id;
    const FULL_NAME: string = listCap.body[0].caregiver_name; // "Placeholder Caregiver Edited"
    // This screen (and no other) shows the first name and the last initial (P1-13).
    const NAME = "Placeholder E.";
    const booking = (over: object = {}) => ({
      ...capture("023-p-bookings-list-accepted").body[0],
      caregiver_id: CAREGIVER_ID,
      caregiver_details: { ...capture("023-p-bookings-list-accepted").body[0].caregiver_details, full_name: FULL_NAME },
      ...over,
    });
    // `/auth/me` of the capture run's patient, so the request carries the patient id the capture used.
    const meForGrant = () => ({ ...me(), patient: { ...me().patient, id: grantCap.body.patient_id } });
    const open = async (extra: Record<string, any> = {}) => {
      const rendered = await renderSignedIn({ [LIST]: () => liveReply("vitals-empty"), [BOOKINGS]: () => ({ status: 200, body: [booking()] }), ...extra }, meForGrant());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Who can see my vitals" }));
      return rendered;
    };

    it("lists nobody yet and offers the caregivers from the person's own bookings, by first name and last initial", async () => {
      const { view } = await open({ [ACCESS_LIST]: () => ({ status: 200, body: [] }) });
      expect(await screen.findByText("Nobody yet")).toBeTruthy();
      expect(await screen.findByText(NAME)).toBeTruthy();
      expect(screen.queryByText(FULL_NAME)).toBeNull();
      expect(await screen.findByRole("button", { name: `Share my vitals with ${NAME}` })).toBeTruthy();
      expect(screen.queryByText("Coming soon")).toBeNull();
      view.unmount();
    });

    it("asks before sharing (the warning names the caregiver), then sends the PROFILE ids and shows them as sharing", async () => {
      let shared = false;
      const { calls, view } = await open({
        [ACCESS_LIST]: () => ({ status: 200, body: shared ? listCap.body : [] }),
        [GRANT]: () => {
          shared = true;
          return { status: grantCap.status, body: grantCap.body };
        },
      });
      await fireEvent.press(await screen.findByRole("button", { name: `Share my vitals with ${NAME}` }));
      expect(await screen.findByText("Share your vitals?")).toBeTruthy();
      expect(screen.getByText(`${NAME} will be able to see and add to your vitals until you stop sharing.`)).toBeTruthy();
      expect(calls.some((c) => c.path === "/api/v1/vitals/access/grant")).toBe(false); // nothing sent until confirmed
      await press("Share");
      expect(await screen.findByText(`You're now sharing your vitals with ${NAME}.`)).toBeTruthy();
      expect(calls.find((c) => c.path === "/api/v1/vitals/access/grant")?.body).toEqual(GRANT_BODY);
      // The list is read again: the caregiver moves from "share with" to "sharing now".
      expect(await screen.findByRole("button", { name: `Stop sharing with ${NAME}` })).toBeTruthy();
      expect(screen.queryByRole("button", { name: `Share my vitals with ${NAME}` })).toBeNull();
      view.unmount();
    });

    it("stopping asks first, sends the same ids, and says it took effect at once but a visit in progress still counts", async () => {
      let active = true;
      const { calls, view } = await open({
        [ACCESS_LIST]: () => ({ status: 200, body: active ? listCap.body : [] }),
        [REVOKE]: () => {
          active = false;
          return { status: revokeCap.status, body: revokeCap.body };
        },
      });
      await fireEvent.press(await screen.findByRole("button", { name: `Stop sharing with ${NAME}` }));
      expect(await screen.findByText("Stop sharing?")).toBeTruthy();
      await fireEvent.press(screen.getAllByRole("button", { name: "Stop sharing" }).at(-1) as never);
      expect(await screen.findByText(/It took effect straight away\. They can still see your vitals while a visit of theirs with you is in progress\./)).toBeTruthy();
      expect(calls.find((c) => c.path === "/api/v1/vitals/access/revoke")?.body).toEqual(GRANT_BODY);
      expect(await screen.findByText("Nobody yet")).toBeTruthy();
      view.unmount();
    });

    it("cancelling the confirmation sends nothing", async () => {
      const { calls, view } = await open({ [ACCESS_LIST]: () => ({ status: 200, body: [] }) });
      await fireEvent.press(await screen.findByRole("button", { name: `Share my vitals with ${NAME}` }));
      await screen.findByText("Share your vitals?");
      await press("Cancel");
      await waitFor(() => expect(screen.queryByText("Share your vitals?")).toBeNull());
      expect(calls.some((c) => c.path === "/api/v1/vitals/access/grant")).toBe(false);
      view.unmount();
    });

    it("an unknown caregiver (404 'Caregiver not found.') and a revoke with nothing to revoke are said plainly", async () => {
      const gone = capture("pv-312-grant-unknown-caregiver");
      expect(gone.status).toBe(404);
      const nothing = capture("pv-322-revoke-again");
      expect(nothing.status).toBe(404);
      const { view } = await open({
        [ACCESS_LIST]: () => ({ status: 200, body: [] }),
        [GRANT]: () => ({ status: gone.status, body: gone.body }),
      });
      await fireEvent.press(await screen.findByRole("button", { name: `Share my vitals with ${NAME}` }));
      await press("Share");
      expect(await screen.findByText("We couldn't find that caregiver any more, so nothing was shared.")).toBeTruthy();
      view.unmount();

      const second = await open({
        [ACCESS_LIST]: () => ({ status: 200, body: listCap.body }),
        [REVOKE]: () => ({ status: nothing.status, body: nothing.body }),
      });
      await fireEvent.press(await screen.findByRole("button", { name: `Stop sharing with ${NAME}` }));
      await fireEvent.press(screen.getAllByRole("button", { name: "Stop sharing" }).at(-1) as never);
      expect(await screen.findByText("You had already stopped sharing with this caregiver.")).toBeTruthy();
      second.view.unmount();
    });

    it("leaves out cancelled bookings and caregivers already shared with, and says what appears here when nobody is left", async () => {
      const { view } = await open({
        [BOOKINGS]: () => ({ status: 200, body: [booking({ status: "cancelled" })] }),
        [ACCESS_LIST]: () => ({ status: 200, body: [] }),
      });
      expect(await screen.findByText(/Caregivers you have had a visit with will appear here/)).toBeTruthy();
      expect(screen.queryByRole("button", { name: `Share my vitals with ${NAME}` })).toBeNull();
      view.unmount();
    });

    it("a failed list read says so and can retry", async () => {
      let fail = true;
      const { view } = await open({ [ACCESS_LIST]: () => (fail ? { status: 403, body: { detail: "Access denied" } } : { status: 200, body: [] }) });
      expect(await screen.findByText("We couldn't load who can see your vitals")).toBeTruthy();
      fail = false;
      await fireEvent.press(screen.getAllByRole("button", { name: "Try again" })[0]);
      expect(await screen.findByText("Nobody yet")).toBeTruthy();
      view.unmount();
    });
  });
});
