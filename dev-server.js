// ローカル確認用の最小静的サーバー。本番は GitHub Pages が docs/ を配信する。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const PORT = process.env.PORT || 3100;
const DOCS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'docs');

const app = express();
app.use(express.static(DOCS_DIR));
app.listen(PORT, () => {
  console.log(`dev server: http://localhost:${PORT}`);
});
