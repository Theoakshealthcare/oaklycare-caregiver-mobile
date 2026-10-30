"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { View, ScrollView, Alert, TouchableOpacity } from "react-native"
import * as DocumentPicker from "expo-document-picker"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import Select from "@/src/components/ui/select"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import {
  caregiverService,
  type CaregiverProfileStep2,
  type DocumentUploadResponse,
  type PickedFile,
} from "@/src/services/caregiver.service"
import { useFormOptions } from "@/src/hooks/queries"
import { messageForError } from "@/src/api/errors"
import { queryKeys } from "@/src/api/keys"
import { kycEnabled } from "@/src/identity/config"

const CaregiverSetupStep2 = () => {
  const { navigation } = Navigation()
  const queryClient = useQueryClient()
  const { data: formOptions } = useFormOptions()

  const [formData, setFormData] = useState({
    specialization: "",
    years_of_experience: 0,
    preferred_work_hours: "",
    service_areas: [] as string[],
  })

  const [uploadedFiles, setUploadedFiles] = useState<DocumentUploadResponse[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (payload: CaregiverProfileStep2) => caregiverService.updateProfileStep2(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.verificationStatus })
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
    if (formData.service_areas.length === 0) newErrors.service_areas = "At least one service area is required"
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) save.mutate(formData)
  }

  const experienceOptions = Array.from({ length: 20 }, (_, i) => ({
    label: `${i + 1} year${i > 0 ? "s" : ""}`,
    value: (i + 1).toString(),
  }))

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView>
        <View style={[globalStyles.container, { flex: 1 }]}>
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
              Work & Experience
            </Text>
          </View>

          <View style={globalStyles.column}>
            <Select
              label="Select Specialization"
              placeholder="Select your Specialization"
              value={formData.specialization}
              onValueChange={(value) => updateFormData("specialization", String(value))}
              options={(formOptions?.specializations ?? []).map((spec) => ({ label: spec, value: spec }))}
              error={errors.specialization}
            />

            <Select
              label="Select years of Experience"
              placeholder="Select Experience"
              value={formData.years_of_experience.toString()}
              onValueChange={(value) => updateFormData("years_of_experience", Number.parseInt(String(value), 10))}
              options={experienceOptions}
              error={errors.years_of_experience}
            />

            <View style={{ marginBottom: 20 }}>
              <Text variant="body" weight="medium" style={{ marginBottom: 8 }}>
                Upload License
              </Text>
              <TouchableOpacity
                onPress={handleFileUpload}
                style={{
                  borderWidth: 2,
                  borderColor: theme.colors.primary,
                  borderStyle: "dashed",
                  borderRadius: 8,
                  padding: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.colors.background,
                }}
                disabled={isUploading}
              >
                <Text variant="body" color={theme.colors.primary}>
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
              label="Select preferred work hours"
              placeholder="Select Work Hours"
              value={formData.preferred_work_hours}
              onValueChange={(value) => updateFormData("preferred_work_hours", String(value))}
              options={(formOptions?.work_hours ?? []).map((hour) => ({ label: hour, value: hour }))}
              error={errors.preferred_work_hours}
            />

            <Select
              label="Choose Service areas"
              placeholder="Select Service Areas"
              value={formData.service_areas.join(", ")}
              onValueChange={(value) => {
                const area = String(value)
                const areas = formData.service_areas.includes(area)
                  ? formData.service_areas.filter((a) => a !== area)
                  : [...formData.service_areas, area]
                updateFormData("service_areas", areas)
              }}
              options={(formOptions?.service_areas ?? []).map((area) => ({ label: area, value: area }))}
              error={errors.service_areas}
            />
            {formData.service_areas.length > 0 && (
              <Text variant="small" color={theme.colors.primary}>
                Selected: {formData.service_areas.join(", ")} (tap an area again to remove it)
              </Text>
            )}

            <Button
              title="Save & Continue"
              onPress={handleSaveAndContinue}
              loading={save.isPending}
              style={{ marginTop: 20 }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default CaregiverSetupStep2
