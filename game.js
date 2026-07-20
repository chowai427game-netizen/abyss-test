// ==========================================================================
// 🕹️ game.js：真・ATB 運算、智慧自動戰鬥 AI、進階乘算傷害、QTE 判定鏈接 (修正優化版)
// ==========================================================================

let combatTickerTimer = null; 
let combatRoundCounter = 1;    

let playerAtb = 0;
let monsterAtb = 0;
let envAtb = 0;
let battleTimeElapsed = 0;
let isQteActive = false;
let activeTactic = "MANUAL"; // 預設戰術

// ==========================================================================
// 🧮 經典乘算傷害與隨機浮動計算引擎
// ==========================================================================
function calculateDamage(atk, defense, isPlayerAttacking = true) {
    let k = isPlayerAttacking ? 50 : 35; 
    let reduction = defense / (defense + k);
    let baseDmg = atk * (1 - reduction);
    
    let variance = 0.9 + Math.random() * 0.2;
    let finalDmg = Math.max(1, Math.floor(baseDmg * variance));
    
    let isCrit = false;
    if (isPlayerAttacking && Math.random() * 100 < currentRun.critChance) {
        isCrit = true;
        finalDmg = Math.floor(finalDmg * 1.5);
    }
    
    return { damage: finalDmg, isCrit: isCrit };
}

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
    
    loadGameData(inputName);
    
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

function handleRerunAction() {
    try {
        clearInterval(combatTickerTimer);
        addLog(`🔄【重巡整備】你留在深淵 B${dungeonFloor}F 進行重巡狩獵，戰局重新載入！`, "perfect");
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
        isQteActive = false;
        document.getElementById('qte-overlay').style.display = 'none';
    }
    
    addLog(`🏃【撤退】你驚險逃回地表村莊！等級與裝備完美保留，素材已安全歸倉！`, "perfect");
    
    if (currentRun.inventory) {
        currentRun.inventory.forEach(item => {
            if(typeof MONSTER_DROPS !== "undefined" && (MONSTER_DROPS[item] || Object.values(MONSTER_DROPS).includes(item) || item.includes("未知物體"))) {
                accountMeta.warehouse[item] = (accountMeta.warehouse[item] || 0) + 1;
            }
        });
    }
    
    saveGameData(); 
    resetCurrentRunData();
    updateUI();
    switchVillageLocation("GATE");
}

function tryEquipItemToBag(itemName) {
    if (!currentRun.inventory) currentRun.inventory = [];
    
    if (currentRun.inventory.length >= MAX_BAG_SIZE) { 
        alert(`🎒 戰術背包已滿（容量上限：${MAX_BAG_SIZE} 格）！請先卸下或使用現有道具。`); 
        return; 
    }
    
    if (!accountMeta.warehouse[itemName] || accountMeta.warehouse[itemName] <= 0) {
        alert("倉庫內無此道具庫存！");
        return;
    }
    
    accountMeta.warehouse[itemName]--;
    currentRun.inventory.push(itemName);
    
    addLog(`🎒 已將 <strong>${itemName}</strong> 裝入戰術快捷欄。`);
    saveGameData();
    updateUI();
    
    if (typeof currentVillageLocation !== "undefined" && currentVillageLocation === "KITCHEN") {
        if (typeof renderVillageCookingWorkshop === "function") renderVillageCookingWorkshop();
    }
}

function removeBagItem(index) {
    if (!currentRun.inventory || index < 0 || index >= currentRun.inventory.length) return;
    
    const itemName = currentRun.inventory.splice(index, 1)[0];
    accountMeta.warehouse[itemName] = (accountMeta.warehouse[itemName] || 0) + 1;
    
    addLog(`📦 已將 <strong>${itemName}</strong> 放回倉庫。`);
    saveGameData();
    updateUI();
}

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

function executeAutoBattleAiTurn() {
    if (activeTactic === "MANUAL") {
        return false; 
    }

    let hpRatio = currentRun.hp / currentRun.maxHp;

    if (activeTactic === "BALANCED") {
        if (hpRatio < 0.35 && currentRun.inventory.length > 0) {
            let mealIndex = currentRun.inventory.findIndex(item => item.includes("厚牛巨堡"));
            if (mealIndex !== -1) {
                executeUseDungeonItem(currentRun.inventory[mealIndex], mealIndex);
                return true; 
            }
        }

        let healSkill = null;
        if (currentRun.skills["治癒術"] && currentRun.mp >= 20) healSkill = "治癒術";
        else if (currentRun.skills["緊急治療"] && currentRun.mp >= 15) healSkill = "緊急治療";

        if (hpRatio < 0.60 && healSkill && typeof SKILLS_DATABASE !== "undefined") {
            let sMeta = SKILLS_DATABASE[currentRun.job]?.find(s => s.name === healSkill);
            if (sMeta) {
                currentRun.mp -= sMeta.mp;
                let eff = sMeta.run(currentRun.skills[healSkill], currentRun.atk, currentRun.maxMp, currentRun.hp);
                let h = Math.floor(eff.lostHp * eff.healPercent); 
                currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + h);
                addLog(`🩹⚖️【均衡自癒】引導【${healSkill}】！<span class="heal-effect">[${accountMeta.name}]</span> <span class="num-popup num-h-heal">+${h} HP</span>`, "perfect");
                return true;
            }
        }

        let mpRatio = currentRun.mp / currentRun.maxMp;
        if (mpRatio > 0.30 && typeof SKILLS_DATABASE !== "undefined") {
            let activeSkills = SKILLS_DATABASE[currentRun.job]?.filter(s => s.type === "active" && currentRun.skills[s.name] && s.name !== "治癒術" && s.name !== "緊急治療" && s.name !== "天使之淚") || [];
            activeSkills.sort((a, b) => b.mp - a.mp); 

            for (let sMeta of activeSkills) {
                if (currentRun.mp >= sMeta.mp) {
                    currentRun.mp -= sMeta.mp;
                    let monsterDef = Math.floor(dungeonFloor * 1.2);
                    let rawAtk = currentRun.atk * 1.5;
                    let dmgRes = calculateDamage(rawAtk, monsterDef, true);
                    activeMonster.hp -= dmgRes.damage;

                    let numClass = currentRun.job === "magician" ? "num-m-dmg" : "num-p-dmg";
                    let critText = dmgRes.isCrit ? "⚡ 暴擊！" : "";
                    
                    addLog(`🔮⚖️【均衡戰術突擊】施展【${sMeta.name}】！`);
                    addLog(`💥 ${critText}<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${dmgRes.damage} HP</span>`, "perfect");
                    return true;
                }
            }
        }
        return false; 
    }

    if (activeTactic === "OFFENSIVE" && typeof SKILLS_DATABASE !== "undefined") {
        let activeSkills = SKILLS_DATABASE[currentRun.job]?.filter(s => s.type === "active" && currentRun.skills[s.name] && s.name !== "治癒術" && s.name !== "緊急治療" && s.name !== "天使之淚") || [];
        activeSkills.sort((a, b) => b.mp - a.mp);

        for (let sMeta of activeSkills) {
            if (currentRun.mp >= sMeta.mp) {
                currentRun.mp -= sMeta.mp;
                let monsterDef = Math.floor(dungeonFloor * 1.2);
                let rawAtk = currentRun.atk * 1.8; 
                let dmgRes = calculateDamage(rawAtk, monsterDef, true);
                activeMonster.hp -= dmgRes.damage;

                let numClass = currentRun.job === "magician" ? "num-m-dmg" : "num-p-dmg";
                let critText = dmgRes.isCrit ? "⚡ 暴擊！" : "";
                
                addLog(`🔥⚔️【狂暴連鎖轟炸】暴烈吟唱【${sMeta.name}】！`);
                addLog(`💥 ${critText}<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${dmgRes.damage} HP</span>`, "take");
                return true;
            }
        }
        return false; 
    }

    return false;
}

function triggerVillageQte(type, targetData, successCallback) {
    const overlay = document.getElementById('qte-overlay');
    const title = document.getElementById('qte-skill-name');
    const tapBtn = document.getElementById('qte-tap-btn');
    const qteFill = document.getElementById('qte-timer-fill');

    if (!overlay || !title || !tapBtn || !qteFill) return;

    overlay.style.display = "flex";
    isQteActive = true;

    document.body.style.overflow = "hidden";

    if (type === "COOK") {
        title.innerHTML = `🍳 正在熬製：<strong>${targetData.name}</strong> 🍳<br><span style="font-size: 11px; color: #8e8e93;">🎯 完美敲擊區間：[65% - 85%]</span>`;
    } else {
        title.innerHTML = `🔨 正在熔練：<strong>${targetData.name}</strong> 🔨<br><span style="font-size: 11px; color: #8e8e93;">🎯 完美錘擊區間：[65% - 85%]</span>`;
    }

    let progress = 0;
    qteFill.style.width = "0%";
    tapBtn.innerText = "🎯 點擊判定 (0%)";

    let step = 2.4; 
    let qteInterval = setInterval(() => {
        if (!isQteActive) {
            clearInterval(qteInterval);
            return;
        }
        progress += step;
        if (progress >= 100) {
            clearInterval(qteInterval);
            resolveQteResult("MISS");
        } else {
            qteFill.style.width = progress + "%";
            tapBtn.innerText = `🎯 點擊判定 (${Math.floor(progress)}%)`;
        }
    }, 25);

    function resolveQteResult(rating) {
        isQteActive = false;
        overlay.style.display = "none";
        document.body.style.overflow = ""; 
        successCallback(rating);
    }

    tapBtn.onclick = () => {
        if (!isQteActive) return;
        clearInterval(qteInterval);
        let rating = "MISS";
        if (progress >= 65 && progress <= 85) {
            rating = "PERFECT";
        } else if (progress >= 40 && progress <= 95) {
            rating = "GOOD";
        }
        resolveQteResult(rating);
    };
}

function executeVillageCooking(recipe) {
    for(let ing in recipe.ingredients) { accountMeta.warehouse[ing] -= recipe.ingredients[ing]; }
    
    triggerVillageQte("COOK", recipe, (rating) => {
        if (rating === "PERFECT") {
            addLog(`🍳👑【皇家廚神・大成功】雙倍成品！獲得 <strong>${recipe.name} x2</strong>！`, "perfect");
            if (recipe.type === "village_eat") {
                addLog(`🍴【完美開局進食】香氣撲鼻！神級 Buff 效果加強 1.5 倍！`, "perfect");
                currentRun.activeVillageBuffs.push(recipe.name);
                if(recipe.name.includes("哥布林")) { currentRun.maxHp += 100; currentRun.hp += 100; }
                if(recipe.name.includes("發光奧術")) { currentRun.maxMp += 50; currentRun.mpRegen += 5; }
                if(recipe.name.includes("銀河蟹肉")) { currentRun.maxHp += 300; currentRun.hp += 300; }
            } else {
                accountMeta.warehouse[recipe.name] = (accountMeta.warehouse[recipe.name] || 0) + 2;
            }
        } 
        else if (rating === "GOOD") {
            addLog(`🍳【料理烹飪成功】獲得 <strong>${recipe.name} (x1)</strong>！`, "perfect");
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
        else {
            addLog(`💥【料理大失敗】湯汁溢出熔毀，化為：<strong>🪨 焦黑的未知物體</strong>！`, "take");
            accountMeta.warehouse["🪨 焦黑的未知物體"] = (accountMeta.warehouse["🪨 焦黑的未知物體"] || 0) + 1;
        }
        saveGameData(); updateUI(); renderVillageCookingWorkshop();
    });
}

function executeForgeEquipment(blueprint) {
    for(let ing in blueprint.ingredients) { accountMeta.warehouse[ing] -= blueprint.ingredients[ing]; }
    
    triggerVillageQte("FORGE", blueprint, (rating) => {
        if (rating === "PERFECT") {
            addLog(`🔨🌟【神匠顯靈・完美大成功】精工鑄造神裝：<strong>${blueprint.name}</strong>！`, "perfect");
            accountMeta.warehouse[blueprint.name] = (accountMeta.warehouse[blueprint.name] || 0) + 1;
            
            let keys = Object.keys(blueprint.ingredients);
            let luckyRefund = keys[Math.floor(Math.random() * keys.length)];
            accountMeta.warehouse[luckyRefund] = (accountMeta.warehouse[luckyRefund] || 0) + 1;
            addLog(`🎁【神匠回饋】大成功使核心材料獲得保溫返還：<strong>${luckyRefund} x1</strong>！`, "perfect");
        } 
        else if (rating === "GOOD") {
            addLog(`🛠️【鍛造成功】成功鑄造神裝：<strong>${blueprint.name}</strong>！`, "perfect");
            accountMeta.warehouse[blueprint.name] = (accountMeta.warehouse[blueprint.name] || 0) + 1;
        } 
        else {
            addLog(`🚨【鍛造失敗】爐火熄滅，淬火爆裂，化為一堆廢鐵：<strong>🪨 焦黑的未知物體</strong>！`, "take");
            accountMeta.warehouse["🪨 焦黑的未知物體"] = (accountMeta.warehouse["🪨 焦黑的未知物體"] || 0) + 1;
        }
        saveGameData(); updateUI(); if(currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
    });
}

function getStarUpCost(slot, currentStar) {
    let nextStar = currentStar + 1;
    if (slot === "weapon") {
        return { "獸人後腿肉": nextStar * 2, "史萊姆黏液": nextStar };
    } else if (slot === "armor") {
        return { "巨石苔蘚": nextStar * 2, "哥布林香料": nextStar };
    } else { 
        return { "怨靈淚晶": nextStar * 2, "祭司血清": nextStar };
    }
}

function executeSlotStarUp(slot) {
    let currentStar = accountMeta.equipmentStars[slot];
    if (currentStar >= 5) return;
    let cost = getStarUpCost(slot, currentStar);
    
    for (let ing in cost) {
        accountMeta.warehouse[ing] -= cost[ing];
    }
    
    accountMeta.equipmentStars[slot]++;
    addLog(`🌟【槽位精煉成功】你的 <strong>[${slot === 'weapon' ? '武器' : slot === 'armor' ? '防具' : '飾品'}]</strong> 部位升星至 ⭐ x${accountMeta.equipmentStars[slot]}！`, "perfect");
    
    resetCurrentRunData();
    saveGameData();
    updateUI();
    if(currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

function executeDismantle(equipName) {
    let b = CRAFTING_BLUEPRINTS.find(x => x.name === equipName);
    if (!b) return;
    
    accountMeta.warehouse[equipName]--;
    
    let refunded = [];
    for (let ing in b.ingredients) {
        let refundQty = Math.ceil(b.ingredients[ing] * 0.5);
        accountMeta.warehouse[ing] = (accountMeta.warehouse[ing] || 0) + refundQty;
        refunded.push(`${ing} x${refundQty}`);
    }
    
    addLog(`♻️【拆解回收】你成功拆解了 [${equipName}]，獲得回收原料 ➔ ${refunded.join(", ")}。`, "perfect");
    saveGameData();
    updateUI();
    if(currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
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
            let bossMeta = (typeof BOSS_DATABASE !== "undefined" && BOSS_DATABASE[dungeonFloor]) || { name: `👹 深淵無名魔皇`, baseHp: dungeonFloor * 40, baseAtk: dungeonFloor * 3, baseSpd: 20, dropItem: "史萊姆黏液" };
            activeMonster = { name: bossMeta.name, hp: bossMeta.baseHp, maxHp: bossMeta.baseHp, atk: bossMeta.baseAtk, spd: bossMeta.baseSpd, freezeTurns: 0, isSkipped: false, isBoss: true, fixedDrop: bossMeta.dropItem };
            addLog(`🚨迫近🌋【領主降臨 B${dungeonFloor}F】發現大領主：<strong>${activeMonster.name}</strong>！`, "take");
        } else {
            let availableMonsters = (typeof REGULAR_MONSTERS_POOL !== "undefined") ? REGULAR_MONSTERS_POOL.filter(m => dungeonFloor >= m.minFloor && dungeonFloor <= m.maxFloor) : [];
            if (availableMonsters.length === 0 && typeof REGULAR_MONSTERS_POOL !== "undefined") availableMonsters = REGULAR_MONSTERS_POOL;
            
            let rollSeed = availableMonsters[Math.floor(Math.random() * availableMonsters.length)] || { name: "史萊姆", baseHp: 30, hpScale: 10, baseAtk: 5, atkScale: 2, baseSpd: 15 };
            let scaledHp = Math.floor(rollSeed.baseHp + dungeonFloor * rollSeed.hpScale);
            let scaledAtk = Math.floor(rollSeed.baseAtk + dungeonFloor * rollSeed.atkScale);
            
            let finalSpd = rollSeed.baseSpd;
            if (dungeonFloor <= 3) {
                finalSpd = Math.max(10, Math.floor(finalSpd * 0.65));
                scaledHp = Math.max(20, Math.floor(scaledHp * 0.75));
                scaledAtk = Math.max(3, Math.floor(scaledAtk * 0.7));
            }
            
            activeMonster = { name: rollSeed.name, hp: scaledHp, maxHp: scaledHp, atk: scaledAtk, spd: finalSpd, freezeTurns: 0, isSkipped: false, isBoss: false };
            addLog(`⚔️【降臨 B${dungeonFloor}F】發現魔物：<strong>${activeMonster.name}</strong>`);
            
            if (dungeonFloor === 1) {
                addLog("💡【勇者生存提示】：若戰局不妙，請果斷點擊「⛺ 逃回村莊」，這能安全帶回你快捷背包中的所有珍貴素材！", "perfect");
            }
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

    if (activeTactic !== "MANUAL") {
        activeTriggered = executeAutoBattleAiTurn();
    } else if (typeof SKILLS_DATABASE !== "undefined") {
        for (let sName of Object.keys(currentRun.skills)) {
            let sMeta = SKILLS_DATABASE[currentRun.job]?.find(s => s.name === sName);
            if (sMeta && sMeta.type === "active" && currentRun.mp >= sMeta.mp && Math.random() < 0.40) {
                addLog(`🔮 引導【${sName}】`); activeTriggered = true;
                let isPerfect = (Math.random() < 0.75);
                let numClass = currentRun.job === "magician" ? "num-m-dmg" : "num-p-dmg";
                if (isPerfect) {
                    currentRun.mp -= sMeta.mp; 
                    let eff = sMeta.run(currentRun.skills[sName], currentRun.atk, currentRun.maxMp, currentRun.hp);
                    
                    if (eff.dmg) { 
                        let monsterDef = Math.floor(dungeonFloor * 1.2);
                        let dmgRes = calculateDamage(eff.dmg, monsterDef, true);
                        activeMonster.hp -= dmgRes.damage; 
                        
                        let critText = dmgRes.isCrit ? "⚡ 暴擊！" : "";
                        addLog(`💥 核心技！${critText}<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${dmgRes.damage} HP</span>`, "perfect"); 
                    }
                    if (eff.healPercent) {
                        let h = Math.floor(eff.lostHp * eff.healPercent); currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + h);
                        addLog(`🩹 神聖洗禮！<span class="heal-effect">[${accountMeta.name}]</span> <span class="num-popup num-h-heal">+${h} HP</span>`, "perfect");
                    }
                } else {
                    let monsterDef = Math.floor(dungeonFloor * 1.2);
                    let dmgRes = calculateDamage(currentRun.atk, monsterDef, true);
                    activeMonster.hp -= dmgRes.damage; 
                    
                    let critText = dmgRes.isCrit ? "⚡ 暴擊！" : "";
                    addLog(`⚔️ 普攻突刺！${critText}<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${dmgRes.damage} HP</span>`, "deal");
                }
                break;
            }
        }
    }

    if (!activeTriggered) { 
        let monsterDef = Math.floor(dungeonFloor * 1.2);
        let dmgRes = calculateDamage(currentRun.atk, monsterDef, true);
        activeMonster.hp -= dmgRes.damage; 
        
        let numClass = currentRun.job === "magician" ? "num-m-dmg" : "num-p-dmg";
        let critText = dmgRes.isCrit ? "⚡ 暴擊！" : "";
        addLog(`⚔️ 揮砍！${critText}<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${dmgRes.damage} HP</span>`, "deal"); 
    }
    
    if (currentRun.vampRate > 0 && currentRun.hp > 0 && activeMonster.hp > 0) {
        let vAmt = Math.floor(currentRun.atk * (currentRun.vampRate / 100));
        if (vAmt > 0) { currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + vAmt); addLog(`🩸【血脈吸吮】吸血 <span class="num-popup num-h-heal">+${vAmt} HP</span>`); }
    }
    if (currentRun.doubleStrike > 0 && Math.random() * 100 < currentRun.doubleStrike && activeMonster.hp > 0) {
        let monsterDef = Math.floor(dungeonFloor * 1.2);
        let extraAtk = Math.floor(currentRun.atk * 0.85);
        let dmgRes = calculateDamage(extraAtk, monsterDef, true);
        activeMonster.hp -= dmgRes.damage;
        
        let critText = dmgRes.isCrit ? "⚡ 暴擊！" : "";
        addLog(`⚡【殘影追擊】極速連砍！${critText}追加受創 <span class="num-popup num-p-dmg">-${dmgRes.damage} HP</span>`, "deal");
    }
    if (activeMonster.hp <= 0) { clearInterval(combatTickerTimer); executeDungeonVictorySequence(); }
}

function executeMonsterActionTick() {
    if (activeMonster.freezeTurns > 0) { activeMonster.freezeTurns--; return; }
    
    let dmgRes = calculateDamage(activeMonster.atk, currentRun.block, false);
    let finalDmg = dmgRes.damage;
    
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
            let dropName = (typeof MONSTER_DROPS !== "undefined" && MONSTER_DROPS[activeMonster.name]) || "史萊姆黏液";
            if (currentRun.inventory.length < MAX_BAG_SIZE) { 
                currentRun.inventory.push(dropName); 
                addLog(`🎁 獲得素材：<strong>${dropName}</strong>！`, "perfect"); 
            }
        }
        activeMonster = null; 
        addExperience(15);
    }
}

function dismissBossVictoryCinematic() {
    const bOverlay = document.getElementById('boss-victory-overlay');
    if (!bOverlay || bOverlay.style.display === "none") return;
    bOverlay.style.display = "none"; activeMonster = null; gameState = "REWARD"; updateUI(); triggerBossTalentReward();
}

function executeDungeonDefeatSequence() {
    addLog(`☠️【魂歸深淵】你已被擊敗！本輪未結算之當前 EXP 清零，但等級、配點與裝備完好無損。`, "take");
    
    accountMeta.exp = 0;
    currentRun.exp = 0;
    
    gameState = "VILLAGE"; 
    currentEnvironment = "NORMAL";
    
    let btnSecondary = document.getElementById('btn-secondary-action');
    if (btnSecondary) btnSecondary.style.display = "none";
    
    resetCurrentRunData(); 
    currentRun.hp = currentRun.maxHp;
    currentRun.mp = currentRun.maxMp;
    
    saveGameData(); 
    updateUI(); 
    if (typeof switchVillageLocation === "function") {
        switchVillageLocation("GATE");
    }
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
        btn.onclick = () => { perk.run(); gameState = "BATTLE"; document.getElementById('btn-main-action').disabled = false; saveGameData(); updateUI(); checkLevelUpAndTriggerSelect(); };
        container.appendChild(btn);
    });
}

function addExperience(amount) {
    accountMeta.exp = (accountMeta.exp || 0) + amount;
    currentRun.exp = accountMeta.exp;
    addLog(`✨ 獲得經驗值 +${amount}`, "gain");
    checkLevelUpAndTriggerSelect();
}

function checkLevelUpAndTriggerSelect() {
    let leveledUp = false;
    
    while (accountMeta.exp >= accountMeta.nextExp) {
        accountMeta.exp -= accountMeta.nextExp;
        accountMeta.lv = (accountMeta.lv || 1) + 1;
        accountMeta.statPoints = (accountMeta.statPoints || 0) + 1; 
        
        accountMeta.nextExp = Math.floor(accountMeta.nextExp * 1.4);
        leveledUp = true;
    }
    
    if (leveledUp) { 
        currentRun.lv = accountMeta.lv;
        currentRun.exp = accountMeta.exp;
        currentRun.nextExp = accountMeta.nextExp;
        
        resetCurrentRunData();
        currentRun.hp = currentRun.maxHp;
        currentRun.mp = currentRun.maxMp;
        
        addLog(`👑 突破至 <strong>Lv.${accountMeta.lv}</strong>！獲得 1 點自由能力值！`, "perfect"); 
        saveGameData(); 
    }
    
    if (gameState === "BATTLE") { 
        let btnMain = document.getElementById('btn-main-action');
        if (btnMain) btnMain.disabled = false; 
    }
    updateUI();
}

function triggerRandomAbyssEvent() {
    const container = document.getElementById('reward-choices-container');
    const title = document.getElementById('reward-title-text');
    if (!container || !title) return; 
    container.innerHTML = "";
    
    let isChestEvent = Math.random() < 0.5;

    if (!isChestEvent && typeof ABYSS_EVENTS_DATABASE !== "undefined" && ABYSS_EVENTS_DATABASE.length > 0) {
        let randomEvent = ABYSS_EVENTS_DATABASE[Math.floor(Math.random() * ABYSS_EVENTS_DATABASE.length)];
        title.innerHTML = randomEvent.title;
        
        let descP = document.createElement('p');
        descP.style.fontSize = "12px";
        descP.style.color = "#babcbf";
        descP.style.lineHeight = "1.6";
        descP.style.marginBottom = "15px";
        descP.innerHTML = randomEvent.desc;
        container.appendChild(descP);

        randomEvent.choices.forEach(choice => {
            let btn = document.createElement('button');
            btn.className = "btn-game btn-cook";
            btn.style.width = "100%";
            btn.style.marginBottom = "8px";
            btn.style.fontSize = "11px";
            btn.innerHTML = choice.text;
            btn.onclick = () => {
                let resultLog = choice.run(currentRun, accountMeta);
                addLog(resultLog, "perfect");
                resolveAbyssEvent();
            };
            container.appendChild(btn);
        });
    } 
    else if (typeof TREASURE_CHESTS_POOL !== "undefined" && TREASURE_CHESTS_POOL.length > 0) {
        let rolledChest = TREASURE_CHESTS_POOL[Math.floor(Math.random() * TREASURE_CHESTS_POOL.length)];
        title.innerHTML = `🎁 發現古老遺蹟：[${rolledChest.name}] 🎁`;

        let descP = document.createElement('p');
        descP.style.fontSize = "12px";
        descP.style.color = "#babcbf";
        descP.style.lineHeight = "1.6";
        descP.style.marginBottom = "15px";
        descP.innerHTML = `地面上靜靜躺著一個【${rolledChest.name}】。你可以選擇強行砸開鎖扣，或者小心地引導魔力拆解。`;
        container.appendChild(descP);

        let btnOpen = document.createElement('button');
        btnOpen.className = "btn-game btn-explore";
        btnOpen.style.width = "100%";
        btnOpen.innerHTML = `🔑 砸開寶箱鎖扣`;
        btnOpen.onclick = () => {
            let rolledGold = Math.floor(Math.random() * (rolledChest.maxGold - rolledChest.minGold + 1)) + rolledChest.minGold;
            currentRun.gold += rolledGold;
            addLog(`🪙 獲得臨時金幣 +${rolledGold} G！`);
            addLog(`📢 箱內迴響：${rolledChest.msg}`, rolledChest.isTrap ? "take" : "perfect");

            if (rolledChest.isTrap && rolledChest.dmg) {
                currentRun.hp = Math.max(1, currentRun.hp - rolledChest.dmg);
            }

            if (Math.random() < 0.25 && typeof MONSTER_DROPS !== "undefined") {
                let activeDrops = Object.values(MONSTER_DROPS);
                let randDrop = activeDrops[Math.floor(Math.random() * activeDrops.length)];
                accountMeta.warehouse[randDrop] = (accountMeta.warehouse[randDrop] || 0) + 1;
                addLog(`🎁 箱底夾層傳送出永久素材 ➔ <strong>${randDrop} (x1)</strong>！`, "perfect");
            }

            resolveAbyssEvent();
        };
        container.appendChild(btnOpen);
    } else {
        resolveAbyssEvent();
    }
    updateUI();
}

function resolveAbyssEvent() { gameState = "ENCOUNTER_RESOLVED"; document.getElementById('btn-main-action').disabled = false; updateUI(); runDungeonLoop(); }

function executeEquipAction(equipName, actionType) {
    let blueprint = CRAFTING_BLUEPRINTS.find(b => b.name === equipName); if (!blueprint) return;
    let slot = blueprint.type;
    if (actionType === "equip") {
        if (accountMeta.equipment[slot]) { let old = accountMeta.equipment[slot]; accountMeta.warehouse[old] = (accountMeta.warehouse[old] || 0) + 1; }
        accountMeta.warehouse[equipName]--; accountMeta.equipment[slot] = equipName;
    } else {
        accountMeta.equipment[slot] = null; accountMeta.warehouse[equipName] = (accountMeta.warehouse[equipName] || 0) + 1;
    }
    resetCurrentRunData(); saveGameData(); updateUI(); if(currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

function toggleTacticsDrawer() {
    const drawer = document.getElementById('tactics-drawer-box');
    const triggerBtn = document.getElementById('tactic-trigger-btn');
    if (!drawer) return;

    drawer.classList.toggle('expanded');
    
    const triggerTxt = triggerBtn.querySelector('.trigger-text');
    if (drawer.classList.contains('expanded')) {
        if (triggerTxt) triggerTxt.innerText = "關閉指令";
    } else {
        if (triggerTxt) triggerTxt.innerText = "戰術指令";
    }
}

function selectTactic(tacticType) {
    activeTactic = tacticType;
    syncTacticButtonsUi();
    
    let tacticChinese = "";
    let logStyle = "perfect";
    if (tacticType === "MANUAL") {
        tacticChinese = "【🎮 手動看戲】";
        logStyle = "deal";
    } else if (tacticType === "BALANCED") {
        tacticChinese = "【⚖️ 均衡防守】";
    } else if (tacticType === "OFFENSIVE") {
        tacticChinese = "【⚔️ 狂暴強擊】";
        logStyle = "take";
    }
    
    addLog(`📢 <b>【戰術變陣】</b>勇者身形一閃，陣腳轉變為 ➔ <span style="color: var(--gold-glow); font-weight:bold;">${tacticChinese}</span>`, logStyle);
}

function syncTacticButtonsUi() {
    const types = ["MANUAL", "BALANCED", "OFFENSIVE"];
    types.forEach(type => {
        const btn = document.getElementById(`tactic-btn-${type}`);
        if (btn) {
            if (type === activeTactic) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}
