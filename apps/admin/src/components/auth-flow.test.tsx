import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth-provider";
import { LoginFlow } from "@/components/login-flow";
import { adminRequest } from "@/lib/api";
import { setAccessToken } from "@/lib/session";
import { jsonResponse, makeAdmin } from "@/test/helpers";

vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,AAAA" } }));

const ADMIN = makeAdmin(["dashboard.read", "caregivers.read"]);
const SESSION = { access_token: "access-1", expires_in: 900, admin: ADMIN };

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

/** Route fetch calls by `METHOD path`; unknown routes fail the test loudly. */
function mockFetch(routes: Record<string, Handler>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    calls.push({ url, init });
    const handler = routes[`${init?.method ?? "GET"} ${url}`];
    if (!handler) throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
    return handler(init);
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

function Harness({ onSignedIn = () => {} }: { onSignedIn?: () => void }) {
  const { status, notice } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="notice">{notice}</p>
      <LoginFlow onSignedIn={onSignedIn} />
    </div>
  );
}

function renderApp(ui: React.ReactElement, providerProps: React.ComponentProps<typeof AuthProvider> = { children: null }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider {...providerProps}>{ui}</AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => setAccessToken(null));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sign-in", () => {
  it("logs in, asks for the MFA code, and signs in without exposing the refresh token", async () => {
    const calls = mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({ detail: "No session" }, { status: 401 }),
      "POST /api/v1/admin/auth/login": () => jsonResponse({ mfa_required: true, mfa_token: "mfa-tok" }),
      "POST /api/auth/mfa/verify": () => jsonResponse(SESSION),
    });
    const onSignedIn = vi.fn();
    const user = userEvent.setup();
    renderApp(<Harness onSignedIn={onSignedIn} />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.type(await screen.findByLabelText("Authentication code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    const verify = calls.find((c) => c.url === "/api/auth/mfa/verify");
    expect(JSON.parse(String(verify?.init?.body))).toEqual({ mfa_token: "mfa-tok", code: "123456" });
    // The verify call goes to the BFF, never straight to the backend's token endpoint.
    expect(calls.some((c) => c.url === "/api/v1/admin/auth/mfa/verify")).toBe(false);
  });

  it("shows the QR and manual secret on first-time enrollment, then completes", async () => {
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({}, { status: 401 }),
      "POST /api/v1/admin/auth/login": () =>
        jsonResponse({
          mfa_enrollment_required: true,
          mfa_token: "mfa-tok",
          otpauth_uri: "otpauth://totp/Oakly:ada@example.test?secret=PLACEHOLDERSECRET&issuer=Oakly",
          secret: "PLACEHOLDERSECRET",
        }),
      "POST /api/auth/mfa/verify": () => jsonResponse(SESSION),
    });
    const onSignedIn = vi.fn();
    const user = userEvent.setup();
    renderApp(<Harness onSignedIn={onSignedIn} />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByTestId("mfa-secret")).toHaveTextContent("PLACEHOLDERSECRET");
    expect(await screen.findByAltText(/QR code/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Code from the app"), "654321");
    await user.click(screen.getByRole("button", { name: "Verify and finish setup" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
  });

  it("explains a wrong code and lets the admin retry or start over", async () => {
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({}, { status: 401 }),
      "POST /api/v1/admin/auth/login": () => jsonResponse({ mfa_required: true, mfa_token: "mfa-tok" }),
      "POST /api/auth/mfa/verify": () => jsonResponse({ detail: "Invalid code" }, { status: 401 }),
    });
    const user = userEvent.setup();
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Authentication code"), "000000");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code didn't work");
    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("tells the admin how long a lockout lasts (423 + Retry-After)", async () => {
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({}, { status: 401 }),
      "POST /api/v1/admin/auth/login": () =>
        jsonResponse({ detail: "Account locked" }, { status: 423, headers: { "retry-after": "900" } }),
    });
    const user = userEvent.setup();
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 15 minutes");
  });
});

describe("session restore and refresh failure", () => {
  it("restores the session on load from the BFF refresh", async () => {
    mockFetch({ "POST /api/auth/refresh": () => jsonResponse(SESSION) });
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
  });

  it("goes to signed-out when the refresh on load is rejected", async () => {
    mockFetch({ "POST /api/auth/refresh": () => jsonResponse({ detail: "expired" }, { status: 401 }) });
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
  });

  it("keeps the admin signed in (and reports it) when the BFF is unreachable on load", async () => {
    mockFetch({ "POST /api/auth/refresh": () => jsonResponse({ detail: "down" }, { status: 502 }) });
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unreachable"));
  });

  it("signs out with a notice when a 401 can't be recovered by refresh", async () => {
    let refreshes = 0;
    mockFetch({
      "POST /api/auth/refresh": () => {
        refreshes += 1;
        return refreshes === 1 ? jsonResponse(SESSION) : jsonResponse({ detail: "revoked" }, { status: 401 });
      },
      "GET /api/v1/admin/anything": () => jsonResponse({ detail: "Not authenticated" }, { status: 401 }),
    });
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await act(async () => {
      await adminRequest("GET", "/api/v1/admin/anything").catch(() => undefined);
    });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("notice")).toHaveTextContent("session expired");
  });

  it("retries a 401 once with the refreshed token", async () => {
    let refreshes = 0;
    const seen: (string | null)[] = [];
    mockFetch({
      "POST /api/auth/refresh": () => {
        refreshes += 1;
        return jsonResponse({ access_token: `access-${refreshes}`, expires_in: 900, admin: ADMIN });
      },
      "GET /api/v1/admin/thing": (init) => {
        const auth = new Headers(init?.headers).get("authorization");
        seen.push(auth);
        return auth === "Bearer access-2" ? jsonResponse({ ok: true }) : jsonResponse({}, { status: 401 });
      },
    });
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    let result: unknown;
    await act(async () => {
      result = await adminRequest("GET", "/api/v1/admin/thing");
    });
    expect(result).toEqual({ ok: true });
    expect(seen).toEqual(["Bearer access-1", "Bearer access-2"]);
  });
});

describe("idle timeout", () => {
  it("warns before the limit and signs out at it", async () => {
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse(SESSION),
      "POST /api/auth/logout": () => new Response(null, { status: 204 }),
    });
    vi.useFakeTimers({ shouldAdvanceTime: false });
    function Probe() {
      const { status, idleSecondsLeft, notice } = useAuth();
      return <p data-testid="probe">{`${status}|${idleSecondsLeft}|${notice ?? ""}`}</p>;
    }
    renderApp(<Probe />, { children: null, idleWarnAfterMs: 5_000, idleLimitMs: 8_000 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("authenticated|null");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_500);
    });
    expect(screen.getByTestId("probe").textContent).toMatch(/^authenticated\|[1-3]\|/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByTestId("probe").textContent).toMatch(/^anonymous\|null\|You were signed out/);
  });
});
