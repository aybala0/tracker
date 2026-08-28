const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a `YYYY-MM-DD` string as "D Mon" (e.g. "6 Jan") by splitting the
 * string directly — never construct a JS `Date` from a Postgres date value.
 * The driver can return `date` columns as `Date` objects that pick up a
 * timezone shift on serialization (confirmed: a transaction dated 2026-08-21
 * came back as `2026-08-20T21:00:00.000Z`). Always select dates via
 * `to_char(date, 'YYYY-MM-DD')` and pass the resulting plain string here.
 */
export function fmtDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}
