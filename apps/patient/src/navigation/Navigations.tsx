import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";

import type { FallguardResult } from "@/src/domain/fallguard";
import type { VitalKind } from "@/src/domain/vitals";

export type TabId = "home" | "bookings" | "vitals" | "fall";

export type ScreenParamLists = {
  // Signed out
  Onboarding: undefined;
  Login: undefined;
  CreateAccount: undefined;
  VerifyEmail: { email: string };
  AccountCreated: undefined;
  RecoverPassword: undefined;
  /** `cleared` changes when the reset screen sends the person back, so the code boxes start empty again; `error` is what it found wrong with the code. */
  RecoverCode: { email: string; cleared?: number; error?: string };
  ResetPassword: { email: string; code: string };
  // Signed in, email not verified yet. Its own route name on purpose: the root navigation state outlives a gate switch
  // (signed out to unverified and back), and a shared name would carry the old screen into the other stack.
  GateVerifyEmail: { email: string };
  // Signed in
  Tabs: { tab?: TabId; at?: number } | undefined;
  Notifications: undefined;
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Contact: undefined;
  AccountData: undefined;
  BookingStep1: undefined;
  BookingStep2: undefined;
  BookingSummary: undefined;
  /** Card or Bank Transfer, between the summary and the Paystack checkout. */
  PaymentDetails: undefined;
  /** `open`: open the Paystack checkout as soon as the screen shows (from "Proceed to Payment" and "Pay now"). */
  PaymentResult: { bookingId: string; open?: boolean };
  BookingDetails: { id: string };
  CancelBooking: { id: string };
  CaregiverDetail: { id: string };
  Chat: { id: string };
  VitalDetail: { kind: VitalKind };
  AddVital: { kind: VitalKind };
  VitalHistory: undefined;
  VitalReport: undefined;
  VitalAccess: undefined;
  FallAssessment: undefined;
  FallResult: { result: FallguardResult };
};

export type NavigationProp = StackNavigationProp<ScreenParamLists>;

export const useNav = () => useNavigation<NavigationProp>();
