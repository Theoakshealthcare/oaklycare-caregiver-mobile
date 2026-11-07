import type React from "react";

import { Card, EmptyState } from "@/src/components/ui/card";
import Screen from "@/src/components/ui/screen";
import SampleNotice from "@/src/components/ui/sample-notice";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDateTime } from "@/src/domain/format";
import { useNotifications } from "@/src/hooks/useNotifications";

const Notifications: React.FC = () => {
  const notifications = useNotifications();
  return (
    <Screen title="Notifications" scroll>
      <SampleNotice what="This list" />
      {(notifications.data ?? []).length === 0 ? (
        <EmptyState title="No notifications yet" message="Updates about your bookings will show up here." />
      ) : (
        notifications.data?.map((n) => (
          <Card key={n.id} tone={n.read ? "plain" : "tint"}>
            <Text weight="bold">{n.title}</Text>
            <Text variant="small">{n.body}</Text>
            <Text variant="small" color={theme.colors.textLight}>
              {formatDateTime(n.receivedAt)}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
};

export default Notifications;
