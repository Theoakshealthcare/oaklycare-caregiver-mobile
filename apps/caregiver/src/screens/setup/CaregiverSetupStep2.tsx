"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { View, Alert, TouchableOpacity } from "react-native"
import * as DocumentPicker from "expo-document-picker"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view"
import StepIndicator, { ONBOARDING_STEP } from "@/src/components/ui/step-indicator"
import Select from "@/src/components/ui/select"
import FieldLabel from "@/src/components/ui/field-label"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles, FORM_PADDING } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import {
  caregiverService,
  type CaregiverProfileStep2,
  type DocumentUploadResponse,
  type PickedFile,
} from "@/src/services/caregiver.service"
import { useCaregiverProfile, useFormOptions } from "@/src/hooks/queries"
import { messageForError } from "@/src/api/errors"
import { queryKeys } from "@/src/api/keys"
import { kycEnabled } from "@/src/identity/config"

const CaregiverSetupStep2 = () => {
  const { navigation } = Navigation()
  const queryClient = useQueryClient()
  const { data: formOptions } = useFormOptions()
  const { data: profile } = useCaregiverProfile()

  const [formData, setFormData] = useState({
    specialization: "",
    years_of_experience: 0,
    preferred_work_hours: "",
    service_areas: [] as string[],
  })

  // "I apply as": null until the caregiver touches it, so a saved choice (resume or edit) shows until then.
  const [chosenRoles, setChosenRoles] = useState<string[] | null>(null)
  const applyingAs = chosenRoles ?? profile?.applying_as ?? []

  const [uploadedFiles, setUploadedFiles] = useState<DocumentUploadResponse[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (payload: CaregiverProfileStep2) => caregiverService.updateProfileStep2(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.verificationStatus })
      await queryClient.invalidateQueries({ queryKey: queryKeys.caregiverProfile })
      // Onboarding goes on to identity verification (when it is switched on) and then to consent; when an
      // admin asked for changes there is no consent step in this stack, the caregiver returns to the status
      // screen to resubmit.
      const hasConsent = navigation.getState()?.routeNames.includes("ConsentScreen")
      navigation.navigate(hasConsent ? (kycEnabled() ? "IdentityVerification" : "ConsentScreen") : "VerificationStatus")
    },
    onError: (error) => Alert.alert("Error", messageForError(error)),
  })

  const upload = useMutation({
    mutationFn: (file: PickedFile) => caregiverService.uploadDocument(file, "license"),
    onSuccess: (doc) => {
      setUploadedFiles((prev) => [...prev, doc])
      Alert.alert("Uploaded", "Your document was uploaded. An admin will review it.")
    },
    onError: (error) => Alert.alert("Upload failed", messageForError(error)),
  })
  const isUploading = upload.isPending

  const updateFormData = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handleFileUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    })
    const file = result.canceled ? undefined : result.assets[0]
    if (file) upload.mutate({ uri: file.uri, name: file.name, mimeType: file.mimeType })
  }

  const handleSaveAndContinue = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.specialization) newErrors.specialization = "Specialization is required"
    if (!formData.years_of_experience || formData.years_of_experience < 1) {
      newErrors.years_of_experience = "Years of experience is required"
    }
    if (!formData.preferred_work_hours) newErrors.preferred_work_hours = "Preferred work hours is required"
    if (applyingAs.length === 0) newErrors.applying_as = "Select at least one role"
    if (formData.service_areas.length === 0) newErrors.service_areas = "At least one service area is required"
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) save.mutate({ ...formData, applying_as: applyingAs as CaregiverProfileStep2["applying_as"] })
  }

  const experienceOptions = Array.from({ length: 20 }, (_, i) => ({
    label: `${i + 1} year${i > 0 ? "s" : ""}`,
    value: (i + 1).toString(),
  }))

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <KeyboardScrollView>
        <View style={[globalStyles.container, FORM_PADDING, { flex: 1, paddingTop: 16 }]}>
          <HeaderBack />

          <View style={{ marginTop: 22, marginBottom: 14 }}>
            <Text variant="page" weight="bold">
              Set up your Account
            </Text>

            <StepIndicator step={ONBOARDING_STEP.work} />

            <Text variant="h3" weight="bold" style={{ marginTop: 12 }}>
              Work & Experience
            </Text>
          </View>

          <View style={[globalStyles.column, { gap: 22 }]}>
            <Select
              containerStyle={{ marginBottom: 0 }}
              label="Select Specialization"
              placeholder="Select your Specialization"
              value={formData.specialization}
              onValueChange={(value) => updateFormData("specialization", String(value))}
              options={(formOptions?.specializations ?? []).map((spec) => ({ label: spec, value: spec }))}
              error={errors.specialization}
            />

            <Select
              containerStyle={{ marginBottom: 0 }}
              label="Select years of Experience"
              placeholder="Select Experience"
              value={formData.years_of_experience.toString()}
              onValueChange={(value) => updateFormData("years_of_experience", Number.parseInt(String(value), 10))}
              options={experienceOptions}
              error={errors.years_of_experience}
            />

            <Select
              containerStyle={{ marginBottom: 0 }}
              testID="apply-as"
              label="I apply as"
              placeholder="Select your role(s)"
              multiple
              values={applyingAs}
              onValuesChange={(roles) => {
                setChosenRoles(roles.map(String))
                if (errors.applying_as) setErrors((prev) => ({ ...prev, applying_as: "" }))
              }}
              options={(formOptions?.roles ?? []).map((role) => ({ label: role.label, value: role.value }))}
              error={errors.applying_as}
            />

            <View>
              <FieldLabel>Upload License</FieldLabel>
              <TouchableOpacity
                onPress={handleFileUpload}
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.primary,
                  borderStyle: "dashed",
                  borderRadius: 16,
                  minHeight: 48,
                  paddingVertical: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                disabled={isUploading}
              >
                <Text variant="body" color={theme.colors.textLight}>
                  {isUploading ? "Uploading..." : "Upload Certifications"}
                </Text>
              </TouchableOpacity>

              {uploadedFiles.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  {uploadedFiles.map((file, index) => (
                    <Text key={index} variant="small" color={theme.colors.success}>
                      ✓ {file.document_name}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <Select
              containerStyle={{ marginBottom: 0 }}
              label="Select preferred work hours"
              placeholder="Select Work Hours"
              value={formData.preferred_work_hours}
              onValueChange={(value) => updateFormData("preferred_work_hours", String(value))}
              options={(formOptions?.work_hours ?? []).map((hour) => ({ label: hour, value: hour }))}
              error={errors.preferred_work_hours}
            />

            <Select
              containerStyle={{ marginBottom: 0 }}
              label="Choose Service areas"
              placeholder="Select Service Areas"
              multiple
              values={formData.service_areas}
              onValuesChange={(areas) => updateFormData("service_areas", areas.map(String))}
              options={(formOptions?.service_areas ?? []).map((area) => ({ label: area, value: area }))}
              error={errors.service_areas}
            />
            <Button
              title="Save & Continue"
              onPress={handleSaveAndContinue}
              loading={save.isPending}
              style={{ marginTop: 0 }}
            />
          </View>
        </View>
      </KeyboardScrollView>
    </View>
  )
}

export default CaregiverSetupStep2
