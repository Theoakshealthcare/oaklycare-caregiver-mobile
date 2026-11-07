import { buildImageForm } from "../src/services/account.service";
import { buildDocumentForm } from "../src/services/caregiver.service";

/**
 * DP1-02 / RC1-01: the app's global `fetch` is `expo/fetch`, whose FormData conversion only takes a string,
 * a Blob or an object with `bytes()`. The Jest tests that mock `fetch` could not see that the old
 * `{ uri, name, type }` file part throws `Unsupported FormDataPart implementation` before any request is
 * made. These tests feed the builders' output through expo's own `convertFormDataAsync` (the code
 * `expo/fetch` calls), unmocked, and read the multipart body it produces.
 *
 * What this does NOT cover: the native request (`NativeRequest.start`) and the real `File.bytes()` of
 * expo-file-system, which need a device or simulator; the file read is faked here.
 */
const mockFileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const mockReads: string[] = [];

jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    async bytes() {
      mockReads.push(this.uri);
      return mockFileBytes;
    }
  },
}));

// The same functions expo runs on device. Under Jest they are TypeScript source inside the expo package.
const { installFormDataPatch } = jest.requireActual("expo/src/winter/FormData") as {
  installFormDataPatch: (formData: unknown) => unknown;
};
const { convertFormDataAsync } = jest.requireActual("expo/src/winter/fetch/convertFormData") as {
  convertFormDataAsync: (form: FormData, boundary?: string) => Promise<{ body: Uint8Array; boundary: string }>;
};

// React Native's own FormData class (what `new FormData()` is on a device before expo patches it).
const rnFormDataModule = jest.requireActual("react-native/Libraries/Network/FormData") as { default?: unknown };
const RNFormData = (rnFormDataModule.default ?? rnFormDataModule) as typeof FormData;

const BOUNDARY = "----ExpoFetchFormBoundary0000000000000000";

function latin1(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
}

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  return latin1(haystack).includes(latin1(needle));
}

describe("multipart bodies through the real expo/fetch FormData conversion", () => {
  const realFormData = globalThis.FormData;
  beforeAll(() => {
    // On a device the global FormData is React Native's, patched by expo/src/winter/runtime.native.ts.
    // Jest's global is Node's, so stand in React Native's class, patched the same way, for these tests.
    installFormDataPatch(RNFormData);
    globalThis.FormData = RNFormData;
  });
  afterAll(() => {
    globalThis.FormData = realFormData;
  });
  beforeEach(() => {
    mockReads.length = 0;
  });

  it("the old { uri, name, type } descriptor is what expo/fetch rejects (the bug this guards against)", async () => {
    const form = new FormData();
    form.append("file", { uri: "file:///c/l.png", name: "l.png", type: "image/png" } as unknown as Blob);
    await expect(convertFormDataAsync(form, BOUNDARY)).rejects.toThrow("Unsupported FormDataPart implementation");
  });

  it("converts the licence form: filename, content type, text field and the file's bytes", async () => {
    const form = buildDocumentForm({ uri: "file:///c/licence.png", name: "licence.png", mimeType: "image/png" }, "license");
    const { body, boundary } = await convertFormDataAsync(form, BOUNDARY);
    expect(boundary).toBe(BOUNDARY);
    const text = latin1(body);
    expect(text).toContain('content-disposition: form-data; name="document_type"\r\n\r\nlicense\r\n');
    expect(text).toContain('content-disposition: form-data; name="file"; filename="licence.png"\r\ncontent-type: image/png\r\n\r\n');
    expect(containsBytes(body, mockFileBytes)).toBe(true);
    expect(text.endsWith(`--${BOUNDARY}--\r\n`)).toBe(true);
    expect(mockReads).toEqual(["file:///c/licence.png"]);
  });

  it("converts the profile photo form, with the defaults for a picker that reports no name or type", async () => {
    const form = buildImageForm({ uri: "file:///c/IMG 1.jpg" });
    const { body } = await convertFormDataAsync(form, BOUNDARY);
    const text = latin1(body);
    expect(text).toContain('name="file"; filename="profile.jpg"\r\ncontent-type: image/jpeg\r\n\r\n');
    expect(containsBytes(body, mockFileBytes)).toBe(true);
    expect(mockReads).toEqual(["file:///c/IMG 1.jpg"]);
  });
});
