import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import { ApiError } from "../src/api/errors";
import {
  firstName,
  formatNaira,
  greeting,
  homePollInterval,
  HOME_POLL_ACTIVE_MS,
  HOME_POLL_IDLE_MS,
  isLocationStale,
  mapHome,
} from "../src/home/homeModel";
import Home from "../src/screens/home/Home";
import { authService } from "../src/services/auth.service";
import { session } from "../src/auth";
import { locationService, type CaregiverHome } from "../src/supply/locationService";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: jest.fn(),
}));
const mockEnsureForeground = jest.fn();
jest.mock("../src/supply/permissions", () => ({
  ensureForegroundLocation: () => mockEnsureForeground(),
  ensureBackgroundLocation: jest.fn(),
}));
const mockReadPosition = jest.fn();
jest.mock("../src/supply/foregroundTracker", () => ({
  readCurrentPosition: () => mockReadPosition(),
}));

// Shaped after captures 091 (visit today + offer) and 073 in the backend guide.
const homeWithVisitAndOffer: CaregiverHome = {
  profile_status: "approved",
  is_available: true,
  location_updated_at: "2026-10-06T08:23:25.756428",
  today_visits: [
    {
      id: "d4055373-bee6-431e-977a-11b01af19a96",
      booking_code: "ECCADB9F",
      service_type: "nurse",
      status: "accepted",
      dispatch_state: "matched",
      scheduled_date: "2026-10-06T08:38:27.862624",
      scheduled_end_date: "2026-10-06T10:38:27.862624",
      duration_hours: 2,
      patient_name: "Placeholder Patient",
      patient_address: "12 Placeholder Street, Lekki",
      patient_city: "Lagos",
      patient_state: "Lagos",
    },
  ],
  upcoming_visits: [],
  open_offers: [
    {
      booking_id: "d63f2ad6-2f83-4d58-98cd-3c241fc8e354",
      service_type: "nurse",
      scheduled_date: "2026-10-06T08:38:27.867152",
      scheduled_end_date: "2026-10-06T10:38:27.867152",
      duration_hours: 2,
      area: "Lagos",
      state: "Lagos",
      offered_at: "2026-10-06T08:23:29.659045",
    },
  ],
  wallet_balance_naira: 125000.5,
  currency: "NGN",
};

const emptyHome: CaregiverHome = {
  profile_status: "approved",
  is_available: false,
  location_updated_at: null,
  today_visits: [],
  upcoming_visits: [],
  open_offers: [],
  wallet_balance_naira: 0,
  currency: "NGN",
};

const T0 = Date.parse("2026-10-06T08:30:00Z");

describe("mapHome", () => {
  it("maps visits, offers and the wallet from the response, nothing hardcoded", () => {
    const view = mapHome(homeWithVisitAndOffer, T0);
    expect(view.approved).toBe(true);
    expect(view.isAvailable).toBe(true);
    expect(view.walletBalance).toBe("₦125,000.50");
    expect(view.todayVisits).toHaveLength(1);
    expect(view.todayVisits[0]).toMatchObject({
      id: "d4055373-bee6-431e-977a-11b01af19a96",
      title: "nurse visit",
      patientName: "Placeholder Patient",
      address: "12 Placeholder Street, Lekki, Lagos",
      duration: "2 hours",
      statusLabel: "Accepted",
      inFlight: false,
    });
    expect(view.offers).toEqual([
      {
        id: "d63f2ad6-2f83-4d58-98cd-3c241fc8e354",
        serviceType: "nurse",
        assistanceType: null,
        durationHours: 2,
        scheduledDate: "2026-10-06T08:38:27.867152",
        scheduledEndDate: "2026-10-06T10:38:27.867152",
        area: "Lagos, Lagos",
      },
    ]);
  });

  it("an offer is the narrow view: no patient field can exist on it", () => {
    const [offer] = mapHome(homeWithVisitAndOffer, T0).offers;
    expect(Object.keys(offer ?? {}).sort()).toEqual(
      ["area", "assistanceType", "durationHours", "id", "scheduledDate", "scheduledEndDate", "serviceType"].sort(),
    );
  });

  it("flags non-approved statuses so the switch and accept are disabled", () => {
    const view = mapHome({ ...emptyHome, profile_status: "under_review" }, T0);
    expect(view.approved).toBe(false);
    expect(view.profileStatus).toBe("under_review");
  });

  it("marks en_route / in_progress visits as in flight", () => {
    const visit = homeWithVisitAndOffer.today_visits[0];
    if (!visit) throw new Error("fixture");
    const view = mapHome({ ...emptyHome, today_visits: [{ ...visit, status: "en_route" }, { ...visit, id: "x", status: "in_progress" }] }, T0);
    expect(view.todayVisits.map((v) => [v.statusLabel, v.inFlight])).toEqual([
      ["On the way", true],
      ["In progress", true],
    ]);
  });

  it("falls back to 'Patient' when a visit has no name", () => {
    const visit = homeWithVisitAndOffer.today_visits[0];
    if (!visit) throw new Error("fixture");
    const view = mapHome({ ...emptyHome, today_visits: [{ ...visit, patient_name: null }] }, T0);
    expect(view.todayVisits[0]?.patientName).toBe("Patient");
  });
});

describe("home helpers", () => {
  it("formats naira with grouping and two decimals", () => {
    expect(formatNaira(0)).toBe("₦0.00");
    expect(formatNaira(1234567.8)).toBe("₦1,234,567.80");
    expect(formatNaira(999)).toBe("₦999.00");
  });

  it("greets by first name only, and drops the name rather than inventing one", () => {
    expect(firstName("  Ada Obi ")).toBe("Ada");
    expect(greeting("Ada Obi")).toBe("Hello Ada");
    expect(greeting(undefined)).toBe("Hello");
    expect(greeting("")).toBe("Hello");
  });

  it("location is stale after 15 minutes only while available", () => {
    const at = "2026-10-06T08:23:25.756428"; // 6.5 minutes before T0 (UTC, no Z)
    expect(isLocationStale({ is_available: true, location_updated_at: at }, T0)).toBe(false);
    expect(isLocationStale({ is_available: true, location_updated_at: at }, T0 + 9 * 60_000)).toBe(true);
    expect(isLocationStale({ is_available: true, location_updated_at: null }, T0)).toBe(true);
    expect(isLocationStale({ is_available: false, location_updated_at: null }, T0)).toBe(false);
  });

  it("polls every 20 s while available or on a visit, every 60 s otherwise", () => {
    expect(homePollInterval(undefined)).toBe(HOME_POLL_ACTIVE_MS);
    expect(homePollInterval(homeWithVisitAndOffer)).toBe(HOME_POLL_ACTIVE_MS);
    expect(homePollInterval(emptyHome)).toBe(HOME_POLL_IDLE_MS);
    const visit = homeWithVisitAndOffer.today_visits[0];
    if (!visit) throw new Error("fixture");
    expect(homePollInterval({ ...emptyHome, today_visits: [{ ...visit, status: "en_route" }] })).toBe(HOME_POLL_ACTIVE_MS);
    expect(HOME_POLL_ACTIVE_MS).toBeGreaterThanOrEqual(15_000);
    expect(HOME_POLL_ACTIVE_MS).toBeLessThanOrEqual(30_000);
  });
});

describe("Home screen", () => {
  let getHome: jest.SpyInstance;
  let alertSpy: jest.SpyInstance;
  const order: string[] = [];

  async function renderHome() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return await render(
      <QueryClientProvider client={client}>
        <Home />
      </QueryClientProvider>,
    );
  }

  beforeEach(async () => {
    order.length = 0;
    await session.signIn({ accessToken: "access", refreshToken: "refresh" });
    jest.spyOn(authService, "getMe").mockResolvedValue({
      email: "ada@example.com",
      full_name: "Ada Obi",
      user_type: "caregiver",
      id: "u1",
      is_active: true,
      is_verified: true,
      created_at: "2026-10-01T00:00:00",
      updated_at: "2026-10-01T00:00:00",
    });
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockEnsureForeground.mockImplementation(async () => {
      order.push("permission");
      return true;
    });
    mockReadPosition.mockImplementation(async () => {
      order.push("position");
      return { latitude: 6.4494, longitude: 3.4723, accuracy: 10 };
    });
    jest.spyOn(locationService, "ping").mockImplementation(async () => {
      order.push("ping");
      return {} as never;
    });
    jest.spyOn(locationService, "setAvailability").mockImplementation(async (value) => {
      order.push(`availability:${value}`);
      return { is_available: value };
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    // Home is still mounted: sign out inside act so its session subscription does not warn.
    await act(async () => {
      await session.signOut();
    });
  });

  it("renders everything from GET /caregiver/home", async () => {
    getHome = jest.spyOn(locationService, "getHome").mockResolvedValue(homeWithVisitAndOffer);
    await renderHome();
    expect(await screen.findByText("Hello Ada")).toBeTruthy();
    expect(await screen.findByText("Placeholder Patient")).toBeTruthy();
    expect(screen.getByTestId("wallet-balance").props.children).toBe("₦125,000.50");
    expect(screen.getByText("Accept")).toBeTruthy(); // the offer card
    expect(screen.getByText("You're available")).toBeTruthy();
    expect(getHome).toHaveBeenCalled();
  });

  it("shows empty states and the approval gate for an unapproved caregiver", async () => {
    getHome = jest.spyOn(locationService, "getHome").mockResolvedValue({ ...emptyHome, profile_status: "under_review" });
    await renderHome();
    expect(await screen.findByText(/Your profile is under review/)).toBeTruthy();
    expect(screen.getByLabelText("Available for visits").props.disabled).toBe(true);
    expect(screen.getByText("No visits today")).toBeTruthy();
  });

  it("warns when available but the location is out of date", async () => {
    getHome = jest
      .spyOn(locationService, "getHome")
      .mockResolvedValue({ ...emptyHome, is_available: true, location_updated_at: "2020-01-01T00:00:00" });
    await renderHome();
    expect(await screen.findByText(/your location is out of date/)).toBeTruthy();
  });

  it("going available sends a location ping first, then the switch, with no is_available on the ping", async () => {
    getHome = jest.spyOn(locationService, "getHome").mockResolvedValue(emptyHome);
    await renderHome();
    const toggle = await screen.findByLabelText("Available for visits");
    await fireEvent(toggle, "valueChange", true);
    await waitFor(() => expect(order).toContain("availability:true"));
    expect(order).toEqual(["permission", "position", "ping", "availability:true"]);
    expect(locationService.ping).toHaveBeenCalledWith({ latitude: 6.4494, longitude: 3.4723, accuracy: 10 });
  });

  it("maps 'Share your location before going available' for the caregiver", async () => {
    getHome = jest.spyOn(locationService, "getHome").mockResolvedValue(emptyHome);
    (locationService.setAvailability as jest.Mock).mockRejectedValueOnce(
      new ApiError(409, { detail: "Share your location before going available" }, "x"),
    );
    await renderHome();
    await fireEvent(await screen.findByLabelText("Available for visits"), "valueChange", true);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy).toHaveBeenCalledWith(
      "Can't go available",
      "We need your location before you can go available. Turn on location and try again.",
    );
  });

  it("refused location permission stops before any request", async () => {
    getHome = jest.spyOn(locationService, "getHome").mockResolvedValue(emptyHome);
    mockEnsureForeground.mockResolvedValueOnce(false);
    await renderHome();
    await fireEvent(await screen.findByLabelText("Available for visits"), "valueChange", true);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(locationService.ping).not.toHaveBeenCalled();
    expect(locationService.setAvailability).not.toHaveBeenCalled();
  });

  it("the bell opens notifications and the avatar opens the profile menu", async () => {
    jest.spyOn(locationService, "getHome").mockResolvedValue(emptyHome);
    await renderHome();
    await fireEvent.press(await screen.findByLabelText("Notifications"));
    expect(mockNavigate).toHaveBeenCalledWith("Notifications");
    await fireEvent.press(screen.getByLabelText("Account"));
    expect(mockNavigate).toHaveBeenCalledWith("Profile");
  });

  it("going unavailable only calls the switch", async () => {
    getHome = jest.spyOn(locationService, "getHome").mockResolvedValue(homeWithVisitAndOffer);
    await renderHome();
    await fireEvent(await screen.findByLabelText("Available for visits"), "valueChange", false);
    await waitFor(() => expect(order).toEqual(["availability:false"]));
  });
});
