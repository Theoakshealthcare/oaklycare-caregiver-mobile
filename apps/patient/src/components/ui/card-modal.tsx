import type React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { theme } from "@/src/constants/theme";

import Icon, { type IconName } from "./icon";
import Text from "./text";

interface CardModalProps {
  visible: boolean;
  onClose: () => void;
  /** The round icon that overlaps the top edge of the card. */
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  /** A confirmation card (Figma "Delete Account"): its title is one size smaller than the entry sheets' ("Heart Rate"). */
  compact?: boolean;
  children?: React.ReactNode;
}

/** The card itself, for a screen that is already a transparent modal route (the manual entry sheet). */
export const CardSheet: React.FC<Omit<CardModalProps, "visible">> = ({ onClose, icon, iconColor = theme.colors.primary, title, subtitle, compact, children }) => (
  <View style={styles.cardWrap}>
    {icon ? (
      <View style={styles.iconDisc}>
        <Icon name={icon} size={34} color={iconColor} />
      </View>
    ) : null}
    <View style={[styles.card, compact && styles.compactCard]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.close}>
        <Icon name="close-circle-outline" size={20} />
        <Text variant="small" weight="medium">
          Close
        </Text>
      </Pressable>
      <Text variant="h3" weight="bold" color={theme.colors.primary} center style={[icon ? styles.titleWithIcon : null, compact ? styles.compactTitle : null]}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="small" center>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  </View>
);

/**
 * The white card of the Figma vitals sheets ("Heart Rate", "Blood Glucose"...): a "Close" with its round x at the top left, a
 * big round icon sitting on the top edge, a teal title and a small grey line, over a dimmed page.
 */
const CardModal: React.FC<CardModalProps> = ({ visible, ...sheet }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={sheet.onClose}>
    <View style={styles.overlay}>
      <CardSheet {...sheet} />
    </View>
  </Modal>
);

const DISC = 80;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: "9.5%", paddingVertical: theme.spacing.lg },
  cardWrap: { alignItems: "center" },
  card: {
    alignSelf: "stretch",
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xxl + 8,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  compactCard: { padding: theme.spacing.md },
  close: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, alignSelf: "flex-start" },
  iconDisc: {
    position: "absolute",
    top: -DISC / 2,
    zIndex: 2,
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: theme.colors.white,
    borderWidth: 6,
    borderColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWithIcon: { marginTop: theme.spacing.sm },
  compactTitle: { fontSize: theme.sizes.subtitle - 1, lineHeight: Math.round((theme.sizes.subtitle - 1) * 1.35) },
});

export default CardModal;
