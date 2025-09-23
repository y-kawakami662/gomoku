// Minimal static file server for local debugging
// Serves files from the workspace root at http://localhost:3000

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname; // serve from workspace root
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const mime = new Map([
  ['.html', 'text/html; charset=UTF-8'],
  ['.js', 'text/javascript; charset=UTF-8'],
  ['.mjs', 'text/javascript; charset=UTF-8'],
  ['.css', 'text/css; charset=UTF-8'],
  ['.json', 'application/json; charset=UTF-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.wasm', 'application/wasm'],
  ['.vrm', 'application/octet-stream']
]);

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url || '/', `http://${req.headers.host}`).pathname);
    let filePath = path.normalize(path.join(root, urlPath));

    // Prevent directory traversal
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    // If directory, serve index.html
    const stat = await fs.stat(filePath).catch(() => undefined);
    if (!stat || stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = mime.get(ext) || 'application/octet-stream';
    const data = await fs.readFile(filePath);

    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${port}`);
});

