import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import FieldLabel from "@/src/components/ui/field-label";
import { FIELD_RADIUS } from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { Bank } from "@/src/services/wallet.service";
import { filterBanks } from "@/src/wallet/walletModel";

interface Props {
  banks: Bank[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  value: Bank | null;
  onChange: (bank: Bank) => void;
  invalid?: string;
}

/** A searchable bank list in a modal (the real Paystack list has a couple of hundred banks). */
const BankPicker: React.FC<Props> = ({ banks, loading, error, onRetry, value, onChange, invalid }) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterBanks(banks ?? [], query), [banks, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <FieldLabel>Select Bank</FieldLabel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose Bank"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 14,
          borderRadius: FIELD_RADIUS,
          borderWidth: 1,
          borderColor: invalid ? theme.colors.error : theme.colors.primary,
        }}
      >
        <Text variant="body" color={value ? undefined : theme.colors.textLight}>
          {value ? value.name : "Choose Bank"}
        </Text>
        <Feather name="chevron-down" size={18} color={theme.colors.text} />
      </Pressable>
      {invalid ? (
        <Text variant="small" color={theme.colors.error} style={{ marginTop: 4 }}>
          {invalid}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        {/* Figma: a white card over a dimmed page, with Close at its top left. It starts below the device's top inset, high enough for the keyboard not to cover the list. */}
        <View
          testID="bank-picker"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: theme.spacing.md, paddingTop: insets.top + 60, paddingBottom: theme.spacing.md }}
        >
          <View style={{ flexShrink: 1, backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.xxl, padding: theme.spacing.md }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close bank list"
              onPress={close}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, alignSelf: "flex-start" }}
            >
              <Feather name="x-circle" size={18} color={theme.colors.text} />
              <Text variant="small">Close</Text>
            </Pressable>
            <Text variant="body" weight="bold" center style={{ marginBottom: 12 }}>
              Select Bank
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 14,
                borderRadius: FIELD_RADIUS,
                backgroundColor: theme.colors.soft,
                marginBottom: 8,
              }}
            >
              <Feather name="search" size={18} color={theme.colors.textLight} />
              <TextInput
                placeholder="Search bank"
                placeholderTextColor={theme.colors.textLight}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                style={{ flex: 1, paddingVertical: 14, fontFamily: theme.fonts.regular, fontSize: theme.sizes.body, color: theme.colors.text }}
              />
            </View>
            {error && !banks ? (
              <ErrorState error={error} onRetry={onRetry} />
            ) : loading || !banks ? (
              <LoadingState testID="banks-loading" />
            ) : shown.length === 0 ? (
              <Text variant="small" color={theme.colors.textLight} center style={{ marginTop: 16 }}>
                No bank matches your search.
              </Text>
            ) : (
              <FlatList
                data={shown}
                keyExtractor={(b) => b.code}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onChange(item);
                      close();
                    }}
                    style={{
                      paddingVertical: 14,
                      borderRadius: theme.borderRadius.lg,
                      backgroundColor: value?.code === item.code ? theme.colors.primaryLight : "transparent",
                    }}
                  >
                    <Text variant="body" center weight={value?.code === item.code ? "medium" : "regular"}>
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default BankPicker;
