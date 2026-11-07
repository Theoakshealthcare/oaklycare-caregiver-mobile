import type { ChatMessage } from "./booking";
import { utcIso } from "./dates";

/** The longest message the composer accepts (the API has no limit; a screenful is plenty for a text between two people). */
export const MAX_MESSAGE_LENGTH = 1000;

interface ChatBody {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export function toChatMessage(body: ChatBody): ChatMessage {
  return { id: body.id, senderId: body.sender_id, text: body.message, sentAt: utcIso(body.created_at) };
}

/** Appends a message the server just stored, unless a refresh already brought it in. */
export function withMessage(list: ChatMessage[] | undefined, message: ChatMessage): ChatMessage[] {
  const current = list ?? [];
  return current.some((m) => m.id === message.id) ? current : [...current, message];
}
