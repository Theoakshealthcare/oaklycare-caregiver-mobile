import React from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";

import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import HeaderBack from "@/src/components/back/HeaderBack";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useNotifications } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { toOffer } from "@/src/services/booking.service";
import type { CaregiverNotification } from "@/src/services/notification.service";
import { formatVisitTime } from "@/src/utils/dates";

const Notifications: React.FC = () => {
  const { navigation } = useNavigation();
  const query = useNotifications();

  /**
   * A booking nobody is assigned to is an offer (the backend hides patient details until accepted),
   * so it opens as one; an assigned booking opens as the full job.
   */
  const open = (n: CaregiverNotification) =>
    n.booking.caregiver_id
      ? navigation.navigate("BookingDetails", { bookingId: n.booking_id })
      : navigation.navigate("BookingDetails", { bookingId: n.booking_id, offer: toOffer(n.booking) });

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
            Notifications
          </Text>
        </View>
        {query.data ? (
          <FlatList
            testID="notifications-list"
            data={query.data}
            keyExtractor={(n) => n.id}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
            ListEmptyComponent={
              <EmptyState icon="bell" title="No notifications yet" hint="New job requests and updates will show up here." />
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => open(item)}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 12,
                  backgroundColor: item.is_read ? theme.colors.soft : theme.colors.primaryLight,
                }}
              >
                <Text variant="body" weight="bold">
                  {item.title}
                </Text>
                <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 2 }}>
                  {item.message}
                </Text>
                <Text variant="caption" color={theme.colors.textLight} style={{ marginTop: 6 }}>
                  {formatVisitTime(item.created_at)}
                </Text>
              </Pressable>
            )}
          />
        ) : (
          body()
        )}
      </View>
    </View>
  );
};

export default Notifications;
