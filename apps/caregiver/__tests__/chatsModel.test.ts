import { AVATAR_ROW_LIMIT, filterChats, initialOf, listTime } from "../src/chats/chatsModel";
import type { ChatSummary } from "../src/services/chats.service";

const chat = (name: string): ChatSummary =>
  ({ booking_id: name, patient_name: name, service_type: "nurse", status: "accepted", scheduled_date: "2026-11-25T10:00:00", last_message: null }) as ChatSummary;

// The backend sends UTC without a zone: this reads back as the same local moment `d`.
const sent = (d: Date) => d.toISOString().replace("Z", "");

describe("chats model", () => {
  it("draws the first letter of the name, upper case, with a fallback", () => {
    expect(initialOf("  ada okafor")).toBe("A");
    expect(initialOf("")).toBe("P");
  });

  it("filters by patient name, ignoring case and surrounding spaces; a blank query keeps all", () => {
    const all = [chat("Ada Okafor"), chat("Ben Okoro"), chat("Cara Eze")];
    expect(filterChats(all, "  OKO ").map((c) => c.patient_name)).toEqual(["Ben Okoro"]);
    expect(filterChats(all, "ok").map((c) => c.patient_name)).toEqual(["Ada Okafor", "Ben Okoro"]);
    expect(filterChats(all, "   ")).toBe(all);
    expect(filterChats(all, "zzz")).toEqual([]);
  });

  it("shows the clock today, the weekday inside a week and the date before that", () => {
    const now = new Date(2026, 10, 24, 15, 0, 0); // Tuesday 24 Nov 2026, local time
    expect(listTime(sent(new Date(2026, 10, 24, 9, 5)), now)).toBe("09:05");
    expect(listTime(sent(new Date(2026, 10, 22, 9, 5)), now)).toBe("Sun");
    expect(listTime(sent(new Date(2026, 9, 28, 9, 5)), now)).toBe("28 Oct");
    expect(listTime("not a date", now)).toBe("");
  });

  it("keeps the avatar row short", () => {
    expect(AVATAR_ROW_LIMIT).toBe(8);
  });
});
