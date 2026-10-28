import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { ApiError, NETWORK_MESSAGE } from "../src/api/errors";
import { session } from "../src/auth";
import NotesSection from "../src/components/careplan/NotesSection";
import CarePlanProgress from "../src/screens/careplan/CarePlanProgress";
import { carePlansService } from "../src/services/carePlans.service";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";
import {
  NO_ACCESS,
  PLAN_ID,
  PLAN_NOT_EDITABLE,
  VISIT_NOT_IN_PROGRESS,
  note,
  notePage,
  plan,
  progress,
  readOnlyPlan,
} from "../test-utils/carePlanFixtures";

const mockGoBack = jest.fn();
jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: mockGoBack } }),
}));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
}));

beforeEach(async () => {
  await session.signIn({ accessToken: "access", refreshToken: "refresh" });
});
afterEach(async () => {
  jest.restoreAllMocks();
  mockGoBack.mockClear();
  await session.signOut();
});

const renderNotes = async (category: "observation" | "special_note" = "observation", p = plan()) => {
  const onNoAccess = jest.fn();
  const view = await renderWithClient(<NotesSection plan={p} category={category} onNoAccess={onNoAccess} />);
  return { onNoAccess, ...view };
};

describe("Notes and observations", () => {
  it("lists the notes newest first with their author and asks for one category only", async () => {
    const list = jest.spyOn(carePlansService, "listNotes").mockResolvedValue(
      notePage([
        note({ id: "n2", body: "Placeholder second note", author: { name: "Placeholder Caregiver", kind: "caregiver" } }),
        note({ id: "n1" }),
      ]),
    );
    await renderNotes();
    expect(await screen.findByText("Placeholder second note")).toBeTruthy();
    expect(screen.getByText("Placeholder Caregiver")).toBeTruthy();
    expect(screen.getByText("Placeholder observation: ate well.")).toBeTruthy();
    expect(list).toHaveBeenCalledWith(PLAN_ID, "observation", undefined);
  });

  it("shows the empty text per category", async () => {
    jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([]));
    await renderNotes("special_note");
    expect(await screen.findByTestId("notes-special_note-empty")).toHaveTextContent("No special notes yet.");
  });

  it("pages with both halves of the cursor", async () => {
    const list = jest
      .spyOn(carePlansService, "listNotes")
      .mockResolvedValueOnce(notePage([note({ id: "n2", body: "Placeholder newer" })], { before: "2026-10-28T10:10:52.834517", id: "n2" }))
      .mockResolvedValueOnce(notePage([note({ id: "n1", body: "Placeholder older" })]));
    await renderNotes();
    await fireEvent.press(await screen.findByTestId("notes-observation-more"));
    expect(await screen.findByText("Placeholder older")).toBeTruthy();
    expect(list.mock.calls[1]).toEqual([PLAN_ID, "observation", { before: "2026-10-28T10:10:52.834517", beforeId: "n2" }]);
    // Last page: no more button.
    expect(screen.queryByTestId("notes-observation-more")).toBeNull();
    expect(screen.getByText("Placeholder newer")).toBeTruthy();
  });

  it("adds a note: trims it, tells the caregiver it is permanent, clears the box and shows the new note", async () => {
    const list = jest
      .spyOn(carePlansService, "listNotes")
      .mockResolvedValueOnce(notePage([]))
      .mockResolvedValue(notePage([note({ body: "Placeholder fresh note" })]));
    const add = jest.spyOn(carePlansService, "addNote").mockResolvedValue(note({ body: "Placeholder fresh note" }));
    await renderNotes();
    await screen.findByTestId("notes-observation-empty");
    expect(screen.getByText(/can't be edited or deleted/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId("note-submit-observation"));
    expect(screen.getByTestId("note-error-observation")).toHaveTextContent("Write a note first.");
    expect(add).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId("note-input-observation"), "  Placeholder fresh note  ");
    await fireEvent.press(screen.getByTestId("note-submit-observation"));
    await waitFor(() => expect(add).toHaveBeenCalledWith(PLAN_ID, "Placeholder fresh note", "observation"));
    expect(await screen.findByText("Placeholder fresh note")).toBeTruthy();
    expect(screen.getByTestId("note-input-observation").props.value).toBe("");
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("sends a special note with its own category", async () => {
    jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([]));
    const add = jest.spyOn(carePlansService, "addNote").mockResolvedValue(note({ category: "special_note" }));
    await renderNotes("special_note");
    await fireEvent.changeText(await screen.findByTestId("note-input-special_note"), "Placeholder special note");
    await fireEvent.press(screen.getByText("Add Special Notes"));
    await waitFor(() => expect(add).toHaveBeenCalledWith(PLAN_ID, "Placeholder special note", "special_note"));
  });

  it("rejects a note over 2000 characters before sending", async () => {
    jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([]));
    const add = jest.spyOn(carePlansService, "addNote");
    await renderNotes();
    await fireEvent.changeText(await screen.findByTestId("note-input-observation"), "a".repeat(2001));
    await fireEvent.press(screen.getByTestId("note-submit-observation"));
    expect(screen.getByTestId("note-error-observation")).toHaveTextContent(/2000/);
    expect(add).not.toHaveBeenCalled();
  });

  it("keeps the typed text when the visit has ended, says why, and reloads the plan", async () => {
    jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([]));
    jest.spyOn(carePlansService, "addNote").mockRejectedValue(VISIT_NOT_IN_PROGRESS);
    await renderNotes();
    await fireEvent.changeText(await screen.findByTestId("note-input-observation"), "Placeholder text to keep");
    await fireEvent.press(screen.getByTestId("note-submit-observation"));
    expect(await screen.findByTestId("note-error-observation")).toHaveTextContent("Available during an active visit.");
    expect(screen.getByTestId("note-input-observation").props.value).toBe("Placeholder text to keep");
  });

  it.each([
    ["a completed plan", PLAN_NOT_EDITABLE, /completed or archived/],
    ["no connection", new ApiError(0, null, NETWORK_MESSAGE), new RegExp(NETWORK_MESSAGE.slice(0, 20))],
  ])("keeps the typed text on %s", async (_name, error, message) => {
    jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([]));
    jest.spyOn(carePlansService, "addNote").mockRejectedValue(error);
    await renderNotes();
    await fireEvent.changeText(await screen.findByTestId("note-input-observation"), "Placeholder text to keep");
    await fireEvent.press(screen.getByTestId("note-submit-observation"));
    expect(await screen.findByTestId("note-error-observation")).toHaveTextContent(message);
    expect(screen.getByTestId("note-input-observation").props.value).toBe("Placeholder text to keep");
  });

  it("reloads the plan when a note is refused because the plan was closed, so the box can go away", async () => {
    jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([]));
    jest.spyOn(carePlansService, "addNote").mockRejectedValue(PLAN_NOT_EDITABLE);
    const { client } = await renderNotes();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    await fireEvent.changeText(await screen.findByTestId("note-input-observation"), "Placeholder text");
    await fireEvent.press(screen.getByTestId("note-submit-observation"));
    await screen.findByTestId("note-error-observation");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["care-plan", PLAN_ID] });
  });

  it("shows no box before the visit has started, with the reason, but still lists the notes", async () => {
    jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([note()]));
    await renderNotes("observation", plan({ capabilities: { can_edit_plan: false, can_tick_tasks: false, can_add_observation: false } }));
    expect(await screen.findByText("Placeholder observation: ate well.")).toBeTruthy();
    expect(screen.queryByTestId("note-input-observation")).toBeNull();
    expect(screen.getByTestId("notes-observation-hint")).toHaveTextContent("Available during an active visit.");
  });

  it("shows neither box nor hint on a completed plan, and the history stays readable", async () => {
    jest.spyOn(carePlansService, "listNotes").mockResolvedValue(notePage([note()]));
    await renderNotes("observation", readOnlyPlan({ status: "completed" }));
    expect(await screen.findByText("Placeholder observation: ate well.")).toBeTruthy();
    expect(screen.queryByTestId("note-input-observation")).toBeNull();
    expect(screen.queryByTestId("notes-observation-hint")).toBeNull();
  });

  it("hands a 404 (the visit ended) to the screen", async () => {
    jest.spyOn(carePlansService, "listNotes").mockRejectedValue(NO_ACCESS);
    const { onNoAccess } = await renderNotes();
    await waitFor(() => expect(onNoAccess).toHaveBeenCalled());
    expect(screen.queryByTestId("notes-observation")).toBeNull();
  });

  it("shows an error with a retry when the notes fail to load", async () => {
    const list = jest.spyOn(carePlansService, "listNotes").mockRejectedValueOnce(new ApiError(0, null, NETWORK_MESSAGE)).mockResolvedValue(notePage([note()]));
    await renderNotes();
    await fireEvent.press(await screen.findByText("Try again"));
    expect(await screen.findByText("Placeholder observation: ate well.")).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });
});

const renderProgress = () =>
  renderWithClient(<CarePlanProgress {...routeProps<React.ComponentProps<typeof CarePlanProgress>>({ planId: PLAN_ID, clientName: "Placeholder Client" })} />);

describe("View progress", () => {
  it("shows the percent with how it is counted, the plan day, review, goals and the recent days", async () => {
    jest.spyOn(carePlansService, "getProgress").mockResolvedValue(progress());
    await renderProgress();
    expect(await screen.findByTestId("progress-headline")).toHaveTextContent("55%");
    expect(screen.getByTestId("progress-counts")).toHaveTextContent("6 of 11 tasks done on 4 visit days");
    expect(screen.getByTestId("progress-explain")).toHaveTextContent(/Only days with a visit/);
    expect(screen.getByTestId("progress-day")).toHaveTextContent("Day 9 of 30");
    expect(screen.getByTestId("progress-review")).toHaveTextContent("3 Nov 2026");
    expect(screen.getByTestId("progress-goals-active")).toHaveTextContent("1");
    expect(screen.getByTestId("progress-day-2026-10-21")).toHaveTextContent(/Wed 21 Oct/);
    expect(screen.getByTestId("progress-day-2026-10-21")).toHaveTextContent(/2 of 3/);
    expect(screen.getByText("Placeholder Client")).toBeTruthy();
  });

  it("shows 'No visits yet', not 0%, when nothing is measurable", async () => {
    jest.spyOn(carePlansService, "getProgress").mockResolvedValue(
      progress({ overall_percent: null, scheduled: 0, completed: 0, visit_days: 0, day: 1, review_due_on: null, by_day: [], last_observation_at: null }),
    );
    await renderProgress();
    expect(await screen.findByTestId("progress-headline")).toHaveTextContent("No visits yet");
    expect(screen.queryByTestId("progress-bar")).toBeNull();
    expect(screen.getByTestId("progress-days-empty")).toBeTruthy();
    expect(screen.getByTestId("progress-review")).toHaveTextContent("No review date");
    expect(screen.getByTestId("progress-last-note")).toHaveTextContent("No notes yet");
  });

  it("shows 'Not started yet' before the plan's first day", async () => {
    jest.spyOn(carePlansService, "getProgress").mockResolvedValue(progress({ day: 0 }));
    await renderProgress();
    expect(await screen.findByTestId("progress-day")).toHaveTextContent("Not started yet");
  });

  it("shows the not-available notice on a 404 and does not keep the numbers", async () => {
    jest.spyOn(carePlansService, "getProgress").mockRejectedValue(NO_ACCESS);
    const { client } = await renderProgress();
    expect(await screen.findByText("This care plan isn't available")).toBeTruthy();
    await fireEvent.press(screen.getByText("Go back"));
    expect(mockGoBack).toHaveBeenCalled();
    await act(async () => {});
    expect(client.getQueryData(["care-plan-progress", PLAN_ID])).toBeUndefined();
  });

  it("shows an error with a retry for any other failure", async () => {
    const get = jest.spyOn(carePlansService, "getProgress").mockRejectedValueOnce(new ApiError(0, null, NETWORK_MESSAGE)).mockResolvedValue(progress());
    await renderProgress();
    await fireEvent.press(await screen.findByText("Try again"));
    expect(await screen.findByTestId("progress-headline")).toHaveTextContent("55%");
    expect(get).toHaveBeenCalledTimes(2);
  });
});
