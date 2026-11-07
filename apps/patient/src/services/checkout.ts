import * as WebBrowser from "expo-web-browser";

/**
 * Opens the Paystack checkout in the system browser (SFSafariViewController / Chrome Custom Tab). The result says only
 * whether the person is still in the browser: it is NEVER a payment result, because a closed or cancelled browser
 * proves nothing. Whether the booking is paid is decided by the backend (`usePaymentCheck`).
 *
 * `closed`: the browser was dismissed (iOS answers when it closes). `opened`: it is open and the answer comes later
 * (Android Custom Tabs report no close), so the caller checks when the app comes back to the foreground.
 */
export async function openCheckout(url: string): Promise<"closed" | "opened"> {
  if (!/^https?:\/\//i.test(url)) throw new Error("The payment link is not a web address.");
  const result = await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "close" });
  return result.type === "opened" ? "opened" : "closed";
}
