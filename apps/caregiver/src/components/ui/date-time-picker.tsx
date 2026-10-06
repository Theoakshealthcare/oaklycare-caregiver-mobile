
import { useState } from "react"
import { View, TouchableOpacity, Modal, Platform, StyleSheet } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { Feather } from "@expo/vector-icons"
import { theme } from "../../constants/theme"
import Text from "./text"

interface DateTimePickerProps {
  label: string
  value: Date | null
  placeholder: string
  onChange: (date: Date | null) => void
  required?: boolean
  error?: string
}

const CustomDateTimePicker = ({
  label,
  value,
  placeholder,
  onChange,
  required = false,
  error,
}: DateTimePickerProps) => {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [tempDate, setTempDate] = useState<Date>(value || new Date())
  const [modalVisible, setModalVisible] = useState(false)

  const formatDate = (date: Date | null) => {
    if (!date) return ""

    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]

    const day = date.getDate()
    const month = months[date.getMonth()]
    const year = date.getFullYear()

    let hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? "pm" : "am"

    hours = hours % 12
    hours = hours ? hours : 12 // the hour '0' should be '12'

    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes

    return `${month} ${day}, ${year} ${hours}:${formattedMinutes} ${ampm}`
  }

  const handlePress = () => {
    if (Platform.OS === "ios") {
      setModalVisible(true)
    } else {
      setShowDatePicker(true)
    }
  }

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false)

      if (event.type === "dismissed") {
        return
      }

      if (selectedDate) {
        setTempDate(selectedDate)
        setShowTimePicker(true)
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate)
      }
    }
  }

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false)

      if (event.type === "dismissed") {
        return
      }

      if (selectedTime) {
        onChange(selectedTime)
      }
    }
  }

  const handleConfirm = () => {
    onChange(tempDate)
    setModalVisible(false)
  }

  const handleCancel = () => {
    setModalVisible(false)
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        <Text variant="body">{label}</Text>
        {required && (
          <Text variant="body" color={theme.colors.secondary}>
            {" "}
            *
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.dropdown, error ? { borderColor: theme.colors.secondary } : null]}
        onPress={handlePress}
      >
        <Text variant="body" color={value ? theme.colors.text : theme.colors.textLight}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Feather name="calendar" size={20} color={theme.colors.textLight} />
      </TouchableOpacity>

      {error && (
        <Text variant="small" color={theme.colors.secondary} style={{ marginTop: 4 }}>
          {error}
        </Text>
      )}

      {/* Android Date Picker */}
      {showDatePicker && Platform.OS === "android" && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Android Time Picker */}
      {showTimePicker && Platform.OS === "android" && (
        <DateTimePicker value={tempDate} mode="time" display="default" onChange={handleTimeChange} />
      )}

      {/* iOS Modal Picker */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancel}>
                <Text variant="body" color={theme.colors.primary}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text variant="body" weight="bold">
                Select Date & Time
              </Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text variant="body" color={theme.colors.primary}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <DateTimePicker
              value={tempDate}
              mode="datetime"
              display="spinner"
              onChange={(event, date) => date && setTempDate(date)}
              minimumDate={new Date()}
              style={{ height: 200 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
})

export default CustomDateTimePicker
