import { Button } from "@/components/ui/button";

/** Offset paging for the list endpoints (`limit`/`offset`, with `total` in the body). */
export function Pager({
  offset,
  pageSize,
  total,
  onChange,
}: {
  offset: number;
  pageSize: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= pageSize) return null;
  const from = offset + 1;
  const to = Math.min(offset + pageSize, total);
  return (
    <div className="flex items-center justify-between text-sm">
      <span aria-live="polite">
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - pageSize))}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={offset + pageSize >= total} onClick={() => onChange(offset + pageSize)}>
          Next
        </Button>
      </div>
    </div>
  );
}
