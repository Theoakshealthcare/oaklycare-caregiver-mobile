import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ChatMessage } from "@/src/domain/booking";
import { sampleChat } from "@/src/fixtures/bookings";

import { sampleKeys, useFixtureQuery } from "./fixture";

/** Sample chat for a booking, until the tracking and chat slice. */
export function useChat(bookingId: string) {
  return useFixtureQuery(["chat", bookingId], () => sampleChat());
}

export function useSendMessage(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const message: ChatMessage = { id: `m-${Date.now()}`, from: "me", text, sentAt: new Date().toISOString() };
      client.setQueryData<ChatMessage[]>(sampleKeys.chat(bookingId), (list) => [...(list ?? []), message]);
    },
  });
}
