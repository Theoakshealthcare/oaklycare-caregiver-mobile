import { createStackNavigator } from "@react-navigation/stack";
import BottomNavigation from "./BottomNavigation";
import AccountCreated from "../screens/auth/AccountCreated";
import CreateAccount from "../screens/auth/CreateAccount";
import Login from "../screens/auth/Login";
import RecoverPassword from "../screens/auth/RecoverPassword";
import ResetPassword from "../screens/auth/ResetPassword";
import VerifyEmail from "../screens/auth/VerifyEmail";
import OnboardingScreen from "../screens/onboarding-screen";
import CaregiverSetupStep1 from "../screens/setup/CaregiverSetupStep1";
import CaregiverSetupStep2 from "../screens/setup/CaregiverSetupStep2";
import IdentityVerification from "../screens/setup/IdentityVerification";
import ConsentScreen from "../screens/setup/ConsentScreen";
import ProfileCompleted from "../screens/setup/ProfileCompleted";
import DocumentScan from "../screens/setup/DocumentScan";

const Stack = createStackNavigator();

const StackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Onboarding">
      {/* Auth */}
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="CreateAccount" component={CreateAccount} />
      <Stack.Screen name="AccountCreated" component={AccountCreated} />
      <Stack.Screen name="RecoverPassword" component={RecoverPassword} />
      <Stack.Screen name="ResetPassword" component={ResetPassword} />
      <Stack.Screen name="CaregiverSetupStep1" component={CaregiverSetupStep1} />
      <Stack.Screen name="CaregiverSetupStep2" component={CaregiverSetupStep2} />
      <Stack.Screen name="IdentityVerification" component={IdentityVerification} />
      <Stack.Screen name="ConsentScreen" component={ConsentScreen} />
      <Stack.Screen name="ProfileCompleted" component={ProfileCompleted} />
      <Stack.Screen name="DocumentScan" component={DocumentScan} />
      
      <Stack.Screen name="BottomNavigation" component={BottomNavigation} />

    </Stack.Navigator>
  );
};

export default StackNavigator;
