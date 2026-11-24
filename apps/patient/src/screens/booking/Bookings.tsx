import type React from "react";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import ProviderAvatar from "@/src/components/booking/ProviderAvatar";
import { useTabTopBand } from "@/src/components/StatusBar/screenChrome";
import Button from "@/src/components/ui/button";
import { Card, EmptyState } from "@/src/components/ui/card";
import Icon, { type IconName } from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import SegmentedControl from "@/src/components/ui/segmented-control";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { canCancel, canTrack, needsPayment, refundText, statusLabel, tabForStatus, type Booking, type BookingTab } from "@/src/domain/booking";
import { addDays, monthHeading, sameDay, SHORT_WEEKDAYS, visitLine, weekDays, weekStart } from "@/src/domain/bookingList";
import { messageForError } from "@/src/api/errors";
import { useBookings } from "@/src/hooks/useBookings";
import { useNav } from "@/src/navigation/Navigations";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
] as const;

const EMPTY: Record<BookingTab, string> = {
  upcoming: "No upcoming bookings",
  completed: "No completed bookings yet",
  canceled: "No canceled bookings",
};

/** A small rounded action under a card ("Chat", "Cancel", "Booking Details"). */
const Pill: React.FC<{ label: string; icon: IconName; danger?: boolean; onPress: () => void }> = ({ label, icon, danger, onPress }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.pill, danger && styles.pillDanger]}>
    <Icon name={icon} size={14} color={danger ? theme.colors.secondary : theme.colors.text} />
    <Text variant="fine" weight="medium" color={danger ? theme.colors.secondary : theme.colors.text}>
      {label}
    </Text>
  </Pressable>
);

const BookingCard: React.FC<{ booking: Booking; tab: BookingTab }> = ({ booking, tab }) => {
  const navigation = useNav();
  const caregiver = booking.caregiver;
  const canceled = tab === "canceled";
  return (
    <Card accessibilityLabel={`Booking ${booking.reference}`} style={styles.card}>
      <View style={styles.cardRow}>
        <ProviderAvatar uri={caregiver?.photoUrl} name={caregiver?.firstName} />
        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text weight="bold" style={styles.name} numberOfLines={1}>
              {caregiver?.firstName ?? booking.service}
            </Text>
            {canTrack(booking) ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Track" onPress={() => navigation.navigate("CaregiverDetail", { id: booking.id })} style={styles.track}>
                <Icon name="location-outline" size={12} color={theme.colors.primary} />
                <Text variant="fine" weight="medium" color={theme.colors.primary}>
                  Track
                </Text>
              </Pressable>
            ) : null}
          </View>
          {caregiver ? (
            <Text variant="small" color={theme.colors.textLight} numberOfLines={1}>
              {caregiver.role ?? "Health Care Provider"}
            </Text>
          ) : null}
          <View style={styles.line}>
            <Icon name="calendar-outline" size={14} color={theme.colors.textLight} />
            <Text variant="small" color={theme.colors.textLight} numberOfLines={1} style={styles.lineText}>
              {visitLine(booking.scheduledAt, booking.durationMinutes)}
            </Text>
          </View>
          <View style={styles.line}>
            <Icon name={canceled ? "close-circle-outline" : "ellipse"} size={canceled ? 14 : 7} color={canceled ? theme.colors.secondary : theme.colors.primary} />
            <Text variant="small" weight="medium" color={canceled ? theme.colors.secondary : tab === "completed" ? theme.colors.success : theme.colors.primary} style={styles.lineText}>
              {statusLabel(booking)}
            </Text>
          </View>
        </View>
      </View>
      {booking.refund ? (
        <Text variant="small" color={theme.colors.textLight}>
          {refundText(booking.refund)}
        </Text>
      ) : null}
      <View style={styles.pills}>
        {needsPayment(booking) ? <Pill label="Pay now" icon="card-outline" onPress={() => navigation.navigate("PaymentResult", { bookingId: booking.id, open: true })} /> : null}
        {caregiver && tab === "upcoming" ? <Pill label="Chat" icon="chatbubbles-outline" onPress={() => navigation.navigate("Chat", { id: booking.id })} /> : null}
        {canCancel(booking) ? <Pill label="Cancel" icon="close-circle-outline" danger onPress={() => navigation.navigate("CancelBooking", { id: booking.id })} /> : null}
        <Pill label="Booking Details" icon="document-text-outline" onPress={() => navigation.navigate("BookingDetails", { id: booking.id })} />
      </View>
    </Card>
  );
};

/** The month heading and the week of days; tap a day to see only that day's bookings, tap it again to see all. */
const WeekStrip: React.FC<{ start: Date; selected: Date | null; busy: (day: Date) => boolean; onSelect: (day: Date | null) => void; onShift: (weeks: number) => void }> = ({
  start,
  selected,
  busy,
  onSelect,
  onShift,
}) => {
  const today = new Date();
  return (
    <View style={styles.strip}>
      <View style={styles.monthRow}>
        <Text variant="h3" weight="bold" color="#1B1464">
          {monthHeading(start)}
        </Text>
        <View style={styles.weekArrows}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={10} onPress={() => onShift(-1)}>
            <Icon name="chevron-back" size={18} color={theme.colors.textLight} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next week" hitSlop={10} onPress={() => onShift(1)}>
            <Icon name="chevron-forward" size={18} color={theme.colors.textLight} />
          </Pressable>
        </View>
      </View>
      <View style={styles.days}>
        {weekDays(start).map((day) => {
          const isSelected = selected !== null && sameDay(day, selected);
          const isToday = sameDay(day, today);
          return (
            <Pressable
              key={day.toISOString()}
              accessibilityRole="button"
              accessibilityLabel={`${SHORT_WEEKDAYS[day.getDay()]} ${day.getDate()}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(isSelected ? null : day)}
              style={[styles.day, isSelected && styles.daySelected]}
            >
              <Text variant="fine" color={isSelected ? theme.colors.white : theme.colors.textLight}>
                {SHORT_WEEKDAYS[day.getDay()]}
              </Text>
              <Text weight="bold" color={isSelected ? theme.colors.white : isToday ? theme.colors.primary : theme.colors.text}>
                {day.getDate()}
              </Text>
              <View style={[styles.dot, busy(day) && { backgroundColor: isSelected ? theme.colors.white : theme.colors.primary }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const Bookings: React.FC = () => {
  useTabTopBand(theme.colors.primary);
  const bookings = useBookings();
  const [tab, setTab] = useState<BookingTab>("upcoming");
  const [start, setStart] = useState(() => weekStart(new Date()));
  const [day, setDay] = useState<Date | null>(null);
  // Upcoming visits run soonest first; finished and canceled ones newest first.
  const inTab = useMemo(() => {
    const rows = (bookings.data ?? []).filter((b) => tabForStatus(b.status) === tab);
    const order = tab === "upcoming" ? 1 : -1;
    return [...rows].sort((a, b) => order * (Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)));
  }, [bookings.data, tab]);
  const shown = day ? inTab.filter((b) => sameDay(new Date(b.scheduledAt), day)) : inTab;
  const busy = (d: Date) => inTab.some((b) => sameDay(new Date(b.scheduledAt), d));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text variant="h2" weight="bold" color={theme.colors.white}>
          Bookings
        </Text>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} tone="onTeal" />
      </View>
      <KeyboardScrollView contentContainerStyle={styles.content}>
        <WeekStrip start={start} selected={day} busy={busy} onSelect={setDay} onShift={(weeks) => setStart((current) => addDays(current, weeks * 7))} />
        {bookings.isLoading ? (
          <Text color={theme.colors.textLight}>Loading your bookings…</Text>
        ) : bookings.isError ? (
          <Card tone="warm">
            <Text accessibilityRole="alert">{messageForError(bookings.error)}</Text>
            <Button small variant="outline" title="Try again" onPress={() => void bookings.refetch()} />
          </Card>
        ) : null}
        {bookings.isLoading || (bookings.isError && !bookings.data) ? null : shown.length === 0 ? (
          <EmptyState
            title={day ? "No bookings on this day" : EMPTY[tab]}
            message={day ? "Tap the day again to see all of them." : tab === "upcoming" ? "Tap Start Booking on Home to book a visit." : undefined}
          />
        ) : (
          shown.map((booking) => <BookingCard key={booking.id} booking={booking} tab={tab} />)
        )}
      </KeyboardScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.pageTint },
  header: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.md,
    borderBottomLeftRadius: theme.borderRadius.xxl,
    borderBottomRightRadius: theme.borderRadius.xxl,
  },
  // Extra bottom room: the last row must clear the floating tab bar without scrolling past it.
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl * 2, gap: theme.spacing.md },
  strip: { gap: theme.spacing.sm },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekArrows: { flexDirection: "row", gap: theme.spacing.md },
  days: { flexDirection: "row", justifyContent: "space-between" },
  day: { width: 46, alignItems: "center", paddingVertical: theme.spacing.sm, borderRadius: theme.borderRadius.lg, gap: 2 },
  daySelected: { backgroundColor: theme.colors.primary },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "transparent" },
  card: { borderWidth: 0, backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.md },
  cardRow: { flexDirection: "row", gap: theme.spacing.md },
  cardBody: { flex: 1, gap: 4, justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  name: { flexShrink: 1 },
  track: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.background,
  },
  line: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs + 2 },
  lineText: { flexShrink: 1 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.colors.background,
  },
  pillDanger: { backgroundColor: theme.colors.errorLight },
});

export default Bookings;
