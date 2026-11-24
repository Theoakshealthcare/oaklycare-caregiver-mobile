# SOP: the caregiver Chats tab (Figma 8.21.06, list screen)

| | |
|---|---|
| **What shipped** | A third bottom tab, **Chats** (Home, Bookings, Chats, Vitals), showing the caregiver's conversations from the new `GET /api/v1/caregiver/chats`. Tapping a row or an avatar opens the existing per-booking chat. |
| **Branch / PR** | `feat/caregiver-chats-tab`, cut from `oakly/main` `baaff86`. PR: see the branch on `Theoakshealthcare/oaklycare-caregiver-mobile`. **Depends on backend PR #77** (`feat/caregiver-chats-list`); not merged, merge it first. |
| **Not verified** | On a device or simulator (no visual pass yet); against a deployed backend (types were synced from the backend worktree). |

## Why
The Figma bottom bar has a Chats tab; it had been skipped because the backend had no chat list (chat existed only per booking, opened from "Message patient"). The owner asked for it to be built, so the backend list endpoint came first (backend SOP `2026-11-24-caregiver-chats-list.md`).

## How
| Decision | Why / alternative rejected |
|---|---|
| **What the screen draws.** Teal header "Chats" with a search box; a horizontal row of round avatars of the 8 latest conversations; one row per conversation: avatar, name, last message (two lines at most), time. | That is the Figma list. Tokens and shapes follow the Bookings tab (same teal header, same rounded white sheet, same 20 pt gutter). |
| **Name = full name, avatar = first letter.** | The server lists only bookings assigned to the caregiver, i.e. where the patient's identity is the caregiver's to see (same rule as Bookings' assigned cards). The list has no photo field; the chat header and the Bookings cards also draw the first letter. |
| **Search is client-side** over the loaded conversations' names (case-insensitive, trimmed), and hides the avatar row while a query is typed. | The brief; the list is at most 50 per page. An "x" clears it. |
| **Time:** `14:05` today, weekday inside a week, `28 Oct` before. | 24-hour clock everywhere in the app (DP1-28), so not Figma's "10:00 am". |
| **No message yet:** the row says "No messages yet" and shows no time. | The server returns `last_message: null`; nothing is invented. |
| **Fetch and poll only while the tab shows** (`active`), every 20 s, on pull to refresh, and when the screen regains focus (coming back from a chat). Sending a message also invalidates the list. | The pager keeps every tab mounted (Vitals does the same). |
| **Paging:** `useInfiniteQuery` on the server's `next_before` / `next_before_id`; a "Load earlier chats" button after the last row while another page exists (hidden while searching). | The server pages at 50; searching is over what is loaded, which the button extends. |
| **States:** spinner, error with "Try again" (a failed refetch keeps showing the rows and adds the retry under them), empty ("No chats yet", with a hint), "No chats found" for a search with no match. | Matches the Bookings tab's states. |
| **Tab icon:** the Ionicons `chatbubbles` pair, mid grey off and white when open. | The tab set has no chat picture; the other tabs keep their PNGs. |

## What's involved
| Path | Change |
|---|---|
| `apps/caregiver/src/screens/chats/Chats.tsx` (new) | the screen |
| `apps/caregiver/src/chats/chatsModel.ts` (new) | `initialOf`, `filterChats`, `listTime`, constants |
| `apps/caregiver/src/services/chats.service.ts` (new), `src/hooks/queries.ts` (`useChatList`, `CHATS_POLL_MS`; `useSendChatMessage` also invalidates the list), `src/api/keys.ts` (`chats`) | data layer |
| `apps/caregiver/src/navigation/BottomNavigation.tsx`, `Navigations.tsx` | Chats as tab 3 (`id: "chats"`, usable in the `tab` param); Vitals' `active` index 2 to 3 |
| `packages/api-client/openapi.json`, `src/schema.d.ts` | `pnpm api:sync` from the backend PR #77 branch (additive: one path, three schemas) |
| `apps/caregiver/__tests__/chats.test.tsx`, `chatsModel.test.ts` (new), `bottomNavigation.test.tsx` (tab count 3 to 4, Chats third, no Learn) | tests |

## Verification
- Jest, single worker (`--runInBand`): `chats.test.tsx`, `chatsModel.test.ts`, `bottomNavigation.test.tsx`, plus the pinning `chatParity`, `chatCalling` (chat screen, hooks) and `vitals` (the shifted `active` index) files. All pass.
- `npx tsc --noEmit` in `apps/caregiver`, `apps/patient`, `apps/admin`: clean. `npx eslint` on the touched files: no errors (the one warning in `BottomNavigation.tsx` is the existing set-state-in-effect one).
- The full suites are CI's.

## Left out, on purpose
| Figma item | Why |
|---|---|
| "Oakly Admin" support conversation | no support-chat backend (support live chat is off) |
| Filter button beside the search box | nothing to filter by; the brief leaves it out |
| Unread badge on rows and on the tab | the server records no read state, so the list has no `unread_count` (backend follow-up) |
| Photos in the avatars | the list carries none; initials are drawn |
| "You:" marker on messages you sent | not in Figma; the server's `from_me` is unused for now |
| Learn tab | no backend, owner rule: stays off |

## Operate / roll back
Revert the PR: the tab disappears and the other three keep their order. The backend endpoint is additive and can stay.

## Follow-ups
- Unread badges once the backend tracks read state (add `unread_count` to the row and a badge on the tab).
- A visual pass on a device (header height, avatar row, tab glyph against the Figma bar).
- Patient photos in the list if the owner wants them (the backend would add a field).
