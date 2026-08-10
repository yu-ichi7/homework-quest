// ゲーム画面の入口メニュー（シューティング／ペット）と、その中の画面切り替え。
// タブ変更を CustomEvent('game-tab-changed') で通知し、
// 各モジュール（shooter.js / pet.js）はこれを見て requestAnimationFrame ループを
// 開始/停止する（非表示タブでの無駄な描画やゲーム進行を防ぐ）。

function activate(tab) {
  document.getElementById('game-menu').hidden = tab !== 'menu';
  document.getElementById('tab-shooter').hidden = tab !== 'shooter';
  document.getElementById('tab-pet').hidden = tab !== 'pet';
  document.dispatchEvent(new CustomEvent('game-tab-changed', { detail: { tab } }));
}

for (const card of document.querySelectorAll('.menu-card')) {
  card.onclick = () => activate(card.dataset.tab);
}
for (const btn of document.querySelectorAll('[data-back]')) {
  btn.onclick = () => activate('menu');
}

// 初期表示はメニュー（シューティング／ペットをタップして入る）。
activate('menu');
