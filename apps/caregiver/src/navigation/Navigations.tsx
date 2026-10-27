import type { Offer } from "../services/booking.service";
import type { VitalKind } from "../vitals/vitalsModel";

export type ScreenParamLists = {
  // Signed out
  Onboarding: undefined;
  Login: undefined;
  CreateAccount: undefined;
  VerifyEmail: { email: string };
  AccountCreated: undefined;
  RecoverPassword: undefined;
  ResetPassword: { email?: string } | undefined;
  // Signed in, profile not approved yet
  CaregiverSetupStep1: undefined;
  CaregiverSetupStep2: undefined;
  ConsentScreen: undefined;
  VerificationStatus: undefined;
  // Signed in and approved
  /** `tab` + `at` select a tab on arrival (`at` is a changing nonce so repeating the same tab still applies). */
  BottomNavigation: { tab?: "home" | "booking" | "vitals"; at?: number } | undefined;
  /** With `offer` it is an un-accepted job (offer view, nothing is fetched); without it, an assigned booking. */
  BookingDetails: { bookingId: string; offer?: Offer };
  ChatScreen: { bookingId: string; patientName?: string };
  CallScreen: { bookingId: string; patientName?: string; isVideo?: boolean };
  AINoteTaker: { bookingId: string };
  Notifications: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Wallet: undefined;
  BankDetails: undefined;
  Contact: undefined;
  /** Who the visit is for (age, emergency contact, history, latest vitals) while the visit is live. */
  ClientProfile: { bookingId: string; bookingCode?: string };
  /** One vital of the patient on the current visit: chart and history. */
  VitalDetail: { patientId: string; patientName?: string; kind: VitalKind };
  /** Manual vital entry for the patient on the current visit. */
  AddVitals: { patientId: string; patientName?: string };
  /** accepted -> on my way -> visit code -> in progress -> complete, driven by the booking status. */
  VisitFlow: { bookingId: string };
};
