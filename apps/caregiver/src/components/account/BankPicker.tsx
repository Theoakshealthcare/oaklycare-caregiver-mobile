import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Input from "@/src/components/ui/input";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterBanks(banks ?? [], query), [banks, query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text variant="small" weight="medium" style={{ marginBottom: 6 }}>
        Bank
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose your bank"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: invalid ? theme.colors.error : theme.colors.primary,
        }}
      >
        <Text variant="body" color={value ? undefined : theme.colors.textLight}>
          {value ? value.name : "Choose your bank"}
        </Text>
        <Feather name="chevron-down" size={18} color={theme.colors.primary} />
      </Pressable>
      {invalid ? (
        <Text variant="small" color={theme.colors.error} style={{ marginTop: 4 }}>
          {invalid}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View style={{ flex: 1, padding: 16, paddingTop: 56, backgroundColor: theme.colors.white }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text variant="h3" weight="bold">
              Choose your bank
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close bank list" onPress={close}>
              <Feather name="x" size={24} color={theme.colors.primary} />
            </Pressable>
          </View>
          <Input placeholder="Search banks" value={query} onChangeText={setQuery} autoCorrect={false} />
          {error && !banks ? (
            <ErrorState error={error} onRetry={onRetry} />
          ) : loading || !banks ? (
            <LoadingState testID="banks-loading" />
          ) : shown.length === 0 ? (
            <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 16 }}>
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
                  style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.soft }}
                >
                  <Text variant="body">{item.name}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

export default BankPicker;
