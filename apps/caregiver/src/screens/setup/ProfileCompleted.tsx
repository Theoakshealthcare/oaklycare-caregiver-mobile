import type React from "react"
import { View, StyleSheet } from "react-native"
import { Feather } from "@expo/vector-icons"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import type { ProfileCompletedProps } from "@/src/types/caregiver.types"

const ProfileCompleted: React.FC<ProfileCompletedProps> = ({ route }) => {
  const { navigation } = Navigation()

  const handleGoToHomepage = () => {
    navigation.navigate("BottomNavigation")
  }

  return (
    <View style={[globalStyles.container, { justifyContent: "center" }]}>
      <Button
        title="Close"
        onPress={() => navigation.goBack()}
        variant="ghost"
        leftIcon={<Feather name="x" size={20} />}
        style={{ position: "absolute", top: 50, left: 20 }}
      />

      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <View style={styles.checkmarkContainer}>
            <Feather name="check" size={40} color="white" />
          </View>
          {/* Decorative elements */}
          <View style={[styles.decorativeCircle, { top: 20, left: -20 }]} />
          <View
            style={[styles.decorativeCircle, { top: -10, right: -30, backgroundColor: theme.colors.success + "40" }]}
          />
          <View style={[styles.decorativePlus, { top: 40, right: 20 }]} />
          <View style={[styles.decorativePlus, { bottom: 30, left: 10 }]} />
          <View style={[styles.decorativeCircle, { bottom: 20, right: 40, width: 15, height: 15 }]} />
        </View>

        <Text variant="h2" weight="bold" color={theme.colors.success} style={{ textAlign: "center", marginTop: 40 }}>
          Profile Setup Completed
        </Text>

        <Text
          variant="body"
          color={theme.colors.textLight}
          style={{ textAlign: "center", marginTop: 16, lineHeight: 24 }}
        >
          Your Profile verification is under review,{"\n"}
          you will be uploaded in 24hrs.
        </Text>
      </View>

      <Button title="Go to Homepage" onPress={handleGoToHomepage} style={{ marginTop: 60 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  successIcon: {
    position: "relative",
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.success,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  decorativeCircle: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.success + "20",
  },
  decorativePlus: {
    position: "absolute",
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
})

export default ProfileCompleted
