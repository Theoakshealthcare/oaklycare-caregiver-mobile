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

describe("sign-up and consent copy name the real buttons (DP1-09)", () => {
  it("sign-up says Create Account, and a button of that name exists", async () => {
    await render(withClient(<CreateAccount />));
    expect(screen.queryByText(/By tapping Get Started/)).toBeNull();
    expect(screen.getByText(/By tapping Create Account/)).toBeTruthy();
    expect(screen.getAllByText("Create Account").length).toBeGreaterThan(0);
  });

  it("consent says Give Consent and Submit, and is the last step", async () => {
    await render(withClient(<ConsentScreen />));
    expect(screen.queryByText(/By tapping Get Started/)).toBeNull();
    expect(screen.getByText(/By tapping Give Consent and Submit/)).toBeTruthy();
    expect(screen.getByText("Give Consent and Submit")).toBeTruthy();
    expect(screen.getByTestId("step-label")).toHaveTextContent(`Step ${consentStepNumber()} of ${onboardingStepCount()}`);
  });
});

describe("step indicator counts every onboarding screen", () => {
  it("is 4 steps with the identity check and 3 without; consent is always last", () => {
    expect(onboardingStepCount(true)).toBe(4);
    expect(onboardingStepCount(false)).toBe(3);
    expect(consentStepNumber(true)).toBe(4);
    expect(consentStepNumber(false)).toBe(3);
  });

  it("shows 'Step 3 of 4' with a bar three quarters full", async () => {
    await render(<StepIndicator step={3} total={4} />);
    expect(screen.getByTestId("step-label")).toHaveTextContent("Step 3 of 4");
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
