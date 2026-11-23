import type React from "react";
import { Text as RNText } from "react-native";

import { theme } from "@/src/constants/theme";
import { COOKIES_URL, PRIVACY_URL, TERMS_URL } from "@/src/config/links";

const PAGES = {
  terms: { title: "Terms of Service", url: TERMS_URL },
  privacy: { title: "Privacy Policy", url: PRIVACY_URL },
  cookies: { title: "Cookies Policy", url: COOKIES_URL },
} as const;

/**
 * "Terms of Service" / "Privacy Policy" / "Cookies Policy" inside a sentence: an underlined link. `onOpen` is the screen's `usePageOpener().open`.
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
    // The font is set explicitly: without it the last link of a line rendered bold and larger than the other two.
    style={{ color: theme.colors.primary, textDecorationLine: "underline", fontFamily: theme.fonts.regular, fontWeight: "normal" }}
  >
    {children}
  </RNText>
);

export default LegalLink;
