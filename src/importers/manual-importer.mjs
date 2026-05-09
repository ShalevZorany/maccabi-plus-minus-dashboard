import { playerId } from "../players.mjs";
import { validateMatch } from "../validation.mjs";

export function parseManualImport(input, contentType = "application/json") {
  if (contentType.includes("csv")) {
    return buildDataSet(parseCsvMatches(String(input)));
  }

  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  const matches = Array.isArray(parsed) ? parsed : parsed.matches;
  if (!Array.isArray(matches)) {
    throw new Error("Manual JSON import must be an array or an object with a matches array.");
  }
  return buildDataSet(matches);
}

export function parseCsvMatches(csv) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  if (!headerLine) return [];
  const headers = splitCsvLine(headerLine).map((header) => header.trim());

  return lines
    .filter((line) => line.trim())
    .map((line) => {
      const row = Object.fromEntries(splitCsvLine(line).map((value, index) => [headers[index], value.trim()]));
      const maccabiHome = row.homeTeam === "Maccabi Tel Aviv";
      const homeGoals = row.homeGoals === "" ? null : Number(row.homeGoals);
      const awayGoals = row.awayGoals === "" ? null : Number(row.awayGoals);
      const maccabiGoals = maccabiHome ? homeGoals : awayGoals;
      const opponentGoals = maccabiHome ? awayGoals : homeGoals;

      return {
        id: row.id,
        season: row.season || "2025/2026",
        competition: row.competition || "Israeli Premier League",
        round: row.round ? Number(row.round) : null,
        date: row.date,
        time: row.time,
        stadium: row.stadium,
        status: row.status || (homeGoals === null || awayGoals === null ? "scheduled" : "finished"),
        homeAway: maccabiHome ? "home" : "away",
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        opponent: maccabiHome ? row.awayTeam : row.homeTeam,
        homeGoals,
        awayGoals,
        maccabiGoals,
        opponentGoals,
        result: homeGoals === null || awayGoals === null ? "not played" : `${maccabiGoals}-${opponentGoals}`,
        duration: { minute: row.duration || "90" },
        minutePrecision: row.minutePrecision || "manual",
        lineups: {
          maccabi: {
            starters: parsePlayerList(row.starters),
            substitutes: parsePlayerList(row.substitutes)
          },
          opponent: { starters: [], substitutes: [] }
        },
        goals: parseGoals(row.goals),
        substitutions: parseSubstitutions(row.substitutions),
        dismissals: [],
        source: {
          name: row.sourceName || "Manual import",
          url: row.sourceUrl,
          ifaUrl: row.ifaUrl,
          verificationStatus: row.verificationStatus || "manual"
        },
        notes: row.notes ? [row.notes] : []
      };
    });
}

function buildDataSet(matches) {
  const now = new Date().toISOString();
  const normalizedMatches = matches.map((match) => ({
    ...match,
    dataQuality: validateMatch(match)
  }));
  return {
    schemaVersion: 1,
    generatedAt: now,
    sourcePolicy: {
      primary: "Manual import",
      notes: ["Manual imports are accepted only when every match includes a clear source URL."]
    },
    importStatus: {
      lastRunAt: now,
      source: "manual",
      matchCount: normalizedMatches.length,
      warnings: []
    },
    matches: normalizedMatches
  };
}

function parsePlayerList(value = "") {
  return String(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(\d+)\s+(.+)$/);
      const name = match ? match[2].trim() : item;
      return { id: playerId(name), number: match ? Number(match[1]) : null, name };
    });
}

function parseGoals(value = "") {
  return String(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const [minute, team, scorer] = item.split("|").map((part) => part?.trim());
      return { minute, team, scorer, sortOrder: index * 10 };
    });
}

function parseSubstitutions(value = "") {
  return String(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const [minute, playerIn, playerOut] = item.split("|").map((part) => part?.trim());
      return {
        minute,
        team: "maccabi",
        playerIn: { id: playerId(playerIn), name: playerIn },
        playerOut: { id: playerId(playerOut), name: playerOut },
        sortOrder: index * 10
      };
    });
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"" && line[index + 1] === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
