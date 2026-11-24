import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { session } from "./src/auth";
import { useOnboarding } from "./src/auth/onboarding";
import { useScreenChrome } from "./src/components/StatusBar/screenChrome";
import { ToastHost } from "./src/components/ui/toast";
import { theme } from "./src/constants/theme";
import StackNavigator from "./src/navigation/StackNavigator";

const MainApp = () => {
  const bottomInset = useSafeAreaInsets().bottom;
  const bottomBand = useScreenChrome((s) => s.bottom);
  const topBand = useScreenChrome((s) => s.top);
  const dim = useScreenChrome((s) => s.dim);
  const topInset = useSafeAreaInsets().top;

  // Restore the stored session and the "intro seen" flag once on launch; the navigator shows the splash until they are known.
  useEffect(() => {
    void session.restore();
    void useOnboarding.getState().restore();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: topBand ?? theme.colors.white }}>
        {/* White clock and icons over the teal band of the Bookings header. */}
        <StatusBar style={topBand === theme.colors.primary ? "light" : "dark"} />
        <StackNavigator />
        <ToastHost />
      </SafeAreaView>
      {/* The strip under the home indicator: white, or the colour a screen asked for (the welcome slides' panel). */}
      <View style={{ height: bottomInset, backgroundColor: bottomBand ?? theme.colors.white }} />
      {/* A transparent modal route dims the page, but not these two strips: dim them the same way. */}
      {dim ? (
        <>
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: topInset, backgroundColor: dim }} />
          <View pointerEvents="none" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: bottomInset, backgroundColor: dim }} />
        </>
      ) : null}
    </View>
  );
};

export default MainApp;
