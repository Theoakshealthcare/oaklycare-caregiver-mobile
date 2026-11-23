import { Pressable } from "react-native";
import { theme } from "@/src/constants/theme";
import React from "react";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import Icon from "../ui/icon";
import Text from "../ui/text";
import { globalStyles } from "@/src/constants/styles";

interface Props {
  /**
   * What Back does on the first screen of a stack, where there is no history to go back to (Login on a relaunch, setup
   * step 1). Without it the screen draws no Back link at all.
   */
  onFallback?: () => void;
}

const HeaderBack: React.FC<Props> = ({ onFallback }) => {
  const navigation = useNavigation();
  // Read from this navigator's own state (it re-renders when that changes), not from `navigation.canGoBack()` at render
  // time: right after a sign-out the new signed-out stack briefly reports the old stack's history, which drew a Back arrow on
  // Login that did nothing ("The action 'GO_BACK' was not handled"). A screen that is first in its stack has nowhere to go
  // back to (Login after a sign-out, onboarding step 1 after a relaunch).
  const hasHistory = useNavigationState((state) => state.index > 0);

  if (!hasHistory && !onFallback) return null;

  return (
    <Pressable onPress={() => (hasHistory ? navigation.goBack() : onFallback?.())} style={globalStyles.row}>
      <Icon name="chevron-back" size={24} />
      <Text style={{ fontSize: theme.sizes.body }}>Back</Text>
    </Pressable>
  );
};

export default HeaderBack;
