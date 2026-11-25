import React, { useState } from "react";
import { View } from "react-native";
import type { StackScreenProps } from "@react-navigation/stack";
import { errorCode, isVisitNotActiveError } from "@oakly/api-client";

import { ApiError, messageForError } from "@/src/api/errors";
import ScreenShell from "@/src/components/account/ScreenShell";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import { Card, FieldHint } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Notice from "@/src/components/ui/notice";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  DOCUMENTATION_CLOSED,
  DOCUMENTATION_EMPTY,
  DOCUMENTATION_GONE,
  DOCUMENTATION_PERMANENT_HINT,
  DOCUMENTATION_PLACEHOLDER,
  DOCUMENTATION_SUBTITLE,
  DOCUMENTATION_TITLE,
  validateDocumentation,
} from "@/src/careplan/documentationCopy";
import { useAddVisitDocumentation, useVisitDocumentation } from "@/src/hooks/useVisitDocumentation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { formatStamp, formatUntil } from "@/src/utils/dates";

type Props = StackScreenProps<ScreenParamLists, "VisitDocumentation">;

/**
 * The caregiver's own documentation for a visit: any caregiver on the visit, not only a nurse. Private (the family never
 * sees it), append-only, and open while the visit is in progress and for 2 h after it (`can_add` / `closes_at`). After 24 h
 * the API answers 404 and the entries are no longer shown to the caregiver.
 */
const VisitDocumentation: React.FC<Props> = ({ route }) => {
  const { bookingId } = route.params;
  const query = useVisitDocumentation(bookingId);
  const add = useAddVisitDocumentation(bookingId);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // A save that comes back 409 `visit_not_active` means the window ended while the entry was being typed: the text stays.
  const [closedByServer, setClosedByServer] = useState(false);

  if (query.isError && !query.data) {
    const gone = query.error instanceof ApiError && query.error.status === 404;
    return (
      <ScreenShell title={DOCUMENTATION_TITLE}>
        {gone ? (
          <Text variant="body" color={theme.colors.textLight} testID="documentation-gone">
            {DOCUMENTATION_GONE}
          </Text>
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </ScreenShell>
    );
  }
  if (!query.data) {
    return (
      <ScreenShell title={DOCUMENTATION_TITLE}>
        <LoadingState testID="documentation-loading" />
      </ScreenShell>
    );
  }

  const { items, can_add: canAdd, closes_at: closesAt } = query.data;
  const open = canAdd && !closedByServer;

  const submit = () => {
    const problem = validateDocumentation(text);
    setError(problem);
    if (problem) return;
    add.mutate(text.trim(), {
      onSuccess: () => setText(""),
      onError: (e) => {
        if (isVisitNotActiveError(e instanceof ApiError ? e.body : e)) {
          setClosedByServer(true);
          return setError(DOCUMENTATION_CLOSED);
        }
        setError(errorCode(e instanceof ApiError ? e.body : e) === "not_found" ? DOCUMENTATION_GONE : messageForError(e));
      },
    });
  };

  return (
    <ScreenShell title={DOCUMENTATION_TITLE} subtitle={DOCUMENTATION_SUBTITLE}>
      <View style={{ gap: theme.spacing.md }}>
        {!open ? (
          <Notice testID="documentation-closed" message={DOCUMENTATION_CLOSED} />
        ) : closesAt ? (
          <Notice testID="documentation-window" message={`Visit complete. You can add entries until ${formatUntil(closesAt)}.`} />
        ) : null}

        {open ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Input
              testID="documentation-input"
              accessibilityLabel="Your documentation"
              placeholder={DOCUMENTATION_PLACEHOLDER}
              multiline
              inputStyle={{ minHeight: 120, textAlignVertical: "top" }}
              value={text}
              onChangeText={setText}
            />
            <Text variant="caption" color={theme.colors.textLight}>
              {DOCUMENTATION_PERMANENT_HINT}
            </Text>
            {error ? <FieldHint text={error} testID="documentation-error" /> : null}
            <Button testID="documentation-submit" title="Save entry" onPress={submit} loading={add.isPending} />
          </View>
        ) : null}

        {items.length === 0 ? (
          <Text variant="small" color={theme.colors.textLight} testID="documentation-empty">
            {DOCUMENTATION_EMPTY}
          </Text>
        ) : (
          items.map((entry) => (
            <Card key={entry.id} testID={`documentation-${entry.id}`}>
              <Text variant="small">{entry.body}</Text>
              <Text variant="caption" color={theme.colors.textLight}>
                {formatStamp(entry.created_at)}
              </Text>
            </Card>
          ))
        )}
      </View>
    </ScreenShell>
  );
};

export default VisitDocumentation;
