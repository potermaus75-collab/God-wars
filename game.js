/**
 * Neo God Wars - Game Engine (v2.1 Full Features)
 * game.js
 */

// ==========================================
// 1. 전역 상태 및 초기화
// ==========================================

const DEFAULT_PLAYER = {
    profile: {
        name: "신입 모험가",
        title: "초심자", // 현재 장착 중인 칭호
        level: 1,
        exp: 0,
        expMax: 100,
        unlocked_titles: ["초심자"] // 획득한 칭호 목록
    },
    stats: {
        hp: 100,
        hpMax: 100,
        energy: 50,
        energyMax: 50,
        stamina: 10,
        staminaMax: 10
    },
    resources: {
        gold: 1000,
        gem: 0
    },
    inventory: {}, // { item_id: count }
    units: [],     // [ {id: "u_001", count: 1} ]
    buildings: {}, // { building_id: count }
    quests: {},    // { quest_id: mastery_point }
    bossCd: {},    // { boss_id: timestamp }
    
    timers: {
        lastSave: Date.now(),
        lastEnergy: Date.now(),
        lastStamina: Date.now(),
        lastIncome: Date.now()
    }
};

let player = JSON.parse(JSON.stringify(DEFAULT_PLAYER));
let activeTab = "home";

// 칭호별 효과 정의 (예시)
const TITLE_EFFECTS = {
    "초심자": { desc: "효과 없음", buff: null },
    "숙련된 모험가": { desc: "공격력 +5%", buff: { type: "atk", val: 1.05 } },
    "백만장자": { desc: "골드 획득 +10%", buff: { type: "gold", val: 1.10 } },
    "신을 죽인 자": { desc: "모든 스탯 +10%", buff: { type: "all", val: 1.10 } }
};

window.onload = function() {
    loadGame();
    initEventListeners();
    gameLoop();
    renderAll();
    showToast("게임 데이터 로드 완료!");
};

// ==========================================
// 2. 세이브 & 로드
// ==========================================

function saveGame() {
    player.timers.lastSave = Date.now();
    localStorage.setItem('neoGodWars_save', JSON.stringify(player));
}

function loadGame() {
    const saveData = localStorage.getItem('neoGodWars_save');
    if (saveData) {
        const saved = JSON.parse(saveData);
        player = { ...DEFAULT_PLAYER, ...saved, 
            stats: { ...DEFAULT_PLAYER.stats, ...saved.stats }, 
            resources: { ...DEFAULT_PLAYER.resources, ...saved.resources },
            profile: { ...DEFAULT_PLAYER.profile, ...saved.profile },
            quests: saved.quests || {},
            bossCd: saved.bossCd || {}
        };
        calculateOfflineProgress();
    } else {
        gainUnit("g_gr_c1", 5); 
        saveGame();
    }
}

function calculateOfflineProgress() {
    const now = Date.now();
    const diffSec = Math.floor((now - player.timers.lastSave) / 1000);

    if (diffSec > 0) {
        const energyGain = Math.floor(diffSec / 180); 
        player.stats.energy = Math.min(player.stats.energyMax, player.stats.energy + energyGain);

        const staminaGain = Math.floor(diffSec / 180);
        player.stats.stamina = Math.min(player.stats.staminaMax, player.stats.stamina + staminaGain);

        let hourlyIncome = calculateHourlyIncome();
        let goldGain = Math.floor((hourlyIncome / 3600) * diffSec);
        
        if (goldGain > 0) {
            player.resources.gold += goldGain;
            showToast(`오프라인 수익: +${goldGain.toLocaleString()} Gold`);
        }
    }
    // 타이머 싱크
    player.timers.lastEnergy = now;
    player.timers.lastStamina = now;
    player.timers.lastIncome = now;
}

// ==========================================
// 3. 메인 루프
// ==========================================

function gameLoop() {
    setInterval(() => {
        const now = Date.now();

        // 3분마다 회복
        if (now - player.timers.lastEnergy >= 180000) {
            if (player.stats.energy < player.stats.energyMax) {
                player.stats.energy++;
                updateUI();
            }
            player.timers.lastEnergy = now;
        }
        if (now - player.timers.lastStamina >= 180000) {
            if (player.stats.stamina < player.stats.staminaMax) {
                player.stats.stamina++;
                updateUI();
            }
            player.timers.lastStamina = now;
        }

        // 1분마다 수익
        if (now - player.timers.lastIncome >= 60000) {
            let hourlyIncome = calculateHourlyIncome();
            let minIncome = Math.floor(hourlyIncome / 60);
            if (minIncome > 0) {
                player.resources.gold += minIncome;
                updateUI();
            }
            player.timers.lastIncome = now;
        }

        updateTimersUI(now);
        if (activeTab === 'battle') updateBattleTimers(now);
        if (now % 10000 < 1000) saveGame();
    }, 1000);
}

// ==========================================
// 4. 게임 로직 (보석, 칭호 등 추가)
// ==========================================

function gainExp(amount) {
    player.profile.exp += amount;
    player.profile.expMax = player.profile.level * player.profile.level * 100;

    if (player.profile.exp >= player.profile.expMax) {
        player.profile.level++;
        player.profile.exp -= player.profile.expMax;
        player.profile.expMax = player.profile.level * player.profile.level * 100;
        
        // 레벨업 보상: 풀회복 + 보석
        player.stats.energy = player.stats.energyMax;
        player.stats.stamina = player.stats.staminaMax;
        const gemReward = 5; 
        player.resources.gem += gemReward;
        
        // 칭호 해금 체크 (예시)
        if(player.profile.level >= 10 && !player.profile.unlocked_titles.includes("숙련된 모험가")) {
            player.profile.unlocked_titles.push("숙련된 모험가");
            showToast("칭호 획득: 숙련된 모험가");
        }

        showModal("레벨 업!", `Lv.${player.profile.level} 달성!<br>보석 ${gemReward}개를 획득했습니다.`);
        saveGame();
    }
    updateUI();
}

function gainItem(itemId, count = 1) {
    if (!player.inventory[itemId]) player.inventory[itemId] = 0;
    player.inventory[itemId] += count;
    const itemData = ITEMS.find(i => i.id === itemId);
    if (itemData) showToast(`획득: ${itemData.name} x${count}`);
}

function gainUnit(unitId, count = 1) {
    let existing = player.units.find(u => u.id === unitId);
    if (existing) {
        existing.count += count;
    } else {
        player.units.push({ id: unitId, count: count });
    }
}

function calculateHourlyIncome() {
    let income = 0;
    for (let bId in player.buildings) {
        const count = player.buildings[bId];
        const bData = BUILDINGS.find(b => b.id === bId);
        if (bData && count > 0) income += bData.income * count;
    }
    let upkeep = 0;
    player.units.forEach(u => {
        const uData = GODS.find(g => g.id === u.id);
        if (uData) upkeep += uData.cost * u.count;
    });
    return Math.max(0, income - upkeep);
}

function calculateDeckPower() {
    const capacity = 5 + player.profile.level;
    let army = [];
    player.units.forEach(u => {
        const uData = GODS.find(g => g.id === u.id);
        if (uData) {
            for(let i=0; i<u.count; i++) army.push(uData);
        }
    });
    army.sort((a, b) => b.atk - a.atk);
    
    let totalAtk = 0;
    let totalDef = 0;
    let count = 0;

    for (let i = 0; i < army.length; i++) {
        if (count >= capacity) break;
        totalAtk += army[i].atk;
        totalDef += army[i].def;
        count++;
    }
    
    // 장비 보너스 (약식)
    let bestWeapon = ITEMS.filter(i => i.type === 'equip' && i.slot === 'weapon' && player.inventory[i.id] > 0).sort((a,b) => b.atk - a.atk)[0];
    let bestArmor = ITEMS.filter(i => i.type === 'equip' && i.slot === 'armor' && player.inventory[i.id] > 0).sort((a,b) => b.def - a.def)[0];
    if (bestWeapon) totalAtk += bestWeapon.atk;
    if (bestArmor) totalDef += bestArmor.def;

    return { atk: totalAtk, def: totalDef, count: count, capacity: capacity };
}

// ==========================================
// 5. UI 렌더링
// ==========================================

function updateUI() {
    document.getElementById('user-name').innerText = player.profile.name;
    document.getElementById('user-title').innerText = `[${player.profile.title}]`; // 칭호 표시
    document.getElementById('user-level').innerText = player.profile.level;
    let expPct = Math.floor((player.profile.exp / player.profile.expMax) * 100);
    document.getElementById('user-exp').innerText = expPct;
    document.getElementById('res-gold').innerText = player.resources.gold.toLocaleString();
    document.getElementById('res-gem').innerText = player.resources.gem.toLocaleString();
    
    document.getElementById('bar-hp').style.width = `${(player.stats.hp / player.stats.hpMax) * 100}%`;
    document.getElementById('val-hp').innerText = player.stats.hp;
    document.getElementById('bar-energy').style.width = `${(player.stats.energy / player.stats.energyMax) * 100}%`;
    document.getElementById('val-energy').innerText = player.stats.energy;
    document.getElementById('bar-stamina').style.width = `${(player.stats.stamina / player.stats.staminaMax) * 100}%`;
    document.getElementById('val-stamina').innerText = player.stats.stamina;
}

function updateTimersUI(now) {
    const energyLeft = 180000 - (now - player.timers.lastEnergy);
    const staminaLeft = 180000 - (now - player.timers.lastStamina);
    const formatTime = (ms) => {
        if (ms < 0) return "00:00";
        let sec = Math.ceil(ms / 1000);
        let min = Math.floor(sec / 60);
        sec = sec % 60;
        return `${min}:${sec < 10 ? '0'+sec : sec}`;
    };
    document.getElementById('timer-energy').innerText = player.stats.energy < player.stats.energyMax ? formatTime(energyLeft) : "FULL";
    document.getElementById('timer-stamina').innerText = player.stats.stamina < player.stats.staminaMax ? formatTime(staminaLeft) : "FULL";
}

function renderAll() {
    updateUI();
    renderTab(activeTab);
}

function initEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.getAttribute('data-tab');
            renderTab(activeTab);
        });
    });

    // 칭호 변경 팝업
    document.querySelector('.user-info').addEventListener('click', openTitleModal);

    document.getElementById('btn-heal').addEventListener('click', () => {
        if (player.resources.gold >= 100 && player.stats.hp < player.stats.hpMax) {
            player.resources.gold -= 100;
            player.stats.hp = Math.min(player.stats.hpMax, player.stats.hp + 20);
            updateUI();
            showToast("체력을 회복했습니다.");
        } else {
            showToast("골드가 부족합니다.");
        }
    });

    document.getElementById('modal-close').addEventListener('click', () => document.getElementById('modal-overlay').classList.add('hidden'));
    document.getElementById('modal-action-btn').addEventListener('click', () => document.getElementById('modal-overlay').classList.add('hidden'));
}

// 칭호 변경 로직
function openTitleModal() {
    let html = `<div style="text-align:left;">`;
    player.profile.unlocked_titles.forEach(t => {
        let effect = TITLE_EFFECTS[t] ? TITLE_EFFECTS[t].desc : "효과 없음";
        html += `
            <div style="padding:10px; border-bottom:1px solid #444; cursor:pointer;" onclick="changeTitle('${t}')">
                <strong style="color:gold">[${t}]</strong><br>
                <small style="color:#aaa">${effect}</small>
            </div>
        `;
    });
    html += `</div>`;
    showModal("칭호 변경", html);
}
// 전역 함수로 노출 (HTML onclick에서 부르기 위해)
window.changeTitle = function(title) {
    player.profile.title = title;
    showToast(`칭호가 [${title}](으)로 변경되었습니다.`);
    document.getElementById('modal-overlay').classList.add('hidden');
    updateUI();
}


// 탭 렌더링 스위치
function renderTab(tabName) {
    const main = document.getElementById('main-content');
    main.innerHTML = "";
    switch(tabName) {
        case "home": renderHome(main); break;
        case "quest": renderQuest(main); break;
        case "battle": renderBattle(main); break;
        case "unit": renderUnit(main); break;
        case "inventory": renderInventory(main); break; // 추가됨
        case "shop": renderShop(main); break;
    }
}

// --- [A. 홈 (대시보드 강화)] ---
function renderHome(container) {
    container.innerHTML = `<h2 class="section-title">모험가 대시보드</h2>`;
    const power = calculateDeckPower();
    const income = calculateHourlyIncome();
    
    // 알림 메시지 (레벨업 임박 등)
    let alertMsg = "오늘도 신들의 전쟁에 참전하세요!";
    if (player.profile.exp / player.profile.expMax > 0.9) alertMsg = "곧 레벨업 할 수 있습니다! 힘내세요!";

    container.innerHTML += `
        <div class="card-item" style="background:#222; border:1px solid gold;">
            <div class="card-info" style="text-align:center;">
                <div class="card-title" style="justify-content:center; color:gold;">NOTICE</div>
                <div class="card-desc">${alertMsg}</div>
            </div>
        </div>

        <div class="stat-grid">
            <div class="stat-box"><span>⚔️ 총 공격력</span><span style="color:#ff5252">${power.atk.toLocaleString()}</span></div>
            <div class="stat-box"><span>🛡️ 총 방어력</span><span style="color:#448aff">${power.def.toLocaleString()}</span></div>
            <div class="stat-box"><span>💰 시간당 수입</span><span style="color:gold">+${income.toLocaleString()}</span></div>
            <div class="stat-box"><span>👥 부대 규모</span><span>${power.count} / ${power.capacity}명</span></div>
        </div>

        <h3 style="margin-top:20px; color:#aaa; font-size:14px; border-bottom:1px solid #333; padding-bottom:5px;">현재 적용 효과</h3>
        <div style="font-size:12px; color:#888; line-height:1.6;">
            - 칭호 효과: ${TITLE_EFFECTS[player.profile.title]?.desc || '없음'}<br>
            - 건물 보너스: 미구현 (추후 추가)<br>
        </div>
    `;
}

// --- [B. 퀘스트 (랭크 시스템)] ---
function renderQuest(container) {
    let isPreviousMastered = true;
    for (let chKey in QUESTS) {
        const chapter = QUESTS[chKey];
        const chDiv = document.createElement('div');
        chDiv.className = 'chapter-header';
        chDiv.innerHTML = `<h2>${chapter.name}</h2>`;
        container.appendChild(chDiv);

        chapter.list.forEach(q => {
            let currentPoints = player.quests[q.id] || 0;
            let maxPoints = q.mastery_max * 3; 
            let currentRank = Math.floor(currentPoints / q.mastery_max) + 1;
            if (currentRank > 3) currentRank = "MASTER";
            
            let percent = currentRank === "MASTER" ? 100 : Math.floor(((currentPoints % q.mastery_max) / q.mastery_max) * 100);
            let isLocked = !isPreviousMastered;
            isPreviousMastered = (currentRank === "MASTER");

            const qItem = document.createElement('div');
            qItem.className = 'card-item';

            if (isLocked) {
                qItem.style.opacity = "0.5";
                qItem.innerHTML = `<div class="card-thumb"><i class="fa-solid fa-lock"></i></div><div class="card-info"><div class="card-title">이전 임무 완료 필요</div></div>`;
            } else {
                let isBoss = q.type === 'boss';
                let badge = currentRank === "MASTER" ? `<span style="color:gold; border:1px solid gold; font-size:10px; padding:0 2px;">MASTER</span>` : `<span style="font-size:10px; border:1px solid #666; padding:0 2px;">RANK ${currentRank}</span>`;
                
                qItem.innerHTML = `
                    <div class="card-thumb" style="border-color:${isBoss?'red':'#444'}">${isBoss?'<i class="fa-solid fa-skull"></i>':'<i class="fa-solid fa-scroll"></i>'}</div>
                    <div class="card-info">
                        <div class="card-title">${q.name} ${badge}</div>
                        <div class="card-meta">⚡ -${q.req_energy} | ⭐ +${q.rew_exp} | 💰 ${q.rew_gold_min}~${q.rew_gold_max}</div>
                        ${!isBoss ? `<div class="quest-progress-bg"><div class="quest-progress-fill" style="width:${percent}%"></div></div>` : ''}
                    </div>
                    <div class="card-action"><button class="btn-action ${isBoss?'primary':''}" id="btn-q-${q.id}">${isBoss?'레이드':'수행'}</button></div>
                `;
            }
            container.appendChild(qItem);
            
            if (!isLocked) {
                document.getElementById(`btn-q-${q.id}`).addEventListener('click', () => {
                    if (q.type === 'boss') { activeTab = 'battle'; renderAll(); showToast("배틀 탭으로 이동합니다."); }
                    else doQuest(q, maxPoints);
                });
            }
        });
    }
}

function doQuest(q, maxPoints) {
    if (player.stats.energy < q.req_energy) { showToast("에너지가 부족합니다."); return; }
    player.stats.energy -= q.req_energy;
    
    gainExp(q.rew_exp);
    const gold = Math.floor(Math.random() * (q.rew_gold_max - q.rew_gold_min + 1)) + q.rew_gold_min;
    player.resources.gold += gold;

    if (Math.random() < q.drop_rate) {
        gainItem(q.drop_item_id, 1);
        showToast("아이템을 발견했습니다!");
    }

    let cur = player.quests[q.id] || 0;
    if (cur < maxPoints) {
        player.quests[q.id] = cur + 10;
        let rank = Math.floor(cur/q.mastery_max)+1;
        let newRank = Math.floor((cur+10)/q.mastery_max)+1;
        if(newRank > rank && newRank <= 3) showModal("랭크 상승", `${q.name} RANK ${newRank} 달성!`);
    }
    updateUI();
    renderQuest(document.getElementById('main-content'));
}

// --- [C. 배틀 (보스)] ---
function renderBattle(container) {
    container.innerHTML = `<h2 class="section-title">보스 레이드</h2>`;
    for (let bKey in BOSSES) {
        const boss = BOSSES[bKey];
        const bItem = document.createElement('div');
        bItem.className = 'card-item';
        
        let now = Date.now();
        let readyTime = player.bossCd[bKey] || 0;
        let isLocked = now < readyTime;
        
        bItem.innerHTML = `
            <div class="card-thumb" style="border-color:red; color:red"><i class="fa-solid fa-dragon"></i></div>
            <div class="card-info">
                <div class="card-title">${boss.name}</div>
                <div class="card-meta">❤️ ${boss.hp_max.toLocaleString()} | 👊 -${boss.req_stamina} STM</div>
            </div>
            <div class="card-action">
                <button class="btn-action ${isLocked?'disabled':'primary'}" id="btn-boss-${bKey}" data-boss-id="${bKey}">
                    ${isLocked?'대기중':'전투'}
                </button>
            </div>
        `;
        container.appendChild(bItem);
        document.getElementById(`btn-boss-${bKey}`).addEventListener('click', () => {
            if(Date.now() < (player.bossCd[bKey]||0)) return;
            doBossBattle(bKey, boss);
        });
    }
}

function updateBattleTimers(now) {
    document.querySelectorAll('button[data-boss-id]').forEach(btn => {
        let diff = (player.bossCd[btn.getAttribute('data-boss-id')] || 0) - now;
        if (diff > 0) {
            let sec = Math.ceil(diff/1000);
            let min = Math.floor(sec/60);
            btn.innerText = `${min}:${(sec%60).toString().padStart(2,'0')}`;
            btn.className = 'btn-action disabled';
        } else {
            if (btn.innerText !== '전투') { btn.innerText = '전투'; btn.className = 'btn-action primary'; }
        }
    });
}

function doBossBattle(bKey, boss) {
    if (player.stats.stamina < boss.req_stamina) { showToast("스태미나 부족"); return; }
    if (player.stats.hp < 10) { showToast("체력 부족"); return; }
    player.stats.stamina -= boss.req_stamina;
    
    let power = calculateDeckPower();
    let winRate = 0.3 + (power.atk > boss.def ? 0.3 : 0) + (power.atk > boss.def*2 ? 0.3 : 0);
    let isWin = Math.random() < winRate;
    player.stats.hp = Math.max(0, player.stats.hp - Math.floor(boss.atk*0.1));

    if (isWin) {
        gainExp(boss.rew_exp);
        player.resources.gold += boss.rew_gold;
        // 보스 카드 드랍 (중요: data_gods.js에 있는 ID여야 부대에 보임)
        gainUnit(boss.drop_card, 1); 
        player.bossCd[bKey] = Date.now() + (boss.time_limit * 1000);
        showModal("승리!", `${boss.name} 처치!<br>보스 카드를 획득했습니다!`);
    } else {
        showModal("패배", "강력한 힘에 밀려났습니다...");
    }
    updateUI();
    renderBattle(document.getElementById('main-content'));
}

// --- [D. 부대 (보스 카드 확인)] ---
function renderUnit(container) {
    container.innerHTML = `<h2 class="section-title">내 병력</h2><div style="font-size:12px; color:#888; margin-bottom:10px;">* 상위 랭크 유닛이 전투에 자동 출전합니다.</div>`;
    
    let displayUnits = [...player.units];
    const rankOrder = { 'g':6, 'l':5, 'e':4, 'r':3, 'uc':2, 'c':1 };
    displayUnits.sort((a,b) => {
        let da = GODS.find(g=>g.id===a.id)||{rank:'c'};
        let db = GODS.find(g=>g.id===b.id)||{rank:'c'};
        return rankOrder[db.rank] - rankOrder[da.rank];
    });

    displayUnits.forEach(u => {
        const d = GODS.find(g => g.id === u.id);
        if(!d) return; // 데이터 없으면 스킵
        let rankColor = `var(--rank-${d.rank})`;
        
        container.innerHTML += `
            <div class="card-item">
                <div class="card-thumb" style="border-color:${rankColor}; color:${rankColor}"><i class="fa-solid fa-user-shield"></i></div>
                <div class="card-info">
                    <div class="card-title">${d.name} <span style="font-size:10px; border:1px solid ${rankColor}; color:${rankColor}; padding:0 2px;">${d.rank.toUpperCase()}</span></div>
                    <div class="card-meta">⚔️ ${d.atk} 🛡️ ${d.def} | 보유: ${u.count}</div>
                </div>
            </div>
        `;
    });
}

// --- [E. 인벤토리 (새로 추가됨)] ---
function renderInventory(container) {
    container.innerHTML = `<h2 class="section-title">가방 (재료 및 아이템)</h2>`;
    
    let hasItem = false;
    for(let itemId in player.inventory) {
        if(player.inventory[itemId] > 0) {
            hasItem = true;
            const item = ITEMS.find(i => i.id === itemId);
            if(!item) continue;
            
            // 아이템 사용 버튼 (소비품일 경우)
            let actionBtn = '';
            if(item.type === 'consumable') {
                actionBtn = `<div class="card-action"><button class="btn-action" onclick="useItem('${itemId}')">사용</button></div>`;
            }

            container.innerHTML += `
                <div class="card-item">
                    <div class="card-thumb"><i class="fa-solid fa-box-open"></i></div>
                    <div class="card-info">
                        <div class="card-title">${item.name}</div>
                        <div class="card-desc">${item.desc}</div>
                        <div class="card-meta">보유량: ${player.inventory[itemId]}개</div>
                    </div>
                    ${actionBtn}
                </div>
            `;
        }
    }
    if(!hasItem) container.innerHTML += `<div style="padding:20px; text-align:center; color:#666;">가방이 비었습니다.</div>`;
}
// 아이템 사용 함수 (전역)
window.useItem = function(itemId) {
    if(player.inventory[itemId] <= 0) return;
    const item = ITEMS.find(i => i.id === itemId);
    
    if(item.id === 'pot_hp_s') { 
        player.stats.hp = Math.min(player.stats.hpMax, player.stats.hp + 50); 
        showToast("체력 50 회복"); 
    }
    else if(item.id === 'pot_en_s') { 
        player.stats.energy = player.stats.energyMax; 
        showToast("에너지 완전 회복"); 
    }
    // ... 기타 아이템 로직 추가 가능

    player.inventory[itemId]--;
    updateUI();
    renderInventory(document.getElementById('main-content'));
}

// --- [F. 상점 (보석 상점 추가 및 버그 수정)] ---
function renderShop(container) {
    container.innerHTML = `<h2 class="section-title">상점</h2>`;

    // 1. 보석 상점 (신규)
    container.innerHTML += `<div style="margin:10px 0; color:#00e5ff; font-weight:bold;">보석 상점 (특수)</div>`;
    container.innerHTML += `
        <div class="card-item">
            <div class="card-thumb" style="border-color:#00e5ff; color:#00e5ff;"><i class="fa-solid fa-bolt"></i></div>
            <div class="card-info"><div class="card-title">에너지 풀 충전</div><div class="card-meta">비용: 10 Gem</div></div>
            <div class="card-action"><button class="btn-action primary" id="btn-buy-energy">구매</button></div>
        </div>
    `;

    // 2. 용병 뽑기
    container.innerHTML += `<div style="margin:20px 0 10px; color:gold; font-weight:bold;">일반 상점</div>`;
    const gachaDiv = document.createElement('div');
    gachaDiv.className = 'card-item';
    gachaDiv.innerHTML = `
        <div class="card-thumb rank-l"><i class="fa-solid fa-dice"></i></div>
        <div class="card-info">
            <div class="card-title">용병 모집</div>
            <div class="card-desc">랜덤 유닛 소환 (C~L등급)</div>
            <div class="card-meta">비용: 1,000 G</div>
        </div>
        <div class="card-action"><button class="btn-action" id="btn-gacha">소환</button></div>
    `;
    container.appendChild(gachaDiv);

    // 3. 건물
    container.innerHTML += `<div style="margin:20px 0 10px; color:gold; font-weight:bold;">부동산</div>`;
    if (typeof BUILDINGS !== 'undefined') {
        BUILDINGS.forEach(b => {
            let count = player.buildings[b.id] || 0;
            let cost = Math.floor(b.base_cost * Math.pow(1.5, count));
            const bDiv = document.createElement('div');
            bDiv.className = 'card-item';
            bDiv.innerHTML = `
                <div class="card-thumb"><i class="fa-solid fa-landmark"></i></div>
                <div class="card-info">
                    <div class="card-title">${b.name} (Lv.${count})</div>
                    <div class="card-meta">수입 +${b.income} | 비용 ${cost.toLocaleString()}G</div>
                </div>
                <div class="card-action"><button class="btn-action" id="btn-build-${b.id}">구매</button></div>
            `;
            container.appendChild(bDiv);
        });
    }

    // 이벤트 리스너 바인딩 (setTimeout으로 DOM 생성 후 실행 보장)
    setTimeout(() => {
        document.getElementById('btn-buy-energy').onclick = () => {
            if(player.resources.gem >= 10) {
                player.resources.gem -= 10;
                player.stats.energy = player.stats.energyMax;
                showToast("에너지가 충전되었습니다!");
                updateUI();
            } else showToast("보석이 부족합니다.");
        };
        document.getElementById('btn-gacha').onclick = doGacha;
        
        if (typeof BUILDINGS !== 'undefined') {
            BUILDINGS.forEach(b => {
                let btn = document.getElementById(`btn-build-${b.id}`);
                if(btn) btn.onclick = () => {
                    let cost = Math.floor(b.base_cost * Math.pow(1.5, (player.buildings[b.id]||0)));
                    if(player.resources.gold >= cost) {
                        player.resources.gold -= cost;
                        player.buildings[b.id] = (player.buildings[b.id]||0) + 1;
                        showToast(`${b.name} 구매 완료!`);
                        updateUI();
                        renderShop(document.getElementById('main-content'));
                    } else showToast("골드가 부족합니다.");
                }
            });
        }
    }, 0);
}

function doGacha() {
    if (player.resources.gold < 1000) { showToast("골드가 부족합니다."); return; }
    player.resources.gold -= 1000;
    
    let rand = Math.random() * 100;
    let rank = rand > 99 ? 'l' : (rand > 95 ? 'e' : (rand > 80 ? 'r' : (rand > 50 ? 'uc' : 'c')));
    
    let pool = GODS.filter(g => g.rank === rank);
    if(pool.length === 0) pool = GODS.filter(g => g.rank === 'c');
    
    let picked = pool[Math.floor(Math.random() * pool.length)];
    gainUnit(picked.id, 1);
    showModal("소환 결과", `<strong style="color:var(--rank-${rank})">${picked.name}</strong><br>[${rank.toUpperCase()}] 등급 획득!`);
    updateUI();
}

// ==========================================
// 6. 유틸리티
// ==========================================
function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function showModal(title, content) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-content').innerHTML = content;
    overlay.classList.remove('hidden');
}
