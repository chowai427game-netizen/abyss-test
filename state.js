// ==========================================================================
// 🔑 state.js：永久帳號存檔結構、PIN 碼身分驗證與雲端雙向同步引擎
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";
const MAX_BAG_SIZE = 6;

function createDefaultAccountMeta(name, pin) {
    return {
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
        equipmentStars: { weapon: 0, armor: 0, accessory: 0 }
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
            accountMeta = Object.assign(createDefaultAccountMeta(targetName, targetPin), data.activeChar);
            accountMeta.name = targetName;
            accountMeta.pin = targetPin;
            if (!accountMeta.stats) accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
            if (!accountMeta.equipment) accountMeta.equipment = { weapon: null, armor: null, accessory: null };
            if (!accountMeta.equipmentStars) accountMeta.equipmentStars = { weapon: 0, armor: 0, accessory: 0 };
            if (!accountMeta.warehouse) accountMeta.warehouse = {};
            if (!accountMeta.skills) accountMeta.skills = {};
        }

    } catch (err) {
        console.warn("網絡連線失敗，切換至離線存檔驗證。");
        const localData = localStorage.getItem(`ABYSS_DESTINY_SAVE_${targetName}`);
        const localPin = localStorage.getItem(`ABYSS_DESTINY_PIN_${targetName}`);

        if (localData && localPin && localPin !== targetPin) {
            alert("🔐 本地 PIN 碼驗證失敗！");
            return { success: false, isNewUser: false };
        }

        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                accountMeta = Object.assign(createDefaultAccountMeta(targetName, targetPin), parsed);
                if (!accountMeta.stats) accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
                if (!accountMeta.equipment) accountMeta.equipment = { weapon: null, armor: null, accessory: null };
                if (!accountMeta.equipmentStars) accountMeta.equipmentStars = { weapon: 0, armor: 0, accessory: 0 };
                if (!accountMeta.warehouse) accountMeta.warehouse = {};
                if (!accountMeta.skills) accountMeta.skills = {};
            } catch(e) {
                accountMeta = createDefaultAccountMeta(targetName, targetPin);
                isNewUser = true;
            }
        } else {
            accountMeta = createDefaultAccountMeta(targetName, targetPin);
            isNewUser = true;
        }
    }

    // 數據同步至當前冒險狀態
    if (accountMeta.skills) currentRun.skills = { ...accountMeta.skills };
    if (accountMeta.job) currentRun.job = accountMeta.job;
    if (accountMeta.gold !== undefined) currentRun.gold = accountMeta.gold;
    if (accountMeta.lv !== undefined) currentRun.lv = accountMeta.lv;
    if (accountMeta.exp !== undefined) currentRun.exp = accountMeta.exp;
    if (accountMeta.nextExp !== undefined) currentRun.nextExp = accountMeta.nextExp;
    
    localStorage.setItem("ABYSS_DESTINY_LAST_USER", targetName);
    localStorage.setItem(`ABYSS_DESTINY_PIN_${targetName}`, targetPin);

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    await saveGameData();
    return { success: true, isNewUser: isNewUser };
}

// 修正：增加 async 宣告，避免內部 await 拋出 SyntaxError
async function saveGameData() {
    if (!accountMeta || !accountMeta.name) return;

    if (typeof currentRun !== "undefined") {
        if (currentRun.gold !== undefined) accountMeta.gold = currentRun.gold;
        if (currentRun.lv !== undefined) accountMeta.lv = currentRun.lv;
        if (currentRun.exp !== undefined) accountMeta.exp = currentRun.exp;
        if (currentRun.nextExp !== undefined) accountMeta.nextExp = currentRun.nextExp;
        if (currentRun.skills) accountMeta.skills = { ...currentRun.skills };
        if (currentRun.job) accountMeta.job = currentRun.job;
    }

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
        console.warn("雲端同步異常，數據暫存於本地快取。");
    }
}

function clearAllLegacySaves() {
    if (confirm("⚠️ 確定要清空本地所有快取資料嗎？")) {
        localStorage.clear();
        alert("🧹 已清空所有本地舊快取存檔！頁面將重置。");
        location.reload();
    }
}
