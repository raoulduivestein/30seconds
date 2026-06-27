import assert from "node:assert/strict";
import {
  createGameStore,
  createRoom,
  joinRoom,
  createTeams,
  startGame,
  startTurn,
  updateWordResult,
  nextTurn,
  sanitizeRoomForClient
} from "../src/gameCore.js";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("kamer aanmaken", () => {
  const store = createGameStore();
  const room = createRoom(store, { name: "Test" });
  assert.equal(room.name, "Test");
  assert.equal(room.status, "lobby");
  assert.ok(room.code.length >= 5);
});

test("speler aanmelden en dubbele naam nummeren", () => {
  const store = createGameStore();
  const room = createRoom(store, {});
  const first = joinRoom(store, room.code, { name: "<b>Marvin</b>" });
  const second = joinRoom(store, room.code, { name: "Marvin" });
  assert.equal(first.player.name, "Marvin");
  assert.equal(second.player.name, "Marvin 2");
});

test("teams automatisch maken", () => {
  const store = createGameStore();
  const room = createRoom(store, {});
  ["A", "B", "C", "D"].forEach((name) => joinRoom(store, room.code, { name }));
  createTeams(store, room.code, room.hostToken, { teamCount: 2 });
  assert.equal(room.teams.length, 2);
  assert.equal(room.teams.reduce((sum, team) => sum + team.players.length, 0), 5);
  assert.ok(room.teams[0].leaderId);
});

test("host wordt ook als speler in een team ingedeeld", () => {
  const store = createGameStore();
  const room = createRoom(store, {});
  joinRoom(store, room.code, { name: "A" });
  createTeams(store, room.code, room.hostToken, { teamCount: 2 });
  const host = room.players.find((player) => player.role === "host");
  assert.ok(host.teamId);
  assert.equal(room.teams.some((team) => team.players.includes(host.id)), true);
});

test("speler na teamindeling komt automatisch in kleinste team", () => {
  const store = createGameStore();
  const room = createRoom(store, {});
  ["A", "B"].forEach((name) => joinRoom(store, room.code, { name }));
  createTeams(store, room.code, room.hostToken, { teamCount: 2 });
  const joined = joinRoom(store, room.code, { name: "C" });
  assert.ok(joined.player.teamId);
  assert.equal(room.teams.reduce((sum, team) => sum + team.players.length, 0), 4);
});

test("spel starten deelt nog niet ingedeelde spelers eerst in", () => {
  const store = createGameStore();
  const room = createRoom(store, {});
  createTeams(store, room.code, room.hostToken, { teamCount: 2 });
  ["A", "B"].forEach((name) => joinRoom(store, room.code, { name }));
  startGame(store, room.code, room.hostToken);
  assert.equal(room.status, "actief");
  assert.equal(room.teams.every((team) => team.players.length > 0), true);
});

test("spel starten zonder teams geeft fout", () => {
  const store = createGameStore();
  const room = createRoom(store, {});
  assert.throws(() => startGame(store, room.code, room.hostToken), /Maak teams/);
});

test("timer telt af via eindtijd", () => {
  const store = createGameStore();
  const room = readyRoom(store);
  startTurn(store, room.code, room.hostToken, { durationSeconds: 15 });
  assert.equal(room.currentTurn.durationSeconds, 15);
  assert.ok(new Date(room.currentTurn.endsAt).getTime() > Date.now());
});

test("woord goedkeuren verhoogt score en overslaan geeft geen punt", () => {
  const store = createGameStore();
  const room = readyRoom(store);
  startTurn(store, room.code, room.hostToken);
  const [first, second] = room.currentTurn.wordResults;
  updateWordResult(store, room.code, room.hostToken, first.word, "correct");
  updateWordResult(store, room.code, room.hostToken, second.word, "skipped");
  assert.equal(room.currentTurn.points, 1);
});

test("leider van beoordelend team mag woorden beoordelen", () => {
  const store = createGameStore();
  const room = readyRoom(store);
  startTurn(store, room.code, room.hostToken);
  const judgingTeam = room.teams.find((team) => team.id === room.currentTurn.judgingTeamId);
  const [first] = room.currentTurn.wordResults;
  updateWordResult(store, room.code, { playerId: judgingTeam.leaderId }, first.word, "correct");
  assert.equal(room.currentTurn.points, 1);
});

test("gewone speler mag niet beoordelen", () => {
  const store = createGameStore();
  const room = readyRoom(store);
  startTurn(store, room.code, room.hostToken);
  const playingTeam = room.teams.find((team) => team.id === room.currentTurn.teamId);
  const [first] = room.currentTurn.wordResults;
  assert.throws(() => updateWordResult(store, room.code, { playerId: playingTeam.leaderId }, first.word, "correct"), /teamleider van het beoordelende team/);
});

test("strafpunten werken als instelling aanstaat", () => {
  const store = createGameStore();
  const room = readyRoom(store, { penaltyEnabled: true, penaltyPoints: 2 });
  startTurn(store, room.code, room.hostToken);
  const [first] = room.currentTurn.wordResults;
  updateWordResult(store, room.code, room.hostToken, first.word, "wrong");
  assert.equal(room.currentTurn.points, -2);
});

test("eindscore wordt correct bepaald", () => {
  const store = createGameStore();
  const room = readyRoom(store, { targetScore: 1 });
  startTurn(store, room.code, room.hostToken);
  updateWordResult(store, room.code, room.hostToken, room.currentTurn.wordResults[0].word, "correct");
  nextTurn(store, room.code, room.hostToken);
  assert.equal(room.status, "afgelopen");
});

test("hostacties zijn beschermd", () => {
  const store = createGameStore();
  const room = createRoom(store, {});
  assert.throws(() => createTeams(store, room.code, "verkeerd", { teamCount: 2 }), /Alleen de host/);
});

test("screenreader live message wordt bijgewerkt in announcements", () => {
  const store = createGameStore();
  const room = createRoom(store, {});
  joinRoom(store, room.code, { name: "Noor" });
  assert.match(room.announcements.at(-1), /Noor is aangemeld/);
});

test("kaart is afgeschermd voor gewone spelers", () => {
  const store = createGameStore();
  const room = readyRoom(store);
  startTurn(store, room.code, room.hostToken);
  const safe = sanitizeRoomForClient(room, "player", "ander-id");
  assert.equal(safe.currentTurn.card, null);
  assert.equal(safe.currentTurn.wordResults.length, 0);
});

test("beoordelende teamleider ziet kaart om te kunnen beoordelen", () => {
  const store = createGameStore();
  const room = readyRoom(store);
  startTurn(store, room.code, room.hostToken);
  const judgingTeam = room.teams.find((team) => team.id === room.currentTurn.judgingTeamId);
  const safe = sanitizeRoomForClient(room, "player", judgingTeam.leaderId);
  assert.ok(safe.currentTurn.card);
  assert.equal(safe.currentTurn.wordResults.length, 5);
});

function readyRoom(store, settings = {}) {
  const room = createRoom(store, { settings: { rounds: 2, targetScore: 30, ...settings } });
  ["A", "B", "C", "D"].forEach((name) => joinRoom(store, room.code, { name }));
  createTeams(store, room.code, room.hostToken, { teamCount: 2 });
  startGame(store, room.code, room.hostToken);
  return room;
}

let failed = 0;
for (const item of tests) {
  try {
    item.fn();
    console.log(`ok - ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${item.name}`);
    console.error(error);
  }
}

if (failed) {
  console.error(`${failed} test(s) mislukt.`);
  process.exit(1);
}

console.log(`${tests.length} tests geslaagd.`);
