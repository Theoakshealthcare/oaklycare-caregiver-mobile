import * as Sharing from "expo-sharing";

import { shareVitalsReport } from "../src/vitals/report";

const mockFiles: { uri: string; created: boolean; written: string | null; deleted: boolean }[] = [];
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  File: class {
    uri: string;
    state = { uri: "", created: false, written: null as string | null, deleted: false };
    constructor(dir: string, name: string) {
      this.uri = `${dir}/${name}`;
      this.state.uri = this.uri;
      mockFiles.push(this.state);
    }
    create() {
      this.state.created = true;
    }
    write(text: string) {
      this.state.written = text;
    }
    delete() {
      this.state.deleted = true;
    }
  },
}));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const available = Sharing.isAvailableAsync as jest.Mock;
const share = Sharing.shareAsync as jest.Mock;

beforeEach(() => {
  mockFiles.length = 0;
  available.mockReset();
  share.mockReset();
  available.mockResolvedValue(true);
  share.mockResolvedValue(undefined);
});

describe("shareVitalsReport", () => {
  it("writes the report to a temporary file, shares it as CSV, then deletes it", async () => {
    await shareVitalsReport("id,vital_type\n1,heart_rate\n");
    expect(mockFiles).toHaveLength(1);
    expect(mockFiles[0].written).toBe("id,vital_type\n1,heart_rate\n");
    expect(share).toHaveBeenCalledWith(mockFiles[0].uri, expect.objectContaining({ mimeType: "text/csv" }));
    expect(mockFiles[0].deleted).toBe(true);
  });

  it("names the file without the patient's name or id", async () => {
    await shareVitalsReport("x");
    expect(mockFiles[0].uri).toMatch(/^file:\/\/\/cache\/vitals-report-\d+\.csv$/);
  });

  it("still deletes the file when the share sheet fails", async () => {
    share.mockRejectedValue(new Error("cancelled"));
    await expect(shareVitalsReport("x")).rejects.toThrow("cancelled");
    expect(mockFiles[0].deleted).toBe(true);
  });

  it("writes nothing when sharing is unavailable", async () => {
    available.mockResolvedValue(false);
    await expect(shareVitalsReport("x")).rejects.toThrow("Sharing isn't available on this device.");
    expect(mockFiles).toHaveLength(0);
    expect(share).not.toHaveBeenCalled();
  });
});
