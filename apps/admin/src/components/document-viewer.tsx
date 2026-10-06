"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import * as React from "react";

import { Skeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { fetchDocumentBlob } from "@/lib/caregivers";

/** Inline PDF / image viewer. The file comes through the authorized route as a blob; nothing is public. */
export function DocumentViewer({ documentId, name, mimeType }: { documentId: string; name: string; mimeType: string | null }) {
  const query = useQuery({
    queryKey: ["caregiver-document", documentId],
    queryFn: () => fetchDocumentBlob(documentId),
    staleTime: Infinity,
    gcTime: 0,
  });
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!query.data) return;
    const objectUrl = URL.createObjectURL(query.data);
    // An object URL is an external resource tied to this blob, so it is created and revoked here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [query.data]);

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <div role="alert" className="grid gap-2 rounded-md border border-destructive/40 p-4 text-sm">
        <p>We couldn&apos;t load this document. {errorMessage(query.error, "")}</p>
        <div>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (!url) return <Skeleton className="h-96 w-full" />;

  const type = query.data.type || mimeType || "";
  if (type === "application/pdf") {
    return <iframe title={`Document: ${name}`} src={url} className="h-[32rem] w-full rounded-md border bg-white" />;
  }
  if (type.startsWith("image/")) {
    return (
      <div className="relative h-[32rem] w-full overflow-hidden rounded-md border bg-muted">
        <Image unoptimized src={url} alt={`Document: ${name}`} fill className="object-contain" />
      </div>
    );
  }
  return (
    <p className="rounded-md border p-4 text-sm">
      This file type can&apos;t be previewed.{" "}
      <a className="underline" href={url} download={name}>
        Download {name}
      </a>
    </p>
  );
}
