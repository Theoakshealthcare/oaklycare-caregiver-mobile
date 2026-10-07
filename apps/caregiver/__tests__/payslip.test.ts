import { ApiError } from "../src/api/errors";
import { walletService } from "../src/services/wallet.service";
import { sharePayslip } from "../src/wallet/payslip";

const mockCreate = jest.fn();
const mockWrite = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache/" },
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({
    uri: `file:///cache/${name}`,
    create: (...args: unknown[]) => mockCreate(...args),
    write: (...args: unknown[]) => mockWrite(...args),
  })),
}));
const mockIsAvailable = jest.fn();
const mockShare = jest.fn();
jest.mock("expo-sharing", () => ({
  isAvailableAsync: () => mockIsAvailable(),
  shareAsync: (...args: unknown[]) => mockShare(...args),
}));

const CSV = "Date,Amount (NGN),Reference,Narration\n2026-10-05,\"55,000.00\",REF1,Visit\n";

describe("sharePayslip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailable.mockResolvedValue(true);
    mockShare.mockResolvedValue(undefined);
  });

  it("saves the CSV to the cache and opens the share sheet on it", async () => {
    const get = jest.spyOn(walletService, "getPayslipCsv").mockResolvedValue(CSV);
    await sharePayslip("2026-10");
    expect(get).toHaveBeenCalledWith("2026-10");
    expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
    expect(mockWrite).toHaveBeenCalledWith(CSV);
    expect(mockShare).toHaveBeenCalledWith("file:///cache/payslip_2026-10.csv", {
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
      dialogTitle: "Payslip 2026-10",
    });
  });

  it("does not touch the file system when the download fails", async () => {
    jest.spyOn(walletService, "getPayslipCsv").mockRejectedValue(new ApiError(0, null, "offline"));
    await expect(sharePayslip("2026-10")).rejects.toThrow("offline");
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockShare).not.toHaveBeenCalled();
  });

  it("explains when this device cannot share files", async () => {
    jest.spyOn(walletService, "getPayslipCsv").mockResolvedValue(CSV);
    mockIsAvailable.mockResolvedValue(false);
    await expect(sharePayslip("2026-10")).rejects.toThrow("Sharing isn't available on this device.");
    expect(mockShare).not.toHaveBeenCalled();
  });
});
