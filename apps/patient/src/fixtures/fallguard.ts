import type { FallguardQuestion } from "@/src/domain/fallguard";

/**
 * The first six of the 24 questions the backend seeds (`seed_fallguard_questions.py`), without their scores. The
 * FallGuard slice reads `GET /fallguard/questions` instead.
 */
export const SAMPLE_QUESTIONS: FallguardQuestion[] = [
  {
    id: "q1",
    prompt: "What is your current age?",
    options: [{ text: "Less than 65" }, { text: "65–74" }, { text: "75–84" }, { text: "85+" }],
  },
  {
    id: "q2",
    prompt: "Do you live alone or with others?",
    options: [{ text: "With family" }, { text: "With a caregiver" }, { text: "Alone" }],
  },
  {
    id: "q3",
    prompt: "Have you fallen in the last 12 months?",
    options: [{ text: "No" }, { text: "Yes, 1–2 times" }, { text: "Yes, 3+ times" }],
  },
  {
    id: "q4",
    prompt: "Do you use mobility aids regularly?",
    options: [{ text: "No" }, { text: "Occasionally" }, { text: "Always" }],
  },
  {
    id: "q5",
    prompt: "Do you feel unsteady when walking or standing?",
    options: [{ text: "Never" }, { text: "Occasionally" }, { text: "Frequently" }],
  },
  {
    id: "q6",
    prompt: "Can you stand up from a chair without needing to push yourself up with your hands?",
    options: [{ text: "Yes, easily" }, { text: "With difficulty" }, { text: "Not at all" }],
  },
];

/** The four recommendation cards the owner's design shows, until the server's own recommendations are wired. */
export const SAMPLE_RECOMMENDATIONS = [
  { title: "Regular exercise", text: "Gentle strength and balance exercises, as your doctor advises." },
  { title: "Home safety check", text: "Clear walkways, add grab bars and make sure every room is well lit." },
  { title: "Reassessment schedule", text: "Take the assessment again every few months, or after any fall." },
  { title: "Footwear safety", text: "Wear well-fitting shoes with a firm, non-slip sole indoors and out." },
];
