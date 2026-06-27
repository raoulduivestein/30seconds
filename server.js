import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGameStore,
  createRoom,
  joinRoom,
  removePlayer,
  renamePlayer,
  createTeams,
  startGame,
  pauseGame,
  resumeGame,
  startTurn,
  updateWordResult,
  endTurn,
  nextTurn,
  correctScore,
  endGame,
  sanitizeRoomForClient
} from "./src/gameCore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const store = createGameStore();
const sseClients = new Map();

seedTestRoom();

function seedTestRoom() {
  const room = createRoom(store, {
    name: "Testkamer Clubhouse",
    hostName: "Demo host",
    settings: { timerSeconds: 30, rounds: 3, teamCount: 4, accessibilityDefault: true }
  });
  const names = [
    "Marvin", "Sanne", "Fatima", "Jeroen", "Noor", "Daan", "Lina", "Ahmed", "Eva", "Milan",
    "Iris", "Sam", "Tess", "Bram", "Yara", "Nora", "Joost", "Kim", "Ravi", "Bo"
  ];
  for (const name of names) joinRoom(store, room.code, { name });
  createTeams(store, room.code, room.hostToken, { teamCount: 4, mode: "auto" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", app: "30-seconds-clubhouse" });
      return;
    }
    if (url.pathname.startsWith("/events/")) {
      handleEvents(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.status ? error.message : "Er ging iets mis op de server.", detail: String(error?.message || error) });
  }
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/rooms") {
    const code = String(url.searchParams.get("code") || "").toUpperCase();
    const room = store.rooms.get(code);
    if (!room) return sendJson(res, 404, { error: "Deze kamer bestaat niet meer." });
    return sendJson(res, 200, { room: sanitizeRoomForClient(room, getClientRole(req, room), getPlayerId(req)) });
  }

  const body = req.method === "GET" ? {} : await readBody(req);
  let result;
  switch (url.pathname) {
    case "/api/create-room":
      result = createRoom(store, body);
      broadcast(result.code, "room.created");
      return sendJson(res, 201, { room: sanitizeRoomForClient(result, "host"), hostToken: result.hostToken });
    case "/api/join-room":
      result = joinRoom(store, String(body.code || ""), body);
      broadcast(result.room.code, "player.joined");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result.room, "player", result.player.id), player: result.player, message: result.message });
    case "/api/remove-player":
      result = removePlayer(store, body.code, getHostToken(req), body.playerId);
      broadcast(result.code, "player.removed");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/rename-player":
      result = renamePlayer(store, body.code, getHostToken(req), body.playerId, body.name);
      broadcast(result.code, "player.updated");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/create-teams":
      result = createTeams(store, body.code, getHostToken(req), body);
      broadcast(result.code, "teams.updated");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/start-game":
      result = startGame(store, body.code, getHostToken(req));
      broadcast(result.code, "game.started");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/pause-game":
      result = pauseGame(store, body.code, getHostToken(req));
      broadcast(result.code, "game.paused");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/resume-game":
      result = resumeGame(store, body.code, getHostToken(req));
      broadcast(result.code, "game.resumed");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/start-turn":
      result = startTurn(store, body.code, getHostToken(req), body);
      broadcast(result.code, "turn.started");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/update-word":
      result = updateWordResult(store, body.code, getActor(req), body.word, body.status);
      broadcast(result.code, "word.updated");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/end-turn":
      result = endTurn(store, body.code, getActor(req));
      broadcast(result.code, "turn.ended");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/next-turn":
      result = nextTurn(store, body.code, getHostToken(req));
      broadcast(result.code, "score.updated");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/correct-score":
      result = correctScore(store, body.code, getHostToken(req), body.teamId, Number(body.score));
      broadcast(result.code, "score.updated");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    case "/api/end-game":
      result = endGame(store, body.code, getHostToken(req));
      broadcast(result.code, "game.ended");
      return sendJson(res, 200, { room: sanitizeRoomForClient(result, "host") });
    default:
      return sendJson(res, 404, { error: "Deze actie bestaat niet." });
  }
}

function handleEvents(req, res, url) {
  const code = url.pathname.split("/").pop()?.toUpperCase();
  if (!code || !store.rooms.has(code)) {
    sendJson(res, 404, { error: "Deze kamer bestaat niet meer." });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(`event: connected\ndata: {"message":"Verbonden met kamer ${code}."}\n\n`);
  if (!sseClients.has(code)) sseClients.set(code, new Set());
  sseClients.get(code).add(res);
  req.on("close", () => sseClients.get(code)?.delete(res));
}

function broadcast(code, event) {
  const room = store.rooms.get(code);
  if (!room) return;
  const data = JSON.stringify({ event, room: sanitizeRoomForClient(room, "player") });
  for (const client of sseClients.get(code) || []) {
    client.write(`event: ${event}\ndata: ${data}\n\n`);
  }
}

async function serveStatic(_req, res, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const directFile = path.join(publicDir, pathname);
  const file = pathname.includes(".") ? directFile : path.join(publicDir, "index.html");
  if (!file.startsWith(publicDir)) return sendJson(res, 403, { error: "Geen toegang." });
  try {
    const buffer = await readFile(file);
    res.writeHead(200, { "Content-Type": contentType(file) });
    res.end(buffer);
  } catch {
    const index = await readFile(path.join(publicDir, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(index);
  }
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  return "text/plain; charset=utf-8";
}

function getHostToken(req) {
  return String(req.headers["x-host-token"] || "");
}

function getClientRole(req, room) {
  return getHostToken(req) === room.hostToken ? "host" : "player";
}

function getPlayerId(req) {
  return String(req.headers["x-player-id"] || "");
}

function getActor(req) {
  return { hostToken: getHostToken(req), playerId: getPlayerId(req) };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

server.listen(port, () => {
  console.log(`30 Seconds Clubhouse draait op http://localhost:${port}`);
});
