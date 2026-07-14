import fs from 'node:fs/promises';
import path from 'node:path';

// illusto の lib/jsonStore.js から流用。ファイルロック + temp→rename の
// アトミック書き込みで、同時アクセス時もデータが壊れないようにする。
const locks = new Map();

async function withLock(filePath, fn) {
  const prev = locks.get(filePath) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => { release = resolve; });
  locks.set(filePath, prev.then(() => next));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(filePath) === next) locks.delete(filePath);
  }
}

export async function readJson(filePath, fallback) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(filePath, value) {
  return withLock(filePath, async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(tmpPath, filePath);
  });
}

export async function updateJson(filePath, fallback, mutator) {
  return withLock(filePath, async () => {
    let current;
    try {
      const text = await fs.readFile(filePath, 'utf8');
      current = JSON.parse(text);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      current = fallback;
    }
    const next = await mutator(current);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(next, null, 2), 'utf8');
    await fs.rename(tmpPath, filePath);
    return next;
  });
}
