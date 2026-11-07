import type { StackScreenProps } from "@react-navigation/stack";
import type React from "react";

import Button from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { ScreenParamLists } from "@/src/navigation/Navigations";

type Props = StackScreenProps<ScreenParamLists, "FallResult">;

/** The result: the server's total score, recommendations, and the way on to booking a home visit. No share / download in v1. */
const FallResult: React.FC<Props> = ({ navigation, route }) => {
  const { result } = route.params;
  return (
    <Screen title="Assessment results" noBack scroll>
      <SampleNotice what="This result" />
      <Card tone="warm">
        <Text variant="small" color={theme.colors.textLight}>
          Total risk score
        </Text>
        <Text variant="h1" weight="bold">
          {String(result.totalScore)}
        </Text>
      </Card>
      <Text variant="h3" weight="bold">
        Recommendations
      </Text>
      {result.recommendations.map((r) => (
        <Card key={r.title}>
          <Text weight="bold">{r.title}</Text>
          <Text variant="small">{r.text}</Text>
        </Card>
      ))}
      <Text variant="h3" weight="bold">
        Next steps
      </Text>
      <Button title="Book a Home Visit" onPress={() => navigation.navigate("BookingStep1")} />
      <Button title="Done" variant="outline" onPress={() => navigation.navigate("Tabs", { tab: "fall", at: Date.now() })} />
    </Screen>
  );
};

export default FallResult;
