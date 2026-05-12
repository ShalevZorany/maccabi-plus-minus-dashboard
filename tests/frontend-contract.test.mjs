import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const manifestUrl = new URL("../public/manifest.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));

test("players table exposes sortable metric columns with plus/minus descending default", () => {
  assert.match(appJs, /playerSort:\s*{\s*key:\s*"plusMinus",\s*direction:\s*"desc"/s);
  assert.match(appJs, /view\.addEventListener\("click",\s*handleViewClick\)/);
  assert.match(appJs, /data-player-sort/);
  assert.match(appJs, /aria-sort=/);

  for (const key of ["minutes", "appearances", "goalsForOn", "goalsAgainstOn", "minutesPerGoalFor", "minutesPerGoalAgainst", "plusMinus"]) {
    assert.match(appJs, new RegExp(`${key}:`), `missing sortable metric ${key}`);
    assert.match(appJs, new RegExp(`renderPlayerSortHeader\\("${key}"\\)`), `missing header for ${key}`);
  }
});

test("mobile table overflow is isolated to the table wrapper", () => {
  assert.match(css, /html\s*{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /body\s*{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.table-wrap\s*{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)/);
  assert.match(css, /th:first-child,\s*td:first-child\s*{[^}]*position:\s*sticky/s);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
});

test("web app manifest and icons are wired from the HTML shell", () => {
  assert.match(manifest.name, /maccabicheck/i);
  assert.equal(manifest.short_name, "maccabicheck");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));

  for (const icon of manifest.icons) {
    assert.equal(existsSync(new URL(`../public/${icon.src.replace(/^\//, "")}`, import.meta.url)), true);
  }

  assert.match(indexHtml, /<link rel="manifest" href="\/manifest\.json">/);
  assert.match(indexHtml, /apple-mobile-web-app-capable/);
  assert.match(indexHtml, /apple-mobile-web-app-title/);
  assert.match(indexHtml, /theme-color/);
  assert.match(indexHtml, /apple-touch-icon/);
});
