import type React from "react";
import { useState } from "react";

import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import { PROFILE_FIELDS, profileRefusal, useUpdateProfile, type ProfileField } from "@/src/hooks/useProfile";

/** Personal and emergency-contact details, read from `/auth/me` and saved with `PUT /auth/profile`. */
const EditProfile: React.FC = () => {
  const me = useMe();
  const update = useUpdateProfile();
  const [edited, setEdited] = useState<Partial<Record<ProfileField, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [saved, setSaved] = useState(false);
  const [dialog, setDialog] = useState<string | null>(null);

  const stored = (field: ProfileField) => {
    const def = PROFILE_FIELDS.find((f) => f.field === field);
    return me.data && def ? def.read(me.data) : "";
  };
  const value = (field: ProfileField) => edited[field] ?? stored(field);
  const set = (field: ProfileField) => (text: string) => {
    setEdited((prev) => ({ ...prev, [field]: text }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaved(false);
  };

  const save = () => {
    const found: Partial<Record<ProfileField, string>> = {};
    for (const { field } of PROFILE_FIELDS) {
      if (edited[field] === undefined) continue;
      if (field === "fullName" && !value(field).trim()) found[field] = "Full name is required";
      else if (field === "phone" && !value(field).trim() && stored(field)) found[field] = "Enter a phone number, or leave it as it is.";
      // The backend ignores a blank value for these, so a cleared field would silently come back: say so instead.
      else if (field !== "fullName" && field !== "phone" && !value(field).trim() && stored(field)) found[field] = "This can't be cleared yet. Change it to something else.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    update.mutate(edited, {
      onSuccess: () => {
        // What the server kept (a phone comes back without spaces) is what the boxes show from here on.
        setEdited({});
        setSaved(true);
      },
      onError: (e) => {
        // The server's own sentence, under the field it names (a bad phone, a phone another account uses) or in a dialog.
        const refusal = profileRefusal(e);
        if (refusal.field) setErrors({ [refusal.field]: refusal.message });
        else setDialog(refusal.message);
      },
    });
  };

  return (
    <Screen title="Edit Profile" scroll>
      <Input label="Full name" value={value("fullName")} onChangeText={set("fullName")} error={errors.fullName} autoComplete="name" />
      <Input label="Email address" value={me.data?.email ?? ""} editable={false} />
      <Text variant="small" color={theme.colors.textLight}>To change your email, contact support.</Text>
      <Input label="Phone number" placeholder="+234…" value={value("phone")} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} />
      <Input label="House address" value={value("address")} onChangeText={set("address")} error={errors.address} />
      <Text weight="bold">Emergency contact</Text>
      <Input label="Contact name" value={value("emergencyName")} onChangeText={set("emergencyName")} error={errors.emergencyName} />
      <Input label="Contact phone" value={value("emergencyPhone")} onChangeText={set("emergencyPhone")} keyboardType="phone-pad" error={errors.emergencyPhone} />
      <Input label="Contact address" value={value("emergencyAddress")} onChangeText={set("emergencyAddress")} error={errors.emergencyAddress} />
      {saved ? (
        <Text color={theme.colors.success} center>
          Profile has been updated
        </Text>
      ) : null}
      <Button title="Update Profile Details" onPress={save} loading={update.isPending} />
      <ErrorDialog visible={dialog !== null} title="Could not save" message={dialog ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

export default EditProfile;
