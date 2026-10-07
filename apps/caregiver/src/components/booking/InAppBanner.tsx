import React, { useEffect } from "react";
import { Pressable, View } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBanner } from "@/src/push/banner";

const VISIBLE_MS = 8_000;

/** Slides over the top of the app when a job offer push arrives in the foreground. */
const InAppBanner: React.FC<{ onOpen: (bookingId: string) => void }> = ({ onOpen }) => {
  const { banner, hide } = useBanner();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [banner, hide]);

  if (!banner) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top, left: 0, right: 0, padding: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${banner.title}. ${banner.body}. Tap to view.`}
        onPress={() => {
          hide();
          onOpen(banner.bookingId);
        }}
        style={{
          backgroundColor: theme.colors.primary,
          borderRadius: 12,
          padding: 14,
          elevation: 6,
        }}
      >
        <Text variant="body" weight="bold" color={theme.colors.white}>
          {banner.title}
        </Text>
        <Text variant="small" color={theme.colors.white}>
          {banner.body}
        </Text>
      </Pressable>
    </View>
  );
};

export default InAppBanner;
