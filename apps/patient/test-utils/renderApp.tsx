import { render, screen } from "@testing-library/react-native";

import { session } from "../src/auth";

import App from "../App";
import { patientUser, routeFetch, setIntroSeen, type FakeUser } from "./fakeApi";

type Routes = Parameters<typeof routeFetch>[0];

/** A signed-in patient on Home, answering `/auth/me` (plus any extra routes the test needs). Returns the call log and unmount. */
export async function renderSignedIn(extra: Routes = {}, user: FakeUser = patientUser) {
  await session.signOut();
  await setIntroSeen(true);
  await session.signIn({ accessToken: "access-stored", refreshToken: "refresh-stored" });
  const calls = routeFetch({ "GET /api/v1/auth/me": () => ({ status: 200, body: user }), ...extra });
  const view = await render(<App />);
  await screen.findByText(`Hello, ${user.full_name.split(" ")[0]}`);
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
  await screen.findByText(/Enter the 5-digit code we sent to/);
  return { calls, view };
}

/** A signed-out app past the intro, on Login. */
export async function renderSignedOut(routes: Routes = {}) {
  await session.signOut();
  await setIntroSeen(true);
  const calls = routeFetch(routes);
  const view = await render(<App />);
  await screen.findByText("Sign in to your Oakly Health account");
  return { calls, view };
}
