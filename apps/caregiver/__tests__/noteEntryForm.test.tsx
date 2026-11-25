import { fireEvent, screen } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import AINoteTaker from "../src/screens/chat/AINoteTaker";
import { renderWithClient, routeProps } from "../test-utils/carePlanHarness";

jest.mock("../src/hooks/use-navigation", () => ({
  __esModule: true,
  default: () => ({ navigation: { navigate: jest.fn(), goBack: jest.fn() } }),
}));
jest.mock("../src/components/back/HeaderBack", () => ({ __esModule: true, default: () => null }));

const mockMutate = jest.fn();
jest.mock("../src/hooks/queries", () => ({
  useBooking: () => ({ data: undefined }),
  useNotes: () => ({ data: [] }),
  useCreateNote: () => ({ mutate: (...args: unknown[]) => mockMutate(...args), isPending: false }),
}));
jest.mock("expo-audio", () => ({
  useAudioRecorder: () => ({ prepareToRecordAsync: async () => {}, record: () => {}, stop: async () => {}, uri: null }),
  RecordingPresets: { HIGH_QUALITY: {} },
  requestRecordingPermissionsAsync: async () => ({ granted: true }),
  setAudioModeAsync: async () => {},
}));

const render = () => renderWithClient(<AINoteTaker {...routeProps<React.ComponentProps<typeof AINoteTaker>>({ bookingId: "b1" })} />);

describe("Typed visit note form", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("labels both fields and gives each a placeholder, so neither looks like plain text", async () => {
    await render();
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Note")).toBeTruthy();
    expect(screen.getByPlaceholderText("Note title")).toBeTruthy();
    expect(screen.getByPlaceholderText("Write your note here")).toBeTruthy();
  });

  it("draws both fields with the shared outlined field style", async () => {
    await render();
    for (const placeholder of ["Note title", "Write your note here"]) {
      expect(screen.getByPlaceholderText(placeholder).parent).toHaveStyle({ borderWidth: 1, borderRadius: 16 });
    }
  });

  it("the body is a multiline field with a real minimum height, top aligned", async () => {
    await render();
    const body = screen.getByPlaceholderText("Write your note here");
    expect(body.props.multiline).toBe(true);
    expect(body).toHaveStyle({ minHeight: 140, textAlignVertical: "top" });
    expect(screen.getByPlaceholderText("Note title").props.multiline).toBeFalsy();
  });

  it("Save Note sits in the pinned bar and saves the trimmed title and body", async () => {
    await render();
    expect(screen.getByTestId("note-save-bar")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Note title"), "  Morning visit ");
    await fireEvent.changeText(screen.getByPlaceholderText("Write your note here"), "  Took breakfast well.  ");
    await fireEvent.press(screen.getByText("Save Note"));
    expect(mockMutate).toHaveBeenCalledWith({ title: "Morning visit", content: "Took breakfast well." }, expect.any(Object));
  });

  it("Save Note with an empty field says what is missing and saves nothing", async () => {
    await render();
    await fireEvent.press(screen.getByText("Save Note"));
    expect(mockMutate).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Error", expect.stringContaining("title"));
  });
});
