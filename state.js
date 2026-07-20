// ==========================================================================
// 💾 state.js：永久帳號存檔結構、6大能力值換算與自動雙向存檔引擎
// ==========================================================================

// 後端 API 服務端點設定 (已更換為 Render 免費伺服器網址)
const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";

// 戰術背包上限設定
const MAX_BAG_SIZE = 6;

let accountMeta = { 
    name: "無名勇者", 
    lv: 1,
    exp: 0,
    nextExp: 30,
    statPoints: 0, // 未分配之屬性能力點數
    stats: { 
        ATK: 0, // 力量：影響基礎攻擊力 (+3/點)
        VIT: 0, // 體力：影響 MaxHP (+15/點) 與格擋值 (+0.5/點)
        INT: 0, // 智力：影響 MaxMP (+10/點) 與每回合回藍 (+1/點)
        DEX: 0, // 靈巧：影響速度 (+1/點) 與微量暴擊率 (+0.5%/點)
        AGI: 0, // 敏捷：大幅影響速度 (+2/點) 與閃避率 (+0.8%/點)
        LUK: 0  // 幸運：大幅影響暴擊率 (+1%/點) 與連擊率 (+0.5%/點)
    }, 
    unlockedJobs: ["novice"], 
    warehouse: {},
    equipment: { weapon: null, armor: null, accessory: null },
    equipmentStars: { weapon: 0, armor: 0, accessory: 0 }
};

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
    inventory: [], 
    qteBuffDuration: 0,
    qteBuffTurns: 0,
    activeVillageBuffs: []
};

let dungeonFloor = 0;
let playerShield = 0;
let activeMonster = null;
let playerStatusEffects = { burn: 0, poison: 0 };
let gameState = "VILLAGE"; // VILLAGE, BATTLE, REWARD, ENCOUNTER, ENCOUNTER_RESOLVED
let currentEnvironment = "NORMAL";
let currentVillageLocation = "GATE";

// ==========================================================================
// 🌌 Render 免費伺服器冷啟動喚醒與 Loading 遮罩控制引擎 (放在 state.js)
// ==========================================================================
window.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingFlavorText = document.getElementById('loading-flavor-text');

    // 1. 自動偵測 LocalStorage 歷史存檔，預填封面名字
    const savedData = localStorage.getItem("ABYSS_DESTINY_SAVE");
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            if (parsed.name) {
                const inputName = document.getElementById('player-name-input');
                if (inputName) inputName.value = parsed.name;
                const legacyBox = document.getElementById('legacy-box');
                if (legacyBox) legacyBox.innerHTML = `✨ 檢測到雲端血脈歷史紀錄：<strong>${parsed.name}</strong> (Lv.${parsed.lv || 1})`;
            }
        } catch(e){}
    }

    // 2. 真實喚醒 Render 免費伺服器 (連線 Ping)
    if (loadingFlavorText) {
        loadingFlavorText.innerText = "正在撕裂虛空裂縫，呼喚 Render 冥河伺服器...";
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 秒預設冷啟動上限

        // 發送簡單 Ping 請求喚醒 Render 伺服器
        await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'OPTIONS',
            signal: controller.signal
        }).catch(() => {});

        clearTimeout(timeoutId);
        if (loadingFlavorText) loadingFlavorText.innerText = "✨ Render 雲端伺服器同步成功！開啟深淵通道...";
    } catch (err) {
        console.warn("Render 冷啟動逾時或失敗，已切換至本地安全模式。");
        if (loadingFlavorText) loadingFlavorText.innerText = "⚡ 連線逾時，已進入單機本地存檔模式！";
    }

    // 3. 拉滿進度條並淡出遮罩
    if (loadingBarFill) loadingBarFill.classList.add('complete');

    setTimeout(() => {
        if (loadingOverlay) {
            loadingOverlay.classList.add('fade-out');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 600);
        }
    }, 600);
});

// ==========================================
// 戰鬥面板數值重構與匯入函數
// ==========================================
function resetCurrentRunData() {
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
    
    // 概率性數值閥值上限 (Cap)
    currentRun.critChance = Math.min(75, Math.floor((s.DEX * 0.5) + (s.LUK * 1.0))); 
    currentRun.dodgeChance = Math.min(50, Math.floor(s.AGI * 0.8)); 
    currentRun.vampRate = 0;       
    currentRun.doubleStrike = Math.min(50, Math.floor(s.LUK * 0.5));   

    if (!currentRun.skills || Object.keys(currentRun.skills).length === 0) {
        currentRun.skills = { "緊急治療": 1 };
    }
    
    currentRun.qteBuffDuration = 0; 
    currentRun.qteBuffTurns = 0;
    playerShield = 0;
    playerStatusEffects = { burn: 0, poison: 0 };

    // 計算裝備屬性加成
    applyEquipmentStats('weapon');
    applyEquipmentStats('armor');
    applyEquipmentStats('accessory');
}

function applyEquipmentStats(slot) {
    const equipName = accountMeta.equipment[slot];
    if (!equipName || typeof CRAFTING_BLUEPRINTS === "undefined") return;

    const blueprint = CRAFTING_BLUEPRINTS.find(x => x.name === equipName);
    if (!blueprint || !blueprint.stats) return;

    const starLevel = accountMeta.equipmentStars[slot] || 0;
    const multiplier = 1 + (starLevel * 0.15); 

    const st = blueprint.stats;
    if (st.atk) currentRun.atk += Math.floor(st.atk * multiplier);
    if (st.spd) currentRun.spd += Math.floor(st.spd * multiplier);
    if (st.mpRegen) currentRun.mpRegen += Math.floor(st.mpRegen * multiplier);
    if (st.block) currentRun.block += Math.floor(st.block * multiplier);
    if (st.maxHp) currentRun.maxHp += Math.floor(st.maxHp * multiplier); 
    if (st.critChance) currentRun.critChance = Math.min(75, currentRun.critChance + Math.floor(st.critChance * multiplier));
    if (st.dodgeChance) currentRun.dodgeChance = Math.min(50, currentRun.dodgeChance + Math.floor(st.dodgeChance * multiplier));
    if (st.vampRate) currentRun.vampRate += Math.floor(st.vampRate * multiplier);          
    if (st.doubleStrike) currentRun.doubleStrike = Math.min(50, currentRun.doubleStrike + Math.floor(st.doubleStrike * multiplier));  
}

// ==========================================
// 網絡與本地自動雙向存檔引擎
// ==========================================
async function saveGameData() {
    if (!accountMeta || !accountMeta.name) return;

    try {
        localStorage.setItem(`ABYSS_DESTINY_SAVE_${accountMeta.name}`, JSON.stringify(accountMeta));
        localStorage.setItem("ABYSS_DESTINY_SAVE", JSON.stringify(accountMeta));
    } catch (e) {
        console.error("LocalStorage 寫入失敗:", e);
    }

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

function loadGameData(playerName) {
    const targetName = playerName || accountMeta.name;
    const localData = localStorage.getItem(`ABYSS_DESTINY_SAVE_${targetName}`) || localStorage.getItem("ABYSS_DESTINY_SAVE");
    
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            accountMeta = Object.assign({}, accountMeta, parsed);
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
