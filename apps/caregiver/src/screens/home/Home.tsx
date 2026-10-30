import React, { useCallback, useMemo } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Switch, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import OfferCard from "@/src/components/booking/OfferCard";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { greeting, mapHome, type HomeView, type VisitView } from "@/src/home/homeModel";
import { useAvailability } from "@/src/hooks/useAvailability";
import { useCaregiverHome, useMe, useWallet } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { useOfferActions } from "@/src/hooks/useOfferActions";
import { ensureBackgroundLocation } from "@/src/supply/permissions";
import { useLocationPermissions } from "@/src/supply/permissionState";
import { hasActiveVisit } from "@/src/supply/tracking";
import { walletBalances } from "@/src/wallet/walletModel";

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
    <Text variant="body" weight="bold" style={{ marginBottom: 8 }}>
      {title}
    </Text>
    {children}
  </View>
);

const Empty: React.FC<{ icon: React.ComponentProps<typeof Feather>["name"]; title: string; hint: string }> = ({
  icon,
  title,
  hint,
}) => (
  <View style={{ alignItems: "center", padding: 24, backgroundColor: theme.colors.white, borderRadius: 16 }}>
    <Feather name={icon} size={40} color={theme.colors.primary} style={{ marginBottom: 8 }} />
    <Text variant="body" weight="bold" style={{ marginBottom: 4 }}>
      {title}
    </Text>
    <Text variant="small" color={theme.colors.textLight} style={{ textAlign: "center" }}>
      {hint}
    </Text>
  </View>
);

const VisitRow: React.FC<{ visit: VisitView; onOpen: () => void }> = ({ visit, onOpen }) => (
  <View
    style={{
      backgroundColor: theme.colors.white,
      borderRadius: 16,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    }}
  >
    <View style={{ flex: 1 }}>
      <Text variant="body" weight="bold" style={{ textTransform: "capitalize" }}>
        {visit.title}
      </Text>
      <Text variant="small" color={theme.colors.textLight}>
        {visit.patientName}
      </Text>
      {visit.address ? (
        <Text variant="small" color={theme.colors.textLight} testID="visit-address">
          {visit.address}
        </Text>
      ) : null}
      <Text variant="small" color={theme.colors.textLight}>
        {visit.when} {"•"} {visit.duration}
      </Text>
      <Text variant="small" color={theme.colors.primary} weight="medium">
        {visit.statusLabel}
      </Text>
    </View>
    <Button title={visit.inFlight ? "Continue" : "Open"} onPress={onOpen} />
  </View>
);

const Header: React.FC<{ name: string | undefined; onAvatar: () => void; onBell: () => void }> = ({
  name,
  onAvatar,
  onBell,
}) => (
  <View
    style={{
      paddingTop: 50,
      paddingBottom: 20,
      paddingHorizontal: 20,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text variant="h2" weight="bold" color={theme.colors.white}>
        {greeting(name)}
      </Text>
      <Text variant="body" color={theme.colors.white} style={{ marginTop: 4 }}>
        What would you like to do today?
      </Text>
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={onBell}
        style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Feather name="bell" size={24} color={theme.colors.white} />
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Account"
        onPress={onAvatar}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 2,
          borderColor: theme.colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text variant="body" weight="bold" color={theme.colors.white}>
          {name?.trim().charAt(0).toUpperCase() ?? "?"}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

const AvailabilityCard: React.FC<{
  view: HomeView;
  pending: boolean;
  onToggle: (next: boolean) => void;
}> = ({ view, pending, onToggle }) => (
  <View style={{ paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 }}>
    <View style={{ backgroundColor: theme.colors.white, borderRadius: 16, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text variant="body" weight="bold">
            {view.isAvailable ? "You're available" : "You're unavailable"}
          </Text>
          <Text variant="small" color={theme.colors.textLight}>
            {view.isAvailable ? "You can receive new visit requests." : "Switch on to receive new visit requests."}
          </Text>
        </View>
        <Switch
          accessibilityLabel="Available for visits"
          value={view.isAvailable}
          disabled={!view.approved || pending}
          onValueChange={onToggle}
          thumbColor={view.isAvailable ? theme.colors.primary : theme.colors.border}
          trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        />
      </View>
      {!view.approved ? (
        <Text variant="small" color={theme.colors.warningText}>
          Your profile is {view.profileStatus.replace("_", " ")}. You can go available once an admin approves it.
        </Text>
      ) : null}
      {view.locationStale ? (
        <Text variant="small" color={theme.colors.warningText}>
          You are not receiving offers: your location is out of date. Open the app with location on to refresh it.
        </Text>
      ) : null}
    </View>
  </View>
);

const Home: React.FC = () => {
  const { navigation } = useNavigation();
  const me = useMe();
  const home = useCaregiverHome();
  const availability = useAvailability();
  const wallet = useWallet();
  const permissions = useLocationPermissions();

  // Back on this screen from a visit or an offer: show the latest right away.
  const { refetch } = home;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const { accept, decline, busyId } = useOfferActions({
    onAccepted: (bookingId) => navigation.navigate("BookingDetails", { bookingId }),
  });

  // Staleness is judged as of the moment the data was fetched (home is polled at least every 60 s).
  const { data, dataUpdatedAt } = home;
  const view = useMemo(() => (data ? mapHome(data, dataUpdatedAt) : null), [data, dataUpdatedAt]);
  // Earnings still being cleared come from the wallet summary; Home works without it.
  const pending = wallet.data ? walletBalances(wallet.data).pending : null;

  const confirmDecline = (bookingId: string) =>
    Alert.alert("Decline this job?", "It will be offered to other caregivers.", [
      { text: "Cancel", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: () => decline(bookingId) },
    ]);

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
    return (
      <>
        <AvailabilityCard view={view} pending={availability.pending} onToggle={availability.setAvailable} />

        {onAVisit && !permissions.background ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={{ backgroundColor: theme.colors.secondaryLight, borderRadius: 16, padding: 16, gap: 8 }}>
              <Text variant="small">
                Share your location during visits, even with the app closed, so the patient can follow your arrival.
              </Text>
              <Button title="Allow location during visits" variant="outline" onPress={() => void ensureBackgroundLocation()} />
            </View>
          </View>
        ) : null}

        <Section title="Today's visits">
          {view.todayVisits.length === 0 ? (
            <Empty icon="calendar" title="No visits today" hint="Accepted visits due today appear here." />
          ) : (
            view.todayVisits.map((visit) => <VisitRow key={visit.id} visit={visit} onOpen={() => openVisit(visit.id)} />)
          )}
        </Section>

        {view.upcomingVisits.length > 0 ? (
          <Section title="Upcoming visits">
            {view.upcomingVisits.map((visit) => (
              <VisitRow key={visit.id} visit={visit} onOpen={() => navigation.navigate("BookingDetails", { bookingId: visit.id })} />
            ))}
          </Section>
        ) : null}

        <Section title="New job requests">
          {view.offers.length === 0 ? (
            <Empty
              icon="inbox"
              title="No open requests"
              hint={view.approved ? "New requests appear here when patients near you book." : "Requests start once your profile is approved."}
            />
          ) : (
            view.offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                busy={busyId === offer.id}
                onView={() => navigation.navigate("BookingDetails", { bookingId: offer.id, offer })}
                onAccept={() => accept(offer.id)}
                onDecline={() => confirmDecline(offer.id)}
              />
            ))
          )}
        </Section>

        {view.canAuthorCarePlans ? (
          <Section title="Care plans">
            <TouchableOpacity
              testID="home-care-plans"
              accessibilityRole="button"
              onPress={() => navigation.navigate("CarePlans")}
              style={{ backgroundColor: theme.colors.white, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Feather name="clipboard" size={24} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="body" weight="bold">
                  Care plans
                </Text>
                <Text variant="small" color={theme.colors.textLight}>
                  Create and review plans for your clients.
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={theme.colors.textLight} />
            </TouchableOpacity>
          </Section>
        ) : null}

        <Section title="Wallet">
          <TouchableOpacity
            testID="home-wallet"
            accessibilityRole="button"
            accessibilityLabel="Wallet, open"
            onPress={() => navigation.navigate("Wallet")}
            style={{ backgroundColor: theme.colors.white, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="small" color={theme.colors.textLight}>
                Balance
              </Text>
              <Text variant="h2" weight="bold" color={theme.colors.primary} testID="wallet-balance">
                {view.walletBalance}
              </Text>
              {pending ? (
                <Text variant="small" color={theme.colors.textLight} testID="wallet-pending">
                  {pending.amount} pending
                </Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={20} color={theme.colors.textLight} />
          </TouchableOpacity>
        </Section>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primary }}>
      <Header
        name={me.data?.full_name}
        onAvatar={() => navigation.navigate("Profile")}
        onBell={() => navigation.navigate("Notifications")}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={home.isRefetching} onRefresh={() => void home.refetch()} />}
      >
        {body()}
      </ScrollView>
    </View>
  );
};

export default Home;
