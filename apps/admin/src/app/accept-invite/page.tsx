import type { Metadata } from "next";
import { Suspense } from "react";

import { AcceptInviteScreen } from "./accept-invite-screen";

export const metadata: Metadata = { title: "Accept invite" };

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteScreen />
    </Suspense>
  );
}
