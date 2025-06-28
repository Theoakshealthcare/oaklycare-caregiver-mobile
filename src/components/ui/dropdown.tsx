
import { useState } from "react"
import { View, Pressable, Modal, FlatList, StyleSheet, TouchableWithoutFeedback } from "react-native"
import { Feather } from "@expo/vector-icons"
import { theme } from "../../constants/theme"
import Text from "./text"

interface DropdownProps {
  label: string
  value: string
  placeholder: string
  options: string[]
  onSelect: (value: string) => void
  required?: boolean
  error?: string
  containerStyle?: any
  dropdownStyle?: any
}

const Dropdown = ({
  label,
  value,
  placeholder,
  options,
  onSelect,
  required = false,
  error,
  containerStyle,
  dropdownStyle,
}: DropdownProps) => {
  const [visible, setVisible] = useState(false)

  const toggleDropdown = () => {
    setVisible(!visible)
  }

  const handleSelect = (item: string) => {
    onSelect(item)
    setVisible(false)
  }

  const renderItem = ({ item }: { item: string }) => (
    <Pressable style={styles.item} onPress={() => handleSelect(item)}>
      <Text variant="body">{item}</Text>
    </Pressable>
  )

  const renderDropdown = () => {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <Pressable onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dropdown, { top: 50, right: 20, left: 20 }]}>
              <FlatList
                data={options}
                renderItem={renderItem}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    )
  }

  return (
    <View style={containerStyle}>
      <View style={{ flexDirection: "row", }}>
        <Text variant="body">{label}</Text>
        {required && (
          <Text variant="body" color={theme.colors.secondary}>
            {" "}
            *
          </Text>
        )}
      </View>
      <Pressable
        style={[
          {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderWidth: 1,
            borderColor: error ? theme.colors.secondary : theme.colors.border,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: theme.colors.white,
          },
          dropdownStyle,
        ]}
        onPress={toggleDropdown}
      >
        <Text variant="body" color={value ? theme.colors.text : theme.colors.textLight}>
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={20} color={theme.colors.textLight} />
      </Pressable>
      {error && (
        <Text variant="small" color={theme.colors.secondary} style={{ marginTop: 4 }}>
          {error}
        </Text>
      )}
      {renderDropdown()}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  dropdown: {
    position: "absolute",
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 300,
    width: "90%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
})

export default Dropdown
