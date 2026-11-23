import { fireEvent, render, screen } from "@testing-library/react-native";

import { session } from "../src/auth";

import App from "../App";
import { patientUser, routeFetch, setIntroSeen, type FakeUser } from "./fakeApi";
import { liveReply } from "./live";

type Routes = Parameters<typeof routeFetch>[0];

/** A signed-in patient on Home, answering `/auth/me` (plus any extra routes the test needs). Returns the call log and unmount. */
export async function renderSignedIn(extra: Routes = {}, user: FakeUser = patientUser) {
  await session.signOut();
  await setIntroSeen(true);
  await session.signIn({ accessToken: "access-stored", refreshToken: "refresh-stored" });
  // The bell reads the (real, captured) empty feed unless a test routes its own.
  const calls = routeFetch({
    "GET /api/v1/auth/me": () => ({ status: 200, body: user }),
    "GET /api/v1/patient/notifications": () => liveReply("feed-empty"),
    "GET /api/v1/booking/patient/bookings": () => ({ status: 200, body: [] }),
    ...extra,
  });
  const view = await render(<App />);
  await screen.findByText(new RegExp(`Hello ${user.full_name.split(" ")[0]},`));
  return { calls, view };
}

/** A signed-in patient whose email is not verified: the app opens on the verify step. */
export async function renderUnverified(extra: Routes = {}) {
  await session.signOut();
  await setIntroSeen(true);
  await session.signIn({ accessToken: "access-stored", refreshToken: "refresh-stored" });
  const calls = routeFetch({
    "GET /api/v1/auth/me": () => ({ status: 200, body: { ...patientUser, is_verified: false } }),
    ...extra,
  });
  const view = await render(<App />);
  await screen.findByText(/Enter the OTP code sent to your mail/);
  return { calls, view };
}

/** A signed-out app past the intro, on Login. */
export async function renderSignedOut(routes: Routes = {}) {
  await session.signOut();
  await setIntroSeen(true);
  const calls = routeFetch(routes);
  const view = await render(<App />);
  await screen.findByLabelText("Input Password");
  return { calls, view };
}

/**
 * From Login to the sign-up form the way a person gets there: Back to the welcome slides, then Get Started. (Figma's Login has
 * no "create account" link.) The four slides each draw their own button, so the first one is pressed.
 */
export async function openCreateAccount() {
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press((await screen.findAllByRole("button", { name: "Get Started" }))[0]);
  await screen.findByLabelText("Full Name");
}
