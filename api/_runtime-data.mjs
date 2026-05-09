import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { importFromMaccabi } from "../src/importers/maccabi-importer.mjs";

const SNAPSHOT_PATH = resolve(process.cwd(), "data", "matches.json");
const AUTO_MESSAGE = "הנתונים מתעדכנים אוטומטית בכל טעינה ממקור מכבי.";
const LIVE_IMPORT_TIMEOUT_MS = 12000;

function emptySnapshot() {
  return {
    schemaVersion: 1,
    generatedAt: null,
    sourcePolicy: {
      primary: "No data imported yet",
      notes: []
    },
    importStatus: {
      lastRunAt: null,
      source: "none",
      matchCount: 0,
      warnings: []
    },
    matches: []
  };
}

function readSnapshotData() {
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    return emptySnapshot();
  }
}

function fallbackPolicy(errorMessage) {
  return {
    mode: "automatic-live-fallback",
    autoRefresh: true,
    manualImportEnabled: false,
    message: `עדכון אוטומטי נכשל זמנית (${errorMessage}). מוצג הסנאפשוט האחרון.`
  };
}

function automaticPolicy() {
  return {
    mode: "automatic-live",
    autoRefresh: true,
    manualImportEnabled: false,
    message: AUTO_MESSAGE
  };
}

export async function getRuntimeData() {
  // Vercel production: pull live data on every request.
  if (process.env.VERCEL === "1") {
    try {
      const data = await importFromMaccabiWithTimeout(LIVE_IMPORT_TIMEOUT_MS);
      return { data, importPolicy: automaticPolicy() };
    } catch (error) {
      const snapshot = readSnapshotData();
      const warnings = Array.isArray(snapshot.importStatus?.warnings) ? snapshot.importStatus.warnings : [];
      snapshot.importStatus = {
        lastRunAt: snapshot.importStatus?.lastRunAt || null,
        source: snapshot.importStatus?.source || "snapshot",
        matchCount: Array.isArray(snapshot.matches) ? snapshot.matches.length : 0,
        warnings: [...warnings, `Live import failed on Vercel: ${error.message}`]
      };

      return {
        data: snapshot,
        importPolicy: fallbackPolicy(error.message || "unknown error")
      };
    }
  }

  // Local/dev API handlers: keep snapshot behavior.
  return {
    data: readSnapshotData(),
    importPolicy: {
      mode: "local-snapshot",
      autoRefresh: false,
      manualImportEnabled: true,
      message: "עדכון ידני זמין בסביבת פיתוח מקומית."
    }
  };
}

function importFromMaccabiWithTimeout(timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Live import timeout after ${timeoutMs}ms`)), timeoutMs);
    importFromMaccabi()
      .then((data) => {
        clearTimeout(timer);
        resolve(data);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
