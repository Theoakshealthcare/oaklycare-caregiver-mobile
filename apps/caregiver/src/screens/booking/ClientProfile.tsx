import React from "react";
import { Linking, Pressable, RefreshControl, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { StackScreenProps } from "@react-navigation/stack";

import { ApiError } from "@/src/api/errors";
import ScreenShell from "@/src/components/account/ScreenShell";
import ClientCarePlanRow from "@/src/components/careplan/ClientCarePlanRow";
import { EmptyState, ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Button from "@/src/components/ui/button";
import Image from "@/src/components/ui/image";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useClientProfile } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import type { ScreenParamLists } from "@/src/navigation/Navigations";
import type { ClientProfile as Profile, ClientVital } from "@/src/services/clients.service";
import { parseBackendDate } from "@/src/utils/dates";
import { VITAL_KINDS, formatReading, formatUpdated, kindInfo, type VitalKind } from "@/src/vitals/vitalsModel";

type Props = StackScreenProps<ScreenParamLists, "ClientProfile">;

const Section: React.FC<{ title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }> = ({
  title,
  action,
  children,
}) => (
  <View style={{ marginTop: theme.spacing.lg }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.sm }}>
      <Text variant="h3" weight="bold">
        {title}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress}>
          <Text variant="small" weight="medium" color={theme.colors.primary}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
    {children}
  </View>
);

const Card: React.FC<{ children: React.ReactNode; testID?: string }> = ({ children, testID }) => (
  <View testID={testID} style={{ backgroundColor: theme.colors.soft, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, gap: theme.spacing.sm }}>
    {children}
  </View>
);

const LabelledLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View>
    <Text variant="caption" color={theme.colors.textLight}>
      {label}
    </Text>
    <Text variant="body">{value}</Text>
  </View>
);

const SEX_LABEL: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

function ageAndSex(profile: Profile): string | null {
  const parts = [
    profile.age !== null && profile.age !== undefined ? `Age ${profile.age}` : null,
    profile.gender ? (SEX_LABEL[profile.gender.toLowerCase()] ?? profile.gender) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(". ") : null;
}

/** Newest reading per known vital, in the grid's order; types the app does not know are left out. */
function knownVitals(vitals: ClientVital[]): { kind: VitalKind; vital: ClientVital }[] {
  return VITAL_KINDS.flatMap((info) => {
    const vital = vitals.find((v) => v.vital_type === info.kind);
    return vital ? [{ kind: info.kind, vital }] : [];
  });
}

const ClientProfile: React.FC<Props> = ({ route }) => {
  const { bookingId, bookingCode } = route.params;
  const { navigation } = useNavigation();
  const query = useClientProfile(bookingId);

  const content = () => {
    if (query.isError && !query.data) {
      // 404: not this caregiver's live visit (it ended, was reassigned, or never was theirs).
      if (query.error instanceof ApiError && query.error.status === 404) {
        return (
          <EmptyState
            icon="lock"
            title="Client details aren't available"
            hint="You can see a client's details while your visit with them is accepted, on the way or in progress."
          />
        );
      }
      return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
    }
    if (!query.data) return <LoadingState testID="client-loading" />;
    const profile = query.data;
    const subtitle = ageAndSex(profile);
    const vitals = profile.latest_vitals ? knownVitals(profile.latest_vitals) : null;
    const history = profile.medical_history;
    const contact = profile.emergency_contact;
    // The patient app sends "Myself", the WhatsApp channel "myself".
    const forSomeoneElse = profile.booking_for.trim().toLowerCase() !== "myself";

    return (
      <>
        <Card testID="client-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
            {profile.profile_image_url ? (
              <Image source={{ uri: profile.profile_image_url }} containerStyle={{ width: 72, height: 72, borderRadius: 36 }} imageStyle={{ width: 72, height: 72, borderRadius: 36 }} />
            ) : (
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
                <Text variant="h2" weight="bold" color={theme.colors.primary}>
                  {profile.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text variant="h3" weight="bold" testID="client-name">
                {profile.full_name}
              </Text>
              {subtitle ? (
                <Text variant="small" color={theme.colors.textLight} testID="client-age-sex">
                  {subtitle}
                </Text>
              ) : null}
              {bookingCode ? (
                <Text variant="caption" color={theme.colors.textLight} testID="client-code">
                  {`Booking ${bookingCode}`}
                </Text>
              ) : null}
            </View>
          </View>
          {forSomeoneElse ? (
            <Text variant="caption" color={theme.colors.textLight} testID="client-booked-by">
              Booked by a family member for this client.
            </Text>
          ) : null}
          {/* Figma also has a "FallGuards" button here: FallGuard data is not served to caregivers, so it is not drawn. */}
          <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
            <Button
              title="Add Notes"
              onPress={() => navigation.navigate("AINoteTaker", { bookingId })}
              style={{ minHeight: 36, paddingVertical: theme.spacing.xs, borderRadius: theme.borderRadius.round }}
              textStyle={{ fontSize: theme.sizes.caption }}
            />
          </View>
        </Card>

        <ClientCarePlanRow bookingId={bookingId} clientName={profile.full_name} />

        <Section
          title="Latest Vitals"
          action={{ label: "View all", onPress: () => navigation.navigate("PatientVitals", { patientId: profile.patient_id }) }}
        >
          {vitals === null ? (
            <Text variant="small" color={theme.colors.textLight} testID="client-vitals-unavailable">
              Vitals are available during an active visit.
            </Text>
          ) : vitals.length === 0 ? (
            <Text variant="small" color={theme.colors.textLight} testID="client-vitals-empty">
              No readings recorded yet.
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {vitals.map(({ kind, vital }) => (
                <View
                  key={kind}
                  testID={`client-vital-${kind}`}
                  style={{ width: "48%", backgroundColor: theme.colors.soft, borderRadius: theme.borderRadius.xl, padding: theme.spacing.md, marginBottom: theme.spacing.sm, gap: theme.spacing.xs }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
                    <Feather name={kindInfo(kind).icon} size={16} color={theme.colors.primary} />
                    <Text variant="caption" color={theme.colors.textLight}>
                      {kindInfo(kind).label}
                    </Text>
                  </View>
                  <Text variant="h3" weight="bold">
                    {formatReading({ value: vital.value, unit: vital.unit ?? null })}
                  </Text>
                  <Text variant="caption" color={theme.colors.textLight}>
                    {formatUpdated(parseBackendDate(vital.recorded_at))}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        {history ? (
          <Section title="Medical History">
            <Card testID="client-history">
              {history.blood_group ? <LabelledLine label="Blood group" value={history.blood_group} /> : null}
              {history.medical_conditions ? <LabelledLine label="Conditions" value={history.medical_conditions} /> : null}
              {history.allergies ? <LabelledLine label="Allergies" value={history.allergies} /> : null}
              {history.medications ? <LabelledLine label="Medications" value={history.medications} /> : null}
              {history.records.map((r, i) => (
                <LabelledLine
                  key={`${r.title}-${i}`}
                  label={r.record_type.charAt(0).toUpperCase() + r.record_type.slice(1)}
                  value={[r.title, r.severity ? `${r.severity} severity` : null].filter(Boolean).join(" · ")}
                />
              ))}
            </Card>
          </Section>
        ) : null}

        {contact ? (
          <Section title="Emergency Contact">
            <Card testID="client-contact">
              <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="body" weight="bold" testID="client-contact-name">
                    {contact.name ?? "Emergency contact"}
                  </Text>
                  {contact.relationship ? (
                    <Text variant="small" color={theme.colors.textLight}>
                      {contact.relationship}
                    </Text>
                  ) : null}
                  {contact.phone ? (
                    <Text variant="small" color={theme.colors.textLight}>
                      {contact.phone}
                    </Text>
                  ) : null}
                </View>
                {contact.phone ? (
                  <Pressable
                    testID="client-contact-call"
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${contact.name ?? "emergency contact"}`}
                    onPress={() => void Linking.openURL(`tel:${contact.phone}`)}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primaryLight, alignItems: "center", justifyContent: "center" }}
                  >
                    <Feather name="phone" size={18} color={theme.colors.primary} />
                  </Pressable>
                ) : null}
              </View>
            </Card>
          </Section>
        ) : null}

        {!history && !contact ? (
          <Text variant="small" color={theme.colors.textLight} style={{ marginTop: theme.spacing.lg }} testID="client-nothing-more">
            No medical history or emergency contact is on file for this client.
          </Text>
        ) : null}
      </>
    );
  };

  return (
    <ScreenShell
      title="Client Profile"
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      {content()}
    </ScreenShell>
  );
};

export default ClientProfile;
