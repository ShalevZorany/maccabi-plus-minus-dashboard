import { parseMinute } from "./minutes.mjs";

export function validateDataSet(data) {
  const matches = data?.matches || [];
  return {
    matches: matches.map((match) => ({ matchId: match.id, ...validateMatch(match) })),
    totals: {
      matches: matches.length,
      finished: matches.filter((match) => match.status === "finished").length
    }
  };
}

export function validateMatch(match) {
  const errors = [];
  const warnings = [];

  if (!match?.id) errors.push("Missing match id.");
  if (!match?.date) warnings.push("Missing match date.");
  if (!match?.source?.url) warnings.push("Missing source URL.");

  if (match?.status !== "finished") {
    return {
      completeForCalculation: false,
      errors,
      warnings: [...warnings, "Match is not finished, so it is excluded from plus/minus calculations."]
    };
  }

  const starters = match.lineups?.maccabi?.starters || [];
  if (starters.length !== 11) {
    errors.push(`Expected 11 Maccabi starters, got ${starters.length}.`);
  }

  const scoreTotal = Number(match.homeGoals ?? 0) + Number(match.awayGoals ?? 0);
  const goals = match.goals || [];
  if (Number.isFinite(scoreTotal) && goals.length !== scoreTotal) {
    errors.push(`Goal timeline count (${goals.length}) does not match final score total (${scoreTotal}).`);
  }

  for (const goal of goals) {
    if (!parseMinute(goal.minute)) errors.push(`Goal by "${goal.scorer || "unknown"}" has an invalid minute.`);
    if (!["maccabi", "opponent"].includes(goal.team)) errors.push(`Goal by "${goal.scorer || "unknown"}" has an unknown team.`);
    if (!goal.scorer || String(goal.scorer).includes("Unknown scorer")) {
      warnings.push(`Goal at minute ${goal.minute} has no scorer name in the source.`);
    }
  }

  for (const substitution of match.substitutions || []) {
    if (!parseMinute(substitution.minute)) warnings.push(`Substitution has invalid minute: ${substitution.minute}.`);
    if (substitution.team === "maccabi" && (!substitution.playerIn?.name || !substitution.playerOut?.name)) {
      errors.push("Maccabi substitution is missing playerIn or playerOut.");
    }
  }

  const sameMinuteGoalSub = new Set((match.goals || []).map((goal) => String(goal.minute)));
  for (const substitution of match.substitutions || []) {
    if (sameMinuteGoalSub.has(String(substitution.minute))) {
      warnings.push(`Goal and substitution share minute ${substitution.minute}; source event order is used.`);
    }
  }

  if (match.minutePrecision === "base-minute") {
    warnings.push("Source stores stoppage-time events as base minutes only, e.g. 45 or 90.");
  }

  return {
    completeForCalculation: errors.length === 0,
    errors,
    warnings
  };
}
