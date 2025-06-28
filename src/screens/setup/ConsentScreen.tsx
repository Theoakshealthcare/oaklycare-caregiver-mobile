"use client"

import type React from "react"
import { useState } from "react"
import { View, ScrollView, TouchableOpacity, Alert } from "react-native"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import caregiverService from "@/src/services/caregiver.service"
import type { ConsentScreenProps } from "@/src/types/caregiver.types"

const ConsentScreen: React.FC<ConsentScreenProps> = ({ route }) => {
  const { navigation } = Navigation()
  const [isLoading, setIsLoading] = useState(false)

  const handleGiveConsent = async () => {
    try {
      setIsLoading(true)

      const consentData = {
        terms_accepted: true,
        privacy_policy_accepted: true,
        background_check_consent: true,
      }

      await caregiverService.updateConsent(consentData)
      navigation.navigate("ProfileCompleted")
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to save consent")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView>
        <View style={[globalStyles.container, { flex: 1 }]}>
          <HeaderBack />

          <View style={{ marginVertical: "10%" }}>
            <Text variant="h2" weight="bold">
              Background Checks & Data Usage Consent
            </Text>
          </View>

          <View style={{ flex: 1, justifyContent: "space-between" }}>
            <View>
              <Text variant="body" style={{ lineHeight: 24 }}>
                By tapping Get Started, you agree to our{" "}
                <Text variant="body" color={theme.colors.primary}>
                  Terms of Services
                </Text>
                . Learn how we process your data in our{" "}
                <TouchableOpacity>
                  <Text variant="body" color={theme.colors.primary} style={{ textDecorationLine: "underline" }}>
                    Privacy Policy
                  </Text>
                </TouchableOpacity>{" "}
                and{" "}
                <TouchableOpacity>
                  <Text variant="body" color={theme.colors.primary} style={{ textDecorationLine: "underline" }}>
                    Cookies Policy
                  </Text>
                </TouchableOpacity>
              </Text>

              <View style={{ marginTop: 30 }}>
                <Text variant="body" style={{ lineHeight: 24 }}>
                  We will conduct background checks as part of our verification process to ensure the safety and
                  security of our platform users.
                </Text>
              </View>

              <View style={{ marginTop: 20 }}>
                <Text variant="body" style={{ lineHeight: 24 }}>
                  Your personal information will be processed in accordance with applicable data protection laws and our
                  privacy policy.
                </Text>
              </View>
            </View>

            <Button title="Give Consent" onPress={handleGiveConsent} loading={isLoading} style={{ marginTop: 40 }} />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default ConsentScreen
