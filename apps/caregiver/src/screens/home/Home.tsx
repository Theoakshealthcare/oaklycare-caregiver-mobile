import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import DeclineDialog from "@/src/components/booking/DeclineDialog";
import {
  AppointmentCard,
  CarePlanPromo,
  ClientCareAccess,
  EarningSummary,
  JobRequestCard,
  NoAppointments,
  NotificationBlock,
  Section,
  WeeklyAvailability,
} from "@/src/components/home/HomeBlocks";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { greetingLine, HOME_SUBTITLE, timeAgo } from "@/src/home/homeBlocks";
import { firstName, mapHome } from "@/src/home/homeModel";
import { notificationView } from "@/src/account/notificationModel";
import { useAvailability } from "@/src/hooks/useAvailability";
import { useCaregiverHome, useMe, useNotifications, useWallet } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { useOfferActions } from "@/src/hooks/useOfferActions";
import { ensureBackgroundLocation, ensureForegroundLocation, LOCATION_SHARING_SENTENCE } from "@/src/supply/permissions";
import { useLocationPermissions } from "@/src/supply/permissionState";
import { hasActiveVisit } from "@/src/supply/tracking";
import { walletBalances } from "@/src/wallet/walletModel";

const Header: React.FC<{ name: string | undefined; onMenu: () => void; onBell: () => void }> = ({ name, onMenu, onBell }) => (
  <View style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, gap: 16 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <RoundIcon icon="menu" label="Menu" onPress={onMenu} />
      <RoundIcon icon="bell" label="Notifications" onPress={onBell} />
    </View>
    <View>
      <Text variant="h2" weight="bold" color={theme.colors.white}>
        {greetingLine(firstName(name))}
      </Text>
      <Text variant="body" color={theme.colors.white} style={{ marginTop: 4 }}>
        {HOME_SUBTITLE}
      </Text>
    </View>
  </View>
);

/** The white-ringed round buttons at the top of Home (the menu opens Profile Settings, the bell the notifications). */
const RoundIcon: React.FC<{ icon: React.ComponentProps<typeof Feather>["name"]; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={{
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.white,
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Feather name={icon} size={22} color={theme.colors.white} />
  </TouchableOpacity>
);

const Home: React.FC = () => {
  const { navigation } = useNavigation();
  const me = useMe();
  const home = useCaregiverHome();
  const availability = useAvailability();
  const wallet = useWallet();
  const permissions = useLocationPermissions();

  // Back on this screen from a visit or an offer: show the latest right away.
  // The focus refetch is silent. `RefreshControl.refreshing` follows only a pull by the caregiver:
  // driving it from `isRefetching` left the native spinner stuck and the content pushed down ~700px (DP1-07).
  const { refetch } = home;
  const [pulling, setPulling] = useState(false);
  const pullToRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const [declineId, setDeclineId] = useState<string | null>(null);
  const { accept, decline, busyId } = useOfferActions({
    onAccepted: (bookingId) => navigation.navigate("BookingDetails", { bookingId }),
    onGone: () => setDeclineId(null),
  });

  // Staleness is judged as of the moment the data was fetched (home is polled at least every 60 s).
  const { data, dataUpdatedAt } = home;
  const view = useMemo(() => (data ? mapHome(data, dataUpdatedAt) : null), [data, dataUpdatedAt]);
  // Earnings still being cleared come from the wallet summary; Home works without it.
  const pending = wallet.data ? walletBalances(wallet.data).pending : null;
  const held = wallet.data ? walletBalances(wallet.data).held : null;

  // The latest notification and how many are unread, from the list the Notifications screen reads.
  const notificationsQuery = useNotifications();
  const notifications = notificationsQuery.data;
  const latest = useMemo(() => {
    if (!notifications || notifications.length === 0) return null;
    const newest = [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return newest ? { view: notificationView(newest), createdAt: newest.created_at } : null;
  }, [notifications]);
  const unread = notifications ? notifications.filter((n) => !n.is_read).length : 0;

  const openVisit = (bookingId: string) => navigation.navigate("VisitFlow", { bookingId });

  const body = () => {
    if (!view) {
      if (home.isError) {
        return (
          <View style={{ padding: 20, gap: 12 }}>
            <Text variant="body" color={theme.colors.textLight}>
              {messageForError(home.error)}
            </Text>
            <Button title="Try again" onPress={() => void home.refetch()} />
          </View>
        );
      }
      return <ActivityIndicator style={{ marginTop: 40 }} size="large" color={theme.colors.primary} />;
    }

    const onAVisit = hasActiveVisit(view.todayVisits.map((v) => v.status));
    const appointments = view.todayVisits.length + view.upcomingVisits.length;
    // A client's profile opens while the visit is accepted, on the way or in progress (backend rule): prefer the live one.
    const clientVisit = [...view.todayVisits, ...view.upcomingVisits].sort((a, b) => Number(b.inFlight) - Number(a.inFlight))[0];
    return (
      <>
        <WeeklyAvailability
          view={view}
          pending={availability.pending}
          onToggle={availability.setAvailable}
          locationAllowed={permissions.loaded ? permissions.foreground : null}
          onAllowLocation={() => void ensureForegroundLocation()}
          now={new Date()}
        />

        {onAVisit && !permissions.background ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={{ backgroundColor: theme.colors.secondaryLight, borderRadius: 16, padding: 16, gap: 8 }}>
              <Text variant="small">
                {LOCATION_SHARING_SENTENCE}
              </Text>
              <Button title="Allow location during visits" variant="outline" onPress={() => void ensureBackgroundLocation()} />
            </View>
          </View>
        ) : null}

        {view.canAuthorCarePlans ? <CarePlanPromo onCreate={() => navigation.navigate("CarePlans")} /> : null}

        <Section title="Upcoming Appointments" count={appointments}>
          {appointments === 0 ? (
            <NoAppointments />
          ) : (
            <>
              {view.todayVisits.map((visit) => (
                <AppointmentCard
                  key={visit.id}
                  visit={visit}
                  showClock
                  onOpen={() => navigation.navigate("BookingDetails", { bookingId: visit.id })}
                  onClockIn={() => openVisit(visit.id)}
                  onClockOut={() => navigation.navigate("VisitFlow", { bookingId: visit.id, clockOut: true })}
                />
              ))}
              {view.upcomingVisits.map((visit) => (
                <AppointmentCard
                  key={visit.id}
                  visit={visit}
                  showClock={false}
                  onOpen={() => navigation.navigate("BookingDetails", { bookingId: visit.id })}
                  onClockIn={() => openVisit(visit.id)}
                  onClockOut={() => openVisit(visit.id)}
                />
              ))}
            </>
          )}
        </Section>

        <Section title="New Job Request" count={view.offers.length}>
          {view.offers.length === 0 ? (
            <NoRequests approved={view.approved} />
          ) : (
            view.offers.map((offer) => (
              <JobRequestCard
                key={offer.id}
                offer={offer}
                busy={busyId === offer.id}
                onView={() => navigation.navigate("BookingDetails", { bookingId: offer.id, offer })}
                onAccept={() => accept(offer.id)}
                onDecline={() => setDeclineId(offer.id)}
              />
            ))
          )}
        </Section>

        <Section title="Earning Summary">
          <EarningSummary
            balance={view.walletBalance}
            pending={pending?.amount ?? null}
            held={held?.amount ?? null}
            onOpen={() => navigation.navigate("Wallet")}
          />
        </Section>

        {latest ? (
          <NotificationBlock
            unread={unread}
            title={latest.view.title}
            ago={timeAgo(latest.createdAt, notificationsQuery.dataUpdatedAt)}
            onSeeAll={() => navigation.navigate("Notifications")}
          />
        ) : null}

        <ClientCareAccess
          canOpenProfile={Boolean(clientVisit)}
          onProfile={() => {
            if (clientVisit) navigation.navigate("ClientProfile", { bookingId: clientVisit.id });
          }}
          onVitals={() => navigation.navigate("BottomNavigation", { tab: "vitals", at: Date.now() })}
        />
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
      <Header
        name={me.data?.full_name}
        onMenu={() => navigation.navigate("Profile")}
        onBell={() => navigation.navigate("Notifications")}
      />
      <ScrollView
        testID="home-scroll"
        style={{ flex: 1, backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pullToRefresh()} />}
      >
        {body()}
      </ScrollView>
      <DeclineDialog
        visible={declineId !== null}
        onClose={() => setDeclineId(null)}
        onConfirm={() => {
          if (declineId) decline(declineId);
          setDeclineId(null);
        }}
      />
    </View>
  );
};

/** Nothing to accept right now. Figma has no empty state here; a caregiver who is not approved yet is told why. */
const NoRequests: React.FC<{ approved: boolean }> = ({ approved }) => (
  <View style={{ backgroundColor: theme.colors.white, borderRadius: 16, padding: 16 }}>
    <Text variant="small" color={theme.colors.textLight}>
      {approved ? "New requests appear here when patients near you book." : "Requests start once your profile is approved."}
    </Text>
  </View>
);

export default Home;
