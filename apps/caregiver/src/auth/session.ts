/**
 * The auth state machine: token persistence, restore on launch, single-flight refresh and sign-out.
 *
 * It owns tokens only. Who the user is, and what they may see, comes from GET /auth/me and
 * GET /caregiver/verification-status (see `src/navigation/AuthGate.tsx`).
 *
 *   restoring --restore()--> signedIn   (tokens found in secure storage)
 *                       \--> signedOut  (nothing stored, or storage unreadable)
 *   signedOut --signIn(tokens)--> signedIn
 *   signedIn  --signOut()--> signedOut
 *   signedIn  --refresh() rejected by the server--> signedOut
 *
 * `refresh()` is single-flight: every 401 that arrives while a refresh is running awaits the same
 * request, so a burst of parallel calls costs one POST /auth/refresh and never races the rotation.
 */
import { createStore, type StoreApi } from "zustand/vanilla";

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export type SessionStatus = "restoring" | "signedOut" | "signedIn";

export interface SessionState {
  status: SessionStatus;
  tokens: SessionTokens | null;
}

export interface TokenStorage {
  load(): Promise<SessionTokens | null>;
  save(tokens: SessionTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionDeps {
  storage: TokenStorage;
  /**
   * Exchanges a refresh token for new tokens. Resolves null when the server REJECTS the token
   * (the session is over); rejects when the request could not be made (offline), which must not
   * sign the caregiver out.
   */
  refreshRequest(refreshToken: string): Promise<SessionTokens | null>;
  /** Runs after the session is cleared (drop cached queries, forget per-user state). */
  onSignedOut?: () => void;
}

export interface Session {
  store: StoreApi<SessionState>;
  restore(): Promise<void>;
  signIn(tokens: SessionTokens): Promise<void>;
  signOut(): Promise<void>;
  /** New access token, or null when the session could not be renewed. */
  refresh(): Promise<string | null>;
  getAccessToken(): string | null;
}

export function createSession(deps: SessionDeps): Session {
  const store = createStore<SessionState>(() => ({ status: "restoring", tokens: null }));
  let inflight: Promise<string | null> | null = null;

  async function persist(tokens: SessionTokens): Promise<void> {
    try {
      await deps.storage.save(tokens);
    } catch {
      // Keychain write failed: the session still works in memory, it just will not survive a restart.
    }
  }

  async function signOut(): Promise<void> {
    store.setState({ status: "signedOut", tokens: null });
    try {
      await deps.storage.clear();
    } catch {
      // Nothing more to do; the in-memory session is already gone.
    }
    deps.onSignedOut?.();
  }

  async function runRefresh(): Promise<string | null> {
    const current = store.getState().tokens;
    if (!current) return null;
    let next: SessionTokens | null;
    try {
      next = await deps.refreshRequest(current.refreshToken);
    } catch {
      // Offline or server down: keep the session, let the caller's 401 surface.
      return null;
    }
    if (!next) {
      await signOut();
      return null;
    }
    // A sign-out while the refresh was in flight wins.
    if (store.getState().status !== "signedIn") return null;
    store.setState({ tokens: next });
    await persist(next);
    return next.accessToken;
  }

  return {
    store,
    async restore() {
      let tokens: SessionTokens | null = null;
      try {
        tokens = await deps.storage.load();
      } catch {
        tokens = null;
      }
      store.setState(tokens ? { status: "signedIn", tokens } : { status: "signedOut", tokens: null });
    },
    async signIn(tokens) {
      store.setState({ status: "signedIn", tokens });
      await persist(tokens);
    },
    signOut,
    refresh() {
      if (!inflight) {
        inflight = runRefresh().finally(() => {
          inflight = null;
        });
      }
      return inflight;
    },
    getAccessToken: () => store.getState().tokens?.accessToken ?? null,
  };
}
