import type React from "react";

import { Card, EmptyState } from "@/src/components/ui/card";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";

/**
 * Sharing vitals with a caregiver. Not available yet: the backend compares the patient's USER id with a PATIENT id on grant,
 * revoke and list (`vitals.py`), so every grant is refused and the list is always empty. A backend slice fixes that; until then
 * this screen says so and offers nothing to tap, rather than show a list that cannot be true.
 */
const VitalAccess: React.FC = () => (
  <Screen title="Who can see my vitals" scroll>
    <Text color={theme.colors.textLight}>Only caregivers you allow can see your vitals. You will be able to take access back at any time.</Text>
    <Card tone="tint">
      <EmptyState title="Coming soon" message="Sharing your vitals with a caregiver is not available yet. Nobody can see your vitals but you." />
    </Card>
  </Screen>
);

export default VitalAccess;
