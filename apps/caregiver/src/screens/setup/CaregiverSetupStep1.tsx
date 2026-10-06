"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { caregiverService, type CaregiverProfileStep1 } from "@/src/services/caregiver.service"
import { useFormOptions } from "@/src/hooks/queries"
import { messageForError } from "@/src/api/errors"
import { queryKeys } from "@/src/api/keys"

type Gender = CaregiverProfileStep1["gender"]

// Fallback only until GET /caregiver/form-options answers.
const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Federal Capital Territory", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
]

const CaregiverSetupStep1 = () => {
  const { navigation } = Navigation()
  const queryClient = useQueryClient()
  const { data: formOptions } = useFormOptions()

  const [formData, setFormData] = useState({
    date_of_birth: "",
    gender: "" as Gender | "",
    state: "",
    address: "",
    emergency_contact_phone: "",
  })

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (payload: CaregiverProfileStep1) => caregiverService.updateProfileStep1(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.verificationStatus })
      navigation.navigate("CaregiverSetupStep2")
    },
    onError: (error) => Alert.alert("Error", messageForError(error)),
  })

  const updateFormData = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handleDateChange = (_event: unknown, date?: Date) => {
    setShowDatePicker(false)
    if (date) {
      setSelectedDate(date)
      updateFormData("date_of_birth", date.toISOString().split("T")[0])
    }
  }

  const handleSaveAndContinue = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.date_of_birth) newErrors.date_of_birth = "Date of birth is required"
    if (!formData.gender) newErrors.gender = "Gender is required"
    if (!formData.state) newErrors.state = "State is required"
    if (!formData.address.trim()) newErrors.address = "House address is required"
    if (!formData.emergency_contact_phone.trim()) newErrors.emergency_contact_phone = "Emergency contact is required"
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0 || !formData.gender) return

    save.mutate({
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      state: formData.state,
      address: formData.address.trim(),
      emergency_contact_phone: formData.emergency_contact_phone.trim(),
    })
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
              onValueChange={(value) => updateFormData("gender", String(value))}
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
              onValueChange={(value) => updateFormData("state", String(value))}
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
              value={formData.address}
              onChangeText={(text) => updateFormData("address", text)}
              multiline
              numberOfLines={3}
              error={errors.address}
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
              loading={save.isPending}
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
