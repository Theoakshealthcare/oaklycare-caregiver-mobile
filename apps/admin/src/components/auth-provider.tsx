"use client";

import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { ADMIN_AUTH_PATHS, type AdminProfile, type LoginResponse } from "@/lib/admin-auth-contract";
import { adminRequest } from "@/lib/api";
import {
  login as loginRequest,
  logoutSession,
  onSessionExpired,
  refreshSession,
  verifyMfa,
} from "@/lib/session";

export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const IDLE_WARN_AFTER_MS = 25 * 60 * 1000;

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "unreachable";

export interface AuthContextValue {
  status: AuthStatus;
  admin: AdminProfile | null;
  /** Why the admin is signed out, shown once on the login page. */
  notice: string | null;
  /** Seconds until idle sign-out while the warning is showing, else null. */
  idleSecondsLeft: number | null;
  can: (permission: string) => boolean;
  signIn: (email: string, password: string) => Promise<LoginResponse>;
  completeMfa: (mfaToken: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  staySignedIn: () => Promise<void>;
  retryBoot: () => void;
}

export const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

interface Props {
  children: React.ReactNode;
  idleLimitMs?: number;
  idleWarnAfterMs?: number;
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function AuthProvider({ children, idleLimitMs = IDLE_LIMIT_MS, idleWarnAfterMs = IDLE_WARN_AFTER_MS }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<AuthStatus>("loading");
  const [admin, setAdmin] = React.useState<AdminProfile | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [idleSecondsLeft, setIdleSecondsLeft] = React.useState<number | null>(null);
  // Bumped whenever a new access token is issued, to (re)schedule the proactive refresh.
  const [tokenEpoch, setTokenEpoch] = React.useState(0);
  const [expiresIn, setExpiresIn] = React.useState(900);
  const [bootAttempt, setBootAttempt] = React.useState(0);

  // Set whenever a session starts; only read while authenticated.
  const lastActivity = React.useRef(0);
  const activeSinceRefresh = React.useRef(true);
  const warningOpen = React.useRef(false);

  const endSession = React.useCallback(
    (message: string | null) => {
      setAdmin(null);
      setStatus("anonymous");
      setNotice(message);
      setIdleSecondsLeft(null);
      warningOpen.current = false;
      queryClient.clear();
    },
    [queryClient],
  );

  // Boot: restore the session from the httpOnly cookie via the BFF.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await refreshSession();
      if (cancelled) return;
      if (!result.ok) {
        if (result.reason === "expired") setStatus("anonymous");
        else setStatus("unreachable");
        return;
      }
      try {
        const profile =
          result.session.admin ?? (await adminRequest<AdminProfile>("GET", ADMIN_AUTH_PATHS.me));
        if (cancelled) return;
        setAdmin(profile);
        setExpiresIn(result.session.expires_in);
        lastActivity.current = Date.now();
        setStatus("authenticated");
      } catch {
        if (!cancelled) setStatus("anonymous");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  // A refresh that fails with 401 (from the HTTP clients) ends the session everywhere.
  React.useEffect(
    () => onSessionExpired(() => endSession("Your session expired. Sign in again to continue.")),
    [endSession],
  );

  // Activity tracking for the idle limit. While the warning is up, only the dialog buttons count.
  React.useEffect(() => {
    if (status !== "authenticated") return;
    const mark = () => {
      if (warningOpen.current) return;
      lastActivity.current = Date.now();
      activeSinceRefresh.current = true;
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, mark));
  }, [status]);

  // Idle warning, then sign-out at the limit.
  React.useEffect(() => {
    if (status !== "authenticated") return;
    const id = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= idleLimitMs) {
        void logoutSession();
        endSession("You were signed out after 30 minutes of inactivity.");
      } else if (idle >= idleWarnAfterMs) {
        warningOpen.current = true;
        setIdleSecondsLeft(Math.max(0, Math.ceil((idleLimitMs - idle) / 1000)));
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, idleLimitMs, idleWarnAfterMs, endSession]);

  // Keep the access token fresh while the admin is active. An idle admin lets it lapse on purpose:
  // the backend enforces the 30-minute idle limit through refresh.
  React.useEffect(() => {
    if (status !== "authenticated") return;
    const id = window.setTimeout(
      async () => {
        if (!activeSinceRefresh.current) return;
        activeSinceRefresh.current = false;
        const result = await refreshSession();
        if (result.ok) {
          setExpiresIn(result.session.expires_in);
          setTokenEpoch((n) => n + 1);
        } else if (result.reason === "expired") {
          endSession("Your session expired. Sign in again to continue.");
        }
      },
      Math.max(5, expiresIn * 0.8) * 1000,
    );
    return () => window.clearTimeout(id);
  }, [status, expiresIn, tokenEpoch, endSession]);

  const signIn = React.useCallback((email: string, password: string) => loginRequest(email, password), []);

  const completeMfa = React.useCallback(async (mfaToken: string, code: string) => {
    const session = await verifyMfa(mfaToken, code);
    const profile = session.admin ?? (await adminRequest<AdminProfile>("GET", ADMIN_AUTH_PATHS.me));
    setAdmin(profile);
    setExpiresIn(session.expires_in);
    lastActivity.current = Date.now();
    activeSinceRefresh.current = true;
    setNotice(null);
    setStatus("authenticated");
  }, []);

  const signOut = React.useCallback(async () => {
    await logoutSession();
    endSession(null);
  }, [endSession]);

  const staySignedIn = React.useCallback(async () => {
    const result = await refreshSession();
    if (result.ok) {
      warningOpen.current = false;
      lastActivity.current = Date.now();
      activeSinceRefresh.current = true;
      setIdleSecondsLeft(null);
      setExpiresIn(result.session.expires_in);
      setTokenEpoch((n) => n + 1);
    } else if (result.reason === "expired") {
      endSession("Your session expired. Sign in again to continue.");
    }
  }, [endSession]);

  const retryBoot = React.useCallback(() => {
    setStatus("loading");
    setBootAttempt((n) => n + 1);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      status,
      admin,
      notice,
      idleSecondsLeft,
      can: (permission) => !!admin?.permissions.includes(permission),
      signIn,
      completeMfa,
      signOut,
      staySignedIn,
      retryBoot,
    }),
    [status, admin, notice, idleSecondsLeft, signIn, completeMfa, signOut, staySignedIn, retryBoot],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
