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

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(Buffer.concat(chunks)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// VOICEVOX エンジン用の簡易プロキシ
async function proxyVoiceVox(req, res, urlPath) {
  const base = 'http://127.0.0.1:50021';
  // CORS (GitHub Pages など別オリジンからのアクセス許可)
  const setCORS = (headers = {}) => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  });
  if (req.method === 'OPTIONS' && urlPath.startsWith('/api/voicevox/')) {
    res.writeHead(204, setCORS());
    res.end();
    return true;
  }
  try {
    if (urlPath === '/api/voicevox/speakers' && req.method === 'GET') {
      const r = await fetch(base + '/speakers');
      if (!r.ok) throw new Error(`VOICEVOX /speakers failed: ${r.status}`);
      const json = await r.json();
      res.writeHead(200, setCORS({ 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-cache' }));
      res.end(JSON.stringify(json));
      return true;
    }
    if (urlPath === '/api/voicevox/tts' && req.method === 'POST') {
      const buf = await readBody(req);
      const payload = JSON.parse(buf.toString('utf8') || '{}');
      const text = String(payload.text || '').slice(0, 1000);
      const speaker = Number(payload.speaker ?? 1) | 0;
      if (!text) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=UTF-8' });
        res.end(JSON.stringify({ error: 'text required' }));
        return true;
      }
      const aqUrl = new URL(base + '/audio_query');
      aqUrl.searchParams.set('text', text);
      aqUrl.searchParams.set('speaker', String(speaker));
      const aqRes = await fetch(aqUrl, { method: 'POST' });
      if (!aqRes.ok) throw new Error(`VOICEVOX /audio_query failed: ${aqRes.status}`);
      const aq = await aqRes.json();
      const opts = ['speedScale','pitchScale','intonationScale','volumeScale'];
      for (const k of opts) if (payload[k] != null) aq[k] = payload[k];
      const synUrl = new URL(base + '/synthesis');
      synUrl.searchParams.set('speaker', String(speaker));
      const synRes = await fetch(synUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aq) });
      if (!synRes.ok) throw new Error(`VOICEVOX /synthesis failed: ${synRes.status}`);
      const wav = Buffer.from(await synRes.arrayBuffer());
      res.writeHead(200, setCORS({ 'Content-Type': 'audio/wav', 'Cache-Control': 'no-cache' }));
      res.end(wav);
      return true;
    }
  } catch (err) {
    res.writeHead(503, setCORS({ 'Content-Type': 'application/json; charset=UTF-8' }));
    res.end(JSON.stringify({ error: 'VOICEVOX unavailable', detail: String(err && err.message || err) }));
    return true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url || '/', `http://${req.headers.host}`).pathname);

    // VOICEVOX proxy endpoints
    if (urlPath.startsWith('/api/voicevox/')) {
      const handled = await proxyVoiceVox(req, res, urlPath);
      if (handled) return;
    }
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
