import type React from "react";

import AccountCreated from "@/src/screens/auth/AccountCreated";
import CreateAccount from "@/src/screens/auth/CreateAccount";
import Login from "@/src/screens/auth/Login";
import Onboarding from "@/src/screens/auth/Onboarding";
import RecoverPassword from "@/src/screens/auth/RecoverPassword";
import ResetPassword from "@/src/screens/auth/ResetPassword";
import VerifyEmail from "@/src/screens/auth/VerifyEmail";
import BookingDetails from "@/src/screens/booking/BookingDetails";
import BookingStep1 from "@/src/screens/booking/BookingStep1";
import BookingStep2 from "@/src/screens/booking/BookingStep2";
import BookingSummary from "@/src/screens/booking/BookingSummary";
import CancelBooking from "@/src/screens/booking/CancelBooking";
import PaymentResult from "@/src/screens/booking/PaymentResult";
import FallAssessment from "@/src/screens/fall/FallAssessment";
import FallResult from "@/src/screens/fall/FallResult";
import Notifications from "@/src/screens/home/Notifications";
import AccountData from "@/src/screens/profile/AccountData";
import ChangePassword from "@/src/screens/profile/ChangePassword";
import Contact from "@/src/screens/profile/Contact";
import EditProfile from "@/src/screens/profile/EditProfile";
import Profile from "@/src/screens/profile/Profile";
import CaregiverDetail from "@/src/screens/tracking/CaregiverDetail";
import Chat from "@/src/screens/tracking/Chat";
import AddVital from "@/src/screens/vitals/AddVital";
import VitalAccess from "@/src/screens/vitals/VitalAccess";
import VitalDetail from "@/src/screens/vitals/VitalDetail";
import VitalHistory from "@/src/screens/vitals/VitalHistory";

import type { ScreenParamLists } from "./Navigations";
import Tabs from "./Tabs";

export interface ScreenDef {
  name: keyof ScreenParamLists;
  // Screens take different route params; the navigator checks the names through ScreenParamLists.
  component: React.ComponentType<any>;
}

/**
 * Every screen a signed-out person can reach. The navigator registers exactly this list, and a test pins it, so a
 * screen that is out of v1 (wallet, reschedule, provider list, prescriptions, nutritionist, physio, ratings, video
 * call, AI note taker, support chat, wearables, subscriptions, referrals, family details, drug reminders) cannot be
 * reached by adding a route somewhere else and forgetting it here.
 */
export const AUTH_SCREENS: ScreenDef[] = [
  { name: "Onboarding", component: Onboarding },
  { name: "Login", component: Login },
  { name: "CreateAccount", component: CreateAccount },
  { name: "VerifyEmail", component: VerifyEmail },
  { name: "AccountCreated", component: AccountCreated },
  { name: "RecoverPassword", component: RecoverPassword },
  { name: "ResetPassword", component: ResetPassword },
];

/** Every screen of the signed-in app (the four tabs live inside `Tabs`). */
export const APP_SCREENS: ScreenDef[] = [
  { name: "Tabs", component: Tabs },
  { name: "Notifications", component: Notifications },
  { name: "Profile", component: Profile },
  { name: "EditProfile", component: EditProfile },
  { name: "ChangePassword", component: ChangePassword },
  { name: "Contact", component: Contact },
  { name: "AccountData", component: AccountData },
  { name: "BookingStep1", component: BookingStep1 },
  { name: "BookingStep2", component: BookingStep2 },
  { name: "BookingSummary", component: BookingSummary },
  { name: "PaymentResult", component: PaymentResult },
  { name: "BookingDetails", component: BookingDetails },
  { name: "CancelBooking", component: CancelBooking },
  { name: "CaregiverDetail", component: CaregiverDetail },
  { name: "Chat", component: Chat },
  { name: "VitalDetail", component: VitalDetail },
  { name: "AddVital", component: AddVital },
  { name: "VitalHistory", component: VitalHistory },
  { name: "VitalAccess", component: VitalAccess },
  { name: "FallAssessment", component: FallAssessment },
  { name: "FallResult", component: FallResult },
];

/** The unverified-email step: signed in, but only able to verify or sign out. */
export const VERIFY_SCREENS: ScreenDef[] = [{ name: "GateVerifyEmail", component: VerifyEmail }];
