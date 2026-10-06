import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth-provider";
import { LoginFlow } from "@/components/login-flow";
import { getApi, unwrap } from "@/lib/api";
import { setAccessToken } from "@/lib/session";
import { jsonResponse, makeAdmin } from "@/test/helpers";

vi.mock("qrcode", () => ({ default: { toDataURL: async () => "data:image/png;base64,AAAA" } }));

const ADMIN = makeAdmin(["dashboard.read", "caregivers.read"]);
const SESSION = { access_token: "access-1", expires_in: 900, admin: ADMIN };
/** The refresh response carries no `admin` (guide 4.1); the console reads /admin/me. */
const REFRESHED = { access_token: "access-1", expires_in: 900 };
const ME = () => jsonResponse(ADMIN);

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

/** Route fetch calls by `METHOD path`; unknown routes fail the test loudly. */
function mockFetch(routes: Record<string, Handler>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(raw, "http://console.test");
    const url = parsed.pathname + parsed.search;
    init = { ...init, method: init?.method ?? (typeof input === "object" && "method" in input ? input.method : undefined), headers: init?.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined) };
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

  it("shows the lockout's Retry-After in hours when it is long (423, up to 86400)", async () => {
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({}, { status: 401 }),
      "POST /api/v1/admin/auth/login": () =>
        jsonResponse({ detail: "Account temporarily locked. Try again later." }, { status: 423, headers: { "retry-after": "86400" } }),
    });
    const user = userEvent.setup();
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("locked");
    expect(alert).toHaveTextContent("24 hours");
    expect(alert).toHaveTextContent("Super Admin");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("throttles wrong passwords (429 + Retry-After): counts down, disables the form, and says nothing about the email", async () => {
    let logins = 0;
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({}, { status: 401 }),
      "POST /api/v1/admin/auth/login": () => {
        logins += 1;
        return jsonResponse({ detail: "Too many requests. Try again later." }, { status: 429, headers: { "retry-after": "2" } });
      },
    });
    const user = userEvent.setup();
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    await user.type(screen.getByLabelText("Email"), "nobody@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Too many attempts. Try again in 2 seconds.");
    expect(alert.textContent).not.toMatch(/exist|account|registered|not found/i);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    // Typing the password again must not re-enable the button, and Enter must not resubmit.
    await user.type(screen.getByLabelText("Password"), "x{Enter}");
    expect(logins).toBe(1);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Try again in 1 second."), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("sends the admin back to the password step when the MFA token was spent or expired", async () => {
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({}, { status: 401 }),
      "POST /api/v1/admin/auth/login": () => jsonResponse({ mfa_required: true, mfa_token: "mfa-tok" }),
      "POST /api/auth/mfa/verify": () => jsonResponse({ detail: "Invalid or expired MFA token" }, { status: 401 }),
    });
    const user = userEvent.setup();
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Authentication code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));

    // Not another code prompt: the password step, with a reason and the email kept.
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Authentication code")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/sign-in timed out|already used/i);
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.test");
  });

  it("tells the admin to wait for the next code when a code is refused", async () => {
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({}, { status: 401 }),
      "POST /api/v1/admin/auth/login": () => jsonResponse({ mfa_required: true, mfa_token: "mfa-tok" }),
      "POST /api/auth/mfa/verify": () => jsonResponse({ detail: "Invalid verification code" }, { status: 401 }),
    });
    const user = userEvent.setup();
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Authentication code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("wait for the next code");
    expect(screen.getByLabelText("Authentication code")).toBeInTheDocument();
  });

  it("applies the per-IP 429 on the code step too, and shows a lock (423) with its Retry-After", async () => {
    let verifies = 0;
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse({}, { status: 401 }),
      "POST /api/v1/admin/auth/login": () => jsonResponse({ mfa_required: true, mfa_token: "mfa-tok" }),
      "POST /api/auth/mfa/verify": () => {
        verifies += 1;
        return verifies === 1
          ? jsonResponse({ detail: "Too many requests. Try again later." }, { status: 429, headers: { "retry-after": "45" } })
          : jsonResponse({ detail: "Account temporarily locked. Try again later." }, { status: 423, headers: { "retry-after": "3600" } });
      },
    });
    const user = userEvent.setup();
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    await user.type(screen.getByLabelText("Email"), "ada@example.test");
    await user.type(screen.getByLabelText("Password"), "placeholder-password");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Authentication code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 45 seconds");
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });
});

describe("session restore and refresh failure", () => {
  it("restores the session on load from the BFF refresh", async () => {
    mockFetch({ "POST /api/auth/refresh": () => jsonResponse(REFRESHED), "GET /api/v1/admin/me": ME });
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
        return refreshes === 1 ? jsonResponse(REFRESHED) : jsonResponse({ detail: "Invalid or expired refresh token" }, { status: 401 });
      },
      "GET /api/v1/admin/me": (init) =>
        new Headers(init?.headers).get("authorization") === "Bearer access-1" && refreshes === 1
          ? jsonResponse(ADMIN)
          : jsonResponse({ detail: "Could not validate credentials" }, { status: 401 }),
      "GET /api/v1/admin/admins": () => jsonResponse({ detail: "Could not validate credentials" }, { status: 401 }),
    });
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await act(async () => {
      await getApi().GET("/api/v1/admin/admins");
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
        return jsonResponse({ access_token: `access-${refreshes}`, expires_in: 900 });
      },
      "GET /api/v1/admin/me": ME,
      "GET /api/v1/admin/admins": (init) => {
        const auth = new Headers(init?.headers).get("authorization");
        seen.push(auth);
        return auth === "Bearer access-2" ? jsonResponse([]) : jsonResponse({}, { status: 401 });
      },
    });
    renderApp(<Harness />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    let result: unknown;
    await act(async () => {
      result = unwrap(await getApi().GET("/api/v1/admin/admins"));
    });
    expect(result).toEqual([]);
    expect(seen).toEqual(["Bearer access-1", "Bearer access-2"]);
  });
});

describe("refresh single-flight (a second refresh with the same token revokes every session)", () => {
  it("shares one BFF call between simultaneous 401 recoveries and the proactive refresh", async () => {
    let refreshes = 0;
    mockFetch({
      "POST /api/auth/refresh": async () => {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 20));
        return jsonResponse({ access_token: `access-${refreshes}`, expires_in: 900 });
      },
    });
    const { refreshSession, recoverFromUnauthorized } = await import("@/lib/session");
    const results = await Promise.all([
      refreshSession(),
      refreshSession(),
      recoverFromUnauthorized(),
      recoverFromUnauthorized(),
      refreshSession(),
    ]);
    expect(refreshes).toBe(1);
    expect(results.map((r) => (r === null || typeof r === "string" ? r : r.ok && r.session.access_token))).toEqual([
      "access-1",
      "access-1",
      "access-1",
      "access-1",
      "access-1",
    ]);
    // A later refresh (after the first settled) is a new call.
    await refreshSession();
    expect(refreshes).toBe(2);
  });

  it("does not retry a failed refresh", async () => {
    let refreshes = 0;
    mockFetch({
      "POST /api/auth/refresh": () => {
        refreshes += 1;
        return jsonResponse({ detail: "Oakly API is unreachable" }, { status: 502 });
      },
    });
    const { refreshSession } = await import("@/lib/session");
    const result = await refreshSession();
    expect(result).toEqual({ ok: false, reason: "unreachable" });
    expect(refreshes).toBe(1);
  });
});

describe("idle timeout", () => {
  it("warns before the limit and signs out at it", async () => {
    mockFetch({
      "POST /api/auth/refresh": () => jsonResponse(REFRESHED),
      "GET /api/v1/admin/me": ME,
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
