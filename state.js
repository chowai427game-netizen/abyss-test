// ==========================================================================
// 💾 state.js：永久帳號存檔結構、6大能力值換算、雲端雙向同步與冷啟動引擎
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";
const MAX_BAG_SIZE = 6;

// 預設帳號資料範本 (用於建立新角色)
function createDefaultAccountMeta(name) {
    return {
        name: name || "無名勇者",
        lv: 1,
        exp: 0,
        nextExp: 30,
        statPoints: 0,
        stats: { ATK: 0, VIT: 0, INT: 0, DEX: 0, AGI: 0, LUK: 0 },
        unlockedJobs: ["novice"],
        warehouse: {},
        equipment: { weapon: null, armor: null, accessory: null },
        equipmentStars: { weapon: 0, armor: 0, accessory: 0 }
    };
}

let accountMeta = createDefaultAccountMeta("無名勇者");

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

// ==========================================
// 🧮 戰鬥面板數值重構與匯入函數
// ==========================================
function resetCurrentRunData() {
    if (!accountMeta.stats) {
        accountMeta.stats = { ATK: 0, VIT: 0, INT: 0, DEX: 0, AGI: 0, LUK: 0 };
    }
    
    let s = accountMeta.stats;
    
    currentRun.lv = accountMeta.lv || 1; 
    currentRun.exp = accountMeta.exp || 0; 
    currentRun.nextExp = accountMeta.nextExp || 30;

    currentRun.maxHp = 100 + (s.VIT * 15); 
    currentRun.hp = Math.min(currentRun.hp || currentRun.maxHp, currentRun.maxHp); 
    
    currentRun.maxMp = 50 + (s.INT * 10); 
    currentRun.mp = Math.min(currentRun.mp || currentRun.maxMp, currentRun.maxMp); 
    
    currentRun.mpRegen = 15 + (s.INT * 1); 
    currentRun.atk = 15 + (s.ATK * 3); 
    currentRun.spd = 20 + (s.DEX * 1) + (s.AGI * 2); 
    currentRun.block = Math.floor(s.VIT * 0.5); 
    
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

    applyEquipmentStats('weapon');
    applyEquipmentStats('armor');
    applyEquipmentStats('accessory');
}

function applyEquipmentStats(slot) {
    const equipName = accountMeta.equipment ? accountMeta.equipment[slot] : null;
    if (!equipName || typeof CRAFTING_BLUEPRINTS === "undefined") return;

    const blueprint = CRAFTING_BLUEPRINTS.find(x => x.name === equipName);
    if (!blueprint || !blueprint.stats) return;

    const starLevel = (accountMeta.equipmentStars && accountMeta.equipmentStars[slot]) || 0;
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

// ==========================================================================
// 🌌 頁面初始化：預載上次角色與喚醒 Render 免費伺服器
// ==========================================================================
window.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingFlavorText = document.getElementById('loading-flavor-text');

    // 1. 自動偵測 LocalStorage 歷史存檔，進行封面預填
    const lastActiveUser = localStorage.getItem("ABYSS_DESTINY_LAST_USER");
    if (lastActiveUser) {
        const inputName = document.getElementById('player-name-input');
        if (inputName) inputName.value = lastActiveUser;
        
        const legacyBox = document.getElementById('legacy-box');
        if (legacyBox) {
            const lastSaveData = localStorage.getItem(`ABYSS_DESTINY_SAVE_${lastActiveUser}`);
            if (lastSaveData) {
                try {
                    const parsed = JSON.parse(lastSaveData);
                    legacyBox.innerHTML = `✨ 檢測到雲端血脈歷史紀錄：<strong>${parsed.name}</strong> (Lv.${parsed.lv || 1})`;
                } catch(e) {}
            }
        }
    }

    // 2. 喚醒 Render 伺服器 (GET /)
    if (loadingFlavorText) {
        loadingFlavorText.innerText = "正在撕裂虛空裂縫，呼喚 Render 冥河伺服器...";
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        await fetch(SERVER_URL, {
            method: 'GET',
            signal: controller.signal
        }).catch(() => {});

        clearTimeout(timeoutId);
        if (loadingFlavorText) loadingFlavorText.innerText = "✨ Render 雲端伺服器同步成功！開啟深淵通道...";
    } catch (err) {
        console.warn("Render 冷啟動逾時，切換至單機本地模式。");
        if (loadingFlavorText) loadingFlavorText.innerText = "⚡ 連線逾時，已進入單機本地存檔模式！";
    }

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

// ==========================================================================
// 🔑 角色初始化與雙向讀檔引擎 (本地優先 + 雲端同步)
// ==========================================================================
function initOrLoadPlayer(inputName) {
    const targetName = inputName ? inputName.trim() : "無名勇者";
    if (!targetName) return;

    // A. 優先嘗試載入本地存檔 (秒開遊戲)
    const specificData = localStorage.getItem(`ABYSS_DESTINY_SAVE_${targetName}`);
    if (specificData) {
        try {
            const parsed = JSON.parse(specificData);
            accountMeta = Object.assign({}, createDefaultAccountMeta(targetName), parsed);
            accountMeta.name = targetName;
        } catch (e) {
            accountMeta = createDefaultAccountMeta(targetName);
        }
    } else {
        accountMeta = createDefaultAccountMeta(targetName);
    }

    localStorage.setItem("ABYSS_DESTINY_LAST_USER", targetName);
    resetCurrentRunData();

    // B. 背景非同步向 MongoDB 請求最新雲端存檔
    fetchCloudSave(targetName);
}

// 供 game.js 呼叫的相容接口
function loadGameData(playerName) {
    initOrLoadPlayer(playerName || accountMeta.name);
}

// 向後端 MongoDB 抓取雲端存檔
async function fetchCloudSave(playerName) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${SERVER_URL}/api/load/${encodeURIComponent(playerName)}`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.activeChar) {
                // 將雲端最新的存檔覆蓋進 accountMeta
                accountMeta = Object.assign({}, createDefaultAccountMeta(playerName), data.activeChar);
                accountMeta.name = playerName;

                // 寫回 LocalStorage 做快取
                localStorage.setItem(`ABYSS_DESTINY_SAVE_${playerName}`, JSON.stringify(accountMeta));

                resetCurrentRunData();
                if (typeof updateUI === "function") updateUI();
                if (typeof addLog === "function") {
                    addLog(`☁️【雲端同步】已成功從 MongoDB 載入勇者 <strong>${playerName}</strong> 的最新進度！`, "perfect");
                }
            }
        }
    } catch (err) {
        console.warn("無法連線至雲端資料庫，將繼續使用本地快取存檔。");
    }
}

// ==========================================
// 💾 自動雙向存檔引擎 (同步至 LocalStorage 及 MongoDB)
// ==========================================
async function saveGameData() {
    if (!accountMeta || !accountMeta.name) return;

    const charKey = `ABYSS_DESTINY_SAVE_${accountMeta.name}`;

    // 1. 先寫入本地 LocalStorage 確保安全
    try {
        localStorage.setItem(charKey, JSON.stringify(accountMeta));
        localStorage.setItem("ABYSS_DESTINY_LAST_USER", accountMeta.name);
    } catch (e) {
        console.error("LocalStorage 寫入失敗:", e);
    }

    // 2. 傳送至 Render + MongoDB 雲端資料庫
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const payload = {
            name: accountMeta.name,
            activeChar: accountMeta // 直接上傳完整的 accountMeta 結構
        };

        const response = await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
    } catch (error) {
        console.warn("網絡連線異常，雲端存檔未完成（已安全儲存於本地）。");
    }
}
