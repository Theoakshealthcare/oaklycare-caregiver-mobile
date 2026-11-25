import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Keyboard, LayoutAnimation, Platform, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { keyboardOverlap } from "./keyboard-scroll-view";

/**
 * A screen root that keeps its bottom edge (a chat composer) above the keyboard (DP1-03).
 *
 * iOS: pads the bottom by how far the keyboard rises above this view's own bottom edge, read from the keyboard
 * event, not from a measured frame. `KeyboardAvoidingView` measures its frame once on layout, and inside a stack
 * screen that is measured mid-transition, so its padding came out wrong and the composer sat under the keyboard.
 * The app root already insets the home-indicator area, so that part is not padded twice.
 *
 * `outsideAppRoot`: for content in a native `Modal`, which is not inside the root's bottom inset, so iOS does not take it off.
 *
 * Android: the app draws edge to edge, so the system no longer resizes the window for the keyboard, and
 * `KeyboardAvoidingView` (which relies on that) left the chat box under it. The same fix as `KeyboardScrollView`
 * applies: when the keyboard opens, measure how far it covers this view's bottom edge (frame bottom minus keyboard top)
 * and pad by that, so the composer ends where the keyboard begins. If the window was already resized the overlap is 0.
 */
const KeyboardInsetView: React.FC<ViewProps & { outsideAppRoot?: boolean }> = ({ style, outsideAppRoot = false, ...props }) => {
  const safeBottom = useSafeAreaInsets().bottom;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const frameRef = useRef<View>(null);
  const android = Platform.OS === "android";

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

  if (android) {
    return <View ref={frameRef} testID="keyboard-inset-frame" style={[style, { paddingBottom: keyboardHeight }]} {...props} />;
  }
  return <View style={[style, { paddingBottom: Math.max(0, keyboardHeight - (outsideAppRoot ? 0 : safeBottom)) }]} {...props} />;
};

export default KeyboardInsetView;
