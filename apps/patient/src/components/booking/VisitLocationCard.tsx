import type React from "react";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import Button from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import type { BookingDraft } from "@/src/domain/booking";
import { addressKey, addressQuery, hasCoordinates, hasTypedAddress, locationIsStale, NO_LOCATION } from "@/src/domain/visitLocation";
import { addressOf, findAddress, GeocoderUnavailable, getCurrentCoordinates, LocationError, type FoundAddress } from "@/src/services/location";

type DraftFields = Pick<BookingDraft, "state" | "city" | "address" | "latitude" | "longitude" | "locationSource" | "locationLabel" | "locationKey">;

interface Props {
  draft: DraftFields;
  patch: (fields: Partial<BookingDraft>) => void;
  /** The "location is required" sentence from the form's own check; cleared by the card as soon as a location is set. */
  error?: string;
  onResolved: () => void;
}

/** A looked-up address waiting for the person's Confirm / Edit. `key` is the typed address it was looked up for. */
interface Pending extends FoundAddress {
  key: string;
}

const NOT_FOUND =
  "We couldn't find that address on the map. Check the spelling, or tap “Use my current location” if you are standing at the visit address.";
const UNAVAILABLE =
  "We couldn't look the address up just now. Check your connection and try again, or tap “Use my current location” if you are standing at the visit address.";

/**
 * Where the visit is, for the booking API's coordinates. Two ways to set it, both read back to the person as address text so a
 * wrong spot is seen before it is booked:
 *  - "Use my current location": the phone's position, for a booker who is at the visit address;
 *  - "Find this address": the typed house address, city and state looked up on the phone, for a visit at somebody else's home
 *    (a parent or sibling). The found address is shown with Confirm / Edit and only Confirm uses it.
 * Coordinates are never kept after the typed address they were set for has been changed (see `locationIsStale`): the card clears
 * them and says so. No map service key is used: the phone's own geocoder does both lookups.
 */
const VisitLocationCard: React.FC<Props> = ({ draft, patch, error, onResolved }) => {
  const [busy, setBusy] = useState<"locating" | "finding" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [cleared, setCleared] = useState(false);

  const typedKey = addressKey(draft);
  // The address was edited after the coordinates were set: they are dropped (never book a stale spot) and the card says why.
  const stale = locationIsStale(draft);
  if (stale && !cleared) setCleared(true);
  useEffect(() => {
    if (stale) patch(NO_LOCATION);
  }, [stale, patch]);
  const located = hasCoordinates(draft) && !stale;
  // A found address belongs to the text it was looked up for; once that text changes the answer is old.
  const found = pending && pending.key === typedKey ? pending : null;

  const resolved = (fields: Pick<BookingDraft, "latitude" | "longitude" | "locationSource" | "locationLabel" | "locationKey">) => {
    patch(fields);
    setPending(null);
    setProblem(null);
    setCleared(false);
    onResolved();
  };

  const captureCurrent = async () => {
    setBusy("locating");
    setProblem(null);
    try {
      const coords = await getCurrentCoordinates();
      const label = await addressOf(coords);
      resolved({ ...coords, locationSource: "device", locationLabel: label, locationKey: typedKey });
    } catch (e) {
      setProblem(e instanceof LocationError ? e.message : "We could not read your location. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const findTyped = async () => {
    if (!hasTypedAddress(draft)) {
      setProblem("Fill in the State, City and House Address above first, then tap “Find this address”.");
      return;
    }
    setBusy("finding");
    setProblem(null);
    setPending(null);
    try {
      const found = await findAddress(addressQuery(draft));
      if (found) setPending({ ...found, key: typedKey });
      else setProblem(NOT_FOUND);
    } catch (e) {
      setProblem(e instanceof GeocoderUnavailable ? UNAVAILABLE : NOT_FOUND);
    } finally {
      setBusy(null);
    }
  };

  const confirm = () => {
    if (!found) return;
    resolved({ latitude: found.latitude, longitude: found.longitude, locationSource: "address", locationLabel: found.label, locationKey: found.key });
  };

  const typed = [draft.address.trim(), draft.city.trim(), draft.state.trim()].filter(Boolean).join(", ");
  const disabled = busy !== null;
  const shownProblem = problem ?? error ?? null;

  if (found) {
    return (
      <Card tone="tint">
        <Text weight="bold">Is this the place?</Text>
        <Text>{found.label ?? "We found a spot for this address, but the phone could not name it."}</Text>
        <Text variant="small" color={theme.colors.textLight}>
          {`You typed: ${typed}`}
        </Text>
        <View style={styles.row}>
          <Button small title="Confirm" onPress={confirm} style={styles.rowButton} />
          <Button small variant="outline" title="Edit" onPress={() => setPending(null)} style={styles.rowButton} />
        </View>
      </Card>
    );
  }

  return (
    <Card tone={located ? "tint" : "plain"}>
      <Text weight="bold">{located ? "Location saved" : "Visit location"}</Text>
      {located ? (
        <>
          <Text>{draft.locationLabel ?? "We saved this spot, but the phone could not name the address."}</Text>
          <Text variant="small" color={theme.colors.textLight}>
            {draft.locationSource === "address"
              ? "Found from the address you typed. We will look for caregivers near it."
              : "Taken from your phone. We will look for caregivers near it."}
          </Text>
        </>
      ) : (
        <Text variant="small" color={theme.colors.textLight}>
          {cleared
            ? "You changed the address, so the saved location was cleared. Find the new address again, or use your current location."
            : "Booking for someone at another address? Fill in the address above and tap “Find this address”. At the visit address yourself? Tap “Use my current location”."}
        </Text>
      )}
      {shownProblem ? (
        <Text variant="small" color={theme.colors.secondary} accessibilityRole="alert">
          {shownProblem}
        </Text>
      ) : null}
      <Button small variant={located ? "outline" : "primary"} title="Find this address" onPress={() => void findTyped()} loading={busy === "finding"} disabled={disabled && busy !== "finding"} />
      <Button
        small
        variant="outline"
        title={located && draft.locationSource === "device" ? "Update my location" : "Use my current location"}
        onPress={() => void captureCurrent()}
        loading={busy === "locating"}
        disabled={disabled && busy !== "locating"}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: theme.spacing.sm },
  rowButton: { flex: 1 },
});

export default VisitLocationCard;
