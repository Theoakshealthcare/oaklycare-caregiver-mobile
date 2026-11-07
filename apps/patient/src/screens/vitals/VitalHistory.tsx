import type React from "react";

import { Card, EmptyState } from "@/src/components/ui/card";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDateTime } from "@/src/domain/format";
import { readingText, vitalMeta } from "@/src/domain/vitals";
import { useVitalReadings } from "@/src/hooks/useVitals";

/** Every reading on record, newest first. */
const VitalHistory: React.FC = () => {
  const readings = useVitalReadings();
  const sorted = (readings.data ?? []).slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  return (
    <Screen title="History" scroll>
      <SampleNotice what="This history" />
      {sorted.length === 0 ? (
        <EmptyState title="No readings yet" message="Add a reading from the Vitals tab." />
      ) : (
        sorted.map((r) => {
          const meta = vitalMeta(r.kind);
          return (
            <Card key={r.id}>
              <Text weight="bold">{`${meta.label}: ${readingText(r)} ${meta.unit}`}</Text>
              <Text variant="small" color={theme.colors.textLight}>
                {formatDateTime(r.recordedAt)}
              </Text>
            </Card>
          );
        })
      )}
    </Screen>
  );
};

export default VitalHistory;
