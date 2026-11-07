import React, { useEffect, useState } from "react";
import { Dimensions, Keyboard, KeyboardAvoidingView, LayoutAnimation, Platform, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A screen root that keeps its bottom edge (a chat composer) above the keyboard (DP1-03).
 *
 * iOS: pads the bottom by how far the keyboard rises above this view's own bottom edge, read from the keyboard
 * event, not from a measured frame. `KeyboardAvoidingView` measures its frame once on layout, and inside a stack
 * screen that is measured mid-transition, so its padding came out wrong and the composer sat under the keyboard.
 * The app root already insets the home-indicator area, so that part is not padded twice.
 * Other platforms keep `KeyboardAvoidingView`.
 */
const KeyboardInsetView: React.FC<ViewProps> = ({ style, ...props }) => {
  const safeBottom = useSafeAreaInsets().bottom;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    // `height` stays the keyboard's full height even when it slides away, so use how far its top edge sits
    // above the bottom of the window (0 once hidden).
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
