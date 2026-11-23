import { fireEvent, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

import StepIndicator, { consentStepNumber, onboardingStepCount } from "../src/components/ui/step-indicator";
import Select from "../src/components/ui/select";
import ConsentScreen from "../src/screens/setup/ConsentScreen";
import CreateAccount from "../src/screens/auth/CreateAccount";

jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
  useNavigationState: (select: (state: { index: number }) => unknown) => select({ index: 1 }),
}));

const withClient = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
);

describe("sign-up and consent copy follow the Figma frames", () => {
  it("sign-up has the Figma fields (no phone box), the Get Started terms line, and an unticked box the person must tick", async () => {
    await render(withClient(<CreateAccount />));
    expect(screen.getByText(/By tapping Get Started, you agree to our/)).toBeTruthy();
    expect(screen.getByText("Cookies Policy")).toBeTruthy();
    expect(screen.getAllByText("Create Account").length).toBeGreaterThan(0);
    expect(screen.getByText("Full Name")).toBeTruthy();
    expect(screen.getByText("Email Address")).toBeTruthy();
    expect(screen.getByText("Create Password")).toBeTruthy();
    // Phone-number sign-up stays off: there is no phone field on this form.
    expect(screen.queryByText(/Phone Number/)).toBeNull();
    // Nothing is pre-ticked: pressing Create Account first asks for the tick.
    await fireEvent.changeText(screen.getByPlaceholderText("Provide your Full Name"), "Cora Placeholder");
    await fireEvent.changeText(screen.getByPlaceholderText("Provide your Email Address"), "cora.placeholder@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Enter your Password"), "Placeholder-Pass-1");
    await fireEvent.press(screen.getAllByText("Create Account").at(-1) as never);
    expect(await screen.findByText("You must agree to the terms")).toBeTruthy();
  });

  it("consent is the heading, the terms line and a Give Consent button, with no step bar and none of the old paragraphs", async () => {
    await render(withClient(<ConsentScreen />));
    expect(screen.getByText("Background Checks & Data Usage Consent")).toBeTruthy();
    expect(screen.getByText(/By tapping Get Started, you agree to our/)).toBeTruthy();
    expect(screen.getByText("Privacy Policy")).toBeTruthy();
    expect(screen.getByText("Cookies Policy")).toBeTruthy();
    expect(screen.getByText("Give Consent")).toBeTruthy();
    expect(screen.queryByText("Give Consent and Submit")).toBeNull();
    expect(screen.queryByTestId("step-label")).toBeNull();
    expect(screen.queryByText(/We will conduct background checks/)).toBeNull();
  });
});

describe("step indicator counts every onboarding screen", () => {
  it("is 4 steps with the identity check and 3 without; consent is always last", () => {
    expect(onboardingStepCount(true)).toBe(4);
    expect(onboardingStepCount(false)).toBe(3);
    expect(consentStepNumber(true)).toBe(4);
    expect(consentStepNumber(false)).toBe(3);
  });

  it("shows 'Step 3' with a bar three quarters full of four", async () => {
    await render(<StepIndicator step={3} total={4} />);
    expect(screen.getByTestId("step-label")).toHaveTextContent("Step 3");
    expect(screen.getByTestId("step-bar").props.style.width).toBe("75%");
  });
});

describe("Select as a multi-select (service areas, DP1-29)", () => {
  const options = [
    { label: "Lekki", value: "Lekki" },
    { label: "Ikeja", value: "Ikeja" },
    { label: "Yaba", value: "Yaba" },
  ];

  function Harness({ onChange }: { onChange: (v: (string | number)[]) => void }) {
    const [values, setValues] = React.useState<(string | number)[]>([]);
    return (
      <Select
        label="Service areas"
        placeholder="Select Service Areas"
        multiple
        values={values}
        onValuesChange={(v) => {
          setValues(v);
          onChange(v);
        }}
        options={options}
      />
    );
  }

  it("stays open while areas are toggled, shows the count, and closes only on Done", async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);
    await fireEvent.press(screen.getByText("Select Service Areas"));
    await fireEvent.press(screen.getByText("Lekki"));
    await fireEvent.press(screen.getByText("Yaba"));
    // Both taps landed in the same open sheet: no reopening per area.
    expect(onChange).toHaveBeenLastCalledWith(["Lekki", "Yaba"]);
    expect(screen.getByText("Done (2 selected)")).toBeTruthy();
    await fireEvent.press(screen.getByText("Lekki"));
    expect(onChange).toHaveBeenLastCalledWith(["Yaba"]);
    await fireEvent.press(screen.getByTestId("select-done"));
    // The field now summarises the choice.
    expect(screen.getByText("Yaba")).toBeTruthy();
  });

  it("a single-select still closes on tap and has no Done button", async () => {
    const onValueChange = jest.fn();
    await render(<Select label="State" options={options} onValueChange={onValueChange} />);
    await fireEvent.press(screen.getByText("Select an option"));
    expect(screen.queryByTestId("select-done")).toBeNull();
    await fireEvent.press(screen.getByText("Ikeja"));
    expect(onValueChange).toHaveBeenCalledWith("Ikeja");
  });
});
