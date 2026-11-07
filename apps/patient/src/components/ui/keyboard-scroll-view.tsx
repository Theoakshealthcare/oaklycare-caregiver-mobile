import React, { useEffect, useRef } from "react";
import { Keyboard, Platform, ScrollView, type ScrollViewProps } from "react-native";

interface Props extends ScrollViewProps {
  /**
   * Scroll to the bottom each time the keyboard opens, so a primary button under the last field ends up above it.
   * Leave it off for long forms, where it would push the field being typed in out of view.
   */
  scrollToEndOnKeyboardShow?: boolean;
}

/**
 * The one ScrollView for screens with text inputs, same pattern as the caregiver app (DP1-03). On iOS
 * `automaticallyAdjustKeyboardInsets` makes the scroll view inset itself by the keyboard and scroll the focused field
 * into view. Taps on buttons still register with the keyboard open, and dragging dismisses it.
 * Android: unverified, see the caregiver DP1-03 SOP. Not yet device-checked in this app.
 */
const KeyboardScrollView: React.FC<Props> = ({ scrollToEndOnKeyboardShow, ...props }) => {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    if (!scrollToEndOnKeyboardShow) return;
    const subscription = Keyboard.addListener("keyboardDidShow", () => ref.current?.scrollToEnd({ animated: true }));
    return () => subscription.remove();
  }, [scrollToEndOnKeyboardShow]);

  return (
    <ScrollView
      ref={ref}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      {...props}
    />
  );
};

export default KeyboardScrollView;
