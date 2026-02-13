(function () {
  function selectedDeckUnits(player) {
    return (player.deck || []).map((id) => DataAdapter.godMap.get(id)).filter(Boolean);
  }

  function calculateDeckPower(player) {
    const capacity = GameState.deckCapacity();
    const deck = (player.deck || []).slice(0, capacity);
    let atk = 0; let def = 0;
    const units = [];
    deck.forEach((id) => {
      const g = DataAdapter.godMap.get(id);
      if (!g) return;
      atk += g.atk;
      def += g.def;
      units.push(g);
    });
    const buffs = BuffSystem.applyBuffs({ atk, def, critRate: 0.1 }, {
      player,
      deckUnits: units,
      equipment: {
        weapon: player.equipment.weapon ? DataAdapter.itemMap.get(player.equipment.weapon) : null,
        armor: player.equipment.armor ? DataAdapter.itemMap.get(player.equipment.armor) : null,
      },
    });
    return { atk: buffs.atk, def: buffs.def, critRate: buffs.critRate, count: units.length, capacity, units, buffs };
  }

  function calcEconomyPerMin(player) {
    let income = 0;
    Object.entries(player.buildings).forEach(([id, count]) => {
      const b = DataAdapter.buildingMap.get(id);
      if (b) income += (b.income || 0) * count / 60;
    });
    let upkeep = 0;
    Object.entries(player.units).forEach(([id, count]) => {
      const g = DataAdapter.godMap.get(id);
      if (g) upkeep += (g.upkeepPerMin || 0) * count;
    });
    const buffs = BuffSystem.applyBuffs({ goldMul: 1, upkeepMul: 1 }, { player, deckUnits: selectedDeckUnits(player) });
    income *= buffs.goldMul || 1;
    upkeep *= buffs.upkeepMul || 1;
    const minFloor = 5 + player.profile.level;
    const net = Math.max(minFloor, Math.floor(income - Math.min(upkeep, income * 0.9 + 100)));
    return { income: Math.floor(income), upkeep: Math.floor(upkeep), net };
  }

  window.Balance = { calculateDeckPower, calcEconomyPerMin, selectedDeckUnits };
})();
