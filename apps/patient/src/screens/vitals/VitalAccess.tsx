import type React from "react";
import { useState } from "react";
import { StyleSheet } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import { Card, EmptyState } from "@/src/components/ui/card";
import ConfirmDialog from "@/src/components/ui/confirm-dialog";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import QueryError from "@/src/components/ui/query-error";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { SHARE_WARNING, STOPPED_NOTICE, vitalAccessMessage } from "@/src/domain/vitalAccess";
import {
  useChangeVitalAccess,
  useShareableCaregivers,
  useVitalAccessList,
  type AccessGrant,
} from "@/src/hooks/useVitalAccess";

type Pending = { action: "grant" | "revoke"; who: AccessGrant } | null;

/**
 * Sharing vitals with a caregiver (health data: every grant is confirmed first). The people who can see them now come from
 * `GET /vitals/access/list`; the people one could share with are the caregivers on the patient's own bookings. Stopping takes
 * effect at once, but a caregiver in the middle of a visit keeps access until it ends, and the screen says so.
 */
const VitalAccess: React.FC = () => {
  const granted = useVitalAccessList();
  const candidates = useShareableCaregivers();
  const grant = useChangeVitalAccess("grant");
  const revoke = useChangeVitalAccess("revoke");
  const [pending, setPending] = useState<Pending>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<string | null>(null);

  const sharedIds = new Set((granted.data ?? []).map((g) => g.caregiverId));
  const canShare = (candidates.data ?? []).filter((c) => !sharedIds.has(c.caregiverId));

  const confirm = () => {
    if (!pending) return;
    const { action, who } = pending;
    const mutation = action === "grant" ? grant : revoke;
    mutation.mutate(who.caregiverId, {
      onSuccess: () => {
        setPending(null);
        setNotice(action === "grant" ? `You're now sharing your vitals with ${who.name}.` : STOPPED_NOTICE(who.name));
      },
      onError: (e) => {
        setPending(null);
        setNotice(null);
        setDialog(vitalAccessMessage(e, messageForError));
        // A "nothing to revoke" or "caregiver gone" answer means the list on screen is stale.
        void granted.refetch();
      },
    });
  };

  const busy = grant.isPending || revoke.isPending;

  return (
    <Screen title="Who can see my vitals" scroll>
      <Text color={theme.colors.textLight}>Only caregivers you allow can see your vitals. You can take access back at any time.</Text>

      {notice ? (
        <Text color={theme.colors.success} accessibilityRole="alert">
          {notice}
        </Text>
      ) : null}

      <Text weight="bold">Sharing now</Text>
      {granted.isError ? (
        <QueryError what="who can see your vitals" error={granted.error} onRetry={() => void granted.refetch()} />
      ) : granted.isLoading ? null : (granted.data ?? []).length === 0 ? (
        <Card tone="tint">
          <EmptyState title="Nobody yet" message="No caregiver can see your vitals right now." />
        </Card>
      ) : (
        (granted.data ?? []).map((who) => (
          <Card key={who.caregiverId} tone="tint" style={styles.row}>
            <Text weight="bold" style={styles.name}>
              {who.name}
            </Text>
            <Button small variant="outline" title="Stop sharing" accessibilityLabel={`Stop sharing with ${who.name}`} onPress={() => setPending({ action: "revoke", who })} disabled={busy} />
          </Card>
        ))
      )}

      <Text weight="bold">Share with a caregiver</Text>
      {candidates.isError ? (
        <QueryError what="your caregivers" error={candidates.error} onRetry={() => void candidates.refetch()} />
      ) : candidates.isLoading ? null : canShare.length === 0 ? (
        <Text variant="small" color={theme.colors.textLight}>
          Caregivers you have had a visit with will appear here, so you can choose to share your vitals with them.
        </Text>
      ) : (
        canShare.map((who) => (
          <Card key={who.caregiverId} style={styles.row}>
            <Text weight="bold" style={styles.name}>
              {who.name}
            </Text>
            <Button small title="Share" accessibilityLabel={`Share my vitals with ${who.name}`} onPress={() => setPending({ action: "grant", who })} disabled={busy} />
          </Card>
        ))
      )}

      <ConfirmDialog
        visible={pending !== null}
        title={pending?.action === "grant" ? "Share your vitals?" : "Stop sharing?"}
        message={
          pending?.action === "grant"
            ? SHARE_WARNING(pending.who.name)
            : pending
              ? `${pending.who.name} will no longer be able to see your vitals once their visit with you is over.`
              : undefined
        }
        confirmLabel={pending?.action === "grant" ? "Share" : "Stop sharing"}
        cancelLabel="Cancel"
        destructive={pending?.action === "revoke"}
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
      <ErrorDialog visible={dialog !== null} title="Couldn't update sharing" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md },
  name: { flex: 1 },
});

export default VitalAccess;
