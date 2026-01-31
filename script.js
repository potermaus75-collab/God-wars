// --- 설정 데이터 ---
const PARTS = [
    { id: 'helmet', name: '헬멧', mainStat: 'hp', type: 'armor' },
    { id: 'armor', name: '갑옷', mainStat: 'hp', type: 'armor' },
    { id: 'boots', name: '신발', mainStat: 'hp', type: 'armor' },
    { id: 'belt', name: '벨트', mainStat: 'hp', type: 'armor' },
    { id: 'weapon', name: '무기', mainStat: 'dmg', type: 'weapon' },
    { id: 'glove', name: '장갑', mainStat: 'dmg', type: 'armor' },
    { id: 'neck', name: '목걸이', mainStat: 'dmg', type: 'armor' },
    { id: 'ring', name: '반지', mainStat: 'dmg', type: 'armor' }
];

const GRADE_INFO = [
    { name: '원시', color: 'grade-0', rate: 1.0 },
    { name: '중세', color: 'grade-1', rate: 1.5 },
    { name: '근대', color: 'grade-2', rate: 2.5 },
    { name: '현대', color: 'grade-3', rate: 4.0 },
    { name: '우주', color: 'grade-4', rate: 6.5 },
    { name: '항성', color: 'grade-5', rate: 10.0 },
    { name: '다중우주', color: 'grade-6', rate: 15.0 },
    { name: '양자', color: 'grade-7', rate: 25.0 },
    { name: '지하세계', color: 'grade-8', rate: 40.0 },
    { name: '신성', color: 'grade-9', rate: 100.0 }
];

const SUB_STATS = [
    { type: 'critRate', name: '치명타%', weight: 1 },
    { type: 'critDmg', name: '치명피해%', weight: 1 },
    { type: 'doubleHit', name: '더블찬스%', weight: 1 },
    { type: 'atkSpd', name: '공속%', weight: 1 },
    { type: 'lifesteal', name: '흡혈%', weight: 1 },
    { type: 'dmgPct', name: '피해증가%', weight: 2 },
    { type: 'hpPct', name: '체력증가%', weight: 2 }
];

// --- 상태 변수 ---
let gameState = {
    nick: '', gold: 0, hammers: 100, anvilLevel: 1, 
    mainStage: 1, subStage: 1, equipment: {}
};
let battle = { 
    pHp: 100, pMaxHp: 100, eHp: 100, eMaxHp: 100, 
    stats: {}, state: 'idle', // idle, walking, fighting
    lastAtk: 0 
};
let tempGear = null;
let saveTimer = null;

// --- 1. 통계 계산 (원거리 너프 적용) ---
function calcStats() {
    let s = { hp: 200, dmg: 20, crt: 5, cdmg: 150, dbl: 0, spd: 1.0, life: 0 };
    
    // 무기 타입 확인
    let wType = 'melee';
    if(gameState.equipment['weapon'] && gameState.equipment['weapon'].isRange) wType = 'range';

    Object.values(gameState.equipment).forEach(g => {
        if(g.mainType === 'hp') s.hp += g.mainVal;
        if(g.mainType === 'dmg') s.dmg += g.mainVal;
        
        g.subs.forEach(sub => {
            if(sub.type === 'hpPct') s.hp *= (1 + sub.val/100);
            if(sub.type === 'dmgPct') s.dmg *= (1 + sub.val/100);
            if(sub.type === 'critRate') s.crt += sub.val;
            if(sub.type === 'critDmg') s.cdmg += sub.val;
            if(sub.type === 'doubleHit') s.dbl += sub.val;
            if(sub.type === 'atkSpd') s.spd += (sub.val/100);
            if(sub.type === 'lifesteal') s.life += sub.val;
        });
    });

    s.hp = Math.floor(s.hp);
    s.dmg = Math.floor(s.dmg);

    // [요청 반영] 원거리 피해량 20% 너프
    if(wType === 'range') {
        s.dmg = Math.floor(s.dmg * 0.8);
    }

    battle.stats = s;
    battle.stats.wType = wType;
    battle.pMaxHp = s.hp;
    if(battle.pHp > battle.pMaxHp) battle.pHp = battle.pMaxHp;
    
    // 무기 아이콘 변경
    const heroWeapon = document.getElementById('hero-weapon');
    if(wType === 'range') heroWeapon.className = 'weapon-hand bow';
    else heroWeapon.className = 'weapon-hand sword';
}

// --- 2. 스테이지 진행 (워킹 애니메이션) ---
function spawnEnemy() {
    battle.state = 'walking'; // 상태 변경

    // 1. 적 스탯 설정
    const stageFactor = (gameState.mainStage - 1) * 10 + gameState.subStage;
    let isBoss = (gameState.subStage === 10);
    let isMid = (gameState.subStage === 5);
    let multiplier = isBoss ? 5.0 : (isMid ? 2.5 : 1.0);

    // 보스 UI 처리
    const mobArt = document.getElementById('enemy-art');
    const bossTag = document.getElementById('boss-tag');
    if(isBoss || isMid) {
        mobArt.className = 'css-monster boss';
        bossTag.innerText = isBoss ? "☠️BOSS" : "😈MID";
        bossTag.classList.remove('hidden');
    } else {
        mobArt.className = 'css-monster slime';
        bossTag.classList.add('hidden');
    }

    // 체력/공격력 설정
    let baseHp = 100 * Math.pow(1.15, stageFactor) * multiplier;
    let baseAtk = 10 * Math.pow(1.1, stageFactor) * multiplier;
    battle.eMaxHp = Math.floor(baseHp);
    battle.eHp = battle.eMaxHp;
    battle.eAtk = Math.floor(baseAtk);

    document.getElementById('stage-num').innerText = `${gameState.mainStage}-${gameState.subStage}`;
    updateBars();

    // 2. 워킹 애니메이션 시작
    const heroWrap = document.getElementById('hero-wrapper');
    const enemyWrap = document.getElementById('enemy-wrapper');

    // 클래스 리셋 (애니메이션 재실행을 위해)
    heroWrap.className = 'unit-wrapper hero-start-pos';
    enemyWrap.className = 'unit-wrapper enemy-start-pos';
    
    // 리플로우 강제
    void heroWrap.offsetWidth;

    // 이동 클래스 부여
    const isRange = battle.stats.wType === 'range';
    heroWrap.classList.add(isRange ? 'walk-in-range' : 'walk-in-melee');
    enemyWrap.classList.add('walk-in-enemy');

    // 3. 전투 시작 타이밍
    // 원거리는 걷는 도중(0.5초 후)부터 공격 가능, 근거리는 1.5초(도착) 후 전투
    let fightDelay = isRange ? 500 : 1500;
    
    setTimeout(() => {
        battle.state = 'fighting';
    }, 1500); // 몬스터와 만나는 시간은 1.5초로 고정 (적의 공격 시작 시점)

    // 원거리는 미리 공격 시작하도록 플래그 처리
    if(isRange) {
        setTimeout(() => {
            // 원거리용 임시 전투 상태 (플레이어만 공격)
            if(battle.state === 'walking') battle.earlyFire = true; 
        }, 200);
    } else {
        battle.earlyFire = false;
    }
}

// --- 3. 전투 루프 ---
function gameLoop(time) {
    requestAnimationFrame(gameLoop);
    
    // 전투 중이거나, 원거리 조기 사격 모드일 때
    let canAttack = (battle.state === 'fighting') || (battle.earlyFire && battle.eHp > 0);
    if (!canAttack) return;

    const atkInterval = 1000 / battle.stats.spd;
    
    if (time - battle.lastAtk > atkInterval) {
        battle.lastAtk = time;
        playerAttack();
    }

    // 적의 공격 (완전히 만났을 때만)
    if (battle.state === 'fighting') {
        // 적 공격 속도는 단순하게 프레임당 확률 혹은 플레이어 공격 턴에 맞춰 반격
        // 여기선 플레이어 공격 시점에 같이 반격받는 턴제 느낌으로 구현 (단순화)
        // 실제로는 별도 타이머가 좋으나 코드 복잡도상 반격 로직으로 처리
        enemyAttack(); 
    }
}

function playerAttack() {
    // 애니메이션
    const wHand = document.getElementById('hero-weapon');
    const isRange = battle.stats.wType === 'range';
    wHand.className = isRange ? 'weapon-hand bow hero-shoot-anim' : 'weapon-hand sword hero-atk-anim';
    setTimeout(()=> wHand.classList.remove('hero-shoot-anim', 'hero-atk-anim'), 200);

    // 데미지 계산
    let dmg = battle.stats.dmg;
    let isCrit = Math.random() * 100 < battle.stats.crt;
    if(isCrit) dmg *= (battle.stats.cdmg / 100);

    spawnDmgText(Math.floor(dmg), isCrit, false);
    
    // 체력 감소
    battle.eHp -= dmg;
    
    // 더블 찬스
    if(Math.random() * 100 < battle.stats.dbl) {
        setTimeout(() => {
            spawnDmgText(Math.floor(dmg*0.5), false, true);
            battle.eHp -= (dmg * 0.5);
            checkWin();
        }, 200);
    }
    
    // 흡혈
    if(battle.stats.life > 0) {
        battle.pHp = Math.min(battle.pMaxHp, battle.pHp + dmg * (battle.stats.life/100));
    }

    checkWin();
    updateBars();
}

function enemyAttack() {
    // 몬스터는 플레이어보다 느리게 공격한다고 가정 (약 50% 확률로 턴마다 공격)
    if(Math.random() > 0.5) return; 

    battle.pHp -= battle.eAtk;
    if(battle.pHp <= 0) {
        // 패배: 스테이지 리셋 없이 체력 회복
        battle.pHp = battle.pMaxHp;
        battle.eHp = battle.eMaxHp;
        battle.state = 'idle'; // 잠시 멈춤
        setTimeout(() => spawnEnemy(), 1000); // 재시작
    }
    updateBars();
}

function checkWin() {
    if(battle.eHp <= 0) {
        battle.eHp = 0;
        battle.state = 'idle'; // 전투 종료
        battle.earlyFire = false;
        
        // 보상
        const stageFactor = (gameState.mainStage - 1) * 10 + gameState.subStage;
        gameState.gold += stageFactor * 10;
        gameState.hammers += 2;
        
        // 스테이지 업
        gameState.subStage++;
        if(gameState.subStage > 10) {
            gameState.mainStage++;
            gameState.subStage = 1;
        }
        
        updateUI();
        
        // 몬스터 죽는 연출 후 다음 스테이지
        const enemyWrap = document.getElementById('enemy-wrapper');
        enemyWrap.style.transform = 'translateY(50px) scale(0)'; // 쓰러짐
        
        setTimeout(() => spawnEnemy(), 1000);
    }
}

function spawnDmgText(val, isCrit, isDouble) {
    const layer = document.getElementById('damage-layer');
    const el = document.createElement('div');
    el.className = 'floating-txt';
    el.innerText = isDouble ? `Double! ${val}` : val;
    el.style.left = '60%'; // 몬스터 쪽
    el.style.top = '50%';
    
    if(isCrit) { el.style.color = '#ff4444'; el.style.fontSize = '24px'; }
    if(isDouble) { el.style.color = '#ffd700'; }
    
    layer.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

// --- 4. 장비 제작 (옵션 제한) ---
function craftGear() {
    if(gameState.hammers < 10) return alert("망치가 부족합니다!");
    gameState.hammers -= 10;
    updateUI();

    const part = PARTS[Math.floor(Math.random() * PARTS.length)];
    // 모루 레벨에 따른 등급 산출
    let maxG = Math.min(9, Math.floor(gameState.anvilLevel/3) + 2);
    let minG = Math.max(0, Math.floor(gameState.anvilLevel/5) - 1);
    let gradeIdx = Math.floor(Math.random() * (maxG - minG + 1)) + minG;
    
    const grade = GRADE_INFO[gradeIdx];
    const lv = Math.max(1, (gameState.anvilLevel * 5) + Math.floor(Math.random()*10));
    
    let mainVal = lv * 10 * grade.rate;
    let isRange = (part.id === 'weapon') && (Math.random() > 0.5);

    // [요청 반영] 보조 옵션 최대 2개
    const subCnt = Math.floor(Math.random() * 2) + 1; 
    let subs = [];
    for(let i=0; i<subCnt; i++){
        let s = SUB_STATS[Math.floor(Math.random()*SUB_STATS.length)];
        let val = (Math.random() * 5 * grade.rate).toFixed(1);
        subs.push({ ...s, val: parseFloat(val) });
    }

    tempGear = {
        id: part.id, name: part.name, type: part.type,
        lv: lv, gradeIdx: gradeIdx, gradeName: grade.name, color: grade.color,
        mainType: part.mainStat, mainVal: Math.floor(mainVal),
        subs: subs, isRange: isRange
    };

    showCompare(tempGear);
    saveGame();
}

// --- UI 및 저장 ---
function updateBars() {
    const pHp = document.getElementById('hero-hp-fill');
    const eHp = document.getElementById('enemy-hp-fill');
    pHp.style.width = `${(battle.pHp / battle.pMaxHp)*100}%`;
    eHp.style.width = `${(battle.eHp / battle.eMaxHp)*100}%`;
}

function updateUI() {
    document.getElementById('hammer-cnt').innerText = gameState.hammers;
    document.getElementById('gold-cnt').innerText = gameState.gold;
    document.getElementById('anvil-lv').innerText = gameState.anvilLevel;
    document.getElementById('upgrade-cost').innerText = gameState.anvilLevel * 500;
}

function renderSlots() {
    const con = document.getElementById('equip-slots');
    con.innerHTML = '';
    PARTS.forEach(p => {
        const d = document.createElement('div');
        const gear = gameState.equipment[p.id];
        
        let iconHtml = p.name;
        if(p.id === 'weapon') iconHtml = '⚔️'; 
        // CSS 아이콘 대신 문자로 간소화하거나, 이전 CSS 아이콘 유지 가능. 
        // 여기선 등급 색상 강조를 위해 텍스트+색상 사용
        
        if(gear) {
            d.className = `slot ${gear.color}`;
            let wIcon = gear.isRange ? '🏹' : (p.id==='weapon'?'⚔️':'🛡️');
            d.innerHTML = `
                <div style="font-size:20px;">${wIcon}</div>
                <div style="font-size:10px; font-weight:bold;">Lv.${gear.lv}</div>
            `;
            d.onclick = () => showDetail(gear);
        } else {
            d.className = 'slot';
            d.innerHTML = `<div style="font-size:10px; color:#777;">${p.name}</div>`;
        }
        con.appendChild(d);
    });
}

function getGearHTML(g) {
    if(!g) return '<div style="padding:10px; color:#777;">장비 없음</div>';
    let typeTxt = g.isRange ? '(원거리)' : '';
    return `
        <div class="view-main" style="border:none; color:${getColor(g.gradeIdx)}">
            [${g.gradeName}] ${g.name} ${typeTxt}
        </div>
        <div class="view-main">${g.mainType==='hp'?'체력':'공격력'} +${g.mainVal}</div>
        <div style="color:#aaa;">
            ${g.subs.map(s=>`<div>• ${s.name} +${s.val}%</div>`).join('')}
        </div>
        <div style="font-size:10px; color:#555; margin-top:5px;">Lv.${g.lv}</div>
    `;
}
function getColor(idx) { return ['#fff','#87ceeb','#90ee90','#ffd700','#ff4444','#d64bd6','#00bfff','#aaaaff','#d2b48c','gold'][idx]; }

function showCompare(newG) {
    const curG = gameState.equipment[newG.id];
    document.getElementById('current-gear-detail').innerHTML = getGearHTML(curG);
    document.getElementById('new-gear-detail').innerHTML = getGearHTML(newG);
    document.getElementById('compare-modal').classList.remove('hidden');
}
function showDetail(g) {
    document.getElementById('selected-gear-detail').innerHTML = getGearHTML(g);
    document.getElementById('detail-modal').classList.remove('hidden');
}

// 저장/로드
function saveGame() {
    if(!gameState.nick) return;
    localStorage.setItem(`cssRpg_v2_${gameState.nick}`, JSON.stringify(gameState));
}
function loadGame(nick) {
    const data = localStorage.getItem(`cssRpg_v2_${nick}`);
    if(data) {
        gameState = JSON.parse(data);
    } else {
        gameState = {
            nick: nick, gold: 0, hammers: 100, anvilLevel: 1, 
            mainStage: 1, subStage: 1, equipment: {}
        };
    }
    // 화면 전환
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-app').classList.remove('hidden');
    
    calcStats();
    renderSlots();
    updateUI();
    spawnEnemy(); // 게임 루프 시작
    requestAnimationFrame(gameLoop);
    setInterval(saveGame, 5000);
}

// 이벤트
document.getElementById('start-game-btn').onclick = () => {
    const n = document.getElementById('nickname-input').value.trim();
    if(n) loadGame(n);
};
document.getElementById('summon-btn').onclick = craftGear;
document.getElementById('keep-btn').onclick = () => {
    gameState.gold += 50;
    document.getElementById('compare-modal').classList.add('hidden');
    updateUI();
};
document.getElementById('equip-btn').onclick = () => {
    gameState.equipment[tempGear.id] = tempGear;
    calcStats(); renderSlots();
    document.getElementById('compare-modal').classList.add('hidden');
    saveGame();
};
document.getElementById('close-detail-btn').onclick = () => document.getElementById('detail-modal').classList.add('hidden');
document.getElementById('upgrade-btn').onclick = () => {
    const cost = gameState.anvilLevel * 500;
    if(gameState.gold >= cost) {
        gameState.gold -= cost;
        gameState.anvilLevel++;
        updateUI(); saveGame();
    }
};
document.getElementById('reset-data-btn').onclick = () => {
    if(confirm('초기화 하시겠습니까?')) {
        localStorage.removeItem(`cssRpg_v2_${gameState.nick}`);
        location.reload();
    }
};
