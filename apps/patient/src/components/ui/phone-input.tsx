import type React from "react";
import type { TextInputProps } from "react-native";

import { displayPhone, normalizePhone } from "@/src/domain/phone";

import Input from "./input";

interface PhoneInputProps extends Omit<TextInputProps, "value" | "onChangeText" | "keyboardType"> {
  label?: string;
  required?: boolean;
  error?: string;
  /** The stored number (any shape: "08012345678", "+2348012345678", "" ...). It is shown in the "+234" form. */
  value: string;
  /** Always receives the normalised E.164 number ("+2348012345678"), never a bare "0..." or a number without the prefix. */
  onChangeText: (phone: string) => void;
}

/**
 * The one phone box of the app: "+234" is already in it and cannot be deleted, a typed or pasted leading 0 or 234 is folded into it,
 * and what the screen is told is always the E.164 number. A saved number in an older shape still shows (in the "+234" form).
 */
const PhoneInput: React.FC<PhoneInputProps> = ({ value, onChangeText, ...rest }) => (
  <Input
    {...rest}
    value={displayPhone(value)}
    onChangeText={(text) => onChangeText(normalizePhone(text))}
    keyboardType="phone-pad"
    autoComplete="tel"
    textContentType="telephoneNumber"
  />
);

export default PhoneInput;
