import { humanize } from "@/lib/format";

/** Patient name and phone; a small marker says the backend masked them (the admin lacks `people.pii`). */
export function PatientCell({ patient }: { patient: { full_name?: string | null; phone?: string | null; masked: boolean } }) {
  return (
    <>
      <div className="font-medium">
        {patient.full_name ?? "—"}
        {patient.masked ? <span className="ml-1 text-xs font-normal text-muted-foreground">masked</span> : null}
      </div>
      <div className="text-xs text-muted-foreground">{patient.phone ?? "—"}</div>
    </>
  );
}

export function channelLabel(channel: string): string {
  return channel === "whatsapp" ? "WhatsApp" : humanize(channel);
}
