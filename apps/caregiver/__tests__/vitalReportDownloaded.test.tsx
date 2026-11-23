import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import VitalReportDownloaded, { REPORT_DOWNLOADED_TITLE } from "../src/screens/vitals/VitalReportDownloaded";
import { dropReport, heldReport, holdReport } from "../src/vitals/reportStore";

const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { goBack: mockGoBack, navigate: jest.fn() } }),
}));
const mockShare = jest.fn();
jest.mock("../src/vitals/report", () => ({ shareVitalsReport: (...args: unknown[]) => mockShare(...args) }));

const PATIENT = "11111111-1111-4111-8111-111111111111";
const props = () => ({ route: { params: { patientId: PATIENT } }, navigation: {} }) as unknown as React.ComponentProps<typeof VitalReportDownloaded>;

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  mockShare.mockReset();
  mockGoBack.mockReset();
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});
afterEach(() => {
  dropReport();
  jest.restoreAllMocks();
});

describe("Vital Report Downloaded Successfully page", () => {
  it("shows the success title and a Share Report button, and Close goes back", async () => {
    holdReport(PATIENT, "id\n1\n");
    await render(<VitalReportDownloaded {...props()} />);
    expect(screen.getByTestId("report-title")).toHaveTextContent(REPORT_DOWNLOADED_TITLE);
    expect(REPORT_DOWNLOADED_TITLE).toBe("Vital Report Downloaded Successfully");
    await fireEvent.press(screen.getByTestId("report-close"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("shares the report held in memory", async () => {
    holdReport(PATIENT, "id\n1\n");
    await render(<VitalReportDownloaded {...props()} />);
    await fireEvent.press(screen.getByText("Share Report"));
    await waitFor(() => expect(mockShare).toHaveBeenCalledWith("id\n1\n"));
  });

  it("says why when the share sheet cannot open", async () => {
    holdReport(PATIENT, "x");
    mockShare.mockRejectedValue(new Error("Sharing isn't available on this device."));
    await render(<VitalReportDownloaded {...props()} />);
    await fireEvent.press(screen.getByText("Share Report"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't share the report", "Sharing isn't available on this device."));
  });

  it("will not share another patient's report, or one that is gone", async () => {
    holdReport("someone-else", "secret");
    await render(<VitalReportDownloaded {...props()} />);
    await fireEvent.press(screen.getByText("Share Report"));
    expect(mockShare).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Couldn't share the report", expect.stringContaining("download it again"));
  });

  it("drops the report when the page goes", async () => {
    holdReport(PATIENT, "id\n1\n");
    const view = await render(<VitalReportDownloaded {...props()} />);
    await view.unmount();
    expect(heldReport(PATIENT)).toBeNull();
  });
});
