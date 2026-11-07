import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";

import HeaderBack from "../src/components/back/HeaderBack";

const Stack = createStackNavigator();

const First = ({ navigation }: { navigation: { navigate: (name: string) => void } }) => (
  <View>
    <HeaderBack />
    <Text onPress={() => navigation.navigate("Second")}>go second</Text>
    <Text>first screen</Text>
  </View>
);
const Second = () => (
  <View>
    <HeaderBack />
    <Text>second screen</Text>
  </View>
);

describe("HeaderBack (DP2-07)", () => {
  async function renderStack() {
    return await render(
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, animation: "none" }}>
          <Stack.Screen name="First" component={First as never} />
          <Stack.Screen name="Second" component={Second} />
        </Stack.Navigator>
      </NavigationContainer>,
    );
  }

  it("draws no Back arrow on the first screen of a stack (Login after a sign-out, onboarding step 1)", async () => {
    await renderStack();
    expect(screen.getByText("first screen")).toBeTruthy();
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("draws Back once there is history, and it goes back", async () => {
    await renderStack();
    await fireEvent.press(screen.getByText("go second"));
    expect(await screen.findByText("second screen")).toBeTruthy();
    await fireEvent.press(screen.getAllByText("Back")[0] as never);
    expect(await screen.findByText("first screen")).toBeTruthy();
  });
});
