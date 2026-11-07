import type { ChatMessage } from "@/src/domain/booking";

const HOUR = 3_600_000;
export function sampleChat(now = Date.now()): ChatMessage[] {
  return [
    { id: "m1", from: "caregiver", text: "Hello, I have been assigned to your visit.", sentAt: new Date(now - 2 * HOUR).toISOString() },
    { id: "m2", from: "me", text: "Thank you. Please call the gate when you arrive.", sentAt: new Date(now - HOUR).toISOString() },
  ];
}
