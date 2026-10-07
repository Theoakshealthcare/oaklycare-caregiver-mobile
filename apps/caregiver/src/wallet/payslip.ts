import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { walletService } from "@/src/services/wallet.service";

/**
 * Downloads the month's payslip (GET /caregiver/wallet/payslip, CSV), saves it in the app cache and
 * opens the native share sheet on it so the caregiver can save or send it.
 */
export async function sharePayslip(month: string): Promise<void> {
  const csv = await walletService.getPayslipCsv(month);
  const file = new File(Paths.cache, `payslip_${month}.csv`);
  file.create({ overwrite: true });
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle: `Payslip ${month}`,
  });
}
