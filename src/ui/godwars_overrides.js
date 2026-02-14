(function () {
  function rankLabel(rank) { return ({ c: '일반', uc: '고급', r: '희귀', e: '영웅', l: '전설', g: '신화' }[rank] || String(rank || '-').toUpperCase()); }

  function progressBar(value, max, tone = 'energy', text = '') {
    const safeMax = Math.max(1, max || 1);
    const percent = Math.max(0, Math.min(100, (value / safeMax) * 100));
    const label = text || `${Math.floor(value)}/${Math.floor(safeMax)}`;
    return `<div class='progress-bg mission-progress'><div class='progress-fill ${tone}' style='width:${percent}%'></div><span class='bar-text'>${label}</span></div>`;
  }

  function chapterTheme(chapterId) {
    return ({ '1': 'hp', '2': 'energy', '3': 'stamina', '4': 'hp', '5': 'energy', '6': 'stamina' }[chapterId] || 'energy');
  }

  function zoneMissionProgress(p, missionId) {
    const completed = p.missionState.completedCount[missionId] || 0;
    if (completed > 0) return 100;
    return Math.max(0, Math.min(100, p.missionState.missionProgress[missionId] || 0));
  }

  function zoneProgress(p, zone) {
    const missions = zone.missions;
    const completed = missions.filter((m) => (p.missionState.completedCount[m.id] || 0) > 0).length;
    const total = missions.length || 1;
    return { completed, total, percent: Math.floor((completed / total) * 100) };
  }

  function chapterProgress(p, chapter) {
    const zoneMains = chapter.zones.map((z) => z.missions.find((m) => m.type === 'main')).filter(Boolean);
    const completed = zoneMains.filter((m) => (p.missionState.completedCount[m.id] || 0) > 0).length;
    const total = zoneMains.length || 1;
    return { completed, total, percent: Math.floor((completed / total) * 100) };
  }

  function missionLockReason(p, missionId) { return GodWarsSystems.getMissionAccess(p, missionId).lockedReason; }

  function renderQuest(el, modal, toast) {
    const p = GameState.get();
    GodWarsSystems.ensureSystems(p);

    let html = `<h2 class='section-title'>임무</h2><div class='card-item'><div class='card-info'><div class='card-meta'>챕터 완료도 계산 기준: (챕터 내 zone 메인 완료 수 / zone 수)</div></div></div>`;

    (window.MISSIONS || []).forEach((chapter) => {
      const chapterUnlocked = GodWarsSystems.isChapterUnlocked(p, chapter.chapterId);
      const cp = chapterProgress(p, chapter);
      html += `<section class='mission-chapter ${chapterUnlocked ? '' : 'locked'}'><div class='chapter-head'>
        <h3>${chapter.chapterName}</h3>${progressBar(cp.completed, cp.total, chapterTheme(chapter.chapterId), `${cp.completed}/${cp.total} (${cp.percent}%)`)}</div>`;

      chapter.zones.forEach((zone) => {
        const opened = p.missionState.zoneAccordion[zone.zoneId] !== false;
        const zoneUnlocked = GodWarsSystems.isZoneUnlocked(p, chapter.chapterId, zone.zoneId);
        const zp = zoneProgress(p, zone);
        html += `<div class='zone-accordion ${zoneUnlocked ? '' : 'locked'}' data-zone-wrap='${zone.zoneId}'>
          <button class='zone-head' data-zone-toggle='${zone.zoneId}'><span>${zone.zoneId} ${zone.zoneName}</span><span>${opened ? '▾' : '▸'}</span></button>
          ${progressBar(zp.completed, zp.total, 'hp', `${zp.completed}/${zp.total} (${zp.percent}%)`)}
          <div class='zone-body ${opened ? '' : 'hidden'}'>`;

        zone.missions.forEach((mission) => {
          const access = GodWarsSystems.getMissionAccess(p, mission.id);
          const missionProgress = zoneMissionProgress(p, mission.id);
          const count = p.missionState.completedCount[mission.id] || 0;
          html += `<div class='card-item mission-row ${access.locked ? 'locked' : ''}' data-mission-row='${mission.id}'>
            <div class='card-info'>
              <div class='card-title'>${mission.type === 'main' ? '👑' : '⚔️'} ${mission.name}</div>
              <div class='card-meta'>E:${mission.reqEnergy} / G:${mission.rewardGold} / XP:${mission.rewardXp} / 완료:${count}</div>
              ${progressBar(missionProgress, 100, 'stamina', `${missionProgress}%`)}
              <div class='locked-reason'>${access.locked ? `🔒 ${access.lockedReason}` : `해금 조건: ${missionLockReason(p, mission.id)}`}</div>
            </div>
            <div class='card-action'><button class='btn-action ${access.locked ? '' : 'primary'}' data-mission='${mission.id}'>실행</button></div>
          </div>`;
        });

        html += '</div></div>';
      });

      html += '</section>';
    });

    el.innerHTML = html;
    el.querySelectorAll('[data-zone-toggle]').forEach((btn) => btn.onclick = () => {
      const id = btn.dataset.zoneToggle;
      p.missionState.zoneAccordion[id] = !(p.missionState.zoneAccordion[id] !== false);
      SaveSystem.scheduleSave();
      renderQuest(el, modal, toast);
    });

    el.querySelectorAll('[data-mission]').forEach((btn) => btn.onclick = () => {
      const missionId = btn.dataset.mission;
      const access = GodWarsSystems.getMissionAccess(p, missionId);
      if (access.locked) return toast(`해금 조건: ${access.lockedReason}`);
      const r = GodWarsSystems.runMission(missionId);
      if (!r.ok) return toast(r.lockedReason || `실패: ${r.reason}`);
      toast('임무 완료');
      GameUI.updateHeader();
      renderQuest(el, modal, toast);
    });
  }

  function renderPvpSection(p) {
    const lg = GodWarsSystems.getLeague(p.pvp.lp);
    const refreshLeft = Math.max(0, Math.ceil(((p.pvp.refreshAt || 0) - Date.now()) / 1000));
    const cards = p.pvp.visible
      ? p.pvp.opponents.map((o) => `<div class='card-item pvp-opponent'><div class='card-info'><div class='card-title'>${o.name} (${o.league})</div><div class='card-meta'>전투력 ${o.power} | LP ${o.lp} | 보상 ${o.rewardGold}G/${o.rewardXp}XP</div></div><div class='card-action'><button class='btn-action primary' data-pvp='${o.id}'>대결</button></div></div>`).join('')
      : `<div class='card-item locked'><div class='card-info'><div class='locked-reason'>대결거부 ON 상태: 상대 목록 숨김, 일일 명예점수 미지급</div></div></div>`;

    return `<section class='battle-section'><h3>PVP 리그</h3>
      <div class='card-item'><div class='card-info'><div class='card-title'>${lg.id} / ${p.pvp.lp} LP</div><div class='card-meta'>명예 ${p.pvp.honor}</div></div>
      <div class='card-action'><button class='btn-action' id='toggle-visible'>대결거부 ${p.pvp.visible ? 'OFF' : 'ON'}</button><button class='btn-action' id='claim-honor'>일일 명예</button><button class='btn-action' id='refresh-pvp'>새로고침 ${refreshLeft > 0 ? `(${refreshLeft}s)` : ''}</button></div></div>${cards}</section>`;
  }

  function raidCard(raid, includeAction = true) {
    const participants = Object.entries(raid.participants || {}).map(([name, info]) => `${name}:${info.dmg}`).join(', ') || '-';
    return `<div class='card-item raid-card' data-raid='${raid.id}'><div class='card-info'>
      <div class='card-title'>${raid.bossName}</div><div class='card-meta'>상태:${raid.status} | 소환자:${raid.owner} | SOS:${raid.isSOS ? 'ON' : 'OFF'}</div>
      ${progressBar(raid.hp, raid.hpMax, 'hp', `HP ${raid.hp}/${raid.hpMax}`)}
      ${progressBar(raid.shield, raid.shieldMax, 'energy', `Shield ${raid.shield}/${raid.shieldMax}`)}
      ${progressBar(raid.anger, raid.angerMax, 'stamina', `Anger ${raid.anger}/${raid.angerMax}`)}
      <div class='card-meta'>참여자 ${participants}</div></div>
      ${includeAction ? `<div class='card-action'><button class='btn-action primary' data-set-active='${raid.id}'>선택</button></div>` : ''}
    </div>`;
  }

  function renderBattle(el, modal, toast) {
    const p = GameState.get();
    GodWarsSystems.ensureSystems(p);
    if (!p.pvp.opponents.length) GodWarsSystems.refreshPvpOpponents(true);

    const buckets = GodWarsSystems.getRaidBuckets();
    const active = p.raid.activeId ? p.raid.instances[p.raid.activeId] : null;

    el.innerHTML = `<h2 class='section-title'>배틀</h2>${renderPvpSection(p)}
      <section class='battle-section'><h3>보스 레이드</h3>
      <div class='card-item'><div class='card-info'><div class='card-meta'>공격(STM): HP↓, Anger↑ / 방어(ENG): Shield↑, Anger↓</div></div>
      <div class='card-action'><button class='btn-action primary' id='summon-raid'>내 보스 소환</button>${active ? `<button class='btn-action' id='sos-raid'>SOS 공유</button>` : ''}</div></div>
      <h4>1) 내 소환 보스</h4>${buckets.mine.map((r) => raidCard(r)).join('') || `<div class='card-item'><div class='card-info'>없음</div></div>`}
      <h4>2) SOS 요청 목록</h4>${buckets.sos.map((r) => `<div class='card-item'>${raidCard(r, false)}<div class='card-action'><button class='btn-action primary' data-join='${r.id}'>참여</button></div></div>`).join('') || `<div class='card-item'><div class='card-info'>없음</div></div>`}
      <h4>3) 참여 중/종료 기록</h4>${buckets.history.map((h) => `<div class='card-item'><div class='card-info'><div class='card-title'>${h.bossName}</div><div class='card-meta'>참여자:${h.participants} | 종료:${new Date(h.endedAt).toLocaleTimeString()}</div></div></div>`).join('') || `<div class='card-item'><div class='card-info'>없음</div></div>`}
      ${active ? `<div class='card-item'><div class='card-info'><div class='card-title'>현재 선택: ${active.bossName}</div></div><div class='card-action'><button class='btn-action primary' id='raid-atk'>공격</button><button class='btn-action' id='raid-def'>방어</button><button class='btn-action' id='raid-reward'>보상확인</button></div></div>` : ''}
      </section>`;

    document.getElementById('toggle-visible').onclick = () => {
      p.pvp.visible = !p.pvp.visible;
      SaveSystem.scheduleSave();
      renderBattle(el, modal, toast);
    };
    document.getElementById('claim-honor').onclick = () => { toast(GodWarsSystems.grantDailyHonor() ? '명예 지급' : '지급 불가'); renderBattle(el, modal, toast); };
    document.getElementById('refresh-pvp').onclick = () => {
      const r = GodWarsSystems.refreshPvpOpponents(false);
      if (!r.ok) return toast(`쿨타임 ${Math.ceil(r.leftMs / 1000)}s`);
      renderBattle(el, modal, toast);
    };

    el.querySelectorAll('[data-pvp]').forEach((btn) => btn.onclick = () => {
      const r = GodWarsSystems.doPvpFight(btn.dataset.pvp);
      if (!r.ok) return toast(`대결 실패: ${r.reason}`);
      modal(r.win ? '승리' : '패배', `<div>${r.log.join('<br>')}</div><hr><div>LP ${r.lpDelta >= 0 ? '+' : ''}${r.lpDelta}<br>골드 +${r.goldDelta}<br>XP +${r.xpDelta}</div>`);
      GameUI.updateHeader();
      renderBattle(el, modal, toast);
    });

    document.getElementById('summon-raid').onclick = () => { const r = GodWarsSystems.summonRaidBoss(); toast(`${r.bossName} 소환`); renderBattle(el, modal, toast); };
    const sosBtn = document.getElementById('sos-raid');
    if (sosBtn) sosBtn.onclick = () => { if (!active) return; GodWarsSystems.raidSOS(active.id); toast('SOS 공유 완료'); renderBattle(el, modal, toast); };

    el.querySelectorAll('[data-set-active]').forEach((btn) => btn.onclick = () => { p.raid.activeId = btn.dataset.setActive; renderBattle(el, modal, toast); });
    el.querySelectorAll('[data-join]').forEach((btn) => btn.onclick = () => {
      if (!GodWarsSystems.joinRaid(btn.dataset.join, p.profile.name)) return toast('참여 실패');
      p.raid.activeId = btn.dataset.join;
      toast('레이드 참여 완료');
      renderBattle(el, modal, toast);
    });

    if (active) {
      document.getElementById('raid-atk').onclick = () => { const r = GodWarsSystems.raidAction(active.id, 'attack'); toast(r.ok ? `피해 ${r.damage}` : r.reason); GameUI.updateHeader(); renderBattle(el, modal, toast); };
      document.getElementById('raid-def').onclick = () => { const r = GodWarsSystems.raidAction(active.id, 'defend'); toast(r.ok ? '방어 수행' : r.reason); GameUI.updateHeader(); renderBattle(el, modal, toast); };
      document.getElementById('raid-reward').onclick = () => {
        const r = GodWarsSystems.raidReward(active.id);
        if (!r) return toast('보상 없음');
        modal('레이드 보상', `${r.bossName}<br>누적피해 ${r.dmg}<br>보상 티어 ${r.tier}<br>${r.secured ? '확보 달성' : '확보 미달'}`);
      };
    }
  }

  function renderUnit(el, toast) {
    const p = GameState.get();
    GodWarsSystems.ensureSystems(p);
    const cap = GameState.deckCapacity();
    if (!p.gods.mainSlot && p.deck.length) p.gods.mainSlot = p.deck[0];

    const deckRows = p.deck.map((id, idx) => {
      const g = DataAdapter.godMap.get(id);
      const isMain = p.gods.mainSlot === id;
      if (!g) return '';
      return `<div class='card-item rarity-${g.rank}'><div class='card-info'><div class='card-title'>${g.name} ${isMain ? `<span class='badge-main'>주신</span>` : ''}</div><div class='card-meta'>슬롯 ${idx + 1} | ${rankLabel(g.rank)}</div></div><div class='card-action'><button class='btn-action' data-main='${id}'>주신 지정</button><button class='btn-action' data-rem='${id}'>파견해제</button></div></div>`;
    }).join('');

    const ownedRows = Object.entries(p.units).filter(([, cnt]) => cnt > 0).map(([id, cnt]) => {
      const g = DataAdapter.godMap.get(id);
      if (!g) return '';
      return `<div class='card-item rarity-${g.rank}'><div class='card-info'><div class='card-title'>${g.name}</div><div class='card-meta'><span class='rank-badge'>${g.rank.toUpperCase()}</span> 보유:${cnt}</div></div><div class='card-action'><button class='btn-action' data-add='${id}'>파견</button></div></div>`;
    }).join('');

    const mainGod = DataAdapter.godMap.get(p.gods.mainSlot);
    el.innerHTML = `<h2 class='section-title'>부대</h2><div class='card-item'><div class='card-info'><div class='card-title'>주신(Main God): ${mainGod?.name || '-'}</div><div class='card-meta'>주신은 속성 스킬/상성/버프 계산의 기준입니다. 파견 덱 내부 카드만 지정 가능합니다.</div></div></div>
      <div class='card-item'><div class='card-info'>파견 덱 ${p.deck.length}/${cap}</div></div>
      ${deckRows || `<div class='card-item'><div class='card-info'>파견 중인 카드 없음</div></div>`}
      <h3 class='section-title'>보유 카드(파견 가능)</h3>
      ${ownedRows || `<div class='card-item'><div class='card-info'>보유 카드 없음</div></div>`}`;

    el.querySelectorAll('[data-add]').forEach((btn) => btn.onclick = () => {
      const id = btn.dataset.add;
      if (p.deck.length >= cap) return toast('덱 용량 초과');
      if (!GameState.consumeUnit(id, 1)) return toast('보유 수량 부족');
      p.deck.push(id);
      if (!p.gods.mainSlot) p.gods.mainSlot = id;
      SaveSystem.scheduleSave();
      renderUnit(el, toast);
    });

    el.querySelectorAll('[data-rem]').forEach((btn) => btn.onclick = () => {
      const id = btn.dataset.rem;
      const idx = p.deck.lastIndexOf(id);
      if (idx < 0) return;
      p.deck.splice(idx, 1);
      GameState.gainUnit(id, 1);
      if (p.gods.mainSlot === id) p.gods.mainSlot = p.deck[0] || null;
      SaveSystem.scheduleSave();
      renderUnit(el, toast);
    });

    el.querySelectorAll('[data-main]').forEach((btn) => btn.onclick = () => {
      const id = btn.dataset.main;
      if (!p.deck.includes(id)) return toast('파견 덱 내부에서만 주신 지정 가능');
      p.gods.mainSlot = id;
      SaveSystem.scheduleSave();
      renderUnit(el, toast);
    });
  }

  window.UITabs.renderQuest = renderQuest;
  window.UITabs.renderBattle = renderBattle;
  window.UITabs.renderUnit = renderUnit;
})();
