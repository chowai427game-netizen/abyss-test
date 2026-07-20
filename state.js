// ==========================================================================
// 💾 state.js：修復名字覆蓋問題與多角色存檔分離引擎
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
let gameState = "VILLAGE";
let currentEnvironment = "NORMAL";
let currentVillageLocation = "GATE";

// ==========================================================================
// 🌌 頁面初始化：預載最後一次使用的角色名稱與喚醒服務器
// ==========================================================================
window.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingFlavorText = document.getElementById('loading-flavor-text');

    // 1. 自動偵測 LocalStorage 歷史存檔，僅提供預填參考
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

    // 2. 真實喚醒 Render 免費伺服器 (Ping)
    if (loadingFlavorText) {
        loadingFlavorText.innerText = "正在撕裂虛空裂縫，呼喚 Render 冥河伺服器...";
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

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
// 🔑 正確的角色初始化與讀檔引擎（修復名字被覆蓋的問題）
// ==========================================================================
function initOrLoadPlayer(inputName) {
    const targetName = inputName ? inputName.trim() : "無名勇者";
    if (!targetName) return;

    // 嘗試讀取該玩家專屬名稱的 LocalStorage 存檔
    const specificData = localStorage.getItem(`ABYSS_DESTINY_SAVE_${targetName}`);

    if (specificData) {
        // 【情況 A】：存在該名字的專屬舊存檔 -> 載入舊進度
        try {
            const parsed = JSON.parse(specificData);
            accountMeta = Object.assign({}, createDefaultAccountMeta(targetName), parsed);
            // 強制確保名稱為使用者當前輸入的名稱
            accountMeta.name = targetName;
        } catch (e) {
            console.error("存檔解析失敗，重新創建角色", e);
            accountMeta = createDefaultAccountMeta(targetName);
        }
    } else {
        // 【情況 B】：全新名字 -> 建立全新的角色檔案（不再抓取舊的 gma 存檔）
        accountMeta = createDefaultAccountMeta(targetName);
    }

    // 記錄最後一次登入的角色名字
    localStorage.setItem("ABYSS_DESTINY_LAST_USER", targetName);

    // 重置戰鬥狀態並進行即時雙向存檔
    resetCurrentRunData();
    saveGameData();
}

// 供舊版相容呼叫的 loadGameData
function loadGameData(playerName) {
    initOrLoadPlayer(playerName || accountMeta.name);
}

// ==========================================
// 💾 自動雙向存檔引擎 (獨立 Key 值隔離)
// ==========================================
async function saveGameData() {
    if (!accountMeta || !accountMeta.name) return;

    const charKey = `ABYSS_DESTINY_SAVE_${accountMeta.name}`;

    try {
        // 1. 本地儲存：以角色名字作為獨一無二的 Key
        localStorage.setItem(charKey, JSON.stringify(accountMeta));
        // 2. 紀錄最後使用的角色名稱
        localStorage.setItem("ABYSS_DESTINY_LAST_USER", accountMeta.name);
    } catch (e) {
        console.error("LocalStorage 寫入失敗:", e);
    }

    // 3. 異步同步至 Render 後端伺服器
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

// ==========================================
// 🧹 強制清空全域舊存檔 (解決工具函數)
// ==========================================
function clearAllLegacySaves() {
    localStorage.removeItem("ABYSS_DESTINY_SAVE");
    localStorage.removeItem("ABYSS_DESTINY_LAST_USER");
    
    // 尋找並清除所有包含 ABYSS_DESTINY_SAVE 的項目
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith("ABYSS_DESTINY_SAVE")) {
            localStorage.removeItem(key);
        }
    });

    alert("🧹 已成功清空所有本地舊存檔！現在可以重新創建任意名字的角色了。");
    location.reload();
}
