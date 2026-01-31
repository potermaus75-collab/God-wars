// --- 1. 설정 및 데이터 정의 ---
const PARTS = [
    { id: 'helmet', name: '헬멧', mainStat: 'hp' },
    { id: 'armor', name: '갑옷', mainStat: 'hp' },
    { id: 'boots', name: '신발', mainStat: 'hp' },
    { id: 'belt', name: '벨트', mainStat: 'hp' },
    { id: 'weapon', name: '무기', mainStat: 'dmg' },
    { id: 'glove', name: '장갑', mainStat: 'dmg' },
    { id: 'neck', name: '목걸이', mainStat: 'dmg' },
    { id: 'ring', name: '반지', mainStat: 'dmg' }
];

const SUB_STATS_LIST = [
    'critRate', 'critDmg', 'block', 'hpRegen', 'lifesteal', 
    'doubleHit', 'dmgFlat', 'meleeDmg', 'rangeDmg', 
    'atkSpd', 'skillDmg', 'cooldown', 'hpFlat'
];

// 게임 상태
let gameState = {
    gold: 0,
    hammers: 1000, // 테스트용 초기 자원
    anvilLevel: 1,
    stage: 1,
    equipment: {}, // 현재 착용 중인 장비
};

// 전투용 변수
let battleState = {
    playerHp: 100,
    playerMaxHp: 100,
    enemyHp: 100,
    enemyMaxHp: 100,
    lastAttackTime: 0,
    isFighting: true
};

// 임시 저장용 (모루 결과)
let pendingGear = null; 

// --- 2. 핵심 로직: 스탯 계산 ---
function calculateTotalStats() {
    let stats = {
        hp: 100, // 기본 체력
        dmg: 10, // 기본 공격력
        atkSpd: 1.0, // 초당 공격 횟수
        // 나머지 서브스탯 초기값 0
        critRate: 0, critDmg: 150, block: 0, hpRegen: 0, lifesteal: 0,
        doubleHit: 0, dmgFlat: 0, meleeDmg: 0, rangeDmg: 0,
        skillDmg: 0, cooldown: 0, hpFlat: 0
    };

    PARTS.forEach(part => {
        const gear = gameState.equipment[part.id];
        if (gear) {
            // 주 스탯 적용
            if (part.mainStat === 'hp') stats.hp += gear.mainVal;
            if (part.mainStat === 'dmg') stats.dmg += gear.mainVal;

            // 보조 스탯 적용 (단순 합산 예시)
            gear.subStats.forEach(sub => {
                // 실제 구현에선 %와 고정수치를 구분해야 하지만 여기선 단순화
                if(stats[sub.type] !== undefined) stats[sub.type] += sub.val;
            });
        }
    });

    // 보조스탯에 의한 최종 보정 (예: hpFlat 더하기)
    stats.hp += stats.hpFlat;
    stats.dmg += stats.dmgFlat;
    
    return stats;
}

// --- 3. 모루 시스템 (장비 생성) ---
function generateRandomGear() {
    // 1. 부위 랜덤
    const part = PARTS[Math.floor(Math.random() * PARTS.length)];
    
    // 2. 등급/레벨 결정 (모루 레벨에 따라 가중치 - 여기선 단순화)
    const level = Math.floor(Math.random() * 100) + 1; 
    const gradeMultiplier = 1 + (gameState.anvilLevel * 0.1); 

    // 3. 주스탯 계산
    const mainVal = Math.floor(level * 10 * gradeMultiplier);

    // 4. 보조스탯 랜덤 (1~3개)
    const subStatCount = Math.floor(Math.random() * 3) + 1;
    const subStats = [];
    for(let i=0; i<subStatCount; i++) {
        const type = SUB_STATS_LIST[Math.floor(Math.random() * SUB_STATS_LIST.length)];
        const val = Math.floor(Math.random() * 10) + 1; // 임의 값
        subStats.push({ type, val });
    }

    return {
        id: part.id,
        name: part.name,
        level: level,
        mainVal: mainVal,
        subStats: subStats,
        isNew: true
    };
}

function summonGear() {
    const cost = 10;
    if (gameState.hammers < cost) {
        alert("망치가 부족합니다!");
        return;
    }
    gameState.hammers -= cost;
    updateResources();

    pendingGear = generateRandomGear();
    showCompareModal(pendingGear);
}

// --- 4. UI 업데이트 ---
function initSlots() {
    const container = document.getElementById('equip-slots');
    container.innerHTML = '';
    PARTS.forEach(part => {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.id = `slot-${part.id}`;
        slot.innerText = part.name;
        container.appendChild(slot);
    });
}

function updateEquipmentUI() {
    PARTS.forEach(part => {
        const el = document.getElementById(`slot-${part.id}`);
        const gear = gameState.equipment[part.id];
        if (gear) {
            el.className = 'slot'; // empty 클래스 제거
            el.innerHTML = `${gear.name}<br>Lv.${gear.level}`;
            el.style.backgroundColor = '#9c27b0'; // 장착됨 색상
        } else {
            el.className = 'slot empty';
            el.innerText = part.name;
            el.style.backgroundColor = '#7a6a96';
        }
    });
}

function updateResources() {
    document.getElementById('hammer-cnt').innerText = gameState.hammers;
    document.getElementById('gold-cnt').innerText = gameState.gold;
    document.getElementById('anvil-lv').innerText = gameState.anvilLevel;
}

// 팝업 관련
const modal = document.getElementById('modal');
const currentCard = document.getElementById('current-gear-stats');
const newCard = document.getElementById('new-gear-stats');

function showCompareModal(newGear) {
    const currentGear = gameState.equipment[newGear.id];
    
    // 현재 장비 정보 표시
    if(currentGear) {
        currentCard.innerHTML = `
            Lv.${currentGear.level}<br>
            주: ${currentGear.mainVal}<br>
            옵션: ${currentGear.subStats.length}개
        `;
    } else {
        currentCard.innerHTML = "장착 중인 장비 없음";
    }

    // 새 장비 정보 표시
    newCard.innerHTML = `
        <strong>${newGear.name}</strong><br>
        Lv.${newGear.level}<br>
        주: ${newGear.mainVal}<br>
        옵션: ${newGear.subStats.map(s => s.type).join(', ')}
    `;

    modal.classList.remove('hidden');
}

// 선택 로직
document.getElementById('keep-btn').onclick = () => {
    // 5. 모루 경험치/재화로 환산 (여기선 그냥 골드 획득으로 처리)
    gameState.gold += 10; 
    updateResources();
    modal.classList.add('hidden');
    pendingGear = null;
};

document.getElementById('equip-btn').onclick = () => {
    gameState.equipment[pendingGear.id] = pendingGear;
    updateEquipmentUI();
    // 스탯 재계산
    const stats = calculateTotalStats();
    battleState.playerMaxHp = stats.hp; 
    // 현재 체력 비율 유지 혹은 회복 로직 필요
    
    modal.classList.add('hidden');
    pendingGear = null;
};

// --- 5. 자동 전투 루프 ---
function spawnEnemy() {
    battleState.enemyMaxHp = gameState.stage * 50;
    battleState.enemyHp = battleState.enemyMaxHp;
    document.getElementById('enemy').innerText = ['👾','🐉','👹','👻'][gameState.stage % 4];
    document.getElementById('stage-num').innerText = gameState.stage;
}

function gameLoop(timestamp) {
    if (!battleState.isFighting) return requestAnimationFrame(gameLoop);

    const stats = calculateTotalStats();
    
    // 공격 속도에 따른 공격 (여기선 간단히 프레임당 확률로 처리하거나 시간차 계산)
    // 간단화를 위해 1초(1000ms)마다 공격한다고 가정
    if (timestamp - battleState.lastAttackTime > (1000 / stats.atkSpd)) {
        // 플레이어 공격
        let dmg = stats.dmg;
        // 치명타 로직
        if(Math.random() * 100 < stats.critRate) dmg *= (stats.critDmg / 100);
        
        battleState.enemyHp -= dmg;
        document.getElementById('damage-log').innerText = `적에게 ${Math.floor(dmg)} 피해!`;

        // 적 처치?
        if (battleState.enemyHp <= 0) {
            gameState.gold += (gameState.stage * 10);
            gameState.hammers += 5; // 적 처치시 망치 드랍
            updateResources();
            gameState.stage++;
            spawnEnemy();
        } else {
            // 적의 반격 (단순화)
            battleState.playerHp -= (gameState.stage * 2);
            if (battleState.playerHp <= 0) {
                 // 사망 패널티 없이 부활 (방치형 특성)
                 battleState.playerHp = stats.hp;
                 document.getElementById('damage-log').innerText = "패배.. 체력 회복 중";
            }
        }

        battleState.lastAttackTime = timestamp;
        
        // UI 갱신 (HP 바)
        document.getElementById('player-hp-bar').style.width = `${(battleState.playerHp / stats.hp) * 100}%`;
        document.getElementById('enemy-hp-bar').style.width = `${(battleState.enemyHp / battleState.enemyMaxHp) * 100}%`;
    }

    requestAnimationFrame(gameLoop);
}

// --- 초기화 및 이벤트 리스너 ---
document.getElementById('summon-btn').onclick = summonGear;
document.getElementById('upgrade-btn').onclick = () => {
    const cost = 100 * gameState.anvilLevel;
    if(gameState.gold >= cost) {
        gameState.gold -= cost;
        gameState.anvilLevel++;
        document.getElementById('upgrade-cost').innerText = 100 * gameState.anvilLevel;
        updateResources();
    } else {
        alert("골드가 부족합니다.");
    }
};

// 게임 시작
initSlots();
updateResources();
spawnEnemy();
requestAnimationFrame(gameLoop);
