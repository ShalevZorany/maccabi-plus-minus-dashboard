import test from "node:test";
import assert from "node:assert/strict";
import { parseLineups, parseMatchCard, parsePlayByPlayEvents } from "../src/importers/maccabi-importer.mjs";

test("parses a Maccabi league fixture card", () => {
  const card = parseMatchCard(`
    <div class="fixtures-holder filter-homeaway filter-home filter-league filter-league40">
      <a href="https://www.maccabi-tlv.co.il/en/match/2026-05-maccabi-tel-aviv-3/">
        <div class="league-title">Israeli Premier League</div>
        <div class="round">Round 31</div>
        <div class="matchresult Home">
          <div class="holder maccabi nn">Maccabi Tel Aviv</div>
          <div class="holder split"><span class="ss maccabi h">4</span>-<span class="ss h">0</span></div>
          <div class="holder notmaccabi nn">Hapoel Petach Tikva</div>
        </div>
        <div class="location"><span>05 May 2026</span><div>19:30 Bloomfield</div></div>
      </a>
    </div>
  `);

  assert.equal(card.status, "finished");
  assert.equal(card.date, "2026-05-05");
  assert.equal(card.homeAway, "home");
  assert.equal(card.maccabiGoals, 4);
  assert.equal(card.opponent, "Hapoel Petach Tikva");
});

test("parses lineups and play-by-play substitutions", () => {
  const lineups = parseLineups(`
    <h3>Maccabi Tel Aviv</h3>
    <ul>
      <li><b>1</b>Starter One <div class="icons team-players goals" id="a-goal"></div><div class="icons team-players" id="a-exchange">60'</div><div class="icons team-players" id="a-red"></div></li>
      <li><b>2</b>Starter Two <div class="icons team-players goals" id="b-goal">10'</div><div class="icons team-players" id="b-exchange"></div><div class="icons team-players" id="b-red"></div></li>
    </ul>
    <h3>Opponent FC</h3><ul><li><b>9</b>Opponent Scorer <div class="icons team-players goals" id="c-goal"></div><div class="icons team-players" id="c-exchange"></div><div class="icons team-players" id="c-red"></div></li></ul>
    <h3>Maccabi Tel Aviv (Substitute)</h3>
    <ul><li><b>12</b>Sub One <div class="icons team-players goals" id="d-goal"></div><div class="icons team-players" id="d-exchange">60'</div><div class="icons team-players" id="d-red"></div></li></ul>
    <h3>Opponent FC (Substitute)</h3><ul></ul>
  `, "Opponent FC");

  const roster = {
    maccabi: new Set(["starter one", "starter two", "sub one"]),
    opponent: new Set(["opponent scorer"])
  };
  const events = parsePlayByPlayEvents(`
    <li class="goal en"><div class="min">70</div><p>Goal scored by player Sub One</p></li>
    <li class="sub en"><div class="min">60</div><p>Substitution Sub One by Starter One</p></li>
    <li class="goal en"><div class="min">10</div><p>Goal scored by player Starter Two</p></li>
  `, roster);

  assert.equal(lineups.maccabi.starters.length, 2);
  assert.equal(lineups.maccabi.substitutes[0].name, "Sub One");
  assert.equal(events[1].type, "substitution");
  assert.equal(events[1].team, "maccabi");
  assert.equal(events[2].scorer, "Sub One");
});
