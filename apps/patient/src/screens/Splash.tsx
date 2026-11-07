import type React from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

const Splash: React.FC = () => (
  <View style={styles.container} accessibilityLabel="Loading">
    <Image source={require("../../assets/images/logo.png")} style={styles.logo} resizeMode="contain" />
    <ActivityIndicator color={theme.colors.primary} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white, alignItems: "center", justifyContent: "center", gap: theme.spacing.lg },
  logo: { width: 160, height: 80 },
});

export default Splash;
