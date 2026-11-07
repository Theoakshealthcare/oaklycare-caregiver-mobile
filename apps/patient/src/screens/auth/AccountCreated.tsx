import type React from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import Icon from "@/src/components/ui/icon";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useNav } from "@/src/navigation/Navigations";

/** Shown once the email is verified. The account is not signed in yet, so the next step is Login. */
const AccountCreated: React.FC = () => {
  const navigation = useNav();
  return (
    <View style={styles.container}>
      <Icon name="checkmark" size={40} color={theme.colors.white} circleColor={theme.colors.success} />
      <Text variant="h2" weight="bold" center>
        Congratulations!
      </Text>
      <Text color={theme.colors.textLight} center>
        Your email is verified and your account is ready. Log in to start booking care.
      </Text>
      <Button
        title="Log in to continue"
        onPress={() => navigation.reset({ index: 0, routes: [{ name: "Login" }] })}
        style={styles.button}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  button: { alignSelf: "stretch", marginTop: theme.spacing.md },
});

export default AccountCreated;
