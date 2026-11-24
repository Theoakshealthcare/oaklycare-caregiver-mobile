import type React from "react";

import Button from "@/src/components/ui/button";
import { Card, EmptyState } from "@/src/components/ui/card";
import QueryError from "@/src/components/ui/query-error";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDateTime } from "@/src/domain/format";
import type { AppNotification } from "@/src/domain/notifications";
import { useMarkAllRead, useMarkRead, useNotifications } from "@/src/hooks/useNotifications";
import { useNav } from "@/src/navigation/Navigations";

/** The feed: newest first, unread in teal. A tap marks the row read and, when it points at a booking, opens it. */
const Notifications: React.FC = () => {
  const navigation = useNav();
  const feed = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const items = feed.data?.items ?? [];
  const unread = feed.data?.unread ?? 0;

  const open = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.bookingId) navigation.navigate("BookingDetails", { id: n.bookingId });
  };

  return (
    <Screen title="Notification" centerTitle scroll>
      {feed.isError && !feed.data ? (
        <QueryError what="your notifications" error={feed.error} onRetry={() => void feed.refetch()} />
      ) : feed.isLoading ? null : items.length === 0 ? (
        <EmptyState title="No notifications yet" message="Updates about your bookings will show up here." />
      ) : (
        <>
          {unread > 0 ? (
            <Button small variant="outline" title="Mark all as read" loading={markAll.isPending} onPress={() => markAll.mutate()} />
          ) : null}
          {items.map((n) => (
            <Card key={n.id} tone={n.read ? "plain" : "tint"} onPress={() => open(n)} accessibilityLabel={`${n.read ? "" : "Unread. "}${n.title}`}>
              <Text weight="bold">{n.title}</Text>
              <Text variant="small">{n.body}</Text>
              <Text variant="small" color={theme.colors.textLight}>
                {formatDateTime(n.createdAt)}
              </Text>
            </Card>
          ))}
          {feed.hasNextPage ? (
            <Button small variant="outline" title="Show older" loading={feed.isFetchingNextPage} onPress={() => void feed.fetchNextPage()} />
          ) : null}
        </>
      )}
    </Screen>
  );
};

export default Notifications;
