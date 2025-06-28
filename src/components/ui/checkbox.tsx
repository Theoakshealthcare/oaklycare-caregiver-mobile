import { View, Pressable } from "react-native";
import React from "react";
import { theme } from "@/src/constants/theme";
import Text from "./text";

interface Props {
  onChange: (value: string) => void;
  selected: string;
  value: string
  title: string
}

const Checkbox = ({ onChange, selected, value, title }: Props) => {
  return (
    <Pressable
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
      }}
      onPress={() => onChange(value)}
    >
      <Text variant="body">{title}</Text>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: selected === value ? theme.colors.primary : "transparent",
        }}
      />
    </Pressable>
  );
};

export default Checkbox;
