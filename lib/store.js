import { readJson, writeJson, updateJson } from './jsonStore.js';
import { CHILDREN_FILE, TASKS_FILE, COMPLETIONS_FILE, CONFIG_FILE } from './paths.js';
import { DEFAULT_CONFIG, DEFAULT_CHILDREN, DEFAULT_TASKS } from './defaults.js';

// 初回起動時、データファイルが無ければデフォルトをシードする。
export async function ensureSeed() {
  const now = new Date().toISOString();

  if ((await readJson(CONFIG_FILE, null)) === null) {
    await writeJson(CONFIG_FILE, DEFAULT_CONFIG);
  }
  if ((await readJson(CHILDREN_FILE, null)) === null) {
    await writeJson(CHILDREN_FILE, DEFAULT_CHILDREN.map((c) => ({ ...c, createdAt: now })));
  }
  if ((await readJson(TASKS_FILE, null)) === null) {
    await writeJson(TASKS_FILE, DEFAULT_TASKS.map((t) => ({ ...t, createdAt: now })));
  }
  if ((await readJson(COMPLETIONS_FILE, null)) === null) {
    await writeJson(COMPLETIONS_FILE, []);
  }
}

export const getConfig = () => readJson(CONFIG_FILE, DEFAULT_CONFIG);
export const getChildren = () => readJson(CHILDREN_FILE, []);
export const getTasks = () => readJson(TASKS_FILE, []);
export const getCompletions = () => readJson(COMPLETIONS_FILE, []);

export const updateChildren = (mutator) => updateJson(CHILDREN_FILE, [], mutator);
export const updateTasks = (mutator) => updateJson(TASKS_FILE, [], mutator);
export const updateCompletions = (mutator) => updateJson(COMPLETIONS_FILE, [], mutator);
export const updateConfig = (mutator) => updateJson(CONFIG_FILE, DEFAULT_CONFIG, mutator);
