import assert from "node:assert/strict";
import { test } from "node:test";

import { chatWindow, errorCode, isChatClosedError, isNotFoundCoded, isVisitNotActiveError, notesWindow, parseUtc } from "../src/index.ts";

// Bodies copied from the backend's captures (docs/fe-captures/post-visit-windows-location, 005, 011, 012).
const chatClosedBody = {
  detail: { code: "chat_closed", message: "This chat is closed. You can still read the conversation, but you can no longer send messages." },
};
const visitNotActiveBody = { detail: { code: "visit_not_active", message: "Notes can be added during a visit and for a short time after it ends." } };
const notFoundBody = { detail: { code: "not_found", message: "This note could not be found." } };

test("reads the code of the coded errors, and nothing from the plain ones", () => {
  assert.equal(errorCode(chatClosedBody), "chat_closed");
  assert.equal(isChatClosedError(chatClosedBody), true);
  assert.equal(isVisitNotActiveError(visitNotActiveBody), true);
  assert.equal(isNotFoundCoded(notFoundBody), true);
  assert.equal(isChatClosedError(visitNotActiveBody), false);
  assert.equal(errorCode({ detail: "Booking not found or access denied" }), null);
  assert.equal(errorCode({ detail: [{ msg: "x" }] }), null);
  assert.equal(errorCode(null), null);
  assert.equal(errorCode("chat_closed"), null);
});

test("reads a zone-less API time as UTC", () => {
  assert.equal(parseUtc("2026-11-26T06:06:02.106091")?.toISOString(), "2026-11-26T06:06:02.106Z");
  assert.equal(parseUtc("2026-11-26T06:06:02Z")?.toISOString(), "2026-11-26T06:06:02.000Z");
  assert.equal(parseUtc(null), null);
  assert.equal(parseUtc("not a time"), null);
});

const NOW = Date.parse("2026-11-25T08:00:00Z");

test("chat: open with no fixed end while the booking is live, and when the fields are missing", () => {
  assert.deepEqual(chatWindow({ status: "in_progress", chat_open: true, chat_closes_at: null }, NOW), { open: true, closesAt: null });
  assert.deepEqual(chatWindow({ status: "accepted" }, NOW), { open: true, closesAt: null });
  assert.deepEqual(chatWindow(undefined, NOW), { open: true, closesAt: null });
});

test("chat: completed and inside 24 h is open with the closing time (capture 002)", () => {
  const w = chatWindow({ status: "completed", chat_open: true, chat_closes_at: "2026-11-26T06:06:02.106091" }, NOW);
  assert.equal(w.open, true);
  assert.equal(w.open && w.closesAt?.toISOString(), "2026-11-26T06:06:02.106Z");
});

test("chat: closed after the visit (capture 003) and closed for a cancelled booking (capture 004)", () => {
  assert.deepEqual(chatWindow({ status: "completed", chat_open: false, chat_closes_at: "2026-11-25T02:06:02.124507" }, NOW), { open: false, reason: "visit_over" });
  assert.deepEqual(chatWindow({ status: "cancelled", chat_open: false, chat_closes_at: null }, NOW), { open: false, reason: "cancelled" });
  assert.deepEqual(chatWindow({ status: "declined", chat_open: false }, NOW), { open: false, reason: "cancelled" });
});

test("chat: with no chat_open sent, a closing time already past closes it; chat_open true is trusted over the phone's clock", () => {
  assert.deepEqual(chatWindow({ status: "completed", chat_closes_at: "2026-11-25T02:06:02" }, NOW), { open: false, reason: "visit_over" });
  const trusted = chatWindow({ status: "completed", chat_open: true, chat_closes_at: "2026-11-25T02:06:02" }, NOW);
  assert.equal(trusted.open, true);
});

test("notes: open while in progress, with no end shown until the visit is completed (capture 009, first row)", () => {
  assert.deepEqual(notesWindow({ status: "in_progress", notes_open: true, notes_closes_at: null, notes_readable_until: null }), { open: true, closesAt: null, readableUntil: null });
});

test("notes: completed and inside the 2 h grace is open with the closing time (capture 009, second row)", () => {
  const w = notesWindow({ status: "completed", notes_open: true, notes_closes_at: "2026-11-25T09:06:02.118941", notes_readable_until: "2026-11-26T07:06:02.118941" });
  assert.equal(w.open, true);
  assert.equal(w.closesAt?.toISOString(), "2026-11-25T09:06:02.118Z");
  assert.equal(w.readableUntil?.toISOString(), "2026-11-26T07:06:02.118Z");
});

test("notes: closed after the grace (capture 009, third and fourth rows), and a missing field leaves it open", () => {
  assert.equal(notesWindow({ status: "completed", notes_open: false, notes_closes_at: "2026-11-25T08:06:02" }).open, false);
  assert.equal(notesWindow({ status: "completed" }).open, true);
  assert.deepEqual(notesWindow(null), { open: true, closesAt: null, readableUntil: null });
  // `notes_open: false` with a null end before the visit starts is "not started yet", still just closed.
  assert.equal(notesWindow({ status: "accepted", notes_open: false }).open, false);
});
