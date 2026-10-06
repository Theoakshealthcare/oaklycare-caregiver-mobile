"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { View, ScrollView, TouchableOpacity, Alert } from "react-native"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import { caregiverService } from "@/src/services/caregiver.service"
import { messageForError } from "@/src/api/errors"
import { queryKeys } from "@/src/api/keys"

const ConsentScreen = () => {
  const queryClient = useQueryClient()

  // Consent submits the profile for review. The status then becomes `under_review` and the auth
  // gate replaces this stack with the verification status screen.
  const consent = useMutation({
    mutationFn: () => caregiverService.updateConsent(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.verificationStatus }),
    onError: (error) => Alert.alert("Error", messageForError(error)),
  })

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

            <Button title="Give Consent and Submit" onPress={() => consent.mutate()} loading={consent.isPending} style={{ marginTop: 40 }} />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default ConsentScreen
