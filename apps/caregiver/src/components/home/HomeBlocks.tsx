import React from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import Button from "@/src/components/ui/button";
import Image from "@/src/components/ui/image";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { monthTitle, weekStrip } from "@/src/home/homeBlocks";
import type { HomeView, VisitView } from "@/src/home/homeModel";
import type { Offer } from "@/src/services/booking.service";
import { formatDuration, formatVisitTime } from "@/src/utils/dates";
import { serviceName } from "@/src/utils/labels";

/** The building blocks of Home, drawn as in the Figma export (screens 8.19.19 and 8.19.29). */

type IconName = React.ComponentProps<typeof Feather>["name"];

export const Card: React.FC<{ children: React.ReactNode; style?: object }> = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

/** "Upcoming Appointments [1]": a bold title with the little teal count square. */
export const SectionHeader: React.FC<{ title: string; count?: number; right?: React.ReactNode }> = ({ title, count, right }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitle}>
      <Text variant="body" weight="bold" color={theme.colors.sectionTitle}>
        {title}
      </Text>
      {count !== undefined && count > 0 ? (
        <View style={styles.badge} testID={`count-${title}`}>
          <Text variant="label" weight="medium" color={theme.colors.white}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
    {right ?? null}
  </View>
);

export const Section: React.FC<{ title: string; count?: number; right?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  count,
  right,
  children,
}) => (
  <View style={styles.section}>
    <SectionHeader title={title} count={count} right={right} />
    {children}
  </View>
);

/** A round avatar: the patient's initial (the home response carries no photo), or a plain icon when there is no name yet. */
const Avatar: React.FC<{ initial?: string }> = ({ initial }) => (
  <View style={styles.avatar}>
    {initial ? (
      <Text variant="h3" weight="bold" color={theme.colors.primary}>
        {initial}
      </Text>
    ) : (
      <Feather name="user" size={22} color={theme.colors.primary} />
    )}
  </View>
);

const Pill: React.FC<{
  label: string;
  icon: IconName;
  tone: "teal" | "coral";
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}> = ({ label, icon, tone, onPress, disabled = false, busy = false }) => {
  const color = tone === "teal" ? theme.colors.primary : theme.colors.secondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: tone === "teal" ? theme.colors.primaryLight : theme.colors.secondaryLight }, disabled && styles.dim]}
    >
      <Feather name={icon} size={13} color={color} />
      <Text variant="label" weight="medium" color={color}>
        {label}
      </Text>
    </Pressable>
  );
};

/** Weekly Availability: month, the green switch, and the five-day strip with today highlighted. */
export const WeeklyAvailability: React.FC<{
  view: HomeView;
  pending: boolean;
  onToggle: (next: boolean) => void;
  /** False only once the OS has said location is not allowed; null while that is still unknown. */
  locationAllowed: boolean | null;
  onAllowLocation: () => void;
  now: Date;
}> = ({ view, pending, onToggle, locationAllowed, onAllowLocation, now }) => (
  <View style={styles.availability}>
    <View style={styles.availabilityHead}>
      <View>
        <Text variant="compact" color={theme.colors.textLight}>
          Weekly Availability
        </Text>
        <Text variant="subtitle" weight="bold">
          {monthTitle(now)}
        </Text>
      </View>
      <Switch
        accessibilityLabel="Available for visits"
        value={view.isAvailable}
        disabled={!view.approved || pending}
        onValueChange={onToggle}
        // Figma: a light grey track with a green knob (grey when off).
        thumbColor={view.isAvailable ? theme.colors.toast : theme.colors.textLight}
        trackColor={{ true: theme.colors.switchTrack, false: theme.colors.switchTrack }}
        ios_backgroundColor={theme.colors.switchTrack}
      />
    </View>

    <View style={styles.strip} testID="week-strip">
      {weekStrip(now).map((day) => (
        <View key={`${day.label}-${day.date}`} style={[styles.day, day.isToday && styles.dayToday]} testID={day.isToday ? "week-today" : undefined}>
          <Text variant="label" color={day.isToday ? theme.colors.white : theme.colors.text}>
            {day.label}
          </Text>
          <Text variant="compact" weight="bold" color={day.isToday ? theme.colors.white : theme.colors.text}>
            {day.date}
          </Text>
        </View>
      ))}
    </View>

    {!view.approved ? (
      <Text variant="small" color={theme.colors.warningText}>
        Your profile is {view.profileStatus.replace("_", " ")}. You can go available once an admin approves it.
      </Text>
    ) : null}
    {view.locationStale && locationAllowed === false ? (
      // Never shared (or turned off): "out of date" would blame a location that never existed (DP1-14).
      <>
        <Text variant="small" color={theme.colors.warningText}>
          You are not receiving offers yet: Oakly needs your location to find visits near you.
        </Text>
        <Button title="Allow location" variant="outline" onPress={onAllowLocation} />
      </>
    ) : view.locationStale ? (
      <Text variant="small" color={theme.colors.warningText}>
        You are not receiving offers: your location is out of date. Open the app with location on to refresh it.
      </Text>
    ) : null}
  </View>
);

/** The coral CarePlan card. Shown only when the server says the caregiver can author plans (nurses). */
export const CarePlanPromo: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <View style={styles.promo} testID="home-care-plans">
    <View style={{ flex: 1, gap: 4 }}>
      <Text variant="subtitle" weight="bold" color={theme.colors.primary}>
        CarePlan
      </Text>
      <Text variant="label" color={theme.colors.textLight}>
        Let&apos;s help you get health care for your loved one
      </Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Create Care Plan" onPress={onCreate} style={styles.promoButton}>
      <Text variant="label" weight="bold" color={theme.colors.white}>
        Create Care Plan
      </Text>
    </Pressable>
  </View>
);

/** The empty "Upcoming Appointments" card. Figma's second line tells a patient to book; a caregiver cannot, so it says what fills the list. */
export const NoAppointments: React.FC = () => (
  <Card style={{ alignItems: "center", gap: theme.spacing.sm }}>
    <Text variant="body" weight="bold" center>
      You do not have any appointments
    </Text>
    <Image source={require("@/assets/images/pngs/calendar-remove.png")} style={{ width: 56, height: 56 }} />
    <Text variant="small" color={theme.colors.textLight} center>
      Accepted visits will appear here.
    </Text>
  </Card>
);

/** One upcoming appointment. Today's visits carry "Clock in" and "Clock out" stacked at the right (Figma); a later day just opens the booking. */
export const AppointmentCard: React.FC<{
  visit: VisitView;
  showClock: boolean;
  onOpen: () => void;
  onClockIn: () => void;
  onClockOut: () => void;
}> = ({ visit, showClock, onOpen, onClockIn, onClockOut }) => {
  const canClockIn = visit.status === "accepted" || visit.status === "en_route";
  const canClockOut = visit.status === "in_progress";
  return (
    <Card>
      <View style={styles.visitRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${visit.patientName}`} onPress={onOpen} style={styles.visitInfo}>
          <Avatar initial={visit.patientName.trim().charAt(0).toUpperCase() || undefined} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" weight="bold" color="#000000">
              {visit.patientName}
            </Text>
            <Text variant="label" color={theme.colors.muted} style={{ textTransform: "capitalize" }}>
              {visit.title}
            </Text>
            {visit.address ? (
              <Text variant="label" color={theme.colors.muted} testID="visit-address">
                {visit.address}
              </Text>
            ) : null}
            <Text variant="label" color={theme.colors.muted}>
              <Feather name="calendar" size={12} /> {visit.when} {"•"} {visit.duration}
            </Text>
            <Text variant="label" weight="medium" color={theme.colors.primary}>
              {visit.statusLabel}
            </Text>
          </View>
        </Pressable>
        {showClock ? (
          <View style={styles.pillColumn}>
            <Pill label="Clock in" icon="clock" tone="teal" onPress={onClockIn} disabled={!canClockIn} />
            <Pill label="Clock out" icon="clock" tone="coral" onPress={onClockOut} disabled={!canClockOut} />
          </View>
        ) : (
          <Feather name="chevron-right" size={20} color={theme.colors.textLight} />
        )}
      </View>
    </Card>
  );
};

/** One job request. The home response carries no patient field before accepting, so it is titled by the service. */
export const JobRequestCard: React.FC<{
  offer: Offer;
  busy: boolean;
  onView: () => void;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ offer, busy, onView, onAccept, onDecline }) => (
  <Card>
    <View style={styles.visitRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Job details" onPress={onView} style={styles.visitInfo}>
        <Avatar />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" weight="bold" color="#000000">
            {serviceName(offer.serviceType)}
          </Text>
          {offer.assistanceType ? (
            <Text variant="label" color={theme.colors.muted}>
              {offer.assistanceType}
            </Text>
          ) : null}
          <Text variant="label" color={theme.colors.muted}>
            <Feather name="map-pin" size={12} /> {offer.area}
          </Text>
          <Text variant="label" color={theme.colors.muted}>
            <Feather name="calendar" size={12} /> {formatVisitTime(offer.scheduledDate)} {"•"} {formatDuration(offer.durationHours)}
          </Text>
        </View>
      </Pressable>
      <View style={styles.pillColumn}>
        <Pill label="Accept" icon="check-circle" tone="teal" onPress={onAccept} disabled={busy} busy={busy} />
        <Pill label="Decline" icon="x-circle" tone="coral" onPress={onDecline} disabled={busy} />
      </View>
    </View>
  </Card>
);

/** Earning Summary: the wallet figures the home and wallet endpoints already return. */
export const EarningSummary: React.FC<{
  balance: string;
  pending: string | null;
  held: string | null;
  onOpen: () => void;
}> = ({ balance, pending, held, onOpen }) => (
  <Pressable testID="home-wallet" accessibilityRole="button" accessibilityLabel="Wallet, open" onPress={onOpen}>
    <Card style={{ gap: theme.spacing.sm }}>
      <Row label="Wallet Balance" value={balance} valueTestID="wallet-balance" />
      {pending ? <Row label="Pending Payment" value={pending} valueTestID="wallet-pending" /> : null}
      {held ? <Row label="On hold (under review)" value={held} valueTestID="wallet-held" /> : null}
    </Card>
  </Pressable>
);

const Row: React.FC<{ label: string; value: string; valueTestID?: string }> = ({ label, value, valueTestID }) => (
  <View style={styles.row}>
    <Text variant="compact">{label}</Text>
    <Text variant="compact" weight="bold" color={theme.colors.primary} testID={valueTestID}>
      {value}
    </Text>
  </View>
);

/** The latest notification with "See all >". */
export const NotificationBlock: React.FC<{ unread: number; title: string; ago: string; onSeeAll: () => void }> = ({
  unread,
  title,
  ago,
  onSeeAll,
}) => (
  <Section
    title="Notification"
    count={unread}
    right={
      <Pressable accessibilityRole="button" accessibilityLabel="See all notifications" onPress={onSeeAll} style={styles.seeAll}>
        <Text variant="small">See all</Text>
        <Feather name="chevron-right" size={16} color={theme.colors.text} />
      </Pressable>
    }
  >
    <Card>
      <View style={styles.row}>
        <Text variant="small" style={{ flex: 1, paddingRight: theme.spacing.sm }} numberOfLines={2}>
          {title}
        </Text>
        <Text variant="small" weight="bold" color={theme.colors.primary}>
          {ago}
        </Text>
      </View>
    </Card>
  </Section>
);

/** Client Care Access: shortcuts to the client's profile and to vitals and FallGuard. */
export const ClientCareAccess: React.FC<{
  canOpenProfile: boolean;
  onProfile: () => void;
  onVitals: () => void;
}> = ({ canOpenProfile, onProfile, onVitals }) => (
  <Section title="Client Care Access">
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={styles.row}>
        <Text variant="body" color="#000000">Clients Profiles</Text>
        <Pill label="View" icon="check-circle" tone="teal" onPress={onProfile} disabled={!canOpenProfile} />
      </View>
      {canOpenProfile ? null : (
        <Text variant="caption" color={theme.colors.textLight}>
          A client&apos;s profile opens once you have an accepted visit.
        </Text>
      )}
      <View style={styles.row}>
        <Text variant="body" color="#000000">Vitals &amp; FallGuard</Text>
        <Pill label="View" icon="check-circle" tone="teal" onPress={onVitals} />
      </View>
    </Card>
  </Section>
);

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  section: { paddingHorizontal: 20, marginBottom: theme.spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.spacing.sm },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 4,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    minWidth: 84,
    borderRadius: theme.borderRadius.round,
  },
  dim: { opacity: 0.4 },
  availability: { paddingHorizontal: 20, paddingTop: 20, marginBottom: theme.spacing.md, gap: theme.spacing.sm },
  availabilityHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  strip: { flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.sm },
  day: { alignItems: "center", gap: 6, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm, borderRadius: theme.borderRadius.lg, minWidth: 48 },
  dayToday: { backgroundColor: theme.colors.primary },
  promo: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    marginHorizontal: 20,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.promoBackground,
  },
  promoButton: { minHeight: 32, paddingVertical: 6, paddingHorizontal: 14, borderRadius: theme.borderRadius.round, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  visitRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  visitInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  pillColumn: { gap: theme.spacing.sm, alignItems: "stretch" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 2 },
});
