// All period boundaries are computed in Indian Standard Time (UTC+05:30, no DST)
const TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 330 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// IST midnight at the start of the day/month that is `back` days/months before today
const istPeriodStart = (unit, back = 0) => {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  if (unit === 'month') ist.setUTCMonth(ist.getUTCMonth() - back, 1);
  else ist.setUTCDate(ist.getUTCDate() - back);
  return new Date(ist.getTime() - IST_OFFSET_MS);
};

const startOfToday = () => istPeriodStart('day');
const startOfMonth = (back = 0) => istPeriodStart('month', back);

/**
 * Totals per day or month for the last `periods` periods, including empty ones.
 * Returns [{ label, count, total }] oldest first; `total` sums `sumField` when given.
 */
const timeSeries = async (Model, match, { unit = 'month', periods = 6, dateField = 'createdAt', sumField } = {}) => {
  const format = unit === 'month' ? '%Y-%m' : '%Y-%m-%d';
  const rows = await Model.aggregate([
    { $match: { ...match, [dateField]: { $gte: istPeriodStart(unit, periods - 1) } } },
    {
      $group: {
        _id: { $dateToString: { format, date: `$${dateField}`, timezone: TIMEZONE } },
        count: { $sum: 1 },
        total: { $sum: sumField ? `$${sumField}` : 0 }
      }
    }
  ]);
  const byKey = Object.fromEntries(rows.map(r => [r._id, r]));

  const series = [];
  for (let back = periods - 1; back >= 0; back--) {
    const ist = new Date(istPeriodStart(unit, back).getTime() + IST_OFFSET_MS);
    const key = ist.toISOString().slice(0, unit === 'month' ? 7 : 10);
    const label = unit === 'month' ? MONTHS[ist.getUTCMonth()] : DAYS[ist.getUTCDay()];
    series.push({ label, count: byKey[key]?.count || 0, total: Math.round(byKey[key]?.total || 0) });
  }
  return series;
};

// Sum and count of documents matching `match`
const sumOf = async (Model, match, field) => {
  const [row] = await Model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` }, count: { $sum: 1 } } }]);
  return { total: Math.round(row?.total || 0), count: row?.count || 0 };
};

// Percentage change between two numbers, rounded to one decimal
const growth = (current, previous) => (previous ? Math.round(((current - previous) / previous) * 1000) / 10 : current ? 100 : 0);

module.exports = { timeSeries, sumOf, startOfToday, startOfMonth, growth };
