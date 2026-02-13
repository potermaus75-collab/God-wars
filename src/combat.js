(function () {
  const elem = CONSTANTS.ELEMENTS;
  function elementMultiplier(a, d) {
    if (!a || !d || a === 'none' || d === 'none') return 1;
    if (elem[a.toUpperCase()]?.strongAgainst === d) return 1.2;
    if (elem[a.toUpperCase()]?.weakTo === d) return 0.8;
    return 1;
  }

  function simulateBossBattle(player, bossId) {
    const boss = BOSSES[bossId];
    if (!boss) return { ok: false, reason: '보스 없음' };
    const power = Balance.calculateDeckPower(player);
    if (!power.count) return { ok: false, reason: '덱이 비어있음' };

    let bossHp = boss.hp_max;
    let teamHp = Math.max(1, Math.floor(power.def * 3 + player.stats.hp));
    const logs = [];
    const effects = { boss: { burn: 0, stun: 0 }, team: { regen: 0, stun: 0 } };
    const maxTurns = Math.max(20, Math.floor((boss.time_limit || 1800) / 10));

    for (let turn = 1; turn <= maxTurns; turn += 1) {
      if (effects.team.regen > 0) {
        const heal = Math.floor(power.atk * 0.04);
        teamHp += heal;
        effects.team.regen -= 1;
        logs.push(`T${turn} 아군 재생 +${heal}`);
      }
      if (effects.boss.burn > 0) {
        const dot = Math.floor(power.atk * 0.08);
        bossHp -= dot;
        effects.boss.burn -= 1;
        logs.push(`T${turn} 화상 피해 ${dot}`);
      }
      if (bossHp <= 0) break;

      if (effects.team.stun > 0) {
        effects.team.stun -= 1;
        logs.push(`T${turn} 아군 기절`);
      } else {
        const unit = power.units[(turn - 1) % power.units.length];
        const skill = unit.skills[(turn - 1) % unit.skills.length] || { type: 'damage', power: 1 };
        const baseDamage = Math.max(1, Math.floor(power.atk / power.count - boss.def * 0.25));
        const em = elementMultiplier(unit.element, 'earth');
        const crit = Math.random() < power.critRate ? 1.6 : 1;
        const dmg = Math.floor(baseDamage * (skill.power || 1) * em * crit);
        bossHp -= dmg;
        logs.push(`T${turn} ${unit.name} ${skill.name || '공격'} ${dmg}`);
        const statusRate = 0.2 * (power.buffs.statusRateMul || 1);
        if ((skill.type === 'dot' || unit.element === 'fire') && Math.random() < statusRate + (power.buffs.burnRate || 0)) effects.boss.burn = 3;
        if (skill.type === 'stun' && Math.random() < statusRate) effects.boss.stun = 1;
        if (skill.type === 'heal') effects.team.regen = 2;
      }

      if (bossHp <= 0) break;
      if (effects.boss.stun > 0) {
        effects.boss.stun -= 1;
        logs.push(`T${turn} 보스 기절`);
      } else {
        const dmg = Math.max(1, Math.floor(boss.atk - power.def * 0.2));
        teamHp -= dmg;
        logs.push(`T${turn} 보스 공격 ${dmg}`);
      }
      if (teamHp <= 0) break;
    }

    const win = bossHp <= 0 && teamHp > 0;
    const timeout = !win && teamHp > 0;
    const rewards = win ? {
      exp: boss.rew_exp,
      gold: boss.rew_gold,
      card: boss.drop_card,
      extraDrops: rollDrops(boss),
    } : null;
    return { ok: true, win, timeout, logs: logs.slice(-24), rewards, bossHp: Math.max(0, bossHp), teamHp: Math.max(0, teamHp) };
  }

  function rollDrops(boss) {
    const drops = [];
    if (Math.random() < 0.35) {
      const mats = ITEMS.filter((i) => i.type === 'material');
      const pick = mats[Math.floor(Math.random() * mats.length)];
      if (pick) drops.push({ id: pick.id, count: boss.rank === 'large' ? 3 : 1 });
    }
    if (boss.rank === 'event' && Math.random() < 0.5) drops.push({ id: 'pot_en_s', count: 1 });
    return drops;
  }

  window.CombatEngine = { simulateBossBattle };
})();
