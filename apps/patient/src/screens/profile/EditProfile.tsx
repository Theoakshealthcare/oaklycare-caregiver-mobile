import type React from "react";
import { useState } from "react";

import { messageForError } from "@/src/api/errors";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import { PROFILE_FIELDS, useUpdateProfile, type ProfileField } from "@/src/hooks/useProfile";

const NOT_SAVED: Partial<Record<ProfileField, string>> = {
  fullName: "your name",
  phone: "your phone number",
};

/** Personal and emergency-contact details, read from `/auth/me` and saved with `PUT /auth/profile`. */
const EditProfile: React.FC = () => {
  const me = useMe();
  const update = useUpdateProfile();
  const [edited, setEdited] = useState<Partial<Record<ProfileField, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [outcome, setOutcome] = useState<"saved" | ProfileField[] | null>(null);
  const [dialog, setDialog] = useState<string | null>(null);

  const stored = (field: ProfileField) => {
    const def = PROFILE_FIELDS.find((f) => f.field === field);
    return me.data && def ? def.read(me.data) : "";
  };
  const value = (field: ProfileField) => edited[field] ?? stored(field);
  const set = (field: ProfileField) => (text: string) => {
    setEdited((prev) => ({ ...prev, [field]: text }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setOutcome(null);
  };

  const save = () => {
    const found: Partial<Record<ProfileField, string>> = {};
    for (const { field } of PROFILE_FIELDS) {
      if (edited[field] === undefined) continue;
      if (field === "fullName" && !value(field).trim()) found[field] = "Full name is required";
      // The backend ignores a blank value, so a cleared field would silently come back: say so instead.
      else if (field !== "fullName" && !value(field).trim() && stored(field)) found[field] = "This can't be cleared yet. Change it to something else.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    update.mutate(edited, {
      onSuccess: ({ notSaved }) => {
        setEdited({});
        setOutcome(notSaved.length === 0 ? "saved" : notSaved);
      },
      onError: (e) => setDialog(messageForError(e)),
    });
  };

  return (
    <Screen title="Edit Profile" scroll>
      <Input label="Full name" value={value("fullName")} onChangeText={set("fullName")} error={errors.fullName} autoComplete="name" />
      <Input label="Email address" value={me.data?.email ?? ""} editable={false} />
      <Input label="Phone number" placeholder="+234…" value={value("phone")} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} />
      <Input label="House address" value={value("address")} onChangeText={set("address")} error={errors.address} />
      <Text weight="bold">Emergency contact</Text>
      <Input label="Contact name" value={value("emergencyName")} onChangeText={set("emergencyName")} error={errors.emergencyName} />
      <Input label="Contact phone" value={value("emergencyPhone")} onChangeText={set("emergencyPhone")} keyboardType="phone-pad" error={errors.emergencyPhone} />
      <Input label="Contact address" value={value("emergencyAddress")} onChangeText={set("emergencyAddress")} error={errors.emergencyAddress} />
      {outcome === "saved" ? (
        <Text color={theme.colors.success} center>
          Profile has been updated
        </Text>
      ) : outcome ? (
        <Text color={theme.colors.secondary} center accessibilityRole="alert">
          {`We couldn't save ${outcome.map((f) => NOT_SAVED[f] ?? f).join(" or ")} yet. Your other details were saved.`}
        </Text>
      ) : null}
      <Button title="Update Profile Details" onPress={save} loading={update.isPending} />
      <ErrorDialog visible={dialog !== null} title="Could not save" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default EditProfile;
