import type React from "react";

import Text from "./text";

/** The label above every form field: one size, one weight (Figma), a fixed 6 pt gap to the field. */
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text variant="body" weight="medium" style={{ marginBottom: 6, lineHeight: 18 }}>
    {children}
  </Text>
);

export default FieldLabel;
