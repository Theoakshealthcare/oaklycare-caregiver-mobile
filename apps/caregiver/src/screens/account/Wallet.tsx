import React, { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import InfoRow from "@/src/components/account/InfoRow";
import ScreenShell from "@/src/components/account/ScreenShell";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBankAccount, useWallet } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import {
  formatKobo,
  bankAccountState,
  MIN_PAYOUT_NAIRA_TEXT,
  PAUSE_REASON,
  payoutsPausedUntil,
  walletBalances,
} from "@/src/wallet/walletModel";

/** Figma's tappable totals ("Total Amount Paid in", "Total Amount Withdrawn"): they open the Earning Payment list. */
const TotalCard: React.FC<{ label: string; value: string; icon: "arrow-down-left" | "arrow-up-right"; onPress: () => void }> = ({
  label,
  value,
  icon,
  onPress,
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      marginBottom: 12,
    }}
  >
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.soft, alignItems: "center", justifyContent: "center" }}>
      <Feather name={icon} size={20} color={theme.colors.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text variant="small" color={theme.colors.textLight}>
        {label}
      </Text>
      <Text variant="body" weight="bold">
        {value}
      </Text>
    </View>
    <Feather name="chevron-right" size={20} color={theme.colors.text} />
  </Pressable>
);

/** The balance is hidden with the eye, as in Figma; the dots are what a hidden figure looks like. */
export const HIDDEN_BALANCE = "••••••";

const Wallet: React.FC = () => {
  const { navigation } = useNavigation();
  const [hidden, setHidden] = useState(false);
  const wallet = useWallet();
  const bank = useBankAccount();

  const refresh = () => {
    void wallet.refetch();
    void bank.refetch();
  };

  const content = () => {
    if (wallet.isError && !wallet.data) return <ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />;
    if (!wallet.data) return <LoadingState testID="wallet-loading" />;
    const summary = wallet.data;
    const balances = walletBalances(summary);
    const pausedUntil = payoutsPausedUntil(summary.payouts_blocked_until);
    const openEarnings = () => navigation.navigate("EarningPayment");
    return (
      <>
        <View style={{ backgroundColor: theme.colors.primary, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show balance" : "Hide balance"}
            hitSlop={12}
            onPress={() => setHidden((h) => !h)}
            style={{ alignSelf: "flex-end" }}
          >
            <Feather name={hidden ? "eye-off" : "eye"} size={20} color={theme.colors.white} />
          </Pressable>
          <Text variant="small" color={theme.colors.white}>
            Wallet Balance (NGN)
          </Text>
          <Text variant="h1" weight="bold" color={theme.colors.white} testID="wallet-balance">
            {hidden ? HIDDEN_BALANCE : balances.available}
          </Text>
        </View>

        {balances.pending ? (
          <Text variant="small" color={theme.colors.warningText} style={{ marginBottom: 8 }} testID="wallet-pending">
            {`${balances.pending.amount} pending${balances.pending.availableFrom ? ` · available from ${balances.pending.availableFrom}` : ""}`}
          </Text>
        ) : null}
        {balances.held ? (
          <View style={{ marginBottom: 8 }}>
            <Text variant="small" weight="medium" color={theme.colors.warningText} testID="wallet-held">
              {`${balances.held.amount} on hold`}
            </Text>
            <Text variant="small" color={theme.colors.textLight}>
              Under review
            </Text>
          </View>
        ) : null}

        {pausedUntil ? (
          // One banner, not two: the pause and the weekly rule say one thing together.
          <InfoRow tone="warning" icon="pause-circle" textTestID="wallet-paused" style={{ marginVertical: 8 }}>
            {`Payouts are paused until ${pausedUntil} ${PAUSE_REASON}. After that they are sent weekly once your available balance is at least ${MIN_PAYOUT_NAIRA_TEXT}.`}
          </InfoRow>
        ) : (
          <InfoRow style={{ marginVertical: 8 }}>
            {`Payouts are sent weekly to your bank account once your available balance is at least ${MIN_PAYOUT_NAIRA_TEXT}.`}
          </InfoRow>
        )}

        {bank.data ? (
          <View style={{ flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, backgroundColor: theme.colors.primaryLight, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text variant="body" weight="bold">
                {bank.data.account_name}
              </Text>
              <Text variant="small" color={theme.colors.textLight}>{`${bank.data.account_number} (${bank.data.bank_name})`}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit payment details"
              hitSlop={12}
              onPress={() => navigation.navigate("BankDetails")}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              {bankAccountState(bank.data) === "needs_resave" ? (
                <Text variant="small" weight="medium" color={theme.colors.primary}>
                  Verify account
                </Text>
              ) : null}
              <Feather name="edit" size={20} color={theme.colors.primary} />
            </Pressable>
          </View>
        ) : bank.isSuccess ? (
          // One account per caregiver, so "add" is only offered while there is none; with one saved, the edit icon changes it.
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("BankDetails")}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 12, marginBottom: 12 }}
          >
            <Feather name="plus" size={18} color={theme.colors.primary} />
            <Text variant="body" weight="medium" color={theme.colors.primary}>
              Add Payment Method
            </Text>
          </Pressable>
        ) : null}

        <TotalCard label="Total Amount Paid in" value={formatKobo(summary.total_earned)} icon="arrow-down-left" onPress={openEarnings} />
        <TotalCard label="Total Amount Withdrawn" value={formatKobo(summary.total_withdrawn)} icon="arrow-up-right" onPress={openEarnings} />
      </>
    );
  };

  return (
    <ScreenShell title="Payment & Earning" refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={refresh} />}>
      {content()}
    </ScreenShell>
  );
};

export default Wallet;
