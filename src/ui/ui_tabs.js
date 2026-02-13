(function () {
  let battleAnimTimer = null;

  function unitName(id) { return DataAdapter.godMap.get(id)?.name || id; }
  function itemName(id) { return DataAdapter.itemMap.get(id)?.name || id; }

  function thumb(kind, id, rank = 'c', label = '') {
    return `<div class='card-thumb portrait ${kind} ${rank}' data-code='${id}'><span>${label || id.slice(-2).toUpperCase()}</span></div>`;
  }

  function deckNames(deck) { return (deck || []).map((id) => unitName(id)).join(', ') || '없음'; }

  function renderHome(el) {
    const p = GameState.get();
    const deck = Balance.calculateDeckPower(p);
    const econ = Balance.calcEconomyPerMin(p);
    el.innerHTML = `<h2 class='section-title'>대시보드</h2>
      <div class='card-item'><div class='card-info'><div class='card-title'>덱 전투력</div><div class='card-meta'>ATK ${deck.atk} / DEF ${deck.def} / ${deck.count}/${deck.capacity}</div></div></div>
      <div class='card-item'><div class='card-info'><div class='card-title'>현재 덱</div><div class='card-meta'>${deckNames(p.deck)}</div></div></div>
      <div class='card-item'><div class='card-info'><div class='card-title'>경제</div><div class='card-meta'>수익 ${econ.income}/분 | 업킵 ${econ.upkeep}/분 | 순이익 ${econ.net}/분</div></div></div>`;
  }

  function classifyQuest(q) { if (q.id.includes('boss')) return 'weekly'; if ((q.req_energy || 0) <= 10) return 'daily'; return 'achievement'; }
  function cycleTarget(base, cycle) { return Math.floor(base * (1 + cycle * 0.35)); }

  function renderQuest(el, modal, toast) {
    const p = GameState.get();
    const quests = DataAdapter.getQuestList();
    el.innerHTML = `<h2 class='section-title'>퀘스트 (3사이클 마스터)</h2>`;
    ['daily', 'weekly', 'achievement'].forEach((type) => {
      el.innerHTML += `<div style='margin:8px 0;color:gold'>${type.toUpperCase()}</div>`;
      quests.filter((q) => classifyQuest(q) === type).slice(0, 8).forEach((q) => {
        const cycle = p.quests.cycle[q.id] || 0;
        const baseTarget = q.mastery_max || 100;
        const target = p.quests.cycleTarget[q.id] || cycleTarget(baseTarget, cycle);
        const prog = p.quests.progress[q.id] || 0;
        const percent = Math.min(100, Math.floor((prog / target) * 100));
        const cycleText = cycle >= 3 ? 'MASTER' : `${cycle + 1}회차`;
        const done = cycle >= 3;
        el.innerHTML += `<div class='card-item'>
          <div class='card-info'><div class='card-title'>${q.name} <small>${cycleText}</small></div>
          <div class='card-meta'>${prog}/${target} (${percent}%)</div>
          <div class='quest-progress-bg'><div class='quest-progress-fill' style='width:${percent}%'></div></div></div>
          <div class='card-action'><button class='btn-action ${done ? 'primary' : ''}' data-q='${q.id}'>${done ? '완료' : '진행'}</button></div>
        </div>`;
      });
    });

    el.querySelectorAll('[data-q]').forEach((btn) => btn.onclick = () => {
      const id = btn.dataset.q;
      const q = quests.find((x) => x.id === id);
      let cycle = p.quests.cycle[id] || 0;
      if (cycle >= 3) return toast('이미 마스터 완료');
      const baseTarget = q.mastery_max || 100;
      const target = p.quests.cycleTarget[id] || cycleTarget(baseTarget, cycle);
      if (p.stats.energy < (q.req_energy || 1)) return toast('에너지 부족');

      p.stats.energy -= q.req_energy || 1;
      p.quests.progress[id] = (p.quests.progress[id] || 0) + 10;
      p.resources.gold += q.rew_gold_min || 0;
      GameUI.gainExp(q.rew_exp || 1);
      if (Math.random() < (q.drop_rate || 0)) GameState.gainItem(q.drop_item_id, 1);

      if (p.quests.progress[id] >= target) {
        cycle += 1;
        p.quests.cycle[id] = cycle;
        p.quests.progress[id] = 0;
        p.resources.gold += q.rew_gold_max || 100;
        if (cycle >= 3) {
          p.quests.completed[id] = true;
          toast(`${q.name} 마스터 완료!`);
        } else {
          p.quests.cycleTarget[id] = cycleTarget(baseTarget, cycle);
          modal('사이클 완료', `${q.name} ${cycle}회차 클리어! 다음 회차 난이도 상승.`);
        }
      }
      SaveSystem.scheduleSave();
      renderQuest(el, modal, toast);
      GameUI.updateHeader();
    });
  }

  function availableBosses() {
    const week = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
    return Object.entries(BOSSES).filter(([id, b]) => b.rank !== 'event' || ((week + id.length) % 2 === 0));
  }

  function renderBattle(el, modal, toast) {
    const p = GameState.get();
    const deck = Balance.calculateDeckPower(p);
    el.innerHTML = `<h2 class='section-title'>보스 전투</h2>
      <div class='card-item'><div class='card-info'><div class='card-title'>현재 덱</div><div class='card-meta'>${deckNames(p.deck)} | 전투력 ${deck.atk + deck.def}</div></div></div>
      <div id='battle-stage' class='battle-stage hidden'>
        <div class='battle-row'><div>플레이어 HP</div><div id='teamhp-text'>0/0</div></div>
        <div class='battle-bar'><div id='teamhp-fill'></div></div>
        <div class='battle-row'><div>보스 HP</div><div id='bosshp-text'>0/0</div></div>
        <div class='battle-bar boss'><div id='bosshp-fill'></div></div>
        <div id='battle-live-log' class='battle-log-box'></div>
      </div>`;

    availableBosses().forEach(([id, b]) => {
      const cd = (p.bossCd[id] || 0) - Date.now();
      el.innerHTML += `<div class='card-item'>${thumb('boss', id, b.rank === 'large' ? 'l' : b.rank === 'medium' ? 'r' : 'uc', 'B')}
      <div class='card-info'><div class='card-title'>${b.name}</div><div class='card-meta'>STM ${b.req_stamina} | 제한 ${Math.floor(b.time_limit / 60)}분 | CD <span id='cd-${id}'>${cd > 0 ? Math.ceil(cd / 1000) : 0}</span></div></div>
      <div class='card-action'><button class='btn-action primary' data-boss='${id}'>입장</button></div></div>`;
    });

    el.querySelectorAll('[data-boss]').forEach((btn) => btn.onclick = () => startBattle(btn.dataset.boss, el, modal, toast));
  }

  function startBattle(id, el, modal, toast) {
    const p = GameState.get();
    const boss = BOSSES[id];
    if ((p.bossCd[id] || 0) > Date.now()) return toast('쿨다운');
    if (p.stats.stamina < boss.req_stamina) return toast('스태미나 부족');
    p.stats.stamina -= boss.req_stamina;
    const result = CombatEngine.simulateBossBattle(p, id);
    if (!result.ok) return toast(result.reason || '실패');

    const stage = document.getElementById('battle-stage');
    stage.classList.remove('hidden');
    const liveLog = document.getElementById('battle-live-log');
    liveLog.innerHTML = '전투 시작...';

    let idx = 0;
    clearInterval(battleAnimTimer);
    battleAnimTimer = setInterval(() => {
      const f = result.frames[idx++];
      if (!f) {
        clearInterval(battleAnimTimer);
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
        SaveSystem.saveNow();
        renderBattle(el, modal, toast);
        GameUI.updateHeader();
        return;
      }
      const tPct = Math.max(0, Math.floor((f.teamHp / result.startTeamHp) * 100));
      const bPct = Math.max(0, Math.floor((f.bossHp / result.startBossHp) * 100));
      document.getElementById('teamhp-fill').style.width = `${tPct}%`;
      document.getElementById('bosshp-fill').style.width = `${bPct}%`;
      document.getElementById('teamhp-text').textContent = `${Math.max(0, Math.floor(f.teamHp))}/${Math.floor(result.startTeamHp)}`;
      document.getElementById('bosshp-text').textContent = `${Math.max(0, Math.floor(f.bossHp))}/${Math.floor(result.startBossHp)}`;
      liveLog.innerHTML = `${(f.logs || []).join('<br>')}<br><small>턴 ${f.turn}</small>`;
    }, 350);
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
    const pool = Object.entries(p.units).map(([id, c]) => ({ id, c, g: DataAdapter.godMap.get(id) })).filter((x) => x.g).sort((a, b) => (b.g.atk + b.g.def) - (a.g.atk + a.g.def));
    p.deck.forEach((id) => GameState.gainUnit(id, 1));
    p.deck = [];
    pool.forEach((u) => {
      let remain = p.units[u.id] || 0;
      while (remain > 0 && p.deck.length < cap) {
        p.deck.push(u.id);
        GameState.consumeUnit(u.id, 1);
        remain -= 1;
      }
    });
  }

  function renderUnit(el, toast) {
    const p = GameState.get();
    const cap = GameState.deckCapacity();
    el.innerHTML = `<h2 class='section-title'>부대 & 덱 편성</h2><button class='btn-action' id='btn-auto'>자동 정렬</button>
    <div class='card-item'><div class='card-info'><div class='card-title'>현재 덱</div><div class='card-meta'>${deckNames(p.deck)} (${p.deck.length}/${cap})</div></div></div>`;

    Object.entries(p.units).forEach(([id, count]) => {
      const g = DataAdapter.godMap.get(id); if (!g) return;
      el.innerHTML += `<div class='card-item'>${thumb('unit', id, g.rank, g.name[0])}
      <div class='card-info'><div class='card-title'>${g.name}</div><div class='card-meta'>대기 보유 ${count}</div></div>
      <div class='card-action'><button class='btn-action' data-add='${id}'>덱추가</button></div></div>`;
    });

    const deckCount = {};
    p.deck.forEach((id) => { deckCount[id] = (deckCount[id] || 0) + 1; });
    Object.entries(deckCount).forEach(([id, count]) => {
      const g = DataAdapter.godMap.get(id); if (!g) return;
      el.innerHTML += `<div class='card-item'>${thumb('unit', id, g.rank, g.name[0])}
      <div class='card-info'><div class='card-title'>[덱] ${g.name}</div><div class='card-meta'>배치 수 ${count}</div></div>
      <div class='card-action'><button class='btn-action' data-rem='${id}'>덱제거</button></div></div>`;
    });

    document.getElementById('btn-auto').onclick = () => { autoDeck(); SaveSystem.saveNow(); renderUnit(el, toast); };
    el.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => {
      const id = b.dataset.add;
      if (p.deck.length >= cap) return toast('capacity 초과');
      if (!GameState.consumeUnit(id, 1)) return toast('보유 수량 부족');
      p.deck.push(id);
      SaveSystem.saveNow();
      renderUnit(el, toast);
    });
    el.querySelectorAll('[data-rem]').forEach((b) => b.onclick = () => {
      const id = b.dataset.rem;
      const i = p.deck.lastIndexOf(id);
      if (i >= 0) { p.deck.splice(i, 1); GameState.gainUnit(id, 1); }
      SaveSystem.scheduleSave();
      renderUnit(el, toast);
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
    const weapon = p.equipment.weapon ? itemName(p.equipment.weapon) : '-';
    const armor = p.equipment.armor ? itemName(p.equipment.armor) : '-';
    el.innerHTML = `<h2 class='section-title'>인벤토리 / 제작</h2><div class='card-item'><div class='card-info'>장착 무기: ${weapon} / 방어구: ${armor}</div></div>`;
    equips.forEach((i) => {
      const own = p.inventory[i.id] || 0;
      el.innerHTML += `<div class='card-item'>${thumb('item', i.id, 'uc', i.name[0])}
      <div class='card-info'><div class='card-title'>${i.name}</div><div class='card-meta'>보유 ${own}</div></div><div class='card-action'><button class='btn-action' data-eq='${i.id}'>장착</button><button class='btn-action' data-uneq='${i.slot}'>해제</button></div></div>`;
    });
    Object.entries(p.inventory).forEach(([id, c]) => {
      const i = DataAdapter.itemMap.get(id); if (!i || i.type === 'equip') return;
      el.innerHTML += `<div class='card-item'>${thumb('item', id, 'c', i.name[0])}<div class='card-info'><div class='card-title'>${i.name}</div><div class='card-meta'>x${c}</div></div><div class='card-action'>${i.type === 'consumable' ? `<button class='btn-action' data-use='${id}'>사용</button>` : ''}</div></div>`;
    });

    el.innerHTML += `<h3 class='section-title'>제작</h3>`;
    RECIPES.slice(0, 20).forEach((r) => {
      const resultName = DataAdapter.godMap.get(r.result)?.name || DataAdapter.itemMap.get(r.result)?.name || r.result;
      el.innerHTML += `<div class='card-item'><div class='card-info'><div class='card-title'>${resultName}</div><div class='card-meta'>${unitName(r.mat1)} + ${itemName(r.mat2)} | 비용 ${r.cost} | ${r.chance}%</div></div><div class='card-action'><button class='btn-action primary' data-craft='${r.id}'>제작</button></div></div>`;
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
      p.resources.gold -= r.cost; consumeMat(r.mat1); consumeMat(r.mat2); p.metrics.crafts += 1;
      const success = Math.random() * 100 <= r.chance;
      if (success) {
        if (DataAdapter.godMap.has(r.result)) GameState.gainUnit(r.result, 1); else GameState.gainItem(r.result, 1);
        toast('제작 성공');
      } else toast('제작 실패');
      SaveSystem.saveNow(); renderInventory(el, toast); GameUI.updateHeader();
    });
  }

  function hasMat(p, id) { return DataAdapter.godMap.has(id) ? ((p.units[id] || 0) + p.deck.filter((x) => x === id).length) > 0 : (p.inventory[id] || 0) > 0; }
  function consumeMat(id) {
    const p = GameState.get();
    if (DataAdapter.godMap.has(id)) {
      if (!GameState.consumeUnit(id, 1)) {
        const i = p.deck.lastIndexOf(id);
        if (i >= 0) p.deck.splice(i, 1);
      }
    } else GameState.consumeItem(id, 1);
  }

  function doGacha(modal, toast) {
    const p = GameState.get();
    if (p.resources.gold < 1000) return toast('골드 부족');
    p.resources.gold -= 1000;
    const lines = DataAdapter.gods.slice(0, 20).map((g) => `<div class='roulette-item'>${g.name}</div>`).join('');
    modal('용병 소환', `<div class='roulette-wrap'><div class='roulette-window'><div id='roulette-track'>${lines}</div></div><div style='margin-top:8px'>룰렛 회전 중...</div></div>`);

    let ticks = 0;
    const track = document.getElementById('roulette-track');
    const timer = setInterval(() => {
      ticks += 1;
      track.style.transform = `translateY(-${(ticks % 20) * 24}px)`;
      if (ticks >= 40) {
        clearInterval(timer);
        const roll = Math.random() * 100;
        const rank = roll > 99 ? 'l' : roll > 95 ? 'e' : roll > 80 ? 'r' : roll > 50 ? 'uc' : 'c';
        let pool = DataAdapter.gods.filter((g) => g.rank === rank);
        if (!pool.length) pool = DataAdapter.gods.filter((g) => g.rank === 'c');
        const picked = pool[Math.floor(Math.random() * pool.length)];
        GameState.gainUnit(picked.id, 1);
        SaveSystem.saveNow();
        document.getElementById('modal-content').innerHTML = `${picked.name} (${rank.toUpperCase()}) 획득!`;
        GameUI.updateHeader();
      }
    }, 60);
  }

  function renderShop(el, toast) {
    const p = GameState.get();
    el.innerHTML = `<h2 class='section-title'>상점</h2><div class='card-item'><div class='card-info'><div class='card-title'>용병 소환</div><div class='card-meta'>1000G</div></div><div class='card-action'><button class='btn-action primary' id='gacha'>소환</button></div></div>`;
    BUILDINGS.slice(0, 15).forEach((b) => {
      const lv = p.buildings[b.id] || 0;
      const cost = Math.floor(b.base_cost * Math.pow(1.35, lv));
      el.innerHTML += `<div class='card-item'>${thumb('building', b.id, 'uc', '🏛')}
      <div class='card-info'><div class='card-title'>${b.name} Lv.${lv}</div><div class='card-meta'>수익 ${b.income}/h | ${cost}G</div></div><div class='card-action'><button class='btn-action' data-bld='${b.id}'>구매</button></div></div>`;
    });
    ITEMS.filter((i) => i.cost > 0).forEach((i) => {
      el.innerHTML += `<div class='card-item'>${thumb('item', i.id, 'c', i.name[0])}
      <div class='card-info'><div class='card-title'>${i.name}</div><div class='card-meta'>${i.cost}G</div></div><div class='card-action'><button class='btn-action' data-item='${i.id}'>구매</button></div></div>`;
    });

    document.getElementById('gacha').onclick = () => doGacha(GameUI.modal, toast);
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
