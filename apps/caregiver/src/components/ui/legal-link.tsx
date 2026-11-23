import type React from "react";
import { Text as RNText } from "react-native";

import { COOKIES_URL, PRIVACY_URL, TERMS_URL } from "@/src/config/contact";
import { theme } from "@/src/constants/theme";
import { openPageOrAlert } from "@/src/services/openPageOrAlert";

const PAGES = {
  terms: { title: "Terms of Service", url: TERMS_URL },
  privacy: { title: "Privacy Policy", url: PRIVACY_URL },
  cookies: { title: "Cookies Policy", url: COOKIES_URL },
} as const;

/**
 * "Terms of Service" / "Privacy Policy" / "Cookies Policy" inside a sentence: an underlined link that opens the page in the in-app browser.
 * It is a nested `Text` with its own `onPress`, so a tap on it is never also a tap on a checkbox or button around it, and
 * it takes the size and font of the sentence it is in. The words are the children, so a consent text is never reworded here.
 */
const LegalLink: React.FC<{ page: keyof typeof PAGES; children: React.ReactNode }> = ({ page, children }) => (
  <RNText
    accessibilityRole="link"
    onPress={() => openPageOrAlert(PAGES[page].title, PAGES[page].url)}
    style={{ color: theme.colors.primary, textDecorationLine: "underline" }}
  >
    {children}
  </RNText>
);

export default LegalLink;
