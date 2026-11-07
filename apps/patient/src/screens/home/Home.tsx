import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import NotificationBell from "@/src/components/NotificationBell";
import Button from "@/src/components/ui/button";
import { Card, Chip, EmptyState } from "@/src/components/ui/card";
import Icon from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import SampleNotice from "@/src/components/ui/sample-notice";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDateTime } from "@/src/domain/format";
import { canTrack, statusLabel, tabForStatus } from "@/src/domain/booking";
import { readingText, vitalMeta } from "@/src/domain/vitals";
import { useBookings } from "@/src/hooks/useBookings";
import { useMe } from "@/src/hooks/queries";
import { useVitalReadings } from "@/src/hooks/useVitals";
import { useNav } from "@/src/navigation/Navigations";

/** First name for the greeting; the full name when it has no space. */
const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

const Home: React.FC = () => {
  const navigation = useNav();
  const me = useMe();
  const bookings = useBookings();
  const readings = useVitalReadings();

  const upcoming = (bookings.data ?? []).filter((b) => tabForStatus(b.status) === "upcoming");
  const latest = (kind: "heart_rate" | "blood_pressure") => readings.data?.find((r) => r.kind === kind);

  return (
    <KeyboardScrollView contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={8} onPress={() => navigation.navigate("Profile")}>
          <Icon name="menu" size={26} />
        </Pressable>
        <NotificationBell />
      </View>

      <View>
        <Text variant="h2" weight="bold">
          {me.data ? `Hello, ${firstName(me.data.full_name)}` : "Hello"}
        </Text>
        <Text color={theme.colors.textLight}>What would you like to do today?</Text>
      </View>

      <SampleNotice what="Your appointments and vitals" />

      <Card tone="warm" style={styles.start}>
        <Text variant="h3" weight="bold">
          Book a Service
        </Text>
        <Text variant="small" color={theme.colors.textLight}>
          Get a nurse to visit at home.
        </Text>
        <Button title="Start Booking" onPress={() => navigation.navigate("BookingStep1")} />
      </Card>

      <View style={styles.sectionHead}>
        <Text variant="h3" weight="bold">
          Remote Monitoring
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="See all vitals" onPress={() => navigation.navigate("Tabs", { tab: "vitals", at: Date.now() })}>
          <Text variant="small" weight="bold" color={theme.colors.primary}>
            See all
          </Text>
        </Pressable>
      </View>
      <View style={styles.tiles}>
        {(["heart_rate", "blood_pressure"] as const).map((kind) => {
          const meta = vitalMeta(kind);
          const reading = latest(kind);
          return (
            <Card key={kind} tone="tint" style={styles.tile} onPress={() => navigation.navigate("VitalDetail", { kind })} accessibilityLabel={meta.label}>
              <Icon name={meta.icon} size={20} color={theme.colors.primary} />
              <Text variant="small" color={theme.colors.textLight}>
                {meta.label}
              </Text>
              <Text variant="h3" weight="bold">
                {reading ? `${readingText(reading)} ${meta.unit}` : "No reading yet"}
              </Text>
            </Card>
          );
        })}
      </View>

      <Text variant="h3" weight="bold">
        Upcoming appointments
      </Text>
      {upcoming.length === 0 ? (
        <Card tone="tint">
          <EmptyState title="You do not have any appointments" message="Tap Start Booking to book a visit for yourself or a loved one." />
        </Card>
      ) : (
        upcoming.map((booking) => (
          <Card key={booking.id} onPress={() => navigation.navigate("BookingDetails", { id: booking.id })} accessibilityLabel={`Booking ${booking.reference}`}>
            <View style={styles.rowBetween}>
              <Text weight="bold">{booking.service}</Text>
              <Chip label={statusLabel(booking)} tone={booking.status === "pending" ? "warning" : "primary"} />
            </View>
            <Text variant="small" color={theme.colors.textLight}>
              {`${booking.bookingFor} · ${formatDateTime(booking.scheduledAt)}`}
            </Text>
            <View style={styles.actions}>
              {canTrack(booking) ? <Button small title="Track" onPress={() => navigation.navigate("CaregiverDetail", { id: booking.id })} /> : null}
              {booking.caregiver ? <Button small variant="outline" title="Chat" onPress={() => navigation.navigate("Chat", { id: booking.id })} /> : null}
            </View>
          </Card>
        ))
      )}
    </KeyboardScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  start: { gap: theme.spacing.sm },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tiles: { flexDirection: "row", gap: theme.spacing.md },
  tile: { flex: 1 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  actions: { flexDirection: "row", gap: theme.spacing.sm },
});

export default Home;
