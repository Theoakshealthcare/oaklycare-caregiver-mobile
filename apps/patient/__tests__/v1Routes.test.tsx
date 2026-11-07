import { fireEvent, screen } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { APP_SCREENS, AUTH_SCREENS, VERIFY_SCREENS } from "../src/navigation/routes";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

/** Features the owner kept out of v1 (LEDGER-patient-screens.md): none may be reachable as a route, a tab, a menu row or a button. */
const OUT_OF_V1 =
  /wallet|reschedul|provider list|change care provider|prescription|nutrition|physio|rating|rate (doctor|caregiver)|reminder|family|subscription|refer (and|&) earn|referral|invoice|video|\bcall\b|ai note|notetaker|note taker|support chat|live chat|wearable|heart alerts|request refund|satisfaction|complaint/i;

describe("nothing outside v1 is reachable", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());

  it("registers exactly the v1 routes, and none of them is an out-of-v1 feature", () => {
    const names = [...AUTH_SCREENS, ...APP_SCREENS, ...VERIFY_SCREENS].map((s) => s.name);
    expect(names.filter((name) => OUT_OF_V1.test(name))).toEqual([]);
    expect(AUTH_SCREENS.map((s) => s.name)).toEqual([
      "Onboarding",
      "Login",
      "CreateAccount",
      "VerifyEmail",
      "AccountCreated",
      "RecoverPassword",
      "ResetPassword",
    ]);
    expect(APP_SCREENS.map((s) => s.name)).toEqual([
      "Tabs",
      "Notifications",
      "Profile",
      "EditProfile",
      "Contact",
      "AccountData",
      "BookingStep1",
      "BookingStep2",
      "BookingSummary",
      "PaymentResult",
      "BookingDetails",
      "CancelBooking",
      "CaregiverDetail",
      "Chat",
      "VitalDetail",
      "AddVital",
      "VitalHistory",
      "VitalAccess",
      "FallAssessment",
      "FallResult",
    ]);
  });

  it("the signed-in app has the four tabs, in the designs' order, and nothing else in the bar", async () => {
    const { view } = await renderSignedIn();
    expect(screen.getAllByRole("tab").map((t) => t.props.accessibilityLabel)).toEqual(["Home", "Booking", "Vitals", "Fall"]);
    view.unmount();
  });

  it("no screen a person can open from the tabs, the menu or a booking shows an out-of-v1 feature", async () => {
    const { view } = await renderSignedIn();
    // Everything a person can read or a screen reader announces: visible text and accessibility labels.
    const check = (where: string) => {
      const found = [...screen.queryAllByText(OUT_OF_V1), ...screen.queryAllByLabelText(OUT_OF_V1)].map(
        (el) => el.props.accessibilityLabel ?? String(el.props.children),
      );
      expect({ where, found }).toEqual({ where, found: [] });
    };

    // The scan reads real text: the home screen's own heading is found by the same query.
    expect(screen.queryAllByText(/Remote Monitoring/).length).toBeGreaterThan(0);
    check("home");
    for (const tab of ["Booking", "Vitals", "Fall"]) {
      await fireEvent.press(screen.getByRole("tab", { name: tab }));
      check(tab);
    }
    await fireEvent.press(screen.getByRole("tab", { name: "Home" }));
    await fireEvent.press(screen.getByRole("button", { name: "Open profile" }));
    check("profile menu");
    await fireEvent.press(screen.getByRole("button", { name: "Edit personal information" }));
    check("edit profile");
    view.unmount();
  });
});
