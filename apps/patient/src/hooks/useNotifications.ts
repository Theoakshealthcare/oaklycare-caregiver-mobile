import { sampleNotifications } from "@/src/fixtures/notifications";

import { useFixtureQuery } from "./fixture";

/** Sample feed until the notifications slice reads the patient feed. */
export function useNotifications() {
  return useFixtureQuery(["notifications"], () => sampleNotifications());
}
