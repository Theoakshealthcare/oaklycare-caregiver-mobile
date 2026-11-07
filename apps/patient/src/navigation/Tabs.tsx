import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import Bookings from "@/src/screens/booking/Bookings";
import Fall from "@/src/screens/fall/Fall";
import Home from "@/src/screens/home/Home";
import Vitals from "@/src/screens/vitals/Vitals";

import type { ScreenParamLists, TabId } from "./Navigations";

/** The four tabs, in the designs' order. Each carries its own page, so a tab can never be drawn without one. */
const TABS: { id: TabId; label: string; icon: number; active: number; Page: React.FC }[] = [
  { id: "home", label: "Home", icon: require("../../assets/images/tabs/home.png"), active: require("../../assets/images/tabs/home-active.png"), Page: Home },
  { id: "bookings", label: "Booking", icon: require("../../assets/images/tabs/booking.png"), active: require("../../assets/images/tabs/booking-active.png"), Page: Bookings },
  { id: "vitals", label: "Vitals", icon: require("../../assets/images/tabs/vital.png"), active: require("../../assets/images/tabs/vital-active.png"), Page: Vitals },
  { id: "fall", label: "Fall", icon: require("../../assets/images/tabs/fall.png"), active: require("../../assets/images/tabs/fall-active.png"), Page: Fall },
];

type Props = StackScreenProps<ScreenParamLists, "Tabs">;

/** The signed-in home: the active tab's page and the floating dark bar (active tab = teal pill with its label). */
const Tabs: React.FC<Props> = ({ route }) => {
  const [tab, setTab] = useState<TabId>(route.params?.tab ?? "home");

  // Arriving with a requested tab (e.g. "Go to bookings" after paying) jumps to it, even when already on Tabs.
  const requested = route.params?.tab;
  const requestedAt = route.params?.at;
  const [handledAt, setHandledAt] = useState(requestedAt);
  if (requestedAt !== handledAt) {
    setHandledAt(requestedAt);
    if (requested) setTab(requested);
  }

  const Page = (TABS.find((t) => t.id === tab) ?? TABS[0]).Page;

  return (
    <View style={styles.screen}>
      <View style={styles.page}>
        <Page />
      </View>
      <View style={styles.bar} accessibilityRole="tablist">
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => setTab(item.id)}
              style={[styles.item, selected && styles.itemActive]}
            >
              <Image source={selected ? item.active : item.icon} style={styles.icon} resizeMode="contain" />
              {selected ? (
                <Text variant="small" weight="bold" color={theme.colors.white}>
                  {item.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  page: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: theme.colors.dark,
    borderRadius: theme.borderRadius.round,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
    borderRadius: theme.borderRadius.round,
  },
  itemActive: { backgroundColor: theme.colors.primary },
  icon: { width: 22, height: 22 },
});

export default Tabs;
