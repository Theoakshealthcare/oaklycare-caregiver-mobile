import { createStackNavigator } from "@react-navigation/stack";

import { useSession } from "../auth";
import { useMe, useVerificationStatus } from "../hooks/queries";
import BankDetails from "../screens/account/BankDetails";
import Contact from "../screens/account/Contact";
import EditProfile from "../screens/account/EditProfile";
import Notifications from "../screens/account/Notifications";
import Profile from "../screens/account/Profile";
import Wallet from "../screens/account/Wallet";
import AccountCreated from "../screens/auth/AccountCreated";
import CreateAccount from "../screens/auth/CreateAccount";
import Login from "../screens/auth/Login";
import RecoverPassword from "../screens/auth/RecoverPassword";
import ResetPassword from "../screens/auth/ResetPassword";
import VerifyEmail from "../screens/auth/VerifyEmail";
import AINoteTaker from "../screens/chat/AINoteTaker";
import CallScreen from "../screens/chat/CallScreen";
import ChatScreen from "../screens/chat/ChatScreen";
import BookingDetails from "../screens/booking/BookingDetails";
import VisitFlow from "../screens/visit/VisitFlow";
import AddVitals from "../screens/vitals/AddVitals";
import VitalDetail from "../screens/vitals/VitalDetail";
import GateMessage from "../screens/GateMessage";
import OnboardingScreen from "../screens/onboarding-screen";
import CaregiverSetupStep1 from "../screens/setup/CaregiverSetupStep1";
import CaregiverSetupStep2 from "../screens/setup/CaregiverSetupStep2";
import ConsentScreen from "../screens/setup/ConsentScreen";
import VerificationStatusScreen from "../screens/setup/VerificationStatus";
import SplashScreen from "../screens/splash-screen";
import { authService } from "../services/auth.service";
import AppRuntime from "./AppRuntime";
import BottomNavigation from "./BottomNavigation";
import { resolveGate, type Gate } from "./gate";
import type { ScreenParamLists } from "./Navigations";

const Stack = createStackNavigator<ScreenParamLists>();

function useGate(): { gate: Gate; retry: () => void } {
  const sessionStatus = useSession((s) => s.status);
  const me = useMe();
  const verified = me.data?.user_type === "caregiver" && me.data.is_verified;
  const status = useVerificationStatus(verified);
  const gate = resolveGate({
    session: sessionStatus,
    me: { data: me.data, isError: me.isError },
    status: { data: status.data, isError: status.isError },
  });
  return {
    gate,
    retry: () => {
      void me.refetch();
      void status.refetch();
    },
  };
}

const StackNavigator = () => {
  const { gate, retry } = useGate();

  switch (gate.kind) {
    case "loading":
      return <SplashScreen />;
    case "error":
      return (
        <GateMessage
          title="We couldn't load your account"
          message="Check your internet connection and try again."
          actionLabel="Try again"
          onAction={retry}
          onSignOut={() => void authService.logout()}
        />
      );
    case "wrongAccount":
      return (
        <GateMessage
          title="This app is for caregivers"
          message="You're signed in with a different type of account. Please use the correct Oakly app, or sign in with a caregiver account."
          onSignOut={() => void authService.logout()}
        />
      );
    case "signedOut":
      return (
        <Stack.Navigator key="signedOut" screenOptions={{ headerShown: false }} initialRouteName="Onboarding">
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={Login} />
          <Stack.Screen name="CreateAccount" component={CreateAccount} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
          <Stack.Screen name="AccountCreated" component={AccountCreated} />
          <Stack.Screen name="RecoverPassword" component={RecoverPassword} />
          <Stack.Screen name="ResetPassword" component={ResetPassword} />
        </Stack.Navigator>
      );
    case "verifyEmail":
      return (
        <Stack.Navigator key="verifyEmail" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="VerifyEmail" component={VerifyEmail} initialParams={{ email: gate.email }} />
        </Stack.Navigator>
      );
    case "setup":
      return (
        <Stack.Navigator key="setup" screenOptions={{ headerShown: false }} initialRouteName={gate.initialRoute}>
          <Stack.Screen name="CaregiverSetupStep1" component={CaregiverSetupStep1} />
          <Stack.Screen name="CaregiverSetupStep2" component={CaregiverSetupStep2} />
          <Stack.Screen name="ConsentScreen" component={ConsentScreen} />
        </Stack.Navigator>
      );
    case "status":
      return (
        <Stack.Navigator key="status" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="VerificationStatus" component={VerificationStatusScreen} />
          {/* When an admin asks for changes the caregiver edits their details, then resubmits consent. */}
          <Stack.Screen name="CaregiverSetupStep1" component={CaregiverSetupStep1} />
          <Stack.Screen name="CaregiverSetupStep2" component={CaregiverSetupStep2} />
        </Stack.Navigator>
      );
    case "app":
      return (
        <>
          <Stack.Navigator key="app" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="BottomNavigation" component={BottomNavigation} />
            <Stack.Screen name="BookingDetails" component={BookingDetails} />
            <Stack.Screen name="VisitFlow" component={VisitFlow} />
            <Stack.Screen name="ChatScreen" component={ChatScreen} />
            <Stack.Screen name="CallScreen" component={CallScreen} />
            <Stack.Screen name="AINoteTaker" component={AINoteTaker} />
            <Stack.Screen name="Notifications" component={Notifications} />
            <Stack.Screen name="Profile" component={Profile} />
            <Stack.Screen name="EditProfile" component={EditProfile} />
            <Stack.Screen name="Wallet" component={Wallet} />
            <Stack.Screen name="BankDetails" component={BankDetails} />
            <Stack.Screen name="Contact" component={Contact} />
            <Stack.Screen name="VitalDetail" component={VitalDetail} />
            <Stack.Screen name="AddVitals" component={AddVitals} />
          </Stack.Navigator>
          {/* Location tracking, push-tap routing and the in-app banner: approved caregivers only. */}
          <AppRuntime />
        </>
      );
  }
};

export default StackNavigator;
