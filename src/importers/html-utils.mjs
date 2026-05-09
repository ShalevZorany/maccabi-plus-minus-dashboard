const ENTITY_MAP = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\""
};

export function decodeHtml(value = "") {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (_, entity) => ENTITY_MAP[entity] || `&${entity};`);
}

export function stripTags(value = "") {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFirst(html, regex, fallback = "") {
  const match = String(html).match(regex);
  return match ? match[1] : fallback;
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeUrl(url) {
  return String(url || "").replace(/\/overview\/?$/, "/").replace(/\/teams\/?$/, "/").replace(/\/gallery\/?$/, "/");
}

export function splitFixtureBlocks(html) {
  const blocks = [];
  const regex = /<div class="fixtures-holder[\s\S]*?(?=<div class="fixtures-holder|<\/div>\s*<\/main>|<footer|$)/g;
  let match;
  while ((match = regex.exec(html))) {
    blocks.push(match[0]);
  }
  return blocks;
}

export function extractSectionByHeading(html, heading) {
  const escaped = escapeRegExp(heading);
  const regex = new RegExp(`<h3>\\s*${escaped}\\s*<\\/h3>([\\s\\S]*?)(?=<h3>|<\\/article>|<\\/main>)`, "i");
  return extractFirst(html, regex, "");
}

export function parseDateToIso(value) {
  const text = stripTags(value);
  const match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return "";

  const months = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12"
  };
  const day = match[1].padStart(2, "0");
  const month = months[match[2].slice(0, 3).toLowerCase()];
  return month ? `${match[3]}-${month}-${day}` : "";
}

export function parseNumberMaybe(value) {
  const text = stripTags(value);
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}
