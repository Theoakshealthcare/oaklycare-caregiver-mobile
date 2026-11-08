import { Alert } from "react-native";

import { openPage } from "./inAppBrowser";

/**
 * `openPage`, and a page that cannot open says so in the app's usual alert (never an unhandled rejection). Its own file
 * so a test can replace `openPage` and still exercise this.
 */
export function openPageOrAlert(title: string, url: string): void {
  void openPage(url).catch(() => Alert.alert(`Couldn't open ${title}`, "Check your internet connection and try again."));
}
