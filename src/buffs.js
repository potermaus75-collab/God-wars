(function () {
  const TITLE_EFFECTS = {
    초심자: { desc: '효과 없음', mod: {} },
    '숙련된 모험가': { desc: '공격력+8%, 치명타+3%', mod: { atkMul: 1.08, critRate: 0.03 } },
    백만장자: { desc: '골드획득+15%, 업킵-10%', mod: { goldMul: 1.15, upkeepMul: 0.9 } },
    '신을 죽인 자': { desc: '공방+10%, 상태확률+10%', mod: { atkMul: 1.1, defMul: 1.1, statusRateMul: 1.1 } },
    회복의성자: { desc: '회복량+20%, 에너지/스태미나 재생+20%', mod: { regenMul: 1.2 } },
  };

  function synergy(deckUnits) {
    const mythCount = {};
    const elemCount = {};
    deckUnits.forEach((u) => {
      mythCount[u.myth] = (mythCount[u.myth] || 0) + 1;
      elemCount[u.element] = (elemCount[u.element] || 0) + 1;
    });
    const mod = { atkMul: 1, defMul: 1, regenMul: 1, burnRate: 0, statusRateMul: 1 };
    Object.entries(mythCount).forEach(([, c]) => {
      if (c >= 3) { mod.atkMul += 0.12; mod.defMul += 0.12; }
    });
    Object.entries(elemCount).forEach(([e, c]) => {
      if (c >= 3) {
        if (e === 'fire') mod.burnRate += 0.15;
        if (e === 'water') mod.regenMul += 0.15;
        if (e === 'earth') mod.defMul += 0.08;
        if (e === 'wind') mod.statusRateMul += 0.1;
      }
    });
    return mod;
  }

  function applyBuffs(base, ctx) {
    const out = { ...base };
    const title = TITLE_EFFECTS[ctx.player.profile.title] || TITLE_EFFECTS.초심자;
    const syn = synergy(ctx.deckUnits || []);
    const equip = ctx.equipment || {};

    const atkFlat = (equip.weapon?.atk || 0) + (equip.armor?.atk || 0);
    const defFlat = (equip.weapon?.def || 0) + (equip.armor?.def || 0);

    out.atk = Math.floor((out.atk + atkFlat) * (title.mod.atkMul || 1) * (syn.atkMul || 1));
    out.def = Math.floor((out.def + defFlat) * (title.mod.defMul || 1) * (syn.defMul || 1));
    out.critRate = Math.min(0.95, (out.critRate || 0.1) + (title.mod.critRate || 0));
    out.statusRateMul = (out.statusRateMul || 1) * (title.mod.statusRateMul || 1) * (syn.statusRateMul || 1);
    out.regenMul = (out.regenMul || 1) * (title.mod.regenMul || 1) * (syn.regenMul || 1);
    out.goldMul = (out.goldMul || 1) * (title.mod.goldMul || 1);
    out.upkeepMul = (out.upkeepMul || 1) * (title.mod.upkeepMul || 1);
    out.burnRate = (out.burnRate || 0) + (syn.burnRate || 0);

    return out;
  }

  window.BuffSystem = { TITLE_EFFECTS, applyBuffs };
})();
