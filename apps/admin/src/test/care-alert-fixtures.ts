import type { CareAlert } from "@/lib/care-alerts";

/** Shapes copied from the backend's live captures (`docs/fe-captures/care-alerts/` in the backend repo). All data is fake. */
export const CRITICAL_ID = "0fed722c-ed48-46ac-a321-51cce872ae83";
export const WARNING_ID = "dc88ca85-7a99-42ba-b5d2-70d26a6cfa9f";
export const MISSED_ID = "de64c327-8e84-4c18-9922-dad99c7d8f7c";

export function makeAlert(overrides: Partial<CareAlert> = {}): CareAlert {
  return {
    id: CRITICAL_ID,
    type: "vital_out_of_range",
    severity: "critical",
    status: "open",
    summary: "Heart rate reading is at a critical level.",
    created_at: "2026-11-25T18:51:10.362202",
    last_occurred_at: "2026-11-25T18:51:10.362202",
    occurrence_count: 1,
    patient: { full_name: "Ada Okafor", phone: "+2340000719201", masked: false },
    care_recipient_name: null,
    booking_id: null,
    booking_code: null,
    vital_id: "b942b5a6-1d7c-45db-9e7a-ba69c4fb87c8",
    family_notified_count: 1,
    family_notified_at: "2026-11-25T18:51:10.374171",
    admin_notified_at: "2026-11-25T18:51:10.375951",
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_by: null,
    resolved_at: null,
    note: null,
    detail: null,
    detail_masked: false,
    ...overrides,
  };
}

export const WARNING = makeAlert({
  id: WARNING_ID,
  severity: "warning",
  summary: "Temperature reading is higher than the safe range.",
  patient: { full_name: "Bola Placeholder", phone: "+2340000719202", masked: false },
  family_notified_count: 0,
  admin_notified_at: null,
});

export const MISSED = makeAlert({
  id: MISSED_ID,
  type: "task_missed",
  severity: "warning",
  summary: "2 care tasks not marked done by the end of the visit.",
  occurrence_count: 3,
  booking_id: "38166eb8-ce86-4598-a027-d8722bf1c019",
  booking_code: "322E5BE9",
  vital_id: null,
  family_notified_count: 0,
  family_notified_at: null,
  admin_notified_at: null,
});

export const COUNTS = { open: 3, acknowledged: 0, resolved: 0, critical_active: 1 };

export const CRITICAL_DETAIL = makeAlert({
  detail: {
    vital_type: "heart_rate",
    status: "critical",
    reason: "Heart rate below 50 bpm. Contact the family and arrange an ambulance.",
    value: "45",
    unit: "bpm",
    tasks: null,
    days: null,
  },
});
