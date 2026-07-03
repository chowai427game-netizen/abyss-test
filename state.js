// ==========================================================================
// 📡 命運深淵：運行時全域狀態機與遠端雲端鏈接
// ==========================================================================

const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";

let accountMeta = { name: "無名勇者", unlockedJobs: ["novice"], warehouse: {} };

let currentRun = {
    job: "novice",
    lv: 1, hp: 100, maxHp: 100, mp: 20, maxMp: 50, mpRegen: 15, atk: 15, gold: 0, exp: 0, nextExp: 30,
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
let isAutoBattleMode = false; 

let currentEnvironment = "NORMAL"; 
let playerStatusEffects = { burn: 0, poison: 0 }; 
let currentVillageLocation = "GATE";

function resetCurrentRunData() {
    currentRun.lv = 1; currentRun.hp = 100; currentRun.maxHp = 100; currentRun.mp = 20; currentRun.maxMp = 50;
    currentRun.mpRegen = 15; currentRun.atk = 15; currentRun.gold = 0; currentRun.exp = 0; currentRun.nextExp = 30;
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
