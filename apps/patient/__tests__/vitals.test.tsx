import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { toCreateBody, toReading, validateEntry } from "../src/domain/vitals";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { live, liveBody, liveReply } from "../test-utils/live";
import { capture } from "../test-utils/captures";
import { renderSignedIn } from "../test-utils/renderApp";

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

  describe("domain", () => {
    it("reads the captured rows: blood pressure as two numbers, glucose context and sleep times from notes, anything else dropped", () => {
      const rows = liveBody<any[]>("vitals-list");
      const readings = rows.map(toReading);
      const bp = readings.find((r) => r?.kind === "blood_pressure" && r.value === 120);
      expect(bp).toMatchObject({ value: 120, secondary: 80 });
      expect(readings.find((r) => r?.glucoseContext === "FBS")?.value).toBe(92);
      expect(readings.find((r) => r?.kind === "sleep_duration")).toMatchObject({ value: 7.5, sleepStart: "22:30", sleepWake: "06:00" });
      // the server accepted a "banana" vital with value "not a number": the app cannot show it, so it does not
      expect(rows.some((r) => r.vital_type === "banana")).toBe(true);
      expect(readings.filter((r) => r === null)).toHaveLength(1);
      expect(toReading({ ...rows[0], value: "12o/80" })).toBeNull();
    });

    it("builds a create body with the same keys as the captured request", () => {
      const captured = live("vital-blood-pressure").request.body as Record<string, unknown>;
      const body = toCreateBody({ kind: "blood_pressure", value: 120, secondary: 80 }, { patientId: PATIENT_ID, userId: USER_ID }, new Date("2026-11-07T15:33:58.737Z"));
      expect(Object.keys(body).sort()).toEqual(Object.keys(captured).sort());
      expect(body).toMatchObject({ vital_type: "blood_pressure", value: "120/80", unit: "mmHg", source: "manual", patient_id: PATIENT_ID, recorded_by_user_id: USER_ID });
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
      expect(validateEntry("sleep_duration", { start: "25:00", wake: "06:00" }).start).toBe("Enter a time like 22:30");
      expect(validateEntry("sleep_duration", { start: "22:30", wake: "22:30" }).wake).toMatch(/less than 30 minutes/);
      expect(validateEntry("sleep_duration", { start: "22:30", wake: "06:30" })).toEqual({});
    });
  });

  describe("screens", () => {
    it("shows the six tiles with the latest captured readings, units, and no sample notice; the id sent is the PATIENT id", async () => {
      const { calls, view } = await renderSignedIn({ [LIST]: () => liveReply("vitals-list") }, me());
      await tab("Vitals");
      for (const label of ["Heart rate", "Blood pressure", "Temperature", "Respiratory rate", "Blood glucose", "Sleep duration"]) {
        expect(await screen.findByRole("button", { name: label })).toBeTruthy();
      }
      expect(await screen.findByText("72")).toBeTruthy(); // heart rate
      expect(screen.getByText("36.8")).toBeTruthy();
      expect(screen.getByText("7.5")).toBeTruthy();
      expect(screen.getByText(/^mmHg ·/)).toBeTruthy();
      expect(screen.getByText(/^°C ·/)).toBeTruthy();
      expect(screen.getByText(/^mg\/dL ·/)).toBeTruthy();
      expect(screen.queryByText(/bpr|mgd\/dl| C$|banana/i)).toBeNull();
      expect(screen.queryByText(/shows sample information/)).toBeNull();
      expect(calls.find((c) => c.path.startsWith("/api/v1/vitals/"))?.path).toBe(`/api/v1/vitals/${PATIENT_ID}`);
      expect(calls.some((c) => c.path.includes(USER_ID) && c.path.includes("vitals"))).toBe(false);
      view.unmount();
    });

    it("shows 'No reading yet' on every tile for a patient with none (captured empty list)", async () => {
      const { view } = await renderSignedIn({ [LIST]: () => liveReply("vitals-empty") }, me());
      await tab("Vitals");
      await waitFor(() => expect(screen.getAllByText("No reading yet")).toHaveLength(6));
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

    it("blood pressure entry: checks the numbers first, then posts the captured shape and shows the new reading", async () => {
      let created = false;
      const { calls, view } = await renderSignedIn(
        {
          [LIST]: () => (created ? liveReply("vitals-list", (rows: any[]) => [...rows, { ...live("vital-blood-pressure").response.body, value: "118/76", recorded_at: new Date().toISOString().replace("Z", "") }]) : liveReply("vitals-empty")),
          "POST /api/v1/vitals/": () => {
            created = true;
            return liveReply("vital-blood-pressure", (b) => ({ ...b, value: "118/76" }));
          },
        },
        me(),
      );
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Blood pressure reading" }));
      await press("Save reading");
      expect(await screen.findAllByText("Enter a value")).toHaveLength(2);
      await type("Systolic, top number (mmHg)", "300");
      await type("Diastolic, bottom number (mmHg)", "20");
      await press("Save reading");
      expect(await screen.findByText("Enter a number from 50 to 260")).toBeTruthy();
      expect(calls.some((c) => c.method === "POST")).toBe(false);
      await type("Systolic, top number (mmHg)", "80");
      await type("Diastolic, bottom number (mmHg)", "120");
      await press("Save reading");
      expect(await screen.findByText("The bottom number must be lower than the top number")).toBeTruthy();
      await type("Systolic, top number (mmHg)", "118");
      await type("Diastolic, bottom number (mmHg)", "76");
      await press("Save reading");

      expect(await screen.findByText("118/76")).toBeTruthy();
      const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/vitals/");
      const captured = live("vital-blood-pressure").request.body as Record<string, unknown>;
      expect(Object.keys(post?.body as object).sort()).toEqual(Object.keys(captured).sort());
      expect(post?.body).toMatchObject({ vital_type: "blood_pressure", value: "118/76", unit: "mmHg", source: "manual", patient_id: PATIENT_ID, recorded_by_user_id: USER_ID });
      view.unmount();
    });

    it("glucose entry sends the context in notes (RBS random by default, FBS fasting), as the caregiver app does", async () => {
      const { calls, view } = await renderSignedIn(
        { [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-glucose-fasting") },
        me(),
      );
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Blood glucose reading" }));
      await type("Blood glucose (mg/dL)", "110");
      await press("Save reading");
      await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
      expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ vital_type: "blood_glucose", value: "110", unit: "mg/dL", notes: "RBS" });
      view.unmount();

      const second = await renderSignedIn(
        { [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-glucose-fasting") },
        me(),
      );
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Blood glucose reading" }));
      await press("Fasting");
      await type("Blood glucose (mg/dL)", "92");
      await press("Save reading");
      await waitFor(() => expect(second.calls.filter((c) => c.method === "POST")).toHaveLength(1));
      expect(second.calls.find((c) => c.method === "POST")?.body).toMatchObject({ value: "92", notes: "FBS" });
      second.view.unmount();
    });

    it("sleep entry takes bed and wake times, sends the hours as the value and the times in notes", async () => {
      const { calls, view } = await renderSignedIn(
        { [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-sleep") },
        me(),
      );
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Sleep duration reading" }));
      await type("Went to bed (24-hour time)", "22:30");
      await type("Woke up (24-hour time)", "22:30");
      await press("Save reading");
      expect(await screen.findByText(/less than 30 minutes of sleep/)).toBeTruthy();
      await type("Woke up (24-hour time)", "6:30");
      await press("Save reading");
      await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(1));
      expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ vital_type: "sleep_duration", value: "8", unit: "hrs", notes: "22:30-06:30" });
      view.unmount();
    });

    it("keeps the server's refusal in view: a 403 on save shows an error dialog, not success", async () => {
      const { view } = await renderSignedIn(
        { [LIST]: () => liveReply("vitals-empty"), "POST /api/v1/vitals/": () => liveReply("vital-wrong-patient") },
        me(),
      );
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Add Heart rate reading" }));
      await type("Heart rate (bpm)", "70");
      await press("Save reading");
      expect(await screen.findByText("Could not save")).toBeTruthy();
      expect(screen.getByText("Access denied")).toBeTruthy();
      view.unmount();
    });

    it("detail: Day / Week / Month change what is listed, from the readings' own times", async () => {
      const { view } = await renderSignedIn({ [LIST]: () => listAt(2) }, me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Blood glucose" }));
      // the captured list holds two glucose readings (random 110, fasting 92), both 2 hours old here
      expect(await screen.findByLabelText("Blood glucose chart, 2 readings")).toBeTruthy();
      view.unmount();
      const old = await renderSignedIn({ [LIST]: () => listAt(24 * 3) }, me());
      await tab("Vitals");
      await fireEvent.press(await screen.findByRole("button", { name: "Blood glucose" }));
      await fireEvent.press(await screen.findByRole("tab", { name: "Day" }));
      expect(screen.queryByLabelText(/Blood glucose chart/)).toBeNull();
      expect(screen.getByText("No readings in this period")).toBeTruthy();
      await fireEvent.press(screen.getByRole("tab", { name: "Week" }));
      expect(screen.getByLabelText("Blood glucose chart, 2 readings")).toBeTruthy();
      old.view.unmount();
    });

    it("history lists every shown reading with its glucose context and sleep times", async () => {
      const { view } = await renderSignedIn({ [LIST]: () => liveReply("vitals-list") }, me());
      await tab("Vitals");
      await press("History");
      expect(await screen.findByText("Heart rate: 72 bpm")).toBeTruthy();
      expect(screen.getByText("Fasting")).toBeTruthy();
      expect(screen.getByText("Random")).toBeTruthy();
      expect(screen.getByText("22:30 to 06:00")).toBeTruthy();
      expect(screen.queryByText(/shows sample information/)).toBeNull();
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
    const NAME: string = listCap.body[0].caregiver_name;
    const booking = (over: object = {}) => ({
      ...capture("023-p-bookings-list-accepted").body[0],
      caregiver_id: CAREGIVER_ID,
      caregiver_details: { ...capture("023-p-bookings-list-accepted").body[0].caregiver_details, full_name: NAME },
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

    it("lists nobody yet and offers the caregivers from the person's own bookings", async () => {
      const { view } = await open({ [ACCESS_LIST]: () => ({ status: 200, body: [] }) });
      expect(await screen.findByText("Nobody yet")).toBeTruthy();
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
