const state = {
  dashboard: null,
  route: "players",
  selectedPlayer: null,
  playerSort: {
    key: "plusMinus",
    direction: "desc"
  },
  filters: {
    player: "",
    opponent: "",
    homeAway: "",
    fromDate: "",
    toDate: "",
    role: ""
  }
};

const view = document.querySelector("#view");
const tabs = [...document.querySelectorAll(".tab")];
const qualityPanel = document.querySelector("#qualityPanel");
const heroMetric = document.querySelector("#heroMetric");
const heroSubMetric = document.querySelector("#heroSubMetric");
const refreshButton = document.querySelector("#refreshData");
const manualFileInput = document.querySelector("#manualFile");
const manualImportLabel = manualFileInput.closest("label");
const playerSortColumns = {
  minutes: "דקות",
  appearances: "משחקים",
  goalsForOn: "שערי מכבי איתו",
  goalsAgainstOn: "שערים שספגה איתו",
  minutesPerGoalFor: "דק׳ לשער זכות",
  minutesPerGoalAgainst: "דק׳ לשער חובה",
  plusMinus: "פלוס/מינוס"
};
const playerSortDefaultDirections = {
  minutesPerGoalFor: "asc",
  minutesPerGoalAgainst: "desc"
};

refreshButton.addEventListener("click", refreshData);
manualFileInput.addEventListener("change", importManualFile);
view.addEventListener("click", handleViewClick);

for (const [key, selector] of [
  ["player", "#playerFilter"],
  ["opponent", "#opponentFilter"],
  ["homeAway", "#homeAwayFilter"],
  ["fromDate", "#fromDateFilter"],
  ["toDate", "#toDateFilter"],
  ["role", "#roleFilter"]
]) {
  document.querySelector(selector).addEventListener("input", (event) => {
    state.filters[key] = event.target.value;
    render();
  });
}

window.addEventListener("hashchange", applyRoute);
await loadDashboard();
applyRoute();

async function loadDashboard() {
  view.innerHTML = "<div class=\"empty-state\"><h2>טוען נתונים...</h2></div>";
  state.dashboard = await fetchJson("/api/dashboard");
  configureImportControls();
  updateHero();
  renderQualityStrip();
}

function configureImportControls() {
  const importPolicy = state.dashboard?.importPolicy || {};
  const autoRefresh = importPolicy.autoRefresh === true;
  const manualImportEnabled = importPolicy.manualImportEnabled !== false;
  const message = importPolicy.message || "";
  const showActions = !autoRefresh || manualImportEnabled;

  refreshButton.disabled = !manualImportEnabled;
  manualFileInput.disabled = !manualImportEnabled;
  manualImportLabel.style.display = manualImportEnabled ? "" : "none";
  refreshButton.style.display = manualImportEnabled ? "" : "none";
  const heroActions = document.querySelector(".hero__actions");
  heroActions.style.display = showActions ? "" : "none";

  refreshButton.textContent = autoRefresh ? "עדכון אוטומטי פעיל" : "רענון נתונים מאתר מכבי";
  refreshButton.title = message;
  manualImportLabel.title = message;
}

async function refreshData() {
  if (state.dashboard?.importPolicy?.manualImportEnabled === false) {
    alert(state.dashboard.importPolicy.message || "עדכון אוטומטי כבר פעיל.");
    return;
  }

  refreshButton.disabled = true;
  refreshButton.textContent = "מרענן...";
  try {
    await fetchJson("/api/import/refresh", { method: "POST" });
    await loadDashboard();
    render();
  } catch (error) {
    alert(`ייבוא נכשל: ${error.message}`);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "רענון נתונים מאתר מכבי";
  }
}

async function importManualFile(event) {
  if (state.dashboard?.importPolicy?.manualImportEnabled === false) {
    alert(state.dashboard.importPolicy.message || "ייבוא ידני כבוי במצב עדכון אוטומטי.");
    event.target.value = "";
    return;
  }

  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  const contentType = file.name.endsWith(".csv") ? "text/csv" : "application/json";

  try {
    await fetchJson("/api/import/manual", {
      method: "POST",
      headers: { "content-type": contentType },
      body: contentType === "application/json" ? text : text
    });
    await loadDashboard();
    render();
  } catch (error) {
    alert(`ייבוא ידני נכשל: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function applyRoute() {
  const hash = location.hash.replace(/^#/, "") || "players";
  const [route, id] = hash.split("/");
  state.route = route;
  state.selectedPlayer = id || null;
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.route === route));
  render();
}

function updateHero() {
  const totals = state.dashboard?.totals;
  if (!totals?.matches) {
    heroMetric.textContent = "אין נתונים";
    heroSubMetric.textContent = state.dashboard?.importPolicy?.message || "לא התקבלו נתונים כרגע";
    return;
  }
  heroMetric.textContent = `${totals.complete}/${totals.finished}`;
  heroSubMetric.textContent = "משחקים כשירים מתוך משחקים שהסתיימו";
}

function renderQualityStrip() {
  const dashboard = state.dashboard;
  const warnings = dashboard?.importStatus?.warnings || [];
  const incomplete = (dashboard?.matches || []).filter((match) => match.status === "finished" && !match.completeForCalculation);
  const source = dashboard?.sourcePolicy?.primary || "לא הוגדר מקור";
  const lastRun = dashboard?.importStatus?.lastRunAt ? formatDateTime(dashboard.importStatus.lastRunAt) : "לא בוצע ייבוא";
  const importPolicy = dashboard?.importPolicy || {};
  const mode = importPolicy.autoRefresh ? "אוטומטי בכל טעינה" : "ייבוא ידני";
  const modeMessage = importPolicy.message ? `<br><strong>מדיניות ייבוא:</strong> ${escapeHtml(importPolicy.message)}` : "";

  qualityPanel.innerHTML = `
    <div class="notice ${incomplete.length || warnings.length ? "notice--warn" : "notice--ok"}">
      <strong>מקור נתונים:</strong> ${escapeHtml(source)} ·
      <strong>ייבוא אחרון:</strong> ${escapeHtml(lastRun)} ·
      <strong>מצב ייבוא:</strong> ${escapeHtml(mode)} ·
      <strong>משחקים לא כשירים:</strong> ${incomplete.length}
      ${modeMessage}
    </div>
  `;
}

function render() {
  if (!state.dashboard) return;

  if (!state.dashboard.matches.length) {
    view.innerHTML = document.querySelector("#emptyStateTemplate").innerHTML;
    return;
  }

  if (state.route === "matches") renderMatches();
  else if (state.route === "quality") renderQuality();
  else if (state.route === "player" && state.selectedPlayer) renderPlayer(state.selectedPlayer);
  else renderPlayers();
}

function renderPlayers() {
  const players = filteredPlayers();
  const sortLabel = playerSortColumns[state.playerSort.key] || playerSortColumns.plusMinus;
  const sortDirection = state.playerSort.direction === "asc" ? "מהנמוך לגבוה" : "מהגבוה לנמוך";
  view.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <div>
          <h2>טבלת שחקנים</h2>
          <span class="badge">מיון: ${escapeHtml(sortLabel)} · ${sortDirection}</span>
        </div>
        <span class="badge">${players.length} שחקנים</span>
      </div>
      <div class="table-wrap">
        <table class="players-table">
          <thead>
            <tr>
              <th>שחקן</th>
              ${renderPlayerSortHeader("minutes")}
              ${renderPlayerSortHeader("appearances")}
              ${renderPlayerSortHeader("goalsForOn")}
              ${renderPlayerSortHeader("goalsAgainstOn")}
              ${renderPlayerSortHeader("minutesPerGoalFor")}
              ${renderPlayerSortHeader("minutesPerGoalAgainst")}
              ${renderPlayerSortHeader("plusMinus")}
            </tr>
          </thead>
          <tbody>
            ${players.map(renderPlayerRow).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPlayerSortHeader(key) {
  const label = playerSortColumns[key];
  const isActive = state.playerSort.key === key;
  const direction = state.playerSort.direction;
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";
  const visibleDirection = direction === "asc" ? "↑" : "↓";
  const directionLabel = direction === "asc" ? "עולה" : "יורד";
  const nextDirectionLabel = isActive && direction === "desc" ? "עולה" : "יורד";

  return `
    <th aria-sort="${ariaSort}">
      <button
        type="button"
        class="sort-button ${isActive ? "is-active" : ""}"
        data-player-sort="${escapeAttribute(key)}"
        aria-label="${escapeAttribute(`${label}: ${isActive ? `מיון פעיל ${directionLabel}. ` : ""}לחיצה תמיין ${nextDirectionLabel}`)}"
      >
        ${escapeHtml(label)}${isActive ? ` <span aria-hidden="true">${visibleDirection}</span>` : ""}
      </button>
    </th>
  `;
}

function renderPlayerRow(player) {
  return `
    <tr>
      <td><button class="player-link" onclick="location.hash='player/${player.playerId}'">${escapeHtml(player.name)}</button></td>
      <td class="numeric">${Math.round(player.minutes)}</td>
      <td class="numeric">${player.appearances}</td>
      <td class="numeric">${player.goalsForOn}</td>
      <td class="numeric">${player.goalsAgainstOn}</td>
      <td class="numeric">${formatMinutesPerGoal(player.minutesPerGoalFor)}</td>
      <td class="numeric">${formatMinutesPerGoal(player.minutesPerGoalAgainst)}</td>
      <td class="numeric ${player.plusMinus >= 0 ? "plus" : "minus"}">${formatSigned(player.plusMinus)}</td>
    </tr>
  `;
}

function renderMatches() {
  const matches = filteredMatches();
  view.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <h2>משחקים</h2>
        <span class="badge">${matches.length} משחקים</span>
      </div>
      ${matches.map(renderMatchCard).join("")}
    </section>
  `;
}

function renderMatchCard(match) {
  const quality = match.completeForCalculation
    ? "<span class=\"badge badge--ok\">כשיר לחישוב</span>"
    : match.status === "finished"
      ? "<span class=\"badge badge--bad\">דורש בדיקה</span>"
      : "<span class=\"badge badge--warn\">עתידי</span>";
  const goals = match.goals?.map((goal) => `<li>${escapeHtml(goal.minuteDisplay || goal.minute)} · ${teamLabel(goal.team)} · ${escapeHtml(goal.scorer || "")}</li>`).join("") || "";
  const starters = match.intervals
    ?.filter((interval) => interval.role === "starter")
    .map((interval) => `<li>${escapeHtml(interval.name)} · ${escapeHtml(interval.startDisplay)}-${escapeHtml(interval.endDisplay)}</li>`)
    .join("") || "";
  const subs = match.intervals
    ?.filter((interval) => interval.role === "substitute")
    .map((interval) => `<li>${escapeHtml(interval.name)} · נכנס ${escapeHtml(interval.startDisplay)} · עד ${escapeHtml(interval.endDisplay)}</li>`)
    .join("") || "";
  const impacts = match.goalImpacts
    ?.map((impact) => {
      const sign = impact.goal.team === "maccabi" ? "+1" : "-1";
      return `<li>${escapeHtml(impact.goal.minuteDisplay)} ${escapeHtml(impact.goal.scorer || "")}: ${impact.affected.length} שחקנים קיבלו ${sign}</li>`;
    })
    .join("") || "";

  return `
    <article class="match-card">
      <div class="panel__head">
        <div>
          <h3>${escapeHtml(match.date || "")} · ${escapeHtml(match.opponent || "")}</h3>
          <span class="badge">${match.homeAway === "home" ? "בית" : "חוץ"}</span>
          <span class="badge">תוצאה: ${escapeHtml(match.result || "לא שוחק")}</span>
          ${quality}
        </div>
        <a class="match-link" href="${escapeAttribute(match.source?.url || "#")}" target="_blank" rel="noreferrer">מקור</a>
      </div>
      <div class="match-card__grid">
        <div class="mini-card"><h4>שערים</h4><ul class="list">${goals || "<li>אין/לא הוזן</li>"}</ul></div>
        <div class="mini-card"><h4>הרכב מכבי</h4><ul class="list">${starters || "<li>חסר הרכב</li>"}</ul></div>
        <div class="mini-card"><h4>מחליפים והשפעות</h4><ul class="list">${subs || "<li>אין מחליפים מחושבים</li>"}</ul></div>
      </div>
      <div class="mini-card"><h4>מי קיבל פלוס/מינוס בכל שער</h4><ul class="list">${impacts || "<li>המשחק לא כשיר לחישוב</li>"}</ul></div>
      ${renderValidation(match.validation)}
    </article>
  `;
}

function renderPlayer(playerId) {
  const player = state.dashboard.players.find((item) => item.playerId === playerId);
  if (!player) {
    view.innerHTML = "<div class=\"empty-state\"><h2>שחקן לא נמצא</h2></div>";
    return;
  }

  const rows = player.matches
    .filter((match) => matchPassesDateAndOpponent(match))
    .map((match) => `
      <tr>
        <td>${escapeHtml(match.date || "")}</td>
        <td>${escapeHtml(match.opponent || "")}</td>
        <td>${escapeHtml(match.homeAway === "home" ? "בית" : "חוץ")}</td>
        <td>${escapeHtml(match.intervals.map((item) => `${item.start}-${item.end}`).join(", "))}</td>
        <td>${match.affectingGoals.map((goal) => `${goal.minute} ${goal.delta > 0 ? "+" : "-"} (${goal.scorer})`).join("<br>") || "ללא"}</td>
        <td class="${match.plusMinus >= 0 ? "plus" : "minus"}">${formatSigned(match.plusMinus)}</td>
      </tr>
    `)
    .join("");

  view.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <div>
          <button class="match-link" onclick="location.hash='players'">חזרה לטבלה</button>
          <h2>${escapeHtml(player.name)}</h2>
        </div>
        <span class="${player.plusMinus >= 0 ? "plus" : "minus"}">${formatSigned(player.plusMinus)}</span>
      </div>
      <div class="match-card__grid match-card">
        <div class="mini-card"><h4>דקות</h4><strong>${Math.round(player.minutes)}</strong></div>
        <div class="mini-card"><h4>הופעות</h4><strong>${player.appearances}</strong></div>
        <div class="mini-card"><h4>שערים עליו</h4><strong>${player.goalsForOn}-${player.goalsAgainstOn}</strong></div>
        <div class="mini-card"><h4>דקות לשער זכות</h4><strong>${formatMinutesPerGoal(player.minutesPerGoalFor)}</strong></div>
        <div class="mini-card"><h4>דקות לשער חובה</h4><strong>${formatMinutesPerGoal(player.minutesPerGoalAgainst)}</strong></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>תאריך</th><th>יריבה</th><th>בית/חוץ</th><th>דקות</th><th>שערים שהשפיעו</th><th>מדד</th></tr>
          </thead>
          <tbody>${rows || "<tr><td colspan=\"6\">אין משחקים בסינון הנוכחי</td></tr>"}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderQuality() {
  const matches = filteredMatches();
  const importPolicy = state.dashboard.importPolicy || {};
  view.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <h2>איכות נתונים</h2>
        <span class="badge">${matches.length} משחקים בסינון</span>
      </div>
      <div class="match-card">
        <div class="mini-card">
          <h4>מדיניות מקור</h4>
          <p>${escapeHtml(state.dashboard.sourcePolicy?.primary || "")}</p>
          <ul class="list">${(state.dashboard.sourcePolicy?.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
        </div>
        <div class="mini-card">
          <h4>מדיניות ייבוא</h4>
          <p>${importPolicy.autoRefresh ? "אוטומטי בכל טעינה" : "ייבוא ידני"}</p>
          ${importPolicy.message ? `<p>${escapeHtml(importPolicy.message)}</p>` : ""}
        </div>
        ${matches.map((match) => `
          <div class="mini-card">
            <h4>${escapeHtml(match.date || "")} · ${escapeHtml(match.opponent || "")}</h4>
            <p><a href="${escapeAttribute(match.source?.url || "#")}" target="_blank" rel="noreferrer">מקור מכבי</a></p>
            <p>אימות התאחדות: ${escapeHtml(match.source?.ifaUrl || "לא הוזן")}</p>
            ${renderValidation(match.validation)}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderValidation(validation = {}) {
  const errors = validation.errors || [];
  const warnings = validation.warnings || [];
  if (!errors.length && !warnings.length) return "";
  return `
    <div class="notice ${errors.length ? "notice--warn" : ""}">
      ${errors.map((item) => `<p><strong>שגיאה:</strong> ${escapeHtml(item)}</p>`).join("")}
      ${warnings.map((item) => `<p><strong>אזהרה:</strong> ${escapeHtml(item)}</p>`).join("")}
    </div>
  `;
}

function filteredPlayers() {
  return (state.dashboard.players || [])
    .filter((player) => {
      if (state.filters.player && !player.name.toLowerCase().includes(state.filters.player.toLowerCase())) return false;
      if (state.filters.role === "starter" && player.starts === 0) return false;
      if (state.filters.role === "substitute" && player.substituteAppearances === 0) return false;
      return player.matches.some((match) => matchPassesDateAndOpponent(match));
    })
    .sort(comparePlayers);
}

function comparePlayers(playerA, playerB) {
  const key = state.playerSort.key;
  const directionMultiplier = state.playerSort.direction === "asc" ? 1 : -1;
  const valueA = playerA[key];
  const valueB = playerB[key];

  if (valueA == null && valueB == null) return (playerA.name || "").localeCompare(playerB.name || "", "he");
  if (valueA == null) return 1;
  if (valueB == null) return -1;

  if (Number(valueA) !== Number(valueB)) return (Number(valueA) - Number(valueB)) * directionMultiplier;
  return (playerA.name || "").localeCompare(playerB.name || "", "he");
}

function handleViewClick(event) {
  const sortButton = event.target.closest?.("[data-player-sort]");
  if (!sortButton) return;
  updatePlayerSort(sortButton.dataset.playerSort);
}

function updatePlayerSort(key) {
  if (!playerSortColumns[key]) return;

  if (state.playerSort.key === key) {
    state.playerSort.direction = state.playerSort.direction === "asc" ? "desc" : "asc";
  } else {
    state.playerSort.key = key;
    state.playerSort.direction = playerSortDefaultDirections[key] || "desc";
  }

  render();
}

function filteredMatches() {
  return (state.dashboard.matches || []).filter(matchPassesDateAndOpponent);
}

function matchPassesDateAndOpponent(match) {
  if (state.filters.opponent && !(match.opponent || "").toLowerCase().includes(state.filters.opponent.toLowerCase())) return false;
  if (state.filters.homeAway && match.homeAway !== state.filters.homeAway) return false;
  if (state.filters.fromDate && match.date < state.filters.fromDate) return false;
  if (state.filters.toDate && match.date > state.filters.toDate) return false;
  return true;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function teamLabel(team) {
  return team === "maccabi" ? "מכבי" : "יריבה";
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}

function formatMinutesPerGoal(value) {
  if (value == null) return "אין";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
