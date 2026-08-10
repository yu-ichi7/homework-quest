// デイリーボーナスの純粋ロジック。localStorage やDOMには触れない。
// 「毎日アプリを開くともらえる」連続日数ボーナス＋ランダムな追加報酬（ガチャ演出用）。

// きょう受け取り済みでなければ true。
export function canClaimToday(state, today) {
  return state.lastClaimDate !== today;
}

// 受け取ったときの連続日数。
// きのう受け取っていれば +1、間が空いていれば 1 にリセット。
export function nextLoginStreak(state, today, yesterday) {
  if (state.lastClaimDate === yesterday) return (state.streak || 0) + 1;
  return 1;
}

// 連続日数に応じた報酬。
// baseCoins は連続日数が伸びるほど増える（capDaysで頭打ち）。
// bonusChance は連続日数が伸びるほど当たりやすくなる「おまけ」（rand は 0〜1、テスト用に外から渡せる）。
// milestones に達した日は、確定でボーナスが追加される。
export function computeLoginReward(streak, config, rand = Math.random()) {
  const capped = Math.min(streak, config.capDays);
  const baseCoins = config.baseCoins + (capped - 1) * config.perDayBonus;
  const bonusChance = Math.min(
    config.bonusChanceMax,
    config.bonusChanceBase + (capped - 1) * config.bonusChancePerDay,
  );
  const gotBonus = rand < bonusChance;
  const bonusCoins = gotBonus ? config.bonusCoins : 0;
  const isMilestone = config.milestones.includes(streak);
  const milestoneCoins = isMilestone ? config.milestoneBonusCoins : 0;
  return {
    baseCoins,
    bonusCoins,
    milestoneCoins,
    totalCoins: baseCoins + bonusCoins + milestoneCoins,
    gotBonus,
    isMilestone,
  };
}
