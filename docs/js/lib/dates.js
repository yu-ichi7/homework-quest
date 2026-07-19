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

// 月キー（YYYY-MM）。目標がどの月のものかを表す。
export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

// 月曜始まりの週の、開始日（月曜）・終了日（日曜）を返す。
export function weekRange(dateStr) {
  const dow = dayOfWeek(dateStr); // 0=日..6=土
  const backToMonday = (dow + 6) % 7; // 月曜まで戻る日数
  const start = addDays(dateStr, -backToMonday);
  const end = addDays(start, 6);
  return { start, end };
}

// 週キー（月曜始まり、ISO風 YYYY-Www）。同じ週の全日付で同じ値になる。
export function weekKey(dateStr) {
  const { start } = weekRange(dateStr);
  // その週の木曜が属する年をISO年として採用する。
  const thursday = addDays(start, 3);
  const isoYear = Number(thursday.slice(0, 4));
  // isoYear の 1/4 を含む週の月曜を第1週の起点にする。
  const jan4 = `${isoYear}-01-04`;
  const firstMonday = weekRange(jan4).start;
  const days = Math.round(
    (new Date(start) - new Date(firstMonday)) / (24 * 60 * 60 * 1000),
  );
  const week = Math.floor(days / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
