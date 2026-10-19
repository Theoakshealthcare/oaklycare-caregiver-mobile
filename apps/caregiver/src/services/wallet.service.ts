import type { Schemas } from "@oakly/api-client";

import { api } from "@/src/api/client";
import { ApiError } from "@/src/api/errors";
import { unwrap } from "@/src/api/unwrap";

export type WalletSummary = Schemas["CaregiverWalletSummary"];
export type CaregiverTransaction = Schemas["CaregiverTransactionOut"];
export type BankAccount = Schemas["CaregiverBankAccountOut"];
export type BankAccountInput = Schemas["CaregiverBankAccountUpdate"];
export type Bank = Schemas["BankOut"];
export type ResolvedAccount = Schemas["BankAccountResolveOut"];

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

  /** Paystack's Nigerian bank list (cached a day by the backend): show `name`, send back `code`. */
  getBanks() {
    return unwrap(api.GET("/api/v1/caregiver/banks"));
  },

  /** Looks up the account holder's name so the caregiver can confirm it (10 lookups a minute). */
  resolveBankAccount(input: BankAccountInput) {
    return unwrap(api.POST("/api/v1/caregiver/bank-account/resolve", { body: input }));
  },

  /** Only bank_code + account_number: the backend resolves and stores the name itself. */
  updateBankAccount(input: BankAccountInput) {
    return unwrap(api.PUT("/api/v1/caregiver/bank-account", { body: input }));
  },
};
