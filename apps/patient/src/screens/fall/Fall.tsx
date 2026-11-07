import type React from "react";
import { Image, StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useNav } from "@/src/navigation/Navigations";

/** FallGuard intro: what it is, how long it takes, and the way into the assessment. */
const Fall: React.FC = () => {
  const navigation = useNav();
  return (
    <KeyboardScrollView contentContainerStyle={styles.content}>
      <Image source={require("../../../assets/images/pngs/fallguard.png")} style={styles.image} resizeMode="contain" />
      <Text variant="h2" weight="bold" center>
        Oakly FallGuard™
      </Text>
      <Text color={theme.colors.textLight} center>
        Predict. Prevent. Protect.
      </Text>
      <Card tone="tint">
        <Text weight="bold">Why this matters</Text>
        <Text variant="small">
          Falls are a common cause of injury as we get older. A few simple questions help us understand the risk and what can help.
        </Text>
      </Card>
      <Card tone="tint">
        <Text weight="bold">How long will it take?</Text>
        <Text variant="small">About 5 to 7 minutes. You can answer for yourself or for a loved one.</Text>
      </Card>
      <View>
        <Button title="Start Assessment" onPress={() => navigation.navigate("FallAssessment")} />
      </View>
    </KeyboardScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  image: { width: "100%", height: 180 },
});

export default Fall;
