// ==========================================================================
// 📡 state.js：運行時全域狀態機與遠端雲端鏈接 (部位精煉星級適應版)
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";

// 1. 擴充 accountMeta，讓等級、經驗與 6 大屬性可以永久保存
let accountMeta = { 
    name: "無名勇者", 
    lv: 1,
    exp: 0,
    nextExp: 30,
    statPoints: 0, // 未分配屬性點
    stats: { ATK: 0, VIT: 0, INT: 0, DEX: 0, AGI: 0, LUK: 0 }, // 6大能力值
    unlockedJobs: ["novice"], 
    warehouse: {},
    equipment: { weapon: null, armor: null, accessory: null },
    equipmentStars: { weapon: 0, armor: 0, accessory: 0 }
};

// 2. 背包最大容量調整（預設改為 6 格）
const MAX_BAG_SIZE = 6;

function resetCurrentRunData() {
    let s = accountMeta.stats || { ATK: 0, VIT: 0, INT: 0, DEX: 0, AGI: 0, LUK: 0 };
    
    // 💡 等級與經驗值直接繼承 accountMeta，死亡不會重置為 Lv.1！
    currentRun.lv = accountMeta.lv || 1; 
    currentRun.exp = accountMeta.exp || 0; 
    currentRun.nextExp = accountMeta.nextExp || 30;

    // 🧮 6 大能力值換算戰鬥數值公式：
    // ATK (攻擊力) : 基礎 15 + (ATK點數 * 3)
    // VIT (體力)   : 基礎 MaxHP 100 + (VIT點數 * 15)，減傷 Block + (VIT點數 * 0.5)
    // INT (智力)   : 基礎 MaxMP 50 + (INT點數 * 10)，回藍 mpRegen + (INT點數 * 1)
    // DEX (靈巧)   : 基礎速度 20 + (DEX點數 * 1)，暴擊率 + (DEX點數 * 0.5%)
    // AGI (敏捷)   : 基礎速度 20 + (AGI點數 * 2)，閃避率 + (AGI點數 * 0.8%)
    // LUK (幸運)   : 暴擊率 + (LUK點數 * 1%)，連擊率 + (LUK點數 * 0.5%)

    currentRun.maxHp = 100 + (s.VIT * 15); 
    currentRun.hp = currentRun.maxHp; 
    currentRun.maxMp = 50 + (s.INT * 10); 
    currentRun.mp = currentRun.maxMp; 
    currentRun.mpRegen = 15 + (s.INT * 1); 
    currentRun.atk = 15 + (s.ATK * 3); 
    currentRun.spd = 20 + (s.DEX * 1) + (s.AGI * 2); 
    currentRun.block = Math.floor(s.VIT * 0.5); 
    currentRun.critChance = Math.min(75, Math.floor((s.DEX * 0.5) + (s.LUK * 1.0))); 
    currentRun.dodgeChance = Math.min(50, Math.floor(s.AGI * 0.8)); 
    currentRun.vampRate = 0;       
    currentRun.doubleStrike = Math.min(50, Math.floor(s.LUK * 0.5));   

    currentRun.skills = { "緊急治療": 1 };
    currentRun.inventory = []; 
    currentRun.qteBuffDuration = 0; 
    currentRun.qteBuffTurns = 0;
    currentRun.activeVillageBuffs = [];
    playerShield = 0;
    activeMonster = null;
    playerStatusEffects = { burn: 0, poison: 0 };

    // 🗡️ 武器/防具/飾品加成計算 (保持原有裝備加成)
    if (accountMeta.equipment.weapon) {
        let b = CRAFTING_BLUEPRINTS.find(x => x.name === accountMeta.equipment.weapon);
        if (b) {
            let mult = 1 + (accountMeta.equipmentStars.weapon * 0.15);
            if (b.stats.atk) currentRun.atk += Math.floor(b.stats.atk * mult);
            if (b.stats.spd) currentRun.spd += Math.floor(b.stats.spd * mult);
            if (b.stats.mpRegen) currentRun.mpRegen += Math.floor(b.stats.mpRegen * mult);
        }
    }
    if (accountMeta.equipment.armor) {
        let b = CRAFTING_BLUEPRINTS.find(x => x.name === accountMeta.equipment.armor);
        if (b) {
            let mult = 1 + (accountMeta.equipmentStars.armor * 0.15);
            if (b.stats.block) currentRun.block += Math.floor(b.stats.block * mult);
            if (b.stats.maxHp) { currentRun.maxHp += Math.floor(b.stats.maxHp * mult); currentRun.hp = currentRun.maxHp; }
            if (b.stats.spd) currentRun.spd += Math.floor(b.stats.spd * mult);
            if (b.stats.dodgeChance) currentRun.dodgeChance += Math.floor(b.stats.dodgeChance * mult);
        }
    }
    if (accountMeta.equipment.accessory) {
        let b = CRAFTING_BLUEPRINTS.find(x => x.name === accountMeta.equipment.accessory);
        if (b) {
            let mult = 1 + (accountMeta.equipmentStars.accessory * 0.15);
            if (b.stats.critChance) currentRun.critChance += Math.floor(b.stats.critChance * mult);
            if (b.stats.dodgeChance) currentRun.dodgeChance += Math.floor(b.stats.dodgeChance * mult);
            if (b.stats.spd) currentRun.spd += Math.floor(b.stats.spd * mult);
            if (b.stats.vampRate) currentRun.vampRate += Math.floor(b.stats.vampRate * mult);          
            if (b.stats.doubleStrike) currentRun.doubleStrike += Math.floor(b.stats.doubleStrike * mult);  
        }
    }
}

// 💡 修正 Save/Load 機制，確保全域資料納入 Save Payload
async function saveGameData() {
    if (!accountMeta || !accountMeta.name || accountMeta.name === "無名勇者") return;

    localStorage.setItem("ABYSS_DESTINY_SAVE", JSON.stringify(accountMeta));

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
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
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (error) {
        console.warn("雲端通訊逾時，進度已鎖定在本地記憶體中。");
    }
}

async function checkCloudAccount() {
    let inputName = document.getElementById('player-name-input').value.trim();
    let legBox = document.getElementById('legacy-box');
    if (!inputName) {
        legBox.innerHTML = "請輸入名字以查詢雲端帳戶血脈...";
        return;
    }
    try {
        let response = await fetch(`${SERVER_URL}/api/load/${encodeURIComponent(inputName)}`);
        let res = await response.json();
        if (res.success && res.activeChar) {
            accountMeta.unlockedJobs = res.activeChar.unlockedJobs || ["novice"];
            accountMeta.warehouse = res.activeChar.warehouse || {};
            accountMeta.equipment = res.activeChar.equipment || { weapon: null, armor: null, accessory: null };
            accountMeta.equipmentStars = res.activeChar.equipmentStars || { weapon: 0, armor: 0, accessory: 0 };
            legBox.innerHTML = `🟢 <strong>偵測到雲端血脈！</strong> 職業：${accountMeta.unlockedJobs.join(", ")}`;
        } else {
            // 🌟 核心修正：新玩家大禮包放喺度！保證完全避開「Unreachable Code」錯誤
            accountMeta.unlockedJobs = ["novice"];
            accountMeta.warehouse = {
                "史萊姆黏液": 5,
                "巨石苔蘚": 3
            };
            accountMeta.equipment = { weapon: null, armor: null, accessory: null };
            accountMeta.equipmentStars = { weapon: 0, armor: 0, accessory: 0 };
            currentRun.gold = 300; // 贈送 300 金幣啟動資金
            
            legBox.innerHTML = `🎁 <strong>新勇者福利已啟動：</strong> 贈送 300G 資金與基礎素材（史萊姆黏液x5, 巨石苔蘚x3）！可直接去加工所打造第一把神兵！`;
        }
    } catch(e) { legBox.innerHTML = `📡 正在同步雲端資料庫...`; }
}

async function uploadProgressToCloud() {
    try {
        await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: accountMeta.name, 
                activeChar: { 
                    unlockedJobs: accountMeta.unlockedJobs, 
                    warehouse: accountMeta.warehouse,
                    equipment: accountMeta.equipment,
                    equipmentStars: accountMeta.equipmentStars
                } 
            })
        });
    } catch (e) { console.error("雲端存檔同步逾時"); }
}

// ==========================================================================
// 📡 命運深淵：魔導冷啟動喚醒引擎
// ==========================================================================

const LOADING_FLAVOR_TEXTS = [
    "正在通訊虛空裂縫，喚醒沉睡中的 Render 冥河伺服器...",
    "正在解鎖遠古魔導傳承，正在重構勇者基因...",
    "正在掃描雲端永久倉庫...",
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
        let warmupName = "warmup_net_core";
        await fetch(`${SERVER_URL}/api/load/${encodeURIComponent(warmupName)}`);
        
        if (barFill) barFill.classList.add('complete');
        if (txtNode) txtNode.innerHTML = "✨ <b>血脈矩陣對接成功！冥河通道已解鎖！</b>";
        
        setTimeout(() => {
            clearInterval(textTimer);
            if (overlay) overlay.classList.add('fade-out');
            let inputName = document.getElementById('player-name-input').value.trim();
            if (inputName) {
                checkCloudAccount();
            }
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
    if (!accountMeta || !accountMeta.name || accountMeta.name === "無名勇者") return;

    // 1. 🚀【本地秒存】
    localStorage.setItem("ABYSS_DESTINY_SAVE", JSON.stringify(accountMeta));
    console.log("💾 本地快取存檔成功！");

    // 2. 📡【雲端同步】直接沿用你原本的 /api/active/save 路由與架構
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒超時保護

        await fetch(`${SERVER_URL}/api/active/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: accountMeta.name, 
                activeChar: { 
                    unlockedJobs: accountMeta.unlockedJobs, 
                    warehouse: accountMeta.warehouse,
                    equipment: accountMeta.equipment,
                    equipmentStars: accountMeta.equipmentStars
                } 
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log("☁️ Render 雲端血脈同步成功！");
    } catch (error) {
        console.warn("📡 雲端通訊逾時，進度已鎖定在本地記憶體中。", error);
    }
}

/**
 * 📖 觸發讀檔：優先加載本地，再與雲端進行驗證覆蓋
 */
async function loadGameData(inputName) {
    if (!inputName) return;

    // 1. 🚀【秒讀本地】讓玩家點擊後免等待直接進遊戲
    const localSave = localStorage.getItem("ABYSS_DESTINY_SAVE");
    if (localSave) {
        const parsedData = JSON.parse(localSave);
        if (parsedData.name === inputName) {
            accountMeta = parsedData;
            console.log("📦 成功提取本地靈魂結晶進度！");
            resetCurrentRunData();
            updateUI();
        }
    }

    // 2. 📡【雲端對接】在背景默默跟後端要最新的資料
    try {
        let response = await fetch(`${SERVER_URL}/api/load/${encodeURIComponent(inputName)}`);
        let res = await response.json();
        if (res.success && res.activeChar) {
            accountMeta.unlockedJobs = res.activeChar.unlockedJobs || ["novice"];
            accountMeta.warehouse = res.activeChar.warehouse || {};
            accountMeta.equipment = res.activeChar.equipment || { weapon: null, armor: null, accessory: null };
            accountMeta.equipmentStars = res.activeChar.equipmentStars || { weapon: 0, armor: 0, accessory: 0 };
            accountMeta.name = inputName;
            
            // 同步回本地快取
            localStorage.setItem("ABYSS_DESTINY_SAVE", JSON.stringify(accountMeta));
            
            resetCurrentRunData();
            updateUI();
            if (typeof addLog === "function") {
                addLog("✨ <b>【遠古血脈】</b>已成功從 Render 雲端矩陣同步最新進度！", "perfect");
            }
        }
    } catch (e) {
        console.log("讀取雲端失敗，依賴本地存檔遊玩");
    }
}
