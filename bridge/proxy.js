import http from "node:http";
import httpProxy from "http-proxy";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TARGET  = "http://localhost:5173";
const PORT    = 47821;
const __dir   = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(path.join(__dir, "../desktop/version.json"), "utf8"));

const API = {
  "/api/version": () => VERSION,
  "/api/bridge/status": () => ({ running: false, pid: null }),
  "/api/settings": () => ({}),
};

const proxy = httpProxy.createProxyServer({ target: TARGET, ws: true });
proxy.on("error", (err, req, res) => {
  res?.writeHead?.(502, { "Content-Type": "application/json" });
  res?.end?.(JSON.stringify({ error: "Tauri dev server nem fut (5173)" }));
});

const server = http.createServer((req, res) => {
  const url = req.url?.split("?")[0];
  if (API[url]) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(API[url]()));
    return;
  }
  proxy.web(req, res);
});

server.on("upgrade", (req, socket, head) => proxy.ws(req, socket, head));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[proxy] 0.0.0.0:${PORT} → ${TARGET} | /api/version aktív`);
});
