import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSession } from "@/src/auth";
import { toNotification, type AppNotification } from "@/src/domain/notifications";
import { notificationsService } from "@/src/services/notifications.service";

export const notificationKeys = {
  all: ["notifications"] as const,
  feed: ["notifications", "feed"] as const,
  unread: ["notifications", "unread"] as const,
};

const PAGE_SIZE = 20;
/** A notice reaches the feed within about 15 s of the event; while the list is open, once a minute is plenty. */
const POLL_MS = 60_000;

/** The feed, newest first, a page at a time (`limit` / `offset`). `unread` is the whole feed's count, not the page's. */
export function useNotifications() {
  const signedIn = useSession((s) => s.status === "signedIn");
  return useInfiniteQuery({
    queryKey: notificationKeys.feed,
    enabled: signedIn,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => notificationsService.list(PAGE_SIZE, pageParam),
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length;
      return last.items.length > 0 && next < last.total ? next : undefined;
    },
    refetchInterval: POLL_MS,
    select: (data) => {
      const seen = new Set<string>();
      const items: AppNotification[] = [];
      for (const page of data.pages) {
        for (const item of page.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            items.push(toNotification(item));
          }
        }
      }
      return { items, unread: data.pages[0]?.unread_count ?? 0 };
    },
  });
}

/** The bell's badge: one tiny call (`limit=1`), refreshed when the app comes to the foreground and every minute. */
export function useUnreadCount(): number {
  const signedIn = useSession((s) => s.status === "signedIn");
  const query = useQuery({
    queryKey: notificationKeys.unread,
    enabled: signedIn,
    queryFn: async () => (await notificationsService.list(1, 0)).unread_count,
    refetchInterval: POLL_MS,
  });
  return query.data ?? 0;
}

export function useMarkRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.readAll(),
    onSettled: () => client.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
