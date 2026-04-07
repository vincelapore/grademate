export type ICalAllDayEvent = {
  uid: string;
  dateStart: string;
  /** Inclusive last day (we emit DTEND exclusive per RFC 5545). */
  dateEndInclusive: string;
  summary: string;
  description?: string;
  url?: string;
};

export type GrademateIcalMeta = {
  calName: string;
  /** ISO-ish timestamp without colons for DTSTAMP, e.g. 20260407T120000Z */
  dtStampUtcCompact: string;
};

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function foldLine(input: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(input).length <= 75) return input;
  const out: string[] = [];
  let chunk = "";
  for (const ch of input) {
    const next = chunk + ch;
    if (encoder.encode(next).length > 75) {
      out.push(chunk);
      chunk = ` ${ch}`;
    } else {
      chunk = next;
    }
  }
  if (chunk) out.push(chunk);
  return out.join("\r\n");
}

function pushProp(lines: string[], name: string, value: string) {
  lines.push(foldLine(`${name}:${value}`));
}

function dayAfter(isoDate: string): string {
  return addDaysIsoDate(isoDate, 1);
}

function addDaysIsoDate(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function isoDateToICal(d: string): string {
  return d.replace(/-/g, "");
}

export function buildGrademateAssessmentCalendarIcs(
  meta: GrademateIcalMeta,
  events: ICalAllDayEvent[],
): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  pushProp(lines, "VERSION", "2.0");
  pushProp(lines, "PRODID", "-//Grademate//Grademate Assessment Calendar//EN");
  pushProp(lines, "CALSCALE", "GREGORIAN");
  pushProp(lines, "METHOD", "PUBLISH");
  pushProp(lines, "NAME", escapeICalText(meta.calName));
  pushProp(lines, "X-WR-CALNAME", escapeICalText(meta.calName));
  pushProp(lines, "CALNAME", escapeICalText(meta.calName));
  pushProp(
    lines,
    "DESCRIPTION",
    escapeICalText("Your assessment due dates from Grademate"),
  );
  pushProp(
    lines,
    "CALDESC",
    escapeICalText("Your assessment due dates from Grademate"),
  );
  pushProp(
    lines,
    "X-WR-CALDESC",
    escapeICalText("Your assessment due dates from Grademate"),
  );
  lines.push(foldLine("REFRESH-INTERVAL;VALUE=DURATION:PT12H"));
  pushProp(lines, "X-PUBLISHED-TTL", "PT12H");

  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    pushProp(lines, "UID", e.uid);
    pushProp(lines, "DTSTAMP", meta.dtStampUtcCompact);
    pushProp(lines, "DTSTART", `VALUE=DATE:${isoDateToICal(e.dateStart)}`);
    pushProp(lines, "DTEND", `VALUE=DATE:${isoDateToICal(dayAfter(e.dateEndInclusive))}`);
    pushProp(lines, "SUMMARY", escapeICalText(e.summary));
    if (e.description)
      pushProp(lines, "DESCRIPTION", escapeICalText(e.description));
    if (e.url) pushProp(lines, "URL", e.url);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function formatWeightingPct(weighting: number): string {
  if (Number.isInteger(weighting)) return String(weighting);
  const s = String(weighting);
  return /e/i.test(s) ? weighting.toFixed(2).replace(/\.?0+$/, "") : s;
}
