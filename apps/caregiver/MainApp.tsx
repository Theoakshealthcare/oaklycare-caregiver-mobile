import React, { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { session } from "./src/auth";
import { installNotificationHandler, usePushRegistration } from "./src/push/native";
import FocusedStatusBar from "./src/components/StatusBar/FocusedStatusBar";
import { useChrome } from "./src/components/StatusBar/screenChrome";
import { ToastHost } from "./src/components/ui/toast";
import StackNavigator from "./src/navigation/StackNavigator";

installNotificationHandler();

const MainApp = () => {
  // Register the Expo push token after sign-in and whenever it changes (skips cleanly without an EAS project).
  usePushRegistration();

  // Restore the stored session once on launch; the navigator shows the splash until it is known.
  useEffect(() => {
    void session.restore();
  }, []);

  const chrome = useChrome();
  const bottomInset = useSafeAreaInsets().bottom;

  // The band under the status bar is the SafeAreaView's own background; the one under the home indicator is a spacer, so
  // a screen (the coral welcome slide) can colour it separately and its panel reaches the bottom edge.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: chrome.top }} edges={["top", "left", "right"]}>
      <FocusedStatusBar backgroundColor={chrome.top} barStyle={chrome.barStyle} />
      <View style={{ flex: 1 }}>
        <StackNavigator />
        <ToastHost />
      </View>
      <View testID="bottom-band" style={{ height: bottomInset, backgroundColor: chrome.bottom }} />
    </SafeAreaView>
  );
};

export default MainApp;
