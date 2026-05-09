import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_PATH = process.env.MACCABICHECK_DATA_PATH || resolve(ROOT, "data", "matches.json");

export function emptyDataSet() {
  return {
    schemaVersion: 1,
    generatedAt: null,
    sourcePolicy: {
      primary: "No data imported yet",
      notes: [
        "Run npm run import or use the dashboard import controls.",
        "Only matches with verified lineups, substitutions and goal minutes are included in calculations."
      ]
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

export async function readData() {
  try {
    return JSON.parse(await readFile(DATA_PATH, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return emptyDataSet();
    throw error;
  }
}

export async function writeData(data) {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return data;
}
