import React, { useEffect, useState } from "react";
import SplashScreen from "./src/screens/splash-screen";
import FocusedStatusBar from "./src/components/StatusBar/FocusedStatusBar";
import { theme } from "./src/constants/theme";
import { globalStyles } from "./src/constants/styles";
import StackNavigator from "./src/navigation/StackNavigator";
import { SafeAreaView } from "react-native-safe-area-context";

const MainApp = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={globalStyles.safearea}>
        <FocusedStatusBar />
        <SplashScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safearea}>
      <FocusedStatusBar
        backgroundColor={theme.colors.primary}
        barStyle="light-content"
      />
      {/* <AuthNavigator /> */}
      <StackNavigator />
    </SafeAreaView>
  );
};

export default MainApp;
