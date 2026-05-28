export function formatThaiDateTime(dateInput: string | Date): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(safeDate);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  const buddhistYear = Number(get("year")) + 543;
  return `${get("day")}/${get("month")}/${buddhistYear} ${get("hour")}:${get("minute")}`;
}

export function sanitizePhoneNumber(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

export function maskPhoneNumber(phone: string): string {
  const clean = sanitizePhoneNumber(phone);
  if (clean.length <= 4) return clean || "-";
  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
}
