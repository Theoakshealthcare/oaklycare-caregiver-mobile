import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { StackScreenProps } from "@react-navigation/stack";

import { isArrivedTooEarly, isSuspendedStop, messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import HeaderBack from "@/src/components/back/HeaderBack";
import Button from "@/src/components/ui/button";
import ConfirmDialog from "@/src/components/ui/confirm-dialog";
import KeyboardScrollView from "@/src/components/ui/keyboard-scroll-view";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { CLOCK_OUT_PROMPT, needsClockOutPrompt } from "@/src/careplan/carePlanModel";
import { useBooking, useBookingAction } from "@/src/hooks/queries";
import { useVisitCarePlan } from "@/src/hooks/useCarePlans";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { bookingService } from "@/src/services/booking.service";
import { ensureBackgroundLocation } from "@/src/supply/permissions";
import { useLocationPermissions } from "@/src/supply/permissionState";
import {
  codeLocks,
  DROP_OUT_CONFIRM,
  isShortVisit,
  SHORT_VISIT_CONFIRM_MESSAGE,
  stepForStatus,
  submitVisitCode,
  visitStarts,
} from "@/src/visit/visitFlow";
import { partOfDay } from "@/src/home/homeBlocks";
import { formatNaira } from "@/src/home/homeModel";
import { formatElapsed, useElapsed } from "@/src/visit/clockTimer";
import { formatVisitTime, parseBackendDate } from "@/src/utils/dates";

import { InProgressStep, OnMyWayStep, VisitClosedStep, VisitCodeStep, VisitDoneStep, VisitStoppedStep } from "./VisitSteps";

/** `now` is injectable so a test fixes the clock; the app reads the real one. */
type Props = StackScreenProps<ScreenParamLists, "VisitFlow"> & { now?: () => number };

/** The booking detail is polled every 20 s while a visit is active (guide, section 13). */
const VISIT_POLL_MS = 20_000;

const VisitFlow: React.FC<Props> = ({ route, navigation, now = Date.now }) => {
  const { bookingId } = route.params;
  const client = useQueryClient();
  const { data: booking, isLoading, error, refetch } = useBooking(bookingId, true, VISIT_POLL_MS);
  const action = useBookingAction();
  // Only asked once the visit is running; a failed or slow answer never blocks completing the visit.
  const carePlan = useVisitCarePlan(bookingId, booking?.status === "in_progress");

  // What the copy may say about location: only claim sharing when the OS permission is really there.
  const sharingLocation = useLocationPermissions().foreground;

  // Set when "I've arrived" failed, so the code step is still reachable: arrival never blocks the visit.
  const [skipArrival, setSkipArrival] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => codeLocks.get(bookingId));
  const [arrivalFailed, setArrivalFailed] = useState(false);
  const [stopped, setStopped] = useState<string | null>(null);
  // Set by the `complete` answer: did the backend judge this visit short (pay held for Finance review)?
  const [completedShort, setCompletedShort] = useState(false);

  // The two timer dialogs from Figma. Clock in confirms the code the caregiver typed (nothing is sent until "Yes, Clock in");
  // clock out confirms completing the visit. "Clock out" on Home opens the screen with `clockOut` set, so the dialog is up at once.
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const autoOpened = useRef(false);
  const inProgress = booking?.status === "in_progress";
  useEffect(() => {
    if (route.params.clockOut && inProgress && !autoOpened.current) {
      autoOpened.current = true;
      setClockOutOpen(true);
    }
  }, [route.params.clockOut, inProgress]);
  const elapsed = useElapsed(visitStarts.get(bookingId), clockOutOpen, now);

  const goHome = () => navigation.popTo("BottomNavigation", { tab: "home", at: Date.now() });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.booking(bookingId) });
    void client.invalidateQueries({ queryKey: queryKeys.allBookings });
    void client.invalidateQueries({ queryKey: queryKeys.home });
  };

  const run = (kind: "on_my_way" | "arrived" | "complete") =>
    action.mutate(
      { bookingId, action: kind },
      {
        onSuccess: (result) => {
          if (kind !== "complete") return;
          // Same rule as the backend, on the two instants it stamped: no clock of ours is involved.
          setCompletedShort(
            result.actualEndTime !== null &&
              isShortVisit(
                result.actualStartTime ? parseBackendDate(result.actualStartTime).getTime() : visitStarts.get(bookingId),
                parseBackendDate(result.actualEndTime).getTime(),
                booking?.duration_hours,
              ),
          );
        },
        onError: (err) => {
          const message = messageForError(err, "visit");
          if (isSuspendedStop(err)) setStopped(message);
          else if (kind === "arrived") {
            setArrivalFailed(true);
            Alert.alert(isArrivedTooEarly(err) ? "Too early to mark arrival" : "Couldn't tell the patient", message);
          } else Alert.alert(kind === "on_my_way" ? "Couldn't set off" : "Couldn't complete the visit", message);
        },
      },
    );

  const onMyWay = () => {
    // Explain, then ask for "Always" so the patient can follow along with the app closed. A "no"
    // never blocks the visit: tracking falls back to foreground while the app is open.
    void ensureBackgroundLocation().finally(() => run("on_my_way"));
  };

  const confirmDropOut = () =>
    Alert.alert(DROP_OUT_CONFIRM.title, DROP_OUT_CONFIRM.message, [
      { text: DROP_OUT_CONFIRM.keep, style: "cancel" },
      {
        text: DROP_OUT_CONFIRM.confirm,
        style: "destructive",
        onPress: () =>
          action.mutate(
            { bookingId, action: "cancel" },
            {
              // The booking is no longer this caregiver's: the hook refetches the lists, so it leaves them.
              onSuccess: () => {
                Alert.alert("Visit cancelled", DROP_OUT_CONFIRM.done);
                goHome();
              },
              onError: (err) => Alert.alert("Couldn't cancel the visit", messageForError(err, "visit")),
            },
          ),
      },
    ]);

  /** Under half of the booked time on site: finishing now holds the pay for Finance review, so say so first. */
  const finishingShort = () => isShortVisit(visitStarts.get(bookingId), now(), booking?.duration_hours);

  const confirmComplete = () => setClockOutOpen(true);

  /** What the clock-out dialog says beyond Figma's two lines: pay held for review, the care plan reminder, location sharing. */
  const clockOutNotice = () => {
    const plan = carePlan.data?.plan;
    const planPrompt = Boolean(plan) && needsClockOutPrompt(carePlan.data);
    const short = finishingShort();
    const parts = [
      planPrompt ? CLOCK_OUT_PROMPT.message : null,
      short ? SHORT_VISIT_CONFIRM_MESSAGE : null,
      !planPrompt && !short ? (sharingLocation ? "This ends the visit and stops sharing your location." : "This ends the visit.") : null,
    ].filter(Boolean);
    return parts.join("\n\n");
  };

  const submitCode = async (code: string) => {
    setCodeBusy(true);
    setCodeError(null);
    try {
      const result = await submitVisitCode(bookingId, code, {
        start: async (id, c) => {
          const result = await bookingService.act(id, "start", c);
          visitStarts.record(id, result.actualStartTime);
          return result;
        },
      });
      switch (result.kind) {
        case "started":
          setAttemptsLeft(null);
          setLockedUntil(null);
          break;
        case "incorrect":
          setAttemptsLeft(result.attemptsLeft);
          setCodeError(result.message);
          break;
        case "locked":
          setAttemptsLeft(null);
          setLockedUntil(result.lockedUntil);
          setCodeError(result.message);
          break;
        case "suspended":
          setStopped(result.message);
          break;
        case "error":
          setCodeError(result.message);
          break;
      }
    } finally {
      // Success, and every 409, change what the booking is: refetch either way.
      refresh();
      setCodeBusy(false);
    }
  };

  const renderBody = () => {
    if (stopped) return <VisitStoppedStep message={stopped} onHome={goHome} />;
    if (isLoading) return <ActivityIndicator size="large" color={theme.colors.primary} />;
    if (error || !booking) {
      return (
        <View style={{ gap: 12 }}>
          <Text variant="body" color={theme.colors.textLight}>
            {messageForError(error)}
          </Text>
          <Button title="Try again" onPress={() => void refetch()} />
        </View>
      );
    }
    const visit = {
      patientName: booking.patient_details?.full_name ?? "Patient",
      address: booking.patient_address ?? "",
      when: formatVisitTime(booking.scheduled_date),
    };
    const busy = action.isPending;
    // From the booking, not a local flag: it survives a restart and is the same on a repeat tap.
    const arrivedAt = booking.arrived_at;
    const arrival = { arrived: Boolean(arrivedAt), busy, onArrived: () => run("arrived") };
    switch (stepForStatus(booking.status)) {
      case "on_my_way":
        return arrivedAt || skipArrival ? (
          <VisitCodeStep
            visit={visit}
            busy={codeBusy}
            lockedUntil={lockedUntil}
            attemptsLeft={attemptsLeft}
            error={codeError}
            onSubmit={(code) => setPendingCode(code)}
            arrival={arrival}
          />
        ) : (
          <OnMyWayStep
            visit={visit}
            scheduledDate={booking.scheduled_date}
            busy={busy}
            onOnMyWay={onMyWay}
            onArrived={() => run("arrived")}
            onSkipToCode={arrivalFailed ? () => setSkipArrival(true) : undefined}
            channel={booking.channel}
            onCantMakeIt={confirmDropOut}
            onContactSupport={() => navigation.navigate("Contact")}
          />
        );
      case "enter_code":
        return (
          <VisitCodeStep
            visit={visit}
            busy={codeBusy}
            lockedUntil={lockedUntil}
            attemptsLeft={attemptsLeft}
            error={codeError}
            onSubmit={(code) => setPendingCode(code)}
            arrival={arrival}
          />
        );
      case "in_progress":
        return (
          <InProgressStep
            visit={visit}
            busy={busy}
            onComplete={confirmComplete}
            onNotes={() => navigation.navigate("AINoteTaker", { bookingId })}
            sharingLocation={sharingLocation}
            onCarePlan={
              carePlan.data?.plan
                ? () => navigation.navigate("CarePlanDetails", { planId: carePlan.data!.plan!.id })
                : undefined
            }
            onVitals={() =>
              navigation.navigate("AddVitals", { patientId: booking.patient_id, patientName: booking.patient_details?.full_name })
            }
          />
        );
      case "done":
        return null;
      case "closed":
        return <VisitClosedStep status={booking.status} onHome={goHome} />;
    }
  };

  // The "clocked out" success page is a full page of its own (Figma): no back arrow, just Close.
  if (!stopped && booking && stepForStatus(booking.status) === "done") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
        <VisitDoneStep
          onHome={goHome}
          sharedLocation={sharingLocation}
          short={completedShort}
          earning={booking.caregiver_earning == null ? null : formatNaira(booking.caregiver_earning)}
          partOfDay={partOfDay(parseBackendDate(booking.scheduled_date).getHours())}
        />
      </View>
    );
  }

  const plan = carePlan.data?.plan;
  const reviewPlan = plan && needsClockOutPrompt(carePlan.data) ? plan : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <KeyboardScrollView scrollToEndOnKeyboardShow>
        <View style={globalStyles.container}>
          <HeaderBack />
          <View style={{ marginTop: "5%" }}>{renderBody()}</View>
        </View>
      </KeyboardScrollView>

      <ConfirmDialog
        visible={pendingCode !== null}
        onClose={() => setPendingCode(null)}
        timer={formatElapsed(0)}
        title="Are you sure you want to clock in to this appointment ?"
        body="Once you clock in to this appointment, it means your appointment service has started."
        cancelLabel="No, Go Back"
        confirmLabel="Yes, Clock in"
        onConfirm={() => {
          const code = pendingCode;
          setPendingCode(null);
          if (code) void submitCode(code);
        }}
      />

      <ConfirmDialog
        visible={clockOutOpen}
        onClose={() => setClockOutOpen(false)}
        timer={elapsed}
        title="Are you sure you want to clock out of this appointment ?"
        body="Once you clock out of this appointment, it means you have finished your booking."
        notice={clockOutOpen ? clockOutNotice() : undefined}
        cancelLabel="No, Go Back"
        confirmLabel="Yes, Clock out"
        onConfirm={() => {
          setClockOutOpen(false);
          run("complete");
        }}
        extraLabel={reviewPlan ? CLOCK_OUT_PROMPT.review : undefined}
        onExtra={
          reviewPlan
            ? () => {
                setClockOutOpen(false);
                navigation.navigate("CarePlanDetails", { planId: reviewPlan.id, from: "clock_out" });
              }
            : undefined
        }
      />
    </View>
  );
};

export default VisitFlow;
