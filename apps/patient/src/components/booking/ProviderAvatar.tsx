import type React from "react";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import Icon from "@/src/components/ui/icon";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

interface ProviderAvatarProps {
  /** The caregiver's profile photo, when they have one. */
  uri?: string | null;
  /** The first name, for the letter drawn when there is no photo (or it fails to load). Null: nobody is assigned yet. */
  name?: string | null;
  size?: number;
  /** The corner radius: the cards and the sheet use the design's rounded square, the chat a circle. */
  radius?: number;
}

/** The provider photo of the Figma cards: a rounded square photo, or a letter on a pale teal tile when the caregiver has none. */
const ProviderAvatar: React.FC<ProviderAvatarProps> = ({ uri, name, size = 76, radius = 18 }) => {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size, borderRadius: radius };
  if (uri && !failed) {
    return <Image testID="provider-photo" source={{ uri }} style={[styles.photo, box]} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View testID="provider-letter" style={[styles.tile, box]}>
      {name ? (
        <Text weight="bold" color={theme.colors.primary} style={{ fontSize: Math.round(size * 0.4), lineHeight: Math.round(size * 0.52) }}>
          {name.trim().charAt(0).toUpperCase()}
        </Text>
      ) : (
        <Icon name="person-outline" size={Math.round(size * 0.42)} color={theme.colors.primary} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  photo: { backgroundColor: theme.colors.primaryLight },
  tile: { backgroundColor: "#DDF3F3", alignItems: "center", justifyContent: "center" },
});

export default ProviderAvatar;
