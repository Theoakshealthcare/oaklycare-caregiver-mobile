import React, { useState } from "react";
import { Alert, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import ScreenShell from "@/src/components/account/ScreenShell";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBankAccount } from "@/src/hooks/queries";
import { walletService, type BankAccount } from "@/src/services/wallet.service";

const Detail: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={{ marginBottom: 14 }}>
    <Text variant="small" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="body" weight="bold">
      {value}
    </Text>
  </View>
);

// PUT /caregiver/bank-account takes exactly these three free-text fields. The backend has no bank
// list and no account-name lookup yet, so nothing here is verified against the bank.
const BankForm: React.FC<{ account: BankAccount | null; onDone: () => void }> = ({ account, onDone }) => {
  const client = useQueryClient();
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.account_number ?? "");
  const [accountName, setAccountName] = useState(account?.account_name ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      walletService.updateBankAccount({
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_name: accountName.trim(),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.bankAccount });
      onDone();
    },
    onError: (error) => Alert.alert("Couldn't save", messageForError(error)),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!bankName.trim()) next.bankName = "Bank name is required";
    if (!/^\d{10}$/.test(accountNumber.trim())) next.accountNumber = "Account number must be 10 digits";
    if (!accountName.trim()) next.accountName = "Account name is required";
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  return (
    <View style={{ gap: 16 }}>
      <Input label="Bank name" placeholder="Bank name" value={bankName} onChangeText={setBankName} error={errors.bankName} />
      <Input
        label="Account number"
        placeholder="10-digit account number"
        value={accountNumber}
        onChangeText={(v) => setAccountNumber(v.replace(/\D/g, "").slice(0, 10))}
        keyboardType="number-pad"
        error={errors.accountNumber}
      />
      <Input
        label="Account name"
        placeholder="Name on the account"
        value={accountName}
        onChangeText={setAccountName}
        error={errors.accountName}
      />
      <Text variant="small" color={theme.colors.textLight}>
        Check these details carefully: your earnings are paid to this account, and we can&apos;t verify the name with your bank yet.
      </Text>
      <Button title="Save payment details" onPress={submit} loading={save.isPending} />
    </View>
  );
};

const BankDetails: React.FC = () => {
  const bank = useBankAccount();
  const [editing, setEditing] = useState(false);

  const body = () => {
    if (bank.isError && !bank.data) return <ErrorState error={bank.error} onRetry={() => void bank.refetch()} />;
    if (bank.data === undefined) return <LoadingState testID="bank-loading" />;
    if (bank.data === null) {
      return (
        <>
          <Text variant="body" weight="bold" style={{ marginBottom: 4 }}>
            No payment details yet
          </Text>
          <Text variant="small" color={theme.colors.textLight} style={{ marginBottom: 16 }}>
            Add the bank account where you want to be paid.
          </Text>
          <BankForm account={null} onDone={() => setEditing(false)} />
        </>
      );
    }
    if (editing) return <BankForm account={bank.data} onDone={() => setEditing(false)} />;
    return (
      <>
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: theme.colors.primaryLight, marginBottom: 16 }}>
          <Detail label="Account name" value={bank.data.account_name} />
          <Detail label="Account number" value={bank.data.account_number} />
          <Detail label="Bank" value={bank.data.bank_name} />
        </View>
        <Button title="Update payment details" variant="outline" onPress={() => setEditing(true)} />
      </>
    );
  };

  return <ScreenShell title="Payment details">{body()}</ScreenShell>;
};

export default BankDetails;
