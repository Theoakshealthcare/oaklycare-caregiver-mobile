import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import { queryClient } from "../src/api/queryClient";
import { hideToast } from "../src/components/ui/toast";
import { ageFromBirthDate, birthDateFromAge } from "../src/hooks/useProfile";
import { disableCacheGcForTests } from "../test-utils/fakeApi";
import { liveBody, liveReply } from "../test-utils/live";
import { renderSignedIn } from "../test-utils/renderApp";

const mockPick = jest.fn();
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: (...args: unknown[]) => mockPick(...args),
}));
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    async bytes() {
      return new Uint8Array([1, 2, 3]);
    }
  },
}));
jest.mock("expo-font", () => ({
  ...jest.requireActual("expo-font"),
  useFonts: () => [true, null],
}));

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole("button", { name }));
const type = (label: string, value: string) => fireEvent.changeText(screen.getByLabelText(label), value);

const me = () => liveBody("me-after-update");
const meWith = (patient: object) => ({ ...me(), patient: { ...me().patient, ...patient } });

describe("profile menu, edit profile and account screens (Figma parity)", () => {
  beforeAll(() => disableCacheGcForTests(queryClient));
  afterAll(() => queryClient.clear());
  beforeEach(() => {
    hideToast();
    mockPick.mockReset();
  });

  it("age and birth date: an age typed in is saved as that many years back, and reads back as the same age", () => {
    const now = new Date("2026-11-24T10:00:00");
    expect(birthDateFromAge(64, now)).toBe("1962-11-24");
    expect(ageFromBirthDate("1962-11-24", now)).toBe("64");
    expect(ageFromBirthDate("1962-11-25", now)).toBe("63"); // the birthday is tomorrow
    expect(ageFromBirthDate(null, now)).toBe("");
    expect(ageFromBirthDate("not a date", now)).toBe("");
  });

  it("Profile Settings: photo or initials, name, 'Verified User', and only the rows that lead somewhere that exists", async () => {
    const { view } = await renderSignedIn({}, me());
    await press("Open profile");
    expect(await screen.findByText("Profile Settings")).toBeTruthy();
    expect(screen.getByText(me().full_name)).toBeTruthy();
    expect(screen.getByText("Verified User")).toBeTruthy();
    expect(screen.getByLabelText("Profile picture")).toBeTruthy();
    const rows = ["Edit Personal Information", "FAQs", "About Us", "Contact Us", "Terms of Service", "Privacy Policy", "Account and Data"];
    for (const name of rows) expect(screen.getByRole("button", { name })).toBeTruthy();
    // not in v1: no row, and the password lives in Edit Profile now
    expect(screen.queryByText(/Family Details|Wallet|Subscription|Live Chat|Drug Reminder|Satisfaction|Refer and Earn|Complaints|Change password/)).toBeNull();
    view.unmount();
  });

  it("Edit Profile: the design's labels and order, gender and age from /auth/me, and 'Update Password' opens the password screen", async () => {
    const dob = birthDateFromAge(64);
    const { view } = await renderSignedIn({}, meWith({ gender: "female", date_of_birth: dob }));
    await press("Open profile");
    await press("Edit Personal Information");
    for (const label of ["Full Name", "Email Address", "Phone Number", "House Address", "Select Gender", "Enter Age", "Emergency Contact Person Name", "Emergency Contact Person Phone Number", "Emergency Contact Person Address"]) {
      expect(await screen.findByLabelText(label)).toBeTruthy();
    }
    expect(screen.getByLabelText("Enter Age").props.value).toBe("64");
    expect(screen.getByRole("button", { name: "Select Gender" }).props.accessibilityValue).toMatchObject({ text: "Female" });
    expect(screen.getByRole("button", { name: "Upload Image" })).toBeTruthy();
    await press("Update Password");
    expect(await screen.findByLabelText("Current password")).toBeTruthy();
    view.unmount();
  });

  it("saves a changed gender and age: gender as typed, the age as a birth date; the toast says 'Profile has been updated'", async () => {
    let saved = false;
    const { calls, view } = await renderSignedIn(
      {
        "PUT /api/v1/auth/profile": () => {
          saved = true;
          return liveReply("profile-update");
        },
        "GET /api/v1/auth/me": () => ({ status: 200, body: saved ? meWith({ gender: "Male", date_of_birth: birthDateFromAge(70) }) : me() }),
      },
      me(),
    );
    await press("Open profile");
    await press("Edit Personal Information");
    await press("Select Gender");
    await press("Male");
    await type("Enter Age", "70");
    await press("Update Profile Details");
    expect(await screen.findByTestId("toast")).toBeTruthy();
    expect(screen.getByText("Profile has been updated")).toBeTruthy();
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ gender: "Male", date_of_birth: birthDateFromAge(70) });
    await waitFor(() => expect(screen.getByLabelText("Enter Age").props.value).toBe("70"));
    view.unmount();
  });

  it("refuses an age that is not a number of years, before calling the server", async () => {
    const { calls, view } = await renderSignedIn({}, me());
    await press("Open profile");
    await press("Edit Personal Information");
    await type("Enter Age", "abc");
    await press("Update Profile Details");
    expect(await screen.findByText("Enter your age in years, like 64")).toBeTruthy();
    await type("Enter Age", "150");
    await press("Update Profile Details");
    expect(await screen.findByText("Enter an age from 1 to 120")).toBeTruthy();
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    view.unmount();
  });

  it("Upload Image: sends the picked photo as multipart (plain fetch, never a Request) and shows it", async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///photo/me.jpg", fileName: "me.jpg", mimeType: "image/jpeg" }] });
    const { calls, view } = await renderSignedIn({}, me());
    const routed = (globalThis.fetch as jest.Mock).getMockImplementation() as (input: unknown) => Promise<Response>;
    const uploads: { input: unknown; init: RequestInit }[] = [];
    (globalThis.fetch as jest.Mock).mockImplementation(async (input: unknown, init?: RequestInit) => {
      if (typeof input === "string") {
        uploads.push({ input, init: init as RequestInit });
        return new Response(JSON.stringify({ profile_image_url: "https://img.example.com/me.jpg" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return routed(input);
    });
    await press("Open profile");
    await press("Edit Personal Information");
    await press("Upload Image");
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(String(uploads[0].input).endsWith("/api/v1/auth/profile/upload-image")).toBe(true);
    expect(uploads[0].init.method).toBe("POST");
    expect(uploads[0].init.body).toBeInstanceOf(FormData);
    expect((uploads[0].init.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
    // the profile is read again so every screen shows the new photo
    await waitFor(() => expect(calls.filter((c) => c.method === "GET" && c.path === "/api/v1/auth/me").length).toBeGreaterThanOrEqual(2));
    expect(screen.getByLabelText("Profile picture").props.source).toEqual({ uri: "file:///photo/me.jpg" });
    view.unmount();
  });

  it("Upload Image: a cancelled picker sends nothing", async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    const { calls, view } = await renderSignedIn({}, me());
    await press("Open profile");
    await press("Edit Personal Information");
    await press("Upload Image");
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    view.unmount();
  });

  it("Account and Data: Delete Account first, then Logout; the dialog is the design's, and No, Go Back leaves everything as it was", async () => {
    const { calls, view } = await renderSignedIn({}, me());
    await press("Open profile");
    await press("Account and Data");
    const rows = screen.getAllByRole("button").map((b) => b.props.accessibilityLabel);
    expect(rows.indexOf("Delete Account")).toBeGreaterThanOrEqual(0);
    expect(rows.indexOf("Delete Account")).toBeLessThan(rows.indexOf("Logout"));
    await press("Delete Account");
    expect(await screen.findByText("Are you sure you want to Delete Account")).toBeTruthy();
    expect(screen.getByText("Once you delete your account all your data will be deleted.")).toBeTruthy();
    await press("No, Go Back");
    await waitFor(() => expect(screen.queryByText("Are you sure you want to Delete Account")).toBeNull());
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    view.unmount();
  });

  it("Contact Us: one e-mail row (chat and WhatsApp are not in v1) that opens the mail app", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { view } = await renderSignedIn({}, me());
    await press("Open profile");
    await press("Contact Us");
    expect(await screen.findByText("Send an email")).toBeTruthy();
    expect(screen.queryByText(/Chat with a support agent|Whatsapp/i)).toBeNull();
    await press("Send an email");
    expect(open).toHaveBeenCalledWith("mailto:info@theoakshealthcare.com");
    open.mockRestore();
    view.unmount();
  });
});
