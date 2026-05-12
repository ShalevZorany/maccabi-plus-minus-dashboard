import { compareEventKeys, eventKey, isKeyWithinInterval, maxMinute, minuteDisplay, parseMinute } from "./minutes.mjs";
import { normalizeName, playerFrom, playerId, playerKey } from "./players.mjs";
import { validateMatch } from "./validation.mjs";

const START_KEY = { elapsed: 0, order: Number.NEGATIVE_INFINITY };

export function calculateSeason(matches = []) {
  const matchCalculations = matches.map((match) => calculateMatch(match));
  const playersById = new Map();

  for (const matchResult of matchCalculations) {
    if (!matchResult.completeForCalculation) continue;

    for (const stat of Object.values(matchResult.playerStats)) {
      const existing = playersById.get(stat.playerId) || {
        playerId: stat.playerId,
        name: stat.name,
        minutes: 0,
        appearances: 0,
        starts: 0,
        substituteAppearances: 0,
        goalsForOn: 0,
        goalsAgainstOn: 0,
        plusMinus: 0,
        matches: []
      };

      existing.minutes += stat.minutes;
      existing.appearances += stat.appeared ? 1 : 0;
      existing.starts += stat.started ? 1 : 0;
      existing.substituteAppearances += stat.substituteAppearance ? 1 : 0;
      existing.goalsForOn += stat.goalsForOn;
      existing.goalsAgainstOn += stat.goalsAgainstOn;
      existing.plusMinus += stat.plusMinus;
      existing.matches.push(stat.match);
      playersById.set(stat.playerId, existing);
    }
  }

  const players = [...playersById.values()].sort((a, b) => {
    if (b.plusMinus !== a.plusMinus) return b.plusMinus - a.plusMinus;
    if (b.minutes !== a.minutes) return b.minutes - a.minutes;
    return a.name.localeCompare(b.name);
  });

  for (const player of players) {
    addRateStats(player);
  }

  return {
    players,
    matches: matchCalculations,
    totals: {
      matches: matches.length,
      finished: matches.filter((match) => match.status === "finished").length,
      complete: matchCalculations.filter((match) => match.completeForCalculation).length,
      players: players.length
    }
  };
}

export function calculateMatch(match) {
  const validation = validateMatch(match);
  const duration = resolveDuration(match);
  const intervals = buildIntervals(match, duration);
  const goals = (match.goals || []).map((goal, index) => ({
    ...goal,
    minuteDisplay: minuteDisplay(goal.minute),
    key: eventKey(goal, index * 10)
  }));

  const goalImpacts = goals.map((goal) => {
    const delta = goal.team === "maccabi" ? 1 : -1;
    const affected = intervals
      .filter((interval) => isKeyWithinInterval(goal.key, interval.startKey, interval.endKey))
      .map((interval) => ({
        playerId: interval.playerId,
        name: interval.name,
        delta
      }));

    return {
      goal: {
        minute: goal.minute,
        minuteDisplay: goal.minuteDisplay,
        team: goal.team,
        scorer: goal.scorer,
        ownGoal: Boolean(goal.ownGoal)
      },
      affected
    };
  });

  const playerStats = {};
  for (const interval of intervals) {
    const id = interval.playerId;
    playerStats[id] ||= {
      playerId: id,
      name: interval.name,
      minutes: 0,
      appeared: false,
      started: false,
      substituteAppearance: false,
      goalsForOn: 0,
      goalsAgainstOn: 0,
      plusMinus: 0,
      intervals: [],
      affectingGoals: []
    };

    playerStats[id].minutes += interval.minutes;
    playerStats[id].appeared = playerStats[id].appeared || interval.minutes > 0;
    playerStats[id].started = playerStats[id].started || interval.role === "starter";
    playerStats[id].substituteAppearance = playerStats[id].substituteAppearance || interval.role === "substitute";
    playerStats[id].intervals.push({
      start: interval.startDisplay,
      end: interval.endDisplay,
      role: interval.role,
      exitReason: interval.exitReason
    });
  }

  for (const impact of goalImpacts) {
    for (const affected of impact.affected) {
      const stat = playerStats[affected.playerId];
      if (!stat) continue;
      if (affected.delta > 0) stat.goalsForOn += 1;
      if (affected.delta < 0) stat.goalsAgainstOn += 1;
      stat.plusMinus += affected.delta;
      stat.affectingGoals.push({
        minute: impact.goal.minuteDisplay,
        scorer: impact.goal.scorer,
        team: impact.goal.team,
        delta: affected.delta
      });
    }
  }

  for (const stat of Object.values(playerStats)) {
    addRateStats(stat);
    stat.match = {
      matchId: match.id,
      date: match.date,
      opponent: match.opponent,
      homeAway: match.homeAway,
      result: match.result,
      minutes: stat.minutes,
      plusMinus: stat.plusMinus,
      goalsForOn: stat.goalsForOn,
      goalsAgainstOn: stat.goalsAgainstOn,
      minutesPerGoalFor: stat.minutesPerGoalFor,
      minutesPerGoalAgainst: stat.minutesPerGoalAgainst,
      intervals: stat.intervals,
      affectingGoals: stat.affectingGoals
    };
  }

  return {
    matchId: match.id,
    date: match.date,
    round: match.round,
    opponent: match.opponent,
    homeAway: match.homeAway,
    result: match.result,
    status: match.status,
    source: match.source,
    minutePrecision: match.minutePrecision,
    completeForCalculation: validation.completeForCalculation,
    validation,
    duration,
    intervals,
    goals: goals.map(({ key, ...goal }) => goal),
    goalImpacts,
    playerStats
  };
}

export function buildIntervals(match, duration = resolveDuration(match)) {
  const starters = (match.lineups?.maccabi?.starters || []).map(playerFrom).filter((player) => player.name);
  const substitutions = (match.substitutions || [])
    .filter((substitution) => substitution.team === "maccabi")
    .map((substitution, index) => ({
      type: "substitution",
      minute: substitution.minute,
      key: eventKey(substitution, index * 10),
      playerIn: playerFrom(substitution.playerIn),
      playerOut: playerFrom(substitution.playerOut)
    }));
  const dismissals = (match.dismissals || [])
    .filter((dismissal) => dismissal.team === "maccabi")
    .map((dismissal, index) => ({
      type: "dismissal",
      minute: dismissal.minute,
      key: eventKey(dismissal, index * 10 + 5),
      player: playerFrom(dismissal.player),
      reason: dismissal.reason || "red-card"
    }));
  const events = [...substitutions, ...dismissals].sort((a, b) => compareEventKeys(a.key, b.key));
  const open = new Map();
  const intervals = [];

  for (const starter of starters) {
    open.set(playerKey(starter.name), {
      player: starter,
      role: "starter",
      startMinute: "0",
      startDisplay: "0",
      startKey: START_KEY
    });
  }

  for (const event of events) {
    if (event.type === "substitution") {
      closeInterval(open, intervals, event.playerOut.name, event.minute, event.key, "substitution");
      open.set(playerKey(event.playerIn.name), {
        player: event.playerIn,
        role: "substitute",
        startMinute: event.minute,
        startDisplay: minuteDisplay(event.minute),
        startKey: event.key
      });
    }

    if (event.type === "dismissal") {
      closeInterval(open, intervals, event.player.name, event.minute, event.key, event.reason);
    }
  }

  const endKey = { elapsed: duration.elapsed, order: Number.POSITIVE_INFINITY };
  for (const interval of open.values()) {
    pushInterval(intervals, interval, duration.display, endKey, "full-time");
  }

  return intervals.sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return compareEventKeys(a.startKey, b.startKey);
  });
}

function closeInterval(open, intervals, playerName, endMinute, endKey, reason) {
  const key = playerKey(playerName);
  const interval = open.get(key);
  if (!interval) return;
  pushInterval(intervals, interval, minuteDisplay(endMinute), endKey, reason);
  open.delete(key);
}

function pushInterval(intervals, interval, endDisplay, endKey, exitReason) {
  const startElapsed = interval.startKey.elapsed;
  const minutes = Math.max(0, Math.round((endKey.elapsed - startElapsed) * 100) / 100);
  intervals.push({
    playerId: interval.player.id || playerId(interval.player.name),
    name: normalizeName(interval.player.name),
    number: interval.player.number,
    role: interval.role,
    startMinute: interval.startMinute,
    startDisplay: interval.startDisplay,
    startKey: interval.startKey,
    endDisplay,
    endKey,
    exitReason,
    minutes
  });
}

function addRateStats(stat) {
  stat.minutesPerGoalFor = minutesPerGoal(stat.minutes, stat.goalsForOn);
  stat.minutesPerGoalAgainst = minutesPerGoal(stat.minutes, stat.goalsAgainstOn);
}

function minutesPerGoal(minutes, goals) {
  if (!goals) return null;
  return Math.round((minutes / goals) * 10) / 10;
}

function resolveDuration(match) {
  const explicit = parseMinute(match.duration?.minute || match.duration);
  const maxElapsed = maxMinute(
    explicit?.display,
    ...(match.goals || []).map((goal) => goal.minute),
    ...(match.substitutions || []).map((substitution) => substitution.minute),
    ...(match.dismissals || []).map((dismissal) => dismissal.minute)
  );
  const elapsed = Math.max(explicit?.elapsed || 90, maxElapsed, 90);
  return {
    display: explicit?.display || String(elapsed),
    elapsed
  };
}
