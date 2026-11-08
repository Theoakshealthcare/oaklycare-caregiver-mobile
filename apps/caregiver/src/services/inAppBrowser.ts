import * as WebBrowser from "expo-web-browser";

/**
 * Opens a public web page (FAQs, About us, Terms, Privacy) in the in-app browser, so the caregiver stays in the app
 * instead of being sent to Safari. Rejects when the browser cannot open; the caller says so (`openPageOrAlert`).
 * tel:, mailto:, WhatsApp and Maps links are not pages and stay on `Linking`.
 */
export function openPage(url: string): Promise<unknown> {
  return WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "close" });
}
