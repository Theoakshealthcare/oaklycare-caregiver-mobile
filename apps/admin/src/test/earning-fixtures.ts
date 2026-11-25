import type { Earning } from "@/lib/earnings";

// Shapes follow the backend's `EarningOut` schema (backend/app/schemas/admin_earning.py) and the hold reasons its service
// writes (backend/app/services/earnings.py). They are NOT live captures: no stack was running when this was written.
// Ids, names and booking codes are placeholders.
export function makeEarning(overrides: Partial<Earning> = {}): Earning {
  return {
    id: "0a1b2c3d-0000-4000-8000-000000000001",
    type: "earning",
    status: "pending_clearance",
    amount_kobo: 1200000,
    base_amount_kobo: 1500000,
    share_percent: 80,
    caregiver_id: "3302d88e-e1e4-482d-90d5-c636d2afb9c4",
    caregiver_name: "Placeholder Pending",
    booking_id: "9f000000-0000-4000-8000-000000000001",
    booking_code: "BKG-PEND01",
    available_at: "2099-01-02T10:00:00",
    released_at: null,
    status_reason: null,
    status_changed_by: null,
    status_changed_at: null,
    created_at: "2026-11-24T10:00:00.123456",
    ...overrides,
  };
}

export const PENDING = makeEarning();

/** A system hold: no admin attached, the reason text the backend writes for a visit under the minimum share. */
export const SHORT_VISIT = makeEarning({
  id: "0a1b2c3d-0000-4000-8000-000000000002",
  status: "held",
  amount_kobo: 800000,
  caregiver_name: "Placeholder Short",
  booking_id: "9f000000-0000-4000-8000-000000000002",
  booking_code: "BKG-SHORT02",
  status_reason: "Short visit: under 50% of the booked time was spent on site (held for Finance review)",
  status_changed_by: null,
  status_changed_at: "2026-11-24T10:05:00",
});

/** Credited already held for a booking an admin flagged as a no-show; attributed to the admin who flagged it. */
export const NO_SHOW = makeEarning({
  id: "0a1b2c3d-0000-4000-8000-000000000003",
  status: "held",
  amount_kobo: 950000,
  caregiver_name: "Placeholder NoShow",
  booking_id: "9f000000-0000-4000-8000-000000000003",
  booking_code: "BKG-NOSHW3",
  status_reason: "No-show flagged on this booking",
  status_changed_by: "11111111-1111-4111-8111-111111111111",
  status_changed_at: "2026-11-24T11:00:00",
});

export const ADMIN_HOLD = makeEarning({
  id: "0a1b2c3d-0000-4000-8000-000000000004",
  status: "held",
  amount_kobo: 700000,
  caregiver_name: "Placeholder AdminHold",
  booking_id: "9f000000-0000-4000-8000-000000000004",
  booking_code: "BKG-ADMIN04",
  status_reason: "Family disputes the visit; waiting for the call-back",
  status_changed_by: "22222222-2222-4222-8222-222222222222",
  status_changed_at: "2026-11-24T12:00:00",
});

export const RELEASED = makeEarning({
  id: "0a1b2c3d-0000-4000-8000-000000000005",
  status: "successful",
  caregiver_name: "Placeholder Released",
  booking_id: "9f000000-0000-4000-8000-000000000005",
  booking_code: "BKG-RELSD05",
  available_at: "2026-11-20T10:00:00",
  released_at: "2026-11-20T10:03:00",
});

export const VOIDED = makeEarning({
  id: "0a1b2c3d-0000-4000-8000-000000000006",
  status: "voided",
  caregiver_name: "Placeholder Voided",
  booking_id: "9f000000-0000-4000-8000-000000000006",
  booking_code: "BKG-VOID06",
  status_reason: "Visit never took place",
  status_changed_by: "22222222-2222-4222-8222-222222222222",
  status_changed_at: "2026-11-21T09:00:00",
});
