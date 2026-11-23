import React, { useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import MonthChip from "@/src/components/account/MonthChip";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import HeaderBack from "@/src/components/back/HeaderBack";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useWalletTransactions } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { sharePayslip } from "@/src/wallet/payslip";
import { currentMonth, groupTransactions, monthLabel, monthOptions, type Tone } from "@/src/wallet/walletModel";

const TONE_COLOR: Record<Tone, string> = {
  success: theme.colors.success,
  pending: theme.colors.warningText,
  error: theme.colors.error,
};

/**
 * "Earning Payment": the month's payments under date headings, with the month chip and a Download Payslip button pinned at the
 * bottom. No bank logo on the rows: no response carries one. A row's title and second line come from the wallet model (the
 * visit, the bank for a payout).
 */
const EarningPayment: React.FC = () => {
  const { navigation } = useNavigation();
  const [month, setMonth] = useState(() => currentMonth());
  const [downloading, setDownloading] = useState(false);
  const options = useMemo(() => monthOptions(), []);
  const txs = useWalletTransactions(month);
  const groups = useMemo(() => (txs.data ? groupTransactions(txs.data) : []), [txs.data]);

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
      // The share sheet has been dismissed: the page says the payslip was made (iOS does not say whether it was sent anywhere).
      navigation.navigate("PayslipDownloaded", { month });
    } catch (error) {
      Alert.alert("Couldn't get your payslip", messageForError(error));
    } finally {
      setDownloading(false);
    }
  };

  const list = () => {
    if (txs.isError && !txs.data) return <ErrorState error={txs.error} onRetry={() => void txs.refetch()} />;
    if (!txs.data) return <LoadingState testID="transactions-loading" />;
    if (groups.length === 0) {
      return <EmptyState icon="inbox" title="No payments this month" hint="Payments for completed visits will be listed here." />;
    }
    return groups.map((group) => (
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
    ));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={txs.isRefetching} onRefresh={() => void txs.refetch()} />}
      >
        <View style={[globalStyles.container, { paddingBottom: theme.spacing.md }]}>
          <HeaderBack />
          <View style={{ marginVertical: "5%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="h2" weight="bold">
              Earning Payment
            </Text>
            <MonthChip value={month} options={options} onChange={setMonth} />
          </View>
          {list()}
        </View>
      </ScrollView>
      <View style={{ padding: theme.spacing.md, paddingBottom: theme.spacing.lg, backgroundColor: theme.colors.white }}>
        <Button title="Download Payslip" onPress={() => void downloadPayslip()} loading={downloading} />
      </View>
    </View>
  );
};

export default EarningPayment;
