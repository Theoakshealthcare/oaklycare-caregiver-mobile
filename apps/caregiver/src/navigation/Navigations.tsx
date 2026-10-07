import type { Offer } from "../services/booking.service";

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
  BottomNavigation: undefined;
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
  /** accepted -> on my way -> visit code -> in progress -> complete, driven by the booking status. */
  VisitFlow: { bookingId: string };
};
