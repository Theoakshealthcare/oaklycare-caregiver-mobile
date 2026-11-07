import type React from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import { authService } from "@/src/services/auth.service";

/** Placeholder home: proves the session works end to end by showing the user from GET /auth/me. */
const Home: React.FC = () => {
  const me = useMe();
  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text variant="h2" weight="bold">
          {me.data ? `Welcome, ${me.data.full_name}` : "Welcome"}
        </Text>
        {me.data?.email ? <Text color={theme.colors.textLight}>{me.data.email}</Text> : null}
        <Text color={theme.colors.textLight}>Booking, vitals and FallGuard arrive in the next updates.</Text>
      </View>
      <Button title="Log out" variant="outline" onPress={() => void authService.logout()} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white, padding: theme.spacing.lg, justifyContent: "space-between" },
  body: { gap: theme.spacing.sm, marginTop: theme.spacing.xxl },
});

export default Home;
