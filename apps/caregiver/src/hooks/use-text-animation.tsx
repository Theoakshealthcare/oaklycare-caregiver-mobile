import { useEffect } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const useTextAnimation = () => {
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(10);

  // Animate text on mount
  useEffect(() => {
    textOpacity.value = withTiming(1, { duration: 500 });
    textTranslateY.value = withTiming(0, { duration: 500 });
  }, []);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return { textStyle, textOpacity, textTranslateY };
};

export default useTextAnimation;
