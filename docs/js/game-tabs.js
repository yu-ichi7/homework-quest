// 「冒険」「ペット」のサブタブ切り替え。
// タブ変更を CustomEvent('game-tab-changed') で通知し、
// 各モジュール（adventure.js / pet.js）はこれを見てアイドルアニメーションの
// requestAnimationFrame ループを開始/停止する（非表示タブでの無駄な描画を防ぐ）。

function activate(tab) {
  for (const btn of document.querySelectorAll('.subtab')) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  }
  document.getElementById('tab-adventure').hidden = tab !== 'adventure';
  document.getElementById('tab-pet').hidden = tab !== 'pet';
  document.dispatchEvent(new CustomEvent('game-tab-changed', { detail: { tab } }));
}

for (const btn of document.querySelectorAll('.subtab')) {
  btn.onclick = () => activate(btn.dataset.tab);
}

// 初期表示（冒険）を各モジュールに知らせる。
activate('adventure');
