import React, { useState } from 'react';
import { theme } from "@/src/constants/theme";
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import FieldLabel from './field-label';
import { Ionicons } from '@expo/vector-icons';

interface SelectOption {
  label: string;
  value: string | number;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string | number;
  onValueChange?: (value: string | number) => void;
  /**
   * Multi-select (service areas): the sheet stays open while areas are toggled, each shows a check, and a
   * Done button closes it. `values` and `onValuesChange` replace `value` and `onValueChange` (DP1-29).
   */
  multiple?: boolean;
  values?: (string | number)[];
  onValuesChange?: (values: (string | number)[]) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  /** Overrides the default 16 pt bottom margin (the setup screens space their fields with a column gap instead). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Field button gets this id; each option is `<testID>-option-<value>`. */
  testID?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  placeholder = 'Select an option',
  options,
  value,
  onValueChange,
  multiple = false,
  values = [],
  onValuesChange,
  error,
  disabled = false,
  required = false,
  containerStyle,
  testID,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(option => option.value === value);
  const isSelected = (option: SelectOption) => (multiple ? values.includes(option.value) : option.value === value);
  const summary = multiple
    ? values.length === 0
      ? undefined
      : values.length <= 2
        ? options.filter(o => values.includes(o.value)).map(o => o.label).join(', ')
        : `${values.length} selected`
    : selectedOption?.label;

  const handleSelect = (option: SelectOption) => {
    if (multiple) {
      onValuesChange?.(values.includes(option.value) ? values.filter(v => v !== option.value) : [...values, option.value]);
      return;
    }
    onValueChange?.(option.value);
    setIsOpen(false);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <FieldLabel>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </FieldLabel>
      )}
      
      <TouchableOpacity
        testID={testID}
        style={[
          styles.selectButton,
          error && styles.selectButtonError,
          disabled && styles.selectButtonDisabled,
        ]}
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <Text style={[
          styles.selectButtonText,
          !summary && styles.placeholderText,
          disabled && styles.disabledText,
        ]}>
          {summary ?? placeholder}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={disabled ? '#999' : '#666'}
        />
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Select Option'}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={testID ? `${testID}-option-${item.value}` : undefined}
                  style={[
                    styles.option,
                    isSelected(item) && styles.selectedOption,
                  ]}
                  onPress={() => handleSelect(item)}
                  accessibilityRole={multiple ? "checkbox" : "button"}
                  accessibilityState={{ checked: isSelected(item) }}
                >
                  <Text style={[
                    styles.optionText,
                    isSelected(item) && styles.selectedOptionText,
                  ]}>
                    {item.label}
                  </Text>
                  {isSelected(item) && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                  )}
                </TouchableOpacity>
              )}
            />
            {multiple ? (
              <TouchableOpacity testID="select-done" style={styles.doneButton} onPress={() => setIsOpen(false)}>
                <Text style={styles.doneText}>
                  {values.length > 0 ? `Done (${values.length} selected)` : 'Done'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  required: {
    color: '#FF3B30',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    minHeight: 48,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 16,
    backgroundColor: '#FFF',
  },
  selectButtonError: {
    borderColor: theme.colors.secondary,
  },
  selectButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E1E1E1',
  },
  selectButtonText: {
    fontSize: theme.sizes.body,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  disabledText: {
    color: '#999',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: theme.sizes.body,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E1E1',
  },
  modalTitle: {
    fontSize: theme.sizes.subtitle,
    fontWeight: '600',
    color: '#333',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  doneButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  doneText: {
    color: '#FFF',
    fontSize: theme.sizes.body,
    fontWeight: '600',
  },
  selectedOption: {
    backgroundColor: '#F0F8FF',
  },
  optionText: {
    fontSize: theme.sizes.body,
    color: '#333',
    flex: 1,
  },
  selectedOptionText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default Select; 