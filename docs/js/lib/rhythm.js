// リズムゲームの純粋ロジック。localStorage・DOM・Web Audio には触れない。
//
// 曲データが持つのは melody（旋律）だけで、叩く譜面（ノーツ）はそこから機械的に組み立てる。
// こうしておくと「鳴っている音」と「流れてくるノーツ」が原理的にズレない。

const NOTE_INDEX = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

// 'A4' → MIDIノート番号（A4 = 69）。
export function noteMidi(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return 69;
  return NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
}

// 'A4' → 周波数(Hz)。平均律。
export function noteFreq(name) {
  return 440 * (2 ** ((noteMidi(name) - 69) / 12));
}

// 拍 → 秒。
export function beatToSec(beat, bpm) {
  return (beat / bpm) * 60;
}

// melody を repeat 回ぶんに伸ばす。[拍, 音名, 長さ(拍)] → {beat, name, dur}。
export function expandMelody(song) {
  const out = [];
  const repeat = song.repeat || 1;
  for (let r = 0; r < repeat; r += 1) {
    const offset = r * song.lengthBeats;
    for (const [beat, name, dur] of song.melody) {
      out.push({ beat: beat + offset, name, dur });
    }
  }
  return out;
}

// 旋律から叩く譜面を作る。
// song.density が 1 なら整数拍の音だけ、2 なら 0.5拍刻みまで拾う（＝ノーツが増えて難しくなる）。
// 音の高さで「ドン（低い・赤）」「カッ（高い・青）」に振り分ける。
// しきい値は曲ごとの音域の真ん中にする。固定の音名で切ると、
// 低い曲は全部ドン・高い曲は全部カッになってしまうため。
export function buildBeatmap(song, config) {
  const picked = expandMelody(song).filter((n) => {
    const scaled = n.beat * song.density;
    return Math.abs(scaled - Math.round(scaled)) < 1e-6;
  });
  const midis = picked.map((n) => noteMidi(n.name));
  const sorted = [...midis].sort((a, b) => a - b);
  const split = song.kaFromNote
    ? noteMidi(song.kaFromNote)
    : sorted[Math.floor(sorted.length / 2)]; // 中央値（ドンとカッの数がだいたい半々になる）
  return picked.map((n, i) => ({
    index: i,
    sec: beatToSec(n.beat, song.bpm),
    type: noteMidi(n.name) > split ? 'ka' : 'don',
    judged: false,
    result: null,
  }));
}

// 曲全体の長さ（秒）。
export function songLengthSec(song) {
  return beatToSec(song.lengthBeats * (song.repeat || 1), song.bpm);
}

// ---- 判定 ----

// ズレ（ミリ秒）から判定を返す。判定範囲の外なら null（まだ叩く対象ではない）。
export function judgeHit(diffMs, config) {
  const d = Math.abs(diffMs);
  if (d <= config.judge.perfectMs) return 'perfect';
  if (d <= config.judge.greatMs) return 'great';
  if (d <= config.judge.windowMs) return 'miss';
  return null;
}

// ---- 得点 ----

// シューティングと同じ「ノーミス＝満点」方式。
// perfect は満点ぶん、great は部分点、miss は0点。
export function computeRhythmScore(song, counts, config) {
  const total = counts.total || 0;
  if (total <= 0) return 0;
  const weighted = (counts.perfect || 0) + (counts.great || 0) * config.greatRatio;
  return Math.max(0, Math.round(song.clearScore * (weighted / total)));
}

// この得点でクリア（次の曲が開く）か。
export function isSongCleared(song, score, config) {
  return score >= song.clearScore * config.clearRatio;
}

// index（0始まり）の曲が遊べるか。cleared はクリア済みの曲数。
export function isSongUnlocked(index, cleared) {
  return index <= (cleared || 0);
}
