import React, { useEffect } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import { theme } from "@/src/constants/theme";

import Text from "./text";

/**
 * The green confirmation toast from the Figma auth screens ("Login Successful", "Email Address Verified",
 * "Password has been Reset Successfully", "Payment Details has been updated").
 *
 * One host (`<ToastHost />`, mounted once above the navigator) draws whatever the last `showToast()` asked for, so a toast
 * survives the screen change that usually follows it (login swaps the whole stack). A newer toast replaces the one on
 * screen; each lasts `TOAST_MS`.
 */
export const TOAST_MS = 3000;

interface ToastState {
  /** Changes on every call, so showing the same words twice restarts the timer. */
  id: number;
  message: string | null;
}

const store = createStore<ToastState>(() => ({ id: 0, message: null }));

export function showToast(message: string): void {
  store.setState((s) => ({ id: s.id + 1, message }));
}

export function hideToast(): void {
  store.setState({ message: null });
}

export const ToastHost: React.FC = () => {
  const { id, message } = useStore(store);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(hideToast, TOAST_MS);
    return () => clearTimeout(timer);
  }, [id, message, opacity]);

  if (!message) return null;

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View
        testID="toast"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { opacity }]}
      >
        <MaterialCommunityIcons name="checkbox-multiple-marked-outline" size={22} color={theme.colors.white} />
        <Text variant="body" color={theme.colors.white} style={styles.text}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    // Figma: just below the top of the Back row, over the screen title (the layer sits under the status bar already).
    top: 30,
    left: theme.spacing.md,
    right: theme.spacing.md,
    alignItems: "center",
    zIndex: 100,
    elevation: 100,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md - 4,
    backgroundColor: theme.colors.toast,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm + 4,
    paddingHorizontal: theme.spacing.lg,
    // Figma: the pill is wider than its words (about 62% of the screen for "Login Successful").
    minWidth: "62%",
    justifyContent: "center",
    maxWidth: "100%",
  },
  text: { flexShrink: 1 },
});
