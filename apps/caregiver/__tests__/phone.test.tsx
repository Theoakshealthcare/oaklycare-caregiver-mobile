import { fireEvent, render, screen } from "@testing-library/react-native";
import React, { useState } from "react";

import PhoneInput from "../src/components/ui/phone-input";
import { formatPhoneInput, isForeignNumber, isPhoneBlank, phoneForSave, toPhoneFieldValue } from "../src/utils/phone";

describe("formatPhoneInput: every phone field holds +234 and the national number", () => {
  it.each([
    ["", "+234"],
    ["+", "+234"],
    ["+2", "+234"],
    ["+23", "+234"],
    ["+234", "+234"],
    ["234", "+234"],
    ["8", "+2348"],
    ["+2348", "+2348"],
    ["+2348012345678", "+2348012345678"],
    ["2348012345678", "+2348012345678"],
    ["08012345678", "+2348012345678"],
    ["+23408012345678", "+2348012345678"],
    ["+2340", "+234"],
    ["+234+2348012345678", "+2348012345678"],
    ["+2342348012345678", "+2348012345678"],
    ["+234 801 234 5678", "+2348012345678"],
    ["+234(801)-234-5678", "+2348012345678"],
    ["+234abc", "+234"],
  ])("%p -> %p", (typed, shown) => {
    expect(formatPhoneInput(typed)).toBe(shown);
  });

  it("caps the national number so the whole number stays within E.164", () => {
    expect(formatPhoneInput("+23480123456789012345")).toBe("+234801234567890");
  });
});

describe("saved numbers", () => {
  it("shows blank as the bare prefix and local or 234 forms as +234", () => {
    expect(toPhoneFieldValue(null)).toBe("+234");
    expect(toPhoneFieldValue(undefined)).toBe("+234");
    expect(toPhoneFieldValue("")).toBe("+234");
    expect(toPhoneFieldValue("08012345678")).toBe("+2348012345678");
    expect(toPhoneFieldValue("2348012345678")).toBe("+2348012345678");
    expect(toPhoneFieldValue("+2348012345678")).toBe("+2348012345678");
  });

  it("keeps a number from another country as it was saved", () => {
    expect(isForeignNumber("+447911123456")).toBe(true);
    expect(isForeignNumber("+2348012345678")).toBe(false);
    expect(isForeignNumber("08012345678")).toBe(false);
    expect(toPhoneFieldValue("+447911123456")).toBe("+447911123456");
  });

  it("sends nothing when only the prefix is left", () => {
    expect(isPhoneBlank("+234")).toBe(true);
    expect(isPhoneBlank("+2348")).toBe(false);
    expect(phoneForSave("+234")).toBe("");
    expect(phoneForSave("+2348012345678")).toBe("+2348012345678");
  });
});

const Harness: React.FC<{ initial: string }> = ({ initial }) => {
  const [value, setValue] = useState(initial);
  return <PhoneInput testID="phone" label="Phone" value={value} onChangeText={setValue} />;
};

describe("PhoneInput", () => {
  it("opens with the prefix, uses the phone keyboard, and puts the prefix back when it is deleted", async () => {
    await render(<Harness initial="+234" />);
    const field = screen.getByTestId("phone");
    expect(field.props.value).toBe("+234");
    expect(field.props.keyboardType).toBe("phone-pad");
    await fireEvent.changeText(field, "+23");
    expect(screen.getByTestId("phone").props.value).toBe("+234");
    await fireEvent.changeText(screen.getByTestId("phone"), "");
    expect(screen.getByTestId("phone").props.value).toBe("+234");
  });

  it("folds a typed leading 0 into E.164 as the user types", async () => {
    await render(<Harness initial="+234" />);
    await fireEvent.changeText(screen.getByTestId("phone"), "+2340");
    expect(screen.getByTestId("phone").props.value).toBe("+234");
    await fireEvent.changeText(screen.getByTestId("phone"), "+23408");
    expect(screen.getByTestId("phone").props.value).toBe("+2348");
  });

  it("edits a saved number from another country as plain text", async () => {
    await render(<Harness initial="+447911123456" />);
    await fireEvent.changeText(screen.getByTestId("phone"), "+44791112345");
    expect(screen.getByTestId("phone").props.value).toBe("+44791112345");
  });
});
