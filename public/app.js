const state = {
  room: null,
  hostToken: localStorage.getItem("hostToken") || "",
  playerId: localStorage.getItem("playerId") || "",
  eventSource: null,
  timerInterval: null,
  prefs: JSON.parse(localStorage.getItem("accessibility") || "{}"),
  selectedWordIndex: 0,
  lastTimerAnnouncement: null
};

const app = document.getElementById("app");
const live = document.getElementById("live-region");
const assertive = document.getElementById("assertive-region");

applyPrefs();
window.addEventListener("popstate", render);
document.addEventListener("keydown", handleShortcuts);
render();

function render() {
  clearInterval(state.timerInterval);
  const path = location.pathname;
  if (path === "/") return home();
  if (path === "/host/new") return hostNew();
  if (path.startsWith("/host/room/")) return loadRoom(path.split("/").pop(), "host");
  if (path.startsWith("/join/")) return joinScreen(path.split("/").pop());
  if (path.startsWith("/room/") && path.endsWith("/score")) return loadRoom(path.split("/")[2], "score");
  if (path.startsWith("/room/")) return loadRoom(path.split("/").pop(), "player");
  if (path === "/rules") return rules();
  if (path === "/accessibility") return accessibility();
  home();
}

function shell(content) {
  app.innerHTML = `<main class="layout">${topbar()}${content}</main>`;
  app.focus();
}

function topbar() {
  return `<header class="topbar">
    <a class="button secondary" href="/" data-link>Start</a>
    <strong>30 Seconds Clubhouse</strong>
    <div class="actions">
      <a class="button secondary" href="/rules" data-link>Spelregels</a>
      <a class="button secondary" href="/accessibility" data-link>Toegankelijkheid</a>
    </div>
  </header>`;
}

function home() {
  shell(`<section class="grid" aria-labelledby="titel">
    <div>
      <h1 id="titel" class="brand">30 Seconds Clubhouse</h1>
      <p class="subtitle">Speel 30 Seconds live met Clubhouse voor audio. Deze app regelt kamer, teams, timer, kaarten en score.</p>
      <div class="actions">
        <a class="button" href="/host/new" data-link>Nieuw spel starten</a>
        <button class="secondary" data-action="join-code">Meedoen met code</button>
        <a class="button secondary" href="/rules" data-link>Spelregels</a>
      </div>
    </div>
    <aside class="panel">
      <h2>Zo speel je via Clubhouse</h2>
      <ol>
        <li>Start een Clubhouse-room.</li>
        <li>Maak hier een spelkamer aan.</li>
        <li>Deel de link of code in de Clubhouse-chat.</li>
        <li>Laat spelers zich aanmelden.</li>
        <li>Maak teams en start het spel.</li>
        <li>De omschrijver praat via Clubhouse.</li>
        <li>De host houdt score bij in deze app.</li>
      </ol>
    </aside>
  </section>`);
  bindLinks();
  on("[data-action='join-code']", "click", () => {
    const code = prompt("Vul de kamercode in:");
    if (code) go(`/join/${encodeURIComponent(code.trim().toUpperCase())}`);
  });
}

function hostNew() {
  shell(`<h1>Nieuw spel starten</h1>
  <form id="new-room" class="panel">
    <label for="roomName">Kamernaam</label>
    <input id="roomName" name="roomName" maxlength="60" value="30 Seconds via Clubhouse">
    <label for="hostName">Naam host</label>
    <input id="hostName" name="hostName" maxlength="30" value="Host">
    <div class="grid">
      <p><label for="timerSeconds">Timerduur</label><select id="timerSeconds" name="timerSeconds">${[15,20,30,45,60].map((n) => `<option ${n===30?"selected":""}>${n}</option>`).join("")}</select></p>
      <p><label for="rounds">Aantal rondes</label><input id="rounds" name="rounds" type="number" min="1" max="20" value="3"></p>
      <p><label for="teamCount">Aantal teams</label><input id="teamCount" name="teamCount" type="number" min="2" max="8" value="2"></p>
      <p><label for="targetScore">Eindscore</label><input id="targetScore" name="targetScore" type="number" min="1" value="30"></p>
    </div>
    <label class="checkline"><input type="checkbox" name="manualApproval"> Spelers handmatig toelaten</label>
    <label class="checkline"><input type="checkbox" name="accessibilityDefault" checked> Superduidelijke modus als standaard</label>
    <button type="submit">Kamer maken</button>
  </form>`);
  bindLinks();
  document.getElementById("new-room").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      name: form.get("roomName"),
      hostName: form.get("hostName"),
      settings: {
        timerSeconds: Number(form.get("timerSeconds")),
        rounds: Number(form.get("rounds")),
        teamCount: Number(form.get("teamCount")),
        targetScore: Number(form.get("targetScore")),
        manualApproval: form.has("manualApproval"),
        accessibilityDefault: form.has("accessibilityDefault")
      }
    };
    const result = await api("/api/create-room", data);
    state.hostToken = result.hostToken;
    localStorage.setItem("hostToken", state.hostToken);
    state.room = result.room;
    announce(`Kamer ${result.room.code} is gemaakt.`);
    go(`/host/room/${result.room.code}`);
  });
}

async function loadRoom(code, mode) {
  try {
    const result = await api(`/api/rooms?code=${encodeURIComponent(code)}`, null, mode === "host");
    state.room = result.room;
    connectEvents(code);
    mode === "host" ? hostRoom() : mode === "score" ? scoreBoard() : playerRoom();
  } catch (error) {
    shell(`<h1>Kamer niet gevonden</h1><p class="notice error">${error.message}</p><a class="button" href="/" data-link>Terug naar start</a>`);
    bindLinks();
  }
}

function hostRoom() {
  const room = state.room;
  const currentTeam = room.teams[room.currentTeamIndex];
  shell(`<h1>${escapeHtml(room.name)}</h1>
    ${statusBlock(room)}
    <section class="grid">
      <div class="panel">
        <h2>Kamercode</h2>
        <p class="room-code">${room.code}</p>
        <p><input readonly value="${location.origin}/join/${room.code}" aria-label="Deelbare link"></p>
        <button data-action="copy-link">Kopieer link</button>
        <p class="notice">Deel deze link in Clubhouse. Audio blijft in Clubhouse.</p>
      </div>
      <div class="panel">
        <h2>Host acties</h2>
        <div class="actions">
          <button data-action="teams">Teams automatisch maken</button>
          <button data-action="start-game" ${room.teams.length < 2 ? "disabled" : ""}>Spel starten</button>
          <button class="secondary" data-action="pause">${room.status === "gepauzeerd" ? "Hervatten" : "Pauze"}</button>
          <button class="danger" data-action="end-game">Spel beeindigen</button>
        </div>
      </div>
    </section>
    ${room.status === "lobby" ? lobbyHost(room) : gameHost(room, currentTeam)}
    ${scoreHtml(room)}
    ${helpHtml()}`);
  bindLinks();
  bindHostActions();
  tickTimer();
}

function lobbyHost(room) {
  return `<section class="grid">
    <div class="panel">
      <h2>Aangemelde spelers</h2>
      ${playerList(room, true)}
    </div>
    <div class="panel">
      <h2>Teamindeling</h2>
      ${teamList(room)}
    </div>
  </section>`;
}

function gameHost(room, currentTeam) {
  const turn = room.currentTurn;
  const judgingTeam = turn ? room.teams.find((team) => team.id === turn.judgingTeamId) : null;
  return `<section class="panel" aria-labelledby="spel">
    <h2 id="spel">Host spelscherm</h2>
    <p><strong>Team aan de beurt:</strong> ${escapeHtml(currentTeam?.name || "Nog geen team")}</p>
    <p><strong>Beoordelend team:</strong> ${escapeHtml(judgingTeam?.name || "Nog geen beoordelaar")} ${judgingTeam?.leaderId ? `- leider: ${escapeHtml(playerName(room, judgingTeam.leaderId))}` : ""}</p>
    <p><strong>Omschrijver:</strong> ${escapeHtml(playerName(room, turn?.describerPlayerId) || "Kies automatisch bij start beurt")}</p>
    <div class="timer" role="timer" aria-label="Timer" id="timer">${timerText(turn)}</div>
    <div class="sticky-controls actions">
      <button data-action="start-turn">Start beurt</button>
      <button data-action="end-turn">Stop beurt</button>
      <button data-action="next-turn">Volgende beurt</button>
      <button data-action="score-correct">Score corrigeren</button>
    </div>
    ${turn ? cardHtml(turn, true) : `<p class="notice">Druk op Start beurt om een kaart te tonen en de timer te starten.</p>`}
  </section>`;
}

function joinScreen(code) {
  shell(`<h1>Meedoen met kamer ${escapeHtml(code)}</h1>
  <p class="notice">Blijf in Clubhouse voor de audio. Gebruik deze pagina voor aanmelden, teaminformatie, timer en score.</p>
  <form id="join-form" class="panel">
    <label for="name">Naam</label>
    <input id="name" name="name" required maxlength="30" autocomplete="name">
    <label for="pref">Toegankelijkheidsvoorkeur</label>
    <select id="pref" name="pref">
      <option value="normaal">Normale weergave</option>
      <option value="groot">Grote tekst</option>
      <option value="extra-groot">Superduidelijke modus</option>
    </select>
    <button type="submit">Meedoen</button>
  </form>`);
  bindLinks();
  document.getElementById("join-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pref = String(form.get("pref"));
    const result = await api("/api/join-room", {
      code,
      name: form.get("name"),
      accessibilityPreferences: {
        textSize: pref === "extra-groot" ? "extra-groot" : pref,
        contrast: pref === "extra-groot" ? "zwart-geel" : "normaal",
        screenreaderMode: pref !== "normaal"
      }
    });
    state.playerId = result.player.id;
    localStorage.setItem("playerId", state.playerId);
    announce(result.message);
    go(`/room/${result.room.code}`);
  });
}

function playerRoom() {
  const room = state.room;
  const own = room.players.find((player) => player.id === state.playerId);
  const team = own ? room.teams.find((entry) => entry.id === own.teamId) : null;
  const currentTeam = room.teams[room.currentTeamIndex];
  const judgingTeam = room.currentTurn ? room.teams.find((entry) => entry.id === room.currentTurn.judgingTeamId) : null;
  const isJudgeLeader = !!own && !!judgingTeam && judgingTeam.leaderId === own.id;
  shell(`<h1>${escapeHtml(room.name)}</h1>
  ${statusBlock(room)}
  <section class="grid">
    <div class="panel">
      <h2>Jouw status</h2>
      <p class="notice">Je bent aangemeld.</p>
      <p><strong>Naam:</strong> ${escapeHtml(own?.name || "Onbekend")}</p>
      <p><strong>Team:</strong> ${escapeHtml(team?.name || "Nog niet ingedeeld")}</p>
      <p><strong>Status:</strong> ${room.status === "lobby" ? "Wachten tot de host het spel start." : `${escapeHtml(currentTeam?.name || "Een team")} is aan de beurt.`}</p>
      <p><strong>Beoordeling:</strong> ${isJudgeLeader ? "Jij bent teamleider en beoordeelt deze beurt." : `${escapeHtml(judgingTeam?.name || "Het andere team")} beoordeelt deze beurt.`}</p>
      <p>Blijf in Clubhouse voor de audio.</p>
    </div>
    <div class="panel">
      <h2>Timer</h2>
      <div class="timer" role="timer" id="timer">${timerText(room.currentTurn)}</div>
    </div>
  </section>
  ${room.currentTurn?.wordResults?.length ? cardHtml(room.currentTurn, isJudgeLeader) : ""}
  ${scoreHtml(room)}`);
  bindLinks();
  if (isJudgeLeader) bindJudgeActions();
  tickTimer();
}

function statusBlock(room) {
  const team = room.teams[room.currentTeamIndex];
  return `<section class="statusbar" aria-label="Status">
    <strong>Stap:</strong> ${stepText(room)}<br>
    <strong>Ronde:</strong> ${room.currentRound} van ${room.settings.rounds}<br>
    <strong>Team:</strong> ${escapeHtml(team?.name || "Nog geen team")}<br>
    <strong>Status:</strong> ${statusText(room.status)}
  </section>`;
}

function playerList(room, editable = false) {
  const players = room.players;
  if (!players.length) return `<p class="notice">Er zijn nog geen spelers aangemeld. Deel de link in Clubhouse.</p>`;
  return `<ul class="player-list">${players.map((player) => `<li class="player-item">
    <strong>${escapeHtml(player.name)}${player.role === "host" ? " (host)" : ""}</strong><br>
    Team: ${escapeHtml(room.teams.find((team) => team.id === player.teamId)?.name || "Nog niet ingedeeld")}
    ${editable ? `<div class="actions"><button class="secondary" data-rename="${player.id}">Hernoemen</button><button class="danger" data-remove="${player.id}">Verwijderen</button></div>` : ""}
  </li>`).join("")}</ul>`;
}

function teamList(room) {
  if (!room.teams.length) return `<p class="notice">Maak teams voordat je het spel start.</p>`;
  return `<div class="grid">${room.teams.map((team) => `<section class="card"><h3>${escapeHtml(team.name)}</h3>
    <p><strong>${team.score} punten</strong></p>
    <p><strong>Teamleider:</strong> ${escapeHtml(playerName(room, team.leaderId) || "Nog niet gekozen")}</p>
    <ul>${team.players.map((id) => `<li>${escapeHtml(playerName(room, id))}${team.leaderId === id ? " - teamleider" : ""}</li>`).join("") || "<li>Nog geen spelers</li>"}</ul>
  </section>`).join("")}</div>`;
}

function cardHtml(turn, hostControls) {
  return `<section class="panel" aria-labelledby="kaart"><h2 id="kaart">Kaart: ${escapeHtml(turn.card?.category || "Verborgen")}</h2>
    <ol class="word-list">${turn.wordResults.map((result, index) => `<li class="word-item ${index === state.selectedWordIndex ? "selected" : ""}">
      <div class="word-row">
        <div><span class="word-name">${escapeHtml(result.word)}</span><br><span class="status-label">${statusLabel(result.status)}</span></div>
        ${hostControls ? `<div class="actions">
          <button class="good" data-word="${escapeAttr(result.word)}" data-status="correct">Goed</button>
          <button class="danger" data-word="${escapeAttr(result.word)}" data-status="wrong">Fout</button>
          <button class="skip" data-word="${escapeAttr(result.word)}" data-status="skipped">Overslaan</button>
          <button class="secondary" data-word="${escapeAttr(result.word)}" data-status="pending">Terugzetten</button>
        </div>` : ""}
      </div>
    </li>`).join("")}</ol>
  </section>`;
}

function scoreHtml(room) {
  return `<section class="panel" aria-labelledby="score"><h2 id="score">Scorebord</h2>
    ${teamList(room)}
    <h3>Rondehistorie</h3>
    ${room.scoreHistory.length ? `<ul class="history-list">${room.scoreHistory.map((row) => `<li class="history-item">Ronde ${row.round}: ${escapeHtml(row.teamName)} scoorde ${row.points} punten. Totaal: ${row.total}.</li>`).join("")}</ul>` : `<p class="notice">Er is nog geen scoregeschiedenis.</p>`}
  </section>`;
}

function scoreBoard() {
  shell(`<h1>Scorebord</h1>${scoreHtml(state.room)}`);
  bindLinks();
}

function rules() {
  shell(`<h1>Spelregels</h1><section class="panel">
    <ul>
      <li>Een speler omschrijft de woorden op de kaart.</li>
      <li>De speler mag het woord zelf niet noemen.</li>
      <li>Delen van het woord en vertalingen mogen niet gebruikt worden.</li>
      <li>Het team raadt hardop via Clubhouse.</li>
      <li>Elk goed geraden woord is 1 punt.</li>
      <li>Overgeslagen woorden leveren 0 punten op.</li>
      <li>Foute woorden leveren standaard 0 strafpunten op, tenzij de host strafpunten inschakelt.</li>
      <li>Na 30 seconden stopt de beurt, of na de ingestelde tijd.</li>
      <li>De host bepaalt bij twijfel of een antwoord goed is.</li>
    </ul>
  </section>`);
  bindLinks();
}

function accessibility() {
  shell(`<h1>Toegankelijkheid</h1>
  <form id="access-form" class="panel">
    <label for="textSize">Tekstgrootte</label>
    <select id="textSize" name="textSize">
      <option value="normaal">Normaal</option><option value="groot">Groot</option><option value="extra-groot">Extra groot</option>
    </select>
    <label for="contrast">Contrast</label>
    <select id="contrast" name="contrast">
      <option value="normaal">Normaal</option><option value="hoog">Hoog contrast</option><option value="zwart-geel">Zwart met geel</option><option value="zwart-wit">Zwart met wit</option>
    </select>
    ${["reduceMotion:Bewegingsreductie", "screenreaderMode:Screenreader-modus", "timerAnnouncements:Timer-aankondigingen", "soundSignals:Geluidssignalen", "vibration:Trilsignaal", "simpleView:Eenvoudige weergave"].map((item) => {
      const [name, label] = item.split(":");
      return `<label class="checkline"><input type="checkbox" name="${name}"> ${label}</label>`;
    }).join("")}
    <button type="submit">Instellingen opslaan</button>
  </form>
  <section class="panel"><h2>Toegankelijkheidscheck</h2><p>De app gebruikt grote knoppen, duidelijke focusranden, semantische HTML, live-regions, tekstlabels naast kleur, hoog contrast en toetsenbordbediening.</p></section>`);
  bindLinks();
  const form = document.getElementById("access-form");
  form.textSize.value = state.prefs.textSize || "normaal";
  form.contrast.value = state.prefs.contrast || "normaal";
  for (const [key, value] of Object.entries(state.prefs)) if (form[key] && typeof value === "boolean") form[key].checked = value;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    state.prefs = {
      textSize: data.get("textSize"),
      contrast: data.get("contrast"),
      reduceMotion: data.has("reduceMotion"),
      screenreaderMode: data.has("screenreaderMode"),
      timerAnnouncements: data.has("timerAnnouncements"),
      soundSignals: data.has("soundSignals"),
      vibration: data.has("vibration"),
      simpleView: data.has("simpleView")
    };
    localStorage.setItem("accessibility", JSON.stringify(state.prefs));
    applyPrefs();
    announce("Toegankelijkheidsinstellingen opgeslagen.");
  });
}

function helpHtml() {
  return `<details class="panel"><summary><strong>Help en sneltoetsen</strong></summary>
    <p><span class="kbd">Spatie</span> start of stopt de beurt. <span class="kbd">G</span> goed. <span class="kbd">F</span> fout. <span class="kbd">O</span> overslaan. <span class="kbd">N</span> volgende woord. <span class="kbd">P</span> vorige woord. <span class="kbd">S</span> score. <span class="kbd">H</span> help.</p>
  </details>`;
}

function bindHostActions() {
  on("[data-action='copy-link']", "click", async () => {
    await navigator.clipboard.writeText(`${location.origin}/join/${state.room.code}`);
    announce("Deelbare link gekopieerd.");
  });
  on("[data-action='teams']", "click", () => postHost("/api/create-teams", { code: state.room.code, teamCount: state.room.settings.teamCount }));
  on("[data-action='start-game']", "click", () => postHost("/api/start-game", { code: state.room.code }));
  on("[data-action='pause']", "click", () => postHost(state.room.status === "gepauzeerd" ? "/api/resume-game" : "/api/pause-game", { code: state.room.code }));
  on("[data-action='end-game']", "click", () => confirm("Weet je zeker dat je het spel wilt beeindigen?") && postHost("/api/end-game", { code: state.room.code }));
  on("[data-action='start-turn']", "click", () => postHost("/api/start-turn", { code: state.room.code }));
  on("[data-action='end-turn']", "click", () => postHost("/api/end-turn", { code: state.room.code }));
  on("[data-action='next-turn']", "click", () => postHost("/api/next-turn", { code: state.room.code }));
  on("[data-action='score-correct']", "click", () => {
    const teamName = prompt("Teamnaam:");
    const team = state.room.teams.find((entry) => entry.name.toLowerCase() === String(teamName || "").toLowerCase());
    if (!team) return announce("Team niet gevonden.", true);
    const score = Number(prompt(`Nieuwe score voor ${team.name}:`, String(team.score)));
    if (Number.isFinite(score)) postHost("/api/correct-score", { code: state.room.code, teamId: team.id, score });
  });
  document.querySelectorAll("[data-word][data-status]").forEach((button) => button.addEventListener("click", () => postHost("/api/update-word", { code: state.room.code, word: button.dataset.word, status: button.dataset.status })));
  document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => postHost("/api/remove-player", { code: state.room.code, playerId: button.dataset.remove })));
  document.querySelectorAll("[data-rename]").forEach((button) => button.addEventListener("click", () => {
    const name = prompt("Nieuwe naam:");
    if (name) postHost("/api/rename-player", { code: state.room.code, playerId: button.dataset.rename, name });
  }));
}

function bindJudgeActions() {
  document.querySelectorAll("[data-word][data-status]").forEach((button) => button.addEventListener("click", () => postPlayer("/api/update-word", { code: state.room.code, word: button.dataset.word, status: button.dataset.status })));
}

async function postHost(path, data) {
  try {
    const result = await api(path, data, true);
    state.room = result.room;
    announce(lastAnnouncement());
    hostRoom();
  } catch (error) {
    announce(error.message, true);
  }
}

async function postPlayer(path, data) {
  try {
    const result = await api(path, data, false);
    state.room = result.room;
    announce(lastAnnouncement());
    playerRoom();
  } catch (error) {
    announce(error.message, true);
  }
}

async function api(path, data = null, host = false) {
  const options = data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : { headers: {} };
  if (host) options.headers["x-host-token"] = state.hostToken;
  if (state.playerId) options.headers["x-player-id"] = state.playerId;
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Er ging iets mis.");
  return result;
}

function connectEvents(code) {
  if (state.eventSource) state.eventSource.close();
  state.eventSource = new EventSource(`/events/${code}`);
  state.eventSource.onmessage = refreshRoom;
  ["player.joined", "teams.updated", "game.started", "turn.started", "word.updated", "turn.ended", "score.updated", "game.ended", "game.paused", "game.resumed"].forEach((event) => {
    state.eventSource.addEventListener(event, refreshRoom);
  });
  state.eventSource.onerror = () => announce("Verbinding verbroken. De app probeert opnieuw te verbinden.", true);
}

async function refreshRoom(event) {
  try {
    const payload = JSON.parse(event.data);
    if (!payload.room?.code) return;
    const isHost = location.pathname.startsWith("/host/");
    const fresh = await api(`/api/rooms?code=${encodeURIComponent(payload.room.code)}`, null, isHost);
    state.room = fresh.room;
    announce(lastAnnouncement());
    isHost ? hostRoom() : playerRoom();
  } catch {}
}

function tickTimer() {
  state.timerInterval = setInterval(() => {
    const timer = document.getElementById("timer");
    if (!timer || !state.room?.currentTurn) return;
    const seconds = secondsLeft(state.room.currentTurn);
    timer.textContent = formatSeconds(seconds);
    if (state.prefs.timerAnnouncements && [10, 5, 4, 3, 2, 1, 0].includes(seconds) && state.lastTimerAnnouncement !== seconds) {
      state.lastTimerAnnouncement = seconds;
      const team = state.room.teams.find((entry) => entry.id === state.room.currentTurn.teamId);
      announce(seconds === 0 ? `Tijd voorbij. ${team?.name || "Het team"} is klaar.` : `Nog ${seconds} seconden voor ${team?.name || "het team"}.`, seconds <= 5);
      if (state.prefs.vibration && navigator.vibrate) navigator.vibrate(120);
    }
  }, 250);
}

function handleShortcuts(event) {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if (!location.pathname.startsWith("/host/room/")) return;
  const turn = state.room?.currentTurn;
  const word = turn?.wordResults?.[state.selectedWordIndex]?.word;
  if (event.key === " ") { event.preventDefault(); turn ? postHost("/api/end-turn", { code: state.room.code }) : postHost("/api/start-turn", { code: state.room.code }); }
  if (event.key.toLowerCase() === "g" && word) postHost("/api/update-word", { code: state.room.code, word, status: "correct" });
  if (event.key.toLowerCase() === "f" && word) postHost("/api/update-word", { code: state.room.code, word, status: "wrong" });
  if (event.key.toLowerCase() === "o" && word) postHost("/api/update-word", { code: state.room.code, word, status: "skipped" });
  if (event.key.toLowerCase() === "n" && turn) state.selectedWordIndex = Math.min(turn.wordResults.length - 1, state.selectedWordIndex + 1);
  if (event.key.toLowerCase() === "p" && turn) state.selectedWordIndex = Math.max(0, state.selectedWordIndex - 1);
  if (event.key.toLowerCase() === "s") document.getElementById("score")?.scrollIntoView();
  if (event.key.toLowerCase() === "h") document.querySelector("details")?.setAttribute("open", "");
}

function bindLinks() {
  document.querySelectorAll("[data-link]").forEach((link) => link.addEventListener("click", (event) => {
    event.preventDefault();
    go(link.getAttribute("href"));
  }));
}

function go(path) {
  history.pushState({}, "", path);
  render();
}

function on(selector, event, handler) {
  document.querySelectorAll(selector).forEach((element) => element.addEventListener(event, handler));
}

function applyPrefs() {
  document.documentElement.dataset.textSize = state.prefs.textSize || "normaal";
  document.documentElement.dataset.contrast = state.prefs.contrast || "normaal";
  document.documentElement.dataset.reduceMotion = state.prefs.reduceMotion ? "aan" : "uit";
}

function announce(message, urgent = false) {
  if (!message) return;
  (urgent ? assertive : live).textContent = message;
}

function lastAnnouncement() {
  return state.room?.announcements?.at(-1) || "";
}

function secondsLeft(turn) {
  return Math.max(0, Math.ceil((new Date(turn.endsAt).getTime() - Date.now()) / 1000));
}

function timerText(turn) {
  return turn ? formatSeconds(secondsLeft(turn)) : formatSeconds(state.room?.settings?.timerSeconds || 30);
}

function formatSeconds(seconds) {
  return `${seconds}s`;
}

function stepText(room) {
  if (room.status === "lobby" && room.players.length <= 1) return "Stap 1: spelers aanmelden";
  if (room.status === "lobby" && !room.teams.length) return "Stap 2: teams maken";
  if (room.status === "lobby") return "Stap 3: spel starten";
  if (room.status === "actief") return "Stap 4: beurt spelen";
  if (room.status === "afgelopen") return "Stap 5: score controleren";
  return "Spel gepauzeerd";
}

function statusText(status) {
  return { lobby: "Lobby", actief: "Actief", gepauzeerd: "Gepauzeerd", afgelopen: "Afgelopen" }[status] || status;
}

function statusLabel(status) {
  return { pending: "Nog niet behandeld", correct: "Goed", wrong: "Fout", skipped: "Overgeslagen" }[status] || status;
}

function playerName(room, id) {
  return room.players.find((player) => player.id === id)?.name || "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
