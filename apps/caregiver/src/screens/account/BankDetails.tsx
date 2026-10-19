import React, { useState } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import ScreenShell from "@/src/components/account/ScreenShell";
import BankPicker from "@/src/components/account/BankPicker";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBankAccount, useBanks, useResolveBankAccount, useSaveBankAccount } from "@/src/hooks/queries";
import type { Bank, BankAccount, ResolvedAccount } from "@/src/services/wallet.service";
import { accountNumberProblem, bankAccountState, PAUSE_REASON, payoutsPausedUntil } from "@/src/wallet/walletModel";

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

const Banner: React.FC<{ tone: "info" | "warning"; testID: string; children: string }> = ({ tone, testID, children }) => (
  <View
    testID={testID}
    style={{
      flexDirection: "row",
      gap: 10,
      padding: 14,
      borderRadius: 12,
      marginBottom: 16,
      backgroundColor: tone === "warning" ? theme.colors.warning + "33" : theme.colors.soft,
    }}
  >
    <Feather name={tone === "warning" ? "alert-triangle" : "info"} size={18} color={tone === "warning" ? theme.colors.warningText : theme.colors.primary} />
    <Text variant="small" color={tone === "warning" ? theme.colors.warningText : theme.colors.textLight} style={{ flex: 1 }}>
      {children}
    </Text>
  </View>
);

/** What the caregiver is told after a save; the 24 h pause is the backend's anti-fraud rule (guide, 10.3). */
function savedNotice(account: BankAccount): string {
  const until = payoutsPausedUntil(account.payouts_blocked_until);
  return until
    ? `Your bank account is saved. For your security, payouts are paused for 24 hours ${PAUSE_REASON}, until ${until}.`
    : "Your bank account is saved.";
}

const BankForm: React.FC<{ hasAccount: boolean; onSaved: (account: BankAccount) => void; onCancel: () => void }> = ({
  hasAccount,
  onSaved,
  onCancel,
}) => {
  const banks = useBanks();
  const resolve = useResolveBankAccount();
  const save = useSaveBankAccount();
  const [bank, setBank] = useState<Bank | null>(null);
  const [number, setNumber] = useState("");
  const [resolved, setResolved] = useState<ResolvedAccount | null>(null);
  const [bankProblem, setBankProblem] = useState<string | undefined>();
  const [numberProblem, setNumberProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const reset = () => {
    setResolved(null);
    setFailure(null);
  };

  const check = async () => {
    const noBank = bank ? undefined : "Choose a bank from the list.";
    const badNumber = accountNumberProblem(number) ?? undefined;
    setBankProblem(noBank);
    setNumberProblem(badNumber);
    reset();
    if (!bank || badNumber) return;
    try {
      setResolved(await resolve.mutateAsync({ bank_code: bank.code, account_number: number }));
    } catch (error) {
      setFailure(messageForError(error, "bank"));
    }
  };

  const confirm = async () => {
    if (!bank || !resolved) return;
    try {
      onSaved(await save.mutateAsync({ bank_code: bank.code, account_number: number }));
    } catch (error) {
      setFailure(messageForError(error, "bank"));
    }
  };

  return (
    <View>
      <Text variant="body" weight="bold" style={{ marginBottom: 4 }}>
        {hasAccount ? "Change bank account" : "Add your bank account"}
      </Text>
      <Text variant="small" color={theme.colors.textLight} style={{ marginBottom: 16 }}>
        Choose your bank and enter your account number. We will show the name on the account so you can confirm it is yours.
      </Text>

      <BankPicker
        banks={banks.data}
        loading={banks.isPending}
        error={banks.error}
        onRetry={() => void banks.refetch()}
        value={bank}
        invalid={bankProblem}
        onChange={(b) => {
          setBank(b);
          setBankProblem(undefined);
          reset();
        }}
      />
      <Input
        label="Account number"
        value={number}
        keyboardType="number-pad"
        maxLength={10}
        placeholder="10 digits"
        error={numberProblem}
        onChangeText={(v) => {
          setNumber(v.replace(/\D/g, ""));
          setNumberProblem(undefined);
          reset();
        }}
      />

      {failure ? (
        <Text variant="small" color={theme.colors.error} style={{ marginBottom: 12 }} testID="bank-failure">
          {failure}
        </Text>
      ) : null}

      {resolved ? (
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: theme.colors.primaryLight, marginBottom: 16 }} testID="bank-resolved">
          <Text variant="small" color={theme.colors.textLight}>
            Name on this account
          </Text>
          <Text variant="body" weight="bold" style={{ marginBottom: 8 }}>
            {resolved.account_name}
          </Text>
          <Text variant="small" color={theme.colors.textLight}>
            {`${resolved.bank_name} · ${resolved.account_number}`}
          </Text>
        </View>
      ) : null}

      {resolved ? (
        <>
          <Button title="Yes, this is my account" onPress={() => void confirm()} loading={save.isPending} />
          <Button title="No, change details" variant="ghost" onPress={reset} style={{ marginTop: 8 }} />
        </>
      ) : (
        <Button title="Check account" onPress={() => void check()} loading={resolve.isPending} />
      )}
      {hasAccount ? <Button title="Cancel" variant="ghost" onPress={onCancel} style={{ marginTop: 8 }} /> : null}
    </View>
  );
};

const BankDetails: React.FC = () => {
  const bank = useBankAccount();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const body = () => {
    if (bank.isError && !bank.data) return <ErrorState error={bank.error} onRetry={() => void bank.refetch()} />;
    if (bank.data === undefined) return <LoadingState testID="bank-loading" />;
    const account = bank.data;

    if (account === null || editing) {
      return (
        <BankForm
          hasAccount={account !== null}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setNotice(savedNotice(saved));
            setEditing(false);
          }}
        />
      );
    }

    const paused = payoutsPausedUntil(account.payouts_blocked_until);
    return (
      <>
        {notice ? <Banner tone="info" testID="bank-saved-notice">{notice}</Banner> : null}
        {bankAccountState(account) === "needs_resave" ? (
          <Banner tone="warning" testID="bank-resave">
            Please verify your bank account. Accounts saved before this update can't be paid until you save them again.
          </Banner>
        ) : null}
        {paused && !notice ? (
          <Banner tone="warning" testID="bank-paused">{`Payouts are paused until ${paused} ${PAUSE_REASON}.`}</Banner>
        ) : null}
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: theme.colors.primaryLight, marginBottom: 16 }}>
          <Detail label="Account name" value={account.account_name} />
          <Detail label="Account number" value={account.account_number} />
          <Detail label="Bank" value={account.bank_name} />
        </View>
        <Button
          title={bankAccountState(account) === "needs_resave" ? "Verify bank account" : "Change bank account"}
          onPress={() => {
            setNotice(null);
            setEditing(true);
          }}
        />
        <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 12 }}>
          For your security, changing your bank account pauses payouts for 24 hours.
        </Text>
      </>
    );
  };

  return <ScreenShell title="Payment details">{body()}</ScreenShell>;
};

export default BankDetails;
