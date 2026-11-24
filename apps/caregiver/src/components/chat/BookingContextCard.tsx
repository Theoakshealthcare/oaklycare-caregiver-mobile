import React from "react";
import { Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

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
      padding: 12,
      gap: 8,
      marginBottom: theme.spacing.md,
      // Figma: a compact card, about two thirds of the screen wide, centred.
      alignSelf: "center",
      width: "72%",
    }}
  >
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
      <Text variant="compact" weight="bold" color="#000000" testID="chat-booking-title">
        {context.title}
      </Text>
      {context.chip ? (
        <View style={{ backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.round, paddingHorizontal: theme.spacing.sm, paddingVertical: 2 }}>
          <Text variant="micro" color={theme.colors.primary} testID="chat-booking-chip">
            {context.chip}
          </Text>
        </View>
      ) : null}
    </View>
    {context.address ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <Feather name="map-pin" size={13} color={theme.colors.textLight} />
        <Text variant="label" color={theme.colors.muted} style={{ flex: 1 }} testID="chat-booking-address">
          {context.address}
        </Text>
      </View>
    ) : null}
    {context.when ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
        <Feather name="clock" size={13} color={theme.colors.textLight} />
        <Text variant="label" color={theme.colors.muted} style={{ flex: 1 }} testID="chat-booking-when">
          {context.when}
        </Text>
      </View>
    ) : null}
    <Pressable
      testID="chat-booking-details"
      accessibilityRole="button"
      accessibilityLabel="View Booking Details"
      onPress={onViewDetails}
      style={{ backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.round, paddingVertical: 9, alignItems: "center" }}
    >
      <Text variant="fine" weight="bold" color={theme.colors.white}>
        View Booking Details
      </Text>
    </Pressable>
  </View>
);

export default BookingContextCard;
