// 2.game.js
// ==========================================================================
// 🕹️ 命運深淵：真・ATB 異步運算與動態戰局核心引擎 (完美修正對齊版)
// ==========================================================================

let combatTickerTimer = null; 
let combatRoundCounter = 1;   

let playerAtb = 0;
let monsterAtb = 0;
let envAtb = 0;
let battleTimeElapsed = 0;

function handleStartGame() {
    let inputName = document.getElementById('player-name-input').value.trim();
    if (!inputName) {
        alert("🧙 勇者啊，請先在輸入框刻下你的大名，才能喚醒雲端血脈！");
        return;
    }
    accountMeta.name = inputName;
    gameState = "VILLAGE";
    dungeonFloor = 0;
    currentEnvironment = "NORMAL";
    
    resetCurrentRunData();
    updateUI();
    switchVillageLocation("GATE");
    document.getElementById('log-box').innerHTML = "";
    addLog(`⛺ 勇者 <strong>${accountMeta.name}</strong> 在地表村莊清醒。環境適應裝置運作正常。`);
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

// 💡 實裝：戰術重巡機制 (安全重刷本層整備)
function handleRerunAction() {
    try {
        clearInterval(combatTickerTimer);
        addLog(`🔄【重巡整備】你決定留在深淵 B${dungeonFloor}F 進行重巡狩獵，戰局重新載入！`, "perfect");
        gameState = "BATTLE";
        updateUI();
        runDungeonLoop();
    } catch(err) {
        addLog(`🚨【重巡失敗】: ${err.message}`, "take");
    }
}

function handleSecondaryAction() {
    clearInterval(combatTickerTimer);
    gameState = "VILLAGE";
    currentEnvironment = "NORMAL";
    document.getElementById('btn-secondary-action').style.display = "none";
    if (isQteActive) {
        clearTimeout(qteTimer);
        isQteActive = false;
        document.getElementById('qte-overlay').style.display = 'none';
    }
    addLog(`🏃【撤退】你驚險逃回地表村莊！當局臨時等級歸零。`);
    
    currentRun.inventory.forEach(item => {
        if(MONSTER_DROPS[item] || Object.values(MONSTER_DROPS).includes(item) || item.includes("未知物體")) {
            accountMeta.warehouse[item] = (accountMeta.warehouse[item] || 0) + 1;
        }
    });
    uploadProgressToCloud();
    resetCurrentRunData();
    updateUI();
    switchVillageLocation("GATE");
}

function tryEquipItemToBag(itemName) {
    if (currentRun.inventory.length >= 2) { alert("🎒 背包已滿！"); return; }
    if ((accountMeta.warehouse[itemName] || 0) <= 0) return;
    accountMeta.warehouse[itemName]--;
    currentRun.inventory.push(itemName);
    addLog(`🎒 已將 <strong>${itemName}</strong> 裝入戰術快捷欄。`);
    updateUI();
    if(currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
}

// ==========================================================================
// ⚡ 戰術快捷包物資微操模組
// ==========================================================================
function executeUseDungeonItem(itemName, index) {
    if (gameState !== "BATTLE" || !activeMonster) return;
    addLog(`⚡🎒【快捷物資微操】勇者果斷捏碎消耗品 ➔ <strong>${itemName}</strong>！`, "deal");
    
    if (itemName.includes("未知物體")) {
        let dmg = currentEnvironment === "POISON" ? 30 : 15;
        currentRun.hp = Math.max(1, currentRun.hp - dmg);
        currentRun.qteBuffDuration = currentEnvironment === "POISON" ? 800 : 500; 
        currentRun.qteBuffTurns = 3;      
        addLog(`🪨 焦黑物體反噬扣血！但神經受到特大刺激，冷卻判定安全時間延長！`, "take");
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
        activeMonster.hp = 0; activeMonster.isSkipped = true; 
        addLog(`🍷 秩序崩壞！空間扭曲，你強行蒸發該層魔物遁走！`, "perfect");
    }
    
    currentRun.inventory.splice(index, 1);
    updateUI();
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

async function runDungeonLoop() {
    try {
        document.getElementById('btn-main-action').disabled = true;
        const rerunBtn = document.getElementById('btn-rerun-action');
        if(rerunBtn) rerunBtn.disabled = true;

        let isBossFloor = (dungeonFloor % 10 === 0);
        if (!isBossFloor && Math.random() < 0.25 && gameState !== "ENCOUNTER_RESOLVED") {
            gameState = "ENCOUNTER"; updateUI(); triggerRandomAbyssEvent(); return; 
        }
        if (gameState === "ENCOUNTER_RESOLVED") { gameState = "BATTLE"; }

        currentEnvironment = (dungeonFloor > 1 && Math.random() < 0.35) ? ["FIRE", "ICE", "POISON", "VOID"][Math.floor(Math.random() * 4)] : "NORMAL";
        
        if (isBossFloor) {
            let bossMeta = BOSS_DATABASE[dungeonFloor] || { name: `👹 深淵無名魔皇`, baseHp: dungeonFloor * 40, baseAtk: dungeonFloor * 3, baseSpd: 20, dropItem: "史萊姆黏液" };
            activeMonster = { name: bossMeta.name, hp: bossMeta.baseHp, maxHp: bossMeta.baseHp, atk: bossMeta.baseAtk, spd: bossMeta.baseSpd, freezeTurns: 0, isSkipped: false, isBoss: true, fixedDrop: bossMeta.dropItem };
            addLog(`🚨迫近🌋【領主降臨 B${dungeonFloor}F】發現大領主：<strong>${activeMonster.name}</strong>！`, "take");
        } else {
            let rollSeed = REGULAR_MONSTERS_POOL[Math.floor(Math.random() * REGULAR_MONSTERS_POOL.length)];
            let scaledHp = Math.floor(rollSeed.baseHp + dungeonFloor * rollSeed.hpScale);
            let scaledAtk = Math.floor(rollSeed.baseAtk + dungeonFloor * rollSeed.atkScale);
            activeMonster = { name: rollSeed.name, hp: scaledHp, maxHp: scaledHp, atk: scaledAtk, spd: rollSeed.baseSpd, freezeTurns: 0, isSkipped: false, isBoss: false };
            addLog(`⚔️【降臨 B${dungeonFloor}F】發現魔物：<strong>${activeMonster.name}</strong>`);
        }
        
        updateUI();
        if (currentRun.job === "magician" && currentRun.skills["能量外套"]) { playerShield += 250 * currentRun.skills["能量外套"]; }
        if (currentRun.skills["天使之護"]) { currentRun.block += 4 * currentRun.skills["天使之護"]; }

        playerAtb = 0; monsterAtb = 0; envAtb = 0; battleTimeElapsed = 0;
        if(combatTickerTimer) clearInterval(combatTickerTimer);

        combatTickerTimer = setInterval(() => {
            if (gameState !== "BATTLE" || !activeMonster || currentRun.hp <= 0 || activeMonster.hp <= 0) {
                clearInterval(combatTickerTimer); return;
            }
            battleTimeElapsed += 0.25;
            playerAtb += currentRun.spd;
            monsterAtb += activeMonster.spd;
            envAtb += 15;

            if (envAtb >= 100) { envAtb -= 100; executeEnvironmentTick(); }
            if (playerAtb >= 100 && currentRun.hp > 0 && activeMonster && activeMonster.hp > 0) { playerAtb -= 100; executePlayerActionTick(); }
            if (monsterAtb >= 100 && currentRun.hp > 0 && activeMonster && activeMonster.hp > 0) { monsterAtb -= 100; executeMonsterActionTick(); }
            updateUI();
        }, 250);
    } catch(err) { 
        addLog(`🚨 地下城異常：${err.message}`, "take"); 
    }
}

function executeEnvironmentTick() {
    currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + Math.floor(currentRun.mpRegen / 2));
    if (playerStatusEffects.burn > 0) { 
        let bDmg = playerStatusEffects.burn * 3; currentRun.hp = Math.max(1, currentRun.hp - bDmg); 
        addLog(`🔥 烈火灼燒！受到 <span class="num-popup num-boss-strike">-${bDmg} HP</span>`, "env"); 
    }
    if (playerStatusEffects.poison > 0) { 
        let pDmg = Math.floor(currentRun.maxHp * 0.05 * playerStatusEffects.poison); currentRun.hp = Math.max(1, currentRun.hp - pDmg); 
        addLog(`🧪 毒素攻心！受到 <span class="num-popup num-boss-strike">-${pDmg} HP</span>`, "env"); 
    }
    if (currentRun.hp <= 0) { clearInterval(combatTickerTimer); executeDungeonDefeatSequence(); }
}

function executePlayerActionTick() {
    let activeTriggered = false;
    for (let sName of Object.keys(currentRun.skills)) {
        let sMeta = SKILLS_DATABASE[currentRun.job]?.find(s => s.name === sName);
        if (sMeta && sMeta.type === "active" && currentRun.mp >= sMeta.mp && Math.random() < 0.40) {
            addLog(`🔮 引導【${sName}】`); activeTriggered = true;
            let isPerfect = (Math.random() < 0.75);
            let numClass = currentRun.job === "magician" ? "num-m-dmg" : "num-p-dmg";
            if (isPerfect) {
                currentRun.mp -= sMeta.mp; 
                let eff = sMeta.run(currentRun.skills[sName], currentRun.atk, currentRun.maxMp, currentRun.hp);
                if (eff.dmg) { activeMonster.hp -= eff.dmg; addLog(`💥 核心技！<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${eff.dmg} HP</span>`, "perfect"); }
                if (eff.healPercent) {
                    let h = Math.floor(eff.lostHp * eff.healPercent); currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + h);
                    addLog(`🩹 神聖洗禮！<span class="heal-effect">[${accountMeta.name}]</span> <span class="num-popup num-h-heal">+${h} HP</span>`, "perfect");
                }
            } else {
                activeMonster.hp -= currentRun.atk; addLog(`⚔️ 普攻突刺！<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${currentRun.atk} HP</span>`, "deal");
            }
            break;
        }
    }
    if (!activeTriggered) { 
        activeMonster.hp -= currentRun.atk; 
        let numClass = currentRun.job === "magician" ? "num-m-dmg" : "num-p-dmg";
        addLog(`⚔️ 揮砍！<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${currentRun.atk} HP</span>`, "deal"); 
    }
    
    // 吸血與連擊計算
    if (currentRun.vampRate > 0 && currentRun.hp > 0 && activeMonster.hp > 0) {
        let vAmt = Math.floor(currentRun.atk * (currentRun.vampRate / 100));
        if (vAmt > 0) { currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + vAmt); addLog(`🩸【血脈吸吮】吸血 <span class="num-popup num-h-heal">+${vAmt} HP</span>`); }
    }
    if (currentRun.doubleStrike > 0 && Math.random() * 100 < currentRun.doubleStrike && activeMonster.hp > 0) {
        let extraDmg = Math.floor(currentRun.atk * 0.85); activeMonster.hp -= extraDmg;
        addLog(`⚡【殘影追擊】極速連砍！追加受創 <span class="num-popup num-p-dmg">-${extraDmg} HP</span>`, "deal");
    }
    if (activeMonster.hp <= 0) { clearInterval(combatTickerTimer); executeDungeonVictorySequence(); }
}

function executeMonsterActionTick() {
    if (activeMonster.freezeTurns > 0) { activeMonster.freezeTurns--; return; }
    let finalDmg = Math.max(1, activeMonster.atk - currentRun.block);
    currentRun.hp -= finalDmg; 
    addLog(`🔴 魔物暴虐反噬！<span class="strike-monster">[${accountMeta.name}]</span> <span class="num-popup num-boss-strike">-${finalDmg} HP</span>`, "take"); 
    if (currentRun.hp <= 0) { clearInterval(combatTickerTimer); executeDungeonDefeatSequence(); }
}

function executeDungeonVictorySequence() {
    let isBossFloor = (dungeonFloor % 10 === 0);
    currentRun.gold += isBossFloor ? 150 : 20; currentRun.exp += isBossFloor ? 100 : 15;
    
    if (isBossFloor) {
        const bOverlay = document.getElementById('boss-victory-overlay');
        if (bOverlay) { bOverlay.style.display = "flex"; bOverlay.onclick = () => { dismissBossVictoryCinematic(); }; }
        if (activeMonster) {
            addLog(`🏆【史詩大捷】討伐領主 [${activeMonster.name}]！`, "perfect");
            let drop = activeMonster.fixedDrop; accountMeta.warehouse[drop] = (accountMeta.warehouse[drop] || 0) + 1;
            addLog(`🎁 戰利品傳送 ➔ <strong>${drop} (x1)</strong>！`, "perfect");
        }
        setTimeout(() => { dismissBossVictoryCinematic(); }, 4000);
    } else {
        addLog(`👑 <span class="gold-victory-text">VICTORY!</span> 獲得金幣 +20 G，經驗值 +15。`, "victory-badge");
        if (activeMonster && Math.random() < 0.25) { 
            let dropName = MONSTER_DROPS[activeMonster.name] || "史萊姆黏液";
            if (currentRun.inventory.length < 2) { currentRun.inventory.push(dropName); addLog(`🎁 獲得素材：<strong>${dropName}</strong>！`, "perfect"); }
        }
        activeMonster = null; checkLevelUpAndTriggerSelect();
    }
}

function dismissBossVictoryCinematic() {
    const bOverlay = document.getElementById('boss-victory-overlay');
    if (!bOverlay || bOverlay.style.display === "none") return;
    bOverlay.style.display = "none"; activeMonster = null; gameState = "REWARD"; updateUI(); triggerBossTalentReward();
}

function executeDungeonDefeatSequence() {
    addLog(`☠️【魂歸深淵】物資遺失，強制歸還地表。`, "take");
    gameState = "VILLAGE"; currentEnvironment = "NORMAL";
    document.getElementById('btn-secondary-action').style.display = "none";
    resetCurrentRunData(); uploadProgressToCloud(); updateUI(); switchVillageLocation("GATE");
}

function triggerBossTalentReward() {
    const container = document.getElementById('reward-choices-container');
    if (!container) return; container.innerHTML = "";
    let perks = [
        { name: "👑 不滅巨魔血脈", desc: "減傷固定永久暴增 +6 點！", run: () => { currentRun.block += 6; } },
        { name: "⚡ 狂暴神經反射", desc: "完美閃避率永久 +8%！", run: () => { currentRun.dodgeChance += 8; } },
        { name: "🩸 殘虐撕裂本能", desc: "暴擊機率永續固定 +10%！", run: () => { currentRun.critChance += 10; } }
    ];
    perks.forEach(perk => {
        let btn = document.createElement('button'); btn.className = "btn-game btn-cook";
        btn.innerHTML = `<strong>${perk.name}</strong><br><span style="color:#2ecc71; font-size:11px;">${perk.desc}</span>`;
        btn.onclick = () => { perk.run(); gameState = "BATTLE"; document.getElementById('btn-main-action').disabled = false; uploadProgressToCloud(); updateUI(); checkLevelUpAndTriggerSelect(); };
        container.appendChild(btn);
    });
}

function checkLevelUpAndTriggerSelect() {
    let leveledUp = false;
    while (currentRun.exp >= currentRun.nextExp) {
        currentRun.exp -= currentRun.nextExp; currentRun.lv++;
        currentRun.maxHp += 25; currentRun.hp = currentRun.maxHp; currentRun.atk += 5;
        currentRun.nextExp = Math.floor(currentRun.nextExp * 1.5); leveledUp = true;
    }
    if (leveledUp) { addLog(`✨👑 境界突破至 <strong>Lv.${currentRun.lv}</strong>！`, "perfect"); }
    if (gameState === "BATTLE") { document.getElementById('btn-main-action').disabled = false; }
    updateUI();
}

function triggerRandomAbyssEvent() {
    const container = document.getElementById('reward-choices-container');
    const title = document.getElementById('reward-title-text');
    if (!container || !title) return; container.innerHTML = "";
    let eventType = Math.floor(Math.random() * 3);

    if (eventType === 0) {
        title.innerText = "🛒 流浪黑市商人 • 冥河折扣 🛒";
        let rolledGoods = [...MARKET_ITEMS_POOL].sort(() => 0.5 - Math.random()).slice(0, 2);
        buildBlackMarketUI(rolledGoods);
    } 
    else if (eventType === 1) {
        title.innerText = "🩸 命運邪神祭壇 • 血脈契約 🩸";
        let btnDeal = document.createElement('button'); btnDeal.className = "btn-game btn-cook";
        btnDeal.innerHTML = `<strong>🩸 簽訂血脈契約</strong><br><span style="color:#ff4757;">代價：Max HP -25 ➔ 報酬：+15 攻擊力！</span>`;
        btnDeal.onclick = () => { currentRun.maxHp = Math.max(15, currentRun.maxHp - 25); currentRun.hp = Math.min(currentRun.hp, currentRun.maxHp); currentRun.atk += 15; resolveAbyssEvent(); };
        container.appendChild(btnDeal);
    } 
    else {
        let isGolden = (Math.random() < 0.30 || dungeonFloor > 20);
        let chest = isGolden ? TREASURE_CHESTS_POOL[1] : TREASURE_CHESTS_POOL[0];
        title.innerText = `🎁 發現古老遺蹟：[${chest.name}] 🎁`;
        let btnOpen = document.createElement('button'); btnOpen.className = "btn-game btn-explore"; btnOpen.style.width = "100%";
        btnOpen.innerHTML = `🔑 砸開寶箱鎖扣`;
        btnOpen.onclick = () => {
            let rolledGold = Math.floor(Math.random() * (chest.maxGold - chest.minGold + 1)) + chest.minGold; currentRun.gold += rolledGold;
            addLog(`👑 獲得臨時金幣 +${rolledGold} G！`, "perfect");
            if (isGolden && Math.random() < 0.50) {
                // 💡 核心安全修正：對齊 itemdata.js 精簡後的素材字串名稱
                let highTier = ["虛空核心", "帝王蟹腿", "永凍冰晶", "祭司血清"];
                let drop = highTier[Math.floor(Math.random() * highTier.length)]; accountMeta.warehouse[drop] = (accountMeta.warehouse[drop] || 0) + 1;
                addLog(`🎁 獲得稀有素材：<strong>${drop}</strong>！`, "perfect");
            }
            resolveAbyssEvent();
        };
        container.appendChild(btnOpen);
    }
    updateUI();
}

function buildBlackMarketUI(goodsList) {
    const container = document.getElementById('reward-choices-container');
    if (!container) return; container.innerHTML = "";
    goodsList.forEach(item => {
        let btn = document.createElement('button'); btn.className = "btn-game btn-cook";
        btn.innerHTML = `🪙 <b>購買：[${item.name}]</b> (${item.price}G)`;
        btn.onclick = () => {
            if (currentRun.gold < item.price || currentRun.inventory.length >= 2) return;
            currentRun.gold -= item.price; currentRun.inventory.push(item.name); buildBlackMarketUI(goodsList); updateUI();
        };
        container.appendChild(btn);
    });
    let btnExit = document.createElement('button'); btnExit.className = "btn-game btn-rest"; btnExit.innerHTML = "🏃 繼續出發";
    btnExit.onclick = () => { resolveAbyssEvent(); }; container.appendChild(btnExit);
}

function resolveAbyssEvent() { gameState = "ENCOUNTER_RESOLVED"; document.getElementById('btn-main-action').disabled = false; updateUI(); runDungeonLoop(); }
function executeForgeEquipment(blueprint) {
    for(let ing in blueprint.ingredients) { accountMeta.warehouse[ing] -= blueprint.ingredients[ing]; }
    addLog(`🛠️ 成功鑄造神裝：<strong>${blueprint.name}</strong>！`, "perfect");
    accountMeta.warehouse[blueprint.name] = (accountMeta.warehouse[blueprint.name] || 0) + 1;
    uploadProgressToCloud(); updateUI(); if(currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}
function executeEquipAction(equipName, actionType) {
    let blueprint = CRAFTING_BLUEPRINTS.find(b => b.name === equipName); if (!blueprint) return;
    let slot = blueprint.type;
    if (actionType === "equip") {
        if (accountMeta.equipment[slot]) { let old = accountMeta.equipment[slot]; accountMeta.warehouse[old] = (accountMeta.warehouse[old] || 0) + 1; }
        accountMeta.warehouse[equipName]--; accountMeta.equipment[slot] = equipName;
    } else {
        accountMeta.equipment[slot] = null; accountMeta.warehouse[equipName] = (accountMeta.warehouse[equipName] || 0) + 1;
    }
    resetCurrentRunData(); uploadProgressToCloud(); updateUI(); if(currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}
