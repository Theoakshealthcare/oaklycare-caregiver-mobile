// Captures REAL responses for the patient app's live tracking and chat screens from a running Oakly backend and writes one JSON
// file per call to __tests__/fixtures/live/ (numbered from 63, after the notifications / profile / vitals / FallGuard captures;
// `capture-live.mjs` owns 01-62 and wipes the folder, so run this one AFTER it, never before).
//
//   PATIENT_PASSWORD=<seeded password> node apps/patient/scripts/capture-tracking-chat.mjs --api http://127.0.0.1:8001 --ctl http://127.0.0.1:9913 --pg oakly-p9-pg
//
// What it needs: the API on a scratch database (never a real one) and the small control server of the simulator runs (a fake
// Paystack, plus /ctl/accept, /ctl/onmyway, /ctl/move, /ctl/start, /ctl/chat that act as the assigned caregiver through the real
// caregiver endpoints). It reads a 5-digit email code from the `users` table and deletes one `caregiver_locations` row through
// `docker exec <pg> psql`: both are labelled "seeded" in the file's note. Everything is a placeholder (example.com, a throwaway
// password, JWTs replaced by "<jwt>").
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const API = flag("--api", "http://127.0.0.1:8001").replace(/\/+$/, "");
const CTL = flag("--ctl", "http://127.0.0.1:9913").replace(/\/+$/, "");
const PG = flag("--pg", "oakly-p9-pg");
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../__tests__/fixtures/live");
// The throwaway password of the seeded local patient (the simulator-run driver's), given in the environment, never written here.
const PASSWORD = process.env.PATIENT_PASSWORD;
if (!PASSWORD) throw new Error("Set PATIENT_PASSWORD to the seeded scratch patient's password.");
const PATIENT = "ada.test@example.com";
const OTHER = "bola.other@example.com";

mkdirSync(OUT, { recursive: true });
let n = Math.max(62, ...readdirSync(OUT).map((f) => Number(f.split("-")[0]) || 0));

const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const scrub = (value) => JSON.parse(JSON.stringify(value).replace(JWT, "<jwt>").replaceAll(PASSWORD, "<password>"));
const psql = (sql) => execFileSync("docker", ["exec", PG, "psql", "-U", "oakly", "-tA", "-c", sql], { encoding: "utf8" }).trim();

async function call(label, method, path, { token, body, note } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (label) {
    n += 1;
    const record = { request: { method, path, auth: token ? "bearer" : null, body: body ?? null }, response: { status: res.status, body: parsed }, ...(note ? { note } : {}) };
    writeFileSync(resolve(OUT, `${String(n).padStart(2, "0")}-${label}.json`), JSON.stringify(scrub(record), null, 2) + "\n");
    console.log(`${String(n).padStart(2, "0")} ${label}: ${res.status}`);
  }
  return { status: res.status, body: parsed };
}

const ctl = async (action, query = "") => (await fetch(`${CTL}/ctl/${action}${query}`)).json();

async function login(email) {
  const r = await call(null, "POST", "/api/v1/auth/login/mobile", { body: { email_or_phone: email, password: PASSWORD } });
  return r.body.access_token;
}

async function newBooking(token) {
  const when = new Date(Date.now() + 2 * 86400_000).toISOString().replace(/\.\d+Z$/, "Z");
  const created = await call(null, "POST", "/api/v1/booking/create", {
    token,
    body: {
      service_type: "nurse", assistance_type: "Wound dressing", duration_hours: 2, scheduled_date: when,
      patient_address: "5 Test Avenue Lekki", patient_latitude: 6.4474, patient_longitude: 3.4723, patient_city: "Lekki",
      patient_state: "Lagos", booking_for: "My father",
    },
  });
  const ref = created.body.payment_url.split("/pay/")[1];
  await fetch(`http://localhost:9913/pay/${ref}/confirm`);
  await call(null, "POST", `/api/v1/booking/booking/${created.body.id}/verify-payment`, { token });
  return created.body.id;
}

const token = await login(PATIENT);
const A = (p) => `/api/v1/booking/${p}`;

// A second patient (for the "not your booking" answers). The 5-digit code is read from the table: no email is sent locally.
await call(null, "POST", "/api/v1/auth/register", { body: { email: OTHER, password: PASSWORD, full_name: "Bola Placeholder", user_type: "patient" } });
const code = psql(`SELECT verification_code FROM users WHERE email = '${OTHER}'`);
await call(null, "POST", "/api/v1/auth/verify-email", { body: { email: OTHER, code } });
const otherToken = await login(OTHER);

const id = await newBooking(token);
const T = `booking/${id}/live-tracking`;
const unknown = "00000000-0000-4000-8000-0000000000aa";

await call("tracking-no-caregiver-yet", "GET", A(T), { token, note: "The booking is paid and still looking for a caregiver." });
await call("chat-empty-before-caregiver", "GET", A(`chat/${id}/messages`), { token, note: "Chat before any caregiver is assigned: the patient owns the booking, so it answers 200 with an empty list." });
await call("tracking-no-token", "GET", A(T), {});
await call("tracking-other-patient", "GET", A(T), { token: otherToken });
await call("tracking-unknown-booking", "GET", A(`booking/${unknown}/live-tracking`), { token });

await ctl("accept");
await ctl("move", "?off=0.03");
await call("tracking-accepted", "GET", A(T), { token, note: "Accepted; the caregiver's phone reported a position about 3.3 km north of the patient (driver /ctl/move?off=0.03)." });
await ctl("move", "?off=0.01");
await call("tracking-accepted-closer", "GET", A(T), { token, note: "The next position ping, about 1.1 km away: distance and ETA are recomputed on every call." });

await call("chat-send", "POST", A(`chat/${id}/send`), { token, body: { message: "Please call the gate when you arrive." } });
await ctl("chat", "?text=" + encodeURIComponent("Hello, I have been assigned to your visit."));
await call("chat-list", "GET", A(`chat/${id}/messages`), { token, note: "Two messages, oldest first. `sender_id` is the sender's USER id: the patient's own is the `id` of GET /auth/me." });
await call("chat-me", "GET", "/api/v1/auth/me", { token });
await call("chat-send-blank", "POST", A(`chat/${id}/send`), { token, body: { message: "" }, note: "The API does not refuse an empty message: the app never sends one." });
await call("chat-send-no-body", "POST", A(`chat/${id}/send`), { token, body: {} });
await call("chat-send-other-patient", "POST", A(`chat/${id}/send`), { token: otherToken, body: { message: "hi" } });
await call("chat-list-other-patient", "GET", A(`chat/${id}/messages`), { token: otherToken });
await call("chat-list-unknown-booking", "GET", A(`chat/${unknown}/messages`), { token });
await call("chat-send-no-token", "POST", A(`chat/${id}/send`), { body: { message: "hi" } });

// The caregiver's location row is deleted (seeded) to show what the patient gets when the caregiver has shared no position.
const caregiverId = psql(`SELECT caregiver_id FROM bookings WHERE id = '${id}'`);
psql(`DELETE FROM caregiver_locations WHERE caregiver_id = '${caregiverId}'`);
await call("tracking-no-location-yet", "GET", A(T), { token, note: "Seeded: the caregiver's location row was deleted from the table, so no position is known." });
await ctl("move", "?off=0.02");

await ctl("onmyway");
await call("tracking-en-route", "GET", A(T), { token });
await call("detail-en-route", "GET", A(`booking/${id}`), { token });
await ctl("start");
await call("tracking-in-progress", "GET", A(T), { token, note: "In progress: the API still answers; the app stops asking once the visit has started." });

// A second booking, cancelled while accepted: tracking is closed for it.
const second = await newBooking(token);
await ctl("accept");
const terms = await call(null, "GET", A(`${second}/cancel-terms`), { token });
await call(null, "POST", A(`${second}/cancel`), { token, body: { accepted_fee_kobo: terms.body.fee_amount_kobo ?? terms.body.fee_kobo ?? 0 } });
await call("tracking-after-cancel", "GET", A(`booking/${second}/live-tracking`), { token, note: "A cancelled booking that had a caregiver." });
console.log("done");
