import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";

export type ChatSummary = Schemas["CaregiverChatOut"];
export type ChatList = Schemas["CaregiverChatList"];
/** The cursor of the next page: both halves go back together. */
export type ChatCursor = { before: string; before_id: string };

export const CHATS_PAGE_SIZE = 50;

export const chatsService = {
  /**
   * The conversations of the bookings assigned to this caregiver, newest activity first. The patient shows by full name
   * (a booking is listed only once it is the caregiver's own). There is no unread count: the server records no read state.
   */
  listChats(cursor?: ChatCursor) {
    return unwrap(
      api.GET("/api/v1/caregiver/chats", {
        params: { query: { limit: CHATS_PAGE_SIZE, ...(cursor ?? {}) } },
      }),
    );
  },
};
