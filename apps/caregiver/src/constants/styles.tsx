import { StyleSheet } from "react-native";
import { screenSize, theme } from "./theme";

export const globalStyles = StyleSheet.create({
  safearea: { flex: 1, backgroundColor: theme.colors.primary },

  container: {
    // height: "100%",
    width: "100%",
    padding: theme.sizes.medium,
    paddingVertical: theme.sizes.extraLarge,
    paddingBottom: screenSize.height * 0.06,
    backgroundColor: theme.colors.white,
    flex: 1
  },

  row: { flexDirection: "row", alignItems: "center", gap: theme.sizes.base },

  column: { flexDirection: "column", gap: theme.sizes.large },

  box: { padding: theme.sizes.font, borderRadius: 10 },

  center: { justifyContent: "center", alignItems: "center" },

  tabCon: {
    flexDirection: "row",
    backgroundColor: "#1E1E1E",
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: "space-between",
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },

  activeIconContainer: {
    backgroundColor: theme.colors.primary,
    width:'auto',
    paddingHorizontal: 10
  }
});
