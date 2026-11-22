"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const PORT = parseInt(process.env.PORT || "8765", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".ttf": "font/ttf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".ogg": "audio/ogg"
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8")); }
  catch { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf8");
}
function sendJson(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; if (raw.length > 262144) req.destroy(); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}

async function handleApi(req, res, apiPath) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }
  if (apiPath === "/api/health" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, game: "dungeon-survivor-3d", version: "v2.0" });
  }
  if (apiPath === "/api/config" && req.method === "GET") {
    return sendJson(res, 200, readJson("config.json", {}));
  }
  if (apiPath === "/api/profile" && req.method === "GET") {
    return sendJson(res, 200, readJson("profile.json", {}));
  }
  if (apiPath === "/api/profile" && req.method === "POST") {
    const body = await readBody(req);
    const cur = readJson("profile.json", {});
    const updated = {
      gold: typeof body.gold === "number" ? Math.max(0, Math.round(body.gold)) : (cur.gold ?? 150),
      unlockedHeroes: Array.isArray(body.unlockedHeroes) && body.unlockedHeroes.length ? body.unlockedHeroes : (cur.unlockedHeroes || ["knight"]),
      metaLevels: body.metaLevels && typeof body.metaLevels === "object" ? body.metaLevels : (cur.metaLevels || {}),
      discoveredScrolls: Array.from(new Set([...(cur.discoveredScrolls || []), ...(Array.isArray(body.discoveredScrolls) ? body.discoveredScrolls : [])])),
      bestTimeSec: Math.max(cur.bestTimeSec || 0, Number(body.bestTimeSec) || 0),
      bestKills: Math.max(cur.bestKills || 0, Number(body.bestKills) || 0),
      lang: body.lang || cur.lang || "vi",
      quality: body.quality || cur.quality || "balanced"
    };
    writeJson("profile.json", updated);
    return sendJson(res, 200, updated);
  }
  if (apiPath === "/api/leaderboard" && req.method === "GET") {
    return sendJson(res, 200, readJson("leaderboard.json", []));
  }
  if (apiPath === "/api/leaderboard" && req.method === "POST") {
    const body = await readBody(req);
    const list = readJson("leaderboard.json", []);
    list.push({
      name: String(body.name || "Warrior").slice(0, 24),
      hero: String(body.hero || "knight"),
      timeSec: Math.round(Number(body.timeSec) || 0),
      kills: Number(body.kills) || 0,
      level: Number(body.level) || 1,
      win: !!body.win,
      date: new Date().toISOString().slice(0, 10)
    });
    list.sort((a, b) => (b.win - a.win) || (b.timeSec - a.timeSec) || (b.kills - a.kills));
    const top = list.slice(0, 10);
    writeJson("leaderboard.json", top);
    return sendJson(res, 200, top);
  }
  return sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, pathname) {
  let cleanPath = decodeURIComponent(pathname.split("?")[0]);
  if (cleanPath === "/") cleanPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT_DIR, cleanPath));
  if (!filePath.startsWith(ROOT_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": mime,
      "Cache-Control": /\.(glb|ttf|jpg|png|ogg)$/.test(ext) ? "public, max-age=86400" : "no-cache"
    };
    const ae = req.headers["accept-encoding"] || "";
    const compressible = /\.(html|css|js|json|glb|ttf)$/.test(ext);
    if (compressible && ae.includes("gzip") && stat.size > 1024) {
      headers["Content-Encoding"] = "gzip";
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 4 })).pipe(res);
    } else {
      headers["Content-Length"] = stat.size;
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

if (require.main === module) {
  const server = http.createServer((req, res) => {
    const urlPath = (req.url || "/").split("?")[0];
    if (urlPath.startsWith("/api/")) return handleApi(req, res, urlPath);
    return serveStatic(req, res, urlPath);
  });
  server.listen(PORT, () => console.log(`Dungeon Survivor 3D Backend listening on http://localhost:${PORT}`));
}

module.exports = { handleApi, serveStatic, ROOT_DIR };
