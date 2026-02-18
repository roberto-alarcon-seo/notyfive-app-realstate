/**
 * Converts a datetime-local value (e.g. "2026-02-22T11:00") to a proper
 * ISO-8601 string with the target timezone offset so the database stores
 * the intended wall-clock time.
 */
export function localDatetimeToTimezoneISO(
  datetimeLocalValue: string,
  timeZone = "America/Mexico_City"
): string {
  const date = new Date(datetimeLocalValue);
  if (isNaN(date.getTime())) return datetimeLocalValue;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = datetimeLocalValue.split("T");
  if (parts.length !== 2) return datetimeLocalValue;

  const [datePart, timePart] = parts;

  // Determine offset for that date in the target timezone
  const refDate = new Date(`${datePart}T12:00:00Z`);
  const tzParts = formatter.formatToParts(refDate);
  const get = (type: string) =>
    tzParts.find((p) => p.type === type)?.value || "";

  const tzDate = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
  );
  const offsetMs = tzDate.getTime() - refDate.getTime();
  const offsetMinutes = offsetMs / 60000;
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const hh = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const mm = String(absMinutes % 60).padStart(2, "0");
  const offsetStr = `${sign}${hh}:${mm}`;

  // Ensure time has seconds
  const fullTime = timePart.length === 5 ? `${timePart}:00` : timePart;

  return `${datePart}T${fullTime}${offsetStr}`;
}
