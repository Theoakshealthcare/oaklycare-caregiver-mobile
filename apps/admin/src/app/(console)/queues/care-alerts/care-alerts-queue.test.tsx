import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { visibleNav } from "@/lib/nav";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import { COUNTS, CRITICAL_DETAIL, CRITICAL_ID, MISSED, WARNING, makeAlert } from "@/test/care-alert-fixtures";

import { CareAlertsQueue } from "./care-alerts-queue";

const LIST = "GET /api/v1/admin/care-alerts";
const DETAIL = `GET /api/v1/admin/care-alerts/${CRITICAL_ID}`;
const ACK = `POST /api/v1/admin/care-alerts/${CRITICAL_ID}/acknowledge`;
const RESOLVE = `POST /api/v1/admin/care-alerts/${CRITICAL_ID}/resolve`;
const SUPPORT = ["support.inbox"];

const CRITICAL = makeAlert();
const list = (items = [CRITICAL, WARNING, MISSED], counts = COUNTS) => () =>
  jsonResponse({ items, total: items.length, counts });

const rowOf = (name: RegExp) => screen.findByRole("row", { name });

describe("CareAlertsQueue", () => {
  it("opens on the active work list with the counts, critical first", async () => {
    const calls = stubFetch({ [LIST]: list() });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    const critical = await rowOf(/critical alert: Heart rate/);
    expect(critical).toHaveTextContent("Critical");
    expect(critical).toHaveTextContent("Ada Okafor");
    expect(critical).toHaveTextContent("Emergency: call 112.");
    expect(critical).toHaveTextContent("1 family contact told");
    expect(calls[0]?.search).toContain("status=active");
    expect(calls[0]?.search).toContain("limit=50");
    expect(screen.getByText("1 critical need work")).toBeInTheDocument();
    expect(screen.getByText("3 open")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveAccessibleName(/critical alert/);
  });

  it("says plainly when the family could not be reached or has not been messaged yet", async () => {
    stubFetch({ [LIST]: list() });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    expect(await rowOf(/Temperature/)).toHaveTextContent("No family contact could be reached");
    expect(await rowOf(/care tasks not marked done/)).toHaveTextContent("Not sent yet");
    expect(await rowOf(/care tasks not marked done/)).toHaveTextContent("3 times");
  });

  it("sends the filters and starts again from the first page", async () => {
    const calls = stubFetch({ [LIST]: list() });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    await rowOf(/critical alert/);
    await userEvent.selectOptions(screen.getByLabelText("Severity"), "critical");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "task_missed");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "resolved");
    await waitFor(() => {
      const last = calls.at(-1)!;
      expect(last.search).toContain("severity=critical");
      expect(last.search).toContain("type=task_missed");
      expect(last.search).toContain("status=resolved");
      expect(last.search).toContain("offset=0");
    });
  });

  it("acknowledges an open alert with no note and says so", async () => {
    const calls = stubFetch({
      [LIST]: list(),
      [ACK]: () => jsonResponse({ ...CRITICAL, status: "acknowledged" }),
    });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    const row = await rowOf(/critical alert/);
    await userEvent.click(within(row).getByRole("button", { name: /Acknowledge/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Nobody is messaged");
    await userEvent.click(within(dialog).getByRole("button", { name: "Acknowledge" }));
    expect(await screen.findByText("Alert acknowledged.")).toBeInTheDocument();
    expect(calls.find((c) => c.key === ACK)?.body).toEqual({ note: null });
    expect(calls.filter((c) => c.key === LIST).length).toBeGreaterThan(1); // the queue was re-read
  });

  it("resolves with a note and sends it as typed", async () => {
    const calls = stubFetch({
      [LIST]: list(),
      [RESOLVE]: () => jsonResponse({ ...CRITICAL, status: "resolved" }),
    });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    const row = await rowOf(/critical alert/);
    await userEvent.click(within(row).getByRole("button", { name: /Resolve/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("a new alert opens and the family is told again");
    await userEvent.type(within(dialog).getByLabelText("Note (optional)"), "  Family phoned, patient at hospital  ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Resolve" }));
    expect(await screen.findByText("Alert resolved.")).toBeInTheDocument();
    expect(calls.find((c) => c.key === RESOLVE)?.body).toEqual({ note: "Family phoned, patient at hospital" });
  });

  it("keeps the dialog open with the server's sentence when someone else got there first", async () => {
    stubFetch({
      [LIST]: list(),
      [ACK]: () =>
        jsonResponse({ detail: { code: "already_acknowledged", message: "This alert has already been acknowledged." } }, { status: 409 }),
    });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    const row = await rowOf(/critical alert/);
    await userEvent.click(within(row).getByRole("button", { name: /Acknowledge/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Acknowledge" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("This alert has already been acknowledged.");
  });

  it("offers only the actions that still make sense", async () => {
    const acknowledged = makeAlert({ status: "acknowledged", acknowledged_by: { id: "a", email: "admin@example.test" } });
    const resolved = { ...WARNING, status: "resolved" as const };
    stubFetch({ [LIST]: list([acknowledged, resolved]) });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    const ack = await rowOf(/critical alert/);
    expect(within(ack).queryByRole("button", { name: /Acknowledge/ })).not.toBeInTheDocument();
    expect(within(ack).getByRole("button", { name: /Resolve/ })).toBeInTheDocument();
    const done = screen.getAllByRole("row").slice(1)[1]!;
    expect(within(done).queryByRole("button", { name: /Resolve|Acknowledge/ })).not.toBeInTheDocument();
    expect(within(done).getByRole("button", { name: /Details/ })).toBeInTheDocument();
  });

  it("opens the clinical detail through the detail route", async () => {
    const calls = stubFetch({ [LIST]: list(), [DETAIL]: () => jsonResponse(CRITICAL_DETAIL) });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    const row = await rowOf(/critical alert/);
    expect(calls.some((c) => c.key === DETAIL)).toBe(false); // the list never loads the detail
    await userEvent.click(within(row).getByRole("button", { name: /Details/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Heart rate below 50 bpm/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Heart rate 45 bpm (Critical)");
    expect(dialog).toHaveTextContent("1 family contact told");
  });

  it("tells an admin without clinical.read why there is no detail", async () => {
    stubFetch({ [LIST]: list(), [DETAIL]: () => jsonResponse(makeAlert({ detail_masked: true })) });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    await userEvent.click(within(await rowOf(/critical alert/)).getByRole("button", { name: /Details/ }));
    expect(await screen.findByText(/Clinical detail needs the Clinical Reviewer or Super Admin role/)).toBeInTheDocument();
  });

  it("shows a missed task's titles and days in the detail", async () => {
    const detail = makeAlert({
      ...MISSED,
      detail: { vital_type: null, status: null, reason: null, value: null, unit: null, tasks: ["Placeholder A", "Placeholder B"], days: ["2026-11-24"] },
    });
    stubFetch({ [LIST]: list(), [`GET /api/v1/admin/care-alerts/${MISSED.id}`]: () => jsonResponse(detail) });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    await userEvent.click(within(await rowOf(/care tasks not marked done/)).getByRole("button", { name: /Details/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Placeholder A")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Placeholder B");
    expect(dialog).toHaveTextContent("322E5BE9");
  });

  it("marks a masked name and shows who the alert is about for a relative's visit", async () => {
    stubFetch({
      [LIST]: list([makeAlert({ patient: { full_name: "Ada O.", phone: "+234****9201", masked: true }, care_recipient_name: "Mama O." })]),
    });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    const row = await rowOf(/critical alert/);
    expect(row).toHaveTextContent("Ada O.");
    expect(row).toHaveTextContent("masked");
    expect(row).toHaveTextContent("for Mama O.");
  });

  it("shows an empty state and an error with a retry", async () => {
    stubFetch({ [LIST]: () => jsonResponse({ items: [], total: 0, counts: { open: 0, acknowledged: 0, resolved: 0, critical_active: 0 } }) });
    const { unmount } = render(withAuth(SUPPORT, <CareAlertsQueue />));
    expect(await screen.findByText("No alerts here")).toBeInTheDocument();
    unmount();
    stubFetch({ [LIST]: () => jsonResponse({ detail: "Access denied. Missing permission: support.inbox" }, { status: 403 }) });
    render(withAuth(SUPPORT, <CareAlertsQueue />));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied. Missing permission: support.inbox");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("shows Care alerts only to an admin holding support.inbox", () => {
    const labels = (permissions: string[]) => visibleNav(permissions).flatMap((g) => g.items.map((i) => i.label));
    expect(labels(["support.inbox"])).toContain("Care alerts");
    expect(labels(["payments.read", "refunds.approve"])).not.toContain("Care alerts");
  });
});
