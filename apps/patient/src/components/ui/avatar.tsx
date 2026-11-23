import type React from "react";
import { Image, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Text from "./text";

interface AvatarProps {
  /** The photo, when the person has one. */
  uri?: string | null;
  /** Their name: the initials show when there is no photo. */
  name?: string;
  size?: number;
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** A round profile picture, or the person's initials on a teal-tinted disc. */
const Avatar: React.FC<AvatarProps> = ({ uri, name = "", size = 56 }) => {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) return <Image accessibilityLabel="Profile picture" source={{ uri }} style={[styles.image, box]} />;
  return (
    <View accessibilityLabel="Profile picture" style={[styles.fallback, box]}>
      <Text weight="bold" color={theme.colors.primary} style={{ fontSize: Math.round(size * 0.36) }}>
        {initials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: { backgroundColor: theme.colors.primaryLight, borderWidth: 2, borderColor: theme.colors.primary },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
});

export default Avatar;
