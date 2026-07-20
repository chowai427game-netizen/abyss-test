// ==========================================
// 1. 全域存檔結構 (accountMeta) 擴充
// ==========================================
let accountMeta = { 
    name: "無名勇者", 
    lv: 1,
    exp: 0,
    nextExp: 30,
    statPoints: 0, // 未分配之屬性能力點數
    stats: { 
        ATK: 0, // 力量：影響基礎攻擊力
        VIT: 0, // 體力：影響 MaxHP 與格擋值
        INT: 0, // 智力：影響 MaxMP 與每回合回藍
        DEX: 0, // 靈巧：影響速度與微量暴擊率
        AGI: 0, // 敏捷：大幅影響速度與閃避率
        LUK: 0  // 幸運：大幅影響暴擊率與連擊率
    }, 
    unlockedJobs: ["novice"], 
    warehouse: {},
    equipment: { weapon: null, armor: null, accessory: null },
    equipmentStars: { weapon: 0, armor: 0, accessory: 0 }
};

// 戰術背包上限設定
const MAX_BAG_SIZE = 6;

// 後端 API 服務端點設定
const SERVER_URL = "http://localhost:3000"; // 依實際部署環境調整

// 當前單次冒險/戰鬥狀態
let currentRun = {
    job: "novice",
    lv: 1,
    exp: 0,
    nextExp: 30,
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    mpRegen: 15,
    atk: 15,
    spd: 20,
    block: 0,
    critChance: 0,
    dodgeChance: 0,
    vampRate: 0,
    doubleStrike: 0,
    gold: 0,
    skills: {},
    inventory: [], // 攜帶至迷宮的快捷道具欄 (上限 MAX_BAG_SIZE)
    qteBuffDuration: 0,
    qteBuffTurns: 0,
    activeVillageBuffs: []
};

let playerShield = 0;
let activeMonster = null;
let playerStatusEffects = { burn: 0, poison: 0 };
let gameState = "VILLAGE"; // VILLAGE, BATTLE, GAMEOVER
let currentEnvironment = "NORMAL";

// ==========================================
// 2. 戰鬥面板數值重構與匯入函數
// ==========================================
function resetCurrentRunData() {
    // 確保 accountMeta 結構完整
    if (!accountMeta.stats) {
        accountMeta.stats = { ATK: 0, VIT: 0, INT: 0, DEX: 0, AGI: 0, LUK: 0 };
    }
    
    let s = accountMeta.stats;
    
    // 同步永久等級與經驗
    currentRun.lv = accountMeta.lv || 1; 
    currentRun.exp = accountMeta.exp || 0; 
    currentRun.nextExp = accountMeta.nextExp || 30;

    // 依據 6 大屬性計算基礎戰鬥數值
    currentRun.maxHp = 100 + (s.VIT * 15); 
    currentRun.hp = Math.min(currentRun.hp || currentRun.maxHp, currentRun.maxHp); 
    
    currentRun.maxMp = 50 + (s.INT * 10); 
    currentRun.mp = Math.min(currentRun.mp || currentRun.maxMp, currentRun.maxMp); 
    
    currentRun.mpRegen = 15 + (s.INT * 1); 
    currentRun.atk = 15 + (s.ATK * 3); 
    currentRun.spd = 20 + (s.DEX * 1) + (s.AGI * 2); 
    currentRun.block = Math.floor(s.VIT * 0.5); 
    
    // 概率性數值附加閥值上限 (Cap)
    currentRun.critChance = Math.min(75, Math.floor((s.DEX * 0.5) + (s.LUK * 1.0))); 
    currentRun.dodgeChance = Math.min(50, Math.floor(s.AGI * 0.8)); 
    currentRun.vampRate = 0;       
    currentRun.doubleStrike = Math.min(50, Math.floor(s.LUK * 0.5));   

    // 重置技能與狀態
    if (!currentRun.skills || Object.keys(currentRun.skills).length === 0) {
        currentRun.skills = { "緊急治療": 1 };
    }
    
    currentRun.qteBuffDuration = 0; 
    currentRun.qteBuffTurns = 0;
    playerShield = 0;
    playerStatusEffects = { burn: 0, poison: 0 };

    // 計算裝備屬性加成 (根據星級強化比率疊加)
    applyEquipmentStats('weapon');
    applyEquipmentStats('armor');
    applyEquipmentStats('accessory');
}

// 裝備數值計算子函數
function applyEquipmentStats(slot) {
    const equipName = accountMeta.equipment[slot];
    if (!equipName || typeof CRAFTING_BLUEPRINTS === "undefined") return;

    const blueprint = CRAFTING_BLUEPRINTS.find(x => x.name === equipName);
    if (!blueprint || !blueprint.stats) return;

    const starLevel = accountMeta.equipmentStars[slot] || 0;
    const multiplier = 1 + (starLevel * 0.15); // 每顆星提升 15% 基礎裝備屬性

    const st = blueprint.stats;
    if (st.atk) currentRun.atk += Math.floor(st.atk * multiplier);
    if (st.spd) currentRun.spd += Math.floor(st.spd * multiplier);
    if (st.mpRegen) currentRun.mpRegen += Math.floor(st.mpRegen * multiplier);
    if (st.block) currentRun.block += Math.floor(st.block * multiplier);
    if (st.maxHp) { 
        currentRun.maxHp += Math.floor(st.maxHp * multiplier); 
    }
    if (st.critChance) currentRun.critChance = Math.min(75, currentRun.critChance + Math.floor(st.critChance * multiplier));
    if (st.dodgeChance) currentRun.dodgeChance = Math.min(50, currentRun.dodgeChance + Math.floor(st.dodgeChance * multiplier));
    if (st.vampRate) currentRun.vampRate += Math.floor(st.vampRate * multiplier);          
    if (st.doubleStrike) currentRun.doubleStrike = Math.min(50, currentRun.doubleStrike + Math.floor(st.doubleStrike * multiplier));  
}

// ==========================================
// 3. 網絡與本地自動雙向存檔引擎
// ==========================================
async function saveGameData() {
    if (!accountMeta || !accountMeta.name) return;

    // 1. 本地 LocalStorage 立即同步（防止斷網丟失）
    try {
        localStorage.setItem("ABYSS_DESTINY_SAVE", JSON.stringify(accountMeta));
    } catch (e) {
        console.error("LocalStorage 寫入失敗:", e);
    }

    // 2. 異步雲端備份（含 4 秒逾時熔斷機制）
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const payload = {
            name: accountMeta.name,
            activeChar: {
                lv: accountMeta.lv,
                exp: accountMeta.exp,
                nextExp: accountMeta.nextExp,
                statPoints: accountMeta.statPoints,
                stats: accountMeta.stats,
                unlockedJobs: accountMeta.unlockedJobs,
                warehouse: accountMeta.warehouse,
                equipment: accountMeta.equipment,
                equipmentStars: accountMeta.equipmentStars
            }
        };

        const response = await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`雲端存檔回應異常: HTTP ${response.status}`);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn("雲端存檔請求逾時，已轉為本地安全模式。");
        } else {
            console.warn("網絡連線中斷，存檔保留於本地。");
        }
    }
}

// 讀取存檔初始化
function loadGameData() {
    const localData = localStorage.getItem("ABYSS_DESTINY_SAVE");
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            accountMeta = Object.assign({}, accountMeta, parsed);
            // 補齊舊存檔可能缺失的屬性結構
            if (!accountMeta.stats) {
                accountMeta.stats = { ATK: 0, VIT: 0, INT: 0, DEX: 0, AGI: 0, LUK: 0 };
            }
            if (accountMeta.statPoints === undefined) accountMeta.statPoints = 0;
        } catch (e) {
            console.error("存檔解析錯誤，恢復預設值", e);
        }
    }
    resetCurrentRunData();
}
