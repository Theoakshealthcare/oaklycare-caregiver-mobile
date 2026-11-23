import * as ImagePicker from "expo-image-picker";
import type React from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { messageForError } from "@/src/api/errors";
import Avatar from "@/src/components/ui/avatar";
import Button from "@/src/components/ui/button";
import ErrorDialog from "@/src/components/ui/ErrorDialog";
import FieldLabel from "@/src/components/ui/field-label";
import Icon from "@/src/components/ui/icon";
import Input from "@/src/components/ui/input";
import Screen from "@/src/components/ui/screen";
import Select from "@/src/components/ui/select";
import Text from "@/src/components/ui/text";
import { showToast } from "@/src/components/ui/toast";
import { theme } from "@/src/constants/theme";
import { useMe } from "@/src/hooks/queries";
import { PROFILE_FIELDS, profileRefusal, useUpdateProfile, type ProfileField } from "@/src/hooks/useProfile";
import { useNav } from "@/src/navigation/Navigations";
import { authService } from "@/src/services/auth.service";

const GENDER_OPTIONS = [
  { value: "Female", label: "Female" },
  { value: "Male", label: "Male" },
  { value: "Other", label: "Other" },
];

/**
 * "Edit Profile" (Figma): photo with "Upload Image", then the personal and emergency-contact details, read from `/auth/me` and saved
 * with `PUT /auth/profile`. The photo goes up on its own (`POST /auth/profile/upload-image`). The email cannot be changed from the
 * app (it is the sign-in). "Update Password" opens the change-password screen: a password change needs the current password, so
 * it cannot be a single box here. The age is saved as a birth date (the server keeps no age).
 */
const EditProfile: React.FC = () => {
  const navigation = useNav();
  const me = useMe();
  const update = useUpdateProfile();
  const [edited, setEdited] = useState<Partial<Record<ProfileField, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const stored = (field: ProfileField) => {
    const def = PROFILE_FIELDS.find((f) => f.field === field);
    return me.data && def ? def.read(me.data) : "";
  };
  const value = (field: ProfileField) => edited[field] ?? stored(field);
  const set = (field: ProfileField) => (text: string) => {
    setEdited((prev) => ({ ...prev, [field]: text }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setDialog({ title: "Photos are off", message: "Allow photo access in your phone settings to choose a profile picture." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      await authService.uploadProfileImage({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType });
      setPhoto(asset.uri);
    } catch (e) {
      setDialog({ title: "Could not upload your photo", message: messageForError(e) });
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const found: Partial<Record<ProfileField, string>> = {};
    for (const { field } of PROFILE_FIELDS) {
      if (edited[field] === undefined) continue;
      if (field === "fullName" && !value(field).trim()) found[field] = "Full name is required";
      else if (field === "phone" && !value(field).trim() && stored(field)) found[field] = "Enter a phone number, or leave it as it is.";
      else if (field === "age" && value(field).trim() && !/^\d{1,3}$/.test(value(field).trim())) found[field] = "Enter your age in years, like 64";
      else if (field === "age" && value(field).trim() && (Number(value(field)) < 1 || Number(value(field)) > 120)) found[field] = "Enter an age from 1 to 120";
      // The backend ignores a blank value for these, so a cleared field would silently come back: say so instead.
      else if (field !== "fullName" && field !== "phone" && !value(field).trim() && stored(field)) found[field] = "This can't be cleared yet. Change it to something else.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    update.mutate(edited, {
      onSuccess: () => {
        // What the server kept (a phone comes back without spaces) is what the boxes show from here on.
        setEdited({});
        showToast("Profile has been updated");
      },
      onError: (e) => {
        // The server's own sentence, under the field it names (a bad phone, a phone another account uses) or in a dialog.
        const refusal = profileRefusal(e);
        if (refusal.field) setErrors({ [refusal.field]: refusal.message });
        else setDialog({ title: "Could not save", message: refusal.message });
      },
    });
  };

  return (
    <Screen title="Edit Profile" centerTitle scroll>
      <View style={styles.avatarBox}>
        <Avatar uri={photo ?? me.data?.profile_image_url} name={me.data?.full_name} size={104} />
        <Pressable accessibilityRole="button" accessibilityLabel="Upload Image" disabled={uploading} onPress={() => void pickPhoto()} style={styles.upload}>
          <Icon name="cloud-upload-outline" size={18} color={theme.colors.primary} />
          <Text weight="bold" color={theme.colors.primary}>
            {uploading ? "Uploading…" : "Upload Image"}
          </Text>
        </Pressable>
      </View>
      <Input label="Full Name" placeholder="Provide your Full Name" value={value("fullName")} onChangeText={set("fullName")} error={errors.fullName} autoComplete="name" />
      <Input label="Email Address" placeholder="Provide your Email Address" value={me.data?.email ?? ""} editable={false} />
      <Text variant="small" color={theme.colors.textLight}>To change your email, contact support.</Text>
      <Input label="Phone Number" placeholder="+234" value={value("phone")} onChangeText={set("phone")} keyboardType="phone-pad" error={errors.phone} />
      <Input label="House Address" placeholder="Enter House Address" value={value("address")} onChangeText={set("address")} error={errors.address} />
      <Select label="Select Gender" placeholder="Select Gender" options={GENDER_OPTIONS} value={GENDER_OPTIONS.find((o) => o.value.toLowerCase() === value("gender").toLowerCase())?.value ?? value("gender")} onChange={set("gender")} error={errors.gender} />
      <Input label="Enter Age" placeholder="Enter Age" value={value("age")} onChangeText={set("age")} keyboardType="number-pad" error={errors.age} />
      <Input label="Emergency Contact Person Name" placeholder="Enter Name" value={value("emergencyName")} onChangeText={set("emergencyName")} error={errors.emergencyName} />
      <Input label="Emergency Contact Person Phone Number" placeholder="+234" value={value("emergencyPhone")} onChangeText={set("emergencyPhone")} keyboardType="phone-pad" error={errors.emergencyPhone} />
      <Input label="Emergency Contact Person Address" placeholder="Enter Address" value={value("emergencyAddress")} onChangeText={set("emergencyAddress")} error={errors.emergencyAddress} />
      <View>
        <FieldLabel>Update Password</FieldLabel>
        <Pressable accessibilityRole="button" accessibilityLabel="Update Password" onPress={() => navigation.navigate("ChangePassword")} style={styles.password}>
          <Text color={theme.colors.textLight} style={styles.passwordDots}>
            ••••••••
          </Text>
          <Icon name="chevron-forward" size={18} color={theme.colors.textLight} />
        </Pressable>
      </View>
      <Button title="Update Profile Details" onPress={save} loading={update.isPending} />
      <ErrorDialog visible={dialog !== null} title={dialog?.title ?? ""} message={dialog?.message ?? ""} onClose={() => setDialog(null)} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  avatarBox: { alignItems: "center", gap: theme.spacing.sm },
  upload: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  password: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md,
  },
  passwordDots: { flex: 1 },
});

export default EditProfile;
