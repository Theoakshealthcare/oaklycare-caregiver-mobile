import { View, Pressable } from "react-native";
import { theme } from "../constants/theme";
import Text from "../components/ui/text";
import { globalStyles } from "../constants/styles";
import Home from "../screens/home/Home";
import { useEffect, useState } from "react";
import type { StackScreenProps } from "@react-navigation/stack";
import type { ScreenParamLists } from "./Navigations";
import Booking from "../screens/booking/Booking";
import PagerView, { type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import Image from "../components/ui/image";
import ScreenSize from "../hooks/screen-size";
import Animated from "react-native-reanimated";
import useTextAnimation from "../hooks/use-text-animation";
import Vitals from "../screens/vitals/Vitals";

const BottomNavigation = ({ route }: Partial<StackScreenProps<ScreenParamLists, "BottomNavigation">>) => {
  const [tab, setTab] = useState(0);
  const [key, setKey] = useState(0);

  // Each tab carries its own page, so a tab can never be drawn without one.
  const tabs = [
    {
      id: "home",
      icon: require("@/assets/images/tabs/home.png"),
      icon_active: require("@/assets/images/tabs/home-active.png"),
      label: "Home",
      page: <Home />,
    },
    {
      id: "booking",
      icon: require("@/assets/images/tabs/booking.png"),
      icon_active: require("@/assets/images/tabs/booking-active.png"),
      label: "Booking",
      page: <Booking />,
    },
    {
      id: "vitals",
      icon: require("@/assets/images/tabs/vital.png"),
      icon_active: require("@/assets/images/tabs/vital-active.png"),
      label: "Vitals",
      // Fetches only while its tab is showing (the pager keeps every page mounted).
      page: <Vitals active={tab === 2} />,
    },
  ];

  const { width, height } = ScreenSize();
  const { textStyle } = useTextAnimation();

  // Arriving with a requested tab (e.g. "Back to home" after a visit) jumps to it.
  const requested = route?.params?.tab;
  const requestedAt = route?.params?.at;
  useEffect(() => {
    if (!requested) return;
    const index = tabs.findIndex((t) => t.id === requested);
    if (index >= 0) {
      setTab(index);
      setKey((prevKey) => prevKey + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, requestedAt]);

  const handleTab = (index: number) => {
    setTab(index);
    setKey((prevKey) => prevKey + 1);
  };

  const handlePageSelected = (event: PagerViewOnPageSelectedEvent) => {
    const newPage = event.nativeEvent.position;
    setTab(newPage);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <PagerView
        key={key}
        style={{ flex: 1 }}
        initialPage={tab}
        // useNext={false}
        onPageSelected={handlePageSelected}
        scrollEnabled={false}
      >
        {tabs.map((item) => (
          <View key={item.id} style={{ flex: 1, paddingBottom: height * 0.1 }}>
            {item.page}
          </View>
        ))}
      </PagerView>

      <View style={globalStyles.tabCon}>
        {tabs.map((item, index) => (
          <Pressable key={item.id} onPress={() => handleTab(index)}
            style={[
              globalStyles.row,
              {
                height: width * 0.1,
                width: width * 0.1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 50,
              },
              tab === index && globalStyles.activeIconContainer,
            ]}
          >
            <Animated.View style={[textStyle]}>
              <Image
                source={tab === index ? item.icon_active : item.icon}
                style={{ height: width * 0.05, width: width * 0.05 }}
              />
            </Animated.View>
            {tab === index && (
              <Text variant="small" color={theme.colors.white}>
                {item.label}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
};

export default BottomNavigation;
