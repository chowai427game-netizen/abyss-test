// ==========================================================================
// 🔑 state.js：永久帳號存檔結構、PIN 碼身分驗證與雲端雙向同步引擎 (v2.0 完整修復版)
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";
const MAX_BAG_SIZE = 6;
const CURRENT_SAVE_VERSION = 2; // 存檔結構版本號

// 節流與防抖計時器
let saveDebounceTimer = null;
let isSavingToCloud = false;

/**
 * 建立預設帳號資料結構 (含版本號與防禦性預設值)
 */
function createDefaultAccountMeta(name, pin) {
    return {
        saveVersion: CURRENT_SAVE_VERSION,
        name: name || "無名勇者",
        pin: pin || "000000",
        lv: 1,
        exp: 0,
        nextExp: 30,
        gold: 0,
        maxFloor: 1,
        statPoints: 0,
        stats: { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 },
        job: "swordsman",
        skills: {},
        warehouse: {},
        equipment: { weapon: null, armor: null, accessory: null },
        equipmentStars: { weapon: 0, armor: 0, accessory: 0 },
        itemRefines: {},
        lastSavedAt: Date.now()
    };
}

let accountMeta = createDefaultAccountMeta("無名勇者", "000000");

// ⚔️ 全局單次冒險實時狀態數據
let currentRun = {
    job: "swordsman",
    lv: 1,
    exp: 0,
    nextExp: 30,
    hp: 100,
    maxHp: 100,
    hpRegen: 1,
    mp: 50,
    maxMp: 50,
    mpRegen: 15,
    atk: 15,
    matk: 15,
    def: 0,
    mdef: 0,
    hit: 80,
    flee: 10,
    spd: 20,
    critChance: 0,
    perfectDodge: 0,
    castReduction: 0,
    maxWeight: 100,
    block: 0,
    vampRate: 0,
    doubleStrike: 0,
    gold: 0,
    skills: {},
    inventory: [],
    qteBuffDuration: 0,
    qteBuffTurns: 0,
    tactic: "MANUAL"
};

let dungeonFloor = 0;
let playerShield = 0;
let activeMonster = null;
let playerStatusEffects = { burn: 0, poison: 0, freeze: 0 };
let activeVillageBuffs = { maxHpAdd: 0, maxMpAdd: 0, atkAdd: 0, expRate: 1.0 };
let gameState = "VILLAGE";
let currentEnvironment = "NORMAL";
let currentVillageLocation = "GATE";

/**
 * 通用非阻塞式 UI 訊息通知 helper (取代阻斷式 alert)
 */
function notifyUser(msg, type = "info") {
    if (typeof showToast === "function") {
        showToast(msg, type);
    } else {
        const legacyBox = document.getElementById('legacy-box');
        if (legacyBox) {
            legacyBox.innerHTML = `<span style="color: ${type === 'warn' ? '#ff4757' : '#ffd700'}">${msg}</span>`;
        } else {
            console.log(`[${type.toUpperCase()}] ${msg}`);
        }
    }
}

/**
 * 本地 PIN 碼混淆與解混淆 (防止明文洩漏)
 */
function encodePin(pin) {
    try { return btoa(`ABYSS_SALT_${pin}`); } catch(e) { return pin; }
}
function decodePin(encoded) {
    try { return atob(encoded).replace('ABYSS_SALT_', ''); } catch(e) { return encoded; }
}

/**
 * 即時檢查輸入玩家名字與本地存檔狀態
 */
function checkPlayerNameLive() {
    const legacyBox = document.getElementById('legacy-box');
    const nameEl = document.getElementById('player-name-input');
    if (!legacyBox || !nameEl) return;

    const targetName = nameEl.value ? nameEl.value.trim() : "";
    if (!targetName) {
        legacyBox.innerHTML = "請輸入名字與 6 位數字 PIN 碼以檢驗血脈...";
        return;
    }

    const localData = localStorage.getItem(`ABYSS_DESTINY_SAVE_${targetName}`);
    if (localData) {
        try {
            const parsed = JSON.parse(localData);
            legacyBox.innerHTML = `✨ 檢測到本地紀錄：<strong>${parsed.name || targetName}</strong> (Lv.${parsed.lv || 1})，請輸入 PIN 碼。`;
            return;
        } catch(e) {}
    }

    legacyBox.innerHTML = `✨ 準備創立全新血脈：[<strong>${targetName}</strong>]！請設定你的 6 位數 PIN 碼。`;
}

// 頁面初始化與雲端喚醒監控
window.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingFlavorText = document.getElementById('loading-flavor-text');
    const inputNameEl = document.getElementById('player-name-input');
    const inputPinEl = document.getElementById('player-pin-input');

    const lastActiveUser = localStorage.getItem("ABYSS_DESTINY_LAST_USER");
    if (lastActiveUser && inputNameEl) {
        inputNameEl.value = lastActiveUser;
        const encodedPin = localStorage.getItem(`ABYSS_DESTINY_PIN_${lastActiveUser}`);
        if (encodedPin && inputPinEl) {
            inputPinEl.value = decodePin(encodedPin);
        }
        checkPlayerNameLive();
    }

    if (inputNameEl) inputNameEl.addEventListener('input', checkPlayerNameLive);

    if (loadingFlavorText) loadingFlavorText.innerText = "正在撕裂虛空裂縫，呼喚 Render 伺服器...";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(SERVER_URL, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);

        if (res && res.ok) {
            if (loadingFlavorText) loadingFlavorText.innerText = "✨ Render 雲端伺服器同步成功！開啟深淵通道...";
        } else {
            throw new Error("Server response not ok");
        }
    } catch (err) {
        if (loadingFlavorText) loadingFlavorText.innerText = "⚡ 連線逾時，已進入單機本地存檔模式！";
    }

    if (loadingBarFill) loadingBarFill.classList.add('complete');

    setTimeout(() => {
        if (loadingOverlay) {
            loadingOverlay.classList.add('fade-out');
            setTimeout(() => { loadingOverlay.style.display = 'none'; }, 600);
        }
    }, 600);
});

/**
 * 初始化或載入玩家存檔 (雲端優先，本地 fallback)
 */
async function initOrLoadPlayer(inputName, inputPin) {
    const targetName = inputName ? inputName.trim() : "";
    const targetPin = inputPin ? inputPin.trim() : "";

    if (!targetName) {
        notifyUser("❌ 請輸入勇者大名！", "warn");
        return { success: false, isNewUser: false };
    }

    if (!targetPin || targetPin.length !== 6 || !/^\d+$/.test(targetPin)) {
        notifyUser("❌ 請輸入正確的 6 位數字 PIN 碼！", "warn");
        return { success: false, isNewUser: false };
    }

    let isNewUser = false;

    try {
        const res = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: targetName, pin: targetPin })
        });

        const data = await res.json();

        if (!data.success) {
            notifyUser(data.message || "❌ 登入失敗！PIN 碼可能錯誤。", "warn");
            return { success: false, isNewUser: false };
        }

        isNewUser = !!data.isNewUser;

        if (data.isNewUser) {
            accountMeta = createDefaultAccountMeta(targetName, targetPin);
        } else if (data.activeChar) {
            accountMeta = Object.assign(createDefaultAccountMeta(targetName, targetPin), data.activeChar);
            accountMeta.name = targetName;
            accountMeta.pin = targetPin;
        }

    } catch (err) {
        console.warn("網絡連線失敗，切換至離線存檔驗證。");
        const localData = localStorage.getItem(`ABYSS_DESTINY_SAVE_${targetName}`);
        const encodedPin = localStorage.getItem(`ABYSS_DESTINY_PIN_${targetName}`);
        const localPin = encodedPin ? decodePin(encodedPin) : null;

        if (localData && localPin && localPin !== targetPin) {
            notifyUser("🔐 本地 PIN 碼驗證失敗！", "warn");
            return { success: false, isNewUser: false };
        }

        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                accountMeta = Object.assign(createDefaultAccountMeta(targetName, targetPin), parsed);
            } catch(e) {
                accountMeta = createDefaultAccountMeta(targetName, targetPin);
                isNewUser = true;
            }
        } else {
            accountMeta = createDefaultAccountMeta(targetName, targetPin);
            isNewUser = true;
        }
    }

    // 補全結構與數據防護 (Migration Safety)
    if (!accountMeta.stats) accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    if (!accountMeta.equipment) accountMeta.equipment = { weapon: null, armor: null, accessory: null };
    if (!accountMeta.equipmentStars) accountMeta.equipmentStars = { weapon: 0, armor: 0, accessory: 0 };
    if (!accountMeta.warehouse) accountMeta.warehouse = {};
    if (!accountMeta.skills) accountMeta.skills = {};
    if (!accountMeta.itemRefines) accountMeta.itemRefines = {};

    // 數據同步至當前冒險狀態
    currentRun.skills = { ...accountMeta.skills };
    currentRun.job = accountMeta.job || "swordsman";
    if (accountMeta.gold !== undefined) currentRun.gold = accountMeta.gold;
    if (accountMeta.lv !== undefined) currentRun.lv = accountMeta.lv;
    if (accountMeta.exp !== undefined) currentRun.exp = accountMeta.exp;
    if (accountMeta.nextExp !== undefined) currentRun.nextExp = accountMeta.nextExp;

    localStorage.setItem("ABYSS_DESTINY_LAST_USER", targetName);
    localStorage.setItem(`ABYSS_DESTINY_PIN_${targetName}`, encodePin(targetPin));

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    await saveGameData(true); // 登入成功強制立刻存檔一次
    return { success: true, isNewUser: isNewUser };
}

/**
 * 儲存遊戲數據 (包含防抖 Debounce 節流與網路防重疊機制)
 * @param {boolean} immediate - 是否立即存檔不延遲
 */
async function saveGameData(immediate = false) {
    if (!accountMeta || !accountMeta.name) return;

    // 1. 即時將 currentRun 數據同步回 accountMeta
    if (typeof currentRun !== "undefined") {
        if (currentRun.gold !== undefined) accountMeta.gold = currentRun.gold;
        if (currentRun.lv !== undefined) accountMeta.lv = currentRun.lv;
        if (currentRun.exp !== undefined) accountMeta.exp = currentRun.exp;

        // 🔒 確保 nextExp 保持最高遞增值，防護不被重置
        const validNextExp = Math.max(30, accountMeta.nextExp || 30, currentRun.nextExp || 30);
        accountMeta.nextExp = validNextExp;
        currentRun.nextExp = validNextExp;

        if (currentRun.skills) accountMeta.skills = { ...currentRun.skills };
        if (currentRun.job) accountMeta.job = currentRun.job;
    }

    accountMeta.lastSavedAt = Date.now();
    const charKey = `ABYSS_DESTINY_SAVE_${accountMeta.name}`;

    // 2. 本地 LocalStorage 立即同步 (零延遲防閃退)
    try {
        localStorage.setItem(charKey, JSON.stringify(accountMeta));
        localStorage.setItem(`ABYSS_DESTINY_PIN_${accountMeta.name}`, encodePin(accountMeta.pin));
        localStorage.setItem("ABYSS_DESTINY_LAST_USER", accountMeta.name);
    } catch (e) {
        console.error("LocalStorage 寫入失敗:", e);
    }

    // 3. 雲端同步防抖 (Debounce Trigger)
    if (immediate) {
        executeCloudSave();
    } else {
        if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(() => {
            executeCloudSave();
        }, 1500); // 1.5 秒內若無新動作才發送雲端請求
    }
}

/**
 * 實際執行雲端 API 存檔請求
 */
async function executeCloudSave() {
    if (isSavingToCloud) return; // 避免併發連線衝突
    isSavingToCloud = true;

    try {
        const payload = {
            name: accountMeta.name,
            pin: accountMeta.pin,
            activeChar: accountMeta,
            timestamp: accountMeta.lastSavedAt
        };

        await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.warn("雲端同步異常，數據已安全暫存於本地快取。");
    } finally {
        isSavingToCloud = false;
    }
}

/**
 * 清空本地所有舊存檔快取
 */
function clearAllLegacySaves() {
    if (confirm("⚠️ 確定要清空本地所有快取資料嗎？")) {
        localStorage.clear();
        notifyUser("🧹 已清空所有本地舊快取存檔！頁面將重置。", "info");
        setTimeout(() => location.reload(), 1000);
    }
}
