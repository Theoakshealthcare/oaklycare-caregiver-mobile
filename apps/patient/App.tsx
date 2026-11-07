import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";

import MainApp from "./MainApp";
import { queryClient } from "./src/api/queryClient";
import { ThemeProvider } from "./src/constants/ThemeContext";

const App = () => {
  const [fontsLoaded, fontError] = useFonts({
    "gt-black": require("./assets/fonts/gt-walsheim-pro/GTWalsheimPro-Black.ttf"),
    "gt-bold": require("./assets/fonts/gt-walsheim-pro/GTWalsheimPro-Bold.ttf"),
    "gt-medium": require("./assets/fonts/gt-walsheim-pro/GTWalsheimPro-Medium.ttf"),
    "gt-regular": require("./assets/fonts/gt-walsheim-pro/GTWalsheimPro-Regular.ttf"),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NavigationContainer>
            <MainApp />
          </NavigationContainer>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
};

export default App;
