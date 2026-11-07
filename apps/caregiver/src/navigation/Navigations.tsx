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
  ResetPassword: { email: string };
  // Signed in, profile not approved yet
  CaregiverSetupStep1: undefined;
  CaregiverSetupStep2: undefined;
  /** After Step 2: intro and separate consent, then the check and its result (KYC). Also opened from the status screen. */
  IdentityVerification: undefined;
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
  /** Check, edit and save the draft of a voice note (only reachable while the voice note flow is on). */
  VoiceNoteReview: { bookingId: string; noteId: string };
  Notifications: undefined;
  Profile: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Wallet: undefined;
  BankDetails: undefined;
  Contact: undefined;
  /** Who the visit is for (age, emergency contact, history, latest vitals) while the visit is live. */
  ClientProfile: { bookingId: string; bookingCode?: string };
  /** One vital of the patient on the current visit: chart and history. */
  VitalDetail: { patientId: string; patientName?: string; kind: VitalKind };
  /** The vitals overview of one patient on a live visit, pushed from the client profile ("View all"). */
  PatientVitals: { patientId: string };
  /** Every reading of one vital on record, grouped by day. */
  VitalHistory: { patientId: string; patientName?: string; kind: VitalKind };
  /** Manual vital entry for the patient on the current visit. */
  AddVitals: { patientId: string; patientName?: string };
  /** Care plans hub (nurses): Assigned / Templates. With `bookingId` it was opened from that client's profile, so "Use template" skips the client picker. */
  CarePlans: { tab?: "assigned" | "templates"; bookingId?: string } | undefined;
  /** Read-only preview of a seeded template, with "Use template". */
  CarePlanTemplate: { templateId: string; bookingId?: string };
  /** Pick the client (a live visit with no active plan) to create a plan for. */
  CarePlanClients: { templateId?: string } | undefined;
  /** The create form for the client of `bookingId`, blank or pre-filled from `templateId`. */
  CreateCarePlan: { bookingId: string; templateId?: string; clientName?: string };
  /** The success screen shared by "plan created", "goal added", "task added" and "medication added". */
  CarePlanSuccess: { kind: "created" | "goal_added" | "task_added" | "medication_added"; planId: string };
  /** One plan: client profile, goals, daily tasks, notes, allergies and special instructions. `from: "clock_out"` opens tasks and notes first. */
  CarePlanDetails: { planId: string; from?: "clock_out" };
  /** View Progress for one plan (percent over visit days, day N of M, goal counts). */
  CarePlanProgress: { planId: string; clientName?: string };
  /** accepted -> on my way -> visit code -> in progress -> complete, driven by the booking status. */
  VisitFlow: { bookingId: string };
};
