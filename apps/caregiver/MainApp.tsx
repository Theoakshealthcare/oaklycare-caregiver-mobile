import React, { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { session } from "./src/auth";
import FocusedStatusBar from "./src/components/StatusBar/FocusedStatusBar";
import { globalStyles } from "./src/constants/styles";
import { theme } from "./src/constants/theme";
import StackNavigator from "./src/navigation/StackNavigator";

const MainApp = () => {
  // Restore the stored session once on launch; the navigator shows the splash until it is known.
  useEffect(() => {
    void session.restore();
  }, []);

  return (
    <SafeAreaView style={globalStyles.safearea}>
      <FocusedStatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />
      <StackNavigator />
    </SafeAreaView>
  );
};

export default MainApp;
