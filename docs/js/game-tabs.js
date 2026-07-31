// 「シューティング」「ペット」のサブタブ切り替え。
// タブ変更を CustomEvent('game-tab-changed') で通知し、
// 各モジュール（shooter.js / pet.js）はこれを見て requestAnimationFrame ループを
// 開始/停止する（非表示タブでの無駄な描画やゲーム進行を防ぐ）。

function activate(tab) {
  for (const btn of document.querySelectorAll('.subtab')) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  }
  document.getElementById('tab-shooter').hidden = tab !== 'shooter';
  document.getElementById('tab-pet').hidden = tab !== 'pet';
  document.dispatchEvent(new CustomEvent('game-tab-changed', { detail: { tab } }));
}

for (const btn of document.querySelectorAll('.subtab')) {
  btn.onclick = () => activate(btn.dataset.tab);
}

// 初期表示（シューティング）を各モジュールに知らせる。
activate('shooter');
