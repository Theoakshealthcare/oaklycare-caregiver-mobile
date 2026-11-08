import type {
  BookingActionResult,
  BookingDetail,
  BookingListItem,
  BookingPolicy,
  Candidate,
  UnmatchedItem,
} from "@/lib/bookings";

// Shapes copied from the backend's live captures (079-bookings-list, 083-bookings-list-masked, 085-bookings-unmatched,
// 087-booking-detail-ops, 089-booking-detail-finance, 090-booking-detail-clinical, 093-booking-candidates,
// 096-redispatch, 119-policy-get); ids, names, phones and addresses are placeholders.
export const BOOKING_ID = "b0c5091e-4731-4a67-beb2-73d9a29b1149";
export const CAREGIVER_ONE = "d9d06786-abc3-422d-93d1-31074b0359cb";
export const CAREGIVER_TWO = "fadb48ca-b532-4c09-8048-826a49d80a86";

export function makeListItem(overrides: Partial<BookingListItem> = {}): BookingListItem {
  return {
    id: "83995098-cb64-44ca-a158-5e8505779b3e",
    booking_code: "DDDE4418",
    service_type: "nurse",
    scheduled_date: "2026-10-10T08:38:05.531904",
    scheduled_end_date: "2026-10-10T10:38:05.531904",
    city: "Lagos",
    state: "Lagos",
    patient: { id: "50537f4e-b132-4a1f-b2ea-d7f07df939eb", full_name: "Chidi Eze", phone: "+2340000302013", masked: false },
    caregiver: null,
    status: "pending",
    payment_status: "pending",
    dispatch_state: null,
    total_amount_kobo: 5500000,
    channel: "app",
    created_at: "2026-10-07T19:58:05.531010",
    age_minutes: 40,
    needs_address_check: false,
    refund_required: false,
    no_show_flagged_at: null,
    no_show_suspected: false,
    ...overrides,
  };
}

/** Capture 083: the same row as Finance (no `people.pii`). */
export const MASKED_PATIENT = {
  id: "50537f4e-b132-4a1f-b2ea-d7f07df939eb",
  full_name: "Chidi E.",
  phone: "+234****2013",
  masked: true,
};

export function makeUnmatched(overrides: Partial<UnmatchedItem> = {}): UnmatchedItem {
  return {
    ...makeListItem({
      id: BOOKING_ID,
      booking_code: "12FF3CB2",
      scheduled_date: "2026-10-08T01:38:05.522142",
      scheduled_end_date: "2026-10-08T03:38:05.522142",
      patient: { id: "78633756-a277-4e57-bf21-ff53a7e1a80b", full_name: "Ada Okafor", phone: "+2340000302011", masked: false },
      payment_status: "paid",
      dispatch_state: "unmatched",
      created_at: "2026-10-07T19:58:05.521649",
    }),
    queue_reason: "unmatched",
    waiting_minutes: 90,
    ...overrides,
  };
}

/** Capture 087: Operations' view (address visible, clinical masked), a paid pending booking dispatch gave up on. */
export function makeDetail(overrides: Partial<BookingDetail> = {}): BookingDetail {
  return {
    id: BOOKING_ID,
    booking_code: "12FF3CB2",
    service_type: "nurse",
    assistance_type: "Placeholder assistance",
    booking_for: "myself",
    duration_hours: 2,
    scheduled_date: "2026-10-08T01:38:05.522142",
    scheduled_end_date: "2026-10-08T03:38:05.522142",
    actual_start_time: null,
    actual_end_time: null,
    status: "pending",
    channel: "app",
    cancel_reason: null,
    created_at: "2026-10-07T19:58:05.521649",
    updated_at: "2026-10-07T20:38:05.521649",
    age_minutes: 40,
    patient: { id: "78633756-a277-4e57-bf21-ff53a7e1a80b", full_name: "Ada Okafor", phone: "+2340000302011", masked: false },
    caregiver: null,
    address: {
      city: "Lagos",
      state: "Lagos",
      visible: true,
      line: "12 Placeholder Street, Lekki",
      latitude: 6.4474,
      longitude: 3.4723,
      needs_address_check: false,
    },
    clinical: {
      masked: true,
      has_condition: true,
      has_special_instructions: true,
      condition: null,
      special_instructions: null,
    },
    price: { total_kobo: 5500000, service_fee_kobo: 5000000, platform_fee_kobo: 500000 },
    payment: {
      status: "paid",
      paystack_reference: "BKG_12FF3CB2_dddf1043",
      failure_reason: null,
      expires_at: null,
      refund_required: false,
      refund_required_reason: null,
      refund_amount_kobo: null,
      attempts: [],
    },
    dispatch: { state: "unmatched", started_at: "2026-10-07T19:08:05.522350", waves: [], offers: [] },
    events: [],
    no_show_flagged_at: null,
    no_show_suspected: false,
    note_count: 0,
    timeline: [
      { at: "2026-10-07T19:08:05.522350", kind: "dispatch_started", title: "Dispatch started", actor: "system", detail: null },
      { at: "2026-10-07T19:58:05.521649", kind: "booking_created", title: "Booking created via app", actor: "system", detail: null },
    ],
    available_actions: ["redispatch", "assign", "cancel"],
    ...overrides,
  };
}

/** Capture 112's dispatch block: one wave, two open offers. */
export const DISPATCHING = {
  state: "dispatching" as const,
  started_at: "2026-10-07T20:38:05.870942",
  waves: [{ wave_no: 1, sent_at: "2026-10-07T20:38:05.870942", expires_at: "2026-10-07T20:48:05.870942", notified_count: 2 }],
  offers: [
    { caregiver_id: CAREGIVER_ONE, caregiver_name: "Placeholder Nurse One", offered_at: "2026-10-07T20:38:05.877255", response: null, response_at: null },
    { caregiver_id: CAREGIVER_TWO, caregiver_name: "Placeholder Nurse Two", offered_at: "2026-10-07T20:38:05.877259", response: null, response_at: null },
  ],
};

/** Capture 089: Finance's address (no `bookings.address`): present but null, not absent. */
export const HIDDEN_ADDRESS = {
  city: "Lagos",
  state: "Lagos",
  visible: false,
  line: null,
  latitude: null,
  longitude: null,
  needs_address_check: false,
};

/** Capture 090: a Clinical Reviewer's view. */
export const CLINICAL_VISIBLE = {
  masked: false,
  has_condition: true,
  has_special_instructions: true,
  condition: "Placeholder condition (typed in the WhatsApp Flow)",
  special_instructions: "Placeholder instructions (gate code 0000)",
};

export const CANDIDATES: Candidate[] = [
  {
    caregiver_id: CAREGIVER_ONE,
    full_name: "Placeholder Nurse One",
    specialization: "nurse",
    distance_km: 0.22,
    estimated_arrival_minutes: 5,
    match_score: 232.56,
  },
  {
    caregiver_id: CAREGIVER_TWO,
    full_name: "Placeholder Nurse Two",
    specialization: "nurse",
    distance_km: 0.44,
    estimated_arrival_minutes: 5,
    match_score: 232.12,
  },
];

export function makeActionResult(overrides: Partial<BookingActionResult> = {}): BookingActionResult {
  return {
    id: BOOKING_ID,
    booking_code: "12FF3CB2",
    status: "pending",
    payment_status: "paid",
    dispatch_state: "dispatching",
    caregiver_id: null,
    needs_address_check: false,
    refund_required: false,
    refund_required_reason: null,
    refund_amount_kobo: null,
    no_show_flagged_at: null,
    notified_caregivers: 2,
    ...overrides,
  };
}

export const POLICY: BookingPolicy = {
  cancel_free_hours: 12,
  cancel_late_hours: 2,
  cancel_fee_percent: 20,
  cancel_late_fee_percent: 50,
  dropout_redispatch_min_lead_minutes: 120,
  dropout_decision_lead_minutes: 60,
  onmyway_compensation_window_minutes: 120,
  caregiver_late_fee_share_percent: 80,
  caregiver_visit_share_percent: 80,
  earning_hold_hours: 24,
  payout_cadence: "weekly",
  payout_min_naira: 5000,
  finance_refund_limit_naira: 50000,
  short_visit_min_percent: 50,
  updated_at: "2026-10-07T20:31:25.551552",
  updated_by: null,
};
