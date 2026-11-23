import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { session } from "../src/auth";
import ClientCarePlanRow from "../src/components/careplan/ClientCarePlanRow";
import CarePlanClients from "../src/screens/careplan/CarePlanClients";
import CarePlanTemplate from "../src/screens/careplan/CarePlanTemplate";
import CarePlans from "../src/screens/careplan/CarePlans";
import { carePlansService } from "../src/services/carePlans.service";
import { locationService, type CaregiverHome } from "../src/supply/locationService";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import {
  BOOKING,
  NOT_A_NURSE,
  NO_ACCESS,
  PLAN_ID,
  TEMPLATE_ID,
  candidate,
  listItem,
  template,
  templateItem,
  visitPlan,
  visitSummary,
} from "../test-utils/carePlanFixtures";

const mockNavigate = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: mockNavigate, goBack: jest.fn(), replace: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
  useFocusEffect: jest.fn(),
}));

const home = (canAuthor: boolean): CaregiverHome => ({
  profile_status: "approved",
  is_available: false,
  location_updated_at: null,
  today_visits: [],
  upcoming_visits: [],
  open_offers: [],
  wallet_balance_naira: 0,
  currency: "NGN",
  can_author_care_plans: canAuthor,
});

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
  jest.spyOn(locationService, "getHome").mockResolvedValue(home(true));
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockNavigate.mockClear();
  await session.signOut();
});

const renderHub = (params?: { tab?: "assigned" | "templates"; bookingId?: string }) =>
  renderWithClient(<CarePlans {...routeProps<React.ComponentProps<typeof CarePlans>>(params)} />);

describe("Care plans hub: Assigned tab", () => {
  it("lists the assigned plans and opens one", async () => {
    const list = jest.spyOn(carePlansService, "listPlans").mockResolvedValue({
      items: [
        listItem({ progress_percent: 40 }),
        listItem({ id: "p2", client: { full_name: "Placeholder Relative", age: null, gender: null }, risk_level: "low", progress_percent: null }),
      ],
    });
    await renderHub();
    expect(await screen.findByText("Assigned Plan: Placeholder Client")).toBeTruthy();
    expect(screen.getByText("Assigned Plan: Placeholder Relative")).toBeTruthy();
    expect(screen.getByTestId(`plan-status-${PLAN_ID}`)).toHaveTextContent("Status: Ongoing");
    expect(screen.getByTestId("plan-status-p2")).toHaveTextContent("Status: Ongoing");
    expect(screen.getByTestId(`plan-risk-${PLAN_ID}`)).toHaveTextContent("Risk: High");
    expect(screen.getByTestId("plan-risk-p2")).toHaveTextContent("Risk: Low");
    expect(list).toHaveBeenCalledWith("active", "");
    // A bar only where there is a number: null means "nothing to measure", never 0%.
    expect(screen.getByTestId(`plan-progress-${PLAN_ID}`)).toBeTruthy();
    expect(screen.queryByTestId("plan-progress-p2")).toBeNull();

    await fireEvent.press(screen.getByTestId(`plan-${PLAN_ID}`));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanDetails", { planId: PLAN_ID });

    // View progress sits on every card and opens the plan's progress, not its details.
    mockNavigate.mockClear();
    await fireEvent.press(screen.getByTestId(`plan-view-progress-${PLAN_ID}`));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanProgress", { planId: PLAN_ID, clientName: "Placeholder Client" });
    expect(mockNavigate).not.toHaveBeenCalledWith("CarePlanDetails", expect.anything());
  });

  it("searches by client name after typing stops, and switches to completed plans", async () => {
    const list = jest.spyOn(carePlansService, "listPlans").mockResolvedValue({ items: [listItem()] });
    await renderHub();
    await screen.findByText("Assigned Plan: Placeholder Client");

    await fireEvent.changeText(screen.getByTestId("plans-search"), "  Ada ");
    await waitFor(() => expect(list).toHaveBeenCalledWith("active", "Ada"));

    // The filter button (sliders icon) opens the Active / Completed choice.
    expect(screen.queryByTestId("status-completed")).toBeNull();
    await fireEvent.press(screen.getByTestId("plans-filter"));
    await fireEvent.press(screen.getByTestId("status-completed"));
    await waitFor(() => expect(list).toHaveBeenCalledWith("completed", "Ada"));
  });

  it("never shows Active plans under the Completed filter while it loads", async () => {
    const list = jest.spyOn(carePlansService, "listPlans").mockResolvedValueOnce({ items: [listItem()] });
    await renderHub();
    await screen.findByText("Assigned Plan: Placeholder Client");
    list.mockReturnValueOnce(new Promise(() => undefined));
    await fireEvent.press(screen.getByTestId("plans-filter"));
    await fireEvent.press(screen.getByTestId("status-completed"));
    expect(await screen.findByTestId("plans-loading")).toBeTruthy();
    expect(screen.queryByText("Assigned Plan: Placeholder Client")).toBeNull();
  });

  it("clears the search when switching tabs", async () => {
    jest.spyOn(carePlansService, "listPlans").mockResolvedValue({ items: [] });
    jest.spyOn(carePlansService, "listTemplates").mockResolvedValue({ items: [templateItem()] });
    await renderHub();
    await fireEvent.changeText(screen.getByTestId("plans-search"), "Ada");
    await fireEvent.press(screen.getByTestId("tab-templates"));
    expect(await screen.findByText("Stroke Recovery")).toBeTruthy();
    // Figma draws no search on the templates tab, and the assigned search starts empty when you come back.
    expect(screen.queryByTestId("plans-search")).toBeNull();
    await fireEvent.press(screen.getByTestId("tab-assigned"));
    expect(screen.getByTestId("plans-search").props.value).toBe("");
  });

  it("shows an empty state, a search-miss state and an error with retry", async () => {
    const list = jest.spyOn(carePlansService, "listPlans").mockResolvedValue({ items: [] });
    await renderHub();
    expect(await screen.findByText("No active care plans")).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("plans-search"), "zzz");
    expect(await screen.findByText("No plans match")).toBeTruthy();

    list.mockRejectedValueOnce(new Error("boom"));
    await fireEvent.changeText(screen.getByTestId("plans-search"), "yyy");
    expect(await screen.findByText("Try again")).toBeTruthy();
  });

  it("offers Create New Care Plan to a nurse, which opens the client picker", async () => {
    jest.spyOn(carePlansService, "listPlans").mockResolvedValue({ items: [] });
    await renderHub();
    await fireEvent.press(await screen.findByTestId("create-new-plan"));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanClients", {});
  });

  it("goes straight to the form when opened from a client's profile", async () => {
    jest.spyOn(carePlansService, "listPlans").mockResolvedValue({ items: [] });
    await renderHub({ bookingId: BOOKING });
    await fireEvent.press(await screen.findByTestId("create-new-plan"));
    expect(mockNavigate).toHaveBeenCalledWith("CreateCarePlan", { bookingId: BOOKING });
  });

  it("hides Create New Care Plan when the server does not say the caregiver can author", async () => {
    (locationService.getHome as jest.Mock).mockResolvedValue(home(false));
    jest.spyOn(carePlansService, "listPlans").mockResolvedValue({ items: [listItem()] });
    await renderHub();
    await screen.findByText("Assigned Plan: Placeholder Client");
    expect(screen.queryByTestId("create-new-plan")).toBeNull();
  });
});

describe("Care plans hub: Templates tab", () => {
  beforeEach(() => {
    jest.spyOn(carePlansService, "listPlans").mockResolvedValue({ items: [] });
  });

  it("lists templates with the not-reviewed note, previews one and uses another", async () => {
    jest.spyOn(carePlansService, "listTemplates").mockResolvedValue({
      items: [templateItem(), templateItem({ id: "t2", key: "diabetes_management", name: "Diabetes Management", summary: "Meals and glucose records.", clinical_review_status: "approved" })],
    });
    await renderHub({ tab: "templates" });
    expect(await screen.findByText("Stroke Recovery")).toBeTruthy();
    expect(screen.getByText("Diabetes Management")).toBeTruthy();
    expect(screen.getByTestId("template-pending-stroke_recovery")).toBeTruthy();
    expect(screen.queryByTestId("template-pending-diabetes_management")).toBeNull();

    expect(screen.getAllByText("30-day Program")).toHaveLength(2);

    await fireEvent.press(screen.getByTestId("template-preview-stroke_recovery"));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanTemplate", { templateId: TEMPLATE_ID, bookingId: undefined });

    // "Use Template" skips the preview and goes to the client picker.
    mockNavigate.mockClear();
    await fireEvent.press(screen.getByTestId("template-use-diabetes_management"));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanClients", { templateId: "t2" });
  });

  it("explains that templates are for nurses on a 403", async () => {
    jest.spyOn(carePlansService, "listTemplates").mockRejectedValue(NOT_A_NURSE);
    await renderHub({ tab: "templates" });
    expect(await screen.findByText("Templates are for nurses")).toBeTruthy();
  });

  it("switching tabs shows the other list", async () => {
    jest.spyOn(carePlansService, "listTemplates").mockResolvedValue({ items: [templateItem()] });
    await renderHub();
    await fireEvent.press(screen.getByTestId("tab-templates"));
    expect(await screen.findByText("Stroke Recovery")).toBeTruthy();
  });
});

describe("Template preview", () => {
  const renderPreview = (bookingId?: string) =>
    renderWithClient(<CarePlanTemplate {...routeProps<React.ComponentProps<typeof CarePlanTemplate>>({ templateId: TEMPLATE_ID, bookingId })} />);

  it("shows the program, goals, tasks by slot, instructions and the review note", async () => {
    jest.spyOn(carePlansService, "getTemplate").mockResolvedValue(template());
    await renderPreview();
    expect(await screen.findByTestId("template-program")).toHaveTextContent("30 days program, review every 14 days");
    expect(screen.getByTestId("template-not-reviewed")).toHaveTextContent("Not yet clinically reviewed");
    expect(screen.getByText("Safe mobility and transfers")).toBeTruthy();
    expect(screen.getByText("No falls this month")).toBeTruthy();
    expect(screen.getByText("Morning")).toBeTruthy();
    expect(screen.getByText("Evening")).toBeTruthy();
    expect(screen.getByText("Check and record BP and pulse, 08:00 · Daily")).toBeTruthy();
    expect(screen.getByText("Follow the therapist's exercise sheet")).toBeTruthy();
    expect(screen.getByText("Edit anything after you create the plan.")).toBeTruthy();
  });

  it("hides the review note once the template is approved", async () => {
    jest.spyOn(carePlansService, "getTemplate").mockResolvedValue(template({ clinical_review_status: "approved" }));
    await renderPreview();
    await screen.findByTestId("template-program");
    expect(screen.queryByTestId("template-not-reviewed")).toBeNull();
  });

  it("Use template goes to the client picker", async () => {
    jest.spyOn(carePlansService, "getTemplate").mockResolvedValue(template());
    await renderPreview();
    await fireEvent.press(await screen.findByTestId("use-template"));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanClients", { templateId: TEMPLATE_ID });
  });

  it("Use template skips the picker when it was opened from a client's profile", async () => {
    jest.spyOn(carePlansService, "getTemplate").mockResolvedValue(template());
    await renderPreview(BOOKING);
    await fireEvent.press(await screen.findByTestId("use-template"));
    expect(mockNavigate).toHaveBeenCalledWith("CreateCarePlan", { bookingId: BOOKING, templateId: TEMPLATE_ID });
  });
});

describe("Client picker", () => {
  const renderPicker = (templateId?: string) =>
    renderWithClient(<CarePlanClients {...routeProps<React.ComponentProps<typeof CarePlanClients>>(templateId ? { templateId } : {})} />);

  it("lists clients without a plan and continues with the chosen visit and the template", async () => {
    const c = candidate();
    jest.spyOn(carePlansService, "listCandidates").mockResolvedValue({ items: [c] });
    jest.spyOn(carePlansService, "getTemplate").mockResolvedValue(template());
    await renderPicker(TEMPLATE_ID);
    expect(await screen.findByText("Placeholder Client Two")).toBeTruthy();
    expect(screen.getByText("Male")).toBeTruthy();
    expect(await screen.findByText("Care plan from the Stroke Recovery template")).toBeTruthy();
    expect(screen.getByText(/^Accepted · /)).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`client-${c.booking_id}`));
    expect(mockNavigate).toHaveBeenCalledWith("CreateCarePlan", {
      bookingId: c.booking_id,
      templateId: TEMPLATE_ID,
      clientName: "Placeholder Client Two",
    });
  });

  it("explains an empty list", async () => {
    jest.spyOn(carePlansService, "listCandidates").mockResolvedValue({ items: [] });
    await renderPicker();
    expect(await screen.findByText("No clients waiting for a plan")).toBeTruthy();
  });

  it("tells a non-nurse that only nurses can create plans", async () => {
    jest.spyOn(carePlansService, "listCandidates").mockRejectedValue(NOT_A_NURSE);
    await renderPicker();
    expect(await screen.findByText("Only nurses can create plans")).toBeTruthy();
  });
});

describe("Client profile: Care plan row", () => {
  const renderRow = () => renderWithClient(<ClientCarePlanRow bookingId={BOOKING} clientName="Placeholder Client" />);

  it("opens the existing plan", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ plan: visitSummary }));
    await renderRow();
    expect(await screen.findByTestId("care-plan-row-diagnosis")).toHaveTextContent("Placeholder diagnosis");
    expect(screen.getByText("30 days · 1 goal")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("care-plan-open"));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlanDetails", { planId: PLAN_ID });
  });

  it("offers a nurse Create and Use a template when there is no plan", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan());
    await renderRow();
    await fireEvent.press(await screen.findByTestId("care-plan-create"));
    expect(mockNavigate).toHaveBeenCalledWith("CreateCarePlan", { bookingId: BOOKING, clientName: "Placeholder Client" });
    await fireEvent.press(screen.getByTestId("care-plan-use-template"));
    expect(mockNavigate).toHaveBeenCalledWith("CarePlans", { tab: "templates", bookingId: BOOKING });
  });

  it("tells another caregiver to ask the nurse, with no create button", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ can_author: false }));
    await renderRow();
    expect(await screen.findByTestId("care-plan-row-ask")).toHaveTextContent("Ask the nurse on this visit to create one.");
    expect(screen.queryByTestId("care-plan-create")).toBeNull();
  });

  it("says a plan isn't available when the client cannot be identified", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockResolvedValue(visitPlan({ subject_ready: false, can_author: false }));
    await renderRow();
    expect(await screen.findByTestId("care-plan-row-not-identified")).toHaveTextContent(/We can't tell who this visit is for/);
    expect(screen.queryByTestId("care-plan-create")).toBeNull();
  });

  it("shows the lost-access wording on a 404 and no retry", async () => {
    jest.spyOn(carePlansService, "getVisitPlan").mockRejectedValue(NO_ACCESS);
    await renderRow();
    expect(await screen.findByTestId("care-plan-row-unavailable")).toHaveTextContent(/accepted, on the way or in progress/);
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("offers a retry on another failure", async () => {
    const get = jest.spyOn(carePlansService, "getVisitPlan").mockRejectedValueOnce(new Error("boom"));
    await renderRow();
    expect(await screen.findByText("We couldn't load the care plan.")).toBeTruthy();
    get.mockResolvedValue(visitPlan({ plan: visitSummary }));
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByTestId("care-plan-open")).toBeTruthy();
  });
});
