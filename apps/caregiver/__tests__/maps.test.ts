import { buildDirectionsUrl, directionsTarget } from "../src/utils/maps";

describe("buildDirectionsUrl", () => {
  it("uses Apple Maps on iOS", () => {
    expect(buildDirectionsUrl({ latitude: 6.4474, longitude: 3.4723 }, "ios")).toBe(
      "http://maps.apple.com/?daddr=6.4474,3.4723&dirflg=d",
    );
  });

  it("uses the Google Maps directions URL elsewhere", () => {
    expect(buildDirectionsUrl({ latitude: 6.4474, longitude: -3.4723 }, "android")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=6.4474,-3.4723",
    );
  });
});

describe("directionsTarget", () => {
  const base = { status: "accepted", patient_latitude: 6.4474, patient_longitude: 3.4723 };

  it.each(["accepted", "en_route", "in_progress"])("returns the coordinates while %s", (status) => {
    expect(directionsTarget({ ...base, status })).toEqual({ latitude: 6.4474, longitude: 3.4723 });
  });

  it.each(["pending", "completed", "cancelled"])("is null once the visit is %s (not an active assignment)", (status) => {
    expect(directionsTarget({ ...base, status })).toBeNull();
  });

  it("is null when coordinates are missing, not finite or the 0,0 placeholder", () => {
    expect(directionsTarget({ ...base, patient_latitude: null })).toBeNull();
    expect(directionsTarget({ ...base, patient_longitude: undefined })).toBeNull();
    expect(directionsTarget({ ...base, patient_latitude: Number.NaN })).toBeNull();
    expect(directionsTarget({ ...base, patient_latitude: 0, patient_longitude: 0 })).toBeNull();
  });
});
