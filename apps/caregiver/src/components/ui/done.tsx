import { View } from "react-native";
import React from "react";
import Image from "./image";
import ScreenSize from "@/src/hooks/screen-size";

export const Done = () => {
  const { width } = ScreenSize();

  return (
    <View
      style={{
        width: width * 0.4,
        height: width * 0.4,
        borderRadius: 100,
        backgroundColor: "rgba(22, 130, 131, 0.1)",
      }}
    >
      <View style={{ height: "100%", width: "100%" }}>
        <Image source={require("@/assets/images/gifs/success.gif")} />
      </View>
    </View>
  );
};
