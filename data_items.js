// data_items.js
const ITEMS = [
    // --- [소모품] ---
    { id: "pot_hp_s", type: "consumable", name: "하급 치료 물약", effect: "hp+50", cost: 100, desc: "체력을 50 회복합니다." },
    { id: "pot_hp_l", type: "consumable", name: "엘릭서", effect: "hp+100%", cost: 1000, desc: "체력을 모두 회복합니다." },
    { id: "pot_en_s", type: "consumable", name: "에너지 드링크", effect: "energy+100%", cost: 500, desc: "에너지를 모두 회복합니다." },
    
    // --- [챕터 1: 그리스 재료] ---
    { id: "mat_g_01", type: "material", name: "부러진 창", desc: "병사들이 쓰던 창의 파편." },
    { id: "mat_g_02", type: "material", name: "올리브 나뭇가지", desc: "그리스의 흔한 나뭇가지." },
    { id: "mat_g_03", type: "material", name: "포도주", desc: "디오니소스가 좋아할 법한 술." },
    { id: "mat_g_04", type: "material", name: "님프의 날개가루", desc: "반짝이는 가루." },
    { id: "mat_g_05", type: "material", name: "히드라의 독", desc: "매우 치명적인 독." },
    { id: "mat_g_06", type: "material", name: "황금 양털", desc: "전설적인 보물. (조합 재료)" },
    { id: "mat_g_rare", type: "material", name: "제우스의 번개 조각", desc: "신 등급 조합 핵심 재료.", rarity: "legend" },

    // --- [챕터 2: 한국 재료] ---
    { id: "mat_k_01", type: "material", name: "쑥과 마늘", desc: "사람이 되기 위한 필수품." },
    { id: "mat_k_02", type: "material", name: "호랑이 가죽", desc: "질긴 가죽." },
    { id: "mat_k_03", type: "material", name: "깨진 기와", desc: "오래된 건물의 잔해." },
    { id: "mat_k_04", type: "material", name: "도깨비 감투", desc: "쓰면 투명해진다는 소문이 있다." },
    { id: "mat_k_05", type: "material", name: "청자 조각", desc: "고려 청자의 파편." },
    { id: "mat_k_rare", type: "material", name: "천부인", desc: "환웅의 징표. (조합 재료)", rarity: "legend" },
	
	// --- [챕터 2.5: 북유럽 재료 (누락분 추가)] ---
    { id: "mat_n_01", type: "material", name: "룬 문자석", desc: "마력이 담긴 돌.", cost: 0 },
    { id: "mat_n_02", type: "material", name: "발키리의 깃털", desc: "전장의 깃털.", cost: 0 },
    { id: "mat_n_03", type: "material", name: "미드가르드의 흙", desc: "인간 세상의 흙.", cost: 0 },
    { id: "mat_n_04", type: "material", name: "영원한 얼음", desc: "녹지 않는 얼음 조각.", cost: 0 },
    { id: "mat_n_05", type: "material", name: "세계수의 잎사귀", desc: "이그드라실의 잎.", cost: 0 },
    { id: "mat_n_rare", type: "material", name: "오딘의 안대", desc: "지혜를 위해 바친 것. (조합 재료)", rarity: "legend", cost: 0 },
    
	// --- [챕터 3: 이집트 재료] ---
    { id: "mat_e_01", type: "material", name: "파피루스", desc: "기록용 종이." },
    { id: "mat_e_02", type: "material", name: "풍뎅이 보석", desc: "스카라베 장식." },
    { id: "mat_e_03", type: "material", name: "미라의 붕대", desc: "오래되었지만 튼튼하다." },
    { id: "mat_e_04", type: "material", name: "사막의 모래", desc: "평범한 모래가 아니다." },
    { id: "mat_e_rare", type: "material", name: "태양의 서", desc: "라의 힘이 담긴 책.", rarity: "legend" },


    // --- [무기 - Weapon] ---
    { id: "w_001", type: "equip", slot: "weapon", name: "녹슨 검", atk: 5, def: 0, cost: 500, desc: "초보자의 검." },
    { id: "w_002", type: "equip", slot: "weapon", name: "스파르타의 창", atk: 25, def: 5, cost: 5000, desc: "300 용사의 기백." },
    { id: "w_003", type: "equip", slot: "weapon", name: "도깨비 방망이", atk: 60, def: 0, cost: 20000, desc: "금 나와라 뚝딱." },
    { id: "w_004", type: "equip", slot: "weapon", name: "엑스칼리버", atk: 200, def: 50, cost: 1000000, rarity: "legend", desc: "왕의 검." },
    { id: "w_god", type: "equip", slot: "weapon", name: "제우스의 번개", atk: 500, def: 100, cost: 0, rarity: "god", desc: "최강의 무기. (조합 전용)" },

    // --- [방어구 - Armor] ---
    { id: "a_001", type: "equip", slot: "armor", name: "가죽 갑옷", atk: 0, def: 5, cost: 500, desc: "기본적인 방어구." },
    { id: "a_002", type: "equip", slot: "armor", name: "청동 방패", atk: 0, def: 30, cost: 4500, desc: "그리스 병사의 방패." },
    { id: "a_003", type: "equip", slot: "armor", name: "미스릴 갑옷", atk: 10, def: 80, cost: 50000, rarity: "epic", desc: "가볍고 단단하다." },
    { id: "a_god", type: "equip", slot: "armor", name: "아이기스", atk: 50, def: 400, cost: 0, rarity: "god", desc: "모든 것을 막아내는 방패." }
];
