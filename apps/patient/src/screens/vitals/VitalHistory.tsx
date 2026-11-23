import type React from "react";

import { Card } from "@/src/components/ui/card";
import QueryError from "@/src/components/ui/query-error";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import InsightList from "@/src/components/vitals/InsightList";
import { theme } from "@/src/constants/theme";
import { formatDateTime } from "@/src/domain/format";
import { GLUCOSE_CONTEXTS, readingText, vitalMeta } from "@/src/domain/vitals";
import { useVitalInsights, useVitalReadings } from "@/src/hooks/useVitals";

/**
 * "History & Insights" (Figma): the sentences the server's AI wrote from the readings, with every reading on record under them.
 * The reading log is not in the design; it stays because it is the only list of past readings and it is built.
 */
const VitalHistory: React.FC = () => {
  const readings = useVitalReadings();
  const insights = useVitalInsights();
  const sorted = (readings.data ?? []).slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  const notes = insights.data ?? [];
  return (
    <Screen title="History & Insights" centerTitle scroll>
      {readings.isError ? <QueryError what="your history" error={readings.error} onRetry={() => void readings.refetch()} /> : null}
      {notes.length > 0 ? <InsightList lines={notes} /> : null}
      {insights.isLoading && sorted.length > 0 ? (
        <Text variant="small" color={theme.colors.textLight}>
          Looking at your readings…
        </Text>
      ) : null}
      {!readings.isError && sorted.length === 0 ? (
        <Text color={theme.colors.textLight} center>
          No readings yet. Add one from the Vitals tab.
        </Text>
      ) : null}
      {sorted.length > 0 ? (
        <Text variant="h3" weight="bold">
          All readings
        </Text>
      ) : null}
      {sorted.map((r) => {
        const meta = vitalMeta(r.kind);
        return (
          <Card key={r.id}>
            <Text weight="bold">{`${meta.label}: ${readingText(r)} ${r.unit}`}</Text>
            {r.glucoseContext ? <Text variant="small">{GLUCOSE_CONTEXTS.find((g) => g.value === r.glucoseContext)?.label}</Text> : null}
            {r.sleepStart && r.sleepWake ? <Text variant="small">{`${r.sleepStart} to ${r.sleepWake}`}</Text> : null}
            <Text variant="small" color={theme.colors.textLight}>
              {formatDateTime(r.recordedAt)}
            </Text>
          </Card>
        );
      })}
    </Screen>
  );
};

export default VitalHistory;
