export function parseMinute(raw) {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return {
      raw: String(raw),
      display: String(raw),
      base: raw,
      added: 0,
      elapsed: raw
    };
  }

  const text = String(raw)
    .replace(/\u2019/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
  const match = text.match(/(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/);
  if (!match) return null;

  const base = Number(match[1]);
  const added = match[2] ? Number(match[2]) : 0;
  return {
    raw: text,
    display: added ? `${base}+${added}` : String(base),
    base,
    added,
    elapsed: base + added
  };
}

export function minuteDisplay(raw, fallback = "0") {
  const parsed = parseMinute(raw);
  return parsed ? parsed.display : fallback;
}

export function eventKey(event, fallbackOrder = 0) {
  const parsed = parseMinute(event?.minute);
  return {
    elapsed: parsed?.elapsed ?? 0,
    order: Number.isFinite(event?.sortOrder) ? event.sortOrder : fallbackOrder
  };
}

export function compareEventKeys(a, b) {
  if (a.elapsed !== b.elapsed) return a.elapsed - b.elapsed;
  return a.order - b.order;
}

export function isKeyWithinInterval(key, startKey, endKey) {
  return compareEventKeys(startKey, key) <= 0 && compareEventKeys(key, endKey) < 0;
}

export function maxMinute(...values) {
  return values
    .map((value) => parseMinute(value)?.elapsed)
    .filter((value) => Number.isFinite(value))
    .reduce((max, value) => Math.max(max, value), 90);
}
