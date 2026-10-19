import React from "react";
import { View } from "react-native";

import ScreenShell from "@/src/components/account/ScreenShell";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useBankAccount } from "@/src/hooks/queries";

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

// Stopgap: PUT /caregiver/bank-account now takes only bank_code + account_number (the backend
// resolves the account name with Paystack), so the old free-text form can no longer save. This
// screen is read-only until the bank picker + name lookup lands.
const ComingSoon: React.FC = () => (
  <Text variant="small" color={theme.colors.textLight}>
    Adding or changing your bank account here is coming in the next app update.
  </Text>
);

const BankDetails: React.FC = () => {
  const bank = useBankAccount();

  const body = () => {
    if (bank.isError && !bank.data) return <ErrorState error={bank.error} onRetry={() => void bank.refetch()} />;
    if (bank.data === undefined) return <LoadingState testID="bank-loading" />;
    if (bank.data === null) {
      return (
        <>
          <Text variant="body" weight="bold" style={{ marginBottom: 4 }}>
            No payment details yet
          </Text>
          <ComingSoon />
        </>
      );
    }
    return (
      <>
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: theme.colors.primaryLight, marginBottom: 16 }}>
          <Detail label="Account name" value={bank.data.account_name} />
          <Detail label="Account number" value={bank.data.account_number} />
          <Detail label="Bank" value={bank.data.bank_name} />
        </View>
        <ComingSoon />
      </>
    );
  };

  return <ScreenShell title="Payment details">{body()}</ScreenShell>;
};

export default BankDetails;
