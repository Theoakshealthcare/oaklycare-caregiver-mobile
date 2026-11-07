import { createStackNavigator } from "@react-navigation/stack";

import { useSession } from "../auth";
import { useMe } from "../hooks/queries";
import GateMessage from "../screens/GateMessage";
import Home from "../screens/Home";
import Login from "../screens/Login";
import Splash from "../screens/Splash";
import { authService } from "../services/auth.service";
import { resolveGate } from "./gate";

type ScreenParamLists = {
  Login: undefined;
  Home: undefined;
};

const Stack = createStackNavigator<ScreenParamLists>();

const signOut = () => void authService.logout();

const StackNavigator = () => {
  const sessionStatus = useSession((s) => s.status);
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
        <GateMessage
          title="Verify your email"
          message={`Email verification isn't available in the app yet${gate.email ? ` (${gate.email})` : ""}. It arrives in the next update.`}
          onSignOut={signOut}
        />
      );
    case "signedOut":
      return (
        <Stack.Navigator key="signedOut" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
        </Stack.Navigator>
      );
    case "app":
      return (
        <Stack.Navigator key="app" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={Home} />
        </Stack.Navigator>
      );
  }
};

export default StackNavigator;
