import type React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import Icon from "@/src/components/ui/icon";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useUnreadCount } from "@/src/hooks/useNotifications";
import { useNav } from "@/src/navigation/Navigations";

/** The bell on Home, with the number of unread notices (9+ above nine; nothing at zero). */
const NotificationBell: React.FC = () => {
  const navigation = useNav();
  const unread = useUnreadCount();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      hitSlop={8}
      onPress={() => navigation.navigate("Notifications")}
    >
      <Icon name="notifications-outline" size={26} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text variant="small" weight="bold" color={theme.colors.white}>
            {unread > 9 ? "9+" : String(unread)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 4,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default NotificationBell;
