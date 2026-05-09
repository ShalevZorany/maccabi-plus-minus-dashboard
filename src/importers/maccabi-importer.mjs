import { playerId, playerKey } from "../players.mjs";
import {
  extractFirst,
  extractSectionByHeading,
  normalizeUrl,
  parseDateToIso,
  parseNumberMaybe,
  splitFixtureBlocks,
  stripTags
} from "./html-utils.mjs";
import { validateMatch } from "../validation.mjs";

// Primary import source:
// Maccabi Tel Aviv official first-team results and fixtures pages.
// These pages are locally fetchable and expose league, round, result, play-by-play, lineups,
// substitutions and scorer data. IFA pages are retained as manual verification URLs because
// direct local fetches currently return Cloudflare 403.
export const MACCABI_RESULTS_URL = "https://www.maccabi-tlv.co.il/en/result-fixtures/first-team/results/";
export const MACCABI_FIXTURES_URL = "https://www.maccabi-tlv.co.il/en/result-fixtures/first-team/fixtures/";
export const SOURCE_NAME = "Maccabi Tel Aviv official website";

export async function importFromMaccabi(options = {}) {
  const fetcher = options.fetcher || fetchText;
  const now = new Date().toISOString();
  const [resultsHtml, fixturesHtml] = await Promise.all([
    fetcher(MACCABI_RESULTS_URL),
    fetcher(MACCABI_FIXTURES_URL)
  ]);

  const summaries = mergeMatchSummaries([
    ...parseMatchCards(resultsHtml, "finished"),
    ...parseMatchCards(fixturesHtml, "scheduled")
  ]);

  const matches = [];
  const importWarnings = [];

  for (const summary of summaries) {
    if (summary.status !== "finished") {
      matches.push(summary);
      continue;
    }

    try {
      const [playByPlayHtml, teamsHtml] = await Promise.all([
        fetcher(summary.source.url),
        fetcher(`${summary.source.url.replace(/\/$/, "")}/teams/`)
      ]);
      const parsed = parseMatchDetails(summary, playByPlayHtml, teamsHtml);
      matches.push(parsed);
    } catch (error) {
      importWarnings.push(`Failed to import details for ${summary.id}: ${error.message}`);
      matches.push({
        ...summary,
        importError: error.message,
        dataQuality: {
          errors: [error.message],
          warnings: ["Match details could not be fetched; excluded from calculations."]
        }
      });
    }
  }

  const completeMatches = matches.map((match) => ({
    ...match,
    dataQuality: validateMatch(match)
  }));

  return {
    schemaVersion: 1,
    generatedAt: now,
    sourcePolicy: {
      primary: SOURCE_NAME,
      primaryUrl: MACCABI_RESULTS_URL,
      verification: "Israel Football Association match pages, manually attached per match when reviewed.",
      notes: [
        "Maccabi pages are used for automated import because they are locally fetchable.",
        "IFA pages are authoritative but direct Node/curl fetches may be blocked by Cloudflare.",
        "No missing lineup, substitution, or goal data is inferred silently."
      ]
    },
    importStatus: {
      lastRunAt: now,
      source: SOURCE_NAME,
      warnings: importWarnings,
      matchCount: completeMatches.length
    },
    matches: completeMatches
  };
}

export function parseMatchCards(html, mode = "finished") {
  return splitFixtureBlocks(html)
    .filter((block) => block.includes("filter-league40"))
    .map((block) => parseMatchCard(block, mode))
    .filter(Boolean);
}

export function parseMatchCard(block, mode = "finished") {
  const sourceUrl = normalizeUrl(extractFirst(block, /<a href="([^"]+)"/));
  if (!sourceUrl || !sourceUrl.includes("/en/match/")) return null;

  const leagueTitle = stripTags(extractFirst(block, /<div class="league-title">([\s\S]*?)<\/div>/));
  if (leagueTitle !== "Israeli Premier League") return null;

  const roundText = stripTags(extractFirst(block, /<div class="round">([\s\S]*?)<\/div>/));
  const round = Number((roundText.match(/\d+/) || [null])[0]);
  const homeAway = extractFirst(block, /<div class="matchresult\s+(Home|Away)"/) || "unknown";
  const maccabiName = stripTags(extractFirst(block, /<div class="holder maccabi nn">([\s\S]*?)<\/div>/)) || "Maccabi Tel Aviv";
  const opponent = stripTags(extractFirst(block, /<div class="holder notmaccabi nn">([\s\S]*?)<\/div>/));
  const maccabiScore = parseNumberMaybe(extractFirst(block, /<span class="ss[^"]*maccabi[^"]*">([\s\S]*?)<\/span>/));
  const scoreTexts = [...block.matchAll(/<span class="ss[^"]*">([\s\S]*?)<\/span>/g)].map((match) => parseNumberMaybe(match[1]));
  const opponentScore = scoreTexts.find((score) => score !== null && score !== maccabiScore) ?? (scoreTexts.length > 1 ? scoreTexts[1] : null);
  const date = parseDateToIso(extractFirst(block, /<div class="location">[\s\S]*?<span>([\s\S]*?)<\/span>/));
  const locationText = stripTags(extractFirst(block, /<div class="location">[\s\S]*?<div>([\s\S]*?)<\/div>/));
  const locationMatch = locationText.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
  const time = locationMatch ? locationMatch[1] : "";
  const stadium = locationMatch ? locationMatch[2].trim() : locationText;
  const id = `maccabi-${sourceUrl.split("/match/")[1].replace(/\//g, "")}`;
  const isFinished = maccabiScore !== null && opponentScore !== null && mode === "finished";
  const maccabiHome = homeAway === "Home";

  return {
    id,
    season: "2025/2026",
    competition: "Israeli Premier League",
    round,
    date,
    time,
    stadium,
    status: isFinished ? "finished" : "scheduled",
    homeAway: maccabiHome ? "home" : "away",
    homeTeam: maccabiHome ? maccabiName : opponent,
    awayTeam: maccabiHome ? opponent : maccabiName,
    opponent,
    maccabiGoals: isFinished ? maccabiScore : null,
    opponentGoals: isFinished ? opponentScore : null,
    homeGoals: isFinished ? (maccabiHome ? maccabiScore : opponentScore) : null,
    awayGoals: isFinished ? (maccabiHome ? opponentScore : maccabiScore) : null,
    result: isFinished ? `${maccabiScore}-${opponentScore}` : "not played",
    duration: { minute: "90" },
    minutePrecision: "base-minute",
    lineups: { maccabi: { starters: [], substitutes: [] }, opponent: { starters: [], substitutes: [] } },
    substitutions: [],
    dismissals: [],
    goals: [],
    source: {
      name: SOURCE_NAME,
      url: sourceUrl,
      importedAt: new Date().toISOString(),
      ifaUrl: "",
      verificationStatus: "not-reviewed"
    },
    notes: mode === "scheduled" ? ["Future/unplayed match imported from fixtures page."] : []
  };
}

export function parseMatchDetails(summary, playByPlayHtml, teamsHtml) {
  const lineups = parseLineups(teamsHtml, summary.opponent);
  const roster = buildRoster(lineups);
  const scoreboardGoals = parseScoreboardGoals(playByPlayHtml);
  const events = parsePlayByPlayEvents(playByPlayHtml, roster, scoreboardGoals);
  const goals = events.filter((event) => event.type === "goal").map(({ type, ...goal }) => goal);
  const substitutions = events.filter((event) => event.type === "substitution").map(({ type, ...substitution }) => substitution);
  const dismissals = events.filter((event) => event.type === "dismissal").map(({ type, ...dismissal }) => dismissal);

  return {
    ...summary,
    lineups,
    goals,
    substitutions,
    dismissals,
    source: {
      ...summary.source,
      detailsUrl: summary.source.url,
      lineupsUrl: `${summary.source.url.replace(/\/$/, "")}/teams/`
    }
  };
}

export function parseLineups(html, opponentName) {
  return {
    maccabi: {
      starters: parsePlayerSection(extractSectionByHeading(html, "Maccabi Tel Aviv")),
      substitutes: parsePlayerSection(extractSectionByHeading(html, "Maccabi Tel Aviv (Substitute)"))
    },
    opponent: {
      starters: parsePlayerSection(extractSectionByHeading(html, opponentName)),
      substitutes: parsePlayerSection(extractSectionByHeading(html, `${opponentName} (Substitute)`))
    }
  };
}

export function parsePlayerSection(sectionHtml) {
  const players = [];
  const regex = /<li>\s*<b>(\d+)<\/b>([\s\S]*?)<\/li>/g;
  let match;
  while ((match = regex.exec(sectionHtml))) {
    const number = Number(match[1]);
    const body = match[2];
    const nameHtml = body.split(/<div class="icons team-players/i)[0];
    const name = stripTags(nameHtml);
    if (!name || name === "Player") continue;

    players.push({
      id: playerId(name),
      number,
      name,
      sourceEvents: {
        goals: stripTags(extractFirst(body, /id="[^"]+-goal"[^>]*>([\s\S]*?)<\/div>/)),
        exchange: stripTags(extractFirst(body, /id="[^"]+-exchange"[^>]*>([\s\S]*?)<\/div>/)),
        cards: stripTags(extractFirst(body, /id="[^"]+-red"[^>]*>([\s\S]*?)<\/div>/))
      }
    });
  }
  return players;
}

export function parsePlayByPlayEvents(html, roster, scoreboardGoals = []) {
  const eventHtml = [...html.matchAll(/<li class="([^"]*)">([\s\S]*?)<\/li>/g)]
    .map((match, index) => ({ classes: match[1], body: match[2], sourceIndex: index }))
    .filter((event) => /(^|\s)(goal|sub|red)(\s|$)/.test(event.classes));
  const chronological = eventHtml.reverse();

  return chronological
    .map((event, index) => parsePlayByPlayEvent(event, index, roster, scoreboardGoals))
    .filter(Boolean);
}

export function parseScoreboardGoals(html) {
  const containers = [
    { team: "maccabi", html: extractFirst(html, /id="maccabi_score_players"[^>]*>([\s\S]*?)<\/div>/) },
    { team: "opponent", html: extractFirst(html, /id="not-maccabi_score_players"[^>]*>([\s\S]*?)<\/div>/) }
  ];
  const goals = [];
  for (const container of containers) {
    const text = stripTags(container.html.replace(/<br\s*\/?>/gi, "\n"));
    const regex = /([^()\n]*?)\s*\((\d{1,3}(?:\+\d{1,2})?)\)/g;
    let match;
    while ((match = regex.exec(text))) {
      goals.push({
        team: container.team,
        scorer: stripTags(match[1]) || "Unknown scorer (source blank)",
        minute: match[2]
      });
    }
  }
  return goals;
}

function parsePlayByPlayEvent(event, chronologicalIndex, roster, scoreboardGoals) {
  const minute = stripTags(extractFirst(event.body, /<div class="min">([\s\S]*?)<\/div>/));
  const text = stripTags(extractFirst(event.body, /<p>([\s\S]*?)<\/p>/));
  const sortOrder = chronologicalIndex * 10;

  if (event.classes.includes("goal")) {
    const scorerSource = stripTags((text.match(/Goal scored by player\s+(.+)$/i) || [null, ""])[1]);
    const scorerForMatching = cleanScorerName(scorerSource);
    const scoreboardGoal = findScoreboardGoal(scoreboardGoals, minute, scorerForMatching);
    const scorer = scorerSource || scoreboardGoal?.scorer || "Unknown scorer (source blank)";
    return {
      type: "goal",
      minute,
      sortOrder,
      team: teamForPlayer(scorerForMatching, roster) !== "unknown"
        ? teamForPlayer(scorerForMatching, roster)
        : scoreboardGoal?.team || "unknown",
      scorer,
      ownGoal: false
    };
  }

  if (event.classes.includes("sub")) {
    const match = text.match(/Substitution\s+(.+?)\s+by\s+(.+)$/i);
    if (!match) return null;
    const playerIn = stripTags(match[1]);
    const playerOut = stripTags(match[2]);
    return {
      type: "substitution",
      minute,
      sortOrder,
      team: teamForSubstitution(playerIn, playerOut, roster),
      playerIn: { id: playerId(playerIn), name: playerIn },
      playerOut: { id: playerId(playerOut), name: playerOut }
    };
  }

  if (event.classes.includes("red")) {
    const player = stripTags((text.match(/Red card to\s+(.+)$/i) || [null, ""])[1]);
    return {
      type: "dismissal",
      minute,
      sortOrder,
      team: teamForPlayer(player, roster),
      player: { id: playerId(player), name: player },
      reason: "red-card"
    };
  }

  return null;
}

function cleanScorerName(name) {
  return stripTags(name).replace(/\s*\((Penalty|Own goal|OG)\)\s*$/i, "").trim();
}

function findScoreboardGoal(scoreboardGoals, minute, scorerForMatching) {
  const sameMinute = scoreboardGoals.filter((goal) => String(goal.minute) === String(minute));
  if (!sameMinute.length) return null;
  if (scorerForMatching) {
    const exact = sameMinute.find((goal) => playerKey(goal.scorer) === playerKey(scorerForMatching));
    if (exact) return exact;
  }
  return sameMinute.length === 1 ? sameMinute[0] : null;
}

function buildRoster(lineups) {
  const maccabi = new Set([...lineups.maccabi.starters, ...lineups.maccabi.substitutes].map((player) => playerKey(player.name)));
  const opponent = new Set([...lineups.opponent.starters, ...lineups.opponent.substitutes].map((player) => playerKey(player.name)));
  return { maccabi, opponent };
}

function teamForPlayer(name, roster) {
  const key = playerKey(name);
  if (roster.maccabi.has(key)) return "maccabi";
  if (roster.opponent.has(key)) return "opponent";
  return "unknown";
}

function teamForSubstitution(playerIn, playerOut, roster) {
  const inTeam = teamForPlayer(playerIn, roster);
  const outTeam = teamForPlayer(playerOut, roster);
  if (inTeam === outTeam) return inTeam;
  if (inTeam !== "unknown") return inTeam;
  return outTeam;
}

function mergeMatchSummaries(matches) {
  const byUrl = new Map();
  for (const match of matches) {
    const key = match.source.url;
    const existing = byUrl.get(key);
    if (!existing || existing.status !== "finished") byUrl.set(key, match);
  }
  return [...byUrl.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.round || 0) - (b.round || 0);
  });
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "maccabicheck/1.0 local data import"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
