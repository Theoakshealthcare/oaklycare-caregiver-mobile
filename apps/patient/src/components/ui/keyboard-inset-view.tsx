import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Keyboard, LayoutAnimation, Platform, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { keyboardOverlap } from "./keyboard-scroll-view";

/**
 * A screen root that keeps its bottom edge (the chat composer) above the keyboard, same pattern as the caregiver app
 * (DP1-03).
 *
 * iOS pads the bottom by how far the keyboard rises above this view's own bottom edge, read from the keyboard event rather
 * than a measured frame (`KeyboardAvoidingView` measures once, mid stack transition, and came out wrong). The app root already
 * insets the home-indicator area, so that part is not padded twice.
 *
 * Android: the app draws edge to edge, so the system no longer resizes the window for the keyboard (`adjustResize` has no
 * effect) and `KeyboardAvoidingView` has nothing to react to: the keyboard sat on top of the message box and the person could
 * not see what they typed. Here the view measures its own frame when the keyboard opens and pads the bottom by how far the
 * keyboard covers it (the same measurement `KeyboardScrollView` uses), so the composer ends where the keyboard begins.
 */
const KeyboardInsetView: React.FC<ViewProps> = ({ style, ...props }) => {
  const safeBottom = useSafeAreaInsets().bottom;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const frameRef = useRef<View>(null);
  const android = Platform.OS === "android";

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const change = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(event.duration || 250, "keyboard", "opacity"));
      setKeyboardHeight(Math.max(0, Dimensions.get("window").height - event.endCoordinates.screenY));
    });
    return () => change.remove();
  }, []);

  useEffect(() => {
    if (!android) return;
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      frameRef.current?.measureInWindow((_x, y, _width, height) => {
        setKeyboardHeight(keyboardOverlap(y + height, event.endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [android]);

  if (android) {
    return <View ref={frameRef} testID="keyboard-inset-frame" style={[style, { paddingBottom: keyboardHeight }]} {...props} />;
  }
  if (Platform.OS !== "ios") return <View style={style} {...props} />;
  return <View style={[style, { paddingBottom: Math.max(0, keyboardHeight - safeBottom) }]} {...props} />;
};

export default KeyboardInsetView;
