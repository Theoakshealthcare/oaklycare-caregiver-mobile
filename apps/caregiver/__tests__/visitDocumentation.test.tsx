import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { ApiError } from "../src/api/errors";
import { session } from "../src/auth";
import PostVisitLinks from "../src/components/visit/PostVisitLinks";
import VisitDocumentation from "../src/screens/visit/VisitDocumentation";
import { carePlansService } from "../src/services/carePlans.service";
import { visitDocumentationService, type VisitDocumentList } from "../src/services/visitDocumentation.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import { BOOKING, PLAN_ID, visitPlan, visitSummary } from "../test-utils/carePlanFixtures";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  await session.signOut();
});

const entry = (over: Partial<VisitDocumentList["items"][number]> = {}) => ({
  id: "d1",
  booking_id: BOOKING,
  plan_id: null,
  body: "Placeholder entry: client ate well.",
  created_at: "2026-11-25T10:00:00",
  ...over,
});
const listOf = (over: Partial<VisitDocumentList> = {}): VisitDocumentList => ({
  items: [],
  can_add: true,
  closes_at: null,
  readable_until: null,
  ...over,
});

const renderScreen = () => renderWithClient(<VisitDocumentation {...routeProps<React.ComponentProps<typeof VisitDocumentation>>({ bookingId: BOOKING })} />);

describe("My documentation (a caregiver's own, private notes)", () => {
  it("says it is private and lists only what the server returned, newest first", async () => {
    jest.spyOn(visitDocumentationService, "list").mockResolvedValue(
      listOf({ items: [entry({ id: "d2", body: "Placeholder second entry" }), entry()] }),
    );
    await renderScreen();
    expect(await screen.findByText("Placeholder second entry")).toBeTruthy();
    expect(screen.getByText("Placeholder entry: client ate well.")).toBeTruthy();
    expect(screen.getByText(/The family does not see them/)).toBeTruthy();
    expect(visitDocumentationService.list).toHaveBeenCalledWith(BOOKING);
  });

  it("saves the trimmed text and clears the box", async () => {
    jest.spyOn(visitDocumentationService, "list").mockResolvedValue(listOf());
    const add = jest.spyOn(visitDocumentationService, "add").mockResolvedValue(entry());
    await renderScreen();
    expect(await screen.findByTestId("documentation-empty")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("documentation-input"), "  Walked in the garden.  ");
    await fireEvent.press(screen.getByTestId("documentation-submit"));
    await waitFor(() => expect(add).toHaveBeenCalledWith(BOOKING, "Walked in the garden."));
    await waitFor(() => expect(screen.getByTestId("documentation-input").props.value).toBe(""));
  });

  it("refuses an empty entry without calling the server", async () => {
    jest.spyOn(visitDocumentationService, "list").mockResolvedValue(listOf());
    const add = jest.spyOn(visitDocumentationService, "add");
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("documentation-submit"));
    expect(await screen.findByTestId("documentation-error")).toHaveTextContent("Write something first.");
    expect(add).not.toHaveBeenCalled();
  });

  it("shows the 2-hour window after the visit while entries can still be added", async () => {
    jest.spyOn(visitDocumentationService, "list").mockResolvedValue(
      listOf({ closes_at: new Date(Date.now() + 3600_000).toISOString().slice(0, 19) }),
    );
    await renderScreen();
    expect(await screen.findByTestId("documentation-window")).toHaveTextContent(/You can add entries until/);
    expect(screen.getByTestId("documentation-input")).toBeTruthy();
  });

  it("shows no entry form once the window has closed, but the entries stay readable", async () => {
    jest.spyOn(visitDocumentationService, "list").mockResolvedValue(listOf({ can_add: false, items: [entry()] }));
    await renderScreen();
    expect(await screen.findByTestId("documentation-closed")).toBeTruthy();
    expect(screen.queryByTestId("documentation-input")).toBeNull();
    expect(screen.getByText("Placeholder entry: client ate well.")).toBeTruthy();
  });

  it("keeps the typed text and closes the form when the window ended while typing (409 visit_not_active)", async () => {
    jest.spyOn(visitDocumentationService, "list").mockResolvedValue(listOf());
    jest.spyOn(visitDocumentationService, "add").mockRejectedValue(
      new ApiError(409, { detail: { code: "visit_not_active", message: "Notes can be added during a visit and for a short time after it ends." } }, "Notes can be added during a visit and for a short time after it ends."),
    );
    await renderScreen();
    await fireEvent.changeText(await screen.findByTestId("documentation-input"), "Placeholder late entry");
    await fireEvent.press(screen.getByTestId("documentation-submit"));
    expect(await screen.findByTestId("documentation-closed")).toBeTruthy();
    expect(screen.queryByTestId("documentation-submit")).toBeNull();
  });

  it("says the documentation is gone after the 24-hour reading window (404 not_found)", async () => {
    jest.spyOn(visitDocumentationService, "list").mockRejectedValue(new ApiError(404, { detail: { code: "not_found", message: "Visit not found." } }, "Visit not found."));
    await renderScreen();
    expect(await screen.findByTestId("documentation-gone")).toHaveTextContent("This documentation is no longer available.");
  });
});

describe("Doors from a visit's notes screen", () => {
  const renderLinks = (completed: boolean) => renderWithClient(<PostVisitLinks bookingId={BOOKING} completed={completed} />);

  it("always offers My documentation, and no care plan note while the visit is not completed (no request made)", async () => {
    const summary = jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: visitSummary }));
    await renderLinks(false);
    await fireEvent.press(await screen.findByTestId("open-documentation"));
    expect(mockNavigate).toHaveBeenCalledWith("VisitDocumentation", { bookingId: BOOKING });
    expect(screen.queryByTestId("open-care-plan-note")).toBeNull();
    expect(summary).not.toHaveBeenCalled();
  });

  it("offers the assigned nurse the care plan note after the visit, using the plan the server found", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ can_author: false, plan: visitSummary }));
    await renderLinks(true);
    await fireEvent.press(await screen.findByTestId("open-care-plan-note"));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanDetails", { planId: PLAN_ID });
  });

  it("has no care plan note for anyone the server answers 404 (not the assigned nurse, or the 2 hours are over)", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockRejectedValue(new ApiError(404, { detail: "Care plan not found" }, "Care plan not found"));
    await renderLinks(true);
    expect(await screen.findByTestId("open-documentation")).toBeTruthy();
    expect(screen.queryByTestId("open-care-plan-note")).toBeNull();
  });
});
