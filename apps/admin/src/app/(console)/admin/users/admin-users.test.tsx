import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, withAuth } from "@/test/helpers";

import { AdminUsers } from "./admin-users";

// Shapes copied from the backend's live captures (045-admins-list, 025-invite); ids and tokens are placeholders.
const BOSS = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "boss@example.test",
  full_name: "Placeholder Super Admin",
  status: "active",
  mfa_enabled: true,
  roles: ["super_admin"],
  last_login_at: "2026-10-06T14:08:30.524504",
  locked_until: null,
  created_at: "2026-10-06T14:07:44.515392",
};
const VERIFIER = { ...BOSS, id: "00000000-0000-0000-0000-000000000002", email: "v@example.test", full_name: "Placeholder Verifier", roles: ["verification"], last_login_at: null };
const INVITED = {
  ...VERIFIER,
  id: "00000000-0000-0000-0000-000000000003",
  email: "new@example.test",
  full_name: "Placeholder New",
  status: "invited",
  mfa_enabled: false,
  invite_token: "PLACEHOLDER-INVITE-TOKEN",
  invite_expires_at: "2026-10-08T14:09:01.527034",
};

afterEach(() => vi.unstubAllGlobals());

function stubFetch(handlers: Record<string, (req: Request) => Response>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const key = `${input.method} ${new URL(input.url).pathname}`;
      calls.push(key);
      const h = handlers[key];
      if (!h) throw new Error(`Unexpected fetch ${key}`);
      return h(input);
    }),
  );
  return calls;
}

describe("AdminUsers", () => {
  it("lists admins from the bare array and won't offer to disable the last active Super Admin", async () => {
    stubFetch({ "GET /api/v1/admin/admins": () => jsonResponse([BOSS, VERIFIER]) });
    render(withAuth(["admins.manage"], <AdminUsers />, { admin: { ...BOSS, permissions: ["admins.manage"] } }));
    const row = await screen.findByRole("row", { name: /Placeholder Verifier/ });
    expect(within(row).getByRole("button", { name: /Disable/ })).toBeEnabled();
    // The boss row is "(you)", so no disable there; sign in as someone else to see the last-super-admin guard.
    expect(screen.getByText(/Placeholder Super Admin \(you\)/)).toBeInTheDocument();
  });

  it("guards the last Super Admin when viewed by another admin", async () => {
    stubFetch({ "GET /api/v1/admin/admins": () => jsonResponse([BOSS, VERIFIER]) });
    render(withAuth(["admins.manage"], <AdminUsers />, { admin: { ...VERIFIER, permissions: ["admins.manage"] } }));
    const row = await screen.findByRole("row", { name: /Placeholder Super Admin/ });
    expect(within(row).getByRole("button", { name: /Disable/ })).toBeDisabled();
  });

  it("builds the invite link from the invite_token in the 201 and shows it once", async () => {
    const user = userEvent.setup();
    let posted: unknown;
    stubFetch({
      "GET /api/v1/admin/admins": () => jsonResponse([BOSS]),
      "POST /api/v1/admin/admins": () => jsonResponse(INVITED, { status: 201 }),
    });
    const origFetch = globalThis.fetch as unknown as (r: Request) => Promise<Response>;
    vi.stubGlobal("fetch", vi.fn(async (r: Request) => {
      if (r.method === "POST") posted = await r.clone().json();
      return origFetch(r);
    }));
    render(withAuth(["admins.manage"], <AdminUsers />, { admin: { ...BOSS, permissions: ["admins.manage"] } }));
    await user.click(await screen.findByRole("button", { name: /Invite admin/ }));
    await user.type(screen.getByLabelText("Full name"), "Placeholder New");
    await user.type(screen.getByLabelText("Email"), "new@example.test");
    await user.click(screen.getByLabelText("Verification"));
    await user.click(screen.getByRole("button", { name: "Create invite" }));

    const link = (await screen.findByRole("textbox", { name: "Invite link" })) as HTMLInputElement;
    expect(link.value).toBe(`${window.location.origin}/accept-invite?token=PLACEHOLDER-INVITE-TOKEN`);
    expect(posted).toEqual({ email: "new@example.test", full_name: "Placeholder New", roles: ["verification"] });
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Invite link" })).not.toBeInTheDocument());
  });

  it("shows the server's message when the invite is refused (409)", async () => {
    const user = userEvent.setup();
    stubFetch({
      "GET /api/v1/admin/admins": () => jsonResponse([BOSS]),
      "POST /api/v1/admin/admins": () => jsonResponse({ detail: "An admin with this email already exists" }, { status: 409 }),
    });
    render(withAuth(["admins.manage"], <AdminUsers />, { admin: { ...BOSS, permissions: ["admins.manage"] } }));
    await user.click(await screen.findByRole("button", { name: /Invite admin/ }));
    await user.type(screen.getByLabelText("Full name"), "Dup");
    await user.type(screen.getByLabelText("Email"), "boss@example.test");
    await user.click(screen.getByLabelText("Verification"));
    await user.click(screen.getByRole("button", { name: "Create invite" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("An admin with this email already exists");
  });
});
