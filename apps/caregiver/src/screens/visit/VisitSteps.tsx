import React, { useEffect, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { formatCountdown } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import SuccessIllustration from "@/src/components/ui/success-illustration";
import Text from "@/src/components/ui/text";
import { theme, MAX_FONT_SCALE } from "@/src/constants/theme";
import { parseBackendDate } from "@/src/utils/dates";
import { canDropOut, isCompleteCode, isOnMyWayOpen, onMyWayUnlocksAt, sanitizeCode, secondsLeft, shortVisitDoneMessage, VISIT_CODE_LENGTH } from "@/src/visit/visitFlow";

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
  /** ISO start time of the visit; On my way unlocks two hours before it. */
  scheduledDate: string;
  busy: boolean;
  onOnMyWay: () => void;
  /** "I've arrived": tells the patient (POST action `arrived`); the booking then carries `arrived_at`. */
  onArrived: () => void;
  /** Set only after "I've arrived" failed: lets the caregiver go on to the code (arrival never blocks the visit). */
  onSkipToCode?: () => void;
  /** Booking channel: only a WhatsApp booking can be dropped in the app. */
  channel: string;
  onCantMakeIt: () => void;
  onContactSupport: () => void;
  /** Injected so tests can drive the clock. */
  now?: () => number;
}> = ({ visit, scheduledDate, busy, onOnMyWay, onArrived, onSkipToCode, channel, onCantMakeIt, onContactSupport, now = Date.now }) => {
  const startMs = parseBackendDate(scheduledDate).getTime();
  const [tick, setTick] = useState(now());
  useEffect(() => {
    const id = setInterval(() => setTick(now()), 15_000);
    return () => clearInterval(id);
  }, [now]);
  const open = Number.isNaN(startMs) || isOnMyWayOpen(startMs, tick);
  const unlocksAt = new Date(onMyWayUnlocksAt(startMs));
  return (
    <StepFrame title="Ready to set off?" subtitle="Tell the patient you're on your way. Oakly shares your location until you complete the visit.">
      <Summary visit={visit} />
      <Button title="On my way" onPress={onOnMyWay} loading={busy} disabled={!open || busy} />
      {open ? null : (
        <Text variant="small" color={theme.colors.textLight} testID="on-my-way-hint">
          {`You can mark yourself on the way from ${formatTime(unlocksAt)}, 2 hours before the visit.`}
        </Text>
      )}
      <Button title="I've arrived" variant="outline" onPress={onArrived} disabled={busy} />
      {onSkipToCode ? (
        <Text variant="small" color={theme.colors.primary} testID="skip-to-code" onPress={onSkipToCode}>
          Enter the visit code anyway
        </Text>
      ) : null}
      {canDropOut(channel, "accepted", startMs, tick) ? (
        <Button title="I can't make this visit" variant="outline" onPress={onCantMakeIt} disabled={busy} />
      ) : (
        <Text variant="small" color={theme.colors.textLight} testID="contact-support-link" onPress={onContactSupport}>
          Need to cancel? Contact support
        </Text>
      )}
    </StepFrame>
  );
};

function formatTime(date: Date): string {
  return date.toLocaleString("en-NG", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export interface CodeStepProps {
  visit: VisitSummary;
  busy: boolean;
  /** Epoch ms the lock ends, or null. */
  lockedUntil: number | null;
  attemptsLeft: number | null;
  error: string | null;
  onSubmit: (code: string) => void;
  /**
   * "I've arrived" for a visit that has not been marked yet, or the done state once `arrived_at` is set
   * (read from the booking, so it survives a restart). Omitted: no arrival UI at all.
   */
  arrival?: { arrived: boolean; busy: boolean; onArrived: () => void };
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
  arrival,
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
      {arrival ? (
        arrival.arrived ? (
          <Text variant="small" weight="medium" color={theme.colors.success} testID="arrived-notice">
            The patient knows you&apos;ve arrived.
          </Text>
        ) : (
          <Button title="I've arrived" variant="outline" onPress={arrival.onArrived} loading={arrival.busy} disabled={arrival.busy} />
        )
      ) : null}
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
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={{
              borderWidth: 1,
              borderColor: error ? theme.colors.error : theme.colors.border,
              borderRadius: 12,
              padding: 16,
              fontSize: theme.sizes.display,
              letterSpacing: 12,
              textAlign: "center",
            }}
          />
          {attemptsLeft !== null && !error ? (
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
  /** Only claimed when location really is being shared (permission granted); otherwise the copy says nothing about it. */
  sharingLocation?: boolean;
  /** Present when the client has a care plan: needed during the visit, not only at clock-out. */
  onCarePlan?: () => void;
  onVitals?: () => void;
}> = ({ visit, busy, onComplete, onNotes, sharingLocation = false, onCarePlan, onVitals }) => (
  <StepFrame
    title="Visit in progress"
    subtitle={sharingLocation ? "Complete the visit when you are done. This stops location sharing." : "Complete the visit when you are done."}
  >
    <Summary visit={visit} />
    {onCarePlan ? <Button title="Care plan" variant="outline" onPress={onCarePlan} disabled={busy} /> : null}
    {onVitals ? <Button title="Record vitals" variant="outline" onPress={onVitals} disabled={busy} /> : null}
    <Button title="Visit notes" variant="outline" onPress={onNotes} disabled={busy} />
    <Button title="Complete visit" onPress={onComplete} loading={busy} />
  </StepFrame>
);

/**
 * Step 4 (status `completed`): the full-page "clocked out" success from Figma (check illustration, green title, one line,
 * Close at the top left). A short visit's pay is held for Finance review, so it says that after the Figma line instead of
 * "Thank you"; `earning` is the formatted naira amount when the booking carries it.
 */
export const VisitDoneStep: React.FC<{
  onHome: () => void;
  sharedLocation?: boolean;
  short?: boolean;
  earning?: string | null;
  /** From the hour the visit was due: "... ended your morning appointment". */
  partOfDay?: "morning" | "afternoon" | "evening" | null;
}> = ({ onHome, sharedLocation = false, short = false, earning = null, partOfDay = null }) => {
  const lead = short ? shortVisitDoneMessage(earning) : "Thank you.";
  return (
    <View style={{ flex: 1, paddingTop: 56, paddingHorizontal: 20 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onHome} hitSlop={12} style={{ alignSelf: "flex-start" }}>
        <Feather name="x-circle" size={26} color={theme.colors.text} />
      </Pressable>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingBottom: 56 }}>
        <SuccessIllustration />
        <Text variant="h2" weight="bold" color={theme.colors.success} center>
          You have successfully clocked out of your appointment
        </Text>
        <Text variant="small" color={theme.colors.text} center>
          {partOfDay ? `You have ended your ${partOfDay} appointment` : "You have ended your appointment"}
        </Text>
        <Text variant="small" color={theme.colors.textLight} center>
          {sharedLocation ? `${lead} Location sharing has stopped.` : lead}
        </Text>
      </View>
    </View>
  );
};

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
