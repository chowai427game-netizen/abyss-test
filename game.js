// ==========================================
// 📡 全局架構配置與雲端資料庫路由鏈接
// ==========================================
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

// ==========================================
// 🕹️ 💡 核心安全打印台（具備力場分流與錯誤防禦）
// ==========================================
function addLog(msg, type = "normal") {
    const box = document.getElementById('log-box');
    if (!box) return;
    
    let impactClass = "log-row-box";
    if (type === "perfect") impactClass += " log-perfect";
    else if (type === "deal") impactClass += " log-deal-dmg";
    else if (type === "take") impactClass += " log-take-dmg";
    else if (type === "env") impactClass += " log-env-tick";
    
    box.innerHTML += `<div class="${impactClass}">${msg}</div>`;
    box.scrollTop = box.scrollHeight;
}

function handleToggleAuto(checkbox) {
    isAutoBattleMode = checkbox.checked;
    addLog(isAutoBattleMode ? "🤖 <b>【指令託管】自動戰鬥已開啟，系統將自動判定環境抗性。</b>" : "🎮 <b>【手動介入】自動戰鬥已關閉，環境力場考驗個人手速。</b>");
}

// ==========================================
// 🗺️ 💡 新增：村莊地圖選單分區切換控制器
// ==========================================
function switchVillageLocation(targetZone) {
    // 1. 隱藏所有村莊子區域
    const subZones = ["gate", "cook", "plaza", "forge"];
    subZones.forEach(z => {
        const el = document.getElementById(`sub-zone-${z}`);
        if (el) el.style.display = "none";
    });
    
    // 2. 移除所有地圖按鈕的 active 高亮外觀
    const navButtons = ["nav-town-gate", "nav-town-kitchen", "nav-town-plaza", "nav-town-forge"];
    navButtons.forEach(b => {
        const btn = document.getElementById(b);
        if (btn) btn.classList.remove("active");
    });
    
    // 3. 依據玩家點擊，獨立顯示目標區域，並激活按鈕高亮
    if (targetZone === "GATE") {
        document.getElementById("sub-zone-gate").style.display = "block";
        document.getElementById("nav-town-gate").classList.add("active");
        addLog("🏰 你來到了【村莊大門】，傳送門內魔力湧動，隨時可以啟程。");
    } else if (targetZone === "COOK") {
        document.getElementById("sub-zone-cook").style.display = "block";
        document.getElementById("nav-town-kitchen").classList.add("active");
        addLog("🍳 你走進了【皇家料理屋】，空氣中瀰漫著獸人肉雜碎湯的香味。");
    } else if (targetZone === "PLAZA") {
        document.getElementById("sub-zone-plaza").style.display = "block";
        document.getElementById("nav-town-plaza").classList.add("active");
        addLog(" fountain 你來到了【冒險者廣場】，工匠們正在鋪設地磚...");
    } else if (targetZone === "WORKSHOP") {
        document.getElementById("sub-zone-forge").style.display = "block";
        document.getElementById("nav-town-forge").classList.add("active");
        addLog("⚒️ 你來到了【裝備加工所】，熔爐尚未點燃，鐵砧靜靜佇立。");
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

// ==========================================
// ⚔️ 4 大核心職業技能數據庫
// ==========================================
const SKILLS_DATABASE = {
    novice: [
        { name: "緊急治療", type: "active", mp: 15, desc: "基礎求生治療，聖光微現回復些許生命值。", run: (lv, atk, maxMp, hp) => ({ healPercent: 0.20, lostHp: (currentRun.maxHp - hp) + 40 }) }
    ],
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
        { name: "火箭術", type: "active", mp: 30, desc: "造成 30 點火傷並附燃燒。若怪處於凍結，此招傷害爆發 2.5 倍。", run: (lv) => ({ baseFire: 15 + lv * 15, meltMult: 2.5 + lv * 0.5 }) },
        { name: "冰箭術", type: "active", mp: 30, desc: "造成 35 點水傷。點擊成功有 40% 機率將魔物強行【凍結】1回合。", run: (lv) => ({ baseWater: 20 + lv * 15, freezeChance: 25 + lv * 15 }) },
        { name: "雷擊術", type: "active", mp: 35, desc: "引導天雷造成 50 點雷傷。若我方連擊率高於10%，追加1段落雷。", run: (lv) => ({ baseThunder: 30 + lv * 20, extraThunder: 15 + lv * 15 }) },
        { name: "聖靈召喚", type: "active", mp: 25, desc: "造成 45 點念動傷。此魔攻無條件穿透魔物晶體盾與減傷甲。", run: (lv) => ({ pierceMagic: 25 + lv * 20 }) },
        { name: "能量外套", type: "passive", desc: "【自動被動】進入戰鬥第 1 回合，體表自動化生成 250 點防禦魔法盾。" },
        { name: "心靈爆破", type: "active", mp: 50, desc: "發動精神爆破，造成自身當前 MP 殘餘值 80% 的無屬性魔法傷。", run: (lv, dummy, mp) => ({ mpToDmg: mp * (0.50 + lv * 0.30) }) },
        { name: "禪心", type: "active", mp: 0, desc: "犧牲當前回合不發動 any 揮砍攻擊，強行讓 MP 當場充滿 +80 點。", run: (lv) => ({ mpRestore: 55 + lv * 25 }) },
        { name: "火牆術", type: "active", mp: 45, desc: "立起 3 回合火牆。敵反擊時每回合開頭反噬受創 25 點並燃燒。", run: (lv) => ({ thornsFire: 15 + lv * 10, duration: 1 + lv }) },
        { name: "冰凍術", type: "active", mp: 20, desc: "將當前地下城異常環境力場，直接強制洗牌洗成【永凍冰原】2回合。", run: (lv) => ({ globalFreezeTurns: 1 + lv }) },
        { name: "雷爆術", type: "active", mp: 60, desc: "雷暴轟炸 80 傷害；魔物身上每有 1 層毒 or 火狀態，傷害加深 20%。", run: (lv) => ({ baseStorm: 50 + lv * 30, ampPerStatus: 0.15 + lv * 0.05 }) }
    ],
    acolyte: [
        { name: "治癒術", type: "active", mp: 20, desc: "聖光降臨，立刻百分比回復自身已損失生命值的 25% 氣血。", run: (lv, maxHp, dummy, hp) => ({ healPercent: 0.17 + lv * 0.08, lostHp: maxHp - hp }) },
        { name: "天使之賜福", type: "active", mp: 40, desc: "神神聖洗禮！本局冒險基礎攻擊永久 +10、最大生命上限永久 +50。", run: (lv) => ({ permAtk: 4 + lv * 6, permHp: 20 + lv * 30 }) },
        { name: "加速術", type: "active", mp: 15, desc: "極限閃避！完美閃避率永久固定 +10%，且下一回合自身必定暴擊。", run: (lv) => ({ permDodge: 7 + lv * 3 }) },
        { name: "光之壁", type: "active", mp: 25, desc: "當魔物施展特技大招時，揉捏防御成功強行將該傷害抹除 50%。", run: (lv) => ({ bossDmgCut: 0.35 + lv * 0.15 }) },
        { name: "神聖之光", type: "active", mp: 15, desc: "射出破邪聖光造成 25 點真傷。對不死系或 B40F 以上魔物有 3倍傷。", run: (lv) => ({ holyBase: 10 + lv * 15, undeadMult: 2.0 + lv * 1.0 }) },
        { name: "天使之護", type: "passive", desc: "【自動被動】神聖鐵甲加護，勇者固定減傷面板直接永續增加 +4 點。" },
        { name: "聖母之頌歌", type: "active", mp: 30, desc: "高階詠唱，接下來的 5 回合戰鬥內，自身每回合 MP 回復速度瘋狂翻倍。", run: (lv) => ({ mpRegenBuff: 10, duration: 3 + lv }) },
        { name: "天使之淚", type: "active", mp: 10, desc: "引導聖水淨化。當場徹底斬斷自身身上的所有【燃燒】與【劇毒】狀態。", run: (lv) => ({ cureStatus: true, healPerStack: 5 + lv * 10 }) },
        { name: "十字驅魔", type: "active", mp: 20, desc: "神聖驅逐，使敵方魔物的基礎攻擊力與命中率永久倒扣 -15%。", run: (lv) => ({ enemyDebuff: 0.10 + lv * 0.05 }) },
        { name: "神聖反彈", type: "active", mp: 15, desc: "鏡面信仰。接下來的 2 回合內，肉身受到的物理外傷 40% 數值神聖反彈。", run: (lv) => ({ reflectRate: 0.25 + lv * 0.15, duration: 1 + lv }) }
    ]
};

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

function handleStartGame() {
    let inputName = document.getElementById('player-name-input').value.trim();
    accountMeta.name = inputName || "gma";
    gameState = "VILLAGE";
    dungeonFloor = 0;
    currentEnvironment = "NORMAL";
    
    resetCurrentRunData();
    updateUI();
    renderVillageJobSelectors();
    renderVillageCookingWorkshop();
    
    document.getElementById('log-box').innerHTML = "";
    addLog(`⛺ 勇者 <strong>${accountMeta.name}</strong> 在地表村莊清醒。環境適應裝置運作正常。`);
}

function resetCurrentRunData() {
    currentRun.lv = 1; currentRun.hp = 100; currentRun.maxHp = 100; currentRun.mp = 20; currentRun.maxMp = 50;
    currentRun.mpRegen = 15; currentRun.atk = 15; currentRun.gold = 0; currentRun.exp = 0; currentRun.nextExp = 30;
    currentRun.block = 0; currentRun.critChance = 0; currentRun.dodgeChance = 0; currentRun.skills = { "緊急治療": 1 };
    currentRun.inventory = []; currentRun.qteBuffDuration = 0; currentRun.qteBuffTurns = 0;
    currentRun.activeVillageBuffs = [];
    playerShield = 0;
    activeMonster = null;
    playerStatusEffects = { burn: 0, poison: 0 };
    switchVillageLocation('GATE');
}

function handleMainAction() {
    try {
        if (gameState === "VILLAGE") {
            gameState = "BATTLE";
            dungeonFloor = 1;
            document.getElementById('btn-secondary-action').style.display = "block";
            document.getElementById('btn-secondary-action').innerText = "🏃 撤退逃回地表村莊";
            updateUI();
            runDungeonLoop();
        } else if (gameState === "BATTLE") {
            dungeonFloor++;
            updateUI();
            runDungeonLoop();
        }
    } catch(err) {
        addLog(`🚨【動作發動失敗】主按鈕鏈接錯誤：${err.message}`, "take");
    }
}

function handleSecondaryAction() {
    gameState = "VILLAGE";
    currentEnvironment = "NORMAL";
    document.getElementById('btn-secondary-action').style.display = "none";
    
    if (isQteActive) {
        clearTimeout(qteTimer);
        isQteActive = false;
        document.getElementById('qte-overlay').style.display = 'none';
    switchVillageLocation('GATE');
    }
    
    addLog(`🏃【撤退】你驚險逃回地表村莊！力場異常狀態完全洗淨。當局臨時等級歸零。`);
    
    currentRun.inventory.forEach(item => {
        if(MONSTER_DROPS[item] || Object.values(MONSTER_DROPS).includes(item) || item.includes("未知物體")) {
            accountMeta.warehouse[item] = (accountMeta.warehouse[item] || 0) + 1;
        }
    });
    uploadProgressToCloud();
    
    resetCurrentRunData();
    updateUI();
    renderVillageCookingWorkshop();
    renderVillageJobSelectors();
}

// ==========================================
// 🎒 背包與整備
// ==========================================
function renderDungeonInventoryUI() {
    const bagContainer = document.getElementById('p-dungeon-bag');
    if (!bagContainer) return;
    bagContainer.innerHTML = "";
    
    let slotWrapper = document.createElement('div');
    slotWrapper.className = "bag-slot-container";
    
    for (let i = 0; i < 2; i++) {
        let btnSlot = document.createElement('button');
        let item = currentRun.inventory[i];
        
        if (item) {
            btnSlot.className = "btn-bag-slot has-item";
            btnSlot.innerHTML = item;
            btnSlot.onclick = () => {
                if (gameState === "VILLAGE") {
                    accountMeta.warehouse[item] = (accountMeta.warehouse[item] || 0) + 1;
                    currentRun.inventory.splice(i, 1);
                    addLog(`🎒 將 [${item}] 移出出徵袋，歸還倉庫。`);
                    updateUI();
                    renderVillageCookingWorkshop();
                } else if (gameState === "BATTLE") {
                    executeUseDungeonItem(item, i);
                }
            };
        } else {
            btnSlot.className = "btn-bag-slot";
            btnSlot.innerHTML = "[ 空 ]";
            btnSlot.disabled = true;
        }
        slotWrapper.appendChild(btnSlot);
    }
    bagContainer.appendChild(slotWrapper);
}

function tryEquipItemToBag(itemName) {
    if (currentRun.inventory.length >= 2) {
        alert("🎒 背包已滿！");
        return;
    }
    if ((accountMeta.warehouse[itemName] || 0) <= 0) return;
    
    accountMeta.warehouse[itemName]--;
    currentRun.inventory.push(itemName);
    addLog(`🎒 已將 <strong>${itemName}</strong> 裝入戰術快捷欄。`);
    updateUI();
    renderVillageCookingWorkshop();
}

function executeUseDungeonItem(itemName, index) {
    if (gameState !== "BATTLE" || !activeMonster) return;
    
    addLog(`⚡🎒【快捷物資】勇者果斷捏碎消耗品 ➔ <strong>${itemName}</strong>！`, "deal");
    
    if (itemName.includes("未知物體")) {
        currentRun.hp = Math.max(1, currentRun.hp - (currentEnvironment === "POISON" ? 30 : 15));
        currentRun.qteBuffDuration = currentEnvironment === "POISON" ? 800 : 500; 
        currentRun.qteBuffTurns = 3;      
        addLog(`🪨 焦黑物體反噬扣血！但神經受到特大刺激，QTE 判定時間大幅延長！`, "take");
    } 
    else if (itemName.includes("厚牛巨堡")) {
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 100);
        playerShield += 80;
        addLog(`🌭 大快活熱量充能！血量回復 +100 HP，生成 80 點物理防盾！`, "perfect");
    } 
    else if (itemName.includes("永凍刨冰")) {
        let fTurns = currentEnvironment === "ICE" ? 4 : 2;
        activeMonster.freezeTurns = fTurns;
        addLog(`❄️ 寒氣狂飆！魔物被凍結 ${fTurns} 回合，無法反擊與再生！`, "perfect");
    } 
    else if (itemName.includes("禁忌血釀")) {
        activeMonster.hp = 0;
        activeMonster.isSkipped = true; 
        addLog(`🍷 秩序崩壞！空間扭曲，你強行蒸發該層魔物遁走！`, "perfect");
    }
    
    currentRun.inventory.splice(index, 1);
    updateUI();
}

function updateUI() {
    const toggle = (id, show) => { const el = document.getElementById(id); if(el) el.style.display = show ? "block" : "none"; };
    const envBar = document.getElementById('env-alert-bar');
    
    if (gameState === "TITLE") {
        toggle('title-box', true); toggle('status-panel-box', false); toggle('village-panel-box', false); toggle('log-box', false); toggle('action-panel-box', false);
        document.getElementById('location-text').innerText = "🔮 命運的起點";
        if(envBar) { envBar.className = "env-zone-normal"; envBar.innerHTML = "✨ 當前環境力場：穩定"; }
        return;
    }
    
    toggle('title-box', false); toggle('status-panel-box', true); toggle('log-box', true); toggle('action-panel-box', true);
    
    if (envBar) {
        if (currentEnvironment === "NORMAL") { envBar.className = "env-zone-normal"; envBar.innerHTML = "✨ 當前環境力場：重力與空間表現穩定"; }
        else if (currentEnvironment === "FIRE") { envBar.className = "env-zone-fire"; envBar.innerHTML = "🌋 警告：進入【烈焰焦土地核】每回合反噬燒血！火法克制"; }
        else if (currentEnvironment === "ICE") { envBar.className = "env-zone-ice"; envBar.innerHTML = "❄️ 警告：進入【萬年永凍冰原】常駐強效治癒禁制！"; }
        else if (currentEnvironment === "POISON") { envBar.className = "env-zone-poison"; envBar.innerHTML = "🧪 警告：進入【瘴氣劇毒沼澤】引導主動技能將深度感染！"; }
        else if (currentEnvironment === "VOID") { envBar.className = "env-zone-void"; envBar.innerHTML = "🌀 警告：進入【重力虛空壓制】主動 QTE 判定時間瘋狂縮短！"; }
    }
    
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
    
    let sList = Object.keys(currentRun.skills).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ");
    if(playerStatusEffects.burn > 0) sList += ` | 🔥燃燒x${playerStatusEffects.burn}`;
    if(playerStatusEffects.poison > 0) sList += ` | 🧪劇毒x${playerStatusEffects.poison}`;
    document.getElementById('p-skills-list').innerHTML = sList;
    
    renderDungeonInventoryUI();

    if (gameState === "VILLAGE") {
        toggle('village-panel-box', true); toggle('reward-panel-box', false);
        document.getElementById('location-text').innerText = "🌍 目前位置：地表村莊";
        document.getElementById('btn-main-action').innerText = "🌀 啟動傳送門降臨深淵 B1F";
        document.getElementById('btn-main-action').disabled = false;
    } else if (gameState === "BATTLE") {
        toggle('village-panel-box', false); toggle('reward-panel-box', false);
        document.getElementById('location-text').innerText = `🚨 當前位置：地下城 B${dungeonFloor}F`;
        document.getElementById('btn-main-action').innerText = `🪜 前進探險 B${dungeonFloor + 1}F`;
    } else if (gameState === "REWARD") {
        toggle('village-panel-box', false); toggle('reward-panel-box', true);
        document.getElementById('btn-main-action').disabled = true;
    }
}

function translateJob(j) {
    if(j === "novice") return "初心者"; if(j === "swordsman") return "劍士";
    if(j === "magician") return "魔法師"; return "服事";
}

function renderVillageJobSelectors() {
    const container = document.getElementById('job-choices-container');
    if (!container) return;
    container.innerHTML = "";
    let jobs = ["novice", "swordsman", "magician", "acolyte"];
    jobs.forEach(j => {
        let btn = document.createElement('button');
        btn.className = `btn-game btn-job-choice ${currentRun.job === j ? 'active' : ''}`;
        let isUnlocked = accountMeta.unlockedJobs.includes(j);
        btn.innerHTML = `${translateJob(j)}<br><b>${isUnlocked ? '🟢 可選' : '🔒 封鎖'}</b>`;
        btn.disabled = !isUnlocked;
        btn.onclick = () => {
            currentRun.job = j;
            if(j === "swordsman") { currentRun.maxMp = 50; currentRun.mpRegen = 5; currentRun.skills = { "狂擊": 1 }; }
            else if(j === "magician") { currentRun.maxMp = 150; currentRun.mpRegen = 20; currentRun.skills = { "火箭術": 1 }; }
            else if(j === "acolyte") { currentRun.maxMp = 90; currentRun.mpRegen = 10; currentRun.skills = { "治癒術": 1 }; }
            else { currentRun.maxMp = 50; currentRun.mpRegen = 15; currentRun.skills = { "緊急治療": 1 }; }
            updateUI(); renderVillageJobSelectors();
        };
        container.appendChild(btn);
    });
}

function renderVillageCookingWorkshop() {
    const wBox = document.getElementById('village-warehouse-display');
    if (!wBox) return;
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    wBox.innerHTML = `📦 <strong>雲端永久食材倉庫存留：</strong><br>${wItems || "倉庫空空如也"}`;
    
    const rContainer = document.getElementById('recipes-container');
    if (!rContainer) return;
    rContainer.innerHTML = "";
    
    RECIPES_DATABASE.forEach(recipe => {
        let btn = document.createElement('button');
        btn.className = "btn-game btn-cook";
        let reqText = Object.keys(recipe.ingredients).map(k => `${k} x${recipe.ingredients[k]}`).join(", ");
        btn.innerHTML = `🥞 製作: <strong>${recipe.name}</strong> [需：${reqText}]<br><span style="color:#aaa;">${recipe.desc}</span>`;
        btn.disabled = !canCanCook(recipe.ingredients);
        btn.onclick = () => executeVillageCooking(recipe);
        rContainer.appendChild(btn);
        
        if (recipe.type === "dungeon_use" && (accountMeta.warehouse[recipe.name] || 0) > 0) {
            let btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-explore";
            btnEquip.style.padding = "6px"; btnEquip.style.fontSize = "12px"; btnEquip.style.marginTop = "-5px"; btnEquip.style.marginBottom = "10px";
            btnEquip.innerHTML = `🎒 帶上 [${recipe.name}] 出擊 (庫存:${accountMeta.warehouse[recipe.name]})`;
            btnEquip.onclick = () => tryEquipItemToBag(recipe.name);
            rContainer.appendChild(btnEquip);
        }
    });

    if ((accountMeta.warehouse["🪨 焦黑的未知物體"] || 0) > 0) {
        let btnEquipBurnt = document.createElement('button');
        btnEquipBurnt.className = "btn-game btn-explore";
        btnEquipBurnt.style.padding = "6px"; btnEquipBurnt.style.fontSize = "12px"; btnEquipBurnt.style.background = "#555";
        btnEquipBurnt.innerHTML = `🎒 帶上 [🪨 焦黑的未知物體] (庫存:${accountMeta.warehouse["🪨 焦黑的未知物體"]})`;
        btnEquipBurnt.onclick = () => tryEquipItemToBag("🪨 焦黑的未知物體");
        rContainer.appendChild(btnEquipBurnt);
    }
}

function canCanCook(reqs) {
    for(let ing in reqs) { if((accountMeta.warehouse[ing] || 0) < reqs[ing]) return false; }
    return true;
}

function executeVillageCooking(recipe) {
    for(let ing in recipe.ingredients) { accountMeta.warehouse[ing] -= recipe.ingredients[ing]; }
    if (Math.random() > 0.75) {
        addLog(`💥【料理大失敗】化為一團黑炭：<strong>🪨 焦黑的未知物體</strong>！`, "take");
        accountMeta.warehouse["🪨 焦黑的未知物體"] = (accountMeta.warehouse["🪨 焦黑的未知物體"] || 0) + 1;
    } else {
        addLog(`🍳【皇家烹飪成功】製作出了高級料理：<strong>${recipe.name}</strong>！`, "perfect");
        if (recipe.type === "village_eat") {
            addLog(`🍴【開局進食】你吃下 ${recipe.name}，長效抗性灌注全身！`);
            currentRun.activeVillageBuffs.push(recipe.name);
            if(recipe.name.includes("哥布林")) { currentRun.maxHp += 60; currentRun.hp += 60; }
            if(recipe.name.includes("發光奧術")) { currentRun.maxMp += 30; currentRun.mpRegen += 3; }
            if(recipe.name.includes("銀河蟹肉")) { currentRun.maxHp += 200; currentRun.hp += 200; }
        } else {
            accountMeta.warehouse[recipe.name] = (accountMeta.warehouse[recipe.name] || 0) + 1;
        }
    }
    uploadProgressToCloud(); updateUI(); renderVillageCookingWorkshop();
}

// ==========================================
// 🕹 異步 QTE 與環境壓制變速器
// ==========================================
function triggerQteSystem(skillName, durationMs) {
    return new Promise((resolve) => {
        let baseDuration = durationMs;
        if (currentEnvironment === "VOID" && !currentRun.skills["霸體"]) {
            baseDuration = Math.max(600, durationMs - 400);
        }

        if (isAutoBattleMode) {
            let isAutoSuccess = Math.random() < 0.75; 
            setTimeout(() => { resolve(isAutoSuccess); }, 150); 
            return;
        }

        isQteActive = true; qteResolvePointer = resolve;
        let finalDuration = baseDuration + (currentRun.qteBuffDuration || 0);
        
        document.getElementById('qte-skill-name').innerText = `⚡ QTE 詠唱中：${skillName} ⚡`;
        document.getElementById('qte-overlay').style.display = 'flex';
        
        let timerFill = document.getElementById('qte-timer-fill');
        timerFill.style.width = '100%';
        timerFill.style.transition = `width ${finalDuration}ms linear`;
        setTimeout(() => { if(timerFill) timerFill.style.width = '0%'; }, 10);

        qteTimer = setTimeout(() => endQte(false), finalDuration);
    });
}

function handleQteTap() { if (!isQteActive) return; clearTimeout(qteTimer); endQte(true); }

function endQte(isSuccess) {
    isQteActive = false; document.getElementById('qte-overlay').style.display = 'none';
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
// ⚔️ 終極戰鬥引擎（全面注入安全保護與除錯追蹤）
// ==========================================
async function runDungeonLoop() {
    try {
        document.getElementById('btn-main-action').disabled = true;
        
        // 1. 滾動環境異變
        if (dungeonFloor > 1 && Math.random() < 0.35) {
            let envs = ["FIRE", "ICE", "POISON", "VOID"];
            currentEnvironment = envs[Math.floor(Math.random() * envs.length)];
        } else {
            currentEnvironment = "NORMAL";
        }
        
        // 2. 抽取攔路魔物
        let mKeys = Object.keys(MONSTER_DROPS);
        let mName = mKeys[Math.floor(Math.random() * mKeys.length)];
        
        activeMonster = { 
            name: mName, hp: 40 + dungeonFloor * 15, maxHp: 40 + dungeonFloor * 15, atk: 4 + dungeonFloor * 3,
            freezeTurns: 0, isSkipped: false  
        };
        
        updateUI();
        addLog(`⚔️【降臨 B${dungeonFloor}F】發現魔物：<strong>${activeMonster.name}</strong>`);
        
        // 被動技能啟動
        if (currentRun.job === "magician" && currentRun.skills["能量外套"]) {
            playerShield += 250 * currentRun.skills["能量外套"];
            addLog(`🟢【被動•能量外套】奧術防護盾啟動 🛡️ +${playerShield}`);
        }
        if (currentRun.skills["天使之護"]) { currentRun.block += 4 * currentRun.skills["天使之護"]; }

        let round = 1;
        // 3. 回合制主線 Promise 循環
        while (currentRun.hp > 0 && activeMonster.hp > 0) {
            if (gameState !== "BATTLE") return; 

            addLog(`<span style="color:#888;">[第 ${round} 回合]</span>`);
            
            if (currentRun.qteBuffTurns > 0) {
                currentRun.qteBuffTurns--;
                if(currentRun.qteBuffTurns === 0) { currentRun.qteBuffDuration = 0; addLog(`ℹ️ 興奮劑藥效宣告結束。`); }
            }

            // 狀態扣血
            if (playerStatusEffects.burn > 0) {
                let bDmg = playerStatusEffects.burn * 3;
                currentRun.hp = Math.max(1, currentRun.hp - bDmg);
                addLog(`🔥【異常燃燒】烈火灼燒肉身，受到 -${bDmg} 火傷。`, "env");
            }
            if (playerStatusEffects.poison > 0) {
                let pDmg = Math.floor(currentRun.maxHp * 0.06 * playerStatusEffects.poison);
                currentRun.hp = Math.max(1, currentRun.hp - pDmg);
                addLog(`🧪【異常劇毒】毒素攻心，受到 -${pDmg} 點毒素真傷。`, "env");
            }

            // 回藍
            currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + currentRun.mpRegen);
            updateUI();
            
            // 被動快速回復
            if (currentRun.skills["快速回復"]) {
                let hAmt = Math.floor(currentRun.maxHp * 0.08 * currentRun.skills["快速回復"]);
                if (currentEnvironment === "ICE" && !currentRun.activeVillageBuffs.includes("🍲 皇家銀河蟹肉宴")) {
                    hAmt = Math.floor(hAmt * 0.4); 
                    addLog(`❄️【冰原禁制】極寒凍結聖光，被動快速回復力受到 60% 壓制！`, "env");
                }
                currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + hAmt);
                addLog(`🟢【開局被動】細胞自動修復 +${hAmt} HP。`);
            }

            let activeTriggered = false;
            let skillKeys = Object.keys(currentRun.skills);
            
            // 技能判定
            for (let sName of skillKeys) {
                let sMeta = SKILLS_DATABASE[currentRun.job]?.find(s => s.name === sName);
                if (!sMeta || sMeta.type !== "active") continue;
                
                if (currentRun.mp >= sMeta.mp && Math.random() < 0.40) {
                    if (gameState !== "BATTLE") return;
                    addLog(`🔮 魔力大激盪 ➔ 引導【${sName} Lv.${currentRun.skills[sName]}】`);
                    activeTriggered = true;
                    
                    let isPerfect = await triggerQteSystem(sName, 1200);
                    if (gameState !== "BATTLE") return;

                    if (currentEnvironment === "POISON") {
                        playerStatusEffects.poison++;
                        addLog(`🧪【沼澤毒化】引導魔法吸入致命毒氣，自身【劇毒】層數再疊加 1 層！`, "env");
                    }

                    if (isPerfect) {
                        currentRun.mp -= sMeta.mp;
                        let eff = sMeta.run(currentRun.skills[sName], currentRun.atk, currentRun.maxMp, currentRun.hp);
                        
                        if (sName === "火箭術" && currentEnvironment === "FIRE") {
                            if(eff.baseFire) eff.baseFire = Math.floor(eff.baseFire * 1.5);
                            addLog(`🌋【力場共鳴】地核烈焰瘋狂倒灌！火箭術破格增幅 1.5 倍！`, "deal");
                        }

                        if (eff.dmg) { activeMonster.hp -= eff.dmg; addLog(`💥【完美釋放】${sName} 轟鳴破防！造成 -${eff.dmg} 點物理傷害！`, "perfect"); }
                        if (eff.fireDmg) { activeMonster.hp -= eff.fireDmg; addLog(`🔥【完美釋放】怒爆火焰重擊！爆發 -${eff.fireDmg} 點火傷！`, "perfect"); }
                        if (eff.blockBuff) { currentRun.block += eff.blockBuff; addLog(`🛡️【完美釋放】霸體姿態！固定減傷面板直接攀升 +${eff.blockBuff}！`, "perfect"); }
                        
                        if (eff.healPercent) {
                            let h = Math.floor(eff.lostHp * eff.healPercent);
                            if (currentEnvironment === "ICE" && !currentRun.activeVillageBuffs.includes("🍲 皇家銀河蟹肉宴")) {
                                h = Math.floor(h * 0.4);
                                addLog(`❄️【冰原禁制】治癒術光輝被寒冰死死壓制！`, "env");
                            }
                            currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + h);
                            addLog(`🩹【完美釋放】神聖治癒光輝降臨！血量大回復 +${h} HP！`, "perfect");
                        }
                        if (eff.mpRestore) { currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + eff.mpRestore); addLog(`🔵【完美釋放】禪心開啟！魔力回湧 +${eff.mpRestore} 點！`, "perfect"); }
                        if (eff.cureStatus) { playerStatusEffects.burn = 0; playerStatusEffects.poison = 0; addLog(`🩹【聖水淨化】神聖之淚降臨，體表異常狀態徹底斬斷！`, "perfect"); }
                        if (eff.globalFreezeTurns) { currentEnvironment = "ICE"; addLog(`❄️【人為氣候】冰凍術改寫力場，當前環境轉化為【永凍冰原】！`, "perfect"); }
                    } else {
                        addLog(`⚠️ 引導被打斷，被迫以普通物理普攻迎擊。`);
                        activeMonster.hp -= currentRun.atk;
                        addLog(`⚔️ 勇者普通物理攻擊造成 ${currentRun.atk} 點傷害。`, "deal");
                    }
                    break;
                }
            }
            
            if (!activeTriggered) {
                activeMonster.hp -= currentRun.atk;
                addLog(`⚔️ 勇者普通攻擊揮砍，內功爆發造成 ${currentRun.atk} 點物理傷害。`, "deal");
            }
            
            if (activeMonster.hp <= 0) break;
            await new Promise(r => setTimeout(r, 800));
            if (gameState !== "BATTLE") return;

            // 魔物反擊
            if (activeMonster.freezeTurns > 0) {
                addLog(`❄️【魔物凍結】魔物冰封中無法動彈。（剩餘: ${activeMonster.freezeTurns} 回合）`);
                activeMonster.freezeTurns--;
            } else {
                let rawDmg = activeMonster.atk;
                let finalDmg = Math.max(1, rawDmg - currentRun.block);
                
                if (playerShield > 0) {
                    if (finalDmg <= playerShield) { playerShield -= finalDmg; addLog(`🛡️ 魔物重撞！被奧術護盾抵消（殘餘盾: ${playerShield}）。`, "deal"); }
                    else { let over = finalDmg - playerShield; playerShield = 0; currentRun.hp -= over; addLog(`🔴 護盾碎裂！勇者防線崩潰，肉身承受 -${over} 傷害！`, "take"); }
                } else {
                    currentRun.hp -= finalDmg;
                    addLog(`🔴 [${activeMonster.name}] 發動暴虐反擊！勇者肉身受創 -${finalDmg} HP！`, "take");
                }
            }

            if (currentEnvironment === "FIRE" && !currentRun.activeVillageBuffs.includes("🍧 萬年永凍刨冰")) {
                currentRun.hp = Math.max(1, currentRun.hp - 8);
                addLog(`🌋【地核反噬】踩在滾燙熔岩上，受到 -8 點地熱火傷。`, "env");
            }

            updateUI();
            if (currentRun.hp <= 0) break;
            
            round++;
            await new Promise(r => setTimeout(r, 1000));
        }

        if (gameState !== "BATTLE") return;

        // 4. 戰後結算
        if (currentRun.hp > 0) {
            currentRun.gold += 20; currentRun.exp += 15;
            
            if (activeMonster.isSkipped) { addLog(`🔮【虛空跨越】成功撕裂長空逃離戰場...`); } 
            else {
                addLog(`🎉【大捷】殲滅魔物！臨時金幣 +20 G，經驗值 +15 點。`, "perfect");
                if (Math.random() < 0.25) { 
                    let dropName = MONSTER_DROPS[activeMonster.name] || "史萊姆核心黏液";
                    if (currentRun.inventory.length < 2) {
                        currentRun.inventory.push(dropName);
                        addLog(`🎁【食材幸運掉落】成功打包珍貴物資：<strong>${dropName}</strong>！`, "perfect");
                    } else {
                        addLog(`⚠️【背包已滿】無法撿起地面的 [${dropName}]！`);
                    }
                }
            }
            activeMonster = null; 
            checkLevelUpAndTriggerSelect();
        } else {
            addLog(`☠️【魂歸深淵】你被徹底擊潰！出徵袋物資全部丟失。`, "take");
            gameState = "VILLAGE"; currentEnvironment = "NORMAL";
            document.getElementById('btn-secondary-action').style.display = "none";
            resetCurrentRunData(); uploadProgressToCloud(); updateUI();
            renderVillageCookingWorkshop(); renderVillageJobSelectors();
        }
    } catch(err) {
        // 💡 終極安全機制：萬一出錯，直接在畫面上印出具體程式錯誤！
        addLog(`🚨【核心引擎崩潰】地下城執行階段發生未預期錯誤：${err.message}`, "take");
        console.error(err);
        document.getElementById('btn-main-action').disabled = false;
    }
}

function checkLevelUpAndTriggerSelect() {
    let leveledUp = false;
    while (currentRun.exp >= currentRun.nextExp) {
        currentRun.exp -= currentRun.nextExp; currentRun.lv++;
        currentRun.maxHp += 25; currentRun.hp = currentRun.maxHp; currentRun.atk += 5;
        currentRun.nextExp = Math.floor(currentRun.nextExp * 1.5);
        leveledUp = true;
    }
    
    if (leveledUp) {
        addLog(`✨👑 境界突破至 <strong>Lv.${currentRun.lv}</strong>！狀態已全面奶滿。`, "perfect");
        if (currentRun.job === "novice" && currentRun.lv >= 10) {
            gameState = "REWARD"; updateUI(); triggerJobAwakeningSelect(); return;
        }
        if (currentRun.job !== "novice" && currentRun.lv % 10 === 0) {
            gameState = "REWARD"; updateUI(); triggerSkillSelectThreeOfOne(); return;
        }
    }
    document.getElementById('btn-main-action').disabled = false;
    updateUI();
}

function triggerJobAwakeningSelect() {
    const container = document.getElementById('reward-choices-container');
    document.getElementById('reward-title-text').innerText = "👑 突破初心者極限：請選擇你的一轉職業 👑";
    if (!container) return;
    container.innerHTML = "";
    
    let jobs = [
        { id: "swordsman", name: "⚔️ 轉職：劍士", desc: "永久解鎖。開局獲得初始技能【狂擊】，走高減傷物理流派。" },
        { id: "magician", name: "🔮 轉職：魔法師", desc: "永久解鎖。開局獲得初始技能【火箭術】，走超大魔力元素流派。" },
        { id: "acolyte", name: "👼 轉職：服事", desc: "永久解鎖。開局獲得初始技能【治癒術】，走高容錯率百分比神聖回血。" }
    ];
    
    jobs.forEach(j => {
        let btn = document.createElement('button'); btn.className = "btn-game btn-cook";
        btn.innerHTML = `<strong>${j.name}</strong><br><span style="color:#ccc; font-size:11px;">${j.desc}</span>`;
        btn.onclick = () => {
            if (!accountMeta.unlockedJobs.includes(j.id)) { accountMeta.unlockedJobs.push(j.id); }
            currentRun.job = j.id;
            if(j.id === "swordsman") { currentRun.maxMp = 50; currentRun.mpRegen = 5; currentRun.skills = { "狂擊": 1 }; }
            else if(j.id === "magician") { currentRun.maxMp = 150; currentRun.mpRegen = 20; currentRun.skills = { "火箭術": 1 }; }
            else if(j.id === "acolyte") { currentRun.maxMp = 90; currentRun.mpRegen = 10; currentRun.skills = { "治癒術": 1 }; }
            
            addLog(`👑【榮耀轉職】血脈覺醒！你已正式進化成為【${translateJob(j.id)}】！`, "perfect");
            gameState = "BATTLE"; document.getElementById('btn-main-action').disabled = false;
            uploadProgressToCloud(); updateUI(); checkLevelUpAndTriggerSelect(); 
        };
        container.appendChild(btn);
    });
}

function triggerSkillSelectThreeOfOne() {
    const container = document.getElementById('reward-choices-container');
    document.getElementById('reward-title-text').innerText = "✨ 職業整數級突破：請抽選一項新技能或升級既有招式 ✨";
    if (!container) return;
    container.innerHTML = "";
    
    let pool = SKILLS_DATABASE[currentRun.job];
    let shuffled = [...pool].sort(() => 0.5 - Math.random());
    let choices = shuffled.slice(0, 3);
    
    choices.forEach(skill => {
        let btn = document.createElement('button'); btn.className = "btn-game btn-cook";
        let hasSkill = currentRun.skills[skill.name];
        let nextLv = hasSkill ? hasSkill + 1 : 1;
        btn.innerHTML = `🔮 <b>【${skill.name}】</b> (目前: ${hasSkill ? 'Lv.' + hasSkill : '未學會'}) ➔ <b>進化為 Lv.${nextLv}</b><br><span style="color:#ccc; font-size:11px;">${skill.desc}</span>`;
        
        btn.onclick = () => {
            currentRun.skills[skill.name] = nextLv;
            addLog(`✨【流派成型】你選擇了核心賜福：【${skill.name}】成功晉升為 Lv.${nextLv}！`, "perfect");
            gameState = "BATTLE"; document.getElementById('btn-main-action').disabled = false;
            updateUI(); checkLevelUpAndTriggerSelect();
        };
        container.appendChild(btn);
    });
}

window.onload = function() { checkCloudAccount(); };
