import React from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { Offer } from "@/src/services/booking.service";
import { formatDuration, formatVisitTime } from "@/src/utils/dates";

interface Props {
  offer: Offer;
  busy?: boolean;
  onView: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * A job offered to the caregiver. It takes the narrow {@link Offer} type, never a full booking, so
 * no patient identity can be shown before the caregiver accepts.
 */
const OfferCard: React.FC<Props> = ({ offer, busy = false, onView, onAccept, onDecline }) => (
  <View
    style={{
      backgroundColor: theme.colors.white,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      elevation: 3,
    }}
  >
    <Text variant="h3" weight="bold" style={{ textTransform: "capitalize" }}>
      {offer.serviceType} visit
    </Text>
    {offer.assistanceType ? (
      <Text variant="body" color={theme.colors.primary} weight="medium" style={{ marginTop: 4 }}>
        {offer.assistanceType}
      </Text>
    ) : null}

    <View style={{ marginVertical: 12, gap: 4 }}>
      <Text variant="body" color={theme.colors.textLight}>
        <Feather name="map-pin" size={14} /> {offer.area}
      </Text>
      <Text variant="body" color={theme.colors.textLight}>
        <Feather name="clock" size={14} /> {formatVisitTime(offer.scheduledDate)} {"•"} {formatDuration(offer.durationHours)}
      </Text>
      <Text variant="small" color={theme.colors.textLight}>
        The patient&apos;s details are shared once you accept.
      </Text>
    </View>

    <View style={{ flexDirection: "row", gap: 8 }}>
      <Button title="Details" variant="outline" onPress={onView} disabled={busy} style={{ flex: 1, paddingHorizontal: 8 }} />
      <Button title="Decline" variant="outline" onPress={onDecline} disabled={busy} style={{ flex: 1, paddingHorizontal: 8 }} />
      <Button title="Accept" onPress={onAccept} loading={busy} style={{ flex: 1, paddingHorizontal: 8 }} />
    </View>
  </View>
);

export default OfferCard;
