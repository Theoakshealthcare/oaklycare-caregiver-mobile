import { api } from "@/src/api/client";
import { unwrap } from "@/src/api/unwrap";
import type { ChatMessage } from "@/src/domain/booking";
import { toChatMessage } from "@/src/domain/chat";

export const chatService = {
  /** `GET /booking/chat/{id}/messages`: the whole conversation, oldest first (there is no paging). */
  async list(id: string): Promise<ChatMessage[]> {
    const body = await unwrap(api.GET("/api/v1/booking/chat/{booking_id}/messages", { params: { path: { booking_id: id } } }));
    return body.map(toChatMessage);
  },

  /** `POST /booking/chat/{id}/send`: answers with the stored message. */
  async send(id: string, text: string): Promise<ChatMessage> {
    const body = await unwrap(
      api.POST("/api/v1/booking/chat/{booking_id}/send", { params: { path: { booking_id: id } }, body: { message: text, message_type: "text" } }),
    );
    return toChatMessage(body);
  },
};
