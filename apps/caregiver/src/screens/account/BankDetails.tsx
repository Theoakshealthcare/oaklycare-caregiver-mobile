import React, { useState } from "react";
import { Keyboard, Linking, View } from "react-native";

import { messageForError } from "@/src/api/errors";
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
  if (account.name_review_status === "pending") {
    return "Your bank account is saved. The name on it is different from your Oakly profile, so our team will check it before we pay into it.";
  }
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

  const fail = (error: unknown) => setFailure(messageForError(error, "bank"));

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
        label="Enter Account Details"
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
        containerStyle={{ marginBottom: 16 }}
      />
      {/* The name is read back from the bank, not typed: it fills in once the account is checked, and the caregiver confirms it is theirs. */}
      <Input
        label="Account Name"
        value={resolved?.account_name ?? ""}
        editable={false}
        placeholder="Shown after your account is checked"
        testID="bank-resolved"
        containerStyle={{ opacity: resolved ? 1 : 0.6 }}
      />

      {failure ? (
        <Text variant="small" color={theme.colors.error} style={{ marginTop: 12, marginBottom: 12 }} testID="bank-failure">
          {failure}
        </Text>
      ) : null}

      {resolved ? (
        <>
          <Text variant="small" color={theme.colors.textLight} style={{ marginTop: 12 }}>
            {`${resolved.bank_name} · ${resolved.account_number}`}
          </Text>
          {/* A different name is not a dead end: the account can be saved, and our team checks it before any payout. */}
          {resolved.needs_review ? (
            <InfoRow tone="warning" testID="bank-needs-review" style={{ marginTop: 12 }}>
              {"This name doesn't look like the name on your Oakly profile. You can still save the account, but we'll only pay into it after our team has checked it."}
            </InfoRow>
          ) : null}
          <Button
            title={resolved.needs_review ? "Save for review" : "Yes, this is my account"}
            onPress={() => void confirm()}
            loading={save.isPending}
            style={{ marginTop: 16 }}
          />
          <Button title="No, change details" variant="ghost" onPress={reset} style={{ marginTop: 8 }} />
        </>
      ) : (
        // Figma's one button. It checks the account first (the owner keeps the name confirmation); saving follows the "Yes".
        <Button title="Update Payment Details" onPress={() => void check()} loading={resolve.isPending} style={{ marginTop: 24 }} />
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
        {account.name_review_status === "pending" && !notice ? (
          <Banner tone="warning" testID="bank-name-pending">
            Our team is checking that this account is yours. We will pay into it as soon as it is confirmed.
          </Banner>
        ) : null}
        {account.name_review_status === "rejected" ? (
          <>
            <Banner tone="warning" testID="bank-name-rejected">
              We could not confirm that this account is yours, so we cannot pay into it. Save a different account, or contact support.
            </Banner>
            <Button
              testID="bank-contact-support"
              title="Contact support"
              variant="ghost"
              onPress={() => void Linking.openURL(supportUrl())}
              style={{ marginBottom: 12 }}
            />
          </>
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

  const formShown = bank.data === null || editing;
  return <ScreenShell title={formShown ? "Update Payment Details" : "Payment Details"}>{body()}</ScreenShell>;
};

export default BankDetails;
