import { Pressable } from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import Icon from "../ui/icon";
import Text from "../ui/text";
import { globalStyles } from "@/src/constants/styles";

const HeaderBack = () => {
  const navigation = useNavigation();

  return (
    <Pressable onPress={() => navigation.goBack()} style={globalStyles.row}>
      <Icon name="chevron-back" size={24} />
      <Text style={{ fontSize: 16 }}>Back</Text>
    </Pressable>
  );
};

export default HeaderBack;
