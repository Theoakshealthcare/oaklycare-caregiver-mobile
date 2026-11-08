import type React from "react";
import { Text as RNText } from "react-native";

import { theme } from "@/src/constants/theme";
import { PRIVACY_URL, TERMS_URL } from "@/src/config/links";

const PAGES = {
  terms: { title: "Terms of Service", url: TERMS_URL },
  privacy: { title: "Privacy Policy", url: PRIVACY_URL },
} as const;

/**
 * "Terms of Service" / "Privacy Policy" inside a sentence: an underlined link. `onOpen` is the screen's `usePageOpener().open`.
 * It is a nested `Text` with its own `onPress`, so a tap on it is not also a tap on the checkbox row around it. The words are
 * the children, so a consent line is never reworded here.
 */
const LegalLink: React.FC<{ page: keyof typeof PAGES; onOpen: (title: string, url: string) => void; children: React.ReactNode }> = ({
  page,
  onOpen,
  children,
}) => (
  <RNText
    accessibilityRole="link"
    onPress={() => onOpen(PAGES[page].title, PAGES[page].url)}
    style={{ color: theme.colors.primary, textDecorationLine: "underline" }}
  >
    {children}
  </RNText>
);

export default LegalLink;
