import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { BookingContext } from "@/src/components/chat/chatModel";

/** The card at the top of a chat: what the visit is, where and when, and a way back to the booking (Figma). */
const BookingContextCard: React.FC<{ context: BookingContext; onViewDetails: () => void }> = ({ context, onViewDetails }) => (
  <View
    testID="chat-booking-card"
    style={{
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      ...theme.shadows.small,
    }}
  >
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
      <Text variant="h3" weight="bold" testID="chat-booking-title">
        {context.title}
      </Text>
      {context.chip ? (
        <View style={{ backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.round, paddingHorizontal: theme.spacing.sm, paddingVertical: 2 }}>
          <Text variant="caption" color={theme.colors.primary} testID="chat-booking-chip">
            {context.chip}
          </Text>
        </View>
      ) : null}
    </View>
    {context.address ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <Feather name="map-pin" size={16} color={theme.colors.textLight} />
        <Text variant="small" color={theme.colors.textLight} style={{ flex: 1 }} testID="chat-booking-address">
          {context.address}
        </Text>
      </View>
    ) : null}
    {context.when ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <Feather name="clock" size={16} color={theme.colors.textLight} />
        <Text variant="small" color={theme.colors.textLight} style={{ flex: 1 }} testID="chat-booking-when">
          {context.when}
        </Text>
      </View>
    ) : null}
    <Button testID="chat-booking-details" title="View Booking Details" onPress={onViewDetails} style={{ borderRadius: theme.borderRadius.round }} />
  </View>
);

export default BookingContextCard;
