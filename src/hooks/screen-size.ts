import { useWindowDimensions } from "react-native";

const ScreenSize = () => {
  const { height, width } = useWindowDimensions();

  return { height, width };
};

export default ScreenSize;
