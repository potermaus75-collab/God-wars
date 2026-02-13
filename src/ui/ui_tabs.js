(function () {
  function renderHome(el) {
    const p = GameState.get();
    const deck = Balance.calculateDeckPower(p);
    const econ = Balance.calcEconomyPerMin(p);
    el.innerHTML = `<h2 class='section-title'>대시보드</h2>
      <div class='card-item'><div class='card-info'><div class='card-title'>덱 전투력</div><div class='card-meta'>ATK ${deck.atk} / DEF ${deck.def} / ${deck.count}/${deck.capacity}</div></div></div>
      <div class='card-item'><div class='card-info'><div class='card-title'>경제</div><div class='card-meta'>수익 ${econ.income}/분 | 업킵 ${econ.upkeep}/분 | 순이익 ${econ.net}/분</div></div></div>
      <div class='card-item'><div class='card-info'><div class='card-title'>튜토리얼 체크</div><div class='card-meta'>보스 1회 처치, 제작 1회, 퀘스트 완료를 달성하세요.</div></div></div>`;
  }

  function classifyQuest(q) {
    if (q.id.includes('boss')) return 'weekly';
    if ((q.req_energy || 0) <= 10) return 'daily';
    return 'achievement';
  }

  function renderQuest(el, modal, toast) {
    const p = GameState.get();
    const quests = DataAdapter.getQuestList();
    el.innerHTML = `<h2 class='section-title'>퀘스트</h2>`;
    ['daily', 'weekly', 'achievement'].forEach((type) => {
      el.innerHTML += `<div style='margin:8px 0;color:gold'>${type.toUpperCase()}</div>`;
      quests.filter((q) => classifyQuest(q) === type).slice(0, 8).forEach((q) => {
        const prog = p.quests.progress[q.id] || 0;
        const target = q.mastery_max || 100;
        const done = prog >= target || p.quests.completed[q.id];
        el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${q.name}</div><div class='card-meta'>${prog}/${target}</div></div>
          <div class='card-action'><button class='btn-action ${done ? 'primary' : ''}' data-q='${q.id}'>${done ? (p.quests.claimed[q.id] ? '수령완료' : '보상수령') : '진행'}</button></div></div>`;
      });
    });

    el.querySelectorAll('[data-q]').forEach((btn) => btn.onclick = () => {
      const id = btn.dataset.q;
      const q = quests.find((x) => x.id === id);
      const target = q.mastery_max || 100;
      if (p.quests.completed[id] && !p.quests.claimed[id]) {
        p.quests.claimed[id] = true;
        p.resources.gold += q.rew_gold_max || 100;
        GameUI.gainExp(q.rew_exp || 10);
        toast('퀘스트 보상 수령'); SaveSystem.saveNow(); renderQuest(el, modal, toast); return;
      }
      if (p.stats.energy < (q.req_energy || 1)) return toast('에너지 부족');
      p.stats.energy -= q.req_energy || 1;
      const gain = 10;
      p.quests.progress[id] = (p.quests.progress[id] || 0) + gain;
      p.resources.gold += q.rew_gold_min || 0;
      GameUI.gainExp(q.rew_exp || 1);
      if (Math.random() < (q.drop_rate || 0)) GameState.gainItem(q.drop_item_id, 1);
      if (p.quests.progress[id] >= target) p.quests.completed[id] = true;
      toast(`${q.name} 진행 +${gain}`);
      SaveSystem.scheduleSave();
      renderQuest(el, modal, toast);
    });
  }

  function availableBosses() {
    const month = new Date().getMonth();
    return Object.entries(BOSSES).filter(([id, b]) => b.rank !== 'event' || ((month + id.length) % 2 === 0));
  }

  function renderBattle(el, modal, toast) {
    const p = GameState.get();
    const deck = Balance.calculateDeckPower(p);
    el.innerHTML = `<h2 class='section-title'>보스 전투</h2><div class='card-item'><div class='card-info'><div class='card-title'>현재 덱</div><div class='card-meta'>${(p.deck || []).join(', ') || '없음'} | 전투력 ${deck.atk + deck.def}</div></div></div><div id='battle-log' class='card-item'><div class='card-info'>전투 로그 없음</div></div>`;
    availableBosses().forEach(([id, b]) => {
      const cd = (p.bossCd[id] || 0) - Date.now();
      el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${b.name}</div><div class='card-meta'>STM ${b.req_stamina} | 제한 ${Math.floor(b.time_limit/60)}분 | CD <span id='cd-${id}'>${cd > 0 ? Math.ceil(cd / 1000) : 0}</span></div></div><div class='card-action'><button class='btn-action primary' data-boss='${id}'>입장</button></div></div>`;
    });
    el.querySelectorAll('[data-boss]').forEach((btn) => btn.onclick = () => {
      const id = btn.dataset.boss;
      const boss = BOSSES[id];
      if ((p.bossCd[id] || 0) > Date.now()) return toast('쿨다운');
      if (p.stats.stamina < boss.req_stamina) return toast('스태미나 부족');
      p.stats.stamina -= boss.req_stamina;
      const result = CombatEngine.simulateBossBattle(p, id);
      p.battle.log = result.logs || [];
      if (result.win) {
        GameUI.gainExp(result.rewards.exp);
        p.resources.gold += result.rewards.gold;
        p.metrics.bossKills += 1;
        if (DataAdapter.godMap.has(result.rewards.card)) GameState.gainUnit(result.rewards.card, 1);
        else GameState.gainItem(result.rewards.card, 1);
        result.rewards.extraDrops.forEach((d) => GameState.gainItem(d.id, d.count));
        p.bossCd[id] = Date.now() + Math.min(3600 * 1000, boss.time_limit * 1000);
        modal('승리', `${boss.name} 처치 성공`);
      } else {
        p.metrics.battlesLost += 1;
        modal('패배', result.timeout ? '시간 초과' : '전멸');
      }
      p.battle.lastResult = result;
      SaveSystem.saveNow();
      renderBattle(el, modal, toast);
      document.querySelector('#battle-log .card-info').innerHTML = (p.battle.log || []).join('<br>');
      GameUI.updateHeader();
    });
  }

  function updateBattleTimer() {
    const p = GameState.get();
    Object.keys(BOSSES).forEach((id) => {
      const node = document.getElementById(`cd-${id}`);
      if (!node) return;
      const left = Math.max(0, Math.ceil(((p.bossCd[id] || 0) - Date.now()) / 1000));
      node.textContent = `${left}s`;
    });
  }

  function autoDeck() {
    const p = GameState.get();
    const cap = GameState.deckCapacity();
    const arr = Object.entries(p.units).map(([id, c]) => ({ id, c, g: DataAdapter.godMap.get(id) })).filter((x) => x.g).sort((a, b) => (b.g.atk + b.g.def) - (a.g.atk + a.g.def));
    const deck = [];
    arr.forEach((u) => { for (let i = 0; i < u.c && deck.length < cap; i += 1) deck.push(u.id); });
    p.deck = deck;
  }

  function renderUnit(el, toast) {
    const p = GameState.get();
    const cap = GameState.deckCapacity();
    el.innerHTML = `<h2 class='section-title'>부대 & 덱 편성</h2><button class='btn-action' id='btn-auto'>자동 정렬</button><div class='card-item'><div class='card-info'>덱 ${p.deck.length}/${cap}: ${(p.deck || []).join(', ')}</div></div>`;
    Object.entries(p.units).forEach(([id, count]) => {
      const g = DataAdapter.godMap.get(id); if (!g) return;
      el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${g.name}</div><div class='card-meta'>보유 ${count}</div></div><div class='card-action'><button class='btn-action' data-add='${id}'>추가</button><button class='btn-action' data-rem='${id}'>제거</button></div></div>`;
    });
    document.getElementById('btn-auto').onclick = () => { autoDeck(); SaveSystem.saveNow(); renderUnit(el, toast); };
    el.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => {
      const id = b.dataset.add;
      const used = p.deck.filter((x) => x === id).length;
      if (p.deck.length >= cap) return toast('capacity 초과');
      if (used >= (p.units[id] || 0)) return toast('보유 수량 초과');
      p.deck.push(id); SaveSystem.saveNow(); renderUnit(el, toast);
    });
    el.querySelectorAll('[data-rem]').forEach((b) => b.onclick = () => {
      const i = p.deck.lastIndexOf(b.dataset.rem);
      if (i >= 0) p.deck.splice(i, 1);
      SaveSystem.scheduleSave(); renderUnit(el, toast);
    });
  }

  function useItem(id, toast) {
    const p = GameState.get();
    const item = DataAdapter.itemMap.get(id);
    if (!item || !GameState.consumeItem(id, 1)) return;
    if (item.effect === 'hp+50') p.stats.hp = Math.min(p.stats.hpMax, p.stats.hp + 50);
    if (item.effect === 'hp+100%') p.stats.hp = p.stats.hpMax;
    if (item.effect === 'energy+100%') p.stats.energy = p.stats.energyMax;
    toast(`${item.name} 사용`);
  }

  function renderInventory(el, toast) {
    const p = GameState.get();
    const equips = ITEMS.filter((i) => i.type === 'equip');
    el.innerHTML = `<h2 class='section-title'>인벤토리 / 제작</h2><div class='card-item'><div class='card-info'>장착 무기: ${p.equipment.weapon || '-'} / 방어구: ${p.equipment.armor || '-'}</div></div>`;
    equips.forEach((i) => {
      const own = p.inventory[i.id] || 0;
      el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${i.name}</div><div class='card-meta'>보유 ${own}</div></div><div class='card-action'><button class='btn-action' data-eq='${i.id}'>장착</button><button class='btn-action' data-uneq='${i.slot}'>해제</button></div></div>`;
    });
    Object.entries(p.inventory).forEach(([id, c]) => {
      const i = DataAdapter.itemMap.get(id); if (!i || i.type === 'equip') return;
      el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${i.name}</div><div class='card-meta'>x${c}</div></div><div class='card-action'>${i.type === 'consumable' ? `<button class='btn-action' data-use='${id}'>사용</button>` : ''}</div></div>`;
    });

    el.innerHTML += `<h3 class='section-title'>제작</h3>`;
    RECIPES.slice(0, 20).forEach((r) => {
      const resultName = DataAdapter.godMap.get(r.result)?.name || DataAdapter.itemMap.get(r.result)?.name || r.result;
      el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${resultName}</div><div class='card-meta'>${r.mat1} + ${r.mat2} | 비용 ${r.cost} | ${r.chance}%</div></div><div class='card-action'><button class='btn-action primary' data-craft='${r.id}'>제작</button></div></div>`;
    });

    el.querySelectorAll('[data-eq]').forEach((b) => b.onclick = () => {
      const item = DataAdapter.itemMap.get(b.dataset.eq);
      if ((p.inventory[item.id] || 0) <= 0) return toast('아이템 없음');
      p.equipment[item.slot] = item.id; SaveSystem.saveNow(); renderInventory(el, toast);
    });
    el.querySelectorAll('[data-uneq]').forEach((b) => b.onclick = () => { p.equipment[b.dataset.uneq] = null; SaveSystem.scheduleSave(); renderInventory(el, toast); });
    el.querySelectorAll('[data-use]').forEach((b) => b.onclick = () => { useItem(b.dataset.use, toast); SaveSystem.scheduleSave(); renderInventory(el, toast); GameUI.updateHeader(); });
    el.querySelectorAll('[data-craft]').forEach((b) => b.onclick = () => {
      const r = DataAdapter.recipeMap.get(b.dataset.craft);
      if (p.resources.gold < r.cost) return toast('골드 부족');
      if (!hasMat(p, r.mat1) || !hasMat(p, r.mat2)) return toast('재료 부족');
      p.resources.gold -= r.cost;
      consumeMat(p, r.mat1); consumeMat(p, r.mat2);
      p.metrics.crafts += 1;
      const success = Math.random() * 100 <= r.chance;
      if (success) {
        if (DataAdapter.godMap.has(r.result)) GameState.gainUnit(r.result, 1);
        else GameState.gainItem(r.result, 1);
        toast('제작 성공');
      } else toast('제작 실패');
      SaveSystem.saveNow();
      renderInventory(el, toast);
      GameUI.updateHeader();
    });
  }

  function hasMat(p, id) { return DataAdapter.godMap.has(id) ? (p.units[id] || 0) > 0 : (p.inventory[id] || 0) > 0; }
  function consumeMat(p, id) { if (DataAdapter.godMap.has(id)) GameState.consumeUnit(id, 1); else GameState.consumeItem(id, 1); }

  function doGacha(toast) {
    const p = GameState.get();
    if (p.resources.gold < 1000) return toast('골드 부족');
    p.resources.gold -= 1000;
    const roll = Math.random() * 100;
    const rank = roll > 99 ? 'l' : roll > 95 ? 'e' : roll > 80 ? 'r' : roll > 50 ? 'uc' : 'c';
    let pool = DataAdapter.gods.filter((g) => g.rank === rank);
    if (!pool.length) pool = DataAdapter.gods.filter((g) => g.rank === 'c');
    const picked = pool[Math.floor(Math.random() * pool.length)];
    GameState.gainUnit(picked.id, 1);
    SaveSystem.saveNow();
    toast(`${picked.name} 획득`);
  }

  function renderShop(el, toast) {
    const p = GameState.get();
    el.innerHTML = `<h2 class='section-title'>상점</h2><div class='card-item'><div class='card-info'><div class='card-title'>용병 소환</div><div class='card-meta'>1000G</div></div><div class='card-action'><button class='btn-action primary' id='gacha'>소환</button></div></div>`;
    BUILDINGS.slice(0, 15).forEach((b) => {
      const lv = p.buildings[b.id] || 0;
      const cost = Math.floor(b.base_cost * Math.pow(1.35, lv));
      el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${b.name} Lv.${lv}</div><div class='card-meta'>수익 ${b.income}/h | ${cost}G</div></div><div class='card-action'><button class='btn-action' data-bld='${b.id}'>구매</button></div></div>`;
    });
    ITEMS.filter((i) => i.cost > 0).forEach((i) => {
      el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${i.name}</div><div class='card-meta'>${i.cost}G</div></div><div class='card-action'><button class='btn-action' data-item='${i.id}'>구매</button></div></div>`;
    });
    document.getElementById('gacha').onclick = () => { doGacha(toast); GameUI.updateHeader(); };
    el.querySelectorAll('[data-bld]').forEach((b) => b.onclick = () => {
      const id = b.dataset.bld; const bd = DataAdapter.buildingMap.get(id);
      const lv = p.buildings[id] || 0; const cost = Math.floor(bd.base_cost * Math.pow(1.35, lv));
      if (p.resources.gold < cost) return toast('골드 부족');
      p.resources.gold -= cost; p.buildings[id] = lv + 1; SaveSystem.saveNow(); renderShop(el, toast); GameUI.updateHeader();
    });
    el.querySelectorAll('[data-item]').forEach((b) => b.onclick = () => {
      const it = DataAdapter.itemMap.get(b.dataset.item);
      if (p.resources.gold < it.cost) return toast('골드 부족');
      p.resources.gold -= it.cost; GameState.gainItem(it.id, 1); SaveSystem.scheduleSave(); renderShop(el, toast); GameUI.updateHeader();
    });
  }

  window.UITabs = { renderHome, renderQuest, renderBattle, renderUnit, renderInventory, renderShop, updateBattleTimer };
})();
