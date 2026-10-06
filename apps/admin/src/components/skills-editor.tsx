"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import type { SkillRow } from "@/lib/caregivers";

const SERVICE_TYPES: SkillRow["service_type"][] = ["nurse", "doctor", "physiotherapist", "caregiver", "nutritionist"];

function sameSkills(a: SkillRow[], b: SkillRow[]): boolean {
  return JSON.stringify(a.map((s) => [s.service_type, s.sub_specialty ?? ""])) ===
    JSON.stringify(b.map((s) => [s.service_type, s.sub_specialty ?? ""]));
}

/** Replaces the caregiver's whole skill list (`PUT /skills`). At least one skill is needed to approve. */
export function SkillsEditor({
  skills,
  editable,
  onSave,
}: {
  skills: SkillRow[];
  editable: boolean;
  onSave: (skills: SkillRow[]) => Promise<void>;
}) {
  const [rows, setRows] = React.useState<SkillRow[]>(skills);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // The parent re-mounts this editor (via `key`) when the saved skills change, which resets `rows`.
  const dirty = !sameSkills(rows, skills);

  function update(i: number, patch: Partial<SkillRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(rows.map((r) => ({ service_type: r.service_type, sub_specialty: r.sub_specialty?.trim() || null })));
    } catch (err) {
      setError(errorMessage(err instanceof Error ? { detail: err.message } : err, "We couldn't save the skills."));
    } finally {
      setBusy(false);
    }
  }

  if (!editable) {
    return rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">No skills recorded.</p>
    ) : (
      <ul className="flex flex-wrap gap-2 text-sm">
        {rows.map((s, i) => (
          <li key={i} className="rounded-full border px-3 py-1">
            {s.service_type}
            {s.sub_specialty ? ` · ${s.sub_specialty}` : ""}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills yet. Add at least one before approving; matching uses them.</p>
      ) : null}
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Select aria-label={`Skill ${i + 1} service type`} className="w-48" value={row.service_type} onChange={(e) => update(i, { service_type: e.target.value as SkillRow["service_type"] })}>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input aria-label={`Skill ${i + 1} sub-specialty`} className="w-64" placeholder="Sub-specialty (optional)" maxLength={100} value={row.sub_specialty ?? ""} onChange={(e) => update(i, { sub_specialty: e.target.value })} />
          <Button variant="ghost" size="icon" aria-label={`Remove skill ${i + 1}`} onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { service_type: "nurse", sub_specialty: null }])}>
          <Plus aria-hidden /> Add skill
        </Button>
        <Button size="sm" disabled={!dirty || busy} onClick={() => void save()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save skills
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
