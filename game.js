/**
 * Neo God Wars - Game Engine
 * game.js
 */

// ==========================================
// 1. 전역 상태 및 초기화 (Global State)
// ==========================================

// 기본 플레이어 데이터 구조
const DEFAULT_PLAYER = {
    profile: {
        name: "신입 모험가",
        title: "[무명]",
        level: 1,
        exp: 0,
        expMax: 100
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
    // 보유 목록
    inventory: {}, // { item_id: count }
    units: [],     // [ {id: "u_001", count: 1, locked: false} ]
    buildings: {}, // { building_id: count }
    
    // 진행 상황
    quests: {},    // { quest_id: mastery_value (0~Max) }
    bossCd: {},    // { boss_id: timestamp_next_spawn }
    
    // 시스템
    timers: {
        lastSave: Date.now(),
        lastEnergy: Date.now(),
        lastStamina: Date.now(),
        lastIncome: Date.now()
    }
};

let player = JSON.parse(JSON.stringify(DEFAULT_PLAYER)); // Deep Copy
let activeTab = "home"; // 현재 보고 있는 탭

// 게임 시작
window.onload = function() {
    loadGame();
    initEventListeners();
    gameLoop(); // 1초마다 반복되는 루프 시작
    renderAll(); // 초기 화면 그리기
    showToast("네오 갓워즈에 오신 것을 환영합니다!");
};

// ==========================================
// 2. 세이브 & 로드 (Save/Load System)
// ==========================================

function saveGame() {
    player.timers.lastSave = Date.now();
    localStorage.setItem('neoGodWars_save', JSON.stringify(player));
    // console.log("Game Saved");
}

function loadGame() {
    const saveData = localStorage.getItem('neoGodWars_save');
    if (saveData) {
        const saved = JSON.parse(saveData);
        // 구버전 데이터 호환성을 위해 병합 (Object.assign 대신 깊은 병합 필요하지만 약식으로 처리)
        player = { ...DEFAULT_PLAYER, ...saved, stats: { ...DEFAULT_PLAYER.stats, ...saved.stats }, resources: { ...DEFAULT_PLAYER.resources, ...saved.resources } };
        
        // 오프라인 시간 계산 (Offline Progress)
        calculateOfflineProgress();
    } else {
        // 첫 시작 시 기본 유닛 지급
        gainUnit("g_gr_c1", 5); // 그리스 민병대 5명
        saveGame();
    }
}

function calculateOfflineProgress() {
    const now = Date.now();
    const last = player.timers.lastSave;
    const diffSec = Math.floor((now - last) / 1000);

    if (diffSec > 0) {
        // 1. 에너지 회복 (180초당 1)
        const energyGain = Math.floor(diffSec / 180);
        player.stats.energy = Math.min(player.stats.energyMax, player.stats.energy + energyGain);

        // 2. 스태미나 회복 (300초당 1)
        const staminaGain = Math.floor(diffSec / 300);
        player.stats.stamina = Math.min(player.stats.staminaMax, player.stats.stamina + staminaGain);

        // 3. 건물 수익 (시간당 수익 -> 초당 수익으로 환산)
        let hourlyIncome = calculateHourlyIncome();
        let goldGain = Math.floor((hourlyIncome / 3600) * diffSec);
        
        if (goldGain > 0) {
            player.resources.gold += goldGain;
            showToast(`오프라인 수익: +${goldGain.toLocaleString()} Gold`);
        }
    }
    
    // 타이머 싱크 맞추기
    player.timers.lastEnergy = now;
    player.timers.lastStamina = now;
    player.timers.lastIncome = now;
}

// ==========================================
// 3. 메인 루프 & 타이머 (Game Loop)
// ==========================================

function gameLoop() {
    setInterval(() => {
        const now = Date.now();

        // 1. 에너지 회복 (3분 = 180,000ms)
        if (now - player.timers.lastEnergy >= 180000) {
            if (player.stats.energy < player.stats.energyMax) {
                player.stats.energy++;
                updateUI();
            }
            player.timers.lastEnergy = now;
        }

        // 2. 스태미나 회복 (5분 = 300,000ms)
        if (now - player.timers.lastStamina >= 300000) {
            if (player.stats.stamina < player.stats.staminaMax) {
                player.stats.stamina++;
                updateUI();
            }
            player.timers.lastStamina = now;
        }

        // 3. 건물 수익 (1분마다 지급)
        if (now - player.timers.lastIncome >= 60000) {
            let hourlyIncome = calculateHourlyIncome();
            let minIncome = Math.floor(hourlyIncome / 60);
            if (minIncome > 0) {
                player.resources.gold += minIncome;
                // showToast(`수익 발생: ${minIncome} G`);
                updateUI();
            }
            player.timers.lastIncome = now;
        }

        // 4. 타이머 UI 갱신 (1초마다)
        updateTimersUI(now);

        // 5. 자동 저장 (10초마다)
        if (now % 10000 < 1000) saveGame();

    }, 1000);
}

function updateTimersUI(now) {
    // 남은 시간 계산
    const energyLeft = 180000 - (now - player.timers.lastEnergy);
    const staminaLeft = 300000 - (now - player.timers.lastStamina);

    const formatTime = (ms) => {
        if (ms < 0) return "00:00";
        let sec = Math.floor(ms / 1000);
        let min = Math.floor(sec / 60);
        sec = sec % 60;
        return `${min}:${sec < 10 ? '0'+sec : sec}`;
    };

    if (player.stats.energy < player.stats.energyMax) {
        document.getElementById('timer-energy').innerText = formatTime(energyLeft);
    } else {
        document.getElementById('timer-energy').innerText = "FULL";
    }

    if (player.stats.stamina < player.stats.staminaMax) {
        document.getElementById('timer-stamina').innerText = formatTime(staminaLeft);
    } else {
        document.getElementById('timer-stamina').innerText = "FULL";
    }
}

// ==========================================
// 4. 핵심 로직: 자원 및 성장 (Core Mechanics)
// ==========================================

// 경험치 획득 및 레벨업
function gainExp(amount) {
    player.profile.exp += amount;
    player.profile.expMax = player.profile.level * player.profile.level * 100; // 레벨업 공식

    if (player.profile.exp >= player.profile.expMax) {
        player.profile.level++;
        player.profile.exp -= player.profile.expMax;
        player.profile.expMax = player.profile.level * player.profile.level * 100;
        
        // 레벨업 보상: 에너지/스태미나 풀 회복
        player.stats.energy = player.stats.energyMax;
        player.stats.stamina = player.stats.staminaMax;
        
        showModal("레벨 업!", `축하합니다! Lv.${player.profile.level} 달성!<br>에너지와 스태미나가 회복되었습니다.`);
        saveGame();
    }
    updateUI();
}

// 아이템 획득
function gainItem(itemId, count = 1) {
    if (!player.inventory[itemId]) player.inventory[itemId] = 0;
    player.inventory[itemId] += count;
    
    const itemData = ITEMS.find(i => i.id === itemId);
    if (itemData) {
        showToast(`획득: ${itemData.name} x${count}`);
    }
}

// 유닛 획득
function gainUnit(unitId, count = 1) {
    // 이미 보유 중인지 확인
    let existing = player.units.find(u => u.id === unitId);
    if (existing) {
        existing.count += count;
    } else {
        player.units.push({ id: unitId, count: count, locked: false });
    }
    
    const unitData = GODS.find(u => u.id === unitId);
    if (unitData) {
        // 등급에 따른 메시지 색상 처리 가능
        // showToast(`동료 합류: ${unitData.name} x${count}`);
    }
}

// 시간당 수입 계산
function calculateHourlyIncome() {
    let income = 0;
    // 건물 수입
    for (let bId in player.buildings) {
        const count = player.buildings[bId];
        const bData = BUILDINGS.find(b => b.id === bId);
        if (bData && count > 0) {
            income += bData.income * count;
        }
    }
    
    // 유닛 유지비 차감
    let upkeep = 0;
    player.units.forEach(u => {
        const uData = GODS.find(g => g.id === u.id);
        if (uData) upkeep += uData.cost * u.count;
    });

    return Math.max(0, income - upkeep); // 적자는 없음
}

// 덱 파워 계산 (전투력)
function calculateDeckPower() {
    // 1. 출전 가능 수: 기본 5 + 레벨당 1
    const capacity = 5 + player.profile.level;
    
    // 2. 보유 유닛 전체를 펼쳐서 리스트화 (count 만큼 복제)
    let army = [];
    player.units.forEach(u => {
        const uData = GODS.find(g => g.id === u.id);
        if (uData) {
            for(let i=0; i<u.count; i++) army.push(uData);
        }
    });

    // 3. 가장 강한 유닛순 정렬 (공격력 기준)
    army.sort((a, b) => b.atk - a.atk);
    
    // 4. 상위 N마리 합산
    let totalAtk = 0;
    let totalDef = 0;
    let count = 0;

    for (let i = 0; i < army.length; i++) {
        if (count >= capacity) break;
        totalAtk += army[i].atk;
        totalDef += army[i].def;
        count++;
    }

    // 5. 장비 보너스 (임시: 장착 기능이 없으므로 인벤토리에 있으면 적용으로 약식 구현)
    // 실제로는 '장착' 슬롯을 만들어야 함. 여기서는 단순화하여 가장 쎈 무기 1개만 적용
    let bestWeapon = ITEMS.filter(i => i.type === 'equip' && i.slot === 'weapon' && player.inventory[i.id] > 0)
                          .sort((a,b) => b.atk - a.atk)[0];
    let bestArmor = ITEMS.filter(i => i.type === 'equip' && i.slot === 'armor' && player.inventory[i.id] > 0)
                         .sort((a,b) => b.def - a.def)[0];

    if (bestWeapon) totalAtk += bestWeapon.atk;
    if (bestArmor) totalDef += bestArmor.def;

    return { atk: totalAtk, def: totalDef, count: count, capacity: capacity };
}

// ==========================================
// 5. UI 렌더링 (View Layer)
// ==========================================

function updateUI() {
    // 헤더 정보 갱신
    document.getElementById('user-name').innerText = player.profile.name;
    document.getElementById('user-level').innerText = player.profile.level;
    
    // 경험치 %
    let expPct = Math.floor((player.profile.exp / player.profile.expMax) * 100);
    document.getElementById('user-exp').innerText = expPct;

    // 자원
    document.getElementById('res-gold').innerText = player.resources.gold.toLocaleString();
    document.getElementById('res-gem').innerText = player.resources.gem.toLocaleString();

    // 스탯 바 (너비 조정)
    const hpPct = (player.stats.hp / player.stats.hpMax) * 100;
    const enPct = (player.stats.energy / player.stats.energyMax) * 100;
    const stPct = (player.stats.stamina / player.stats.staminaMax) * 100;

    document.getElementById('bar-hp').style.width = `${hpPct}%`;
    document.getElementById('val-hp').innerText = player.stats.hp;
    document.getElementById('max-hp').innerText = player.stats.hpMax;

    document.getElementById('bar-energy').style.width = `${enPct}%`;
    document.getElementById('val-energy').innerText = player.stats.energy;
    document.getElementById('max-energy').innerText = player.stats.energyMax;

    document.getElementById('bar-stamina').style.width = `${stPct}%`;
    document.getElementById('val-stamina').innerText = player.stats.stamina;
    document.getElementById('max-stamina').innerText = player.stats.staminaMax;
}

function renderAll() {
    updateUI();
    renderTab(activeTab);
}

// 탭 전환 이벤트 리스너
function initEventListeners() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 활성 클래스 변경
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 탭 변경 및 렌더링
            activeTab = btn.getAttribute('data-tab');
            renderTab(activeTab);
            
            // 효과음 재생 (선택사항)
        });
    });

    // 힐링 버튼
    document.getElementById('btn-heal').addEventListener('click', () => {
        if (player.resources.gold >= 100 && player.stats.hp < player.stats.hpMax) {
            player.resources.gold -= 100;
            player.stats.hp = Math.min(player.stats.hpMax, player.stats.hp + 20); // 100G당 20HP
            updateUI();
            showToast("체력을 회복했습니다.");
        } else {
            showToast("골드가 부족하거나 체력이 가득 찼습니다.");
        }
    });

    // 모달 닫기
    document.getElementById('modal-close').addEventListener('click', () => {
        document.getElementById('modal-overlay').classList.add('hidden');
    });
    document.getElementById('modal-action-btn').addEventListener('click', () => {
        document.getElementById('modal-overlay').classList.add('hidden');
    });
}

// 탭별 렌더링 분기
function renderTab(tabName) {
    const main = document.getElementById('main-content');
    main.innerHTML = ""; // 초기화

    switch(tabName) {
        case "home": renderHome(main); break;
        case "quest": renderQuest(main); break;
        case "battle": renderBattle(main); break;
        case "unit": renderUnit(main); break;
        case "shop": renderShop(main); break;
    }
}

// --- [A. 마이홈 렌더링] ---
function renderHome(container) {
    container.innerHTML = `<h2 class="section-title">대시보드</h2>`;
    
    // 전투력 요약
    const power = calculateDeckPower();
    const income = calculateHourlyIncome();

    const statsHTML = `
        <div class="stat-grid">
            <div class="stat-box">
                <span><i class="fa-solid fa-khanda"></i> 총 공격력</span>
                <span style="color:var(--color-red)">${power.atk.toLocaleString()}</span>
            </div>
            <div class="stat-box">
                <span><i class="fa-solid fa-shield-halved"></i> 총 방어력</span>
                <span style="color:var(--color-blue)">${power.def.toLocaleString()}</span>
            </div>
            <div class="stat-box">
                <span><i class="fa-solid fa-users"></i> 출전 유닛</span>
                <span>${power.count} / ${power.capacity}</span>
            </div>
            <div class="stat-box">
                <span><i class="fa-solid fa-sack-dollar"></i> 시간당 수익</span>
                <span style="color:var(--color-gold)">+${income.toLocaleString()} G</span>
            </div>
        </div>
    `;
    container.innerHTML += statsHTML;

    // 공지사항 등
    container.innerHTML += `
        <div class="card-item">
            <div class="card-info">
                <div class="card-title">오늘의 소식</div>
                <div class="card-desc">네오 갓워즈 오픈! 전설의 신들을 수집하세요.</div>
            </div>
        </div>
    `;
}

// --- [B. 임무 렌더링] ---
function renderQuest(container) {
    // 챕터 목록 루프
    for (let chKey in QUESTS) {
        const chapter = QUESTS[chKey];
        
        // 챕터 헤더
        const chDiv = document.createElement('div');
        chDiv.className = 'chapter-header';
        chDiv.innerHTML = `<h2>${chapter.name}</h2>`;
        // chDiv.style.backgroundImage = `url(${chapter.background})`; // 이미지 있다면
        container.appendChild(chDiv);

        // 퀘스트 리스트
        chapter.list.forEach(q => {
            const qItem = document.createElement('div');
            qItem.className = 'card-item';
            
            // 현재 숙련도
            let mastery = player.quests[q.id] || 0;
            let masteryPct = q.mastery_max ? Math.min(100, Math.floor((mastery / q.mastery_max) * 100)) : 0;
            
            // 보스 여부 확인
            let isBoss = q.type === 'boss';
            let icon = isBoss ? '<i class="fa-solid fa-skull"></i>' : '<i class="fa-solid fa-scroll"></i>';
            let btnText = isBoss ? '레이드' : '수행';
            let btnClass = isBoss ? 'btn-action primary' : 'btn-action';

            qItem.innerHTML = `
                <div class="card-thumb" style="border-color:${isBoss ? 'red': '#444'}">${icon}</div>
                <div class="card-info">
                    <div class="card-title">${q.name}</div>
                    <div class="card-meta">
                        <span><i class="fa-solid fa-bolt"></i> -${q.req_energy}</span>
                        <span><i class="fa-solid fa-star"></i> +${q.rew_exp}</span>
                        <span><i class="fa-solid fa-coins"></i> ${q.rew_gold_min}~${q.rew_gold_max}</span>
                    </div>
                    ${!isBoss ? `<div class="quest-progress-bg"><div class="quest-progress-fill" style="width:${masteryPct}%"></div></div>` : ''}
                </div>
                <div class="card-action">
                    <button class="${btnClass}" id="btn-q-${q.id}">${btnText}</button>
                </div>
            `;
            container.appendChild(qItem);

            // 버튼 이벤트
            document.getElementById(`btn-q-${q.id}`).addEventListener('click', () => {
                if (isBoss) {
                    startBossBattle(q.boss_id, q.req_energy); // 보스전은 에너지 대신 별도 로직? 아님 스태미나? -> 기획서상 스태미나지만 퀘스트 탭에 있으니 에너지로 표시됨. (기획서 수정: 보스 진입은 에너지, 실제 전투는 스태미나)
                } else {
                    doQuest(q);
                }
            });
        });
    }
}

// 임무 수행 로직
function doQuest(q) {
    if (player.stats.energy < q.req_energy) {
        showToast("에너지가 부족합니다.");
        return;
    }

    // 소모
    player.stats.energy -= q.req_energy;
    
    // 보상
    gainExp(q.rew_exp);
    const gold = Math.floor(Math.random() * (q.rew_gold_max - q.rew_gold_min + 1)) + q.rew_gold_min;
    player.resources.gold += gold;
    
    // 아이템 드랍
    let dropMsg = "";
    if (Math.random() < q.drop_rate) {
        gainItem(q.drop_item_id, 1);
        dropMsg = " [아이템 발견!]";
    }

    // 숙련도 증가
    if (!player.quests[q.id]) player.quests[q.id] = 0;
    if (player.quests[q.id] < q.mastery_max) {
        player.quests[q.id]++;
    }

    updateUI();
    renderTab('quest'); // 진행바 갱신을 위해 리렌더링 (최적화 필요하지만 일단 단순하게)
    showToast(`성공! +${gold}G +${q.rew_exp}exp ${dropMsg}`);
}

// --- [C. 배틀 렌더링 (보스 레이드)] ---
function renderBattle(container) {
    container.innerHTML = `<h2 class="section-title">보스 레이드</h2>`;
    
    // BOSSES 객체 순회
    for (let bKey in BOSSES) {
        const boss = BOSSES[bKey];
        
        // 쿨타임 체크
        let now = Date.now();
        let readyTime = player.bossCd[bKey] || 0;
        let isLocked = now < readyTime;
        
        const bItem = document.createElement('div');
        bItem.className = 'card-item';
        
        // 난이도별 색상
        let borderColor = '#fff';
        if (boss.rank === 'small') borderColor = 'var(--rank-uc)';
        if (boss.rank === 'medium') borderColor = 'var(--rank-r)';
        if (boss.rank === 'large') borderColor = 'var(--rank-l)';
        if (boss.rank === 'event') borderColor = 'var(--rank-e)';

        bItem.innerHTML = `
            <div class="card-thumb" style="border-color:${borderColor}; color:${borderColor}">
                <i class="fa-solid fa-dragon"></i>
            </div>
            <div class="card-info">
                <div class="card-title" style="color:${borderColor}">${boss.name} <span style="font-size:10px; margin-left:5px; color:#888">[${boss.rank.toUpperCase()}]</span></div>
                <div class="card-meta">
                    <span><i class="fa-solid fa-heart"></i> HP: ${boss.hp_max.toLocaleString()}</span>
                    <span><i class="fa-solid fa-fist-raised"></i> STM -${boss.req_stamina}</span>
                </div>
            </div>
            <div class="card-action">
                <button class="btn-action ${isLocked ? 'disabled' : 'primary'}" id="btn-boss-${bKey}">
                    ${isLocked ? '재충전 중' : '전투 개시'}
                </button>
            </div>
        `;
        container.appendChild(bItem);

        if (!isLocked) {
            document.getElementById(`btn-boss-${bKey}`).addEventListener('click', () => {
                doBossBattle(bKey, boss);
            });
        }
    }
}

// 보스 전투 로직
function doBossBattle(bossId, boss) {
    if (player.stats.stamina < boss.req_stamina) {
        showToast("스태미나가 부족합니다.");
        return;
    }
    if (player.stats.hp < 10) {
        showToast("체력이 너무 낮아 전투할 수 없습니다.");
        return;
    }

    // 자원 소모
    player.stats.stamina -= boss.req_stamina;
    
    // 전투 계산
    const myPower = calculateDeckPower();
    // 랜덤 보정 (±10%)
    const myDmg = Math.floor(myPower.atk * (0.9 + Math.random() * 0.2));
    const bossDmg = Math.max(0, Math.floor(boss.atk * (0.9 + Math.random() * 0.2)) - myPower.def);
    
    // 결과 판정 (단순화: 한 번 공격으로 끝나는게 아니라, 내가 보스 HP를 깎고, 보스가 나를 때림)
    // 갓워즈는 '레이드' 형식이므로 누적 데미지 개념이지만, 싱글 플레이므로
    // "나의 공격력이 보스 방어를 뚫고 HP를 0으로 만들 수 있는가?" (x)
    // "그냥 서로 한대씩 때리고 결과 출력" (o) -> 반복 클릭 유도

    // 싱글플레이 변형: 그냥 내 공격력이 보스 방어력보다 높으면 승리 확률 증가 방식 사용
    // 공식: (내공격 / (내공격 + 보스방어)) * 100 = 승률
    // 하지만 여기서는 그냥 "데미지 입히기" 방식으로 갑니다.
    
    // 플레이어 피격
    let dmgTaken = Math.max(10, bossDmg); // 최소 10 데미지
    player.stats.hp = Math.max(0, player.stats.hp - dmgTaken);
    
    // 승리 조건: 내 공격력이 보스 방어력의 20% 이상이면 잡는 것으로 간주 (약식)
    // 실제로는 보스 HP를 깎아야 하지만 DB저장이 복잡하므로 확률 승부
    let winChance = Math.min(0.95, myPower.atk / (boss.def * 2)); // 보스 방어의 2배 공격력이면 50% 승률... 좀 짜다.
    // 수정: (내 공격력 / 보스 체력) * 보정값
    
    let isWin = Math.random() < 0.5 + (myPower.atk - boss.def)/10000; // 대충 공격력이 높으면 이김
    if (myPower.atk > boss.def * 3) isWin = true; // 압도적

    if (isWin) {
        // 승리 보상
        gainExp(boss.rew_exp);
        player.resources.gold += boss.rew_gold;
        
        let msg = `전투 승리! 체력 -${dmgTaken}<br>획득: ${boss.rew_gold}G, ${boss.rew_exp}EXP`;
        
        // 카드 드랍
        gainUnit(boss.drop_card, 1);
        msg += `<br><span style="color:yellow">보스 카드 획득!</span>`;

        showModal("VICTORY", msg);
        
        // 쿨타임 적용
        player.bossCd[bossId] = Date.now() + (boss.time_limit * 1000); 
    } else {
        // 패배
        let lossGold = Math.floor(player.resources.gold * 0.1);
        player.resources.gold -= lossGold;
        showModal("DEFEAT", `패배했습니다... 체력 -${dmgTaken}<br>도주하며 ${lossGold} Gold를 잃어버렸습니다.`);
    }

    updateUI();
    renderTab('battle');
}

// --- [D. 부대(유닛/인벤) 렌더링] ---
function renderUnit(container) {
    container.innerHTML = `
        <h2 class="section-title">내 병력</h2>
        <div style="margin-bottom:10px; color:#888; font-size:12px;">
            * 전투 시 상위 유닛 자동 출전
        </div>
    `;

    // 유닛 정렬 (등급 높은 순)
    // 랭크 우선순위 매핑
    const rankOrder = { 'g': 6, 'l': 5, 'e': 4, 'r': 3, 'uc': 2, 'c': 1 };
    
    player.units.sort((a, b) => {
        let da = GODS.find(g => g.id === a.id);
        let db = GODS.find(g => g.id === b.id);
        if(!da || !db) return 0;
        return rankOrder[db.rank] - rankOrder[da.rank];
    });

    player.units.forEach(u => {
        const data = GODS.find(g => g.id === u.id);
        if (!data) return;

        // 등급 스타일 클래스
        const rankClass = `rank-${data.rank}`;
        
        const uDiv = document.createElement('div');
        uDiv.className = 'card-item';
        uDiv.innerHTML = `
            <div class="card-thumb ${rankClass}"><i class="fa-solid fa-user-shield"></i></div>
            <div class="card-info">
                <div class="card-title">
                    ${data.name} <span class="title-badge" style="border-color:var(--rank-${data.rank})">${data.rank.toUpperCase()}</span>
                </div>
                <div class="card-meta">
                    <span>⚔️ ${data.atk}</span>
                    <span>🛡️ ${data.def}</span>
                    <span>💰 -${data.cost}/h</span>
                </div>
                <div class="card-desc">속성: ${data.element} | 보유: ${u.count}명</div>
            </div>
        `;
        container.appendChild(uDiv);
    });
}

// --- [E. 상점/조합 렌더링] ---
function renderShop(container) {
    container.innerHTML = `<h2 class="section-title">상점 & 조합</h2>`;
    
    // 1. 유닛 소환 (Gacha)
    const gachaDiv = document.createElement('div');
    gachaDiv.className = 'card-item';
    gachaDiv.innerHTML = `
        <div class="card-thumb rank-l"><i class="fa-solid fa-dice"></i></div>
        <div class="card-info">
            <div class="card-title">용병 모집 (뽑기)</div>
            <div class="card-desc">무작위 등급의 유닛을 소환합니다.</div>
            <div class="card-meta">비용: 1,000 G</div>
        </div>
        <div class="card-action">
            <button class="btn-action primary" id="btn-gacha">소환</button>
        </div>
    `;
    container.appendChild(gachaDiv);
    
    document.getElementById('btn-gacha').addEventListener('click', doGacha);

    // 2. 건물 구매
    container.innerHTML += `<div style="margin:20px 0 10px; font-weight:bold; color:gold;">부동산 (시간당 수입)</div>`;
    
    BUILDINGS.forEach(b => {
        let count = player.buildings[b.id] || 0;
        // 가격 공식: 기본가격 * 1.5 ^ 보유수
        let cost = Math.floor(b.base_cost * Math.pow(1.5, count));
        
        const bDiv = document.createElement('div');
        bDiv.className = 'card-item';
        bDiv.innerHTML = `
            <div class="card-thumb"><i class="fa-solid fa-landmark"></i></div>
            <div class="card-info">
                <div class="card-title">${b.name} (Lv.${count})</div>
                <div class="card-desc">${b.desc}</div>
                <div class="card-meta">수입: +${b.income}G | 가격: ${cost.toLocaleString()}G</div>
            </div>
            <div class="card-action">
                <button class="btn-action" id="btn-build-${b.id}">구매</button>
            </div>
        `;
        container.appendChild(bDiv);

        document.getElementById(`btn-build-${b.id}`).addEventListener('click', () => {
            if (player.resources.gold >= cost) {
                player.resources.gold -= cost;
                if(!player.buildings[b.id]) player.buildings[b.id] = 0;
                player.buildings[b.id]++;
                showToast(`${b.name} 구매 완료!`);
                updateUI();
                renderTab('shop'); // 가격 갱신을 위해 리렌더링
            } else {
                showToast("골드가 부족합니다.");
            }
        });
    });

    // 3. 조합 (Recipe)
    container.innerHTML += `<div style="margin:20px 0 10px; font-weight:bold; color:gold;">전설 조합 (연금술)</div>`;
    
    RECIPES.forEach(r => {
        const resultUnit = GODS.find(g => g.id === r.result);
        const mat1Unit = GODS.find(g => g.id === r.mat1); // 유닛일수도
        const mat2Item = ITEMS.find(i => i.id === r.mat2); // 아이템일수도

        // 재료 이름 찾기 (유닛인지 아이템인지 구분 필요)
        // 여기선 mat1은 무조건 유닛(하위), mat2는 무조건 재료(아이템)으로 가정
        
        const rDiv = document.createElement('div');
        rDiv.className = 'card-item';
        rDiv.innerHTML = `
            <div class="card-thumb rank-e"><i class="fa-solid fa-flask"></i></div>
            <div class="card-info">
                <div class="card-title">${resultUnit.name} 제작</div>
                <div class="card-desc">
                    필요: ${mat1Unit.name} 1명 + ${mat2Item.name} 1개
                </div>
                <div class="card-meta">비용: ${r.cost.toLocaleString()}G | 확률: ${r.chance}%</div>
            </div>
            <div class="card-action">
                <button class="btn-action" id="btn-recipe-${r.id}">조합</button>
            </div>
        `;
        container.appendChild(rDiv);

        document.getElementById(`btn-recipe-${r.id}`).addEventListener('click', () => {
            doRecipe(r, mat1Unit, mat2Item, resultUnit);
        });
    });
}

// 뽑기 로직
function doGacha() {
    const cost = 1000;
    if (player.resources.gold < cost) {
        showToast("골드가 부족합니다.");
        return;
    }
    player.resources.gold -= cost;

    // 확률: C(50), UC(30), R(15), E(4), L(0.9), G(0.1)
    const rand = Math.random() * 100;
    let rank = 'c';
    if (rand > 50) rank = 'uc';
    if (rand > 80) rank = 'r';
    if (rand > 95) rank = 'e';
    if (rand > 99) rank = 'l';
    if (rand > 99.9) rank = 'g';

    // 해당 등급의 유닛 중 랜덤 1개
    const pool = GODS.filter(g => g.rank === rank);
    const picked = pool[Math.floor(Math.random() * pool.length)];

    gainUnit(picked.id, 1);
    
    // 결과 모달
    showModal("소환 결과", `<div style="color:var(--rank-${rank}); font-size:18px; font-weight:bold;">${picked.name}</div><br>등급: ${rank.toUpperCase()}`);
    updateUI();
}

// 조합 로직
function doRecipe(recipe, matUnit, matItem, resUnit) {
    // 1. 골드 체크
    if (player.resources.gold < recipe.cost) {
        showToast("골드가 부족합니다.");
        return;
    }
    // 2. 재료 유닛 체크
    const uIdx = player.units.findIndex(u => u.id === matUnit.id && u.count > 0);
    if (uIdx === -1) {
        showToast(`재료 유닛(${matUnit.name})이 없습니다.`);
        return;
    }
    // 3. 재료 아이템 체크
    if (!player.inventory[matItem.id] || player.inventory[matItem.id] < 1) {
        showToast(`재료 아이템(${matItem.name})이 없습니다.`);
        return;
    }

    // 소모
    player.resources.gold -= recipe.cost;
    player.units[uIdx].count--;
    if (player.units[uIdx].count === 0) player.units.splice(uIdx, 1); // 0명이면 배열에서 제거
    player.inventory[matItem.id]--;

    // 성공 판정
    if (Math.random() * 100 < recipe.chance) {
        gainUnit(resUnit.id, 1);
        showModal("조합 성공!", `<span style="color:gold">${resUnit.name}</span>을(를) 획득했습니다!`);
    } else {
        showModal("조합 실패...", "재료만 날렸습니다. ㅠㅠ");
    }
    updateUI();
}


// ==========================================
// 6. 유틸리티 (Helpers)
// ==========================================

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = `<i class="fa-solid fa-bell"></i> ${msg}`;
    container.appendChild(toast);
    
    // 2.5초 후 제거 (CSS animation 시간과 맞춤)
    setTimeout(() => {
        toast.remove();
    }, 2500);
}

function showModal(title, content) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-content').innerHTML = content;
    overlay.classList.remove('hidden');
}
