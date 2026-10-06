import React, { useEffect, useState } from "react";
import { TextInput, View } from "react-native";

import { formatCountdown } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { isCompleteCode, sanitizeCode, secondsLeft, VISIT_CODE_LENGTH } from "@/src/visit/visitFlow";

interface StepFrameProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const StepFrame: React.FC<StepFrameProps> = ({ title, subtitle, children }) => (
  <View style={{ gap: 16 }}>
    <Text variant="h2" weight="bold">
      {title}
    </Text>
    {subtitle ? (
      <Text variant="body" color={theme.colors.textLight}>
        {subtitle}
      </Text>
    ) : null}
    {children}
  </View>
);

interface VisitSummary {
  patientName: string;
  address: string;
  when: string;
}

const Summary: React.FC<{ visit: VisitSummary }> = ({ visit }) => (
  <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 16, gap: 4 }}>
    <Text variant="body" weight="bold">
      {visit.patientName}
    </Text>
    <Text variant="body" color={theme.colors.textLight}>
      {visit.address}
    </Text>
    <Text variant="small" color={theme.colors.textLight}>
      {visit.when}
    </Text>
  </View>
);

/** Step 1 (status `accepted`): set off, or go straight to the code if already at the door. */
export const OnMyWayStep: React.FC<{
  visit: VisitSummary;
  busy: boolean;
  onOnMyWay: () => void;
  onArrived: () => void;
}> = ({ visit, busy, onOnMyWay, onArrived }) => (
  <StepFrame title="Ready to set off?" subtitle="Tell the patient you're on your way. Oakly shares your location until you complete the visit.">
    <Summary visit={visit} />
    <Button title="On my way" onPress={onOnMyWay} loading={busy} />
    <Button title="I've arrived: enter visit code" variant="outline" onPress={onArrived} disabled={busy} />
  </StepFrame>
);

export interface CodeStepProps {
  visit: VisitSummary;
  busy: boolean;
  /** Epoch ms the lock ends, or null. */
  lockedUntil: number | null;
  attemptsLeft: number | null;
  error: string | null;
  onSubmit: (code: string) => void;
  /** Injected so tests can drive the countdown. */
  now?: () => number;
}

/** Ticks once a second while a lock is running; returns the whole seconds left. */
function useSecondsLeft(lockedUntil: number | null, now: () => number): number {
  // The tick only re-renders; the remaining time is always derived from the clock.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lockedUntil === null) return;
    const timer = setInterval(() => {
      setTick((t) => t + 1);
      if (secondsLeft(lockedUntil, now()) === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil, now]);
  return secondsLeft(lockedUntil, now());
}

/**
 * Step 2 (status `accepted` or `en_route`): the 4-digit code the patient reads out. The caregiver
 * never sees the code. After 3 wrong codes the backend locks `start` for 15 minutes (even the
 * right code is refused), so the input is replaced by a countdown.
 */
export const VisitCodeStep: React.FC<CodeStepProps> = ({
  visit,
  busy,
  lockedUntil,
  attemptsLeft,
  error,
  onSubmit,
  now = Date.now,
}) => {
  const [code, setCode] = useState("");
  const left = useSecondsLeft(lockedUntil, now);
  const locked = left > 0;

  return (
    <StepFrame
      title="Enter the visit code"
      subtitle="Ask the patient for the 4-digit code shown in their Oakly app. It proves you have arrived."
    >
      <Summary visit={visit} />
      {locked ? (
        <View
          accessibilityRole="alert"
          style={{ backgroundColor: theme.colors.secondaryLight, borderRadius: 12, padding: 16, gap: 8 }}
        >
          <Text variant="body" weight="bold" color={theme.colors.error}>
            Visit code locked
          </Text>
          <Text variant="h2" weight="bold" testID="lock-countdown">
            {formatCountdown(left)}
          </Text>
          <Text variant="small" color={theme.colors.textLight}>
            Too many wrong codes. Ask the patient to check the code in their app rather than guessing. You can try again when the timer ends.
          </Text>
        </View>
      ) : (
        <>
          <TextInput
            testID="visit-code-input"
            accessibilityLabel="Visit code"
            value={code}
            onChangeText={(text) => setCode(sanitizeCode(text))}
            keyboardType="number-pad"
            maxLength={VISIT_CODE_LENGTH}
            placeholder="0000"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            style={{
              borderWidth: 1,
              borderColor: error ? theme.colors.error : theme.colors.border,
              borderRadius: 12,
              padding: 16,
              fontSize: 32,
              letterSpacing: 12,
              textAlign: "center",
            }}
          />
          {attemptsLeft !== null ? (
            <Text variant="small" color={theme.colors.textLight}>
              {attemptsLeft} {attemptsLeft === 1 ? "try" : "tries"} left before the code is locked for 15 minutes.
            </Text>
          ) : null}
        </>
      )}
      {error ? (
        <Text variant="small" color={theme.colors.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button
        title="Start visit"
        onPress={() => onSubmit(code)}
        loading={busy}
        disabled={locked || !isCompleteCode(code)}
      />
    </StepFrame>
  );
};

/** Step 3 (status `in_progress`). */
export const InProgressStep: React.FC<{
  visit: VisitSummary;
  busy: boolean;
  onComplete: () => void;
  onNotes: () => void;
}> = ({ visit, busy, onComplete, onNotes }) => (
  <StepFrame title="Visit in progress" subtitle="Complete the visit when you are done. This stops location sharing.">
    <Summary visit={visit} />
    <Button title="Complete visit" onPress={onComplete} loading={busy} />
    <Button title="Visit notes" variant="outline" onPress={onNotes} disabled={busy} />
  </StepFrame>
);

/** Step 4 (status `completed`). */
export const VisitDoneStep: React.FC<{ onHome: () => void }> = ({ onHome }) => (
  <StepFrame title="Visit completed" subtitle="Thank you. Location sharing has stopped.">
    <Button title="Back to home" onPress={onHome} />
  </StepFrame>
);

/** The booking is no longer an active visit (cancelled, or never accepted). */
export const VisitClosedStep: React.FC<{ status: string; onHome: () => void }> = ({ status, onHome }) => (
  <StepFrame title="This visit is closed" subtitle={`Its status is ${status.replace("_", " ")}. There is nothing left to do here.`}>
    <Button title="Back to home" onPress={onHome} />
  </StepFrame>
);

/** The backend refused a visit action because the account is no longer approved. The flow stops. */
export const VisitStoppedStep: React.FC<{ message: string; onHome: () => void }> = ({ message, onHome }) => (
  <StepFrame title="You can't continue this visit" subtitle={message}>
    <Button title="Back to home" onPress={onHome} />
  </StepFrame>
);
