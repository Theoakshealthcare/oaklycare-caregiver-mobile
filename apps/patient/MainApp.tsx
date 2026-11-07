import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { session } from "./src/auth";
import { theme } from "./src/constants/theme";
import StackNavigator from "./src/navigation/StackNavigator";

const MainApp = () => {
  // Restore the stored session once on launch; the navigator shows the splash until it is known.
  useEffect(() => {
    void session.restore();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <StatusBar style="dark" />
      <StackNavigator />
    </SafeAreaView>
  );
};

export default MainApp;
