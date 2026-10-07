import { Pressable } from "react-native";
import { theme } from "@/src/constants/theme";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import Icon from "../ui/icon";
import Text from "../ui/text";
import { globalStyles } from "@/src/constants/styles";

const HeaderBack = () => {
  const navigation = useNavigation();

  // The first screen of a flow (e.g. onboarding step 1 after a relaunch) has nowhere to go back to.
  if (!navigation.canGoBack()) return null;

  return (
    <Pressable onPress={() => navigation.goBack()} style={globalStyles.row}>
      <Icon name="chevron-back" size={24} />
      <Text style={{ fontSize: theme.sizes.body }}>Back</Text>
    </Pressable>
  );
};

export default HeaderBack;
