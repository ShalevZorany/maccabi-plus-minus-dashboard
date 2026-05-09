import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("API exposes dashboard status", async (t) => {

  const tempDir = await mkdtemp(join(tmpdir(), "maccabicheck-"));
  const dataPath = join(tempDir, "matches.json");
  process.env.MACCABICHECK_DATA_PATH = dataPath;
  await writeFile(dataPath, JSON.stringify({ schemaVersion: 1, matches: [], importStatus: {}, sourcePolicy: {} }), "utf8");

  const { createApp } = await import("../src/server.mjs");
  const server = createApp().listen(0);
  t.after(() => server.close());

  const port = server.address().port;
  const response = await fetch(`http://127.0.0.1:${port}/api/dashboard`);
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.totals.matches, 0);
  assert.equal(json.importPolicy.autoRefresh, false);
  assert.equal(json.importPolicy.manualImportEnabled, true);
});
