export interface FaqItem {
  question: string;
  answer: string;
}

// CONTENT: owner to supply. The questions come from the FAQ design; every answer below is a short
// neutral placeholder and must be replaced with approved copy before launch.
export const FAQ_ITEMS: FaqItem[] = [
  { question: "What is OaklyCare?", answer: "OaklyCare connects patients with verified nurses and caregivers for care at home." },
  { question: "Where is OaklyCare available?", answer: "Availability depends on your area. Details will be shared here soon." },
  { question: "What types of care services does OaklyCare offer?", answer: "A list of the care services will be shared here soon." },
  { question: "How does OaklyCare ensure the safety of care providers?", answer: "Safety information will be shared here soon." },
  { question: "How do I book a caregiver or nurse?", answer: "Booking information will be shared here soon." },
  { question: "Can I schedule recurring care appointments?", answer: "Information about recurring care will be shared here soon." },
  { question: "Can I request urgent or same-day care?", answer: "Information about urgent care will be shared here soon." },
  { question: "How much does home care cost with OaklyCare?", answer: "Pricing information will be shared here soon." },
];
