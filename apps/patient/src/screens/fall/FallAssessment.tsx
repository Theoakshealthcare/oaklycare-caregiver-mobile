import { useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import { EmptyState } from "@/src/components/ui/card";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Icon from "@/src/components/ui/icon";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import QueryError from "@/src/components/ui/query-error";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { fallguardRefusal, sectionFor, type FallguardAnswers } from "@/src/domain/fallguard";
import { useFallguardQuestions, useSubmitFallguard } from "@/src/hooks/useFallguard";
import { useNav } from "@/src/navigation/Navigations";

/**
 * One generic question screen, driven by the question list (the old app had 24 near-identical files). As in the design there is no
 * Next or Submit button: choosing an answer moves on, and choosing the last one sends the assessment. Each option shows the score
 * the server says it is worth ("Score : 2"); nothing is added up here.
 */
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

  const goBack = () => (index > 0 ? setIndex(index - 1) : navigation.goBack());

  if (!question) {
    return (
      <View style={styles.screen}>
        <BackLink onPress={() => navigation.goBack()} />
        {questions.isError ? (
          <QueryError what="the questions" error={questions.error} onRetry={() => void questions.refetch()} />
        ) : questions.isLoading ? null : (
          <EmptyState title="No questions available right now" message="Please try again later." />
        )}
      </View>
    );
  }

  const last = index === list.length - 1;
  const chosen = answers[question.id];
  const section = sectionFor(index + 1, list.length);

  const choose = (i: number) => {
    if (submit.isPending) return;
    const next = { ...answers, [question.id]: i };
    setAnswers(next);
    if (!last) return setIndex(index + 1);
    submit.mutate({ questions: list, answers: next }, {
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
    <View style={styles.screen}>
      <BackLink onPress={goBack} disabled={submit.isPending} />
      <KeyboardScrollView contentContainerStyle={styles.content}>
        {section ? (
          <>
            <Text variant="h2" weight="bold">
              {section.title}
            </Text>
            {section.subtitle ? (
              <Text variant="small" color={theme.colors.textLight}>
                {section.subtitle}
              </Text>
            ) : null}
          </>
        ) : null}
        <View>
          <Text variant="small" color={theme.colors.textLight}>{`${index + 1} of ${list.length} questions`}</Text>
          <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: list.length, now: index + 1 }}>
            <View style={[styles.fill, { width: `${Math.max(1.5, (index / list.length) * 100)}%` }]} />
          </View>
        </View>
        <Text weight="medium" style={styles.prompt}>
          {question.prompt}
        </Text>
        <View style={styles.options}>
          {question.options.map((option, i) => {
            const selected = chosen === i;
            return (
              <Pressable
                key={option.text}
                accessibilityRole="button"
                accessibilityLabel={`${option.text}, Score : ${option.score}`}
                accessibilityState={{ selected }}
                onPress={() => choose(i)}
                style={[styles.option, selected && styles.selected]}
              >
                <Text variant="small" style={styles.optionText}>
                  {option.text}
                </Text>
                <Text variant="small" color={theme.colors.textLight}>{`Score : ${option.score}`}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.back}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={submit.isPending} onPress={goBack} style={styles.backButton}>
            <Icon name="chevron-back" size={18} color={theme.colors.primary} />
            <Text weight="bold" color={theme.colors.primary}>
              Back
            </Text>
          </Pressable>
        </View>
        {submit.isPending ? (
          <View style={styles.sending}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text variant="small" color={theme.colors.textLight}>
              Sending your answers…
            </Text>
          </View>
        ) : null}
      </KeyboardScrollView>
      <ErrorDialog visible={dialog !== null} title="Could not submit" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </View>
  );
};

/** The "‹ Back" text link at the top of every frame. */
const BackLink: React.FC<{ onPress: () => void; disabled?: boolean }> = ({ onPress, disabled }) => (
  <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} disabled={disabled} onPress={onPress} style={styles.link}>
    <Icon name="chevron-back" size={16} />
    <Text variant="small">Back</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.white },
  link: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, alignSelf: "flex-start" },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },
  // Figma: a hairline track that is barely there, with the teal fill on it.
  track: { height: 3, backgroundColor: "#F0F0F0", borderRadius: 2, marginTop: theme.spacing.xs + 2 },
  fill: { height: 3, backgroundColor: theme.colors.primary, borderRadius: 2 },
  prompt: { fontSize: theme.sizes.subtitle, lineHeight: Math.round(theme.sizes.subtitle * 1.4) },
  options: { gap: theme.spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
    paddingVertical: theme.spacing.sm,
  },
  selected: { backgroundColor: theme.colors.primaryLight, borderWidth: 2 },
  optionText: { flex: 1 },
  back: { alignSelf: "flex-start" },
  // Figma: an outlined rounded box (not a pill) with a chevron and "Back" in bold teal.
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.lg,
  },
  sending: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
});

export default FallAssessment;
