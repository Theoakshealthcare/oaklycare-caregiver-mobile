import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/src/components/ui/button";
import Icon from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { riskBandFor } from "@/src/domain/fallguard";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "FallResult">;

/**
 * "Assessment Results" (Figma): the score badge, what the server's AI says it means, the recommendations as cards with a check, and
 * "Book a Home Visit". Everything shown is what the server returned. Left out, on purpose: the risk-band label and its "What does
 * this mean?" sentence (no signed bands, see `RISK_BANDS`), recommendation TITLES and the "Next Assessment Due" card (the server
 * sends sentences only, and a reassessment interval has not been signed by a clinician), and the download button (no report to
 * download). Share sends the score as a text message.
 */
const FallResult: React.FC<Props> = ({ navigation, route }) => {
  const { result } = route.params;
  const top = useSafeAreaInsets().top;
  const band = riskBandFor(result.totalScore);
  const share = () => void Share.share({ message: `My Oakly FallGuard fall-risk score is ${result.totalScore} out of ${result.maxScore}.` });
  return (
    <View style={[styles.screen, { paddingTop: top + theme.spacing.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        onPress={() => navigation.navigate("Tabs", { tab: "fall", at: Date.now() })}
        style={styles.link}
      >
        <Icon name="chevron-back" size={16} />
        <Text variant="small">Back</Text>
      </Pressable>
      <KeyboardScrollView contentContainerStyle={styles.content}>
        <View style={styles.scoreCard}>
          <View style={styles.titleRow}>
            <Text variant="h3" weight="bold">
              Assessment Results
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Share" hitSlop={8} onPress={share} style={styles.round}>
              <Icon name="share-social-outline" size={18} color={theme.colors.white} />
            </Pressable>
          </View>
          <View style={styles.scoreRow}>
            <View style={[styles.badge, { backgroundColor: band?.color ?? theme.colors.primary }]}>
              <Text variant="h3" weight="bold" color={theme.colors.white}>
                {String(result.totalScore)}
              </Text>
            </View>
            <View>
              <Text weight="bold">{band ? band.label : "Total Risk Score"}</Text>
              <Text variant="small" color={theme.colors.textLight}>
                {band ? "Total Risk Score" : `out of ${result.maxScore}`}
              </Text>
            </View>
          </View>
        </View>

        {band || result.summary ? (
          <View style={styles.mean}>
            <Text variant="h3" weight="bold" color={theme.colors.primary}>
              What does this mean?
            </Text>
            <Text variant="small" color={theme.colors.textLight}>
              {band ? band.meaning : result.summary}
            </Text>
          </View>
        ) : null}

        <View style={styles.recsHead}>
          <Text weight="bold">Recommendations</Text>
          <Text variant="small" color={theme.colors.textLight}>
            Based on your assessment
          </Text>
        </View>
        {result.recommendations.length > 0 ? (
          result.recommendations.map((r) => (
            <View key={r} style={styles.rec}>
              <Icon name="checkmark" size={18} color={theme.colors.primary} />
              <Text variant="small" color={theme.colors.textLight} style={styles.recText}>
                {r}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.rec}>
            <Text variant="small" color={theme.colors.textLight}>
              Your score is saved to your account. Personal tips are not available right now. If you are worried about falls, please speak to your doctor or nurse.
            </Text>
          </View>
        )}
        <Button title="Book a Home Visit" onPress={() => navigation.navigate("BookingStep1")} />
      </KeyboardScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  link: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, alignSelf: "flex-start" },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },
  scoreCard: { backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  mean: { backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, gap: theme.spacing.xs },
  recsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rec: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  recText: { flex: 1 },
});

export default FallResult;
