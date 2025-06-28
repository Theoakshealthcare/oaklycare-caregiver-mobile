import React from "react";
import MainApp from "./MainApp";
import { useFonts } from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { ThemeProvider } from "./src/constants/ThemeContext";


const App = () => {
  const [fontsLoaded, fontError] = useFonts({
    "gt-black": require("./assets/fonts/gt-walsheim-pro/GTWalsheimPro-Black.ttf"),
    "gt-bold": require("./assets/fonts/gt-walsheim-pro/GTWalsheimPro-Bold.ttf"),
    "gt-medium": require("./assets/fonts/gt-walsheim-pro/GTWalsheimPro-Medium.ttf"),
    "gt-regular": require("./assets/fonts/gt-walsheim-pro/GTWalsheimPro-Regular.ttf"),
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        <MainApp />
      </NavigationContainer>
    </ThemeProvider>
  );
};

export default App;
