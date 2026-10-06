import { createNavigationContainerRef } from "@react-navigation/native";

import type { ScreenParamLists } from "./Navigations";

/** Lets code outside a screen (push taps, in-app banner) navigate. */
export const navigationRef = createNavigationContainerRef<ScreenParamLists>();
