import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Login from "../screens/auth/Login";
import OnboardingScreen from "../screens/onboarding-screen";
import VerifyEmail from "../screens/auth/VerifyEmail";
import CreateAccount from "../screens/auth/CreateAccount";
import AccountCreated from "../screens/auth/AccountCreated";
import RecoverPassword from "../screens/auth/RecoverPassword";
import ResetPassword from "../screens/auth/ResetPassword";

const Stack = createNativeStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="CreateAccount" component={CreateAccount} />
      <Stack.Screen name="AccountCreated" component={AccountCreated} />
      <Stack.Screen name="RecoverPassword" component={RecoverPassword} />
      <Stack.Screen name="ResetPassword" component={ResetPassword} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
