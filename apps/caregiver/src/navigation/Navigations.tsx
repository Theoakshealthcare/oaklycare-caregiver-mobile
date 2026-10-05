import type { BookingRequest } from '../types/booking.types'

export type ScreenParamLists = {
  Onboarding: undefined;
  Login: undefined;
  VerifyEmail: { email: string };
  CreateAccount: undefined;
  AccountCreated: undefined;
  ForgotPassword: undefined;
  RecoverPassword: undefined;
  ResetPassword: { token: string };
  BottomNavigation: undefined;
  Notifications: undefined;
  BookingDetails: {booking: any}
  CaregiverSetupStep1: undefined
  CaregiverSetupStep2: undefined
  IdentityVerification: undefined
  ConsentScreen: undefined
  ProfileCompleted: undefined
  DocumentScan: {applicant_id: string, sdk_token: any}
  FaceScan: {applicant_id: string, sdk_token: any}
  ChatScreen: { booking?: BookingRequest }
  CallScreen: { booking?: BookingRequest; isVideo?: boolean }
  AINoteTaker: { booking?: BookingRequest }
};
