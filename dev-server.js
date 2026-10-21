// ローカル確認用の最小静的サーバー。本番は GitHub Pages が docs/ を配信する。
// 同じWi-Fiにつないだスマホからも開けるよう、LAN内のすべての端末からの接続を受け付ける。
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const PORT = process.env.PORT || 3100;
const DOCS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'docs');

// このPCのLAN内IPv4アドレス（例: 192.168.1.23）を列挙する
function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

const app = express();
// 編集した内容をスマホで再読み込みしたときにすぐ反映させるため、ブラウザにキャッシュさせない
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(DOCS_DIR, { etag: false, lastModified: false }));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`dev server: http://localhost:${PORT}`);
  const ips = lanAddresses();
  if (ips.length) {
    console.log('スマホで見るとき（PCと同じWi-Fiにつなぐ）:');
    for (const ip of ips) console.log(`  http://${ip}:${PORT}`);
  }
});
