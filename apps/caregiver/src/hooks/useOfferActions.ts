import { Alert } from "react-native";

import { isOfferGone, messageForError } from "@/src/api/errors";

import { useBookingAction } from "./queries";

interface Options {
  /** Runs after the server accepted the job; open the assigned-booking view here. */
  onAccepted: (bookingId: string) => void;
  /** Runs after the offer was declined or turned out to be gone (taken, not offered, removed). */
  onGone?: (bookingId: string) => void;
}

/**
 * accept / decline with the error mapping the backend guide asks for: 403 "not approved yet",
 * 409 "taken by another caregiver". A 409 or 404 also means the offer is gone, so the lists are
 * refetched (done by useBookingAction) and `onGone` lets the screen leave a dead offer.
 */
export function useOfferActions({ onAccepted, onGone }: Options) {
  const action = useBookingAction();

  const accept = (bookingId: string) =>
    action.mutate(
      { bookingId, action: "accept" },
      {
        onSuccess: () => onAccepted(bookingId),
        onError: (error) => {
          Alert.alert("Couldn't accept this job", messageForError(error, "accept"));
          if (isOfferGone(error)) onGone?.(bookingId);
        },
      },
    );

  const decline = (bookingId: string) =>
    action.mutate(
      { bookingId, action: "decline" },
      {
        onSuccess: () => onGone?.(bookingId),
        onError: (error) => {
          Alert.alert("Couldn't decline this job", messageForError(error, "decline"));
          if (isOfferGone(error)) onGone?.(bookingId);
        },
      },
    );

  return { accept, decline, busyId: action.isPending ? action.variables.bookingId : null };
}
