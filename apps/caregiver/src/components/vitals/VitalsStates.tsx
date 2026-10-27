import React from "react";

import { EmptyState } from "@/src/components/account/StateViews";
import { VITALS_UNAVAILABLE_HINT, VITALS_UNAVAILABLE_TITLE } from "@/src/vitals/vitalsModel";

/** Shown when the backend refuses vitals (403) or the visit has not started: never worked around. */
export const VitalsUnavailable: React.FC = () => (
  <EmptyState icon="clock" title={VITALS_UNAVAILABLE_TITLE} hint={VITALS_UNAVAILABLE_HINT} />
);

export const NoActiveVisit: React.FC = () => (
  <EmptyState
    icon="heart"
    title="No active visit"
    hint="Vitals appear here while you are on a visit. Accept a job and start the visit to record readings."
  />
);
