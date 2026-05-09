import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { calculateSeason } from "./calculate.mjs";
import { importFromMaccabi } from "./importers/maccabi-importer.mjs";
import { parseManualImport } from "./importers/manual-importer.mjs";
import { readData, writeData } from "./storage.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(__dirname, "..", "public");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

export function createApp() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, {
          ok: true,
          service: "maccabicheck",
          marker: "maccabicheck",
          port: Number(process.env.PORT || 3005)
        });
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        const data = await readData();
        const season = calculateSeason(data.matches);
        return sendJson(response, 200, {
          generatedAt: data.generatedAt,
          sourcePolicy: data.sourcePolicy,
          importStatus: data.importStatus,
          totals: season.totals
        });
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        const data = await readData();
        const season = calculateSeason(data.matches);
        return sendJson(response, 200, {
          generatedAt: data.generatedAt,
          sourcePolicy: data.sourcePolicy,
          importStatus: data.importStatus,
          totals: season.totals,
          players: season.players,
          matches: season.matches.map(stripHeavyPlayerStats)
        });
      }

      if (request.method === "GET" && url.pathname === "/api/matches") {
        const data = await readData();
        const season = calculateSeason(data.matches);
        return sendJson(response, 200, season.matches.map(stripHeavyPlayerStats));
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/matches/")) {
        const matchId = decodeURIComponent(url.pathname.slice("/api/matches/".length));
        const data = await readData();
        const match = calculateSeason(data.matches).matches.find((item) => item.matchId === matchId);
        if (!match) return sendJson(response, 404, { error: "Match not found" });
        return sendJson(response, 200, match);
      }

      if (request.method === "GET" && url.pathname === "/api/players") {
        const data = await readData();
        return sendJson(response, 200, calculateSeason(data.matches).players);
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/players/")) {
        const playerId = decodeURIComponent(url.pathname.slice("/api/players/".length));
        const data = await readData();
        const player = calculateSeason(data.matches).players.find((item) => item.playerId === playerId);
        if (!player) return sendJson(response, 404, { error: "Player not found" });
        return sendJson(response, 200, player);
      }

      if (request.method === "POST" && url.pathname === "/api/import/refresh") {
        const data = await importFromMaccabi();
        await writeData(data);
        return sendJson(response, 200, {
          ok: true,
          importStatus: data.importStatus,
          totals: calculateSeason(data.matches).totals
        });
      }

      if (request.method === "POST" && url.pathname === "/api/import/manual") {
        const body = await readRequestBody(request);
        const contentType = request.headers["content-type"] || "application/json";
        const payload = contentType.includes("application/json") ? safeJsonParse(body) : body;
        const data = parseManualImport(payload, contentType);
        await writeData(data);
        return sendJson(response, 200, {
          ok: true,
          importStatus: data.importStatus,
          totals: calculateSeason(data.matches).totals
        });
      }

      if (!url.pathname.startsWith("/api/")) {
        return serveStatic(response, url.pathname);
      }

      return sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      console.error(error);
      return sendJson(response, 500, { error: error.message || "Internal server error" });
    }
  });
}

async function serveStatic(response, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(PUBLIC_DIR, `.${normalize(requested)}`);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(response, 403, "Forbidden");
  }

  try {
    const info = await stat(filePath);
    if (info.isFile()) {
      response.writeHead(200, {
        "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
        "cache-control": "no-cache"
      });
      createReadStream(filePath).pipe(response);
      return;
    }
  } catch {}

  const indexPath = join(PUBLIC_DIR, "index.html");
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache"
  });
  createReadStream(indexPath).pipe(response);
}

function safeJsonParse(body) {
  try {
    return JSON.parse(body || "{}");
  } catch (error) {
    throw new Error(`Invalid JSON body: ${error.message}`);
  }
}

function readRequestBody(request) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolveBody(body));
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-cache"
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-cache"
  });
  response.end(text);
}

function stripHeavyPlayerStats(match) {
  const { playerStats, ...rest } = match;
  return rest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3005);
  createApp().listen(port, () => {
    console.log(`maccabicheck listening on http://127.0.0.1:${port}`);
  });
}
