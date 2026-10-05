import { Pressable, View } from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import Icon from "../ui/icon";
import Text from "../ui/text";
import { globalStyles } from "@/src/constants/styles";
import { platform } from "@/src/constants/platform";
import { theme } from "@/src/constants/theme";

interface Props {
  title?: string
}

export const Header = ({title}:Props) => {
  const navigation = useNavigation();

  return (
    <View style={[globalStyles.row, {width:'100%'}]}>
      <Pressable onPress={() => navigation.goBack()} style={{flex: 1}}>
        <Icon name={platform.isIOS ? "chevron-back" : "arrow-back"} size={24} />
      </Pressable>
      <Text style={{textAlign:'center', flex: 1, fontSize: theme.sizes.extraLarge}} variant="body" weight="bold">{title}</Text>
      <View style={{flex: 1}} />
    </View>
  );
};
