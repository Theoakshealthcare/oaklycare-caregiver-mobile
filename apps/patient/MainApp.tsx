import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { session } from "./src/auth";
import { useOnboarding } from "./src/auth/onboarding";
import { theme } from "./src/constants/theme";
import StackNavigator from "./src/navigation/StackNavigator";

const MainApp = () => {
  // Restore the stored session and the "intro seen" flag once on launch; the navigator shows the splash until they are known.
  useEffect(() => {
    void session.restore();
    void useOnboarding.getState().restore();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <StatusBar style="dark" />
      <StackNavigator />
    </SafeAreaView>
  );
};

export default MainApp;
