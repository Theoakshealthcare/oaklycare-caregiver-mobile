import type React from "react";
import { Image, StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useNav } from "@/src/navigation/Navigations";

const WHY_IT_MATTERS = [
  "Falls are the second leading cause of unintentional injury deaths worldwide.",
  "Each year an estimated 684,000 individuals die from falls globally.",
  "Adults older than 60 years of age suffer the greatest number of fatal falls.",
];

const ASSESSED = [
  "Your overall health and any medical conditions",
  "Your daily activities and how you move around",
  "Your strength, stability, and fall history",
  "Potential hazards in your home or living space",
];

/** FallGuard intro (Figma "Oakly Fallguard Assessment"): what it is, why it matters, what is assessed, how long it takes. */
const Fall: React.FC = () => {
  const navigation = useNav();
  return (
    <KeyboardScrollView contentContainerStyle={styles.content}>
      <Text variant="h2" weight="bold">
        Oakly FallGuard™
      </Text>
      <Text variant="small" color={theme.colors.textLight}>
        Falls are the second leading cause of unintentional injury deaths worldwide. This evidence-based assessment will help us understand your fall risk so we can offer tailored advice.
      </Text>
      <Image source={require("../../../assets/images/pngs/fallguard.png")} style={styles.image} resizeMode="contain" />
      <Text weight="bold">Why This Matters</Text>
      <View style={styles.list}>
        {WHY_IT_MATTERS.map((fact, i) => (
          <View key={fact} style={styles.fact}>
            <View style={styles.number}>
              <Text variant="small" weight="bold" color={theme.colors.white}>
                {String(i + 1)}
              </Text>
            </View>
            <Text variant="small" color={theme.colors.textLight} style={styles.factText}>
              {fact}
            </Text>
          </View>
        ))}
      </View>
      <Text weight="bold">What Will Be Assessed ?</Text>
      <View style={styles.list}>
        {ASSESSED.map((item) => (
          <View key={item} style={styles.fact}>
            <View style={styles.bullet} />
            <Text variant="small" color={theme.colors.textLight} style={styles.factText}>
              {item}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.time}>
        <Text variant="h3" weight="bold" color={theme.colors.primary}>
          How Long Will It Take?
        </Text>
        <Text variant="small" color={theme.colors.textLight}>
          The assessment takes approximately 5-7 minutes to complete. Your results will be available immediately after completion.
        </Text>
      </View>
      <Button title="Start Assessment" onPress={() => navigation.navigate("FallAssessment")} />
    </KeyboardScrollView>
  );
};

const styles = StyleSheet.create({
  // Extra bottom room: the last row must clear the floating tab bar without scrolling past it.
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.xxl * 2, gap: theme.spacing.md },
  image: { width: "100%", height: 170 },
  list: { gap: theme.spacing.md },
  fact: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  factText: { flex: 1 },
  number: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.secondary, marginHorizontal: 10 },
  time: { backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.xs },
});

export default Fall;
