import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Opens the native share sheet on the vitals report. The CSV was downloaded into memory; it is
 * written to a temporary file only because the share sheet needs one, and deleted as soon as the
 * sheet closes, so no vitals stay on the device.
 */
export async function shareVitalsReport(csv: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  const file = new File(Paths.cache, `vitals-report-${Date.now()}.csv`);
  try {
    file.create({ overwrite: true });
    file.write(csv);
    await Sharing.shareAsync(file.uri, {
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
      dialogTitle: "Vitals report",
    });
  } finally {
    try {
      file.delete();
    } catch {
      // Nothing left to clean up if the file was never created.
    }
  }
}
