import React, { useState } from "react";
import { Keyboard, Linking, View } from "react-native";

import { isBankNameMismatch, messageForError } from "@/src/api/errors";
import InfoRow from "@/src/components/account/InfoRow";
import ScreenShell from "@/src/components/account/ScreenShell";
import BankPicker from "@/src/components/account/BankPicker";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { supportUrl } from "@/src/config/contact";
import { theme } from "@/src/constants/theme";
import { showToast } from "@/src/components/ui/toast";
import { useBankAccount, useBanks, useResolveBankAccount, useSaveBankAccount } from "@/src/hooks/queries";
import type { Bank, BankAccount, ResolvedAccount } from "@/src/services/wallet.service";
import { ACCOUNT_NUMBER_LENGTH, accountNumberProblem, bankAccountState, PAUSE_REASON, payoutsPausedUntil } from "@/src/wallet/walletModel";

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
  <InfoRow tone={tone} testID={testID} style={{ marginBottom: 16 }}>
    {children}
  </InfoRow>
);

/** What the caregiver is told after a save; the 24 h pause is the backend's anti-fraud rule (guide, 10.3). */
/** The Figma toast after the bank account is saved. */
export const PAYMENT_UPDATED_TOAST = "Payment Details has been updated";

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
  // The account is not in the caregiver's own name: only support can change the name on the profile.
  const [needsSupport, setNeedsSupport] = useState(false);

  const fail = (error: unknown) => {
    setFailure(messageForError(error, "bank"));
    setNeedsSupport(isBankNameMismatch(error));
  };

  const reset = () => {
    setResolved(null);
    setFailure(null);
    setNeedsSupport(false);
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
      fail(error);
    }
  };

  const confirm = async () => {
    if (!bank || !resolved) return;
    try {
      onSaved(await save.mutateAsync({ bank_code: bank.code, account_number: number }));
    } catch (error) {
      fail(error);
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
          const digits = v.replace(/\D/g, "");
          setNumber(digits);
          // The iOS number pad has no Done key and would cover the confirm button.
          if (digits.length === ACCOUNT_NUMBER_LENGTH) Keyboard.dismiss();
          setNumberProblem(undefined);
          reset();
        }}
      />

      {failure ? (
        <Text variant="small" color={theme.colors.error} style={{ marginTop: 12, marginBottom: 12 }} testID="bank-failure">
          {failure}
        </Text>
      ) : null}
      {failure && needsSupport ? (
        <Button
          testID="bank-contact-support"
          title="Contact support"
          variant="ghost"
          onPress={() => void Linking.openURL(supportUrl())}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      {resolved ? (
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: theme.colors.primaryLight, marginTop: 16, marginBottom: 16 }} testID="bank-resolved">
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
        <Button title="Check account" onPress={() => void check()} loading={resolve.isPending} style={{ marginTop: 16 }} />
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
            // Figma's green toast. The banner stays: it also carries the 24 hour payout pause.
            showToast(PAYMENT_UPDATED_TOAST);
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
            Please verify your bank account. Accounts saved before this update can&apos;t be paid until you save them again.
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
          For your security, adding or changing your bank account pauses payouts for 24 hours.
        </Text>
      </>
    );
  };

  return <ScreenShell title="Payment details">{body()}</ScreenShell>;
};

export default BankDetails;
