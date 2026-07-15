// ==========================================================================
// 📡 state.js：運行時全域狀態機與遠端雲端鏈接 (部位精煉星級適應版)
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";

let accountMeta = { 
    name: "無名勇者", 
    unlockedJobs: ["novice"], 
    warehouse: {},
    equipment: { weapon: null, armor: null, accessory: null },
    // 🌟 部位永久升星槽位（0⭐-5⭐，永久繼承換裝不受影響）
    equipmentStars: { weapon: 0, armor: 0, accessory: 0 }
};

let currentRun = {
    job: "novice",
    lv: 1, hp: 100, maxHp: 100, mp: 20, maxMp: 50, mpRegen: 15, atk: 15, gold: 0, exp: 0, nextExp: 30,
    spd: 20, 
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
let isAutoBattleMode = false; // 🤖 掛機自動戰鬥開關

let currentEnvironment = "NORMAL"; 
let playerStatusEffects = { burn: 0, poison: 0 }; 
let currentVillageLocation = "GATE";

function resetCurrentRunData() {
    currentRun.lv = 1; 
    currentRun.hp = 100; 
    currentRun.maxHp = 100; 
    currentRun.mp = 20; 
    currentRun.maxMp = 50;
    currentRun.mpRegen = 15; 
    currentRun.atk = 15; 
    currentRun.spd = 20; // 🎯 這裡修正了：由原來的 spd: 20 改回 spd = 20 
    currentRun.exp = 0; 
    currentRun.nextExp = 30;
    currentRun.block = 0; 
    currentRun.critChance = 0; 
    currentRun.dodgeChance = 0; 
    currentRun.skills = { "緊急治療": 1 };
    currentRun.inventory = []; 
    currentRun.qteBuffDuration = 0; 
    currentRun.qteBuffTurns = 0;
    currentRun.activeVillageBuffs = [];
    playerShield = 0;
    activeMonster = null;
    playerStatusEffects = { burn: 0, poison: 0 };
    currentRun.vampRate = 0;       
    currentRun.doubleStrike = 0;   

    // 🗡️ 武器注入 (乘上星級額外加乘：每 1⭐ +15% 屬性)
    if (accountMeta.equipment.weapon) {
        let b = CRAFTING_BLUEPRINTS.find(x => x.name === accountMeta.equipment.weapon);
        if (b) {
            let mult = 1 + (accountMeta.equipmentStars.weapon * 0.15);
            if (b.stats.atk) currentRun.atk += Math.floor(b.stats.atk * mult);
            if (b.stats.spd) currentRun.spd += Math.floor(b.stats.spd * mult);
            if (b.stats.mpRegen) currentRun.mpRegen += Math.floor(b.stats.mpRegen * mult);
        }
    }
    // 👕 防具注入
    if (accountMeta.equipment.armor) {
        let b = CRAFTING_BLUEPRINTS.find(x => x.name === accountMeta.equipment.armor);
        if (b) {
            let mult = 1 + (accountMeta.equipmentStars.armor * 0.15);
            if (b.stats.block) currentRun.block += Math.floor(b.stats.block * mult);
            if (b.stats.maxHp) { 
                currentRun.maxHp += Math.floor(b.stats.maxHp * mult); 
                currentRun.hp = currentRun.maxHp; 
            }
            if (b.stats.spd) currentRun.spd += Math.floor(b.stats.spd * mult);
            if (b.stats.dodgeChance) currentRun.dodgeChance += Math.floor(b.stats.dodgeChance * mult);
        }
    }
    // 💍 飾品注入
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
