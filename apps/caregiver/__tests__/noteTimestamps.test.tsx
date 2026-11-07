import { screen } from "@testing-library/react-native";
import React from "react";

import AINoteTaker from "../src/screens/chat/AINoteTaker";
import { formatVisitTime, parseBackendDate } from "../src/utils/dates";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";

jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));

jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

const note = (id: string, created_at: string) => ({
  id,
  booking_id: "b1",
  caregiver_id: "c1",
  title: `Note ${id}`,
  content: "Placeholder text",
  created_at,
});

let mockNotes: ReturnType<typeof note>[] = [];
jest.mock("../src/hooks/queries", () => ({
  useNotes: () => ({ data: mockNotes }),
  useCreateNote: () => ({ mutate: jest.fn(), isPending: false }),
}));

/**
 * DP1-04: the API sends UTC timestamps without a "Z". `new Date("2026-11-07T10:56:00")` reads that as device-local
 * time, so a note saved at 11:56 in Lagos showed as 10:56. These tests pin the instant, not the formatted text, so
 * they do not depend on the runner's timezone formatting.
 */
describe("backend timestamps", () => {
  // Run as a Lagos device does (UTC+1), so reading a naive string as local time is visibly wrong even on a UTC runner.
  const realTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Africa/Lagos";
  });
  afterAll(() => {
    if (realTz === undefined) delete process.env.TZ;
    else process.env.TZ = realTz;
  });

  it("reads a naive ISO string and a Z-suffixed one as the same UTC instant", () => {
    const naive = parseBackendDate("2026-11-07T10:56:00");
    const zulu = parseBackendDate("2026-11-07T10:56:00Z");
    expect(naive.toISOString()).toBe("2026-11-07T10:56:00.000Z");
    expect(zulu.getTime()).toBe(naive.getTime());
    expect(parseBackendDate("2026-11-07T11:56:00+01:00").getTime()).toBe(naive.getTime());
    expect(parseBackendDate("2026-11-07T10:56:00.123456").toISOString()).toBe("2026-11-07T10:56:00.123Z");
  });

  it("formats a naive timestamp exactly as the same instant with a Z (whatever the runner's timezone)", () => {
    // The runner's timezone is not reliably switchable (a Linux CI runner kept UTC), so compare outputs, not clock text.
    const naive = formatVisitTime("2026-11-07T10:56:00", "en-NG");
    expect(naive).not.toBe("");
    expect(naive).toBe(formatVisitTime("2026-11-07T10:56:00Z", "en-NG"));
  });

  it("the AI note list shows each note at its UTC instant, whether or not the API added a Z", async () => {
    mockNotes = [note("1", "2026-11-07T10:56:00"), note("2", "2026-11-07T10:56:00Z")];
    const rendered: number[] = [];
    const original = Date.prototype.toLocaleDateString;
    const spy = jest.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(function (this: Date, ...args) {
      rendered.push(this.getTime());
      return original.apply(this, args as Parameters<typeof original>);
    });
    await renderWithClient(<AINoteTaker {...routeProps<React.ComponentProps<typeof AINoteTaker>>({ bookingId: "b1" })} />);
    expect(await screen.findByText("Note 1")).toBeTruthy();
    spy.mockRestore();
    const utc = Date.UTC(2026, 10, 7, 10, 56, 0);
    expect(rendered.filter((ms) => ms === utc)).toHaveLength(2);
  });
});
