import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { Linking, Platform } from "react-native";

import { useSession } from "@/src/auth";
import { parsePaymentReturn } from "@/src/domain/paymentReturn";
import type { NavigationProp } from "@/src/navigation/Navigations";

import { usePaymentLinks } from "./paymentLinks";
import { usePaymentReturn } from "./paymentReturn";

/** The link that launched a cold start is read once per app run: remounting the signed-in stack must not replay it. */
let initialUrlHandled = false;

/** Test hook: forget that the launch link was handled. */
export function resetInitialUrlForTests() {
  initialUrlHandled = false;
}

/**
 * Mounted once while a patient is signed in (next to `usePushEffects`). The payment return page ends on a "Return to the app" link
 * (`oaklypatient://payment-complete`): opening it closes the in-app browser (iOS keeps it on top of the app otherwise), lands on
 * that booking's payment result screen and has it ask the backend whether the payment went through.
 *
 * Which booking: the one named in the link, else the one whose result screen is already open, else the booking whose checkout
 * link this phone made last and has not seen paid. With none of those it opens the bookings list, where the status is read fresh.
 *
 * Closing the browser by hand still works as before (the result screen checks when the browser closes or the app comes back).
 */
export function usePaymentDeepLink(): void {
  const signedIn = useSession((s) => s.status === "signedIn");
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    if (!signedIn) return undefined;

    const open = (url: string | null) => {
      const link = parsePaymentReturn(url);
      if (!link) return;
      if (Platform.OS === "ios") void Promise.resolve(WebBrowser.dismissBrowser()).catch(() => undefined);

      const state = navigation.getState();
      const top = state?.routes[state.index];
      const onResult = top?.name === "PaymentResult" ? (top.params as { bookingId?: string } | undefined)?.bookingId : undefined;
      const linkIds = Object.keys(usePaymentLinks.getState().urls);
      const bookingId = link.bookingId ?? onResult ?? linkIds.at(-1) ?? null;

      if (!bookingId) {
        navigation.navigate("Tabs", { tab: "bookings", at: Date.now() });
        return;
      }
      usePaymentReturn.getState().signal(bookingId);
      if (!(top?.name === "PaymentResult" && onResult === bookingId)) navigation.navigate("PaymentResult", { bookingId });
    };

    const subscription = Linking.addEventListener("url", ({ url }) => open(url));
    if (!initialUrlHandled) {
      initialUrlHandled = true;
      void Promise.resolve(Linking.getInitialURL())
        .then(open)
        .catch(() => undefined);
    }
    // (the jest mock of Linking returns nothing)
    return () => subscription?.remove();
  }, [signedIn, navigation]);
}
