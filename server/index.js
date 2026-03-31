const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '../public');
const DB_FILE = path.join(__dirname, 'scores.json');

// ─── Simple JSON "database" ──────────────────────────────────────────────────
function readScores() {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) { return []; }
}

function writeScores(scores) {
  fs.writeFileSync(DB_FILE, JSON.stringify(scores, null, 2));
}

// ─── MIME types ──────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ─── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API Routes ──────────────────────────────────────────────────────────────
  if (pathname === '/api/scores') {
    if (req.method === 'GET') {
      // Return top 20 scores sorted by deaths asc, then time asc
      const scores = readScores()
        .sort((a, b) => a.deaths - b.deaths || a.time - b.time)
        .slice(0, 20);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(scores));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const name = String(data.name || 'Anonymous').slice(0, 20).replace(/[<>]/g, '');
          const deaths = Math.max(0, parseInt(data.deaths) || 0);
          const time = Math.max(0, parseInt(data.time) || 0);

          const scores = readScores();
          scores.push({ name, deaths, time, date: new Date().toISOString() });
          writeScores(scores);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid data' }));
        }
      });
      return;
    }
  }

  // ── Static file serving ─────────────────────────────────────────────────────
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, html) => {
          if (err2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
        });
      } else {
        res.writeHead(500); res.end('Server error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   🔴 LEVEL DEVIL Server Running!     ║
║   http://localhost:${PORT}              ║
╚══════════════════════════════════════╝
  `);
});
