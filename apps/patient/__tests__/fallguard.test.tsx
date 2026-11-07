import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { maxScore, toQuestions, toResult, toSubmitBody } from "../src/domain/fallguard";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { live, liveBody, liveReply } from "../test-utils/live";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const tab = (name: string) => fireEvent.press(screen.getByRole("tab", { name }));

const QUESTIONS: any[] = liveBody("fallguard-questions");
const SUBMIT = live("fallguard-submit");

/** Opens the assessment and answers every question with option `i % options` (what the capture script answered). */
async function answerAll(upTo = QUESTIONS.length) {
  await tab("Fall");
  await press("Start Assessment");
  expect(await screen.findByText(`1 of ${QUESTIONS.length} questions`)).toBeTruthy();
  for (let i = 0; i < upTo; i += 1) {
    const q = QUESTIONS[i];
    await fireEvent.press(screen.getByRole("radio", { name: q.options[i % q.options.length].text }));
    if (i < QUESTIONS.length - 1) await press("Next");
  }
}

describe("FallGuard (live-shaped)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());

  describe("domain", () => {
    it("the real list has 24 questions in the server's order, with every option's score kept out of the screen text", () => {
      expect(QUESTIONS).toHaveLength(24);
      const questions = toQuestions([...QUESTIONS].reverse());
      expect(questions.map((q) => q.prompt)).toEqual(QUESTIONS.map((q) => q.question));
      expect(maxScore(questions)).toBe(40);
    });

    it("builds the captured submit body: question id, the option's text, the option's score", () => {
      const questions = toQuestions(QUESTIONS);
      const answers = Object.fromEntries(questions.map((q, i) => [q.id, i % q.options.length]));
      expect(toSubmitBody(questions, answers)).toEqual(SUBMIT.request.body);
    });

    it("treats the backend's 'Unable to analyze' stand-in as no summary", () => {
      const questions = toQuestions(QUESTIONS);
      const result = toResult(SUBMIT.response.body, questions);
      expect(result).toEqual({ totalScore: 20, maxScore: 40, summary: null, recommendations: [] });
      expect(toResult({ ...SUBMIT.response.body, ai_summary: "A real summary.", ai_recommendations: ["Walk daily."] }, questions)).toMatchObject({
        summary: "A real summary.",
        recommendations: ["Walk daily."],
      });
      expect(toResult({ ...SUBMIT.response.body, ai_summary: null, ai_recommendations: null }, questions)).toMatchObject({ summary: null, recommendations: [] });
    });
  });

  describe("screens", () => {
    const routes = (extra = {}) => ({
      "GET /api/v1/fallguard/questions": () => liveReply("fallguard-questions"),
      ...extra,
    });

    it("asks all 24 real questions one at a time, with no scores on screen and no sample notice", async () => {
      const { view } = await renderSignedIn(routes());
      await tab("Fall");
      await press("Start Assessment");
      expect(await screen.findByText("1 of 24 questions")).toBeTruthy();
      expect(screen.getByText(QUESTIONS[0].question)).toBeTruthy();
      for (const option of QUESTIONS[0].options) expect(screen.getByRole("radio", { name: option.text })).toBeTruthy();
      expect(screen.queryByText(/score|points|shows sample information/i)).toBeNull();
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
      await fireEvent.press(screen.getByRole("radio", { name: QUESTIONS[0].options[0].text }));
      await press("Next");
      expect(await screen.findByText("2 of 24 questions")).toBeTruthy();
      expect(screen.getByText(QUESTIONS[1].question)).toBeTruthy();
      await press("Back");
      expect(await screen.findByText("1 of 24 questions")).toBeTruthy();
      view.unmount();
    });

    it("submits the captured body (the server sums the scores the app sends) and shows the server's score", async () => {
      const { calls, view } = await renderSignedIn(routes({ "POST /api/v1/fallguard/submit": () => liveReply("fallguard-submit") }));
      await answerAll();
      await press("Submit");
      expect(await screen.findByText("Total risk score")).toBeTruthy();
      expect(screen.getByText("20")).toBeTruthy();
      expect(screen.getByText("out of 40")).toBeTruthy();
      expect(calls.find((c) => c.method === "POST" && c.path === "/api/v1/fallguard/submit")?.body).toEqual(SUBMIT.request.body);
      // the captured AI answer was the failure stand-in: no summary card, and a plain line instead of invented advice
      expect(screen.queryByText(/Unable to analy/i)).toBeNull();
      expect(screen.getByText(/could not prepare personal advice/)).toBeTruthy();
      expect(screen.queryByText(/shows sample information/)).toBeNull();
      view.unmount();
    });

    it("shows the AI summary and recommendations when the server has them (their shape is the schema's, not captured: no Gemini key locally)", async () => {
      const { view } = await renderSignedIn(
        routes({
          "POST /api/v1/fallguard/submit": () =>
            liveReply("fallguard-submit", (b) => ({ ...b, ai_summary: "Moderate risk. Keep walkways clear.", ai_recommendations: ["Add grab bars in the bathroom.", "Wear non-slip shoes."] })),
        }),
      );
      await answerAll();
      await press("Submit");
      expect(await screen.findByText("Moderate risk. Keep walkways clear.")).toBeTruthy();
      expect(screen.getByText("Add grab bars in the bathroom.")).toBeTruthy();
      expect(screen.getByText("Wear non-slip shoes.")).toBeTruthy();
      await press("Book a Home Visit");
      expect(await screen.findByText("Book a nurse visit in 2 steps. Step 1 of 2.")).toBeTruthy();
      view.unmount();
    });

    it("keeps the person on the last question with the server's refusal when the submit fails (captured 500)", async () => {
      const { view } = await renderSignedIn(routes({ "POST /api/v1/fallguard/submit": () => liveReply("fallguard-submit-unknown-question") }));
      await answerAll();
      await press("Submit");
      expect(await screen.findByText("Could not submit")).toBeTruthy();
      expect(screen.getByText("Something went wrong on our side. Please try again in a moment.")).toBeTruthy();
      expect(screen.queryByText("Total risk score")).toBeNull();
      expect(screen.getByText("24 of 24 questions")).toBeTruthy();
      view.unmount();
    });

    it("says so, and can retry, when the questions cannot load", async () => {
      let fail = true;
      const { view } = await renderSignedIn(
        routes({ "GET /api/v1/fallguard/questions": () => (fail ? liveReply("fallguard-questions-as-caregiver") : liveReply("fallguard-questions")) }),
      );
      await tab("Fall");
      await press("Start Assessment");
      expect(await screen.findByText("We couldn't load the questions")).toBeTruthy();
      fail = false;
      await press("Try again");
      expect(await screen.findByText("1 of 24 questions")).toBeTruthy();
      view.unmount();
    });

    it("an empty list says there are no questions instead of showing a blank screen", async () => {
      const { view } = await renderSignedIn(routes({ "GET /api/v1/fallguard/questions": () => ({ status: 200, body: [] }) }));
      await tab("Fall");
      await press("Start Assessment");
      expect(await screen.findByText("No questions available right now")).toBeTruthy();
      await waitFor(() => expect(screen.queryByText(/of \d+ questions/)).toBeNull());
      view.unmount();
    });
  });
});
