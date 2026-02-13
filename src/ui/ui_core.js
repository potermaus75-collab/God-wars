(function () {
  let activeTab = 'home';

  function toast(msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast-msg';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  function modal(title, html) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  function updateHeader() {
    const p = GameState.get();
    document.getElementById('user-name').innerText = p.profile.name;
    document.getElementById('user-title').innerText = `[${p.profile.title}]`;
    document.getElementById('user-level').innerText = p.profile.level;
    const expMax = Math.max(100, p.profile.level * p.profile.level * 100);
    document.getElementById('user-exp').innerText = Math.floor((p.profile.exp / expMax) * 100);
    document.getElementById('res-gold').innerText = Math.floor(p.resources.gold).toLocaleString();
    document.getElementById('res-gem').innerText = Math.floor(p.resources.gem).toLocaleString();
    ['hp', 'energy', 'stamina'].forEach((k) => {
      const cur = p.stats[k]; const max = p.stats[`${k}Max`];
      document.getElementById(`bar-${k}`).style.width = `${Math.min(100, (cur / Math.max(1, max)) * 100)}%`;
      document.getElementById(`val-${k}`).innerText = Math.floor(cur);
      document.getElementById(`max-${k}`).innerText = Math.floor(max);
    });
  }

  function renderTab() {
    const main = document.getElementById('main-content');
    if (activeTab === 'home') UITabs.renderHome(main, modal);
    if (activeTab === 'quest') UITabs.renderQuest(main, modal, toast);
    if (activeTab === 'battle') UITabs.renderBattle(main, modal, toast);
    if (activeTab === 'unit') UITabs.renderUnit(main, toast);
    if (activeTab === 'inventory') UITabs.renderInventory(main, toast);
    if (activeTab === 'shop') UITabs.renderShop(main, toast);
  }

  function gainExp(v) {
    const p = GameState.get();
    p.profile.exp += v;
    const need = () => p.profile.level * p.profile.level * 100;
    while (p.profile.exp >= need()) {
      p.profile.exp -= need();
      p.profile.level += 1;
      if (p.profile.level >= 10 && !p.titlesUnlocked.includes('숙련된 모험가')) p.titlesUnlocked.push('숙련된 모험가');
      if (p.resources.gold >= 1000000 && !p.titlesUnlocked.includes('백만장자')) p.titlesUnlocked.push('백만장자');
    }
  }

  function gameTick() {
    const p = GameState.get();
    const now = Date.now();
    const dt = Math.max(1, Math.floor((now - p.timers.lastTick) / 1000));
    p.timers.lastTick = now;
    if (dt >= 1) {
      const reg = BuffSystem.applyBuffs({ regenMul: 1 }, { player: p, deckUnits: Balance.selectedDeckUnits(p) }).regenMul || 1;
      const rec = Math.floor((dt / 180) * reg);
      if (rec > 0) {
        p.stats.energy = Math.min(p.stats.energyMax, p.stats.energy + rec);
        p.stats.stamina = Math.min(p.stats.staminaMax, p.stats.stamina + rec);
      }
      const econ = Balance.calcEconomyPerMin(p);
      const addGold = (econ.net / 60) * dt;
      if (addGold > 0) {
        p.resources.gold += addGold;
        p.metrics.goldEarnedTotal += addGold;
      }
    }
    updateHeader();
    if (activeTab === 'battle') UITabs.updateBattleTimer();
  }

  function init() {
    SaveSystem.load();
    const p = GameState.get();
    if (!p.deck.length) p.deck = ['g_gr_c1'];
    document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      renderTab();
    }));
    document.querySelector('.user-info').addEventListener('click', () => {
      const options = p.titlesUnlocked.map((t) => `<button class='btn-action' data-title='${t}'>${t} - ${BuffSystem.TITLE_EFFECTS[t]?.desc || ''}</button>`).join('<br>');
      modal('칭호 선택', options);
      document.querySelectorAll('[data-title]').forEach((b) => b.onclick = () => {
        p.profile.title = b.dataset.title; toast(`칭호 변경: ${b.dataset.title}`); SaveSystem.saveNow(); updateHeader(); document.getElementById('modal-overlay').classList.add('hidden');
      });
    });
    document.getElementById('btn-heal').addEventListener('click', () => {
      if (p.resources.gold >= 100) { p.resources.gold -= 100; p.stats.hp = Math.min(p.stats.hpMax, p.stats.hp + 20); SaveSystem.scheduleSave(); updateHeader(); }
    });
    document.getElementById('modal-close').onclick = () => document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-action-btn').onclick = () => document.getElementById('modal-overlay').classList.add('hidden');

    setInterval(gameTick, 1000);
    setInterval(() => SaveSystem.saveNow(), 15000);

    window.debug = {
      addGold(v = 10000) { GameState.get().resources.gold += v; updateHeader(); SaveSystem.scheduleSave(); },
      addUnit(id, c = 1) { GameState.gainUnit(id, c); renderTab(); SaveSystem.scheduleSave(); },
      selfTest: window.selfTest,
    };

    updateHeader();
    renderTab();
  }

  window.GameUI = { init, renderTab, updateHeader, gainExp, toast, modal, getActiveTab: () => activeTab, setActiveTab: (t) => { activeTab = t; } };
})();
