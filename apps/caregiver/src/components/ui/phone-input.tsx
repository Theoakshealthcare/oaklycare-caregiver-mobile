import React, { useRef } from "react";
import type { TextInputProps } from "react-native";

import { formatPhoneInput, isForeignNumber } from "@/src/utils/phone";
import Input from "./input";

type InputProps = React.ComponentProps<typeof Input>;

/**
 * The one phone field of the app. It always holds "+234" followed by the national number: the prefix is already there
 * when the field opens and cannot be deleted, a typed leading 0 or a pasted "234..." is folded into it, so the value
 * the screen keeps is E.164 ("+2348012345678"). Give it the value from `toPhoneFieldValue(saved)`; a saved number from
 * another country stays as it was saved and is edited as plain text. Validation stays with the screen.
 */
const PhoneInput: React.FC<Omit<InputProps, "keyboardType" | "onChangeText" | "value"> & {
  value: string;
  onChangeText: (value: string) => void;
}> = ({ value, onChangeText, ...rest }) => {
  // Decided once, from what the field opened with, so deleting the "+23" of "+234" is never read as a foreign number.
  const foreign = useRef(isForeignNumber(value));
  const textProps: TextInputProps = { keyboardType: "phone-pad", autoComplete: "tel", textContentType: "telephoneNumber" };
  return (
    <Input
      {...textProps}
      {...rest}
      value={value}
      onChangeText={(text) => onChangeText(foreign.current ? text : formatPhoneInput(text))}
    />
  );
};

export default PhoneInput;
