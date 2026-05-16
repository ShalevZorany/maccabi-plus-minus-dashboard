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
  assert.match(appJs, /captureTableScrollPosition\(\)/);
  assert.match(appJs, /restoreTableScrollPosition\(scrollPosition\)/);

  for (const key of ["minutes", "appearances", "starts", "startedWinPercentage", "goalsForOn", "goalsAgainstOn", "minutesPerGoalFor", "minutesPerGoalAgainst", "plusMinus"]) {
    assert.match(appJs, new RegExp(`${key}:`), `missing sortable metric ${key}`);
    assert.match(appJs, new RegExp(`renderPlayerSortHeader\\("${key}"\\)`), `missing header for ${key}`);
  }

  assert.match(appJs, /colspan=\\"10\\"/);
  assert.match(appJs, /formatPercentage\(player\.startedWinPercentage\)/);
});

test("players table can be filtered by minimum played minutes", () => {
  assert.match(indexHtml, /id="minMinutesFilter"/);
  assert.match(indexHtml, /type="search"/);
  assert.match(indexHtml, /inputmode="numeric"/);
  assert.match(indexHtml, /placeholder="למשל 500 או 1000"/);
  assert.match(appJs, /minMinutes:\s*""/);
  assert.match(appJs, /\["minMinutes",\s*"#minMinutesFilter"\]/);
  assert.match(appJs, /function parseMinMinutesFilter\(\)/);
  assert.match(appJs, /Number\(player\.minutes \|\| 0\) < minMinutes/);
  assert.match(appJs, /לפחות \$\{minMinutes\} דקות משחק/);
});

test("import actions stay unavailable until runtime policy is loaded", () => {
  assert.match(indexHtml, /<div class="hero__actions" hidden>/);
  assert.match(indexHtml, /id="refreshData"[^>]*disabled/);
  assert.doesNotMatch(indexHtml, /manualFile/);
  assert.doesNotMatch(indexHtml, /ייבוא JSON\/CSV ידני/);
  assert.match(appJs, /heroActions\.hidden = false/);
  assert.match(appJs, /configureImportControls\(\);\s*}\s*}/);
});

test("mobile table overflow is isolated to the table wrapper", () => {
  assert.match(css, /html\s*{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /body\s*{[^}]*overflow-x:\s*hidden/s);
  assert.match(css, /\.table-wrap\s*{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media\s*\(max-width:\s*560px\)/);
  assert.match(css, /th:first-child,\s*td:first-child\s*{[^}]*position:\s*sticky/s);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.doesNotMatch(css, /content:\s*"גלילה"/);
  assert.doesNotMatch(css, /@supports\s*\(content-visibility:\s*auto\)\s*{[\s\S]*?\.panel[\s\S]*?content-visibility:\s*auto/s);
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
