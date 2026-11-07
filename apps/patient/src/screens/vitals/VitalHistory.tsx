import type React from "react";

import { Card, EmptyState } from "@/src/components/ui/card";
import QueryError from "@/src/components/ui/query-error";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { formatDateTime } from "@/src/domain/format";
import { GLUCOSE_CONTEXTS, readingText, vitalMeta } from "@/src/domain/vitals";
import { useVitalReadings } from "@/src/hooks/useVitals";

/** Every reading on record, newest first. */
const VitalHistory: React.FC = () => {
  const readings = useVitalReadings();
  const sorted = (readings.data ?? []).slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  return (
    <Screen title="History" scroll>
      {readings.isError ? (
        <QueryError what="your history" error={readings.error} onRetry={() => void readings.refetch()} />
      ) : sorted.length === 0 ? (
        <EmptyState title="No readings yet" message="Add a reading from the Vitals tab." />
      ) : (
        sorted.map((r) => {
          const meta = vitalMeta(r.kind);
          return (
            <Card key={r.id}>
              <Text weight="bold">{`${meta.label}: ${readingText(r)} ${meta.unit}`}</Text>
              {r.glucoseContext ? <Text variant="small">{GLUCOSE_CONTEXTS.find((g) => g.value === r.glucoseContext)?.label}</Text> : null}
              {r.sleepStart && r.sleepWake ? <Text variant="small">{`${r.sleepStart} to ${r.sleepWake}`}</Text> : null}
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
