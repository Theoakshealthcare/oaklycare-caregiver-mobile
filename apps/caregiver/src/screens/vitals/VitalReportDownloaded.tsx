import React, { useEffect, useRef } from "react";
import { Alert, Pressable, View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import Icon from "@/src/components/ui/icon";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { shareVitalsReport } from "@/src/vitals/report";
import { dropReport, heldReport } from "@/src/vitals/reportStore";

type Props = StackScreenProps<ScreenParamLists, "VitalReportDownloaded">;

export const REPORT_DOWNLOADED_TITLE = "Vital Report Downloaded Successfully";

/**
 * The full page after "Download Report" (Figma "Vital - report downloaded"): the shared success look and Share Report, which
 * opens the phone's share sheet on the report held in memory. Close returns to the Vitals tab; the report is dropped when the
 * page goes.
 */
const VitalReportDownloaded: React.FC<Props> = ({ route }) => {
  const { patientId } = route.params;
  const { navigation } = useNavigation();
  const csv = useRef(heldReport(patientId));

  useEffect(() => dropReport, []);

  const share = async () => {
    if (csv.current === null) {
      Alert.alert("Couldn't share the report", "The report is no longer available. Go back and download it again.");
      return;
    }
    try {
      await shareVitalsReport(csv.current);
    } catch (error) {
      Alert.alert("Couldn't share the report", error instanceof Error ? error.message : messageForError(error));
    }
  };

  return (
    <View style={[globalStyles.container, { flex: 1 }]}>
      <Pressable testID="report-close" onPress={() => navigation.goBack()} style={globalStyles.row} accessibilityRole="button" accessibilityLabel="Close">
        <Icon name="close-circle-outline" size={24} />
        <Text>Close</Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: "center", paddingTop: theme.spacing.xxl }}>
        <SuccessIllustration />
        <View style={{ marginTop: 32, paddingHorizontal: theme.spacing.lg }}>
          <Text variant="page" weight="bold" color={theme.colors.successTitle} center testID="report-title">
            {REPORT_DOWNLOADED_TITLE}
          </Text>
        </View>
      </View>

      <Button testID="report-share" title="Share Report" onPress={() => void share()} style={{ width: "100%", minHeight: 52, borderRadius: 26 }} />
    </View>
  );
};

export default VitalReportDownloaded;
