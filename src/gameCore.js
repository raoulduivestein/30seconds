import { cards } from "../data/cards.js";

const DEFAULT_SETTINGS = {
  timerSeconds: 30,
  rounds: 3,
  targetScore: 30,
  allowSkips: true,
  maxSkips: 5,
  penaltyEnabled: false,
  penaltyPoints: 1,
  cardsCanRepeat: false,
  manualApproval: false,
  accessibilityDefault: false,
  wordsPerCard: 5,
  teamCount: 2,
  cardOrder: "random"
};

export function createGameStore() {
  return { rooms: new Map(), cards: cards.filter((card) => card.status === "actief") };
}

export function createRoom(store, input = {}) {
  const code = uniqueCode(store);
  const now = new Date();
  const hostToken = token("host");
  const host = {
    id: token("player"),
    name: cleanName(input.hostName || "Host"),
    role: "host",
    teamId: null,
    accessibilityPreferences: {},
    joinedAt: now.toISOString(),
    connected: true,
    approved: true
  };
  const room = {
    id: token("room"),
    code,
    hostToken,
    name: cleanText(input.name || input.roomName || "30 Seconds Clubhouse"),
    status: "lobby",
    settings: { ...DEFAULT_SETTINGS, ...(input.settings || {}) },
    players: [host],
    teams: [],
    currentRound: 1,
    currentTeamIndex: 0,
    currentTurn: null,
    usedCardIds: [],
    scoreHistory: [],
    announcements: ["Welkom bij 30 Seconds Clubhouse!"],
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  };
  store.rooms.set(code, room);
  return room;
}

export function joinRoom(store, code, input = {}) {
  const room = getRoom(store, code);
  const baseName = cleanName(input.name);
  if (!baseName) throw userError("Vul eerst je naam in.");
  const finalName = uniquePlayerName(room, baseName);
  const player = {
    id: token("player"),
    name: finalName,
    role: "player",
    teamId: null,
    accessibilityPreferences: input.accessibilityPreferences || {},
    joinedAt: new Date().toISOString(),
    connected: true,
    approved: !room.settings.manualApproval
  };
  room.players.push(player);
  assignPlayerToSmallestTeam(room, player);
  room.announcements.push(`${finalName} is aangemeld.`);
  return {
    room,
    player,
    message: finalName === baseName ? "Je bent aangemeld." : "Deze naam is al in gebruik. We hebben een nummer toegevoegd."
  };
}

export function removePlayer(store, code, hostToken, playerId) {
  const room = requireHost(store, code, hostToken);
  room.players = room.players.filter((player) => player.id !== playerId || player.role === "host");
  for (const team of room.teams) {
    team.players = team.players.filter((id) => id !== playerId);
    if (team.leaderId === playerId) team.leaderId = team.players[0] || null;
  }
  room.announcements.push("Speler verwijderd.");
  return room;
}

export function renamePlayer(store, code, hostToken, playerId, name) {
  const room = requireHost(store, code, hostToken);
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) throw userError("Deze speler bestaat niet meer.");
  player.name = uniquePlayerName(room, cleanName(name), playerId);
  room.announcements.push(`${player.name} is bijgewerkt.`);
  return room;
}

export function createTeams(store, code, hostToken, input = {}) {
  const room = requireHost(store, code, hostToken);
  const count = clamp(Number(input.teamCount || room.settings.teamCount || 2), 2, 8);
  const teamNames = ["Team Rood", "Team Blauw", "Team Geel", "Team Groen", "Team Paars", "Team Oranje", "Team Wit", "Team Zwart"];
  room.settings.teamCount = count;
  room.teams = Array.from({ length: count }, (_, index) => ({
    id: token("team"),
    name: input.teamNames?.[index] || teamNames[index],
    colorName: teamNames[index].replace("Team ", ""),
    players: [],
    leaderId: null,
    score: 0
  }));
  const players = room.players.filter((player) => player.approved);
  players.forEach((player, index) => {
    const team = room.teams[index % count];
    player.teamId = team.id;
    team.players.push(player.id);
    if (!team.leaderId) team.leaderId = player.id;
  });
  room.announcements.push("Teams zijn gemaakt.");
  return room;
}

export function startGame(store, code, hostToken) {
  const room = requireHost(store, code, hostToken);
  distributeUnassignedPlayers(room);
  if (room.teams.length < 2) throw userError("Maak teams voordat je het spel start.");
  if (room.teams.some((team) => team.players.length === 0)) throw userError("Elk team heeft minimaal een speler nodig.");
  room.status = "actief";
  room.currentRound = 1;
  room.currentTeamIndex = 0;
  room.announcements.push("Spel gestart.");
  return room;
}

export function pauseGame(store, code, hostToken) {
  const room = requireHost(store, code, hostToken);
  room.status = "gepauzeerd";
  room.announcements.push("Het spel is gepauzeerd.");
  return room;
}

export function resumeGame(store, code, hostToken) {
  const room = requireHost(store, code, hostToken);
  room.status = "actief";
  room.announcements.push("Het spel gaat verder.");
  return room;
}

export function startTurn(store, code, hostToken, input = {}) {
  const room = requireHost(store, code, hostToken);
  if (room.status !== "actief") throw userError("Start eerst het spel.");
  const team = room.teams[room.currentTeamIndex];
  const judgingTeam = getJudgingTeam(room, team.id);
  const describerPlayerId = input.describerPlayerId || team.players[room.currentRound % Math.max(team.players.length, 1)];
  const card = selectCard(store, room);
  const now = Date.now();
  room.currentTurn = {
    id: token("turn"),
    teamId: team.id,
    judgingTeamId: judgingTeam?.id || null,
    describerPlayerId,
    cardId: card.id,
    card,
    startedAt: new Date(now).toISOString(),
    endedAt: null,
    durationSeconds: Number(input.durationSeconds || room.settings.timerSeconds),
    endsAt: new Date(now + Number(input.durationSeconds || room.settings.timerSeconds) * 1000).toISOString(),
    wordResults: card.words.slice(0, room.settings.wordsPerCard).map((word) => ({ word, status: "pending", points: 0 })),
    points: 0,
    penaltyPoints: 0
  };
  room.usedCardIds.push(card.id);
  room.announcements.push(`${team.name} is aan de beurt. ${judgingTeam?.name || "Het andere team"} beoordeelt.`);
  return room;
}

export function updateWordResult(store, code, actor, word, status) {
  const room = requireJudge(store, code, actor);
  if (!room.currentTurn) throw userError("Er is nog geen beurt gestart.");
  const allowed = ["pending", "correct", "wrong", "skipped"];
  if (!allowed.includes(status)) throw userError("Deze woordstatus bestaat niet.");
  const result = room.currentTurn.wordResults.find((entry) => entry.word === word);
  if (!result) throw userError("Dit woord staat niet op de kaart.");
  if (status === "skipped" && !room.settings.allowSkips) throw userError("Overslaan staat uit.");
  const skipped = room.currentTurn.wordResults.filter((entry) => entry.status === "skipped").length;
  if (status === "skipped" && skipped >= room.settings.maxSkips && result.status !== "skipped") throw userError("Je hebt het maximum aantal skips bereikt.");
  result.status = status;
  result.points = status === "correct" ? 1 : status === "wrong" && room.settings.penaltyEnabled ? -Math.abs(room.settings.penaltyPoints) : 0;
  recomputeTurn(room);
  room.announcements.push(`Woord bijgewerkt: ${word} is ${translateStatus(status)}.`);
  return room;
}

export function endTurn(store, code, hostToken) {
  const room = requireJudge(store, code, hostToken);
  if (!room.currentTurn) throw userError("Er is geen actieve beurt.");
  room.currentTurn.endedAt = new Date().toISOString();
  recomputeTurn(room);
  room.announcements.push(`Tijd voorbij. ${teamById(room, room.currentTurn.teamId)?.name || "Het team"} heeft ${room.currentTurn.points} punten gescoord.`);
  return room;
}

export function nextTurn(store, code, hostToken) {
  const room = requireHost(store, code, hostToken);
  if (room.currentTurn) {
    recomputeTurn(room);
    const team = teamById(room, room.currentTurn.teamId);
    if (team) team.score += room.currentTurn.points;
    room.scoreHistory.push({
      id: token("history"),
      round: room.currentRound,
      teamId: room.currentTurn.teamId,
      teamName: team?.name || "Onbekend team",
      correctWords: room.currentTurn.wordResults.filter((word) => word.status === "correct").length,
      points: room.currentTurn.points,
      penaltyPoints: room.currentTurn.penaltyPoints,
      total: team?.score || 0
    });
  }
  room.currentTurn = null;
  if (room.teams.some((team) => team.score >= room.settings.targetScore) || room.currentRound >= room.settings.rounds && room.currentTeamIndex >= room.teams.length - 1) {
    return endGame(store, code, hostToken);
  }
  room.currentTeamIndex += 1;
  if (room.currentTeamIndex >= room.teams.length) {
    room.currentTeamIndex = 0;
    room.currentRound += 1;
    room.announcements.push("Nieuwe ronde gestart.");
  }
  room.announcements.push(`${room.teams[room.currentTeamIndex].name} is nu aan de beurt.`);
  return room;
}

export function correctScore(store, code, hostToken, teamId, score) {
  const room = requireHost(store, code, hostToken);
  const team = teamById(room, teamId);
  if (!team) throw userError("Dit team bestaat niet.");
  team.score = Number.isFinite(score) ? score : team.score;
  room.announcements.push(`Score bijgewerkt. ${team.name} heeft nu ${team.score} punten.`);
  return room;
}

export function endGame(store, code, hostToken) {
  const room = requireHost(store, code, hostToken);
  room.status = "afgelopen";
  const winner = [...room.teams].sort((a, b) => b.score - a.score)[0];
  room.announcements.push(`Gefeliciteerd ${winner?.name || "winnaars"}, jullie hebben gewonnen!`);
  return room;
}

export function sanitizeRoomForClient(room, role = "player", playerId = null) {
  const copy = structuredClone(room);
  delete copy.hostToken;
  if (role !== "host") {
    const judgingTeam = copy.currentTurn ? copy.teams.find((team) => team.id === copy.currentTurn.judgingTeamId) : null;
    const canSeeCard = copy.currentTurn?.describerPlayerId === playerId || judgingTeam?.leaderId === playerId;
    if (copy.currentTurn && !canSeeCard) {
      copy.currentTurn.card = null;
      copy.currentTurn.wordResults = [];
    }
  }
  return copy;
}

function recomputeTurn(room) {
  const turn = room.currentTurn;
  turn.points = turn.wordResults.reduce((sum, result) => sum + result.points, 0);
  turn.penaltyPoints = turn.wordResults.filter((result) => result.points < 0).reduce((sum, result) => sum + Math.abs(result.points), 0);
}

function selectCard(store, room) {
  const available = room.settings.cardsCanRepeat ? store.cards : store.cards.filter((card) => !room.usedCardIds.includes(card.id));
  const pool = available.length ? available : store.cards;
  if (room.settings.cardOrder === "sequence") return pool[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

function distributeUnassignedPlayers(room) {
  const players = room.players.filter((player) => player.approved && !player.teamId);
  for (const player of players) assignPlayerToSmallestTeam(room, player);
  for (const team of room.teams) if (!team.leaderId) team.leaderId = team.players[0] || null;
}

function assignPlayerToSmallestTeam(room, player) {
  if (!room.teams.length || !player.approved || player.teamId) return;
  const team = [...room.teams].sort((a, b) => a.players.length - b.players.length)[0];
  if (!team) return;
  player.teamId = team.id;
  if (!team.players.includes(player.id)) team.players.push(player.id);
  if (!team.leaderId) team.leaderId = player.id;
}

function requireHost(store, code, hostToken) {
  const room = getRoom(store, code);
  if (room.hostToken !== hostToken) throw userError("Alleen de host kan deze actie uitvoeren.", 403);
  return room;
}

function requireJudge(store, code, actor) {
  const room = getRoom(store, code);
  const hostToken = typeof actor === "string" ? actor : actor?.hostToken;
  const playerId = typeof actor === "string" ? null : actor?.playerId;
  if (hostToken && room.hostToken === hostToken) return room;
  if (!room.currentTurn) throw userError("Er is nog geen beurt gestart.");
  const judgingTeam = teamById(room, room.currentTurn.judgingTeamId);
  if (judgingTeam?.leaderId && judgingTeam.leaderId === playerId) return room;
  throw userError("Alleen de teamleider van het beoordelende team kan deze actie uitvoeren.", 403);
}

function getJudgingTeam(room, playingTeamId) {
  if (room.teams.length < 2) return null;
  const playingIndex = room.teams.findIndex((team) => team.id === playingTeamId);
  const judgeIndex = (playingIndex + 1) % room.teams.length;
  return room.teams[judgeIndex];
}

function getRoom(store, code) {
  const room = store.rooms.get(String(code || "").toUpperCase());
  if (!room) throw userError("Deze kamer bestaat niet meer.", 404);
  if (new Date(room.expiresAt).getTime() < Date.now()) throw userError("Deze kamer bestaat niet meer.", 410);
  return room;
}

function uniqueCode(store) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (store.rooms.has(code));
  return code;
}

function token(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function cleanName(value) {
  return cleanText(value).slice(0, 30).trim();
}

function cleanText(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function uniquePlayerName(room, name, ignoreId = null) {
  let next = name || "Speler";
  let count = 2;
  const exists = (candidate) => room.players.some((player) => player.id !== ignoreId && player.name.toLowerCase() === candidate.toLowerCase());
  while (exists(next)) next = `${name} ${count++}`;
  return next;
}

function translateStatus(status) {
  return { pending: "nog niet behandeld", correct: "goed", wrong: "fout", skipped: "overgeslagen" }[status] || status;
}

function teamById(room, teamId) {
  return room.teams.find((team) => team.id === teamId);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function userError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}
