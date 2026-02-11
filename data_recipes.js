const RECIPES = [
    // ==========================================
    // 1. 그리스 신화 (Greek Recipes)
    // ==========================================
    // [Tier 1: 병사 승급]
    { id: "rcp_gr_01", result: "g_gr_u1", mat1: "g_gr_c1", mat2: "mat_g_01", cost: 500, chance: 100 }, // 민병대+창 = 홉라이트
    { id: "rcp_gr_02", result: "g_gr_u2", mat1: "g_gr_c2", mat2: "mat_g_02", cost: 800, chance: 100 }, // 시녀+나뭇가지 = 아마존
    // [Tier 2: 괴수 제작]
    { id: "rcp_gr_03", result: "g_gr_r1", mat1: "g_gr_u2", mat2: "mat_g_03", cost: 3000, chance: 90 }, // 아마존+포도주 = 켄타우로스
    { id: "rcp_gr_04", result: "g_gr_r2", mat1: "g_gr_u1", mat2: "mat_g_05", cost: 4000, chance: 85 }, // 홉라이트+독 = 사이클롭스
    // [Tier 3: 영웅 탄생]
    { id: "rcp_gr_05", result: "g_gr_e1", mat1: "g_gr_r1", mat2: "mat_g_06", cost: 15000, chance: 60 }, // 켄타우로스+황금양털 = 헤라클레스
    { id: "rcp_gr_06", result: "g_gr_e2", mat1: "g_gr_r2", mat2: "mat_g_04", cost: 18000, chance: 60 }, // 사이클롭스+날개가루 = 메두사
    // [Tier 4: 신의 강림]
    { id: "rcp_gr_07", result: "g_gr_l1", mat1: "g_gr_e1", mat2: "w_002", cost: 50000, chance: 40 }, // 헤라클레스+스파르타창 = 아레스
    { id: "rcp_gr_08", result: "g_gr_l2", mat1: "g_gr_e2", mat2: "a_002", cost: 55000, chance: 40 }, // 메두사+청동방패 = 아테나
    // [Tier 5: 주신 (Ultimate)]
    { id: "rcp_gr_09", result: "g_gr_g1", mat1: "g_gr_l1", mat2: "mat_g_rare", cost: 200000, chance: 15 }, // 아레스+번개조각 = 제우스

    // ==========================================
    // 2. 한국 신화 (Korean Recipes)
    // ==========================================
    { id: "rcp_kr_01", result: "g_kr_u1", mat1: "g_kr_c1", mat2: "mat_k_03", cost: 600, chance: 100 }, // 포졸+기와 = 착호갑사
    { id: "rcp_kr_02", result: "g_kr_u2", mat1: "g_kr_c1", mat2: "mat_k_05", cost: 1000, chance: 95 }, // 포졸+청자 = 저승사자
    { id: "rcp_kr_03", result: "g_kr_r1", mat1: "g_kr_c2", mat2: "mat_k_04", cost: 3500, chance: 90 }, // 사당패+감투 = 도깨비
    { id: "rcp_kr_04", result: "g_kr_r2", mat1: "g_kr_c2", mat2: "mat_k_02", cost: 4000, chance: 85 }, // 사당패+호랑이가죽 = 구미호
    { id: "rcp_kr_05", result: "g_kr_e1", mat1: "g_kr_u1", mat2: "mat_k_01", cost: 20000, chance: 65 }, // 착호갑사+쑥마늘 = 불가사리
    { id: "rcp_kr_06", result: "g_kr_e2", mat1: "g_kr_r2", mat2: "mat_k_rare", cost: 30000, chance: 50 }, // 구미호+천부인 = 주작
    { id: "rcp_kr_07", result: "g_kr_l1", mat1: "g_kr_e1", mat2: "w_003", cost: 80000, chance: 35 }, // 불가사리+방망이 = 치우천왕
    { id: "rcp_kr_08", result: "g_kr_l2", mat1: "g_kr_e2", mat2: "mat_k_rare", cost: 100000, chance: 30 }, // 주작+천부인 = 단군
    { id: "rcp_kr_09", result: "g_kr_g1", mat1: "g_kr_l2", mat2: "mat_k_04", cost: 300000, chance: 10 }, // 단군+감투 = 환웅

    // ==========================================
    // 3. 북유럽 신화 (Norse Recipes)
    // ==========================================
    { id: "rcp_nr_01", result: "g_nr_u1", mat1: "g_nr_c1", mat2: "mat_n_03", cost: 1200, chance: 100 }, // 바이킹+흙 = 실드메이든
    { id: "rcp_nr_02", result: "g_nr_r1", mat1: "g_nr_u1", mat2: "mat_n_02", cost: 5000, chance: 90 }, // 실드메이든+깃털 = 발키리
    { id: "rcp_nr_03", result: "g_nr_e1", mat1: "g_nr_r1", mat2: "mat_n_04", cost: 25000, chance: 60 }, // 발키리+얼음 = 펜릴
    { id: "rcp_nr_04", result: "g_nr_l1", mat1: "g_nr_e1", mat2: "mat_n_01", cost: 90000, chance: 35 }, // 펜릴+룬문자 = 토르
    { id: "rcp_nr_05", result: "g_nr_l2", mat1: "g_nr_c1", mat2: "mat_n_05", cost: 85000, chance: 35 }, // 바이킹+세계수잎 = 로키
    { id: "rcp_nr_06", result: "g_nr_g1", mat1: "g_nr_l1", mat2: "mat_n_rare", cost: 350000, chance: 10 }, // 토르+안대 = 오딘

    // ==========================================
    // 4. 이집트 신화 (Egyptian Recipes)
    // ==========================================
    { id: "rcp_eg_01", result: "g_eg_u1", mat1: "g_eg_c1", mat2: "mat_e_03", cost: 800, chance: 95 }, // 노예+붕대 = 미라
    { id: "rcp_eg_02", result: "g_eg_r1", mat1: "g_eg_u1", mat2: "mat_e_04", cost: 4500, chance: 85 }, // 미라+모래 = 스핑크스
    { id: "rcp_eg_03", result: "g_eg_e1", mat1: "g_eg_r1", mat2: "mat_e_01", cost: 22000, chance: 60 }, // 스핑크스+파피루스 = 아누비스
    { id: "rcp_eg_04", result: "g_eg_l1", mat1: "g_eg_e1", mat2: "mat_e_02", cost: 80000, chance: 40 }, // 아누비스+풍뎅이 = 오시리스
    { id: "rcp_eg_05", result: "g_eg_g1", mat1: "g_eg_l1", mat2: "mat_e_rare", cost: 330000, chance: 15 }, // 오시리스+태양의서 = 라

    // ==========================================
    // 5. 크로스오버 & 히든 레시피 (Hidden)
    // ==========================================
    { id: "rcp_hid_01", result: "g_gr_e1", mat1: "g_kr_u1", mat2: "w_002", cost: 50000, chance: 50 }, // 착호갑사+창 = 헤라클레스 (동서양 전사 조합)
    { id: "rcp_hid_02", result: "g_nr_e1", mat1: "g_kr_r2", mat2: "mat_n_04", cost: 60000, chance: 40 }, // 구미호+얼음 = 펜릴 (짐승 조합)
    { id: "rcp_hid_03", result: "g_gr_g3", mat1: "g_kr_u2", mat2: "mat_g_05", cost: 400000, chance: 5 }, // 저승사자+독 = 하데스 (죽음의 신)
    { id: "rcp_hid_04", result: "w_god", mat1: "w_004", mat2: "mat_g_rare", cost: 1000000, chance: 100 }, // 엑스칼리버+번개 = 제우스의 번개 (무기 제작)
    { id: "rcp_hid_05", result: "a_god", mat1: "a_003", mat2: "mat_n_04", cost: 1000000, chance: 100 }  // 미스릴갑옷+얼음 = 아이기스 (방어구 제작)
];
