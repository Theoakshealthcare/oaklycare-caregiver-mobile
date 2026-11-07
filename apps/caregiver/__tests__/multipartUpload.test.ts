import { buildImageForm, accountService } from "../src/services/account.service";
import { caregiverService } from "../src/services/caregiver.service";
import { ApiError, NETWORK_MESSAGE } from "../src/api/errors";

jest.mock("../src/auth", () => ({
  session: { getAccessToken: () => "tok", refresh: jest.fn(async () => null) },
}));

/**
 * DP1-02: openapi-fetch builds `new Request(url, { body: FormData })`, which React Native's fetch cannot send
 * (the call never left the device). Every multipart upload must reach `fetch` as `(url, init)` with the
 * FormData as `init.body`, never wrapped in a Request.
 */
describe("multipart uploads", () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock = jest.fn(async () => new Response(JSON.stringify({ profile_image_url: "https://img/x.jpg", id: 1 }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = realFetch;
  });

  function expectPlainFetch(path: string) {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0] as [unknown, RequestInit];
    expect(input).not.toBeInstanceOf(Request);
    expect(typeof input).toBe("string");
    expect(String(input).endsWith(path)).toBe(true);
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("content-type");
  }

  it("sends the licence through plain fetch", async () => {
    await caregiverService.uploadDocument({ uri: "file:///c/l.png", name: "l.png", mimeType: "image/png" }, "license");
    expectPlainFetch("/api/v1/caregiver/documents/upload");
  });

  it("sends the profile photo through plain fetch", async () => {
    await expect(accountService.uploadProfileImage({ uri: "file:///c/p.jpg" })).resolves.toBe("https://img/x.jpg");
    expectPlainFetch("/api/v1/auth/profile/upload-image");
    expect(buildImageForm({ uri: "file:///c/p.jpg" })).toBeInstanceOf(FormData);
  });

  it("says 'Can't reach Oakly' only when fetch itself rejects", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    await expect(
      caregiverService.uploadDocument({ uri: "file:///c/l.png", name: "l.png" }, "license"),
    ).rejects.toMatchObject({ status: 0, message: NETWORK_MESSAGE });
  });

  it("shows the server's answer for a rejected upload, not a connection error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: "File type not allowed" }), { status: 400 }));
    const failure = caregiverService.uploadDocument({ uri: "file:///c/l.png", name: "l.png" }, "license");
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 400, detail: "File type not allowed" });
  });
});
