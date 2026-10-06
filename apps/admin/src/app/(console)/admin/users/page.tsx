import type { Metadata } from "next";

import { RequirePermission } from "@/components/permission-gate";

import { AdminUsers } from "./admin-users";

export const metadata: Metadata = { title: "Admin users" };

export default function AdminUsersPage() {
  return (
    <RequirePermission anyOf={["admins.manage"]}>
      <AdminUsers />
    </RequirePermission>
  );
}
