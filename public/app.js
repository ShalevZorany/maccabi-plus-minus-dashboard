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
    role: "",
    minMinutes: ""
  }
};

const view = document.querySelector("#view");
const tabs = [...document.querySelectorAll(".tab")];
const qualityPanel = document.querySelector("#qualityPanel");
const heroMetric = document.querySelector("#heroMetric");
const heroSubMetric = document.querySelector("#heroSubMetric");
const refreshButton = document.querySelector("#refreshData");
const playerSortColumns = {
  minutes: "דקות",
  appearances: "משחקים",
  starts: "פתח",
  startedWinPercentage: "% נצחונות כשפתח",
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
view.addEventListener("click", handleViewClick);

for (const [key, selector] of [
  ["player", "#playerFilter"],
  ["opponent", "#opponentFilter"],
  ["homeAway", "#homeAwayFilter"],
  ["fromDate", "#fromDateFilter"],
  ["toDate", "#toDateFilter"],
  ["role", "#roleFilter"],
  ["minMinutes", "#minMinutesFilter"]
]) {
  document.querySelector(selector).addEventListener("input", (event) => {
    state.filters[key] = event.target.value;
    render();
  });
}

window.addEventListener("hashchange", applyRoute);
await initializeDashboard();

async function initializeDashboard() {
  try {
    await loadDashboard();
    applyRoute();
  } catch (error) {
    renderLoadFailure(error);
  }
}

async function loadDashboard() {
  view.innerHTML = "<div class=\"empty-state\"><h2>טוען נתונים...</h2></div>";
  state.dashboard = await fetchJson("/api/dashboard");
  configureImportControls();
  updateHero();
  renderQualityStrip();
}

function renderLoadFailure(error) {
  state.dashboard = null;
  heroMetric.textContent = "אין נתונים";
  heroSubMetric.textContent = "לא ניתן לטעון את הדאשבורד כרגע";
  qualityPanel.innerHTML = `
    <div class="notice notice--warn">
      <strong>טעינת נתונים נכשלה:</strong>
      ${escapeHtml(error?.message || "שגיאת תקשורת")}
    </div>
  `;
  document.querySelector(".hero__actions").hidden = true;
  view.innerHTML = `
    <div class="empty-state">
      <h2>הנתונים לא זמינים כרגע</h2>
      <p>העמוד נשאר פעיל. אפשר לנסות לטעון שוב בעוד רגע.</p>
      <button type="button" class="button button--primary" data-retry-load>נסה שוב</button>
    </div>
  `;
}

function configureImportControls() {
  const importPolicy = state.dashboard?.importPolicy || {};
  const manualImportEnabled = importPolicy.manualImportEnabled !== false;

  refreshButton.disabled = false;
  const heroActions = document.querySelector(".hero__actions");
  heroActions.hidden = false;
  heroActions.style.display = "";

  refreshButton.textContent = "רענון נתונים";
  refreshButton.title = manualImportEnabled
    ? "מושך מחדש נתונים מאתר מכבי"
    : "מרענן את הדאשבורד ומושך נתונים מחדש";
}

async function refreshData() {
  refreshButton.disabled = true;
  refreshButton.textContent = "מרענן...";
  try {
    if (state.dashboard?.importPolicy?.autoRefresh) {
      await loadDashboard();
    } else {
      await fetchJson("/api/import/refresh", { method: "POST" });
      await loadDashboard();
    }
    render();
  } catch (error) {
    alert(`רענון נכשל: ${error.message}`);
  } finally {
    configureImportControls();
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
    heroSubMetric.textContent = "לא התקבלו נתונים כרגע";
    return;
  }
  const incomplete = finishedIncompleteMatches(state.dashboard);
  heroMetric.textContent = `נקלטו ${totals.complete} משחקים`;
  heroSubMetric.textContent = skippedMatchesText(incomplete);
}

function renderQualityStrip() {
  const dashboard = state.dashboard;
  const totals = dashboard?.totals || {};
  const incomplete = finishedIncompleteMatches(dashboard);
  const snapshotNote = dashboard?.importPolicy?.mode === "automatic-live-fallback"
    ? "<span>מוצג הסנאפשוט האחרון.</span>"
    : "";

  qualityPanel.innerHTML = `
    <div class="notice ${incomplete.length || snapshotNote ? "notice--warn" : "notice--ok"}">
      <strong>נקלטו:</strong> ${escapeHtml(String(totals.complete || 0))} משחקים.
      ${escapeHtml(skippedMatchesText(incomplete))}
      ${snapshotNote}
    </div>
  `;
}

function finishedIncompleteMatches(dashboard) {
  return (dashboard?.matches || []).filter((match) => match.status === "finished" && !match.completeForCalculation);
}

function skippedMatchesText(matches) {
  if (!matches.length) return "כל המשחקים שהסתיימו נכנסו לחישוב.";
  if (matches.length === 1 && isTechnicalDerbyWin(matches[0])) {
    return "משחק אחד - ניצחון טכני בדרבי - לא נחשב.";
  }
  if (matches.length === 1) return "משחק אחד לא נכנס לחישוב.";
  return `${matches.length} משחקים לא נכנסו לחישוב.`;
}

function isTechnicalDerbyWin(match) {
  return /hapoel tel aviv/i.test(match.opponent || "")
    && match.result === "3-0"
    && (match.validation?.errors || []).some((error) => /Goal timeline count \(0\)/.test(error));
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
  const totalPlayers = state.dashboard.players?.length || 0;
  const sortLabel = playerSortColumns[state.playerSort.key] || playerSortColumns.plusMinus;
  const sortDirection = state.playerSort.direction === "asc" ? "מהנמוך לגבוה" : "מהגבוה לנמוך";
  const minMinutes = parseMinMinutesFilter();
  const activeFilters = renderActiveFilterSummary(minMinutes);
  view.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <div>
          <h2>טבלת שחקנים</h2>
          <span class="badge badge--active">המספרים מחושבים לפי הסינון הנוכחי</span>
          <span class="badge">מיון: ${escapeHtml(sortLabel)} · ${sortDirection}</span>
          <span class="badge">${players.length} מתוך ${totalPlayers} שחקנים</span>
          ${activeFilters}
        </div>
        <span class="badge">תוצאות מסוננות</span>
      </div>
      <div class="table-wrap">
        <table class="players-table">
          <thead>
            <tr>
              <th>שחקן</th>
              ${renderPlayerSortHeader("minutes")}
              ${renderPlayerSortHeader("appearances")}
              ${renderPlayerSortHeader("starts")}
              ${renderPlayerSortHeader("startedWinPercentage")}
              ${renderPlayerSortHeader("goalsForOn")}
              ${renderPlayerSortHeader("goalsAgainstOn")}
              ${renderPlayerSortHeader("minutesPerGoalFor")}
              ${renderPlayerSortHeader("minutesPerGoalAgainst")}
              ${renderPlayerSortHeader("plusMinus")}
            </tr>
          </thead>
          <tbody>
            ${players.length ? players.map(renderPlayerRow).join("") : "<tr><td colspan=\"10\">אין שחקנים שעומדים בסינון הנוכחי</td></tr>"}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderActiveFilterSummary(minMinutes) {
  const labels = [];

  if (state.filters.player) labels.push(`שחקן: ${state.filters.player}`);
  if (state.filters.opponent) labels.push(`יריבה: ${state.filters.opponent}`);
  if (state.filters.homeAway) labels.push(state.filters.homeAway === "home" ? "בית" : "חוץ");
  if (state.filters.fromDate) labels.push(`מתאריך: ${state.filters.fromDate}`);
  if (state.filters.toDate) labels.push(`עד תאריך: ${state.filters.toDate}`);
  if (state.filters.role) labels.push(state.filters.role === "starter" ? "שחקני הרכב" : "מחליפים");
  if (minMinutes > 0) labels.push(`לפחות ${minMinutes} דקות משחק`);

  if (!labels.length) {
    return `<span class="badge">אין סינון פעיל</span>`;
  }

  return `
    <div class="filter-summary" aria-label="סינונים פעילים">
      ${labels.map((label) => `<span class="badge badge--active">${escapeHtml(label)}</span>`).join("")}
    </div>
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
      <td class="numeric">${player.starts}</td>
      <td class="numeric">${formatPercentage(player.startedWinPercentage)}</td>
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
    .filter((match) => matchPassesAnalysisScope(match))
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
        <div class="mini-card"><h4>פתח בהרכב</h4><strong>${player.starts}</strong></div>
        <div class="mini-card"><h4>% נצחונות כשפתח</h4><strong>${formatPercentage(player.startedWinPercentage)}</strong></div>
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
  const incomplete = matches.filter((match) => match.status === "finished" && !match.completeForCalculation);
  view.innerHTML = `
    <section class="panel">
      <div class="panel__head">
        <h2>משחקים שלא נכנסו לחישוב</h2>
        <span class="badge">${incomplete.length} משחקים</span>
      </div>
      <div class="match-card">
        ${incomplete.length ? incomplete.map((match) => `
          <div class="mini-card">
            <h4>${escapeHtml(match.date || "")} · ${escapeHtml(match.opponent || "")}</h4>
            <p>${escapeHtml(skippedMatchesText([match]))}</p>
          </div>
        `).join("") : "<div class=\"empty-state\"><h2>אין משחקים חריגים</h2></div>"}
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
  const minMinutes = parseMinMinutesFilter();

  return (state.dashboard.players || [])
    .map((player) => buildFilteredPlayerStats(player))
    .filter(Boolean)
    .filter((player) => {
      if (state.filters.player && !player.name.toLowerCase().includes(state.filters.player.toLowerCase())) return false;
      if (minMinutes > 0 && Number(player.minutes || 0) < minMinutes) return false;
      return true;
    })
    .sort(comparePlayers);
}

function buildFilteredPlayerStats(player) {
  const baseMatches = (player.matches || [])
    .filter((match) => matchPassesDateAndOpponent(match));

  if (!baseMatches.length) return null;

  const matches = baseMatches.filter((match) => matchPassesAnalysisScope(match));

  const derived = {
    ...player,
    matches
  };

  derived.minutes = sumBy(matches, (match) => Number(match.minutes || 0));
  derived.appearances = matches.filter((match) => Number(match.minutes || 0) > 0).length;
  derived.starts = matches.filter((match) => matchWasStarted(match)).length;
  derived.startedWins = matches.filter((match) => matchWasStarted(match) && matchWasMaccabiWin(match)).length;
  derived.substituteAppearances = matches.filter((match) => matchWasSubstitute(match)).length;
  derived.goalsForOn = sumBy(matches, (match) => Number(match.goalsForOn || 0));
  derived.goalsAgainstOn = sumBy(matches, (match) => Number(match.goalsAgainstOn || 0));
  derived.plusMinus = sumBy(matches, (match) => Number(match.plusMinus || 0));
  derived.startedWinPercentage = derived.starts ? Math.round((derived.startedWins / derived.starts) * 1000) / 10 : null;
  derived.minutesPerGoalFor = derived.goalsForOn ? Math.round((derived.minutes / derived.goalsForOn) * 10) / 10 : null;
  derived.minutesPerGoalAgainst = derived.goalsAgainstOn ? Math.round((derived.minutes / derived.goalsAgainstOn) * 10) / 10 : null;

  return derived;
}

function parseMinMinutesFilter() {
  const value = Number(state.filters.minMinutes);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
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
  const retryButton = event.target.closest?.("[data-retry-load]");
  if (retryButton) {
    initializeDashboard();
    return;
  }

  const sortButton = event.target.closest?.("[data-player-sort]");
  if (!sortButton) return;
  updatePlayerSort(sortButton.dataset.playerSort);
}

function updatePlayerSort(key) {
  if (!playerSortColumns[key]) return;
  const scrollPosition = captureTableScrollPosition();

  if (state.playerSort.key === key) {
    state.playerSort.direction = state.playerSort.direction === "asc" ? "desc" : "asc";
  } else {
    state.playerSort.key = key;
    state.playerSort.direction = playerSortDefaultDirections[key] || "desc";
  }

  render();
  restoreTableScrollPosition(scrollPosition);
}

function captureTableScrollPosition() {
  const tableWrap = document.querySelector(".table-wrap");
  return {
    pageX: window.scrollX,
    pageY: window.scrollY,
    tableLeft: tableWrap?.scrollLeft ?? 0
  };
}

function restoreTableScrollPosition(scrollPosition) {
  const restore = () => {
    const tableWrap = document.querySelector(".table-wrap");
    if (tableWrap) tableWrap.scrollLeft = scrollPosition.tableLeft;
    window.scrollTo(scrollPosition.pageX, scrollPosition.pageY);
  };

  restore();
  requestAnimationFrame(restore);
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

function matchPassesAnalysisScope(match) {
  if (state.filters.role === "starter") return matchWasStarted(match);
  if (state.filters.role === "substitute") return matchWasSubstitute(match);
  return true;
}

function matchWasStarted(match) {
  return match.started === true || (match.intervals || []).some((interval) => interval.role === "starter");
}

function matchWasSubstitute(match) {
  return match.substituteAppearance === true
    || (match.intervals || []).some((interval) => interval.role === "substitute")
    || (!matchWasStarted(match) && Number(match.minutes || 0) > 0);
}

function matchWasMaccabiWin(match) {
  if (typeof match.maccabiWon === "boolean") return match.maccabiWon;

  const score = String(match.result || "").match(/^(\d+)-(\d+)$/);
  if (!score) return false;

  const maccabiGoals = Number(score[1]);
  const opponentGoals = Number(score[2]);
  return Number.isFinite(maccabiGoals) && Number.isFinite(opponentGoals) && maccabiGoals > opponentGoals;
}

function sumBy(items, iteratee) {
  return items.reduce((total, item) => total + Number(iteratee(item) || 0), 0);
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

function formatPercentage(value) {
  if (value == null) return "אין";
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
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
