import type React from "react";
import { View } from "react-native";

import Button from "@/src/components/ui/button";
import { Card, Chip, EmptyState } from "@/src/components/ui/card";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDate } from "@/src/domain/format";
import { useSetVitalAccess, useVitalAccess } from "@/src/hooks/useVitals";

/** Which caregivers can read the patient's vitals, with grant and revoke. */
const VitalAccess: React.FC = () => {
  const access = useVitalAccess();
  const setAccess = useSetVitalAccess();
  return (
    <Screen title="Who can see my vitals" scroll>
      <SampleNotice what="This list" />
      <Text color={theme.colors.textLight}>Only caregivers you allow can see your vitals. You can take access back at any time.</Text>
      {(access.data ?? []).length === 0 ? (
        <EmptyState title="No caregivers yet" message="Caregivers who visit you will appear here." />
      ) : (
        access.data?.map((entry) => (
          <Card key={entry.id}>
            <View style={{ gap: theme.spacing.xs }}>
              <Text weight="bold">{entry.caregiverName}</Text>
              <View>
                <Chip label={entry.granted ? "Access granted" : "No access"} tone={entry.granted ? "success" : "neutral"} />
              </View>
              {entry.grantedAt ? (
                <Text variant="small" color={theme.colors.textLight}>{`Since ${formatDate(entry.grantedAt)}`}</Text>
              ) : null}
            </View>
            <Button
              small
              title={entry.granted ? "Revoke access" : "Grant access"}
              variant={entry.granted ? "danger" : "primary"}
              loading={setAccess.isPending && setAccess.variables?.id === entry.id}
              onPress={() => setAccess.mutate({ id: entry.id, granted: !entry.granted })}
            />
          </Card>
        ))
      )}
    </Screen>
  );
};

export default VitalAccess;
