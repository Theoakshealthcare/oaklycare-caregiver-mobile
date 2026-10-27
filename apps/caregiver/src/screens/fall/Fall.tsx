import React from "react";
import { View } from "react-native";

import { EmptyState } from "@/src/components/account/StateViews";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";

/**
 * FallGuard is not built yet: the incident data comes from the patient side (their questionnaire,
 * and a WhatsApp Flow later), and there is no incident log to read. The tab says so instead of
 * showing a blank page.
 */
const Fall: React.FC = () => (
  <View style={[globalStyles.container, globalStyles.center, { backgroundColor: theme.colors.white }]}>
    <EmptyState
      icon="shield"
      title="FallGuard is coming soon"
      hint="Fall and near-fall reports will appear here once they are available. For now, record vitals from the Vitals tab."
    />
  </View>
);

export default Fall;
