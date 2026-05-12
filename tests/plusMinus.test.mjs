import test from "node:test";
import assert from "node:assert/strict";
import { calculateMatch, calculateSeason } from "../src/calculate.mjs";

test("goal in the first minute gives starters plus one", () => {
  const result = calculateMatch(matchFixture({
    goals: [{ minute: "1", sortOrder: 1, team: "maccabi", scorer: "Starter 1" }]
  }));
  assert.equal(result.playerStats["starter-1"].plusMinus, 1);
});

test("stoppage-time goal is included for players still on the pitch", () => {
  const result = calculateMatch(matchFixture({
    duration: { minute: "90+5" },
    goals: [{ minute: "90+4", sortOrder: 1, team: "maccabi", scorer: "Starter 2" }]
  }));
  assert.equal(result.playerStats["starter-2"].plusMinus, 1);
  assert.equal(result.playerStats["starter-2"].minutes, 95);
});

test("substitution before a same-minute goal moves plus to the incoming player", () => {
  const result = calculateMatch(matchFixture({
    goals: [{ minute: "60", sortOrder: 2, team: "maccabi", scorer: "Sub 1" }],
    substitutions: [sub("60", 1, "Sub 1", "Starter 1")]
  }));
  assert.equal(result.playerStats["starter-1"].plusMinus, 0);
  assert.equal(result.playerStats["sub-1"].plusMinus, 1);
});

test("substitution after a same-minute goal keeps plus with the outgoing player", () => {
  const result = calculateMatch(matchFixture({
    goals: [{ minute: "60", sortOrder: 1, team: "maccabi", scorer: "Starter 1" }],
    substitutions: [sub("60", 2, "Sub 1", "Starter 1")]
  }));
  assert.equal(result.playerStats["starter-1"].plusMinus, 1);
  assert.equal(result.playerStats["sub-1"].plusMinus, 0);
});

test("substitute only receives scoring events after entering", () => {
  const result = calculateMatch(matchFixture({
    goals: [
      { minute: "30", sortOrder: 1, team: "maccabi", scorer: "Starter 2" },
      { minute: "70", sortOrder: 3, team: "opponent", scorer: "Opponent" }
    ],
    substitutions: [sub("60", 2, "Sub 1", "Starter 1")]
  }));
  assert.equal(result.playerStats["sub-1"].goalsForOn, 0);
  assert.equal(result.playerStats["sub-1"].goalsAgainstOn, 1);
  assert.equal(result.playerStats["sub-1"].plusMinus, -1);
});

test("subbed-off player does not receive later scoring events", () => {
  const result = calculateMatch(matchFixture({
    goals: [{ minute: "75", sortOrder: 3, team: "maccabi", scorer: "Starter 2" }],
    substitutions: [sub("60", 2, "Sub 1", "Starter 1")]
  }));
  assert.equal(result.playerStats["starter-1"].plusMinus, 0);
  assert.equal(result.playerStats["sub-1"].plusMinus, 1);
});

test("multiple goals in one match accumulate correctly", () => {
  const season = calculateSeason([
    matchFixture({
      goals: [
        { minute: "10", sortOrder: 1, team: "maccabi", scorer: "Starter 3" },
        { minute: "20", sortOrder: 2, team: "opponent", scorer: "Opponent" },
        { minute: "80", sortOrder: 4, team: "maccabi", scorer: "Sub 1" }
      ],
      substitutions: [sub("60", 3, "Sub 1", "Starter 1")]
    })
  ]);
  const starterOne = season.players.find((player) => player.playerId === "starter-1");
  const subOne = season.players.find((player) => player.playerId === "sub-1");
  assert.equal(starterOne.plusMinus, 0);
  assert.equal(subOne.plusMinus, 1);
});

test("season exposes minutes per goal rates for each player", () => {
  const season = calculateSeason([
    matchFixture({
      goals: [
        { minute: "10", sortOrder: 1, team: "maccabi", scorer: "Starter 3" },
        { minute: "40", sortOrder: 2, team: "maccabi", scorer: "Starter 4" },
        { minute: "80", sortOrder: 3, team: "opponent", scorer: "Opponent" }
      ]
    })
  ]);
  const starterOne = season.players.find((player) => player.playerId === "starter-1");

  assert.equal(starterOne.minutesPerGoalFor, 45);
  assert.equal(starterOne.minutesPerGoalAgainst, 90);
  assert.equal(starterOne.matches[0].minutesPerGoalFor, 45);
  assert.equal(starterOne.matches[0].minutesPerGoalAgainst, 90);
});

test("minutes per goal rates are null when no relevant goals happened", () => {
  const season = calculateSeason([matchFixture()]);
  const starterOne = season.players.find((player) => player.playerId === "starter-1");

  assert.equal(starterOne.minutesPerGoalFor, null);
  assert.equal(starterOne.minutesPerGoalAgainst, null);
});

function sub(minute, sortOrder, playerIn, playerOut) {
  return {
    minute,
    sortOrder,
    team: "maccabi",
    playerIn: { name: playerIn },
    playerOut: { name: playerOut }
  };
}

function matchFixture(overrides = {}) {
  const goals = overrides.goals || [];
  return {
    id: "test-match",
    date: "2026-01-01",
    status: "finished",
    homeAway: "home",
    opponent: "Opponent FC",
    homeGoals: goals.filter((goal) => goal.team === "maccabi").length,
    awayGoals: goals.filter((goal) => goal.team === "opponent").length,
    result: "test",
    duration: { minute: "90" },
    minutePrecision: "manual",
    source: { url: "https://example.test/match" },
    lineups: {
      maccabi: {
        starters: Array.from({ length: 11 }, (_, index) => ({ name: `Starter ${index + 1}` })),
        substitutes: [{ name: "Sub 1" }]
      },
      opponent: { starters: [], substitutes: [] }
    },
    substitutions: [],
    dismissals: [],
    ...overrides,
    goals
  };
}
