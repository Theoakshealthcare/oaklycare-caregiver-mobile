import { createStackNavigator, type StackNavigationOptions } from "@react-navigation/stack";
import { useState } from "react";

import { useSession } from "../auth";
import { useOnboarding } from "../auth/onboarding";
import { useMe } from "../hooks/queries";
import { usePushEffects } from "../push/native";
import GateMessage from "../screens/GateMessage";
import Splash from "../screens/Splash";
import { authService } from "../services/auth.service";
import { resolveGate } from "./gate";
import type { ScreenParamLists } from "./Navigations";
import { APP_SCREENS, AUTH_SCREENS, VERIFY_SCREENS, type ScreenDef } from "./routes";

const Stack = createStackNavigator<ScreenParamLists>();

const signOut = () => void authService.logout();

/** Push registration and tap handling for the signed-in app; renders nothing. */
const PushEffects = () => {
  usePushEffects();
  return null;
};

/** Screens drawn over the page before them (the booking details sheet, the cancel dialogs), as the designs show them. */
const OVERLAYS: Partial<Record<keyof ScreenParamLists, StackNavigationOptions>> = {
  BookingDetails: { presentation: "transparentModal", animation: "slide_from_bottom", cardStyle: { backgroundColor: "transparent" } },
  CancelBooking: { presentation: "transparentModal", animation: "fade", cardStyle: { backgroundColor: "transparent" } },
};

const screens = (defs: ScreenDef[]) =>
  defs.map((def) => <Stack.Screen key={def.name} name={def.name} component={def.component} options={OVERLAYS[def.name]} />);

/** The signed-out stack opens on the intro slides once per install, else on Login. Fixed when the stack first mounts. */
const SignedOutStack = () => {
  const onboarding = useOnboarding((s) => s.status);
  const [initial] = useState<"Onboarding" | "Login">(onboarding === "unseen" ? "Onboarding" : "Login");
  return (
    <Stack.Navigator key="signedOut" initialRouteName={initial} screenOptions={{ headerShown: false }}>
      {screens(AUTH_SCREENS)}
    </Stack.Navigator>
  );
};

const StackNavigator = () => {
  const sessionStatus = useSession((s) => s.status);
  const onboarding = useOnboarding((s) => s.status);
  const me = useMe();
  const gate = resolveGate({ session: sessionStatus, me: { data: me.data, isError: me.isError } });

  switch (gate.kind) {
    case "loading":
      return <Splash />;
    case "error":
      return (
        <GateMessage
          title="We couldn't load your account"
          message="Check your internet connection and try again."
          actionLabel="Try again"
          onAction={() => void me.refetch()}
          onSignOut={signOut}
        />
      );
    case "wrongAccount":
      return (
        <GateMessage
          title="This app is for patients and families"
          message="You're signed in with a different type of account. Please use the correct Oakly app, or sign in with a patient account."
          onSignOut={signOut}
        />
      );
    case "verifyEmail":
      return (
        <Stack.Navigator
          key="verifyEmail"
          initialRouteName="GateVerifyEmail"
          screenOptions={{ headerShown: false }}
        >
          {VERIFY_SCREENS.map((def) => (
            <Stack.Screen key={def.name} name={def.name} component={def.component} initialParams={{ email: gate.email }} />
          ))}
        </Stack.Navigator>
      );
    case "signedOut":
      // Wait for the stored "intro seen" flag so the first frame is the right one.
      return onboarding === "unknown" ? <Splash /> : <SignedOutStack />;
    case "app":
      return (
        <>
          <PushEffects />
          <Stack.Navigator key="app" initialRouteName="Tabs" screenOptions={{ headerShown: false }}>
            {screens(APP_SCREENS)}
          </Stack.Navigator>
        </>
      );
  }
};

export default StackNavigator;
