import { useIsFocused } from "@react-navigation/native";
import type React from "react";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { messageForError } from "@/src/api/errors";
import { useBottomBand, useTopBand } from "@/src/components/StatusBar/screenChrome";
import { takeBookingStart } from "@/src/auth/pendingSignIn";
import BookBannerArt from "@/src/components/home/book-banner-art";
import EmptyCalendar from "@/src/components/home/empty-calendar";
import NotificationBell from "@/src/components/NotificationBell";
import Button from "@/src/components/ui/button";
import { Card, Chip } from "@/src/components/ui/card";
import Icon from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { canTrack, statusLabel, tabForStatus } from "@/src/domain/booking";
import { formatDateTime } from "@/src/domain/format";
import { shortAgoText } from "@/src/domain/tracking";
import { readingText } from "@/src/domain/vitals";
import { useBookings } from "@/src/hooks/useBookings";
import { useMe } from "@/src/hooks/queries";
import { useVitalReadings } from "@/src/hooks/useVitals";
import { useNav } from "@/src/navigation/Navigations";

/** First name for the greeting; the full name when it has no space. */
const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

/** The two Home vital tiles in the Figma order, with the Figma wording and icon (blood pressure first, a heart; heart rate second, a pulse). */
const TILES = [
  { kind: "blood_pressure", label: "Blood Pressure", icon: "heart", unit: "" },
  { kind: "heart_rate", label: "Heart Rate", icon: "pulse", unit: " BPM" },
] as const;

/**
 * Figma: Quick Service is a row of round tiles; only the services that are built are shown (Book a Nurse). The artwork is the
 * figures alone on a transparent background (`assets/images/quick/`): the tile draws its own pale pink circle. The other
 * pictures in that folder (prescription-request, physiotherapy-request, medication-reminder) are for services and cards that
 * are not built yet and are deliberately not shown.
 */
const QUICK_NURSE = require("../../../assets/images/quick/book-a-nurse.png");
const QUICK_TILE_TINT = "#FCEDEB";

const Home: React.FC = () => {
  const navigation = useNav();
  const me = useMe();
  const bookings = useBookings();
  const readings = useVitalReadings();
  const { width } = useWindowDimensions();
  // Figma: the faint cool white runs edge to edge, behind the status bar and the strip under the tab bar too.
  const focused = useIsFocused();
  useTopBand(focused ? theme.colors.pageTint : null);
  useBottomBand(focused ? theme.colors.pageTint : null);
  // "Start Booking Journey" on the account-created page signs in and lands here: open the booking form once, as Figma does.
  useEffect(() => {
    if (!takeBookingStart()) return;
    // Let the navigator finish mounting this screen before pushing the next one on top of it.
    const timer = setTimeout(() => navigation.navigate("BookingStep1"), 0);
    return () => clearTimeout(timer);
  }, [navigation]);

  const upcoming = (bookings.data ?? []).filter((b) => tabForStatus(b.status) === "upcoming");
  const latest = (kind: "heart_rate" | "blood_pressure") => readings.data?.find((r) => r.kind === kind);
  const bannerWidth = width - 40;
  // "10 mins ago" on the vital tiles: re-read the clock once a minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.page}>
      <KeyboardScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" hitSlop={8} onPress={() => navigation.navigate("Profile")} style={styles.round}>
            <Icon name="menu-outline" size={22} />
          </Pressable>
          <NotificationBell />
        </View>

        <View>
          <Text variant="page" weight="bold" style={styles.greeting}>
            {me.data ? `Hello ${firstName(me.data.full_name)},👋` : "Hello 👋"}
          </Text>
          <Text color={theme.colors.textLight}>What do you like to do today?</Text>
        </View>

        <View style={styles.banner}>
          <BookBannerArt width={bannerWidth} />
          <View style={styles.bannerText}>
            <Text variant="page" weight="bold" color={theme.colors.primary}>
              Book a Service
            </Text>
            <Text variant="small" color={theme.colors.textLight}>
              {"Let's help you get health care for your loved one"}
            </Text>
          </View>
          <Button title="Start Booking" small onPress={() => navigation.navigate("BookingStep1")} style={styles.startBooking} />
        </View>

        <Text weight="bold" style={styles.heading}>
          Quick Service
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Book a Nurse" onPress={() => navigation.navigate("BookingStep1")} style={styles.quick}>
          <View style={styles.quickCircle}>
            <Image source={QUICK_NURSE} style={styles.quickIcon} resizeMode="contain" />
          </View>
          <Text variant="small" weight="medium">Book a Nurse</Text>
        </Pressable>

        <Text weight="bold" style={styles.heading}>
          Remote Monitoring
        </Text>
        <View style={styles.tiles}>
          {TILES.map((tile) => {
            const reading = latest(tile.kind);
            return (
              <Pressable
                key={tile.kind}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
                onPress={() => navigation.navigate("VitalDetail", { kind: tile.kind })}
                style={styles.tile}
              >
                <View style={styles.tileHead}>
                  <Text variant="small" color={theme.colors.textLight}>
                    {tile.label}
                  </Text>
                  <Icon name={tile.icon} size={20} color={theme.colors.secondary} />
                </View>
                {reading ? (
                  <Text variant="h2" weight="bold">
                    {`${readingText(reading)}${tile.unit}`}
                  </Text>
                ) : (
                  <Text weight="bold">No reading yet</Text>
                )}
                <Text variant="small">{reading ? shortAgoText(reading.recordedAt, now) : " "}</Text>
              </Pressable>
            );
          })}
        </View>

        {bookings.isLoading || bookings.isError ? null : upcoming.length === 0 ? null : (
          <View style={styles.countRow}>
            <Text color={theme.colors.textLight}>Your loved one&apos;s appointments</Text>
            <View style={styles.count}>
              <Text variant="small" color={theme.colors.textLight}>
                {String(upcoming.length)}
              </Text>
            </View>
          </View>
        )}
        {bookings.isError ? (
          <Card tone="warm">
            <Text accessibilityRole="alert">{messageForError(bookings.error)}</Text>
            <Button small variant="outline" title="Try again" onPress={() => void bookings.refetch()} />
          </Card>
        ) : null}
        {bookings.isLoading || bookings.isError ? null : upcoming.length === 0 ? (
          <View style={styles.empty}>
            <Text weight="bold" center style={styles.emptyTitle}>
              You do not have any appointments
            </Text>
            <EmptyCalendar />
            <Text variant="small" center style={styles.emptyText}>
              Click on start booking to book appointments for your loved ones
            </Text>
          </View>
        ) : (
          upcoming.map((booking) => (
            <Pressable
              key={booking.id}
              accessibilityRole="button"
              accessibilityLabel={`Booking ${booking.reference}`}
              onPress={() => navigation.navigate("BookingDetails", { id: booking.id })}
              style={styles.appointment}
            >
              <View style={styles.rowBetween}>
                <Text weight="bold">{booking.service}</Text>
                <Chip label={statusLabel(booking)} tone={booking.status === "pending" ? "warning" : "primary"} />
              </View>
              <Text variant="small" color={theme.colors.textLight}>
                {`${booking.bookingFor} · ${formatDateTime(booking.scheduledAt)}`}
              </Text>
              <View style={styles.actions}>
                {booking.caregiver ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Chat" onPress={() => navigation.navigate("Chat", { id: booking.id })} style={styles.pill}>
                    <Icon name="chatbubble-ellipses-outline" size={15} color={theme.colors.primary} />
                    <Text variant="small" weight="medium" color={theme.colors.primary}>
                      Chat
                    </Text>
                  </Pressable>
                ) : null}
                {canTrack(booking) ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Track" onPress={() => navigation.navigate("CaregiverDetail", { id: booking.id })} style={styles.pill}>
                    <Icon name="location-outline" size={15} color={theme.colors.primary} />
                    <Text variant="small" weight="medium" color={theme.colors.primary}>
                      Track
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </KeyboardScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.pageTint },
  // Extra bottom room: the last row must clear the floating tab bar without scrolling past it.
  content: { paddingHorizontal: 20, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.text, alignItems: "center", justifyContent: "center" },
  greeting: { marginTop: theme.spacing.xs },
  banner: {
    backgroundColor: theme.colors.secondaryLight,
    borderRadius: 22,
    height: 132,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
  },
  bannerText: { flex: 1, gap: theme.spacing.xs, paddingRight: theme.spacing.sm },
  startBooking: { paddingHorizontal: theme.spacing.md, minHeight: 40 },
  heading: { fontSize: theme.sizes.subtitle, marginTop: theme.spacing.xs },
  quick: { alignItems: "center", alignSelf: "flex-start", gap: theme.spacing.xs, paddingLeft: theme.spacing.xs },
  quickCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: QUICK_TILE_TINT, borderWidth: 1, borderColor: "#D9E4E6", alignItems: "center", justifyContent: "center" },
  quickIcon: { width: 46, height: 37 },
  tiles: { flexDirection: "row", gap: theme.spacing.md },
  tile: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.small,
    shadowOpacity: 0.06,
  },
  tileHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  countRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  count: { backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.sm + 2, paddingVertical: theme.spacing.xs },
  empty: {
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    alignItems: "center",
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    ...theme.shadows.small,
    shadowOpacity: 0.06,
  },
  emptyTitle: { maxWidth: 190 },
  emptyText: { maxWidth: 230 },
  appointment: { backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xxl, padding: theme.spacing.md, gap: theme.spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.sm },
  actions: { flexDirection: "row", gap: theme.spacing.sm },
  pill: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.lg, paddingVertical: theme.spacing.xs + 2, paddingHorizontal: theme.spacing.md },
});

export default Home;
