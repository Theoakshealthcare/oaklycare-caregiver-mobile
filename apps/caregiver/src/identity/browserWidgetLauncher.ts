/**
 * Opens the verification page the backend hosts (`widget_url` on the session response) in the system browser session
 * and reports how the person left it. The page loads the partner's widget; when it ends (success, close or error) it
 * sends the browser to `KYC_RETURN_URL`. That redirect says only "the page is done": it is a hint, the outcome is
 * learned by polling the server (backend guide section 4, rule 1).
 *
 * Camera: the capture runs inside the system browser session, which asks for camera access itself, so the app needs no
 * camera permission string for this flow (the existing `expo-camera` one is for document photos).
 */
import * as WebBrowser from "expo-web-browser";

import { KYC_RETURN_URL } from "./config";
import type { IdentityWidgetLaunch, IdentityWidgetLauncher, WidgetOutcome } from "./widget";

/** Only an absolute https URL is ever opened: the value comes from a response body, so it is checked, not trusted. */
export function isOpenableWidgetUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Maps how the auth session ended to an outcome. A redirect is "done"; leaving any other way is "dismissed". */
export function outcomeFromBrowserResult(result: WebBrowser.WebBrowserAuthSessionResult): WidgetOutcome {
  return result.type === "success" ? { kind: "completed" } : { kind: "dismissed" };
}

export function createBrowserWidgetLauncher(returnUrl: string = KYC_RETURN_URL): IdentityWidgetLauncher {
  return {
    async open({ widgetUrl }: IdentityWidgetLaunch): Promise<WidgetOutcome> {
      if (!isOpenableWidgetUrl(widgetUrl)) return { kind: "error" };
      try {
        return outcomeFromBrowserResult(await WebBrowser.openAuthSessionAsync(widgetUrl, returnUrl));
      } catch {
        return { kind: "error" };
      }
    },
  };
}
