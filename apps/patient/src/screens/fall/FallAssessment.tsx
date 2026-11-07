import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import { EmptyState } from "@/src/components/ui/card";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import QueryError from "@/src/components/ui/query-error";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { fallguardRefusal, type FallguardAnswers } from "@/src/domain/fallguard";
import { useFallguardQuestions, useSubmitFallguard } from "@/src/hooks/useFallguard";
import { useNav } from "@/src/navigation/Navigations";

/** One generic question screen, driven by the question list (the old app had 24 near-identical files). No scores are shown. */
const FallAssessment: React.FC = () => {
  const navigation = useNav();
  const client = useQueryClient();
  const questions = useFallguardQuestions();
  const submit = useSubmitFallguard();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<FallguardAnswers>({});
  const [dialog, setDialog] = useState<string | null>(null);

  const list = questions.data ?? [];
  const question = list[index];

  if (!question) {
    return (
      <Screen title="FallGuard">
        {questions.isError ? (
          <QueryError what="the questions" error={questions.error} onRetry={() => void questions.refetch()} />
        ) : questions.isLoading ? null : (
          <EmptyState title="No questions available right now" message="Please try again later." />
        )}
      </Screen>
    );
  }

  const last = index === list.length - 1;
  const chosen = answers[question.id];

  const next = () => {
    if (!last) return setIndex(index + 1);
    submit.mutate({ questions: list, answers }, {
      onSuccess: (result) => navigation.replace("FallResult", { result }),
      onError: (e) => {
        const refusal = fallguardRefusal(e);
        if (refusal?.kind === "reload") {
          // The questionnaire changed: fetch it again and start over, rather than resend answers that cannot match.
          setAnswers({});
          setIndex(0);
          void client.invalidateQueries({ queryKey: ["fallguard", "questions"] });
        }
        setDialog(refusal?.message ?? messageForError(e));
      },
    });
  };

  return (
    <Screen title="FallGuard assessment" scroll>
      <Text variant="small" color={theme.colors.textLight}>{`${index + 1} of ${list.length} questions`}</Text>
      <Text variant="h3" weight="bold">
        {question.prompt}
      </Text>
      <View style={styles.options}>
        {question.options.map((option, i) => {
          const selected = chosen === i;
          return (
            <Pressable
              key={option.text}
              accessibilityRole="radio"
              accessibilityLabel={option.text}
              accessibilityState={{ selected }}
              onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: i }))}
              style={[styles.option, selected && styles.selected]}
            >
              <Icon name={selected ? "radio-button-on" : "radio-button-off"} size={22} color={theme.colors.primary} />
              <Text style={styles.optionText}>{option.text}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.nav}>
        {index > 0 ? <Button title="Back" variant="outline" onPress={() => setIndex(index - 1)} disabled={submit.isPending} style={styles.navButton} /> : null}
        <Button
          title={last ? "Submit" : "Next"}
          onPress={next}
          disabled={chosen === undefined}
          loading={submit.isPending}
          style={styles.navButton}
        />
      </View>
      <ErrorDialog visible={dialog !== null} title="Could not submit" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  options: { gap: theme.spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.md,
  },
  selected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  optionText: { flex: 1 },
  nav: { flexDirection: "row", gap: theme.spacing.sm },
  navButton: { flex: 1 },
});

export default FallAssessment;
