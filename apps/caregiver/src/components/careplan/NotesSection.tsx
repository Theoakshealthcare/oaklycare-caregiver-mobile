import React, { useEffect, useState } from "react";
import { View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import { FieldHint } from "@/src/components/careplan/parts";
import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import {
  NOTE_PERMANENT_HINT,
  VISIT_ONLY_HINT,
  errorCode,
  formatStamp,
  isNoAccess,
  validateNote,
} from "@/src/careplan/carePlanModel";
import { useAddNote, useNotes } from "@/src/hooks/useCarePlanTasks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/src/api/keys";
import type { CarePlan, NoteCategory } from "@/src/services/carePlans.service";

const COPY: Record<NoteCategory, { empty: string; placeholder: string; submit: string; label: string }> = {
  observation: {
    empty: "No notes yet.",
    placeholder: "Add Comments & Observation",
    submit: "Submit Observation",
    label: "Observation",
  },
  special_note: {
    empty: "No special notes yet.",
    placeholder: "Add a special note",
    submit: "Add Special Notes",
    label: "Special note",
  },
};

/**
 * One kind of note on a plan, newest first, with a box to add one. Notes are append-only (no edit, no delete) and
 * only a caregiver on their own in-progress visit can add one (`capabilities.can_add_observation`).
 */
const NotesSection: React.FC<{ plan: CarePlan; category: NoteCategory; onNoAccess: () => void }> = ({ plan, category, onNoAccess }) => {
  const copy = COPY[category];
  const client = useQueryClient();
  const notes = useNotes(plan.id, category);
  const add = useAddNote(plan.id);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canAdd = plan.capabilities.can_add_observation;
  const noAccess = notes.isError && isNoAccess(notes.error);

  useEffect(() => {
    if (noAccess) onNoAccess();
  }, [noAccess, onNoAccess]);

  const submit = () => {
    const problem = validateNote(text);
    setError(problem);
    if (problem) return;
    add.mutate(
      { body: text.trim(), category },
      {
        onSuccess: () => setText(""),
        // The typed text stays on every refusal, so nothing the caregiver wrote is lost.
        onError: (e) => {
          if (isNoAccess(e)) return onNoAccess();
          const code = errorCode(e);
          // The box was shown on a plan that has since changed: reload it so the box goes away.
          if (code === "visit_not_in_progress" || code === "plan_not_editable") void client.invalidateQueries({ queryKey: queryKeys.carePlan(plan.id) });
          setError(code === "visit_not_in_progress" ? VISIT_ONLY_HINT : messageForError(e));
        },
      },
    );
  };

  if (noAccess) return null;
  const items = notes.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View testID={`notes-${category}`} style={{ gap: theme.spacing.sm }}>
      {notes.isError && !notes.data ? (
        <ErrorState error={notes.error} onRetry={() => void notes.refetch()} />
      ) : !notes.data ? (
        <LoadingState testID={`notes-${category}-loading`} />
      ) : items.length === 0 ? (
        <Text variant="small" color={theme.colors.textLight} testID={`notes-${category}-empty`}>
          {copy.empty}
        </Text>
      ) : (
        items.map((note) => (
          <View key={note.id} testID={`note-${note.id}`} style={{ gap: 2 }}>
            <Text variant="small" weight="bold">
              {note.author.name}
            </Text>
            <Text variant="small">{note.body}</Text>
            <Text variant="caption" color={theme.colors.textLight}>
              {formatStamp(note.created_at)}
            </Text>
          </View>
        ))
      )}
      {notes.hasNextPage ? (
        <Button
          testID={`notes-${category}-more`}
          title="Show older notes"
          variant="outline"
          onPress={() => void notes.fetchNextPage()}
          loading={notes.isFetchingNextPage}
        />
      ) : null}
      {notes.isFetchNextPageError ? <FieldHint text={messageForError(notes.error)} testID={`notes-${category}-more-error`} /> : null}

      {canAdd ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Input
            testID={`note-input-${category}`}
            accessibilityLabel={copy.label}
            placeholder={copy.placeholder}
            multiline
            inputStyle={{ minHeight: 80, textAlignVertical: "top" }}
            value={text}
            onChangeText={setText}
          />
          <Text variant="caption" color={theme.colors.textLight}>
            {NOTE_PERMANENT_HINT}
          </Text>
          {error ? <FieldHint text={error} testID={`note-error-${category}`} /> : null}
          <Button testID={`note-submit-${category}`} title={copy.submit} onPress={submit} loading={add.isPending} />
        </View>
      ) : plan.status === "active" ? (
        <Text variant="caption" color={theme.colors.textLight} testID={`notes-${category}-hint`}>
          {VISIT_ONLY_HINT}
        </Text>
      ) : null}
    </View>
  );
};

export default NotesSection;
