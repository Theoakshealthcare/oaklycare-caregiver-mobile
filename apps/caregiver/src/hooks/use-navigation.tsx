//'
import { useNavigation } from "@react-navigation/native";
import { NavigationProp } from "../navigation/navigationProps";

const Navigation = () => {
  const navigation = useNavigation<NavigationProp>();
  return { navigation };
};

export default Navigation;
