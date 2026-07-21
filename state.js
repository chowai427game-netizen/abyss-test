// ==========================================================================
// 💾 state.js：永久帳號存檔結構、PIN碼身分驗證與雲端雙向同步引擎
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";
const MAX_BAG_SIZE = 6;

// 預設帳號資料範本 (含 pin 碼)
function createDefaultAccountMeta(name, pin) {
    return {
        name: name || "無名勇者",
        pin: pin || "000000",
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

let accountMeta = createDefaultAccountMeta("無名勇者", "000000");

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
let gameState = "VILLAGE";
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
// 🔍 動態檢測輸入框
// ==========================================================================
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
            legacyBox.innerHTML = `✨ 檢測到本地紀錄：<strong>${parsed.name}</strong> (Lv.${parsed.lv || 1})，請輸入 PIN 碼。`;
            return;
        } catch(e) {}
    }

    legacyBox.innerHTML = `✨ 準備創立全新血脈：[<strong>${targetName}</strong>]！請設定你的 6 位數 PIN 碼。`;
}

// ==========================================================================
// 🌌 頁面初始化
// ==========================================================================
window.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingFlavorText = document.getElementById('loading-flavor-text');
    const inputNameEl = document.getElementById('player-name-input');
    const inputPinEl = document.getElementById('player-pin-input');

    // 1. 自動填入上次登入的角色名與 PIN 碼
    const lastActiveUser = localStorage.getItem("ABYSS_DESTINY_LAST_USER");
    if (lastActiveUser && inputNameEl) {
        inputNameEl.value = lastActiveUser;
        const lastPin = localStorage.getItem(`ABYSS_DESTINY_PIN_${lastActiveUser}`);
        if (lastPin && inputPinEl) inputPinEl.value = lastPin;
        checkPlayerNameLive();
    }

    if (inputNameEl) inputNameEl.addEventListener('input', checkPlayerNameLive);

    // 2. 喚醒 Render 伺服器
    if (loadingFlavorText) loadingFlavorText.innerText = "正在撕裂虛空裂縫，呼喚 Render 冥河伺服器...";

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        await fetch(SERVER_URL, { method: 'GET', signal: controller.signal }).catch(() => {});
        clearTimeout(timeoutId);

        if (loadingFlavorText) loadingFlavorText.innerText = "✨ Render 雲端伺服器同步成功！開啟深淵通道...";
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

// ==========================================================================
// 🔑 角色登入與雲端驗證引擎
// ==========================================================================
async function initOrLoadPlayer(inputName, inputPin) {
    const targetName = inputName ? inputName.trim() : "";
    const targetPin = inputPin ? inputPin.trim() : "";

    if (!targetName) {
        alert("❌ 請輸入勇者大名！");
        return false;
    }

    if (!targetPin || targetPin.length !== 6 || !/^\d+$/.test(targetPin)) {
        alert("❌ 請輸入正確的 6 位數字 PIN 碼！");
        return false;
    }

    // A. 嘗試向雲端伺服器進行身分驗證
    try {
        const res = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: targetName, pin: targetPin })
        });

        const data = await res.json();

        if (!data.success) {
            alert(data.message || "❌ 登入失敗！");
            return false;
        }

        if (data.isNewUser) {
            accountMeta = createDefaultAccountMeta(targetName, targetPin);
        } else if (data.activeChar) {
            accountMeta = Object.assign({}, createDefaultAccountMeta(targetName, targetPin), data.activeChar);
            accountMeta.name = targetName;
            accountMeta.pin = targetPin;
        }

    } catch (err) {
        console.warn("無法連線雲端驗證，採用本地快取登入方案。");
        const localData = localStorage.getItem(`ABYSS_DESTINY_SAVE_${targetName}`);
        const localPin = localStorage.getItem(`ABYSS_DESTINY_PIN_${targetName}`);

        if (localData && localPin && localPin !== targetPin) {
            alert("🔐 本地 PIN 碼驗證失敗！");
            return false;
        }

        if (localData) {
            try {
                accountMeta = Object.assign({}, createDefaultAccountMeta(targetName, targetPin), JSON.parse(localData));
            } catch(e) {
                accountMeta = createDefaultAccountMeta(targetName, targetPin);
            }
        } else {
            accountMeta = createDefaultAccountMeta(targetName, targetPin);
        }
    }

    // B. 保存登入快取並寫入系統狀態
    localStorage.setItem("ABYSS_DESTINY_LAST_USER", targetName);
    localStorage.setItem(`ABYSS_DESTINY_PIN_${targetName}`, targetPin);

    resetCurrentRunData();
    saveGameData();
    return true;
}

// 🔗 相容性接口 (必須回傳 await Promise)
async function loadGameData(playerName, playerPin) {
    const pin = playerPin || (document.getElementById('player-pin-input')?.value) || accountMeta.pin;
    return await initOrLoadPlayer(playerName || accountMeta.name, pin);
}

// 供外部發動開始遊戲
async function handleStartGame() {
    const inputName = document.getElementById('player-name-input')?.value;
    const inputPin = document.getElementById('player-pin-input')?.value;

    const success = await initOrLoadPlayer(inputName, inputPin);
    if (!success) return;

    // 隱藏 Title，開啟主遊戲畫面與面板
    const titleBox = document.getElementById('title-box');
    const statusPanel = document.getElementById('status-panel-box');
    const actionPanel = document.getElementById('action-panel-box');
    const villagePanel = document.getElementById('village-panel-box');
    const logWrapper = document.getElementById('log-wrapper-box');

    if (titleBox) titleBox.style.display = 'none';
    if (statusPanel) statusPanel.style.display = 'block';
    if (actionPanel) actionPanel.style.display = 'flex';
    if (villagePanel) villagePanel.style.display = 'block';
    if (logWrapper) logWrapper.style.display = 'block';

    if (typeof updateUI === "function") updateUI();
    if (typeof addLog === "function") {
        addLog(`✨ 勇者 <strong>${accountMeta.name}</strong> 順利踏入深淵邊境！`, "perfect");
    }
}

// ==========================================
// 💾 自動雙向存檔引擎
// ==========================================
async function saveGameData() {
    if (!accountMeta || !accountMeta.name) return;

    const charKey = `ABYSS_DESTINY_SAVE_${accountMeta.name}`;

    try {
        localStorage.setItem(charKey, JSON.stringify(accountMeta));
        localStorage.setItem(`ABYSS_DESTINY_PIN_${accountMeta.name}`, accountMeta.pin);
        localStorage.setItem("ABYSS_DESTINY_LAST_USER", accountMeta.name);
    } catch (e) {
        console.error("LocalStorage 寫入失敗:", e);
    }

    try {
        const payload = {
            name: accountMeta.name,
            pin: accountMeta.pin,
            activeChar: accountMeta
        };

        await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.warn("網絡連線異常，已暫存於本地。");
    }
}

// ==========================================
// 🧹 清理快取
// ==========================================
function clearAllLegacySaves() {
    localStorage.clear();
    alert("🧹 已成功清空所有本地舊快取存檔！頁面將重置。");
    location.reload();
}
