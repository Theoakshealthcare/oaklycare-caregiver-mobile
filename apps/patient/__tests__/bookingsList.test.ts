import { dayLabel, monthHeading, sameDay, visitLine, weekDays, weekStart } from "../src/domain/bookingList";
import { toBooking } from "../src/services/bookingMapper";
import { capture } from "../test-utils/captures";

// "Now" is Tuesday 24 November 2026, 10:00 in the phone's own zone (the helpers read local time).
const NOW = new Date(2026, 10, 24, 10, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();

describe("the Bookings list wording (Figma: 'Today, 2:00 PM · 1 hour')", () => {
  it("calls the day Today, Tomorrow, a weekday for the rest of the week, then the plain date", () => {
    expect(dayLabel(at(24, 14), NOW)).toBe("Today");
    expect(dayLabel(at(25, 9), NOW)).toBe("Tomorrow");
    expect(dayLabel(at(27, 9), NOW)).toBe("Friday");
    expect(dayLabel(at(30, 9), NOW)).toBe("Monday");
    expect(dayLabel(new Date(2026, 11, 2, 9).toISOString(), NOW)).toBe("2 Dec 2026");
    expect(dayLabel(at(23, 9), NOW)).toBe("23 Nov 2026");
  });

  it("writes the visit line with the time and the length (the design's '1hour' is spaced)", () => {
    expect(visitLine(at(24, 14), 60, NOW)).toBe("Today, 2:00 PM · 1 hour");
    expect(visitLine(at(25, 8, 30), 90, NOW)).toBe("Tomorrow, 8:30 AM · 1 hour 30 minutes");
  });
});

describe("the week strip", () => {
  it("starts on the Monday and runs for seven days, crossing a month end", () => {
    const start = weekStart(new Date(2026, 10, 29)); // a Sunday
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(23);
    const days = weekDays(weekStart(new Date(2026, 10, 25)));
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getDate())).toEqual([23, 24, 25, 26, 27, 28, 29]);
    expect(weekDays(weekStart(new Date(2026, 11, 2))).map((d) => d.getDate())).toEqual([30, 1, 2, 3, 4, 5, 6]);
    expect(sameDay(days[1], NOW)).toBe(true);
  });

  it("names the month the middle of the week is in", () => {
    expect(monthHeading(weekStart(new Date(2026, 10, 25)))).toBe("November 2026");
    expect(monthHeading(weekStart(new Date(2026, 11, 2)))).toBe("December 2026");
  });
});

describe("the caregiver on a booking", () => {
  it("carries the first name and the specialization, and no photo when the API sends none", () => {
    const b = toBooking(capture("022-p-b2-detail-accepted").body);
    expect(b.caregiver).toEqual({ firstName: "Placeholder", photoUrl: null, role: "Elderly Care" });
  });

  it("keeps only an https photo address", () => {
    const body = capture("022-p-b2-detail-accepted").body;
    const withPhoto = (url: string) => toBooking({ ...body, caregiver_details: { ...body.caregiver_details, profile_image_url: url } });
    expect(withPhoto("https://res.cloudinary.com/placeholder/image/upload/a.jpg").caregiver?.photoUrl).toBe("https://res.cloudinary.com/placeholder/image/upload/a.jpg");
    expect(withPhoto("javascript:alert(1)").caregiver?.photoUrl).toBeNull();
    expect(withPhoto("http://insecure.example.com/a.jpg").caregiver?.photoUrl).toBeNull();
  });
});
