"use client"

import type React from "react"
import { useState } from "react"
import { View, TouchableOpacity, Alert } from "react-native"
import { Feather } from "@expo/vector-icons"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import caregiverService from "@/src/services/caregiver.service"
import type { IdentityVerificationProps } from "@/src/types/caregiver.types"

const IdentityVerification = () => {
  const { navigation } = Navigation()
  const [isLoading, setIsLoading] = useState(false)
  const [verificationData, setVerificationData] = useState<any>(null)

  const handleDocumentScan = async () => {
    try {
      setIsLoading(true)
      const result: any = await caregiverService.initiateIdentityVerification()
      setVerificationData(result)

      // Navigate to document scan screen with Onfido data
      navigation.navigate("DocumentScan", {
        applicant_id: result.applicant_id,
        sdk_token: result.sdk_token,
      })
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to initiate identity verification")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFaceScan = () => {
    if (!verificationData) {
      Alert.alert("Error", "Please complete document scan first")
      return
    }

    // Navigate to face scan (this would integrate with Onfido SDK)
    navigation.navigate("FaceScan", {
      applicant_id: verificationData.applicant_id,
      sdk_token: verificationData.sdk_token,
    })
  }

  const handleSaveAndContinue = async () => {
    if (!verificationData) {
      Alert.alert("Error", "Please complete identity verification steps")
      return
    }

    try {
      setIsLoading(true)
      await caregiverService.completeIdentityVerification()
      navigation.navigate("ConsentScreen")
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to complete verification")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={globalStyles.container}>
      <HeaderBack />

      <View style={{ marginVertical: "5%" }}>
        <Text variant="h2" weight="bold">
          Set up your Account
        </Text>

        <View style={{ marginTop: 20 }}>
          <Text variant="body" weight="medium">
            Step 2
          </Text>
          <View
            style={{
              height: 4,
              backgroundColor: theme.colors.border,
              borderRadius: 2,
              marginTop: 8,
            }}
          >
            <View
              style={{
                height: 4,
                backgroundColor: theme.colors.primary,
                borderRadius: 2,
                width: "66%",
              }}
            />
          </View>
        </View>

        <Text variant="h3" weight="bold" style={{ marginTop: 20 }}>
          Identity Verification
        </Text>
      </View>

      <View style={globalStyles.column}>
        <View style={{ marginBottom: 20 }}>
          <Text variant="body" weight="medium" style={{ marginBottom: 12 }}>
            Scan identification
          </Text>
          <TouchableOpacity
            onPress={handleDocumentScan}
            style={{
              borderWidth: 1,
              borderColor: theme.colors.primary,
              borderRadius: 25,
              paddingVertical: 16,
              paddingHorizontal: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            disabled={isLoading}
          >
            <Text variant="body" color={theme.colors.textLight}>
              National ID, Passport, or Driver&apos;s License
            </Text>
            <Feather name="chevron-right" size={20} color={theme.colors.textLight} />
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 40 }}>
          <Text variant="body" weight="medium" style={{ marginBottom: 12 }}>
            Face Scan Verification
          </Text>
          <TouchableOpacity
            onPress={handleFaceScan}
            style={{
              borderWidth: 1,
              borderColor: verificationData ? theme.colors.primary : theme.colors.border,
              borderRadius: 25,
              paddingVertical: 16,
              paddingHorizontal: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: verificationData ? 1 : 0.5,
            }}
            disabled={!verificationData}
          >
            <Text variant="body" color={theme.colors.textLight}>
              Turn on your Camera
            </Text>
            <Feather name="chevron-right" size={20} color={theme.colors.textLight} />
          </TouchableOpacity>
        </View>

        <Button
          title="Save & Continue"
          onPress={handleSaveAndContinue}
          loading={isLoading}
          disabled={!verificationData}
          style={{
            marginTop: "auto",
            backgroundColor: verificationData ? theme.colors.primary : theme.colors.border,
          }}
        />
      </View>
    </View>
  )
}

export default IdentityVerification
