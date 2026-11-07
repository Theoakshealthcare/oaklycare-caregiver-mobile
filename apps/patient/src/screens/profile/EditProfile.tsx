import type React from "react";
import { useState } from "react";

import Button from "@/src/components/ui/button";
import Input from "@/src/components/ui/input";
import SampleNotice from "@/src/components/ui/sample-notice";
import Screen from "@/src/components/ui/screen";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import { useUpdateProfile } from "@/src/hooks/useProfile";

type Field = "fullName" | "phone" | "address" | "emergencyName" | "emergencyPhone" | "emergencyAddress";

/** Personal and emergency-contact details. The name comes from `/auth/me`; saving is sample-only until the profile slice. */
const EditProfile: React.FC = () => {
  const me = useMe();
  const update = useUpdateProfile();
  const [edited, setEdited] = useState<Partial<Record<Field, string>>>({});
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  const value = (field: Field, fallback = "") => edited[field] ?? fallback;
  const set = (field: Field) => (text: string) => {
    setEdited((prev) => ({ ...prev, [field]: text }));
    setSaved(false);
    if (field === "fullName") setNameError(undefined);
  };

  const save = () => {
    if (!value("fullName", me.data?.full_name ?? "").trim()) return setNameError("Full name is required");
    update.mutate(edited, { onSuccess: () => setSaved(true) });
  };

  return (
    <Screen title="Edit Profile" scroll>
      <SampleNotice what="Saving" />
      <Input label="Full name" value={value("fullName", me.data?.full_name ?? "")} onChangeText={set("fullName")} error={nameError} autoComplete="name" />
      <Input label="Email address" value={me.data?.email ?? ""} editable={false} />
      <Input label="Phone number" placeholder="+234…" value={value("phone", me.data?.phone_number ?? "")} onChangeText={set("phone")} keyboardType="phone-pad" />
      <Input label="House address" value={value("address")} onChangeText={set("address")} />
      <Text weight="bold">Emergency contact</Text>
      <Input label="Contact name" value={value("emergencyName")} onChangeText={set("emergencyName")} />
      <Input label="Contact phone" value={value("emergencyPhone")} onChangeText={set("emergencyPhone")} keyboardType="phone-pad" />
      <Input label="Contact address" value={value("emergencyAddress")} onChangeText={set("emergencyAddress")} />
      {saved ? (
        <Text color={theme.colors.success} center>
          Profile has been updated
        </Text>
      ) : null}
      <Button title="Update Profile Details" onPress={save} loading={update.isPending} />
    </Screen>
  );
};

export default EditProfile;
