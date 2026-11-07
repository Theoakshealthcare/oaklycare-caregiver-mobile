import React, { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { messageForError } from "@/src/api/errors";
import InfoRow from "@/src/components/account/InfoRow";
import ScreenShell from "@/src/components/account/ScreenShell";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Button from "@/src/components/ui/button";
import Select from "@/src/components/ui/select";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBankAccount, useWallet, useWalletTransactions } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { sharePayslip } from "@/src/wallet/payslip";
import {
  currentMonth,
  formatKobo,
  groupTransactions,
  bankAccountState,
  MIN_PAYOUT_NAIRA_TEXT,
  PAUSE_REASON,
  payoutsPausedUntil,
  monthLabel,
  monthOptions,
  walletBalances,
  type Tone,
} from "@/src/wallet/walletModel";

const TONE_COLOR: Record<Tone, string> = {
  success: theme.colors.success,
  pending: theme.colors.warningText,
  error: theme.colors.error,
};

const TotalCard: React.FC<{ label: string; value: string; icon: "arrow-down-left" | "arrow-up-right" }> = ({ label, value, icon }) => (
  <View
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
    <Feather name={icon} size={22} color={theme.colors.primary} />
    <View>
      <Text variant="small" color={theme.colors.textLight}>
        {label}
      </Text>
      <Text variant="body" weight="bold">
        {value}
      </Text>
    </View>
  </View>
);

const Wallet: React.FC = () => {
  const { navigation } = useNavigation();
  const [month, setMonth] = useState(() => currentMonth());
  const [downloading, setDownloading] = useState(false);
  const options = useMemo(() => monthOptions(), []);
  const wallet = useWallet();
  const txs = useWalletTransactions(month);
  const bank = useBankAccount();

  const groups = useMemo(() => (txs.data ? groupTransactions(txs.data) : []), [txs.data]);

  const refresh = () => {
    void wallet.refetch();
    void txs.refetch();
    void bank.refetch();
  };

  const downloadPayslip = async () => {
    if (!txs.data) {
      Alert.alert("Your payments are still loading", "Try again in a moment.");
      return;
    }
    if (txs.data.length === 0) {
      Alert.alert(`No earnings in ${monthLabel(month)}`, "There is nothing to put in a payslip for this month yet.");
      return;
    }
    setDownloading(true);
    try {
      await sharePayslip(month, txs.data);
    } catch (error) {
      Alert.alert("Couldn't get your payslip", messageForError(error));
    } finally {
      setDownloading(false);
    }
  };

  const content = () => {
    if (wallet.isError && !wallet.data) return <ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />;
    if (!wallet.data) return <LoadingState testID="wallet-loading" />;
    const summary = wallet.data;
    const balances = walletBalances(summary);
    const pausedUntil = payoutsPausedUntil(summary.payouts_blocked_until);
    return (
      <>
        <View style={{ backgroundColor: theme.colors.primary, borderRadius: 20, padding: 24, alignItems: "center", marginBottom: 12 }}>
          <Text variant="small" color={theme.colors.white}>
            Available balance
          </Text>
          <Text variant="h1" weight="bold" color={theme.colors.white} testID="wallet-balance">
            {balances.available}
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
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("BankDetails")}>
              <Text variant="small" weight="medium" color={theme.colors.primary}>
                {bankAccountState(bank.data) === "needs_resave" ? "Verify account" : "Payment details"}
              </Text>
            </Pressable>
          </View>
        ) : bank.isSuccess ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("BankDetails")}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 12, marginBottom: 12 }}
          >
            <Feather name="plus" size={18} color={theme.colors.primary} />
            <Text variant="body" weight="medium" color={theme.colors.primary}>
              Add payment method
            </Text>
          </Pressable>
        ) : null}

        <TotalCard label="Total earned" value={formatKobo(summary.total_earned)} icon="arrow-down-left" />
        <TotalCard label="Paid out to your bank" value={formatKobo(summary.total_withdrawn)} icon="arrow-up-right" />

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <Text variant="h3" weight="bold">
            Earning payments
          </Text>
          <View style={{ width: 170 }}>
            <Select options={options} value={month} onValueChange={(v) => setMonth(String(v))} />
          </View>
        </View>

        {txs.isError && !txs.data ? (
          <ErrorState error={txs.error} onRetry={() => void txs.refetch()} />
        ) : !txs.data ? (
          <LoadingState testID="transactions-loading" />
        ) : groups.length === 0 ? (
          <EmptyState icon="inbox" title="No payments this month" hint="Payments for completed visits will be listed here." />
        ) : (
          groups.map((group) => (
            <View key={group.label} style={{ marginTop: 8 }}>
              <Text variant="body" weight="medium" style={{ marginVertical: 8 }}>
                {group.label}
              </Text>
              {group.items.map((item) => (
                <View
                  key={item.id}
                  style={{ flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, backgroundColor: theme.colors.soft, marginBottom: 8 }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text variant="body" weight="bold">
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text variant="small" color={theme.colors.textLight}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text variant="body" weight="bold">
                      {item.amount}
                    </Text>
                    <Text variant="caption" weight="medium" color={TONE_COLOR[item.tone]}>
                      {item.statusLabel}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}

        <Button title="Download payslip" onPress={() => void downloadPayslip()} loading={downloading} style={{ marginTop: 16 }} />
      </>
    );
  };

  return (
    <ScreenShell
      title="Payment & earnings"
      refreshControl={<RefreshControl refreshing={wallet.isRefetching || txs.isRefetching} onRefresh={refresh} />}
    >
      {content()}
    </ScreenShell>
  );
};

export default Wallet;
