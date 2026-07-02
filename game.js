// ==========================================
// 📡 全局架構配置與雲端資料庫路由鏈接
// ==========================================
const SERVER_URL = "https://rpg-backend-fjvg.onrender.com";

// 1. 🗃️ 雲端永久保險箱數據 (MongoDB 元數據 ➔ 局外繼承不消失)
let accountMeta = {
    name: "無名勇者",
    unlockedJobs: ["novice"], // 預設只能選初心者
    warehouse: {}             // 倉庫存放囤積的食材
};

// 2. 🎮 當局肉鴿臨時狀態數據 (currentRun ➔ 死掉/回村立刻歸零)
let currentRun = {
    job: "novice",
    lv: 1, hp: 100, maxHp: 100, mp: 0, maxMp: 50, mpRegen: 5, atk: 15, gold: 0, exp: 0, nextExp: 30,
    block: 0, critChance: 0, dodgeChance: 0, vampRate: 0, regenPower: 0, doubleStrike: 0,
    skills: { "緊急治療": 1 }, // 學到的技能字典 { 技能名: 等級 }
    inventory: [],            // 地下城極限背包（最多容納 2 個食材物品）
    qteBuffDuration: 0        // 吃了焦黑物體後的 QTE 寬限增長時間 (毫秒)
};

let gameState = "TITLE"; // TITLE, VILLAGE, BATTLE, REWARD
let dungeonFloor = 0;
let isQteActive = false;
let qteTimer = null;
let qteResolvePointer = null;

// ==========================================
// ⚔️ 3 大核心職業 ➔ 30 大技能全數據庫配置
// ==========================================
const SKILLS_DATABASE = {
    swordsman: [
        { name: "狂擊", type: "active", mp: 15, desc: "物理重擊造成 180% 傷害，機率使怪眩暈。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * (1.4 + lv * 0.4)), stun: 20 + lv * 10 }) },
        { name: "怒爆", type: "active", mp: 25, desc: "釋放鬥氣造成 40 點火真傷，附加 3 回合普攻燃燒。", run: (lv) => ({ fireDmg: 20 + lv * 20, burnStacks: lv }) },
        { name: "霸體", type: "active", mp: 20, desc: "不屈姿態！自身固定減傷面板暴增 +10 點，持續 4 回合。", run: (lv) => ({ blockBuff: 5 + lv * 5, turns: 3 + lv }) },
        { name: "挑釁", type: "active", mp: 10, desc: "敵增攻 15% 但防禦瓦解，我方暴擊傷害增幅 1.5 倍。", run: (lv) => ({ critMult: 1.2 + lv * 0.3, enemyAtkUp: 0.15 }) },
        { name: "快速回復", type: "passive", desc: "【自動被動】回合開始時自動修復回復最大生命值 8% 氣血。" },
        { name: "狂暴狀態", type: "active", mp: 30, desc: "戰鬥連擊率固定 +15%；且自身血每低 10% 連擊再飆升。", run: (lv) => ({ baseDouble: 10 + lv * 5 }) },
        { name: "盾擊", type: "active", mp: 15, desc: "重盾破防，強制扣除敵護盾並為自己加載 80 點晶體盾。", run: (lv) => ({ shieldGain: 40 + lv * 40 }) },
        { name: "集中精神", type: "active", mp: 10, desc: "沉下氣息，成功則接下來 2 回合閃避率 +15% 且耗魔減半。", run: (lv) => ({ dodgeGain: 10 + lv * 5, turns: 1 + lv }) },
        { name: "殘影斬", type: "active", mp: 35, desc: "發動雙段連續物理突刺，每段造成物理攻擊力 120% 傷害。", run: (lv, dmg) => ({ isDoubleHit: true, pScale: 0.9 + lv * 0.3 }) },
        { name: "堅毅不屈", type: "passive", desc: "【自動被動】單次受創超上限 25% 時，自動將受創 30% 轉化為自身攻擊。" }
    ],
    magician: [
        { name: "火箭術", type: "active", mp: 30, desc: "造成 30 點火傷並附燃燒。若怪處於凍結，此招傷害爆發 2.5 倍。", run: (lv) => ({ baseFire: 15 + lv * 15, meltMult: 2.0 + lv * 0.5 }) },
        { name: "冰箭術", type: "active", mp: 30, desc: "造成 35 點水傷。點擊成功有 40% 機率將魔物強行【凍結】1回合。", run: (lv) => ({ baseWater: 20 + lv * 15, freezeChance: 25 + lv * 15 }) },
        { name: "雷擊術", type: "active", mp: 35, desc: "引導天雷造成 50 點雷傷。若我方連擊率高於10%，追加1段落雷。", run: (lv) => ({ baseThunder: 30 + lv * 20, extraThunder: 15 + lv * 15 }) },
        { name: "聖靈召喚", type: "active", mp: 25, desc: "造成 45 點念動傷。此魔攻無條件穿透魔物晶體盾與減傷甲。", run: (lv) => ({ pierceMagic: 25 + lv * 20 }) },
        { name: "能量外套", type: "passive", desc: "【自動被動】進入戰鬥第 1 回合，體表自動化生成 250 點防禦魔法盾。" },
        { name: "心靈爆破", type: "active", mp: 50, desc: "發動精神爆破，造成自身當前 MP 殘餘值 80% 的無屬性魔法傷。", run: (lv, dummy, mp) => ({ mpToDmg: mp * (0.50 + lv * 0.30) }) },
        { name: "禪心", type: "active", mp: 0, desc: "犧牲當前回合不發動任何揮砍攻擊，強行讓 MP 當場充滿 +80 點。", run: (lv) => ({ mpRestore: 55 + lv * 25 }) },
        { name: "火牆術", type: "active", mp: 45, desc: "立起 3 回合火牆。敵反擊時每回合開頭反噬受創 25 點並燃燒。", run: (lv) => ({ thornsFire: 15 + lv * 10, duration: 1 + lv }) },
        { name: "冰凍術", type: "active", mp: 20, desc: "將當前地下城異常環境力場，直接強制洗牌洗成【永凍冰原】2回合。", run: (lv) => ({ globalFreezeTurns: 1 + lv }) },
        { name: "雷爆術", type: "active", mp: 60, desc: "雷暴轟炸 80 傷害；魔物身上每有 1 層毒或火狀態，傷害加深 20%。", run: (lv) => ({ baseStorm: 50 + lv * 30, ampPerStatus: 0.15 + lv * 0.05 }) }
    ],
    acolyte: [
        { name: "治癒術", type: "active", mp: 20, desc: "聖光降臨，立刻百分比回復自身已損失生命值的 25% 氣血。", run: (lv, maxHp, dummy, hp) => ({ healPercent: 0.17 + lv * 0.08, lostHp: maxHp - hp }) },
        { name: "天使之賜福", type: "active", mp: 40, desc: "神聖洗禮！本局冒險基礎攻擊永久 +10、最大生命上限永久 +50。", run: (lv) => ({ permAtk: 4 + lv * 6, permHp: 20 + lv * 30 }) },
        { name: "加速術", type: "active", mp: 15, desc: "極限閃避！完美閃避率永久固定 +10%，且下一回合自身必定暴擊。", run: (lv) => ({ permDodge: 7 + lv * 3 }) },
        { name: "光之壁", type: "active", mp: 25, desc: "當魔物施展特技大招時，揉捏防御成功強行將該傷害抹除 50%。", run: (lv) => ({ bossDmgCut: 0.35 + lv * 0.15 }) },
        { name: "神聖之光", type: "active", mp: 15, desc: "射出破邪聖光造成 25 點真傷。對不死系或 B40F 以上魔物有 3 倍傷。", run: (lv) => ({ holyBase: 10 + lv * 15, undeadMult: 2.0 + lv * 1.0 }) },
        { name: "天使之護", type: "passive", desc: "【自動被動】神聖鐵甲加護，勇者固定減傷面板直接永續增加 +4 點。" },
        { name: "聖母之頌歌", type: "active", mp: 30, desc: "高階詠唱，接下來的 5 回合戰鬥內，自身每回合 MP 回復速度瘋狂翻倍。", run: (lv) => ({ mpRegenBuff: 10, duration: 3 + lv }) },
        { name: "天使之淚", type: "active", mp: 10, desc: "引導聖水淨化。當場徹底斬斷自身身上的所有【燃燒】與【劇毒】狀態。", run: (lv) => ({ cureStatus: true, healPerStack: 5 + lv * 10 }) },
        { name: "十字驅魔", type: "active", mp: 20, desc: "神聖驅逐，使敵方魔物的基礎攻擊力與命中率永久倒扣 -15%。", run: (lv) => ({ enemyDebuff: 0.10 + lv * 0.05 }) },
        { name: "神聖反彈", type: "active", mp: 15, desc: "鏡面信仰。接下來的 2 回合內，肉身受到的物理外傷 40% 數值神聖反彈。", run: (lv) => ({ reflectRate: 0.25 + lv * 0.15, duration: 1 + lv }) }
    ]
};

// 🥩 料理食譜與對應食材數據
const RECIPES_DATABASE = [
    { name: "🍲 哥布林亂燉雜碎湯", ingredients: { "半獸人厚實後腿肉": 1, "哥布林乾癟香料": 1 }, type: "village_eat", desc: "進城前吃：進入地下城前 15 層最大生命值固定 +60 點。" },
    { name: "🌭 皇家大快活厚牛巨堡", ingredients: { "半獸人厚實後腿肉": 2, "史萊姆核心黏液": 1 }, type: "dungeon_use", desc: "局內攜帶：戰鬥中吃當場奶滿 100 點 HP，並加載 80 點物理盾。" },
    { name: "🍮 發光奧術史萊姆凍", ingredients: { "史萊姆核心黏液": 2, "古墓巨石苔蘚": 1 }, type: "village_eat", desc: "進城前吃：Max MP 永久 +30，每回合 MP 自動回復固定 +3。" },
    { name: "🍧 萬年永凍刨冰", ingredients: { "萬年永凍冰晶": 1, "怨靈純淨淚晶": 1 }, type: "dungeon_use", desc: "局內攜帶：當前對戰魔物強行陷入【凍結】狀態 2 回合（封鎖再生）。" },
    { name: "🍲 皇家銀河蟹肉宴", ingredients: { "🦀 帝王蟹巨腿": 1, "怨靈純淨淚晶": 1 }, type: "village_eat", desc: "進城前吃：最大生命永續 +200 點，完美免疫永凍冰原治癒禁制。" },
    { name: "🍷 秩序逆轉禁忌血釀", ingredients: { "秩序扭曲者核心": 1, "墮落祭司禁忌血清": 1 }, type: "dungeon_use", desc: "局內攜帶：顛倒虛空！直接強行跳過當前樓層戰鬥，無傷安全降臨下一層。" }
];

const MONSTER_DROPS = {
    "💧 藍色史萊姆": "史萊姆核心黏液", "👺 綠皮哥布林": "哥布林乾癟香料", "🐗 荒野半獸人": "半獸人厚實後腿肉", 
    "👻 迷途哭泣怨靈": "怨靈純淨淚晶", "🧱 古墓巨石守衛": "古墓巨石苔蘚", "🧙 深淵墮落祭司": "墮落祭司禁忌血清",
    "🧊 萬年霜凍冰魔": "萬年永凍冰晶", "🌌 虛空秩序扭曲者": "秩序扭曲者核心", "🌊 深淵巨鎧 Scylla": "🦀 帝王蟹巨腿"
};

// ==========================================
// 📡 核心聯網通訊模組 (Render 後端 API)
// ==========================================
async function addLog(msg) {
    const box = document.getElementById('log-box');
    if (box) {
        box.innerHTML += `<div class="log-row-box">${msg}</div>`;
        box.scrollTop = box.scrollHeight;
    }
}

async function checkCloudAccount() {
    let inputName = document.getElementById('player-name-input').value.trim();
    let legBox = document.getElementById('legacy-box');
    if (!inputName) return;
    try {
        let response = await fetch(`${SERVER_URL}/api/load/${encodeURIComponent(inputName)}`);
        let res = await response.json();
        if (res.success && res.activeChar) {
            // 讀取成功後映射至本地
            accountMeta.unlockedJobs = res.activeChar.unlockedJobs || ["novice"];
            accountMeta.warehouse = res.activeChar.warehouse || {};
            legBox.innerHTML = `🟢 <strong>偵測到雲端血脈！</strong> 已成功永久解鎖職業：${accountMeta.unlockedJobs.join(", ")}`;
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

// ==========================================
// 🕹️ 流程控制與主按鈕調度
// ==========================================
function handleStartGame() {
    let inputName = document.getElementById('player-name-input').value.trim();
    accountMeta.name = inputName || "gma";
    gameState = "VILLAGE";
    dungeonFloor = 0;
    
    // 初始化當局數據 (歸零 Lv.1)
    resetCurrentRunData();
    updateUI();
    renderVillageJobSelectors();
    renderVillageCookingWorkshop();
    
    document.getElementById('log-box').innerHTML = "";
    addLog(`⛺ 勇者 <strong>${player.name}</strong> 在地表村莊清醒。請進行開局裝備或烹飪補給。`);
}

function resetCurrentRunData() {
    currentRun.lv = 1; currentRun.hp = 100; currentRun.maxHp = 100; currentRun.mp = 0; currentRun.maxMp = 50;
    currentRun.mpRegen = 5; currentRun.atk = 15; currentRun.gold = 0; currentRun.exp = 0; currentRun.nextExp = 30;
    currentRun.block = 0; currentRun.critChance = 0; currentRun.dodgeChance = 0; currentRun.skills = { "緊急治療": 1 };
    currentRun.inventory = []; currentRun.qteBuffDuration = 0;
}

function handleMainAction() {
    if (gameState === "VILLAGE") {
        // 進入地下城
        gameState = "BATTLE";
        dungeonFloor = 1;
        document.getElementById('btn-secondary-action').style.display = "block";
        document.getElementById('btn-secondary-action').innerText = "🏃 撤退逃回地表村莊";
        updateUI();
        runDungeonLoop();
    } else if (gameState === "BATTLE") {
        // 局內前進下一層
        dungeonFloor++;
        updateUI();
        runDungeonLoop();
    }
}

function handleSecondaryAction() {
    // 局內任何時刻均可驚險撤退回地表村莊，強制歸零 Lv.1 但保留帶回來的 2 格食材
    addLog(`🏃【撤退】你驚險避開危險，成功撤退逃回地表村莊！當局等級重置歸零。`);
    gameState = "VILLAGE";
    document.getElementById('btn-secondary-action').style.display = "none";
    
    // 結算：將極限背包內拿到的食材送入永久倉庫
    currentRun.inventory.forEach(item => {
        accountMeta.warehouse[item] = (accountMeta.warehouse[item] || 0) + 1;
    });
    uploadProgressToCloud();
    
    resetCurrentRunData();
    // 檢查有沒有滿足永久轉職解鎖條件 (例如初心者到達 Lv.10 撤退或戰死)
    if (currentRun.job === "novice" && player.lv >= 10 && !accountMeta.unlockedJobs.includes("swordsman")) {
        // 這邊簡化判定，滿足條件即塞入
    }
    
    updateUI();
    renderVillageCookingWorkshop();
}

// ==========================================
// 🎨 前端 UI 動態渲染核心
// ==========================================
function updateUI() {
    const toggle = (id, show) => { const el = document.getElementById(id); if(el) el.style.display = show ? "block" : "none"; };
    
    if (gameState === "TITLE") {
        toggle('title-box', true); toggle('status-panel-box', false); toggle('village-panel-box', false); toggle('log-box', false); toggle('action-panel-box', false);
        document.getElementById('location-text').innerText = "🔮 命運的起點";
        return;
    }
    
    toggle('title-box', false);
    toggle('status-panel-box', true);
    toggle('log-box', true);
    toggle('action-panel-box', true);
    
    // 渲染通用頂部面板
    document.getElementById('p-name').innerText = accountMeta.name;
    document.getElementById('p-job').innerText = translateJob(currentRun.job);
    document.getElementById('p-lv').innerText = currentRun.lv;
    document.getElementById('p-hp').innerText = currentRun.hp;
    document.getElementById('p-maxhp').innerText = currentRun.maxHp;
    document.getElementById('p-mp').innerText = currentRun.mp;
    document.getElementById('p-maxmp').innerText = currentRun.maxMp;
    document.getElementById('p-gold').innerText = currentRun.gold;
    document.getElementById('p-block').innerText = currentRun.block;
    document.getElementById('p-crit').innerText = currentRun.critChance + "%";
    document.getElementById('p-dodge').innerText = currentRun.dodgeChance + "%";
    document.getElementById('p-exp-text').innerText = `${currentRun.exp} / ${currentRun.nextExp}`;
    
    document.getElementById('hp-bar-fill').style.width = (currentRun.hp / currentRun.maxHp) * 100 + "%";
    document.getElementById('mp-bar-fill').style.width = (currentRun.mp / currentRun.maxMp) * 100 + "%";
    
    // 渲染當前持有的招式名稱與等級
    let sList = Object.keys(currentRun.skills).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ");
    document.getElementById('p-skills-list').innerText = sList || "無";
    
    // 渲染極限 2 格背包
    document.getElementById('p-dungeon-bag').innerText = currentRun.inventory.length > 0 ? currentRun.inventory.join(" | ") : "空無一物";

    if (gameState === "VILLAGE") {
        toggle('village-panel-box', true);
        toggle('reward-panel-box', false);
        document.getElementById('location-text').innerText = "🌍 目前位置：地表村莊";
        document.getElementById('btn-main-action').innerText = "🌀 啟動傳送門降臨深淵 B1F";
        document.getElementById('btn-main-action').disabled = false;
        document.getElementById('dungeon-bag-row').style.display = "none"; // 村莊隱藏局內背包
    } else if (gameState === "BATTLE") {
        toggle('village-panel-box', false);
        toggle('reward-panel-box', false);
        document.getElementById('location-text').innerText = `🚨 當前位置：地下城 B${dungeonFloor}F`;
        document.getElementById('btn-main-action').innerText = `🪜 前進探險 B${dungeonFloor + 1}F`;
        document.getElementById('dungeon-bag-row').style.display = "block";
    } else if (gameState === "REWARD") {
        toggle('village-panel-box', false);
        toggle('reward-panel-box', true);
        document.getElementById('btn-main-action').disabled = true;
    }
}

function translateJob(j) {
    if(j === "novice") return "初心者"; if(j === "swordsman") return "劍士";
    if(j === "magician") return "魔法師"; return "服事";
}

function renderVillageJobSelectors() {
    const container = document.getElementById('job-choices-container');
    container.innerHTML = "";
    let jobs = ["novice", "swordsman", "magician", "acolyte"];
    jobs.forEach(j => {
        let btn = document.createElement('button');
        btn.className = `btn-game btn-job-choice ${currentRun.job === j ? 'active' : ''}`;
        let isUnlocked = accountMeta.unlockedJobs.includes(j);
        btn.innerHTML = `${translateJob(j)}<br><b>${isUnlocked ? '🟢 已解鎖可選' : '🔒 封鎖不可選'}</b>`;
        btn.disabled = !isUnlocked;
        btn.onclick = () => {
            currentRun.job = j;
            // 初始分配魔力面板上限
            if(j === "swordsman") { currentRun.maxMp = 50; currentRun.mpRegen = 5; currentRun.skills = { "狂擊": 1 }; }
            else if(j === "magician") { currentRun.maxMp = 150; currentRun.mpRegen = 20; currentRun.skills = { "火箭術": 1 }; }
            else if(j === "acolyte") { currentRun.maxMp = 90; currentRun.mpRegen = 10; currentRun.skills = { "治癒術": 1 }; }
            else { currentRun.maxMp = 50; currentRun.mpRegen = 5; currentRun.skills = { "緊急治療": 1 }; }
            updateUI();
            renderVillageJobSelectors();
        };
        container.appendChild(btn);
    });
}

function renderVillageCookingWorkshop() {
    const wBox = document.getElementById('village-warehouse-display');
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (持有:${accountMeta.warehouse[k]}個)`).join(" | ");
    wBox.innerHTML = `📦 <strong>雲端永久食材倉庫存留：</strong><br>${wItems || "目前空空如也，前進地下城打怪收集食材吧！"}`;
    
    const rContainer = document.getElementById('recipes-container');
    rContainer.innerHTML = "";
    RECIPES_DATABASE.forEach(recipe => {
        let btn = document.createElement('button');
        btn.className = "btn-game btn-cook";
        
        let reqText = Object.keys(recipe.ingredients).map(k => `${k} x${recipe.ingredients[k]}`).join(", ");
        btn.innerHTML = `<strong>${recipe.name}</strong> [需：${reqText}]<br><span style="color:#aaa;">${recipe.desc}</span>`;
        
        // 檢查素材夠不夠
        let canCook = true;
        for(let ing in recipe.ingredients) {
            if((accountMeta.warehouse[ing] || 0) < recipe.ingredients[ing]) canCook = false;
        }
        btn.disabled = !canCanCook(recipe.ingredients);
        btn.onclick = () => executeVillageCooking(recipe);
        rContainer.appendChild(btn);
    });
}

function canCanCook(reqs) {
    for(let ing in reqs) {
        if((accountMeta.warehouse[ing] || 0) < reqs[ing]) return false;
    }
    return true;
}

// ==========================================
// 🍳 料理烹飪大失敗與吃飽起手機制
// ==========================================
function executeVillageCooking(recipe) {
    // 扣除材料
    for(let ing in recipe.ingredients) { accountMeta.warehouse[ing] -= recipe.ingredients[ing]; }
    
    if (Math.random() > 0.75) {
        // 25% 烹飪大失敗，產出「焦黑的未知物體」
        addLog(`💥【料理大失敗】魔力火候控制失準！所有投入的珍貴食材瞬間蒸發，化為一團黑炭：<strong>🪨 焦黑的未知物體</strong>！`);
        // 大失敗產物強行塞入永久倉庫，允許帶下場當絕地興奮劑
        accountMeta.warehouse["🪨 焦黑的未知物體"] = (accountMeta.warehouse["🪨 焦黑的未知物體"] || 0) + 1;
    } else {
        addLog(`🍳【皇家烹飪成功】香氣四溢！你成功製作出了高階神聖料理：<strong>${recipe.name}</strong>！`);
        
        if (recipe.type === "village_eat") {
            // 局外長效進食效果，立刻覆蓋當局
            addLog(`🍴【開局進食補給】你當場吃下 ${recipe.name}！長效 Buff 注入血脈！`);
            if(recipe.name.includes("哥布林")) { currentRun.maxHp += 60; currentRun.hp += 60; }
            if(recipe.name.includes("發光奧術")) { currentRun.maxMp += 30; currentRun.mpRegen += 3; }
            if(recipe.name.includes("銀河蟹肉")) { currentRun.maxHp += 200; currentRun.hp += 200; }
        } else {
            // 局內攜帶型，存入永久倉庫，進傳送門前由包包攜帶
            accountMeta.warehouse[recipe.name] = (accountMeta.warehouse[recipe.name] || 0) + 1;
        }
    }
    uploadProgressToCloud();
    updateUI();
    renderVillageCookingWorkshop();
}

// ==========================================
// 🕹️ 核心中斷層：異步 Promise QTE 計時器
// ==========================================
function triggerQteSystem(skillName, durationMs) {
    return new Promise((resolve) => {
        isQteActive = true;
        qteResolvePointer = resolve;
        
        // 吃了焦黑物體後，QTE 時間強制加長延長，降低操作門檻
        let finalDuration = durationMs + (currentRun.qteBuffDuration || 0);
        
        document.getElementById('qte-skill-name').innerText = `⚡ QTE 詠唱中：${skillName} ⚡`;
        document.getElementById('qte-overlay').style.display = 'flex';
        
        let timerFill = document.getElementById('qte-timer-fill');
        timerFill.style.width = '100%';
        timerFill.style.transition = `width ${finalDuration}ms linear`;
        setTimeout(() => timerFill.style.width = '0%', 10);

        qteTimer = setTimeout(() => endQte(false), finalDuration);
    });
}

function handleQteTap() {
    if (!isQteActive) return;
    clearTimeout(qteTimer);
    endQte(true);
}

function endQte(isSuccess) {
    isQteActive = false;
    document.getElementById('qte-overlay').style.display = 'none';
    
    const shell = document.getElementById('main-game-shell');
    if (isSuccess) {
        shell.classList.add('shake-effect', 'success-flash');
        setTimeout(() => shell.classList.remove('shake-effect', 'success-flash'), 150);
    } else {
        shell.classList.add('shake-effect', 'fail-flash');
        setTimeout(() => shell.classList.remove('shake-effect', 'fail-flash'), 150);
    }
    if (qteResolvePointer) qteResolvePointer(isSuccess);
}

// ==========================================
// ⚔️ 全新回合制戰鬥循環引擎 (MP資源管理制)
// ==========================================
async function runDungeonLoop() {
    document.getElementById('btn-main-action').disabled = true;
    
    // 滾動生成怪物
    let mName = Object.keys(MONSTER_DROPS)[Math.floor(Math.random() * Object.keys(MONSTER_DROPS).length)];
    let monster = { name: mName, hp: 40 + dungeonFloor * 15, maxHp: 40 + dungeonFloor * 15, atk: 4 + dungeonFloor * 3 };
    
    addLog(`⚔️【遭遇戰】降臨 B${dungeonFloor}F！前方攔路魔物：<strong style="color:#ff4757;">${monster.name}</strong> (HP: ${monster.hp})`);
    
    // 檢查法師被動【能量外套】
    let pShield = 0;
    if (currentRun.job === "magician" && currentRun.skills["能量外套"]) {
        pShield += 250 * currentRun.skills["能量外套"];
        addLog(`🟢【被動•能量外套】魔力固化成型！開局自動加載 🛡️ ${pShield} 點魔法奧術盾。`);
    }
    // 檢查服事被動【天使之護】
    if (currentRun.skills["天使之護"]) {
        currentRun.block += 4 * currentRun.skills["天使之護"];
    }

    let round = 1;
    while (currentRun.hp > 0 && monster.hp > 0) {
        addLog(`<span style="color:#888;">[第 ${round} 回合]</span>`);
        
        // 1. 我方回合開始 ➔ MP 自動高能回魔
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + currentRun.mpRegen);
        updateUI();
        
        // 2. 檢查被動【快速回復】
        if (currentRun.skills["快速回復"]) {
            let hAmt = Math.floor(currentRun.maxHp * 0.08 * currentRun.skills["快速回復"]);
            currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + hAmt);
            addLog(`🟢【被動•快速回復】氣血湧動，細胞自動修復 +${hAmt} HP。`);
        }

        // 3. 核心：主動技能判定 (輪詢學會的技能清單)
        let activeTriggered = false;
        let skillKeys = Object.keys(currentRun.skills);
        
        for (let sName of skillKeys) {
            // 找尋技能池資料庫
            let sMeta = SKILLS_DATABASE[currentRun.job]?.find(s => s.name === sName);
            if (!sMeta || sMeta.type !== "active") continue;
            
            // 只要 MP 夠，且機率骰中，觸發 QTE 主動技能釋放
            if (currentRun.mp >= sMeta.mp && Math.random() < 0.5) {
                addLog(`🔮 勇者體內魔力激盪！正在引導詠唱 ➔ 【${sName} Lv.${currentRun.skills[sName]}】`);
                activeTriggered = true;
                
                // 中斷戰鬥循環，喚醒 1.2 秒 QTE 按鈕
                let isPerfect = await triggerQteSystem(sName, 1200);
                
                if (isPerfect) {
                    currentRun.mp -= sMeta.mp;
                    // 計算不同技能的客製化公式效果
                    let eff = sMeta.run(currentRun.skills[sName], currentRun.atk, currentRun.maxMp, currentRun.hp);
                    
                    if (eff.dmg) { monster.hp -= eff.dmg; addLog(`<span style="color:#2ecc71; font-weight:bold;">💥【QTE PERFECT】${sName} 完美重擊！重創魔物造成 -${eff.dmg} 點物理爆發傷！</span>`); }
                    if (eff.fireDmg) { monster.hp -= eff.fireDmg; addLog(`<span style="color:#e67e22; font-weight:bold;">🔥【QTE PERFECT】怒爆鬥氣燃燒！造成 -${eff.fireDmg} 火傷，附加烈焰附魔！</span>`); }
                    if (eff.blockBuff) { currentRun.block += eff.blockBuff; addLog(`<span style="color:#3498db; font-weight:bold;">🛡️【QTE PERFECT】鋼鐵神罡防線！固定減傷永久攀升 +${eff.blockBuff}！</span>`); }
                    if (eff.healPercent) { let h = Math.floor(eff.lostHp * eff.healPercent); currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + h); addLog(`<span style="color:#2ecc71; font-weight:bold;">🩹【QTE PERFECT】聖光奇蹟大治癒！瘋狂快速救命回血 +${h} HP！</span>`); }
                    if (eff.mpRestore) { currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + eff.mpRestore); addLog(`<span style="color:#1e90ff; font-weight:bold;">🔵【QTE PERFECT】禪心冥想大圓滿！魔力當場瘋狂回湧 +${eff.mpRestore} 點！</span>`); }
                } else {
                    addLog(`<span style="color:#aaa;">⚠️【QTE MISS】手速超時或按錯！招式被打斷，本回合被迫退化成基礎普攻。</span>`);
                    monster.hp -= currentRun.atk;
                    addLog(`⚔️ 勇者步伐踉蹌揮劍，只造成基礎物理普攻 ${currentRun.atk} 點外傷。`);
                }
                break; // 每回合只能打出一招主動技能
            }
        }
        
        // 如果連 MP 技能都沒觸發，執行凡人基礎普通攻擊
        if (!activeTriggered) {
            monster.hp -= currentRun.atk;
            addLog(`⚔️ 勇者踏步橫斬，普通攻擊砍中魔物造成 ${currentRun.atk} 點物理外傷。`);
        }
        
        if (monster.hp <= 0) break;
        await new Promise(r => setTimeout(r, 800));

        // 4. 魔物反擊回合
        let rawDmg = monster.atk;
        let finalDmg = Math.max(1, rawDmg - currentRun.block);
        
        if (pShield > 0) {
            if (finalDmg <= pShield) { pShield -= finalDmg; addLog(`🛡️ 魔物反撲撞擊！被勇者體表奧術外套護盾完美抵消（剩餘盾: ${pShield}）。`); }
            else { let over = finalDmg - pShield; pShield = 0; currentRun.hp -= over; addLog(`🔴 魔物擊碎魔法盾！餘威破裂肉身造成了 -${over} 點外傷！`); }
        } else {
            currentRun.hp -= finalDmg;
            addLog(`🔴 [${monster.name}] 兇猛反撲撕咬！扣除固定減傷防線後，勇者肉身受創 -${finalDmg} HP！`);
        }
        
        // 檢查被動【堅毅不屈】
        if (finalDmg >= currentRun.maxHp * 0.25 && currentRun.skills["堅毅不屈"]) {
            let buffAtk = Math.floor(finalDmg * 0.3 * currentRun.skills["堅毅不屈"]);
            currentRun.atk += buffAtk;
            addLog(`🟢【被動•堅毅不屈】肉身承受特大重創！殺氣爆發！基礎攻擊力永久 +${buffAtk} 點！`);
        }

        updateUI();
        if (currentRun.hp <= 0) break;
        
        round++;
        await new Promise(r => setTimeout(r, 1000));
    }

    // 5. 局內生死勝負總結結算
    if (currentRun.hp > 0) {
        currentRun.gold += 20;
        currentRun.exp += 15;
        addLog(`🎉【大捷】成功徹底殲滅魔物！拾獲金幣 +20 G，經驗值 +15 點。`);
        
        // 🎲 料理食材極低概率掉落模組 (12% 機率)
        if (Math.random() < 0.12) {
            let dropName = MONSTER_DROPS[monster.name] || "史萊姆核心黏液";
            if (currentRun.inventory.length < 2) {
                currentRun.inventory.push(dropName);
                addLog(`🎁【食材幸運掉落】魔物屍首解體！你幸運撿到了珍貴稀有食材：<strong>${dropName}</strong>（成功塞入局內背包 ${currentRun.inventory.length}/2 格）！`);
            } else {
                addLog(`⚠️【背包已滿折損】地面掉落了 [${dropName}]，但你地下城背包 2 格限制已滿！你不得不痛苦被迫捨棄！`);
            }
        }
        
        checkLevelUpAndTriggerSelect();
    } else {
        // 戰鬥不能強制戰死歸零
        addLog(`☠️【魂歸深淵】你被魔物徹底擊潰終結！強制被皇家救護隊拖回村莊旅店。`);
        // 局內所有材料蒸發
        addLog(`💸 警告：因為你死在地下城，局內背包攜帶的材料全部碎裂丟失，無法帶回村莊。`);
        
        // 檢查初心者是否滿足 Lv.10 永久轉職解鎖
        if (currentRun.job === "novice" && currentRun.lv >= 10 && !accountMeta.unlockedJobs.includes("swordsman")) {
            accountMeta.unlockedJobs.push("swordsman");
            accountMeta.unlockedJobs.push("magician");
            accountMeta.unlockedJobs.push("acolyte");
            alert("👑 傳承大覺醒！初心者在當局成功存活練到了 Lv.10！雲端正式永久解鎖【一轉：劍士、魔法師、服事】！未來開局直接選！");
        }
        
        gameState = "VILLAGE";
        resetCurrentRunData();
        uploadProgressToCloud();
        updateUI();
        renderVillageCookingWorkshop();
    }
}

// ==========================================
// 🎲 核心肉鴿升級：本職 10 大技能三選一機制
// ==========================================
function checkLevelUpAndTriggerSelect() {
    if (currentRun.exp >= currentRun.nextExp) {
        currentRun.exp -= currentRun.nextExp;
        currentRun.lv++;
        currentRun.maxHp += 25; currentRun.hp = currentRun.maxHp;
        currentRun.atk += 5;
        currentRun.nextExp = Math.floor(currentRun.nextExp * 1.5);
        
        addLog(`✨👑 恭喜升級！勇者境界突破至 <strong>Lv.${currentRun.lv}</strong>！全狀態充滿奶滿。`);
        
        // 喚醒肉鴿精髓：三選一技能抽卡池
        gameState = "REWARD";
        updateUI();
        triggerSkillSelectThreeOfOne();
    } else {
        document.getElementById('btn-main-action').disabled = false;
        updateUI();
    }
}

function triggerSkillSelectThreeOfOne() {
    const container = document.getElementById('reward-choices-container');
    container.innerHTML = "";
    
    // 抽取目前職業所屬的 10 大 core 技能池
    let pool = SKILLS_DATABASE[currentRun.job] || SKILLS_DATABASE["swordsman"];
    let shuffled = [...pool].sort(() => 0.5 - Math.random());
    let choices = shuffled.slice(0, 3); // 3選1
    
    choices.forEach(skill => {
        let btn = document.createElement('button');
        btn.className = "btn-game btn-cook"; // 復用統一樣式
        
        let hasSkill = currentRun.skills[skill.name];
        let nextLv = hasSkill ? hasSkill + 1 : 1;
        btn.innerHTML = `🔮 <b>【${skill.name}】</b> (目前: ${hasSkill ? 'Lv.' + hasSkill : '未學會'}) ➔ <b>進化為 Lv.${nextLv}</b><br><span style="color:#ccc; font-size:11px;">${skill.desc}</span>`;
        
        btn.onclick = () => {
            currentRun.skills[skill.name] = nextLv;
            addLog(`✨【流派成型】你選擇了核心恩賜：【${skill.name}】成功晉升為等級 Lv.${nextLv}！`);
            gameState = "BATTLE";
            document.getElementById('btn-main-action').disabled = false;
            updateUI();
            checkLevelUpAndTriggerSelect(); // 遞迴檢查是否連續升級
        };
        container.appendChild(btn);
    });
}

window.onload = function() {
    // 啟動首頁查詢
    checkCloudAccount();
};
