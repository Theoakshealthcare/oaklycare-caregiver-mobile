import type React from "react";

import { theme } from "@/src/constants/theme";

import Text from "./text";

/** The label above every form field: one size, one weight (Figma), a fixed 6 pt gap to the field. `required` adds Figma's red star. */
const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <Text variant="body" weight="medium" style={{ marginBottom: 6, lineHeight: 18 }}>
    {children}
    {required ? <Text color={theme.colors.secondary}>{" *"}</Text> : null}
  </Text>
);

export default FieldLabel;
