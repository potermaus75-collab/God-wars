(function () {
  window.selfTest = function selfTest() {
    const results = [];
    try {
      const p = GameState.get();
      GodWarsSystems.ensureSystems(p);
      p.stats.energy = Math.max(p.stats.energy, 999);
      p.stats.stamina = Math.max(p.stats.stamina, 50);
      p.stats.hp = Math.max(p.stats.hp, 100);

      const questRoot = document.createElement('div');
      UITabs.renderQuest(questRoot, GameUI.modal, GameUI.toast);
      results.push({ name: 'chapter_zone_rendering', pass: !!questRoot.querySelector('.mission-chapter') && !!questRoot.querySelector('.zone-accordion') });

      const z = window.MISSIONS[1].zones[0];
      const sub1 = z.missions.find((m) => m.type === 'sub');
      const sub2 = z.missions.filter((m) => m.type === 'sub')[1];
      p.missionState.completedCount[sub1.id] = 0;
      const lockBefore = GodWarsSystems.getMissionAccess(p, sub2.id);
      p.missionState.missionProgress[sub1.id] = 100;
      p.missionState.completedCount[sub1.id] = 1;
      const lockAfter = GodWarsSystems.getMissionAccess(p, sub2.id);
      results.push({ name: 'mission_lock_sequence', pass: lockBefore.locked && !lockAfter.locked });

      const bar = questRoot.querySelector('.mission-row .progress-fill');
      const widthVal = bar ? Number(String(bar.style.width || '0').replace('%', '')) : -1;
      results.push({ name: 'mission_progress_bar_range', pass: widthVal >= 0 && widthVal <= 100 });

      const raid = GodWarsSystems.summonRaidBoss('boss_s_01');
      const battleRoot = document.createElement('div');
      UITabs.renderBattle(battleRoot, GameUI.modal, GameUI.toast);
      const bossText = battleRoot.textContent || '';
      results.push({ name: 'boss_name_not_id', pass: bossText.includes(BOSSES[raid.bossId].name) && !bossText.includes('boss_s_01') });
      results.push({ name: 'raid_three_bars', pass: bossText.includes('HP') && bossText.includes('Shield') && bossText.includes('Anger') });

      const unitId = Object.keys(p.units)[0] || 'g_gr_c1';
      p.units[unitId] = Math.max(2, p.units[unitId] || 0);
      p.deck = [];
      p.gods.mainSlot = null;
      const unitRoot = document.createElement('div');
      UITabs.renderUnit(unitRoot, GameUI.toast);
      const addBtn = unitRoot.querySelector('[data-add]');
      if (addBtn) addBtn.click();
      UITabs.renderUnit(unitRoot, GameUI.toast);
      const mainBtn = unitRoot.querySelector('[data-main]');
      if (mainBtn) mainBtn.click();
      UITabs.renderUnit(unitRoot, GameUI.toast);
      results.push({ name: 'main_god_assign_badge', pass: !!p.gods.mainSlot && (unitRoot.textContent || '').includes('주신') });

      const hiddenId = DataAdapter.gods.find((g) => !p.units[g.id])?.id;
      const hiddenName = DataAdapter.godMap.get(hiddenId)?.name || '';
      results.push({ name: 'non_owned_not_in_unit_tab', pass: hiddenName ? !(unitRoot.textContent || '').includes(hiddenName) : true });

      const invRoot = document.createElement('div');
      UITabs.renderInventory(invRoot, GameUI.toast);
      results.push({ name: 'rarity_border_class_applied', pass: !!invRoot.querySelector('[class*="rarity-"]') || !!unitRoot.querySelector('[class*="rarity-"]') });

      SaveSystem.saveNow();
      const loaded = SaveSystem.loadByName(p.profile.name);
      results.push({ name: 'save_load_migrate_v7', pass: loaded && GameState.get().saveVersion === GameState.SAVE_VERSION });

      console.table(results);
      return results;
    } catch (e) {
      console.error(e);
      return [{ name: 'selfTest_error', pass: false, error: e.message }];
    }
  };

  window.addEventListener('load', () => {
    GameUI.init();
    window.selfTest();
  });
})();
