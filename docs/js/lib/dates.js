// ローカルタイム基準の日付ユーティリティ（手元PCで動かす前提）。

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

// YYYY-MM-DD の曜日（0=日, 1=月, ... 6=土）。
export function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

// dateStr の n 日前（負なら過去）を YYYY-MM-DD で返す。
export function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toDateStr(dt);
}
