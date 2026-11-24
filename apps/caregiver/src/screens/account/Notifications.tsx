import React, { useMemo } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import HeaderBack from "@/src/components/back/HeaderBack";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useNotifications } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { toOffer } from "@/src/services/booking.service";
import type { CaregiverNotification } from "@/src/services/notification.service";
import { groupNotifications, notificationView } from "@/src/account/notificationModel";
import { timeAgo } from "@/src/home/homeBlocks";

type Row = { kind: "header"; label: string } | { kind: "item"; item: CaregiverNotification };

/** Figma's empty state: a folder and "No Notification". Its "Start Booking Journey" button is for a patient, so it is not drawn. */
const NoNotifications: React.FC = () => (
  <View testID="notifications-empty" style={{ alignItems: "center", paddingTop: theme.spacing.xxl * 2, gap: theme.spacing.sm }}>
    <Feather name="folder" size={56} color={theme.colors.warning} />
    <Text variant="body" color={theme.colors.textLight}>
      No Notification
    </Text>
  </View>
);

const Notifications: React.FC = () => {
  const { navigation } = useNavigation();
  const query = useNotifications();
  // "10 Min Ago" and "Today" are judged as of the moment the list was fetched (the same rule as Home's block).
  const fetchedAt = query.dataUpdatedAt;
  const rows = useMemo<Row[]>(
    () =>
      groupNotifications(query.data ?? [], new Date(fetchedAt)).flatMap((group) => [
        { kind: "header", label: group.label } as Row,
        ...group.items.map((item): Row => ({ kind: "item", item })),
      ]),
    [query.data, fetchedAt],
  );

  /**
   * A booking nobody is assigned to is an offer (the backend hides patient details until accepted),
   * so it opens as one; an assigned booking opens as the full job.
   */
  const open = (n: CaregiverNotification) =>
    notificationView(n).opensAs === "job"
      ? navigation.navigate("BookingDetails", { bookingId: n.booking_id })
      : navigation.navigate("BookingDetails", { bookingId: n.booking_id, offer: toOffer(n.booking, n.response ?? null) });

  const body = () => {
    if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    if (!query.data) return <LoadingState testID="notifications-loading" />;
    return null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <View style={[globalStyles.container, { flex: 1, paddingBottom: 0 }]}>
        <HeaderBack />
        <View style={{ marginVertical: "5%" }}>
          <Text variant="h2" weight="bold">
            Notification
          </Text>
        </View>
        {query.data ? (
          <FlatList
            testID="notifications-list"
            data={rows}
            keyExtractor={(row) => (row.kind === "header" ? `header-${row.label}` : row.item.id)}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
            ListEmptyComponent={<NoNotifications />}
            renderItem={({ item: row }) => {
              if (row.kind === "header") {
                return (
                  <Text variant="body" weight="medium" style={{ marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
                    {row.label}
                  </Text>
                );
              }
              const item = row.item;
              const view = notificationView(item);
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => open(item)}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    marginBottom: 12,
                    backgroundColor: view.isRead ? theme.colors.soft : theme.colors.primaryLight,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" weight="bold">
                        {view.title}
                      </Text>
                    </View>
                    <Text variant="small" weight="bold" color={theme.colors.primary} testID="notification-ago">
                      {timeAgo(item.created_at, fetchedAt)}
                    </Text>
                  </View>
                  <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 2 }}>
                    {view.detail}
                  </Text>
                  {view.distance ? (
                    <Text variant="small" color={theme.colors.textLight}>
                      {view.distance}
                    </Text>
                  ) : null}
                  {view.stateLabel ? (
                    <Text
                      variant="small"
                      weight="medium"
                      color={view.state === "unavailable" ? theme.colors.textLight : theme.colors.primary}
                      style={{ marginTop: 4 }}
                    >
                      {view.stateLabel}
                    </Text>
                  ) : null}
                </Pressable>
              );
            }}
          />
        ) : (
          body()
        )}
      </View>
    </View>
  );
};

export default Notifications;
