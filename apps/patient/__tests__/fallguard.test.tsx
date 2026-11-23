import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { queryClient } from "../src/api/queryClient";
import { ApiError } from "../src/api/errors";
import { fallguardRefusal, maxScore, RISK_BANDS, riskBandFor, sectionFor, toQuestions, toResult, toSubmitBody, type RiskBand } from "../src/domain/fallguard";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { capture } from "../test-utils/captures";
import { live, liveBody, liveReply } from "../test-utils/live";
import { renderSignedIn } from "../test-utils/renderApp";

jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const tab = (name: string) => fireEvent.press(screen.getByRole("tab", { name }));

const QUESTIONS: any[] = liveBody("fallguard-questions");
/** The real 422 answers of the server-scoring backend (`backend/docs/fe-captures/patient-fallguard`, copied to `test-utils/captures`). */
const CODES: Record<string, string> = {
  fallguard_no_answers: "008-p-submit-empty",
  fallguard_duplicate_question: "009-p-submit-duplicate-question",
  fallguard_unknown_question: "010-p-submit-unknown-question",
  fallguard_invalid_option: "011-p-submit-invalid-option",
};
const refusal = (code: string) => ({ status: capture(`fg-${CODES[code]}`).status, body: capture(`fg-${CODES[code]}`).body });
const SUBMIT = live("fallguard-submit");

/** An option button: its text and the score the server gave it, as the screen draws them. */
const option = (q: any, i: number) => screen.getByRole("button", { name: `${q.options[i].text}, Score : ${q.options[i].score}` });

/**
 * Opens the assessment and answers questions with option `i % options` (what the capture script answered). Choosing an answer moves
 * on by itself, and choosing the 24th sends the assessment: there is no Next or Submit button.
 */
async function answerAll(upTo = QUESTIONS.length) {
  await tab("Fall");
  await press("Start Assessment");
  expect(await screen.findByText(`1 of ${QUESTIONS.length} questions`)).toBeTruthy();
  for (let i = 0; i < upTo; i += 1) {
    const q = QUESTIONS[i];
    await fireEvent.press(option(q, i % q.options.length));
  }
}

describe("FallGuard (live-shaped)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());

  describe("domain", () => {
    it("the real list has 24 questions in the server's order, with each option's score as the server sent it", () => {
      expect(QUESTIONS).toHaveLength(24);
      const questions = toQuestions([...QUESTIONS].reverse());
      expect(questions.map((q) => q.prompt)).toEqual(QUESTIONS.map((q) => q.question));
      expect(maxScore(questions)).toBe(40);
    });

    it("builds the submit body from question ids and the options' exact text, and sends NO score (the server scores)", () => {
      const questions = toQuestions(QUESTIONS);
      const answers = Object.fromEntries(questions.map((q, i) => [q.id, i % q.options.length]));
      const body = toSubmitBody(questions, answers);
      expect(body.answers).toHaveLength(24);
      expect(body.answers.every((a) => !("score" in a))).toBe(true);
      // Same ids and answer texts as the captured (older) body, without its `score` fields.
      expect(body).toEqual({ answers: (SUBMIT.request.body as any).answers.map(({ score: _ignored, ...rest }: any) => rest) });
    });

    it("reads the four 422 codes of the new guide and nothing else", () => {
      const coded = (code: string) => new ApiError(422, capture(`fg-${CODES[code]}`).body, "");
      expect(fallguardRefusal(coded("fallguard_no_answers"))).toEqual({ kind: "message", message: "Please answer at least one question before you submit." });
      expect(fallguardRefusal(coded("fallguard_unknown_question"))?.kind).toBe("reload");
      expect(fallguardRefusal(coded("fallguard_invalid_option"))?.kind).toBe("reload");
      expect(fallguardRefusal(coded("fallguard_duplicate_question"))?.kind).toBe("message");
      expect(fallguardRefusal(new ApiError(500, { detail: "boom" }, ""))).toBeNull();
      expect(fallguardRefusal(new Error("x"))).toBeNull();
    });

    it("groups the 24 questions under the design's five headings by position, and shows no heading for any other list size", () => {
      const heading = (n: number) => sectionFor(n, 24)?.title;
      expect([1, 4, 5, 10, 11, 14, 15, 19, 20, 24].map(heading)).toEqual([
        "General Information",
        "General Information",
        "Physical Risk Factors",
        "Physical Risk Factors",
        "Cognitive & Sensory Function",
        "Cognitive & Sensory Function",
        "Environmental Risk Factors",
        "Environmental Risk Factors",
        "Behavioral & Lifestyle Factors",
        "Behavioral & Lifestyle Factors",
      ]);
      expect(sectionFor(1, 24)?.subtitle).toBe("Let's start with some basic information about you");
      expect(sectionFor(15, 24)?.subtitle).toBeUndefined();
      expect(sectionFor(3, 25)).toBeNull();
      expect(sectionFor(3, 23)).toBeNull();
    });

    it("has no risk bands until a clinician signs some, and picks the highest band a score reaches once there are", () => {
      expect(RISK_BANDS).toHaveLength(0);
      expect(riskBandFor(11)).toBeNull();
      const bands: RiskBand[] = [
        { from: 0, label: "Low Risk", meaning: "m1", color: "#000000" },
        { from: 10, label: "Moderate Risk", meaning: "m2", color: "#111111" },
      ];
      expect(riskBandFor(9, bands)?.label).toBe("Low Risk");
      expect(riskBandFor(11, bands)?.label).toBe("Moderate Risk");
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

    it("intro: the design's lists, the three numbered facts and no tagline", async () => {
      const { view } = await renderSignedIn(routes());
      await tab("Fall");
      expect(screen.getByText("Oakly FallGuard™")).toBeTruthy();
      expect(screen.getByText("Why This Matters")).toBeTruthy();
      expect(screen.getByText("Each year an estimated 684,000 individuals die from falls globally.")).toBeTruthy();
      expect(screen.getByText("What Will Be Assessed ?")).toBeTruthy();
      expect(screen.getByText("Potential hazards in your home or living space")).toBeTruthy();
      expect(screen.getByText("How Long Will It Take?")).toBeTruthy();
      expect(screen.queryByText(/Predict\. Prevent\. Protect/)).toBeNull();
      expect(screen.getByRole("button", { name: "Start Assessment" })).toBeTruthy();
      view.unmount();
    });

    it("asks the 24 real questions one at a time under their section titles, with the server's score on each option and no Next button", async () => {
      const { view } = await renderSignedIn(routes());
      await tab("Fall");
      await press("Start Assessment");
      expect(await screen.findByText("1 of 24 questions")).toBeTruthy();
      expect(screen.getByText("General Information")).toBeTruthy();
      expect(screen.getByText("Let's start with some basic information about you")).toBeTruthy();
      expect(screen.getByText(QUESTIONS[0].question)).toBeTruthy();
      for (let i = 0; i < QUESTIONS[0].options.length; i += 1) {
        expect(option(QUESTIONS[0], i)).toBeTruthy();
        expect(screen.getAllByText(`Score : ${QUESTIONS[0].options[i].score}`).length).toBeGreaterThan(0);
      }
      expect(screen.queryByRole("button", { name: /^(Next|Submit)$/ })).toBeNull();
      expect(screen.getByRole("progressbar").props.accessibilityValue).toMatchObject({ now: 1, max: 24 });
      await fireEvent.press(option(QUESTIONS[0], 0));
      expect(await screen.findByText("2 of 24 questions")).toBeTruthy();
      expect(screen.getByText(QUESTIONS[1].question)).toBeTruthy();
      await press("Back");
      expect(await screen.findByText("1 of 24 questions")).toBeTruthy();
      // the answer already given is still marked
      expect(option(QUESTIONS[0], 0).props.accessibilityState.selected).toBe(true);
      // Back on question 1 leaves the questions for the intro
      await fireEvent.press(screen.getByRole("button", { name: "Go back" }));
      expect(await screen.findByText("What Will Be Assessed ?")).toBeTruthy();
      view.unmount();
    });

    it("changes the section title where the design does, and drops the subtitle from question 15", async () => {
      const { view } = await renderSignedIn(routes());
      await answerAll(4);
      expect(await screen.findByText("5 of 24 questions")).toBeTruthy();
      expect(screen.getByText("Physical Risk Factors")).toBeTruthy();
      expect(screen.getByText("Now, let's assess your physical mobility and stability")).toBeTruthy();
      view.unmount();
      const second = await renderSignedIn(routes());
      await answerAll(14);
      expect(await screen.findByText("15 of 24 questions")).toBeTruthy();
      expect(screen.getByText("Environmental Risk Factors")).toBeTruthy();
      expect(screen.queryByText(/These questions help us understand/)).toBeNull();
      second.view.unmount();
    });

    it("submits question ids and option texts only (the server scores) as soon as the 24th answer is chosen, and shows the server's score", async () => {
      const { calls, view } = await renderSignedIn(routes({ "POST /api/v1/fallguard/submit": () => liveReply("fallguard-submit") }));
      await answerAll();
      expect(await screen.findByText("Assessment Results")).toBeTruthy();
      expect(screen.getByText("Total Risk Score")).toBeTruthy();
      expect(screen.getByText("20")).toBeTruthy();
      expect(screen.getByText("out of 40")).toBeTruthy();
      const sent: any = calls.find((c) => c.method === "POST" && c.path === "/api/v1/fallguard/submit")?.body;
      expect(sent.answers).toHaveLength(24);
      expect(sent.answers.some((a: any) => "score" in a)).toBe(false);
      expect(sent.answers.map((a: any) => [a.question_id, a.answer])).toEqual((SUBMIT.request.body as any).answers.map((a: any) => [a.question_id, a.answer]));
      // the captured AI answer was the failure stand-in: no "What does this mean?" card, and a plain line instead of invented advice
      expect(screen.queryByText(/Unable to analy/i)).toBeNull();
      expect(screen.queryByText("What does this mean?")).toBeNull();
      expect(
        screen.getByText("Your score is saved to your account. Personal tips are not available right now. If you are worried about falls, please speak to your doctor or nurse."),
      ).toBeTruthy();
      // nothing the server did not send: no band label, no next-assessment date, no download
      expect(screen.queryByText(/Risk$/)).toBeNull();
      expect(screen.queryByText(/Next Assessment Due|Next Steps/)).toBeNull();
      expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
      expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
      view.unmount();
    });

    it("shows the AI summary under 'What does this mean?' and each recommendation as a card (their shape is the schema's, not captured: no Gemini key locally)", async () => {
      const { view } = await renderSignedIn(
        routes({
          "POST /api/v1/fallguard/submit": () =>
            liveReply("fallguard-submit", (b) => ({ ...b, ai_summary: "Moderate risk. Keep walkways clear.", ai_recommendations: ["Add grab bars in the bathroom.", "Wear non-slip shoes."] })),
        }),
      );
      await answerAll();
      expect(await screen.findByText("What does this mean?")).toBeTruthy();
      expect(screen.getByText("Moderate risk. Keep walkways clear.")).toBeTruthy();
      expect(screen.getByText("Recommendations")).toBeTruthy();
      expect(screen.getByText("Based on your assessment")).toBeTruthy();
      expect(screen.getByText("Add grab bars in the bathroom.")).toBeTruthy();
      expect(screen.getByText("Wear non-slip shoes.")).toBeTruthy();
      await press("Book a Home Visit");
      expect(await screen.findByText("Book your Appointments in 2 steps")).toBeTruthy();
      view.unmount();
    });

    it("with signed bands (none today) the badge reads '11 / Moderate Risk' and their sentence answers 'What does this mean?'", async () => {
      (RISK_BANDS as RiskBand[]).push({ from: 0, label: "Moderate Risk", meaning: "A signed sentence.", color: "#F5921D" });
      try {
        const { view } = await renderSignedIn(
          routes({ "POST /api/v1/fallguard/submit": () => liveReply("fallguard-submit", (b) => ({ ...b, total_score: 11 })) }),
        );
        await answerAll();
        expect(await screen.findByText("Moderate Risk")).toBeTruthy();
        expect(screen.getByText("11")).toBeTruthy();
        expect(screen.getByText("Total Risk Score")).toBeTruthy();
        expect(screen.getByText("A signed sentence.")).toBeTruthy();
        view.unmount();
      } finally {
        (RISK_BANDS as RiskBand[]).splice(0);
      }
    });

    it("a failed submit (500) keeps the person on the last question with a plain sentence", async () => {
      const { view } = await renderSignedIn(routes({ "POST /api/v1/fallguard/submit": () => ({ status: 500, body: { detail: "Internal Server Error" } }) }));
      await answerAll();
      expect(await screen.findByText("Could not submit")).toBeTruthy();
      expect(screen.getByText("Something went wrong on our side. Please try again in a moment.")).toBeTruthy();
      expect(screen.queryByText("Assessment Results")).toBeNull();
      expect(screen.getByText("24 of 24 questions")).toBeTruthy();
      view.unmount();
    });

    it("an unknown question or option (422, nothing stored) says the questions changed, reloads them and starts again at question 1", async () => {
      for (const code of ["fallguard_unknown_question", "fallguard_invalid_option"]) {
        const { calls, view } = await renderSignedIn(routes({ "POST /api/v1/fallguard/submit": () => refusal(code) }));
        await answerAll(23);
        const readsBefore = calls.filter((c) => c.path === "/api/v1/fallguard/questions").length;
        await fireEvent.press(option(QUESTIONS[23], 23 % QUESTIONS[23].options.length));
        expect(await screen.findByText(/The questions have been updated since you started/)).toBeTruthy();
        expect(await screen.findByText("1 of 24 questions")).toBeTruthy();
        await waitFor(() => expect(calls.filter((c) => c.path === "/api/v1/fallguard/questions").length).toBeGreaterThan(readsBefore));
        // the answers were dropped: no option is marked until the person picks one
        expect(option(QUESTIONS[0], 0).props.accessibilityState.selected).toBe(false);
        view.unmount();
      }
    });

    it("a duplicate question (422) is shown as a plain sentence, without the raw code", async () => {
      const { view } = await renderSignedIn(routes({ "POST /api/v1/fallguard/submit": () => refusal("fallguard_duplicate_question") }));
      await answerAll();
      expect(await screen.findByText(/Something went wrong with your answers/)).toBeTruthy();
      expect(screen.queryByText(/fallguard_duplicate_question/)).toBeNull();
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
