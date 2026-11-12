const Booking = require('../models/Booking.model');
const { toMinutes, to12h } = require('../utils/time');

// When a charging slot can be booked. The same rules accept a booking and mark every time in the booking picker, so
// the picker never offers a slot that booking would refuse.
const MAX_ADVANCE_DAYS = 30;
const STEP_MIN = 30; // start times offered in the picker
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

// Confirmed bookings of a station that overlap a time range
const overlapFilter = (stationId, slotStart, slotEnd) => ({
  stationId,
  status: 'confirmed',
  slotStart: { $lt: slotEnd },
  slotEnd: { $gt: slotStart }
});

// Why a slot can't be booked, apart from clashing with another booking: { reason, message }, or null when it can
const slotRule = (station, { slotStart, bookingTime, duration }, now = new Date()) => {
  if (slotStart <= now) return { reason: 'past', message: 'Please choose a time in the future' };
  if (slotStart > new Date(now.getTime() + MAX_ADVANCE_DAYS * DAY_MS)) {
    return { reason: 'unavailable', message: `Bookings can be made up to ${MAX_ADVANCE_DAYS} days in advance` };
  }
  const hours = station.operatingHours;
  if (hours && !hours.is24x7) {
    const start = toMinutes(bookingTime);
    if (start < toMinutes(hours.open) || start + duration * 60 > toMinutes(hours.close)) {
      return { reason: 'closed', message: `This station is open ${to12h(hours.open)} – ${to12h(hours.close)}. Please choose a slot within these hours.` };
    }
  }
  return null;
};

const timeOfDay = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Bookable start times from today (IST) to MAX_ADVANCE_DAYS ahead for a `duration`-hour session:
 * [{ date: 'YYYY-MM-DD', slots: [{ time: 'HH:mm', status }] }] where status is
 * open | booked (another booking is running then) | clash (the session would run into another booking).
 * Past times, closed hours and days too far ahead are left out.
 */
async function availability(station, duration, now = new Date()) {
  const today = new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  const dates = Array.from({ length: MAX_ADVANCE_DAYS + 1 }, (_, i) => new Date(Date.parse(today) + i * DAY_MS).toISOString().slice(0, 10));
  const booked = await Booking.find(
    overlapFilter(station._id, now, Booking.computeSlot(dates[dates.length - 1], '23:59', duration).slotEnd),
    'slotStart slotEnd'
  ).lean();

  return dates.map((date) => ({
    date,
    slots: Array.from({ length: (24 * 60) / STEP_MIN }, (_, i) => timeOfDay(i * STEP_MIN))
      .map((time) => {
        const { slotStart, slotEnd } = Booking.computeSlot(date, time, duration);
        if (slotRule(station, { slotStart, bookingTime: time, duration }, now)) return null;
        const status = booked.some(b => b.slotStart <= slotStart && slotStart < b.slotEnd) ? 'booked'
          : booked.some(b => b.slotStart < slotEnd && b.slotEnd > slotStart) ? 'clash'
            : 'open';
        return { time, status };
      })
      .filter(Boolean)
  }));
}

module.exports = { MAX_ADVANCE_DAYS, overlapFilter, slotRule, availability };
