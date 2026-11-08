import type React from "react";
import { useCallback, useState } from "react";

import ErrorDialog from "@/src/components/ui/ErrorDialog";
import { openPage } from "@/src/services/inAppBrowser";

/**
 * Opens a web page in the in-app browser and says so in the app's usual error dialog when it cannot (`openPage` has
 * already tried the phone's own browser by then). Render `dialog` once in the screen that uses `open`.
 */
export function usePageOpener(): { open: (title: string, url: string) => void; dialog: React.ReactElement } {
  const [failed, setFailed] = useState<string | null>(null);
  const open = useCallback((title: string, url: string) => {
    void openPage(url).catch(() => setFailed(title));
  }, []);
  const dialog = (
    <ErrorDialog
      visible={failed !== null}
      title={`Couldn't open ${failed ?? "the page"}`}
      message="Check your internet connection and try again."
      onClose={() => setFailed(null)}
    />
  );
  return { open, dialog };
}
