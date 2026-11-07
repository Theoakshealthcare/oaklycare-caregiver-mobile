import { useIsFocused } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/api/keys";
import type { ChatMessage } from "@/src/domain/booking";
import { withMessage } from "@/src/domain/chat";
import { chatService } from "@/src/services/chat.service";

/** How often the open conversation is read again (there is no push for chat in v1; the API has no unread feed). */
export const chatRefresh = { intervalMs: 5_000 };

/** The conversation on a booking, oldest first, re-read every few seconds while the chat screen is in front. */
export function useChat(bookingId: string) {
  const focused = useIsFocused();
  return useQuery({
    queryKey: queryKeys.chat(bookingId),
    queryFn: () => chatService.list(bookingId),
    staleTime: 0,
    refetchInterval: focused ? chatRefresh.intervalMs : false,
  });
}

/** Sends one message. The stored message is added to the list at once; the next read confirms it. */
export function useSendMessage(bookingId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => chatService.send(bookingId, text),
    onSuccess: (message) => {
      client.setQueryData<ChatMessage[]>(queryKeys.chat(bookingId), (list) => withMessage(list, message));
    },
  });
}
