import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { ApiError } from "@/src/api/errors";
import { unwrap } from "@/src/api/unwrap";

export type WalletSummary = Schemas["CaregiverWalletSummary"];
export type CaregiverTransaction = Schemas["CaregiverTransactionOut"];
export type BankAccount = Schemas["CaregiverBankAccountOut"];
export type BankAccountInput = Schemas["CaregiverBankAccountUpdate"];

export const walletService = {
  /** Integer kobo (guide, section 10). */
  getWallet() {
    return unwrap(api.GET("/api/v1/caregiver/wallet"));
  },

  getTransactions(month?: string) {
    return unwrap(api.GET("/api/v1/caregiver/wallet/transactions", { params: { query: month ? { month } : {} } }));
  },

  /** The payslip is CSV, not JSON: it is read as text (the schema types the body as unknown). */
  async getPayslipCsv(month: string): Promise<string> {
    const body: unknown = await unwrap(
      api.GET("/api/v1/caregiver/wallet/payslip", { params: { query: { month } }, parseAs: "text" }),
    );
    return typeof body === "string" ? body : "";
  },

  /** `null` while no account is set: the backend answers 404 "Bank account not set." (guide, section 10). */
  async getBankAccount(): Promise<BankAccount | null> {
    try {
      return await unwrap(api.GET("/api/v1/caregiver/bank-account"));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  updateBankAccount(input: BankAccountInput) {
    return unwrap(api.PUT("/api/v1/caregiver/bank-account", { body: input }));
  },
};
