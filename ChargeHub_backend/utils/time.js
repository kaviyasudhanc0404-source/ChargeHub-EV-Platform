// "HH:mm" → minutes since midnight
const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

// "15:30" → "3:30 PM" (times shown to people use the 12-hour clock)
const to12h = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// A moment's time in India on the 12-hour clock, e.g. "5:30 PM"
const istClock = (date) => to12h(new Date(date).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }));

module.exports = { toMinutes, to12h, istClock };
