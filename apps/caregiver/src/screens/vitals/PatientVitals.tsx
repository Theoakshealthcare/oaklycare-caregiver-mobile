import React from "react";
import type { StackScreenProps } from "@react-navigation/stack";

import type { ScreenParamLists } from "@/src/navigation/Navigations";

import Vitals from "./Vitals";

type Props = StackScreenProps<ScreenParamLists, "PatientVitals">;

/**
 * The vitals of one patient, pushed on top of the screen that asked (the client profile's "View all"),
 * so Back returns there instead of to a tab (DP1-30).
 */
const PatientVitals: React.FC<Props> = ({ route, navigation }) => (
  <Vitals patientId={route.params.patientId} onBack={() => navigation.goBack()} />
);

export default PatientVitals;
