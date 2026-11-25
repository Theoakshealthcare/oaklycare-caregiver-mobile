import { displayPhone, isBlankPhone, nationalDigits, normalizePhone, phoneProblem } from "../src/domain/phone";
import { parsePaymentReturn } from "../src/domain/paymentReturn";
import { addressKey, addressQuery, formatPlace, hasTypedAddress, locationIsStale } from "../src/domain/visitLocation";

describe("phone: one E.164 shape with the +234 always there", () => {
  it.each([
    ["", "+234"],
    ["+", "+234"],
    ["+23", "+234"],
    ["+24", "+234"],
    ["+234", "+234"],
    ["8", "+2348"],
    ["08012345678", "+2348012345678"],
    ["8012345678", "+2348012345678"],
    ["2348012345678", "+2348012345678"],
    ["+2348012345678", "+2348012345678"],
    ["+234 0801 234 5678", "+2348012345678"],
    ["0801 234 5678", "+2348012345678"],
    ["002348012345678", "+2348012345678"],
    ["+2340", "+234"],
    ["+447911123456", "+447911123456"],
    ["+44 7911 123456", "+447911123456"],
  ])("%j -> %j", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("is idempotent, and never longer than 15 digits", () => {
    for (const v of ["", "0801", "+2348012345678", "+447911123456", "23480123456789012345"]) expect(normalizePhone(normalizePhone(v))).toBe(normalizePhone(v));
    expect(normalizePhone("23480123456789012345").replace(/\D/g, "").length).toBeLessThanOrEqual(15);
  });

  it("shows a stored number as it is when it is already E.164, and in the +234 form otherwise", () => {
    expect(displayPhone("+2348012345678")).toBe("+2348012345678");
    expect(displayPhone("+2340000718205")).toBe("+2340000718205");
    expect(displayPhone("08012345678")).toBe("+2348012345678");
    expect(displayPhone("")).toBe("+234");
    expect(displayPhone("+234 801 234 5678")).toBe("+2348012345678");
  });

  it("keeps the rule: blank is required, fewer than 7 digits after the code is invalid", () => {
    expect(isBlankPhone("+234")).toBe(true);
    expect(isBlankPhone("")).toBe(true);
    expect(nationalDigits("08012345678")).toBe("8012345678");
    expect(phoneProblem("+234")).toBe("Phone number is required");
    expect(phoneProblem("+234801234")).toBe("Enter a valid phone number");
    expect(phoneProblem("+2348012345")).toBeUndefined();
  });
});

describe("visit location", () => {
  it("writes the geocoder's answer as one line, without repeating a part", () => {
    expect(formatPlace({ streetNumber: "12", street: "Allen Avenue", district: "Ikeja", city: "Ikeja", region: "Lagos" })).toBe("12 Allen Avenue, Ikeja, Lagos");
    expect(formatPlace({ name: "Landmark Towers", city: "Lagos", region: "Lagos" })).toBe("Landmark Towers, Lagos");
    expect(formatPlace({ formattedAddress: "Somewhere, Nigeria" })).toBe("Somewhere, Nigeria");
    expect(formatPlace({})).toBeNull();
    expect(formatPlace(undefined)).toBeNull();
  });

  const typed = { address: " 12  Sample Street ", city: "Ikeja", state: "Lagos" };
  it("keys and queries the typed address", () => {
    expect(addressKey(typed)).toBe("12 sample street | ikeja | lagos");
    expect(addressKey({ address: "", city: " ", state: "" })).toBe("");
    expect(addressQuery({ address: "12 Sample Street", city: "Ikeja", state: "Lagos" })).toBe("12 Sample Street, Ikeja, Lagos, Nigeria");
    expect(hasTypedAddress(typed)).toBe(true);
    expect(hasTypedAddress({ ...typed, city: "" })).toBe(false);
  });

  it("a looked-up address is stale after any edit; a phone position only if an address was already typed and then changed", () => {
    const base = { latitude: 6.5, longitude: 3.3, ...typed };
    const key = addressKey(typed);
    expect(locationIsStale({ ...base, locationSource: "address", locationKey: key })).toBe(false);
    expect(locationIsStale({ ...base, address: "99 Other", locationSource: "address", locationKey: key })).toBe(true);
    expect(locationIsStale({ ...base, locationSource: "device", locationKey: key })).toBe(false);
    expect(locationIsStale({ ...base, address: "99 Other", locationSource: "device", locationKey: key })).toBe(true);
    expect(locationIsStale({ ...base, locationSource: "device", locationKey: "" })).toBe(false);
    expect(locationIsStale({ ...base, latitude: null, longitude: null, address: "x", locationSource: null, locationKey: "" })).toBe(false);
  });
});

describe("payment return link", () => {
  it("reads only oaklypatient://payment-complete, with or without a booking id", () => {
    expect(parsePaymentReturn("oaklypatient://payment-complete")).toEqual({ bookingId: null });
    expect(parsePaymentReturn("oaklypatient://payment-complete/")).toEqual({ bookingId: null });
    expect(parsePaymentReturn("oaklypatient://payment-complete?booking_id=abc-1&x=y")).toEqual({ bookingId: "abc-1" });
    expect(parsePaymentReturn("oaklypatient://payment-complete?bookingId=abc-2")).toEqual({ bookingId: "abc-2" });
    expect(parsePaymentReturn("oaklypatient://elsewhere")).toBeNull();
    expect(parsePaymentReturn("https://oaklycare.com/payment-complete")).toBeNull();
    expect(parsePaymentReturn(null)).toBeNull();
  });
});
