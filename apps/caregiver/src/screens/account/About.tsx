import React from "react";
import { View } from "react-native";

import ScreenShell from "@/src/components/account/ScreenShell";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { ABOUT_HEADLINE, ABOUT_INTRO, MISSION_TEXT, MISSION_TITLE } from "@/src/content/about";

const About: React.FC = () => (
  <ScreenShell title="About us">
    <View style={{ gap: 12 }}>
      <Text variant="h3" weight="bold">
        {ABOUT_HEADLINE}
      </Text>
      <Text variant="body" color={theme.colors.textLight}>
        {ABOUT_INTRO}
      </Text>
      <Text variant="h3" weight="bold" style={{ marginTop: 16 }}>
        {MISSION_TITLE}
      </Text>
      <Text variant="body" color={theme.colors.textLight}>
        {MISSION_TEXT}
      </Text>
    </View>
  </ScreenShell>
);

export default About;
