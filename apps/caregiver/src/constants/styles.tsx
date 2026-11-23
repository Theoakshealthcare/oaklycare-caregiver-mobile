import { StyleSheet } from "react-native";
import { screenSize, theme } from "./theme";

/** Side margin of the onboarding forms (Figma: 20 pt from the screen edge to the fields). */
export const FORM_PADDING = { paddingHorizontal: 20 };

export const globalStyles = StyleSheet.create({
  safearea: { flex: 1, backgroundColor: theme.colors.primary },

  container: {
    // height: "100%",
    width: "100%",
    padding: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    paddingBottom: screenSize.height * 0.06,
    backgroundColor: theme.colors.white,
    flex: 1
  },

  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },

  column: { flexDirection: "column", gap: theme.spacing.md },

  box: { padding: theme.spacing.md, borderRadius: 10 },

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
