"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, ScrollView, Alert, TouchableOpacity } from "react-native"
import * as DocumentPicker from "expo-document-picker"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import Select from "@/src/components/ui/select"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import caregiverService from "@/src/services/caregiver.service"
import type { CaregiverSetupStep2Props, FormOptions } from "@/src/types/caregiver.types"

const DEFAULT_SPECIALIZATIONS = [
  "General Caregiving", "Elderly Care", "Child Care", "Disability Support", "Nursing", "Companionship"
]
const DEFAULT_WORK_HOURS = [
  "Full-time", "Part-time", "Day shift", "Night shift", "Live-in", "Live-out"
]
const DEFAULT_SERVICE_AREAS = [
  "Lagos", "Abuja", "Port Harcourt", "Kano", "Ibadan", "Kaduna", "Benin City"
]

const CaregiverSetupStep2: React.FC<CaregiverSetupStep2Props> = ({ route }) => {
  const { navigation } = Navigation()

  const [formData, setFormData] = useState({
    specialization: "",
    years_of_experience: 0,
    preferred_work_hours: "",
    service_areas: [] as string[],
  })

  const [formOptions, setFormOptions] = useState<FormOptions | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadFormOptions()
  }, [])

  const loadFormOptions = async () => {
    try {
      const options: any = await caregiverService.getFormOptions()
      setFormOptions(options)
    } catch (error) {
      console.error("Failed to load form options:", error)
    }
  }

  const updateFormData = (field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handleFileUpload = async () => {
    try {
      setIsUploading(true)
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0]
        const uploadResult = await caregiverService.uploadDocument(file, "license")
        setUploadedFiles((prev) => [...prev, uploadResult])
        Alert.alert("Success", "Document uploaded successfully")
      }
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to upload document")
    } finally {
      setIsUploading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.specialization) {
      newErrors.specialization = "Specialization is required"
    }

    if (!formData.years_of_experience || formData.years_of_experience < 1) {
      newErrors.years_of_experience = "Years of experience is required"
    }

    if (!formData.preferred_work_hours) {
      newErrors.preferred_work_hours = "Preferred work hours is required"
    }

    if (formData.service_areas.length === 0) {
      newErrors.service_areas = "At least one service area is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSaveAndContinue = async () => {
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      await caregiverService.updateProfileStep2(formData)
      navigation.navigate("IdentityVerification")
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to save profile information")
    } finally {
      setIsLoading(false)
    }
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
              onValueChange={(value) => updateFormData("specialization", value)}
              options={
                (formOptions?.specializations && formOptions.specializations.length > 0
                  ? formOptions.specializations
                  : DEFAULT_SPECIALIZATIONS
                ).map((spec) => ({ label: spec, value: spec }))
              }
              error={errors.specialization}
            />

            <Select
              label="Select years of Experience"
              placeholder="Select Experience"
              value={formData.years_of_experience.toString()}
              onValueChange={(value: any) => updateFormData("years_of_experience", Number.parseInt(value))}
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
              onValueChange={(value) => updateFormData("preferred_work_hours", value)}
              options={
                (formOptions?.work_hours && formOptions.work_hours.length > 0
                  ? formOptions.work_hours
                  : DEFAULT_WORK_HOURS
                ).map((hour) => ({ label: hour, value: hour }))
              }
              error={errors.preferred_work_hours}
            />

            <Select
              label="Choose Service areas"
              placeholder="Select Service Areas"
              value={formData.service_areas.join(", ")}
              onValueChange={(value: any) => {
                const areas = formData.service_areas.includes(value)
                  ? formData.service_areas.filter((area) => area !== value)
                  : [...formData.service_areas, value]
                updateFormData("service_areas", areas)
              }}
              options={
                (formOptions?.service_areas && formOptions.service_areas.length > 0
                  ? formOptions.service_areas
                  : DEFAULT_SERVICE_AREAS
                ).map((area) => ({ label: area, value: area }))
              }
              // multiple
              error={errors.service_areas}
            />

            <Button
              title="Save & Continue"
              onPress={handleSaveAndContinue}
              loading={isLoading}
              style={{ marginTop: 20 }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

export default CaregiverSetupStep2
