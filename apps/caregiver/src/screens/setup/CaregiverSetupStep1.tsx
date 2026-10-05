"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { View, ScrollView, Alert, TouchableOpacity } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"

import { theme } from "@/src/constants/theme"
import Text from "@/src/components/ui/text"
import Button from "@/src/components/ui/button"
import Input from "@/src/components/ui/input"
import Select from "@/src/components/ui/select"
import HeaderBack from "@/src/components/back/HeaderBack"
import { globalStyles } from "@/src/constants/styles"
import Navigation from "@/src/hooks/use-navigation"
import caregiverService from "@/src/services/caregiver.service"
import type { FormOptions } from "@/src/types/caregiver.types"

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
]

const CaregiverSetupStep1 = () => {
  const { navigation } = Navigation()

  const [formData, setFormData] = useState({
    date_of_birth: "",
    gender: "",
    state: "",
    house_address: "",
    emergency_contact_phone: "",
  })

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [formOptions, setFormOptions] = useState<FormOptions | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadFormOptions()
  }, [])

  const loadFormOptions = async () => {
    try {
      const options:any = await caregiverService.getFormOptions()
      setFormOptions(options)
    } catch (error) {
      console.error("Failed to load form options:", error)
    }
  }

  const updateFormData = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false)
    if (date) {
      setSelectedDate(date)
      const formattedDate = date.toISOString().split("T")[0]
      updateFormData("date_of_birth", formattedDate)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.date_of_birth) {
      newErrors.date_of_birth = "Date of birth is required"
    }

    if (!formData.gender) {
      newErrors.gender = "Gender is required"
    }

    if (!formData.state) {
      newErrors.state = "State is required"
    }

    if (!formData.house_address.trim()) {
      newErrors.house_address = "House address is required"
    }

    if (!formData.emergency_contact_phone.trim()) {
      newErrors.emergency_contact_phone = "Emergency contact is required"
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
      await caregiverService.updateProfileStep1(formData as any)
      navigation.navigate("CaregiverSetupStep2")
    } catch (error: any) {
      Alert.alert("Error", error.detail || "Failed to save profile information")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView>
        <View style={[globalStyles.container, { flex: 1 }]}>
          <HeaderBack />

          <View style={{ marginVertical: "5%" }}>
            <Text variant="h2" weight="bold">
              Set up your Account
            </Text>
            <Text variant="body" color={theme.colors.textLight}>
              Set up your account in 3 steps
            </Text>

            <View style={{ marginTop: 20 }}>
              <Text variant="body" weight="medium">
                Step 1
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
                    width: "33%",
                  }}
                />
              </View>
            </View>
          </View>

          <View style={globalStyles.column}>
            <View>
              <Text variant="body" weight="medium" style={{ marginBottom: 8 }}>
                Date of Birth
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                  borderWidth: 1,
                  borderColor: errors.date_of_birth ? theme.colors.secondary : theme.colors.border,
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  backgroundColor: theme.colors.white,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: errors.date_of_birth ? 0 : 16,
                }}
                activeOpacity={0.7}
              >
                <Text variant="body" color={formData.date_of_birth ? theme.colors.text : theme.colors.textLight}>
                  {formData.date_of_birth ? formData.date_of_birth : "Enter your DOB"}
                </Text>
                <Text>📅</Text>
              </TouchableOpacity>
              {errors.date_of_birth && (
                <Text variant="small" color={theme.colors.secondary} style={{ marginTop: 4 }}>
                  {errors.date_of_birth}
                </Text>
              )}
            </View>

            <Select
              label="Gender"
              placeholder="Select your Gender"
              value={formData.gender}
              onValueChange={(value: any) => updateFormData("gender", value)}
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
                { label: "Other", value: "other" },
              ]}
              error={errors.gender}
            />

            <Select
              label="State"
              placeholder="Select State"
              value={formData.state}
              onValueChange={(value: any) => updateFormData("state", value)}
              options={
                (formOptions?.states && formOptions.states.length > 0
                  ? formOptions.states
                  : NIGERIAN_STATES
                ).map((state) => ({ label: state, value: state }))
              }
              error={errors.state}
            />

            <Input
              label="House Address"
              placeholder="Enter your House Address"
              value={formData.house_address}
              onChangeText={(text) => updateFormData("house_address", text)}
              multiline
              numberOfLines={3}
              error={errors.house_address}
            />

            <Input
              label="Emergency Contact Phone Number"
              placeholder="+234"
              value={formData.emergency_contact_phone}
              onChangeText={(text) => updateFormData("emergency_contact_phone", text)}
              keyboardType="phone-pad"
              error={errors.emergency_contact_phone}
            />

            <Button
              title="Save & Continue"
              onPress={handleSaveAndContinue}
              loading={isLoading}
              style={{ marginTop: 20 }}
            />
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>
      </ScrollView>
    </View>
  )
}

export default CaregiverSetupStep1
