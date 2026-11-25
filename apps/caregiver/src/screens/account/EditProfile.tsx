import React, { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { messageForError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/keys";
import ScreenShell from "@/src/components/account/ScreenShell";
import { ErrorState, LoadingState } from "@/src/components/account/StateViews";
import Button from "@/src/components/ui/button";
import Image from "@/src/components/ui/image";
import DateField from "@/src/components/ui/date-field";
import Input from "@/src/components/ui/input";
import PhoneInput from "@/src/components/ui/phone-input";
import Select from "@/src/components/ui/select";
import Text from "@/src/components/ui/text";
import { theme } from "@/src/constants/theme";
import { useCaregiverProfile, useFormOptions, useMe } from "@/src/hooks/queries";
import useNavigation from "@/src/hooks/use-navigation";
import { accountService, type ProfileUpdate } from "@/src/services/account.service";
import { caregiverService, type CaregiverProfile } from "@/src/services/caregiver.service";
import { phoneForSave, toPhoneFieldValue } from "@/src/utils/phone";

/** The value `identity_verification_status` carries once the identity check has passed (it is also what the setup status screen reads). */
export const IDENTITY_VERIFIED = "verified";
export const NAME_LOCKED_HELPER = "Your name is verified. To change it, contact support.";

type Gender = "male" | "female" | "other";
const GENDERS: { label: string; value: Gender }[] = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
  { label: "Other", value: "other" },
];

interface FormState {
  fullName: string;
  phone: string;
  address: string;
  gender: string;
  dateOfBirth: string;
  state: string;
  emergencyPhone: string;
}

function initialState(p: CaregiverProfile): FormState {
  return {
    fullName: p.full_name ?? "",
    phone: toPhoneFieldValue(p.phone_number),
    address: p.address ?? "",
    gender: p.gender ?? "",
    dateOfBirth: p.date_of_birth ?? "",
    state: p.state ?? "",
    emergencyPhone: toPhoneFieldValue(p.emergency_contact_phone),
  };
}

const isGender = (v: string): v is Gender => v === "male" || v === "female" || v === "other";

const EditForm: React.FC<{ profile: CaregiverProfile }> = ({ profile }) => {
  const { navigation } = useNavigation();
  const client = useQueryClient();
  const me = useMe();
  const { data: formOptions } = useFormOptions();
  const initial = initialState(profile);
  // After the identity check the name on the account is the one on the ID: it is shown, not editable, and never sent.
  const nameLocked = profile.identity_verification_status === IDENTITY_VERIFIED;
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const set = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const states = Array.from(new Set([...(formOptions?.states ?? []), ...(initial.state ? [initial.state] : [])]));

  const save = useMutation({
    mutationFn: async () => {
      // PUT /auth/profile ignores empty values; send only what changed.
      const changes: ProfileUpdate = {};
      if (!nameLocked && form.fullName.trim() !== initial.fullName) changes.full_name = form.fullName.trim();
      if (form.phone.trim() !== initial.phone && phoneForSave(form.phone)) changes.phone_number = phoneForSave(form.phone);
      if (form.address.trim() !== initial.address && form.address.trim()) changes.address = form.address.trim();
      if (form.gender !== initial.gender && form.gender) changes.gender = form.gender;
      if (form.dateOfBirth !== initial.dateOfBirth && form.dateOfBirth) changes.date_of_birth = form.dateOfBirth;
      if (form.emergencyPhone.trim() !== initial.emergencyPhone && phoneForSave(form.emergencyPhone)) {
        changes.emergency_contact_phone = phoneForSave(form.emergencyPhone);
      }
      if (Object.keys(changes).length > 0) await accountService.updateProfile(changes);
      // `state` is not part of PUT /auth/profile; it lives in the step 1 profile, which takes all five fields.
      if (form.state !== initial.state && form.state) {
        if (!isGender(form.gender) || !form.dateOfBirth || !form.address.trim() || !phoneForSave(form.emergencyPhone)) {
          throw new Error("Fill in your date of birth, gender, address and emergency phone to change your state.");
        }
        await caregiverService.updateProfileStep1({
          date_of_birth: form.dateOfBirth,
          gender: form.gender,
          state: form.state,
          address: form.address.trim(),
          emergency_contact_phone: phoneForSave(form.emergencyPhone),
        });
      }
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.me }),
        client.invalidateQueries({ queryKey: queryKeys.caregiverProfile }),
      ]);
      navigation.goBack();
    },
    onError: (error) => Alert.alert("Couldn't save", messageForError(error)),
  });

  const submit = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!nameLocked && !form.fullName.trim()) next.fullName = "Full name is required";
    if (form.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(form.dateOfBirth)) next.dateOfBirth = "Use the format YYYY-MM-DD";
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate();
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photos are off", "Allow photo access in your phone settings to choose a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      await accountService.uploadProfileImage({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType });
      setPhotoUri(asset.uri);
      await client.invalidateQueries({ queryKey: queryKeys.me });
    } catch (error) {
      Alert.alert("Couldn't upload your photo", messageForError(error));
    } finally {
      setUploading(false);
    }
  };

  const shownPhoto = photoUri ?? me.data?.profile_image_url ?? null;

  return (
    <>
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            borderWidth: 2,
            borderColor: theme.colors.primary,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {shownPhoto ? (
            <Image source={{ uri: shownPhoto }} style={{ width: 96, height: 96 }} />
          ) : (
            <Feather name="user" size={40} color={theme.colors.primary} />
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void pickPhoto()}
          disabled={uploading}
          style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Feather name="download" size={16} color={theme.colors.primary} />
          <Text variant="body" weight="medium" color={theme.colors.primary}>
            {uploading ? "Uploading..." : "Upload Image"}
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 16 }}>
        <View>
          <Input
            testID="edit-full-name"
            label="Full Name"
            value={form.fullName}
            onChangeText={set("fullName")}
            error={errors.fullName}
            placeholder="Provide your Full Name"
            editable={!nameLocked}
            containerStyle={nameLocked ? { opacity: 0.6 } : undefined}
          />
          {nameLocked ? (
            <Text variant="small" color={theme.colors.textLight} testID="edit-full-name-locked" style={{ marginTop: 4 }}>
              {NAME_LOCKED_HELPER}
            </Text>
          ) : null}
        </View>
        <Input
          label="Email Address"
          value={profile.email}
          editable={false}
          placeholder="Provide your Email Address"
          containerStyle={{ opacity: 0.6 }}
        />
        <PhoneInput testID="edit-phone" label="Phone Number" value={form.phone} onChangeText={set("phone")} />
        <Input label="House Address" value={form.address} onChangeText={set("address")} placeholder="Enter House Address" />
        <Select
          label="Select Gender"
          placeholder="Select Gender"
          options={GENDERS}
          value={form.gender || undefined}
          onValueChange={(v) => set("gender")(String(v))}
        />
        <DateField
          testID="edit-dob"
          label="Date of Birth"
          value={form.dateOfBirth}
          onChange={set("dateOfBirth")}
          placeholder="Select your Date of Birth"
          error={errors.dateOfBirth}
          maximumDate={new Date()}
          initialDate={new Date(new Date().getFullYear() - 30, 0, 1)}
        />
        <Select
          label="State"
          placeholder="Select state"
          options={states.map((s) => ({ label: s, value: s }))}
          value={form.state || undefined}
          onValueChange={(v) => set("state")(String(v))}
        />
        <PhoneInput
          testID="edit-emergency-phone"
          label="Emergency Contact Person Phone Number"
          value={form.emergencyPhone}
          onChangeText={set("emergencyPhone")}
        />
        <Button title="Update Profile Details" onPress={submit} loading={save.isPending} />
      </View>
    </>
  );
};

const EditProfile: React.FC = () => {
  const profile = useCaregiverProfile();
  return (
    <ScreenShell title="Edit Profile">
      {profile.data ? (
        <EditForm profile={profile.data} />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <LoadingState testID="edit-profile-loading" />
      )}
    </ScreenShell>
  );
};

export default EditProfile;
