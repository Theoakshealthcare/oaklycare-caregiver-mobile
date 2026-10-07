import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { StackScreenProps } from "@react-navigation/stack";

import { isSuspendedStop, messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import HeaderBack from "@/src/components/back/HeaderBack";
import Button from "@/src/components/ui/button";
import Text from "@/src/components/ui/text";
import { globalStyles } from "@/src/constants/styles";
import { theme } from "@/src/constants/theme";
import { useBooking, useBookingAction } from "@/src/hooks/queries";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import { bookingService } from "@/src/services/booking.service";
import { ensureBackgroundLocation } from "@/src/supply/permissions";
import { codeLocks, stepForStatus, submitVisitCode } from "@/src/visit/visitFlow";
import { formatVisitTime } from "@/src/utils/dates";

import { InProgressStep, OnMyWayStep, VisitClosedStep, VisitCodeStep, VisitDoneStep, VisitStoppedStep } from "./VisitSteps";

type Props = StackScreenProps<ScreenParamLists, "VisitFlow">;

/** The booking detail is polled every 20 s while a visit is active (guide, section 13). */
const VISIT_POLL_MS = 20_000;

const VisitFlow: React.FC<Props> = ({ route, navigation }) => {
  const { bookingId } = route.params;
  const client = useQueryClient();
  const { data: booking, isLoading, error, refetch } = useBooking(bookingId, true, VISIT_POLL_MS);
  const action = useBookingAction();

  const [arrived, setArrived] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => codeLocks.get(bookingId));
  const [stopped, setStopped] = useState<string | null>(null);

  const goHome = () => navigation.popTo("BottomNavigation", { tab: "home", at: Date.now() });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.booking(bookingId) });
    void client.invalidateQueries({ queryKey: queryKeys.allBookings });
    void client.invalidateQueries({ queryKey: queryKeys.home });
  };

  const run = (kind: "on_my_way" | "complete") =>
    action.mutate(
      { bookingId, action: kind },
      {
        onError: (err) => {
          const message = messageForError(err, "visit");
          if (isSuspendedStop(err)) setStopped(message);
          else Alert.alert(kind === "on_my_way" ? "Couldn't set off" : "Couldn't complete the visit", message);
        },
      },
    );

  const onMyWay = () => {
    // Explain, then ask for "Always" so the patient can follow along with the app closed. A "no"
    // never blocks the visit: tracking falls back to foreground while the app is open.
    void ensureBackgroundLocation().finally(() => run("on_my_way"));
  };

  const confirmComplete = () =>
    Alert.alert("Complete this visit?", "This ends the visit and stops sharing your location.", [
      { text: "Not yet", style: "cancel" },
      { text: "Complete", onPress: () => run("complete") },
    ]);

  const submitCode = async (code: string) => {
    setCodeBusy(true);
    setCodeError(null);
    try {
      const result = await submitVisitCode(bookingId, code, {
        start: (id, c) => bookingService.act(id, "start", c),
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
      address: booking.patient_address,
      when: formatVisitTime(booking.scheduled_date),
    };
    const busy = action.isPending;
    switch (stepForStatus(booking.status)) {
      case "on_my_way":
        return arrived ? (
          <VisitCodeStep
            visit={visit}
            busy={codeBusy}
            lockedUntil={lockedUntil}
            attemptsLeft={attemptsLeft}
            error={codeError}
            onSubmit={(code) => void submitCode(code)}
          />
        ) : (
          <OnMyWayStep visit={visit} busy={busy} onOnMyWay={onMyWay} onArrived={() => setArrived(true)} />
        );
      case "enter_code":
        return (
          <VisitCodeStep
            visit={visit}
            busy={codeBusy}
            lockedUntil={lockedUntil}
            attemptsLeft={attemptsLeft}
            error={codeError}
            onSubmit={(code) => void submitCode(code)}
          />
        );
      case "in_progress":
        return (
          <InProgressStep
            visit={visit}
            busy={busy}
            onComplete={confirmComplete}
            onNotes={() => navigation.navigate("AINoteTaker", { bookingId })}
          />
        );
      case "done":
        return <VisitDoneStep onHome={goHome} />;
      case "closed":
        return <VisitClosedStep status={booking.status} onHome={goHome} />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.white }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={globalStyles.container}>
          <HeaderBack />
          <View style={{ marginTop: "5%" }}>{renderBody()}</View>
        </View>
      </ScrollView>
    </View>
  );
};

export default VisitFlow;
