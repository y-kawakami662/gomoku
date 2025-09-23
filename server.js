// ローカルデバッグ用の簡易静的ファイルサーバ
// ワークスペース直下を http://localhost:3000 で配信します

import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname; // ワークスペースルートから配信
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// 拡張子から Content-Type を引くためのマップ
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

    // ディレクトリトラバーサル防止
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    // ディレクトリが指定された場合は index.html を返す
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
    // 見つからなかった場合
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${port}`);
});
