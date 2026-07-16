// 5.state.js

// ==========================================================================
// 📡 命運深淵：運行時全域狀態機與遠端雲端鏈接
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";

let accountMeta = { name: "無名勇者", unlockedJobs: ["novice"], warehouse: {} };

let currentRun = {
    job: "novice",
    lv: 1, hp: 100, maxHp: 100, mp: 20, maxMp: 50, mpRegen: 15, atk: 15, gold: 0, exp: 0, nextExp: 30,
    spd: 20, //👈 新增基礎速度
    block: 0, critChance: 0, dodgeChance: 0, vampRate: 0, regenPower: 0, doubleStrike: 0,
    skills: { "緊急治療": 1 }, 
    inventory: [],            
    qteBuffDuration: 0,       
    qteBuffTurns: 0,
    activeVillageBuffs: []    
};

let gameState = "TITLE"; 
let dungeonFloor = 0;
let isQteActive = false;
let qteTimer = null;
let qteResolvePointer = null;

let activeMonster = null; 
let playerShield = 0;
let isAutoBattleMode = false; // 👈 統一保留喺呢度，作為全域開關

let currentEnvironment = "NORMAL"; 
let playerStatusEffects = { burn: 0, poison: 0 }; 
let currentVillageLocation = "GATE";

function resetCurrentRunData() {
    currentRun.lv = 1; currentRun.hp = 100; currentRun.maxHp = 100; currentRun.mp = 20; currentRun.maxMp = 50;
    currentRun.mpRegen = 15; currentRun.atk = 15; currentRun.spd = 20; currentRun.gold = 0; currentRun.exp = 0; currentRun.nextExp = 30;
    currentRun.block = 0; currentRun.critChance = 0; currentRun.dodgeChance = 0; currentRun.skills = { "緊急治療": 1 };
    currentRun.inventory = []; currentRun.qteBuffDuration = 0; currentRun.qteBuffTurns = 0;
    currentRun.activeVillageBuffs = [];
    playerShield = 0;
    activeMonster = null;
    playerStatusEffects = { burn: 0, poison: 0 };
}

async function checkCloudAccount() {
    let inputName = document.getElementById('player-name-input').value.trim();
    let legBox = document.getElementById('legacy-box');
    if (!inputName) return;
    try {
        let response = await fetch(`${SERVER_URL}/api/load/${encodeURIComponent(inputName)}`);
        let res = await response.json();
        if (res.success && res.activeChar) {
            accountMeta.unlockedJobs = res.activeChar.unlockedJobs || ["novice"];
            accountMeta.warehouse = res.activeChar.warehouse || {};
            legBox.innerHTML = `🟢 <strong>偵測到雲端血脈！</strong> 已成功解鎖職業：${accountMeta.unlockedJobs.join(", ")}`;
        } else {
            legBox.innerHTML = `🍂 <strong>新帳戶初始：</strong> 你是該名字第一代血脈始祖。`;
        }
    } catch(e) { legBox.innerHTML = `📡 正在同步雲端資料庫...`; }
}

async function uploadProgressToCloud() {
    try {
        await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: accountMeta.name, activeChar: { unlockedJobs: accountMeta.unlockedJobs, warehouse: accountMeta.warehouse } })
        });
    } catch (e) { console.error("雲端存檔同步逾時"); }
}

// ==========================================================================
// 📡 命運深淵：魔導冷啟動喚醒引擎 (移至 state.js 集中管理後端通訊)
// ==========================================================================

const LOADING_FLAVOR_TEXTS = [
    "正在通訊虛空裂縫，喚醒沉睡中的 Render 冥河伺服器...",
    "正在解鎖遠古魔導傳承，正在重構勇者基因...",
    "正在掃描雲端永久倉庫（正在數埋有幾多條半獸人後腿肉）...",
    "黑市商人正在整理披風，鐵匠正在點燃加工所熔爐...",
    "正在清除地下城 B1F 至 B40F 的殘留重力變異力場...",
    "命運編織中……魔物們正在穿戴裝備與黏液準備攔截..."
];

window.onload = function() {
    executeMagitechWakeupSequence();
};

async function executeMagitechWakeupSequence() {
    const txtNode = document.getElementById('loading-flavor-text');
    const barFill = document.getElementById('loading-bar-fill');
    const overlay = document.getElementById('loading-overlay');
    
    let textIndex = 0;
    const textTimer = setInterval(() => {
        if (txtNode) {
            textIndex = (textIndex + 1) % LOADING_FLAVOR_TEXTS.length;
            txtNode.innerText = LOADING_FLAVOR_TEXTS[textIndex];
        }
    }, 3500);

    try {
        let wakeName = "gma";
        await fetch(`${SERVER_URL}/api/load/${encodeURIComponent(wakeName)}`);
        
        if (barFill) barFill.classList.add('complete');
        if (txtNode) txtNode.innerHTML = "✨ <b>血脈矩陣對接成功！冥河通道已解鎖！</b>";
        
        setTimeout(() => {
            clearInterval(textTimer);
            if (overlay) overlay.classList.add('fade-out');
            checkCloudAccount(); // 這裡完美呼叫同檔案內的雲端檢查函數
            addLog("📡 <b>【命運網路】已成功對接 Render 雲端魔導核心。</b>", "perfect");
        }, 4000); 

    } catch (err) {
        console.warn("後端喚醒逾時，轉為局內本地離線沙盒模式行進");
        clearInterval(textTimer);
        if (barFill) barFill.style.width = "100%";
        if (overlay) overlay.classList.add('fade-out');
        const legBox = document.getElementById('legacy-box');
        if(legBox) legBox.innerHTML = "⚠️ <b>雲端同步受阻</b>：已啟動臨時局內離線記憶體。";
    }
}
// ==========================================================================
// 💾 命運深淵：雙軌制核心存檔引擎 (LocalStorage + Render Cloud)
// ==========================================================================

/**
 * 🔥 觸發存檔：本地秒存 + 雲端異步備份
 */
async function saveGameData() {
    // 安全防護：如果連名字都未輸入，就不執行存檔
    if (!accountMeta || !accountMeta.name) return;

    // 1. 🚀【本地首發】立刻寫入瀏覽器快取，保證網頁關閉/刷新都不會掉進度
    const saveDataString = JSON.stringify(accountMeta);
    localStorage.setItem("ABYSS_DESTINY_SAVE", saveDataString);
    console.log("💾 本地快取存檔成功！");

    // 2. 📡【雲端同步】在背景默默發送給 Render 伺服器，不卡死玩家畫面
    try {
        // 設定 5 秒超時控制，防止 Render 沒睡醒導致請求無限掛起
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${SERVER_URL}/api/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: accountMeta.name,
                data: accountMeta
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const res = await response.json();
        
        if (res.success) {
            console.log("☁️ Render 雲端血脈同步成功！");
        }
    } catch (error) {
        // 就算 Render 正在冷啟動超時，主控台報個警告就好，完全不影響玩家在前端繼續爆肝整裝
        console.warn("📡 雲端冥河伺服器暫時失聯，已依賴本地血脈保護進度。", error);
    }
}

/**
 * 📖 觸發讀檔：登入時優先讀本地，再用雲端覆蓋最新進度
 */
async function loadGameData(inputName) {
    if (!inputName) return;

    // 1. 🚀【秒進遊戲】先翻本地箱子，如果有名稱吻合的存檔，立刻載入讓玩家開玩
    const localSave = localStorage.getItem("ABYSS_DESTINY_SAVE");
    if (localSave) {
        const parsedData = JSON.parse(localSave);
        if (parsedData.name === inputName) {
            accountMeta = parsedData;
            console.log("📦 成功提取本地靈魂結晶進度！");
            if (typeof resetCurrentRunData === "function") resetCurrentRunData();
            if (typeof updateUI === "function") updateUI();
        }
    }

    // 2. 📡【雲端認證】去 Render 抓最新進度（防止玩家換電腦/換手機玩）
    try {
        console.log("📡 正在向 Render 冥河伺服器請求遠古血脈...");
        const response = await fetch(`${SERVER_URL}/api/load/${encodeURIComponent(inputName)}`);
        const res = await response.json();
        
        if (res.success && res.activeChar) {
            // 以雲端最新存檔為準，覆蓋並同步更新本地快取
            accountMeta = res.activeChar;
            localStorage.setItem("ABYSS_DESTINY_SAVE", JSON.stringify(accountMeta));
            
            if (typeof resetCurrentRunData === "function") resetCurrentRunData();
            if (typeof updateUI === "function") updateUI();
            
            // 在戰鬥日誌彈出提示
            if (typeof addLog === "function") {
                addLog("✨ <b>【永久血脈】</b>已成功從 Render 雲端矩陣同步最新進度！");
            }
        }
    } catch (error) {
        console.error("❌ 雲端讀取失敗:", error);
        if (typeof addLog === "function") {
            addLog("📡 <b>【通訊提示】</b>未能連接雲端。依舊啟用本地結晶進度，冒險不受影響！");
        }
    }
}

