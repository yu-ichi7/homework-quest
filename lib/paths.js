import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

export function dataFile(name) {
  return path.join(DATA_DIR, name);
}

export const CHILDREN_FILE = dataFile('children.json');
export const TASKS_FILE = dataFile('tasks.json');
export const COMPLETIONS_FILE = dataFile('completions.json');
export const CONFIG_FILE = dataFile('config.json');
