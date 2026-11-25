import { create } from "zustand";

import type { BookingDraft } from "@/src/domain/booking";

export const EMPTY_DRAFT: BookingDraft = {
  forWhom: "",
  serviceType: "",
  serviceLabel: "",
  assistance: "",
  assistanceOther: "",
  condition: "",
  conditionOther: "",
  date: "",
  time: "",
  durationMinutes: null,
  state: "",
  city: "",
  address: "",
  phone: "",
  email: "",
  latitude: null,
  longitude: null,
  locationSource: null,
  locationLabel: null,
  locationKey: "",
  genderPreference: "any",
  languagePreference: "any",
  instructions: "",
};

interface DraftStore {
  draft: BookingDraft;
  patch: (fields: Partial<BookingDraft>) => void;
  reset: () => void;
}

/** The booking form lives across its two steps and the summary; it is not saved anywhere and resets when the flow starts. */
export const useBookingDraft = create<DraftStore>((set) => ({
  draft: EMPTY_DRAFT,
  patch: (fields) => set((s) => ({ draft: { ...s.draft, ...fields } })),
  reset: () => set({ draft: EMPTY_DRAFT }),
}));
