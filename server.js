import os from 'node:os';
import express from 'express';
import { PUBLIC_DIR } from './lib/paths.js';
import { ensureSeed } from './lib/store.js';
import { router as childrenRouter } from './routes/children.js';
import { router as tasksRouter } from './routes/tasks.js';
import { router as completionsRouter } from './routes/completions.js';
import { router as statsRouter } from './routes/stats.js';
import { router as configRouter } from './routes/config.js';

const PORT = process.env.PORT || 3100;

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ name: 'homework-quest', status: 'ok', time: new Date().toISOString() });
});

app.use('/api/children', childrenRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/completions', completionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/config', configRouter);

app.use(express.static(PUBLIC_DIR));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'internal error' });
});

// 同じWi-Fi内のスマホ/タブレットからアクセスできるよう、
// ローカルのLAN IPアドレスを列挙してURLを表示する。
function lanUrls() {
  const nets = os.networkInterfaces();
  const urls = [];
  for (const iface of Object.values(nets)) {
    for (const net of iface || []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${PORT}`);
      }
    }
  }
  return urls;
}

await ensureSeed();
// '0.0.0.0' で全インターフェースを待ち受け（他端末からアクセス可能に）。
app.listen(PORT, '0.0.0.0', () => {
  console.log(`homework-quest listening:`);
  console.log(`  このPC:   http://localhost:${PORT}`);
  for (const url of lanUrls()) {
    console.log(`  スマホ等: ${url}   (同じWi-Fi内)`);
  }
});
