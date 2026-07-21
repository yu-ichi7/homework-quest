// ペット育成（たまごっち系）の純粋ロジック。localStorage やDOMには触れない。
import { addDays, todayStr } from './dates.js';
import { rowsToCells } from './game.js';

export const STAGE_NAMES = ['あかちゃん', '少年', '成体'];

export const SPECIES = [
  { id: 'axolotl', name: 'ピンク', spriteBase: 'axolotl' },
  { id: 'cat', name: 'オレンジ', spriteBase: 'cat' },
  { id: 'bird', name: 'あお', spriteBase: 'bird' },
];

// ---- ドット絵（あかちゃん / 少年・成体は「元気」「お疲れ気味」の2分岐） ----

const SPRITES_PET = {
  axolotlBaby: [
    '..pppp..',
    '.tppppt.',
    'pppkpkpp',
    'pppwwppp',
    '.pppppp.',
    '..pppp..',
  ],
  axolotlChildHappy: [
    '..pppp..', '.tppppt.', 'pppkpkpp', 'pppwwppp',
    '.pppppp.', '..pppp..', '.pp..ppw', '..p..p..',
  ],
  axolotlChildTired: [
    '..pppp..', '.tppppt.', 'pppkpkpp', 'pppppppp',
    '.pppppp.', '..pppp..', '.pp..ppb', '..p..p..',
  ],
  axolotlAdultHappy: [
    '.t.pp.t.',
    '..pppp..', '.tppppt.', 'pppkpkpp', 'pppwwppp',
    '.pppppp.', '..pppp..', '.pp..ppw', '..p..p..',
  ],
  axolotlAdultTired: [
    '.t.pp.t.',
    '..pppp..', '.tppppt.', 'pppkpkpp', 'pppppppp',
    '.pppppp.', '..pppp..', '.pp..ppb', '..p..p..',
  ],
  catBaby: [
    'k.cccc.k',
    '.cccccc.',
    'ccckckcc',
    'cccwwccc',
    '.cccccc.',
    '..cccc..',
  ],
  catChildHappy: [
    'k.cccc.k', '.cccccc.', 'ccckckcc', 'cccwwccc',
    '.cccccc.', '..cccc..', '.cc..ccw', '..c..c..',
  ],
  catChildTired: [
    'k.cccc.k', '.cccccc.', 'ccckckcc', 'cccccccc',
    '.cccccc.', '..cccc..', '.cc..ccb', '..c..c..',
  ],
  catAdultHappy: [
    'k.k..k.k',
    'k.cccc.k', '.cccccc.', 'ccckckcc', 'cccwwccc',
    '.cccccc.', '..cccc..', '.cc..ccw', '..c..c..',
  ],
  catAdultTired: [
    'k.k..k.k',
    'k.cccc.k', '.cccccc.', 'ccckckcc', 'cccccccc',
    '.cccccc.', '..cccc..', '.cc..ccb', '..c..c..',
  ],
  birdBaby: [
    '..uuuu..',
    '.uuuuuu.',
    'uuukukuu',
    'uuullluu',
    'uuuwwuuu',
    '.uuuuuu.',
    '..uuuu..',
  ],
  birdChildHappy: [
    '..uuuu..', '.uuuuuu.', 'uuukukuu', 'uuullluu',
    'uuuwwuuu', '.uuuuuu.', '..uuuu..', '.uu..uuw', '..u..u..',
  ],
  birdChildTired: [
    '..uuuu..', '.uuuuuu.', 'uuukukuu', 'uuullluu',
    'uuuuuuuu', '.uuuuuu.', '..uuuu..', '.uu..uub', '..u..u..',
  ],
  birdAdultHappy: [
    '.u.uu.u.',
    '..uuuu..', '.uuuuuu.', 'uuukukuu', 'uuullluu',
    'uuuwwuuu', '.uuuuuu.', '..uuuu..', '.uu..uuw', '..u..u..',
  ],
  birdAdultTired: [
    '.u.uu.u.',
    '..uuuu..', '.uuuuuu.', 'uuukukuu', 'uuullluu',
    'uuuuuuuu', '.uuuuuu.', '..uuuu..', '.uu..uub', '..u..u..',
  ],
};

// 悲しい時に頭のそばに出す小さな涙マーク。
const SAD_MARK = ['.u.', 'uu.', '.u.'];
// うんち（放置すると増える。おそうじで減らす）。
const POOP = ['.nn.', 'nnnn', '.nn.'];

// そのペットの現在の姿（スプライト名）。
export function spriteKeyFor(pet) {
  if (!pet) return null;
  if (pet.stage === 0) return `${pet.species}Baby`;
  const stageName = pet.stage === 1 ? 'Child' : 'Adult';
  const formName = pet.form === 'tired' ? 'Tired' : 'Happy';
  return `${pet.species}${stageName}${formName}`;
}

export function petSpriteToCells(key) {
  return rowsToCells(SPRITES_PET[key]);
}

export function sadMarkCells() {
  return rowsToCells(SAD_MARK);
}

export function poopCells() {
  return rowsToCells(POOP);
}

// おなかがすいていると少し小さく見える見た目倍率（純粋関数）。
export function bodyScaleFor(pet) {
  return pet.hunger < 30 ? 0.82 : 1;
}

// ---- ペットの状態 ----

export function createPet(speciesId, today = todayStr()) {
  return {
    species: speciesId,
    stage: 0,
    form: 'happy',
    hunger: 80,
    happiness: 80,
    careCount: 0,
    neglectDays: 0,
    poopCount: 0,
    lastTick: today,
    adoptedAt: new Date().toISOString(),
  };
}

// 前回チェック日から今日までの経過日数ぶん、なでこ・なかよし度を減衰させる。
// うんちも1日ごとに増え（上限あり）、たまっているとなかよし度の減りが早くなる。
// どちらかが neglectThreshold 未満だった日を neglectDays に積む（純粋関数）。
export function applyDailyDecay(pet, today, config) {
  if (pet.lastTick === today) return pet;
  const { hunger: dHunger, happiness: dHappy } = config.decayPerDay;
  let hunger = pet.hunger;
  let happiness = pet.happiness;
  let neglectDays = pet.neglectDays;
  let poopCount = pet.poopCount || 0;
  let cursor = pet.lastTick;
  while (cursor < today) {
    hunger = Math.max(0, hunger - dHunger);
    const poopPenalty = poopCount * (config.poopHappinessPenalty || 0);
    happiness = Math.max(0, happiness - dHappy - poopPenalty);
    poopCount = Math.min(config.maxPoop ?? 5, poopCount + (config.poopPerDay ?? 1));
    if (hunger < config.neglectThreshold || happiness < config.neglectThreshold) {
      neglectDays += 1;
    }
    cursor = addDays(cursor, 1);
  }
  return { ...pet, hunger, happiness, neglectDays, poopCount, lastTick: today };
}

// おそうじ（1回で1つ減らす）。もう汚れていなければ何もしない。
export function cleanPoop(pet) {
  if ((pet.poopCount || 0) <= 0) return { pet, cleaned: false };
  return { pet: { ...pet, poopCount: pet.poopCount - 1 }, cleaned: true };
}

// ごはん。満タンのときはお世話回数にカウントしない（無意味な連打での即進化を防ぐ）。
export function feed(pet) {
  if (pet.hunger >= 100) return { pet, counted: false };
  return {
    pet: { ...pet, hunger: Math.min(100, pet.hunger + 30), careCount: pet.careCount + 1 },
    counted: true,
  };
}

// あそぶ（無料）。
export function play(pet) {
  if (pet.happiness >= 100) return { pet, counted: false };
  return {
    pet: { ...pet, happiness: Math.min(100, pet.happiness + 25), careCount: pet.careCount + 1 },
    counted: true,
  };
}

// お世話回数が閾値に達していれば進化させる。分岐は今の段階でのneglectDaysで決まる。
export function checkEvolution(pet, config) {
  if (pet.stage >= 2) return { pet, evolved: false };
  const threshold = config.careToEvolve[pet.stage];
  if (pet.careCount < threshold) return { pet, evolved: false };
  const form = pet.neglectDays <= config.formNeglectLimit ? 'happy' : 'tired';
  const next = {
    ...pet,
    stage: pet.stage + 1,
    form,
    careCount: 0,
    neglectDays: 0,
    hunger: Math.max(pet.hunger, 70),
    happiness: Math.max(pet.happiness, 70),
  };
  return { pet: next, evolved: true };
}
