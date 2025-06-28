import { View, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../../constants/theme";
import Box from "../../components/ui/box";
import Text from "../../components/ui/text";
import Button from "../../components/ui/button";
import Icon from "../../components/ui/icon";
import Navigation from "@/src/hooks/use-navigation";
import { globalStyles } from "@/src/constants/styles";
import Image from "@/src/components/ui/image";
import ScreenSize from "@/src/hooks/screen-size";
import { Done } from "@/src/components/ui/done";

const AccountCreated = () => {
  const { navigation } = Navigation();
  const { width } = ScreenSize();

  const handleStartJourney = () => {
    navigation.navigate("BottomNavigation");
  };

  return (
    <View style={[globalStyles.container, {flex: 1}]}>
      <Pressable
        onPress={() => navigation.navigate("BottomNavigation")}
        style={globalStyles.row}
      >
        <Icon name="close-circle-outline" size={24} />
        <Text>Close</Text>
      </Pressable>

      <Box flex={1} center style={{gap: theme.sizes.xxl}}>
        <Done />

        <Text
          variant="h2"
          weight="bold"
          color={theme.colors.primary}
          center
          style={styles.title}
        >
          Congratulations! Your account setup is complete!
        </Text>

        <Text
          variant="body"
          color={theme.colors.textLight}
          center
          style={styles.subtitle}
        >
          Account successfully created! Welcome aboard! Let the nursing journey
          begin!
        </Text>

        <Button
          title="Start Booking Journey"
          onPress={handleStartJourney}
          style={styles.button}
        />
      </Box>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: 24,
  },
  header: {
    marginTop: 20,
    marginBottom: 24,
  },
  content: {
    gap: 24,
  },
  successCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(22, 130, 131, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 32,
  },
  button: {
    width: "100%",
    borderRadius: 30,
  },
});

export default AccountCreated;
