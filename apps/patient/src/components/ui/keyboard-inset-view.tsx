import React, { useEffect, useState } from "react";
import { Dimensions, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A screen root that keeps its bottom edge (the chat composer) above the keyboard, same pattern as the caregiver app
 * (DP1-03). iOS pads the bottom by how far the keyboard rises above this view's own bottom edge, read from the
 * keyboard event rather than a measured frame (`KeyboardAvoidingView` measures once, mid stack transition, and came
 * out wrong). The app root already insets the home-indicator area, so that part is not padded twice. Other
 * platforms keep `KeyboardAvoidingView`. Not yet device-checked in this app.
 */
const KeyboardInsetView: React.FC<ViewProps> = ({ style, ...props }) => {
  const safeBottom = useSafeAreaInsets().bottom;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(event.duration || 250, "keyboard", "opacity"));
      setKeyboardHeight(Math.max(0, Dimensions.get("window").height - event.endCoordinates.screenY));
    });
    return () => change.remove();
  }, []);

  if (Platform.OS !== "ios") {
    return <KeyboardAvoidingView style={style} behavior="height" {...props} />;
  }
  return <View style={[style, { paddingBottom: Math.max(0, keyboardHeight - safeBottom) }]} {...props} />;
};

export default KeyboardInsetView;
