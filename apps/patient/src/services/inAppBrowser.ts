import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

/**
 * Opens a web page in the in-app browser (the same one the payment page uses), so the person stays in the app and a Done
 * button brings them back. Only if the browser cannot be opened at all does the page go to the phone's own browser instead.
 */
export async function openPage(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url, { dismissButtonStyle: "close" });
  } catch {
    await Linking.openURL(url);
  }
}
