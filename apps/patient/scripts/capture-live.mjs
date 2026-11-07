// Captures REAL responses from a running Oakly backend for the patient app's wired screens (notifications, profile,
// change password, vitals, FallGuard) and writes one JSON file per call to __tests__/fixtures/live/. The Jest fixtures
// are these files, never hand-typed bodies.
//
//   node apps/patient/scripts/capture-live.mjs [--api http://127.0.0.1:8002] [--pg wiringb-pg]
//
// The backend must run on a scratch database (never a real one): this script registers accounts, writes vitals and, for the
// notification feed, INSERTS rows straight into the `notifications` table through `docker exec <pg> psql` (the rows the
// worker would write after a booking event; the booking endpoint needs a live Paystack account). It also reads the 5-digit
// verification code from the `users` table because no email is sent locally. Both are labelled "seeded" in the file.
//
// Everything is a placeholder: example.com emails, a throwaway password, JWTs replaced by "<access-token>". Nothing real.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const API = flag("--api", "http://127.0.0.1:8002").replace(/\/+$/, "");
const PG = flag("--pg", "wiringb-pg");
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../__tests__/fixtures/live");
const PASSWORD = "Placeholder-Pass-1";
const NEW_PASSWORD = "Placeholder-Pass-2x";

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".json")) rmSync(resolve(OUT, f));

let n = 0;
const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const scrub = (value) =>
  JSON.parse(JSON.stringify(value).replace(JWT, "<jwt>").replaceAll(PASSWORD, "<password>").replaceAll(NEW_PASSWORD, "<new-password>"));

function save(label, record) {
  n += 1;
  const file = `${String(n).padStart(2, "0")}-${label}.json`;
  writeFileSync(resolve(OUT, file), JSON.stringify(scrub(record), null, 2) + "\n");
  return file;
}

function psql(sql) {
  return execFileSync("docker", ["exec", PG, "psql", "-U", "oakly", "-tA", "-c", sql], { encoding: "utf8" }).trim();
}

/** A real HTTP call; saves request + status + (Retry-After) + body under `label` unless label is null. */
async function call(label, method, path, { token, body, note, headers = {} } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  const retryAfter = res.headers.get("retry-after");
  if (label) {
    save(label, {
      request: { method, path, auth: token ? "bearer" : null, body: body ?? null },
      response: { status: res.status, ...(retryAfter ? { retryAfter } : {}), body: parsed },
      ...(note ? { note } : {}),
    });
  }
  return { status: res.status, body: parsed, retryAfter };
}

async function account(label, email, fullName, userType) {
  await call(`${label}-register`, "POST", "/api/v1/auth/register", {
    body: { email, password: PASSWORD, full_name: fullName, user_type: userType },
  });
  const code = psql(`select verification_code from users where email='${email}'`);
  await call(null, "POST", "/api/v1/auth/verify-email", { body: { email, code } });
  const login = await call(`${label}-login`, "POST", "/api/v1/auth/login/mobile", { body: { email_or_phone: email, password: PASSWORD } });
  return login.body.access_token;
}

// --- accounts ---------------------------------------------------------------------------------------------------------
const patientEmail = "patient-wiring-b@example.com";
const caregiverEmail = "caregiver-wiring-b@example.com";
let token = await account("patient", patientEmail, "Placeholder Patient", "patient");
const caregiverToken = await account("caregiver", caregiverEmail, "Placeholder Caregiver", "caregiver");
const me = await call("me", "GET", "/api/v1/auth/me", { token });
const patientId = me.body.patient.id;
const userId = me.body.id;

// --- notifications ----------------------------------------------------------------------------------------------------
await call("feed-no-token", "GET", "/api/v1/patient/notifications");
await call("feed-as-caregiver", "GET", "/api/v1/patient/notifications", { token: caregiverToken });
await call("feed-empty", "GET", "/api/v1/patient/notifications", { token });
const ROWS = [
  ["booking_confirmed", "Booking confirmed", "Payment received. We're finding a caregiver for your visit.", 60],
  ["caregiver_found", "Caregiver found", "Ngozi will be your caregiver.", 50],
  ["caregiver_on_the_way", "Caregiver on the way", "Ngozi is on the way.", 40],
  ["visit_started", "Visit started", "Your visit has started.", 30],
  ["visit_completed", "Visit completed", "Your visit is complete.", 20],
  ["refund_started", "Refund started", "We've started your refund.", 10],
  ["some_future_type", "Something new", "A kind of notice this app has never seen.", 5],
];
for (const [type, title, body, minutesAgo] of ROWS) {
  const bookingId = psql("select gen_random_uuid()");
  psql(
    `insert into notifications (id, user_id, type, title, body, data, created_at) values (gen_random_uuid(), '${userId}', '${type}', '${title.replaceAll("'", "''")}', '${body.replaceAll("'", "''")}', '{"target":"booking_detail","booking_id":"${bookingId}"}'::jsonb, now() at time zone 'utc' - interval '${minutesAgo} minutes')`,
  );
}
save("feed-seeded-note", { note: "SEEDED: 7 rows inserted into `notifications` with psql (the worker writes them after booking events); every other call in this folder is a real HTTP call." });
const feed = await call("feed-default", "GET", "/api/v1/patient/notifications", { token });
await call("feed-page-1", "GET", "/api/v1/patient/notifications?limit=3&offset=0", { token });
await call("feed-page-2", "GET", "/api/v1/patient/notifications?limit=3&offset=3", { token });
await call("feed-limit-zero", "GET", "/api/v1/patient/notifications?limit=0", { token });
const first = feed.body.items[0];
await call("read-one", "POST", `/api/v1/patient/notifications/${first.id}/read`, { token });
await call("read-one-again", "POST", `/api/v1/patient/notifications/${first.id}/read`, { token });
await call("read-unknown", "POST", `/api/v1/patient/notifications/${psql("select gen_random_uuid()")}/read`, { token });
await call("read-all", "POST", "/api/v1/patient/notifications/read-all", { token });
await call("feed-after-read-all", "GET", "/api/v1/patient/notifications?limit=2", { token });
await call("push-register", "POST", "/api/v1/devices/push-token", {
  token,
  body: { token: "ExponentPushToken[placeholder-patient-phone]", platform: "ios" },
});
await call("push-register-not-expo", "POST", "/api/v1/devices/push-token", { token, body: { token: "not-an-expo-token", platform: "ios" } });
await call("push-forget", "DELETE", "/api/v1/devices/push-token", { token, body: { token: "ExponentPushToken[placeholder-patient-phone]" } });

// --- profile ----------------------------------------------------------------------------------------------------------
await call("profile-update", "PUT", "/api/v1/auth/profile", {
  token,
  body: {
    full_name: "Placeholder Patient Edited",
    phone_number: "+2340000000001",
    address: "1 Placeholder Street, Lagos",
    emergency_contact_name: "Placeholder Contact",
    emergency_contact_phone: "+2340000000002",
    emergency_contact_address: "2 Placeholder Street, Lagos",
  },
  note: "The answer is the flat profile: it has NO `patient` object (that is what the audit found).",
});
await call("me-after-update", "GET", "/api/v1/auth/me", { token });
await call("profile-update-blank-name", "PUT", "/api/v1/auth/profile", {
  token,
  body: { full_name: "", address: "" },
  note: "Empty strings are ignored by the server (truthy check): a field cannot be cleared.",
});
await call("me-after-blank-update", "GET", "/api/v1/auth/me", { token });

// --- change password --------------------------------------------------------------------------------------------------
await call("password-wrong-current", "POST", "/api/v1/auth/change-password", { token, body: { current_password: "Not-The-Password-9", new_password: NEW_PASSWORD } });
await call("password-weak", "POST", "/api/v1/auth/change-password", { token, body: { current_password: PASSWORD, new_password: "aaaaaaaa" } });
await call("password-same", "POST", "/api/v1/auth/change-password", { token, body: { current_password: PASSWORD, new_password: PASSWORD } });
const changed = await call("password-changed", "POST", "/api/v1/auth/change-password", { token, body: { current_password: PASSWORD, new_password: NEW_PASSWORD } });
await call("me-with-old-token", "GET", "/api/v1/auth/me", { token, note: "The pre-change access token stops working." });
token = changed.body.access_token;
await call("me-with-new-token", "GET", "/api/v1/auth/me", { token });
for (let i = 0; i < 8; i += 1) {
  const r = await call(null, "POST", "/api/v1/auth/change-password", { token, body: { current_password: "Not-The-Password-9", new_password: PASSWORD } });
  if (r.status === 429) {
    await call("password-too-many", "POST", "/api/v1/auth/change-password", { token, body: { current_password: "Not-The-Password-9", new_password: PASSWORD } });
    break;
  }
}
const relog = await call(null, "POST", "/api/v1/auth/login/mobile", { body: { email_or_phone: patientEmail, password: NEW_PASSWORD } });
token = relog.body.access_token;

// --- vitals -----------------------------------------------------------------------------------------------------------
await call("vitals-no-token", "GET", `/api/v1/vitals/${patientId}`);
await call("vitals-empty", "GET", `/api/v1/vitals/${patientId}`, { token });
const nowIso = new Date().toISOString();
const vital = (vital_type, value, unit, notes, extra = {}) => ({
  vital_type,
  value,
  unit,
  source: "manual",
  recorded_at: nowIso,
  ...(notes ? { notes } : {}),
  patient_id: patientId,
  recorded_by_user_id: userId,
  ...extra,
});
await call("vital-blood-pressure", "POST", "/api/v1/vitals/", { token, body: vital("blood_pressure", "120/80", "mmHg") });
await call("vital-heart-rate", "POST", "/api/v1/vitals/", { token, body: vital("heart_rate", "72", "bpm") });
await call("vital-temperature", "POST", "/api/v1/vitals/", { token, body: vital("temperature", "36.8", "°C") });
await call("vital-respiratory", "POST", "/api/v1/vitals/", { token, body: vital("respiratory_rate", "16", "breaths/min") });
await call("vital-glucose-random", "POST", "/api/v1/vitals/", { token, body: vital("blood_glucose", "110", "mg/dL", "RBS") });
await call("vital-glucose-fasting", "POST", "/api/v1/vitals/", { token, body: vital("blood_glucose", "92", "mg/dL", "FBS") });
await call("vital-sleep", "POST", "/api/v1/vitals/", { token, body: vital("sleep_duration", "7.5", "hrs", "22:30-06:00") });
const absurd = await call("vital-absurd-bp-accepted", "POST", "/api/v1/vitals/", {
  token,
  body: vital("blood_pressure", "300/20", "mmHg"),
  note: "DP1-16: the server accepts an impossible reading. The app validates on the client; the backend does not.",
});
await call("vital-unknown-type-accepted", "POST", "/api/v1/vitals/", { token, body: vital("banana", "not a number", "kg") });
await call("vital-wrong-patient", "POST", "/api/v1/vitals/", { token, body: vital("heart_rate", "70", "bpm", null, { patient_id: psql("select gen_random_uuid()") }) });
await call("vital-missing-field", "POST", "/api/v1/vitals/", { token, body: { vital_type: "heart_rate", patient_id: patientId, recorded_by_user_id: userId } });
await call("vital-no-token", "POST", "/api/v1/vitals/", { body: vital("heart_rate", "70", "bpm") });
await call("vitals-list", "GET", `/api/v1/vitals/${patientId}`, { token });
await call("vitals-list-window", "GET", `/api/v1/vitals/${patientId}?start=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}`, { token });
await call("vitals-list-other-patient", "GET", `/api/v1/vitals/${psql("select gen_random_uuid()")}`, { token });
await call("vitals-list-as-caregiver", "GET", `/api/v1/vitals/${patientId}`, { token: caregiverToken });
await call("vitals-insights", "GET", `/api/v1/vitals/${patientId}/insights`, { token });
await call("vital-delete-junk", "DELETE", `/api/v1/vitals/${absurd.body.id}`, { token });

// --- FallGuard --------------------------------------------------------------------------------------------------------
await call("fallguard-questions-as-caregiver", "GET", "/api/v1/fallguard/questions", { token: caregiverToken });
const questions = await call("fallguard-questions", "GET", "/api/v1/fallguard/questions", { token });
await call("fallguard-history-empty", "GET", "/api/v1/fallguard/history", { token });
const answers = questions.body.map((q, i) => {
  const option = q.options[i % q.options.length];
  return { question_id: q.id, answer: option.text, score: option.score };
});
await call("fallguard-submit", "POST", "/api/v1/fallguard/submit", { token, body: { answers } });
await call("fallguard-submit-tampered-score", "POST", "/api/v1/fallguard/submit", {
  token,
  body: { answers: [{ question_id: questions.body[0].id, answer: questions.body[0].options[0].text, score: 99 }] },
  note: "The server sums the scores the CLIENT sends: it does not look them up from the question's options.",
});
await call("fallguard-submit-empty", "POST", "/api/v1/fallguard/submit", { token, body: { answers: [] } });
await call("fallguard-submit-unknown-question", "POST", "/api/v1/fallguard/submit", {
  token,
  body: { answers: [{ question_id: psql("select gen_random_uuid()"), answer: "No", score: 0 }] },
});
await call("fallguard-submit-bad-body", "POST", "/api/v1/fallguard/submit", { token, body: { answers: [{ answer: "No" }] } });
await call("fallguard-submit-as-caregiver", "POST", "/api/v1/fallguard/submit", { token: caregiverToken, body: { answers } });
await call("fallguard-history", "GET", "/api/v1/fallguard/history", { token });

console.log(`wrote ${n} captures to ${OUT}`);
