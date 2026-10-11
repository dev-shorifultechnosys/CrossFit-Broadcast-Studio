/**
 * CrossFit Broadcast Studio local server
 * --------------------------------------
 * Zero external dependencies.
 *
 * Responsibilities:
 * 1. Serve the HTML/CSS/JS files.
 * 2. Keep the latest app state in memory.
 * 3. Synchronize all connected browsers / phones / OBS Browser Sources
 *    using Server-Sent Events (SSE).
 *
 * Start:
 *   node server.js
 *
 * Then open:
 *   http://localhost:8080/
 *   http://localhost:8080/overlay.html
 *   http://localhost:8080/remote.html
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const clients = new Set();
let latestState = {};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(value));
}

function broadcastState() {
  const payload = `event: state\ndata: ${JSON.stringify(latestState)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch {}
  }
}

function receiveBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeStaticPath(urlPath) {
  let filePath = decodeURIComponent(urlPath.split("?")[0]);
  if (filePath === "/") filePath = "/index.html";
  const resolved = path.resolve(ROOT, "." + filePath);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (url.pathname === "/api/state" && req.method === "GET") {
    return sendJson(res, 200, latestState);
  }

  if (url.pathname === "/api/state" && req.method === "POST") {
    try {
      const body = await receiveBody(req);
      latestState = JSON.parse(body || "{}");
      broadcastState();
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  if (url.pathname === "/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    res.write(": connected\n\n");
    clients.add(res);

    if (Object.keys(latestState).length) {
      res.write(`event: state\ndata: ${JSON.stringify(latestState)}\n\n`);
    }

    req.on("close", () => clients.delete(res));
    return;
  }

  const file = safeStaticPath(url.pathname);
  if (!file) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }

    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("CrossFit Broadcast Studio");
  console.log("-------------------------");
  console.log(`Control: http://localhost:${PORT}/`);
  console.log(`Overlay: http://localhost:${PORT}/overlay.html`);
  console.log(`Remote : http://localhost:${PORT}/remote.html`);

  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        console.log(`LAN    : http://${net.address}:${PORT}/remote.html`);
      }
    }
  }
  console.log("");
});
