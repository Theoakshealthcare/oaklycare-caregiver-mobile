import { act, render } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import React from "react";

import AppRuntime from "../src/navigation/AppRuntime";
import { locationService } from "../src/supply/locationService";

const mockNavigate = jest.fn();
jest.mock("../src/navigation/navigationRef", () => ({
  navigationRef: { isReady: () => true, navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

let mockHome: unknown;
jest.mock("../src/hooks/queries", () => ({ useCaregiverHome: () => ({ data: mockHome }) }));
jest.mock("../src/supply/permissionState", () => ({
  locationPermissionStore: { getState: () => ({ refresh: jest.fn() }) },
  useLocationPermissions: () => ({ foreground: true, background: false, loaded: true }),
}));
jest.mock("../src/supply/backgroundLocationTask", () => ({ startVisitUpdates: jest.fn(async () => {}), stopVisitUpdates: jest.fn(async () => {}) }));

const mockStart = jest.fn(async () => {});
const mockStop = jest.fn();
const mockRead = jest.fn();
jest.mock("../src/supply/foregroundTracker", () => ({
  createExpoForegroundTracker: () => ({ start: () => mockStart(), stop: () => mockStop() }),
  readCurrentPosition: () => mockRead(),
}));

const home = (isAvailable: boolean) => ({ profile_status: "approved", is_available: isAvailable, today_visits: [], open_offers: [] });
const COORDS = { latitude: 6.45, longitude: 3.4 };
// The push the backend sends (its capture 013): the data is only the type.
const tap = (id: string) => ({ notification: { request: { identifier: id, content: { data: { type: "location_stale" } } } } });
const onTap = () => (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls.at(-1)[0] as (r: unknown) => void;
const onReceived = () => (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls.at(-1)[0] as (n: unknown) => void;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

let ping: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockRead.mockResolvedValue(COORDS);
  ping = jest.spyOn(locationService, "ping").mockResolvedValue(undefined as never);
});
afterEach(() => jest.restoreAllMocks());

describe("the location_stale push", () => {
  it("starts the foreground tracker when an approved, Available caregiver has the app open", async () => {
    mockHome = home(true);
    await render(<AppRuntime />);
    await flush();
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("opens the app on Home and sends a fresh position when an Available caregiver taps it", async () => {
    mockHome = home(true);
    await render(<AppRuntime />);
    await flush();
    onTap()(tap("n1"));
    await flush();
    expect(mockNavigate).toHaveBeenCalledWith("BottomNavigation", { tab: "home", at: expect.any(Number) });
    expect(ping).toHaveBeenCalledTimes(1);
    // the ping never carries is_available (a ping without the flag leaves availability as it is)
    expect(ping).toHaveBeenCalledWith(COORDS);
  });

  it("handles one tap once, even if the same notification is delivered again (cold start and live listener)", async () => {
    mockHome = home(true);
    await render(<AppRuntime />);
    await flush();
    onTap()(tap("n1"));
    onTap()(tap("n1"));
    await flush();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("opens Home but sends no position for a caregiver who is not Available (nothing is tracked for them)", async () => {
    mockHome = home(false);
    await render(<AppRuntime />);
    await flush();
    onTap()(tap("n2"));
    await flush();
    expect(mockNavigate).toHaveBeenCalledWith("BottomNavigation", { tab: "home", at: expect.any(Number) });
    expect(mockStart).not.toHaveBeenCalled();
    expect(ping).not.toHaveBeenCalled();
  });

  it("does not fail when the position cannot be read", async () => {
    mockHome = home(true);
    mockRead.mockResolvedValue(null);
    await render(<AppRuntime />);
    await flush();
    onTap()(tap("n3"));
    await flush();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(ping).not.toHaveBeenCalled();
  });

  it("with the app already open, refreshes the position and navigates nowhere", async () => {
    mockHome = home(true);
    await render(<AppRuntime />);
    await flush();
    onReceived()({ request: { content: { data: { type: "location_stale" }, title: "Update your location", body: "..." } } });
    await flush();
    expect(ping).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
