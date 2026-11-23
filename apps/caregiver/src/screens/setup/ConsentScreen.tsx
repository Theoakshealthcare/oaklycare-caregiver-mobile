"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { View, Alert } from "react-native"

import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import LegalLink from "@/src/components/ui/legal-link"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import { caregiverService } from "@/src/services/caregiver.service"
import { messageForError } from "@/src/api/errors"
import { queryKeys } from "@/src/api/keys"
import { markSetupSubmitted } from "@/src/onboarding/setupSubmitted"

/** The Figma terms line says "By tapping Get Started"; change this one word if the owner decides it should name the button. */
export const CONSENT_TERMS_ACTION = "Get Started"

const ConsentScreen = () => {
  const queryClient = useQueryClient()

  // Consent submits the profile for review, so the status becomes `under_review` and the auth gate replaces this
  // stack. The "Profile Setup Completed" page is raised first so the caregiver sees it before the status screen.
  const consent = useMutation({
    mutationFn: () => caregiverService.updateConsent(),
    onSuccess: () => {
      markSetupSubmitted()
      return queryClient.invalidateQueries({ queryKey: queryKeys.verificationStatus })
    },
    onError: (error) => Alert.alert("Error", messageForError(error)),
  })

  return (
    <View style={[globalStyles.container, { flex: 1 }]}>
      <HeaderBack />

      <View style={{ marginVertical: "10%" }}>
        <Text variant="h2" weight="bold">
          Background Checks & Data Usage Consent
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: "space-between" }}>
        <Text variant="small" style={{ lineHeight: 20 }}>
          {`By tapping ${CONSENT_TERMS_ACTION}, you agree to our `}
          <LegalLink page="terms">Terms of Services</LegalLink>
          {". Learn how we process your data in our "}
          <LegalLink page="privacy">Privacy Policy</LegalLink>
          {" and "}
          <LegalLink page="cookies">Cookies Policy</LegalLink>
        </Text>

        <Button title="Give Consent" onPress={() => consent.mutate()} loading={consent.isPending} />
      </View>
    </View>
  )
}

export default ConsentScreen
