// ==========================================================================
// 🔑 state.js：永久帳號存檔結構、PIN 碼身分驗證與雲端雙向同步引擎
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";
const MAX_BAG_SIZE = 6;

// 預設帳號資料範本
function createDefaultAccountMeta(name, pin) {
    return {
        name: name || "無名勇者",
        pin: pin || "000000",
        lv: 1,
        exp: 0,
        nextExp: 30,
        statPoints: 0,
        stats: { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 },
        job: "swordsman",
        warehouse: {},
        equipment: { weapon: null, armor: null, accessory: null },
        equipmentStars: { weapon: 0, armor: 0, accessory: 0 }
    };
}

let accountMeta = createDefaultAccountMeta("無名勇者", "000000");

// 全局冒險實時資料
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
    activeVillageBuffs: []
};

let dungeonFloor = 0;
let playerShield = 0;
let activeMonster = null;
let playerStatusEffects = { burn: 0, poison: 0 };
let gameState = "VILLAGE";
let currentEnvironment = "NORMAL";
let currentVillageLocation = "GATE";

// 🔍 輸入框實時檢測
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

// 🌌 初始化動畫與喚醒 Server
window.addEventListener('DOMContentLoaded', async () => {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingBarFill = document.getElementById('loading-bar-fill');
    const loadingFlavorText = document.getElementById('loading-flavor-text');
    const inputNameEl = document.getElementById('player-name-input');
    const inputPinEl = document.getElementById('player-pin-input');

    const lastActiveUser = localStorage.getItem("ABYSS_DESTINY_LAST_USER");
    if (lastActiveUser && inputNameEl) {
        inputNameEl.value = lastActiveUser;
        const lastPin = localStorage.getItem(`ABYSS_DESTINY_PIN_${lastActiveUser}`);
        if (lastPin && inputPinEl) inputPinEl.value = lastPin;
        checkPlayerNameLive();
    }

    if (inputNameEl) inputNameEl.addEventListener('input', checkPlayerNameLive);

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

// 🔑 帳號登入與驗證
async function initOrLoadPlayer(inputName, inputPin) {
    const targetName = inputName ? inputName.trim() : "";
    const targetPin = inputPin ? inputPin.trim() : "";

    if (!targetName) {
        alert("❌ 請輸入勇者大名！");
        return { success: false, isNewUser: false };
    }

    if (!targetPin || targetPin.length !== 6 || !/^\d+$/.test(targetPin)) {
        alert("❌ 請輸入正確的 6 位數字 PIN 碼！");
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
            alert(data.message || "❌ 登入失敗！");
            return { success: false, isNewUser: false };
        }

        isNewUser = !!data.isNewUser;

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
            return { success: false, isNewUser: false };
        }

        if (localData) {
            try {
                accountMeta = Object.assign({}, createDefaultAccountMeta(targetName, targetPin), JSON.parse(localData));
            } catch(e) {
                accountMeta = createDefaultAccountMeta(targetName, targetPin);
                isNewUser = true;
            }
        } else {
            accountMeta = createDefaultAccountMeta(targetName, targetPin);
            isNewUser = true;
        }
    }

    localStorage.setItem("ABYSS_DESTINY_LAST_USER", targetName);
    localStorage.setItem(`ABYSS_DESTINY_PIN_${targetName}`, targetPin);

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    saveGameData();
    return { success: true, isNewUser: isNewUser };
}

// 💾 雲端與本地存檔
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

// 🧹 清理快取
function clearAllLegacySaves() {
    localStorage.clear();
    alert("🧹 已成功清空所有本地舊快取存檔！頁面將重置。");
    location.reload();
}
