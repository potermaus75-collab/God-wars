(function () {
  const LEAGUES = [
    { id: 'Copper', min: 0, max: 1199, honor: 1, staminaCost: 1 },
    { id: 'Bronze', min: 1200, max: 1799, honor: 2, staminaCost: 2 },
    { id: 'Silver', min: 1800, max: 2499, honor: 3, staminaCost: 3 },
    { id: 'Gold', min: 2500, max: 3299, honor: 5, staminaCost: 4 },
    { id: 'Platinum', min: 3300, max: Infinity, honor: 8, staminaCost: 5 },
  ];

  const ELEMENT_ADV = { fire: 'earth', water: 'fire', wind: 'water', earth: 'wind' };

  function ensureSystems(p) {
    p.missionState = p.missionState || {};
    p.missionState.unlockedChapters = p.missionState.unlockedChapters || { '1': true };
    p.missionState.missionProgress = p.missionState.missionProgress || {};
    p.missionState.missionRuns = p.missionState.missionRuns || {};
    p.missionState.completedCount = p.missionState.completedCount || {};
    p.missionState.zoneAccordion = p.missionState.zoneAccordion || {};

    p.pvp = p.pvp || { lp: 1000, honor: 0, visible: true, lastHonorDate: null, opponents: [], refreshAt: 0 };
    p.pvp.opponents = p.pvp.opponents || [];
    p.raid = p.raid || { instances: {}, activeId: null, damageByRaid: {}, history: [] };
    p.raid.instances = p.raid.instances || {};
    p.raid.damageByRaid = p.raid.damageByRaid || {};
    p.raid.history = p.raid.history || [];

    p.skills = p.skills || { points: 0, fire: { atk: 0, def: 0 }, water: { atk: 0, def: 0 }, wind: { atk: 0, def: 0 }, earth: { atk: 0, def: 0 } };
    p.gods = p.gods || { mainSlot: p.deck?.[0] || null, subSlots: (p.deck || []).slice(1, 4), dispatched: {}, awaken: {} };
    p.achievements = p.achievements || { raidDamageDone: 0, missionMasterCount: 0 };
  }

  function getChapterIndex(chapterId) { return (window.MISSIONS || []).findIndex((c) => c.chapterId === chapterId); }

  function getMissionById(id) {
    for (const ch of (window.MISSIONS || [])) {
      for (const z of ch.zones) {
        for (const m of z.missions) if (m.id === id) return { chapter: ch, zone: z, mission: m };
      }
    }
    return null;
  }

  function getZone(chapterId, zoneId) {
    return (window.MISSIONS || []).find((ch) => ch.chapterId === chapterId)?.zones.find((z) => z.zoneId === zoneId) || null;
  }

  function missionCompletedCount(p, missionId) { return p.missionState.completedCount[missionId] || 0; }

  function zoneSubs(zone) { return zone.missions.filter((m) => m.type === 'sub'); }
  function zoneMain(zone) { return zone.missions.find((m) => m.type === 'main') || null; }

  function isChapterUnlocked(p, chapterId) {
    const idx = getChapterIndex(chapterId);
    if (idx <= 0) return true;
    const prev = window.MISSIONS[idx - 1];
    if (!prev) return true;
    return prev.zones.every((z) => {
      const main = zoneMain(z);
      return main && missionCompletedCount(p, main.id) > 0;
    });
  }

  function isZoneUnlocked(p, chapterId, zoneId) {
    if (!isChapterUnlocked(p, chapterId)) return false;
    const chapter = (window.MISSIONS || []).find((ch) => ch.chapterId === chapterId);
    if (!chapter) return false;
    const idx = chapter.zones.findIndex((z) => z.zoneId === zoneId);
    if (idx <= 0) return true;
    const prevMain = zoneMain(chapter.zones[idx - 1]);
    return prevMain ? missionCompletedCount(p, prevMain.id) > 0 : false;
  }

  function getMissionAccess(p, missionId) {
    const found = getMissionById(missionId);
    if (!found) return { locked: true, lockedReason: '임무 데이터가 없습니다.' };
    const { chapter, zone, mission } = found;

    if (!isChapterUnlocked(p, chapter.chapterId)) {
      return { locked: true, lockedReason: `이전 챕터의 모든 메인 임무 1회 완료 필요` };
    }
    if (!isZoneUnlocked(p, chapter.chapterId, zone.zoneId)) {
      return { locked: true, lockedReason: `이전 존 메인 임무 1회 완료 필요` };
    }

    if (mission.type === 'sub') {
      const subs = zoneSubs(zone);
      const idx = subs.findIndex((m) => m.id === mission.id);
      if (idx > 0) {
        const prev = subs[idx - 1];
        if (missionCompletedCount(p, prev.id) < 1) {
          return { locked: true, lockedReason: `선행 ${prev.name} 100% 완료 필요` };
        }
      }
    }

    if (mission.type === 'main') {
      const incomplete = zoneSubs(zone).find((m) => missionCompletedCount(p, m.id) < 1);
      if (incomplete) return { locked: true, lockedReason: `존 서브 임무 전체 완료 필요` };
    }

    return { locked: false, lockedReason: '해금됨' };
  }

  function runMission(missionId) {
    const p = GameState.get();
    ensureSystems(p);
    const found = getMissionById(missionId);
    if (!found) return { ok: false, reason: 'mission_not_found', lockedReason: '임무 없음' };
    const { mission } = found;
    const access = getMissionAccess(p, missionId);
    if (access.locked) return { ok: false, reason: 'locked', lockedReason: access.lockedReason };
    if (p.stats.energy < mission.reqEnergy) return { ok: false, reason: 'energy_low', lockedReason: '에너지가 부족합니다.' };

    p.stats.energy -= mission.reqEnergy;
    p.resources.gold += mission.rewardGold;
    GameUI.gainExp(mission.rewardXp);
    p.skills.points += 1;
    p.missionState.missionRuns[mission.id] = (p.missionState.missionRuns[mission.id] || 0) + 1;

    if (mission.type === 'sub') {
      const current = p.missionState.missionProgress[mission.id] || 0;
      const next = Math.min(100, current + 25);
      p.missionState.missionProgress[mission.id] = next;
      if (next >= 100) p.missionState.completedCount[mission.id] = Math.max(1, missionCompletedCount(p, mission.id));
    } else {
      p.missionState.missionProgress[mission.id] = 100;
      p.missionState.completedCount[mission.id] = missionCompletedCount(p, mission.id) + 1;
      const dropRoll = Math.random();
      if (dropRoll < 0.3) GameState.gainItem('mat_g_01', 1);
      else if (dropRoll < 0.5) GameState.gainUnit('g_gr_u1', 1);
    }

    SaveSystem.scheduleSave();
    return { ok: true };
  }

  function getLeague(lp) { return LEAGUES.find((l) => lp >= l.min && lp <= l.max) || LEAGUES[0]; }

  function grantDailyHonor() {
    const p = GameState.get(); ensureSystems(p);
    const today = new Date().toISOString().slice(0, 10);
    if (!p.pvp.visible || p.pvp.lastHonorDate === today) return false;
    p.pvp.honor += getLeague(p.pvp.lp).honor;
    p.pvp.lastHonorDate = today;
    return true;
  }

  function pvpPowerFromLp(lp) { return 120 + (lp * 0.85); }

  function buildOpponent(seed = 0) {
    const p = GameState.get();
    const myLp = p.pvp.lp;
    const variation = (Math.random() * 500) - 250 + seed * 30;
    const lp = Math.max(0, Math.floor(myLp + variation));
    const power = Math.max(60, Math.floor(pvpPowerFromLp(lp) + (Math.random() * 120 - 60)));
    return {
      id: `opp_${Date.now()}_${seed}`,
      name: `도전자 ${seed + 1}`,
      lp,
      league: getLeague(lp).id,
      power,
      rewardGold: Math.max(300, Math.floor(300 + power * 1.5)),
      rewardXp: Math.max(15, Math.floor(power / 20)),
    };
  }

  function refreshPvpOpponents(force = false) {
    const p = GameState.get(); ensureSystems(p);
    if (!force && Date.now() < (p.pvp.refreshAt || 0)) return { ok: false, reason: 'cooldown', leftMs: p.pvp.refreshAt - Date.now() };
    p.pvp.opponents = Array.from({ length: 4 }, (_, idx) => buildOpponent(idx));
    p.pvp.refreshAt = Date.now() + 30000;
    SaveSystem.scheduleSave();
    return { ok: true, opponents: p.pvp.opponents, refreshAt: p.pvp.refreshAt };
  }

  function doPvpFight(opponentId) {
    const p = GameState.get(); ensureSystems(p);
    if (!p.pvp.visible) return { ok: false, reason: 'pvp_hidden' };
    const opp = p.pvp.opponents.find((o) => o.id === opponentId);
    if (!opp) return { ok: false, reason: 'opponent_not_found' };

    const league = getLeague(p.pvp.lp);
    if (p.stats.hp < 20) return { ok: false, reason: 'hp_low' };
    if (p.stats.stamina < league.staminaCost) return { ok: false, reason: 'stamina_low' };
    p.stats.stamina -= league.staminaCost;

    const myPower = Math.max(1, Math.floor(Balance.calculateDeckPower(p).atk + Balance.calculateDeckPower(p).def + p.profile.level * 8));
    const powerGap = myPower - opp.power;
    const expected = 1 / (1 + (10 ** ((opp.power - myPower) / 400)));
    const jitter = (Math.random() - 0.5) * 0.08;
    const win = (expected + jitter) >= 0.5;
    const score = win ? 1 : 0;
    const k = 36;
    const lpDelta = Math.round(k * (score - expected));
    p.pvp.lp = Math.max(0, p.pvp.lp + lpDelta);

    const goldDelta = win ? opp.rewardGold : Math.floor(opp.rewardGold * 0.25);
    const xpDelta = win ? opp.rewardXp : Math.floor(opp.rewardXp * 0.5);
    p.resources.gold += goldDelta;
    GameUI.gainExp(xpDelta);
    p.stats.hp = Math.max(0, p.stats.hp - (win ? 4 : 9));

    const log = [
      `내 전투력 ${myPower} vs 상대 ${opp.power}`,
      `예상 승률 ${(expected * 100).toFixed(1)}%`,
      `${win ? '승리' : '패배'}: LP ${lpDelta >= 0 ? '+' : ''}${lpDelta}`,
    ];
    refreshPvpOpponents(true);
    SaveSystem.scheduleSave();
    return { ok: true, win, lpDelta, goldDelta, xpDelta, log, league: getLeague(p.pvp.lp), powerGap };
  }

  function summonRaidBoss(bossId) {
    const p = GameState.get(); ensureSystems(p);
    const ids = Object.keys(window.BOSSES || {});
    const pickedId = bossId || ids[Math.floor(Math.random() * ids.length)] || 'boss_s_01';
    const boss = BOSSES[pickedId] || BOSSES.boss_s_01;
    const id = `raid_${Date.now()}`;
    p.raid.instances[id] = {
      id,
      bossId: pickedId,
      bossName: boss.name,
      owner: p.profile.name,
      hp: boss.hp_max,
      hpMax: boss.hp_max,
      anger: 10,
      angerMax: 100,
      shield: Math.floor(boss.hp_max * 0.1),
      shieldMax: boss.hp_max,
      isSOS: false,
      status: 'active',
      participants: { [p.profile.name]: { dmg: 0, joinedAt: Date.now(), rewardRoll: 'pending' } },
      createdAt: Date.now(),
      securedThreshold: Math.floor(boss.hp_max * 0.12),
    };
    p.raid.activeId = id;
    SaveSystem.scheduleSave();
    return p.raid.instances[id];
  }

  function raidSOS(id) {
    const p = GameState.get(); ensureSystems(p);
    if (!p.raid.instances[id]) return false;
    p.raid.instances[id].isSOS = true;
    SaveSystem.scheduleSave();
    return true;
  }

  function joinRaid(id, name = 'localAI') {
    const p = GameState.get(); ensureSystems(p);
    const raid = p.raid.instances[id];
    if (!raid || raid.status !== 'active') return false;
    raid.participants[name] = raid.participants[name] || { dmg: 0, joinedAt: Date.now(), rewardRoll: 'pending' };
    SaveSystem.scheduleSave();
    return true;
  }

  function completeRaidIfDone(raid, raidId, playerName) {
    if (raid.hp > 0) return;
    raid.status = 'ended';
    raid.endedAt = Date.now();
    const entries = Object.entries(raid.participants).sort((a, b) => b[1].dmg - a[1].dmg);
    entries.forEach(([name, info], idx) => {
      const secured = info.dmg >= raid.securedThreshold;
      info.rewardRoll = secured ? (idx === 0 ? 'high' : 'mid') : 'low';
      if (name === playerName) {
        const bonus = info.rewardRoll === 'high' ? 1500 : info.rewardRoll === 'mid' ? 700 : 250;
        GameState.get().resources.gold += bonus;
      }
    });
    const p = GameState.get();
    p.raid.history.unshift({ raidId, bossName: raid.bossName, endedAt: raid.endedAt, participants: entries.length });
    p.raid.history = p.raid.history.slice(0, 20);
  }

  function raidAction(id, action) {
    const p = GameState.get(); ensureSystems(p);
    const raid = p.raid.instances[id];
    if (!raid) return { ok: false, reason: 'raid_not_found' };
    if (raid.status !== 'active') return { ok: false, reason: 'raid_ended' };
    if (p.stats.hp < 10) return { ok: false, reason: 'hp_low' };

    const me = raid.participants[p.profile.name] || { dmg: 0, joinedAt: Date.now(), rewardRoll: 'pending' };
    raid.participants[p.profile.name] = me;

    let out = { ok: true, damage: 0, hp: raid.hp, hpMax: raid.hpMax, shield: raid.shield, shieldMax: raid.shieldMax, anger: raid.anger, angerMax: raid.angerMax };
    if (action === 'attack') {
      if (p.stats.stamina < 1) return { ok: false, reason: 'stamina_low' };
      p.stats.stamina -= 1;
      const atk = Math.max(1, Math.floor((p.stats.atk || 30) + Balance.calculateDeckPower(p).atk * 0.15));
      const angerBonus = raid.anger >= raid.angerMax ? 1.35 : 1;
      const effective = Math.max(1, Math.floor((atk - Math.floor(raid.shield * 0.18)) / angerBonus));
      raid.hp = Math.max(0, raid.hp - effective);
      raid.shield = Math.max(0, raid.shield - Math.floor(atk * 0.35));
      raid.anger = Math.min(raid.angerMax, raid.anger + 12);
      const backlash = raid.anger >= raid.angerMax ? 12 : 5;
      p.stats.hp = Math.max(0, p.stats.hp - backlash);
      me.dmg += effective;
      p.raid.damageByRaid[id] = (p.raid.damageByRaid[id] || 0) + effective;
      p.achievements.raidDamageDone += effective;
      out.damage = effective;
    } else if (action === 'defend') {
      if (p.stats.energy < 1) return { ok: false, reason: 'energy_low' };
      p.stats.energy -= 1;
      const guard = Math.max(10, Math.floor((p.stats.def || 20) * 1.5));
      raid.shield = Math.min(raid.shieldMax, raid.shield + guard);
      raid.anger = Math.max(0, raid.anger - Math.max(10, Math.floor((p.stats.def || 20) * 0.25)));
      p.stats.hp = Math.min(p.stats.hpMax, p.stats.hp + 2);
    }

    out.hp = raid.hp; out.shield = raid.shield; out.anger = raid.anger;
    completeRaidIfDone(raid, id, p.profile.name);
    SaveSystem.scheduleSave();
    return out;
  }

  function raidReward(id) {
    const p = GameState.get(); ensureSystems(p);
    const raid = p.raid.instances[id]; if (!raid) return null;
    const dmg = raid.participants[p.profile.name]?.dmg || 0;
    const secured = dmg >= raid.securedThreshold;
    const rewardRoll = raid.participants[p.profile.name]?.rewardRoll || (secured ? 'mid' : 'low');
    return { secured, dmg, tier: rewardRoll, bossName: raid.bossName };
  }

  function getRaidBuckets() {
    const p = GameState.get(); ensureSystems(p);
    const raids = Object.values(p.raid.instances);
    return {
      mine: raids.filter((r) => r.owner === p.profile.name),
      sos: raids.filter((r) => r.isSOS && r.status === 'active'),
      history: [...p.raid.history],
    };
  }

  function relation(att, def) {
    if (ELEMENT_ADV[att] === def) return 'adv';
    if (ELEMENT_ADV[def] === att) return 'dis';
    return 'neutral';
  }

  function elementalMultiplier(att, def) {
    const r = relation(att, def);
    if (r === 'adv') return { skill: 2.0, gear: 1.5, penalty: 1 };
    if (r === 'dis') return { skill: 0.5, gear: 0.5, penalty: 0.5 };
    return { skill: 1, gear: 1, penalty: 1 };
  }

  function totalCombatWithElement(defElement = 'earth') {
    const p = GameState.get(); ensureSystems(p);
    const mainId = p.gods.mainSlot;
    const god = DataAdapter.godMap.get(mainId);
    const baseAtk = p.stats.atk || 30;
    const baseDef = p.stats.def || 30;
    if (!god) return { atk: baseAtk, def: baseDef };
    const e = god.element;
    const mul = elementalMultiplier(e, defElement);
    const s = p.skills[e] || { atk: 0, def: 0 };
    return {
      atk: baseAtk + (s.atk * 5 * mul.skill) + ((god.atk || 0) * 0.1 * mul.gear),
      def: baseDef + (s.def * 5 * mul.skill) + ((god.def || 0) * 0.1 * mul.gear),
      relation: relation(e, defElement),
      element: e,
    };
  }

  window.GodWarsSystems = {
    LEAGUES,
    ensureSystems,
    getMissionAccess,
    isChapterUnlocked,
    isZoneUnlocked,
    runMission,
    getLeague,
    grantDailyHonor,
    refreshPvpOpponents,
    doPvpFight,
    summonRaidBoss,
    raidSOS,
    joinRaid,
    raidAction,
    raidReward,
    getRaidBuckets,
    elementalMultiplier,
    totalCombatWithElement,
  };
})();
