import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";

interface Props extends ScrollViewProps {
  /**
   * Scroll to the bottom each time the keyboard opens, so a primary button under the last field ends up above it
   * (Change password, the visit code step). Leave it off for long forms, where it would push the field being typed
   * in out of view.
   */
  scrollToEndOnKeyboardShow?: boolean;
}

/** Space kept between the field being typed in and the top of the keyboard. */
const FIELD_MARGIN = 24;

/**
 * How far the keyboard covers the bottom of a frame: the frame's bottom edge minus the keyboard's top edge, never
 * negative. If the system already resized the window for the keyboard the frame ends above it and this is 0.
 */
export const keyboardOverlap = (frameBottom: number, keyboardTop: number) => Math.max(0, frameBottom - keyboardTop);

/**
 * The one ScrollView for screens with text inputs, same pattern as the caregiver app (DP1-03).
 *
 * iOS: `automaticallyAdjustKeyboardInsets` makes the scroll view inset itself by the keyboard and scroll the focused
 * field into view.
 *
 * Android: that prop does nothing there, and since the app draws edge to edge the system no longer resizes the
 * window for the keyboard either, so the keyboard sat on top of the lower fields and they could not be scrolled above
 * it. The scroll view is wrapped in a frame that pads its bottom by how far the keyboard covers it, so the scrollable
 * area ends where the keyboard begins, and the focused field is scrolled into that area.
 *
 * Taps on buttons still register with the keyboard open, and dragging dismisses it.
 */
const KeyboardScrollView: React.FC<Props> = ({ scrollToEndOnKeyboardShow, onScroll, ...props }) => {
  const scrollRef = useRef<ScrollView>(null);
  const frameRef = useRef<View>(null);
  const scrollY = useRef(0);
  const [overlap, setOverlap] = useState(0);
  const android = Platform.OS === "android";

  useEffect(() => {
    if (!scrollToEndOnKeyboardShow) return;
    const subscription = Keyboard.addListener("keyboardDidShow", () => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => subscription.remove();
  }, [scrollToEndOnKeyboardShow]);

  useEffect(() => {
    if (!android) return;
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      frameRef.current?.measureInWindow((_x, y, _width, height) => {
        setOverlap(keyboardOverlap(y + height, event.endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [android]);

  // Once the frame has shrunk, bring the field being typed in above the keyboard. Moving focus to another field while
  // the keyboard stays open is handled by the native scroll view, because its visible area already ends at the keyboard.
  useEffect(() => {
    if (!android || overlap === 0 || scrollToEndOnKeyboardShow) return;
    const timer = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput?.();
      if (!input || !frameRef.current) return;
      input.measureInWindow((_x, inputY, _width, inputHeight) => {
        frameRef.current?.measureInWindow((_fx, frameY, _fw, frameHeight) => {
          const visibleBottom = frameY + frameHeight - overlap;
          const hidden = inputY + inputHeight + FIELD_MARGIN - visibleBottom;
          if (hidden > 0) scrollRef.current?.scrollTo({ y: scrollY.current + hidden, animated: true });
        });
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [android, overlap, scrollToEndOnKeyboardShow]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = event.nativeEvent.contentOffset.y;
      onScroll?.(event);
    },
    [onScroll],
  );

  const scroll = (
    <ScrollView
      ref={scrollRef}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      scrollEventThrottle={16}
      {...props}
      onScroll={handleScroll}
    />
  );

  if (!android) return scroll;
  return (
    <View ref={frameRef} testID="keyboard-scroll-frame" style={{ flexGrow: 1, flexShrink: 1, paddingBottom: overlap }}>
      {scroll}
    </View>
  );
};

export default KeyboardScrollView;
