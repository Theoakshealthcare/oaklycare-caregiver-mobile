import { fireEvent, render, screen } from "@testing-library/react-native";
import { TextInput } from "react-native";

import OtpInput from "../src/components/ui/otp-input";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

// The code boxes draw a hidden input. A screen switches it off ("editable") while the code is being checked; on iOS that drops
// the focus and the keyboard for good, so after a wrong code the boxes looked ready but typing went nowhere.
describe("the code boxes", () => {
  const focus = () => jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, "focus").mockImplementation(() => undefined);

  afterEach(() => jest.restoreAllMocks());

  it("take the focus back when editing resumes after a check, if they had it", async () => {
    const spy = focus();
    const view = await render(<OtpInput value="" onChange={() => undefined} />);
    await fireEvent(screen.getByLabelText("Verification code"), "focus");

    await view.rerender(<OtpInput value="12345" onChange={() => undefined} editable={false} />);
    await fireEvent(screen.getByLabelText("Verification code"), "blur"); // what iOS does when the input stops being editable
    expect(spy).not.toHaveBeenCalled();

    await view.rerender(<OtpInput value="" onChange={() => undefined} editable />);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("do not grab the focus when the person had left the field", async () => {
    const spy = focus();
    const view = await render(<OtpInput value="" onChange={() => undefined} />);
    await fireEvent(screen.getByLabelText("Verification code"), "focus");
    await fireEvent(screen.getByLabelText("Verification code"), "blur"); // the person tapped elsewhere

    spy.mockClear(); // the test renderer itself touches focus() while firing the events above
    await view.rerender(<OtpInput value="" onChange={() => undefined} editable={false} />);
    await view.rerender(<OtpInput value="" onChange={() => undefined} editable />);
    expect(spy).not.toHaveBeenCalled();
  });
});
