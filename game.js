// ==========================================================================
// 🕹️ 命運深淵：核心玩法控制、QTE 調配、與領主 Boss 戰鬥主循環
// ==========================================================================

function handleToggleAuto(checkbox) {
    isAutoBattleMode = checkbox.checked;
    addLog(isAutoBattleMode ? "🤖 <b>【指令託管】自動戰鬥已開啟，系統將自動判定環境抗性。</b>" : "🎮 <b>【手動介入】自動戰鬥已關閉，環境力場考驗個人手速。</b>");
}

function handleStartGame() {
    let inputName = document.getElementById('player-name-input').value.trim();
    accountMeta.name = inputName || "gma";
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

function handleSecondaryAction() {
    gameState = "VILLAGE";
    currentEnvironment = "NORMAL";
    document.getElementById('btn-secondary-action').style.display = "none";
    if (isQteActive) {
        clearTimeout(qteTimer);
        isQteActive = false;
        document.getElementById('qte-overlay').style.display = 'none';
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

function executeUseDungeonItem(itemName, index) {
    if (gameState !== "BATTLE" || !activeMonster) return;
    addLog(`⚡🎒【快捷物資】勇者果斷捏碎消耗品 ➔ <strong>${itemName}</strong>！`, "deal");
    if (itemName.includes("未知物體")) {
        let dmg = currentEnvironment === "POISON" ? 30 : 15;
        currentRun.hp = Math.max(1, currentRun.hp - dmg);
        currentRun.qteBuffDuration = currentEnvironment === "POISON" ? 800 : 500; 
        currentRun.qteBuffTurns = 3;      
        addLog(`🪨 焦黑物體反噬扣血！但神經受到特大刺激，QTE 判定時間大幅延長！`, "take");
    } else if (itemName.includes("厚牛巨堡")) {
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 100);
        playerShield += 80;
        addLog(`🌭 大快活熱量充能！血量回復 +100 HP，生成 80 點物理防盾！`, "perfect");
    } else if (itemName.includes("永凍刨冰")) {
        let fTurns = currentEnvironment === "ICE" ? 4 : 2;
        activeMonster.freezeTurns = fTurns;
        addLog(`❄️ 寒氣狂飆！魔物被凍結 ${fTurns} 回合，無法反擊與再生！`, "perfect");
    } else if (itemName.includes("禁忌血釀")) {
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

function triggerQteSystem(skillName, durationMs) {
    return new Promise((resolve) => {
        let baseDuration = durationMs;
        if (currentEnvironment === "VOID" && !currentRun.skills["霸體"]) baseDuration = Math.max(600, durationMs - 400);
        if (isAutoBattleMode) { setTimeout(() => { resolve(Math.random() < 0.75); }, 150); return; }
        isQteActive = true; qteResolvePointer = resolve;
        let finalDuration = baseDuration + (currentRun.qteBuffDuration || 0);
        document.getElementById('qte-skill-name').innerText = `⚡ QTE 詠唱中：${skillName} ⚡`;
        document.getElementById('qte-overlay').style.display = 'flex';
        let timerFill = document.getElementById('qte-timer-fill');
        timerFill.style.width = '100%'; timerFill.style.transition = `width ${finalDuration}ms linear`;
        setTimeout(() => { if(timerFill) timerFill.style.width = '0%'; }, 10);
        qteTimer = setTimeout(() => endQte(false), finalDuration);
    });
}

function handleQteTap() { if (!isQteActive) return; clearTimeout(qteTimer); endQte(true); }

function endQte(isSuccess) {
    isQteActive = false; document.getElementById('qte-overlay').style.display = 'none';
    const shell = document.getElementById('main-game-shell');
    let flash = isSuccess ? 'success-flash' : 'fail-flash';
    shell.classList.add('shake-effect', flash);
    setTimeout(() => shell.classList.remove('shake-effect', flash), 150);
    if (qteResolvePointer) qteResolvePointer(isSuccess);
}

// ==========================================
// ⚔️ 升級版：回合制領主戰鬥主循環
// ==========================================
async function runDungeonLoop() {
    try {
        document.getElementById('btn-main-action').disabled = true;
        
        // 1. 滾動環境異變
        currentEnvironment = (dungeonFloor > 1 && Math.random() < 0.35) ? ["FIRE", "ICE", "POISON", "VOID"][Math.floor(Math.random() * 4)] : "NORMAL";
        
        // 💡 2. 核心領主攔截機制：檢查是否為 10 層整數倍 Boss 層
        let isBossFloor = (dungeonFloor % 10 === 0 && dungeonFloor > 0);
        
        if (isBossFloor) {
            let bossMeta = BOSS_DATABASE[dungeonFloor] || { name: `🚨 隱藏古領主 B${dungeonFloor}F`, hp: 1500, atk: 90, drop: "🦀 帝王蟹巨腿" };
            activeMonster = { 
                name: bossMeta.name, 
                hp: bossMeta.hp, 
                maxHp: bossMeta.hp, 
                atk: bossMeta.atk, 
                freezeTurns: 0, 
                isSkipped: false,
                isBoss: true,             // 標記為 Boss
                guaranteedDrop: bossMeta.drop // 必掉稀有食材
            };
            addLog(`🌋【領主降臨 B${dungeonFloor}F】警報！遭遇守層魔王：<strong style="color:#ff4757; text-shadow:0 0 8px #ff4757;">${activeMonster.name}</strong>！！`, "take");
        } else {
            // 普通層：隨機抽小怪
            let mKeys = Object.keys(MONSTER_DROPS);
            let mName = mKeys[Math.floor(Math.random() * mKeys.length)];
            activeMonster = { 
                name: mName, 
                hp: 40 + dungeonFloor * 15, 
                maxHp: 40 + dungeonFloor * 15, 
                atk: 4 + dungeonFloor * 3, 
                freezeTurns: 0, 
                isSkipped: false,
                isBoss: false
            };
            addLog(`⚔️【降臨 B${dungeonFloor}F】發現魔物：<strong>${activeMonster.name}</strong>`);
        }
        
        updateUI();
        
        if (currentRun.job === "magician" && currentRun.skills["能量外套"]) { playerShield += 250 * currentRun.skills["能量外套"]; addLog(`🟢【被動•能量外套】奧術防護盾啟動 🛡️ +${playerShield}`); }
        if (currentRun.skills["天使之護"]) { currentRun.block += 4 * currentRun.skills["天使之護"]; }

        let round = 1;
        while (currentRun.hp > 0 && activeMonster.hp > 0) {
            if (gameState !== "BATTLE") return;
            addLog(`<span style="color:#888;">[第 ${round} 回合]</span>`);
            if (currentRun.qteBuffTurns > 0 && --currentRun.qteBuffTurns === 0) { currentRun.qteBuffDuration = 0; addLog(`ℹ️ 興奮劑藥效宣告結束。`); }
            
            if (playerStatusEffects.burn > 0) { currentRun.hp = Math.max(1, currentRun.hp - playerStatusEffects.burn * 3); addLog(`🔥【異常燃燒】受到火傷。`, "env"); }
            if (playerStatusEffects.poison > 0) { let pDmg = Math.floor(currentRun.maxHp * 0.06 * playerStatusEffects.poison); currentRun.hp = Math.max(1, currentRun.hp - pDmg); addLog(`🧪【異常劇毒】受到毒傷。`, "env"); }
            
            currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + currentRun.mpRegen); updateUI();
            
            if (currentRun.skills["快速回復"]) {
                let hAmt = Math.floor(currentRun.maxHp * 0.08 * currentRun.skills["快速回復"]);
                if (currentEnvironment === "ICE" && !currentRun.activeVillageBuffs.includes("🍲 皇家銀河蟹肉宴")) { hAmt = Math.floor(hAmt * 0.4); addLog(`❄️【冰原禁制】被動回復力受到壓制！`, "env"); }
                currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + hAmt); addLog(`🟢【開局被動】細胞自動修復 +${hAmt} HP。`);
            }

            let activeTriggered = false;
            for (let sName of Object.keys(currentRun.skills)) {
                let sMeta = SKILLS_DATABASE[currentRun.job]?.find(s => s.name === sName);
                if (sMeta && sMeta.type === "active" && currentRun.mp >= sMeta.mp && Math.random() < 0.40) {
                    addLog(`🔮 魔力大激盪 ➔ 引導【${sName} Lv.${currentRun.skills[sName]}】`); activeTriggered = true;
                    let isPerfect = await triggerQteSystem(sName, 1200);
                    if (gameState !== "BATTLE") return;
                    if (currentEnvironment === "POISON") { playerStatusEffects.poison++; addLog(`🧪【沼澤毒化】引導魔法深度感染！`, "env"); }
                    if (isPerfect) {
                        currentRun.mp -= sMeta.mp; let eff = sMeta.run(currentRun.skills[sName], currentRun.atk, currentRun.maxMp, currentRun.hp);
                        if (sName === "火箭術" && currentEnvironment === "FIRE") { eff.baseFire = Math.floor(eff.baseFire * 1.5); addLog(`🌋【力場共鳴】火箭術爆發 1.5 倍！`, "deal"); }
                        if (eff.dmg) { activeMonster.hp -= eff.dmg; addLog(`💥【完美釋放】造成 -${eff.dmg} 點傷害！`, "perfect"); }
                        if (eff.fireDmg) { activeMonster.hp -= eff.fireDmg; addLog(`🔥【完美釋放】爆發 -${eff.fireDmg} 點火傷！`, "perfect"); }
                        if (eff.blockBuff) { currentRun.block += eff.blockBuff; addLog WILL(`🛡️【完美釋放】固定減傷 +${eff.blockBuff}！`, "perfect"); }
                        if (eff.healPercent) {
                            let h = Math.floor(eff.lostHp * eff.healPercent);
                            if (currentEnvironment === "ICE" && !currentRun.activeVillageBuffs.includes("🍲 皇家銀河蟹肉宴")) h = Math.floor(h * 0.4);
                            currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + h); addLog(`🩹【完美釋放】血量大回復 +${h} HP！`, "perfect");
                        }
                        if (eff.mpRestore) { currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + eff.mpRestore); addLog(`🔵【完美釋放】魔力回湧 +${eff.mpRestore}！`, "perfect"); }
                        if (eff.cureStatus) { playerStatusEffects.burn = 0; playerStatusEffects.poison = 0; addLog(`🩹【聖水淨化】異常狀態斬斷！`, "perfect"); }
                        if (eff.globalFreezeTurns) { currentEnvironment = "ICE"; addLog(`❄️【人為氣候】轉化為【永凍冰原】！`, "perfect"); }
                    } else {
                        activeMonster.hp -= currentRun.atk; addLog(`⚔️ 普攻突刺造成 ${currentRun.atk} 點傷害。`, "deal");
                    }
                    break;
                }
            }
            
            // 普攻物理砍擊 (融入💡局內吸血天賦判定)
            if (!activeTriggered) { 
                activeMonster.hp -= currentRun.atk; 
                addLog(`⚔️ 普攻揮砍造成 ${currentRun.atk} 點傷害.`, "deal"); 
                if (currentRun.vampRate > 0) {
                    let vAmt = Math.floor(currentRun.atk * currentRun.vampRate);
                    currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + vAmt);
                    addLog(`🍷【天賦•嗜血魔瞳】極致吸血生效！逆天回血 +${vAmt} HP！`, "perfect");
                }
            }
            
            if (activeMonster.hp <= 0) break;
            await new Promise(r => setTimeout(r, 800)); if (gameState !== "BATTLE") return;

            if (activeMonster.freezeTurns > 0) { addLog(`❄️ 魔物冰封中無法動彈。`); activeMonster.freezeTurns--; } 
            else {
                let finalDmg = Math.max(1, activeMonster.atk - currentRun.block);
                if (playerShield > 0) {
                    if (finalDmg <= playerShield) { playerShield -= finalDmg; addLog(`🛡️ 魔物重撞！被護盾抵消。`, "deal"); }
                    else { let over = finalDmg - playerShield; playerShield = 0; currentRun.hp -= over; addLog(`🔴 護盾碎裂！承受 -${over} 外傷！`, "take"); }
                } else { currentRun.hp -= finalDmg; addLog(`🔴 反擊承受 -${finalDmg} HP！`, "take"); }
            }
            if (currentEnvironment === "FIRE" && !currentRun.activeVillageBuffs.includes("🍧 萬年永凍刨冰")) { currentRun.hp = Math.max(1, currentRun.hp - 8); addLog(`🌋 熔岩灼燒受到 -8 火傷。`, "env"); }
            updateUI(); if (currentRun.hp <= 0) break;
            round++; await new Promise(r => setTimeout(r, 1000));
        }
        if (gameState !== "BATTLE") return;

        // 3. 戰後結算
        if (currentRun.hp > 0) {
            currentRun.gold += 20; currentRun.exp += 15;
            
            if (activeMonster.isSkipped) { 
                addLog(`🔮 成功撕裂長空遁走...`); 
                activeMonster = null; 
                checkLevelUpAndTriggerSelect();
            } 
            // 💡 領主戰大捷結算
            else if (activeMonster.isBoss) {
                addLog(`🏆【領主天罰隕落】勇者成功弒殺守層首領 ➔ <strong>${activeMonster.name}</strong>！！`, "perfect");
                if (activeMonster.guaranteedDrop) {
                    accountMeta.warehouse[activeMonster.guaranteedDrop] = (accountMeta.warehouse[activeMonster.guaranteedDrop] || 0) + 1;
                    addLog(`🎁【皇家領主保底】<strong>${activeMonster.guaranteedDrop}</strong> 已強行送入雲端帳戶永久食材倉庫！`, "perfect");
                }
                activeMonster = null;
                
                // 💡 轉入 Boss 專屬不朽天賦三選一頁面
                gameState = "REWARD"; 
                uploadProgressToCloud();
                updateUI(); 
                triggerBossTalentSelect(); 
                return; 
            } 
            // 普通怪結算
            else {
                addLog(`🎉【大捷】殲滅魔物！臨時金幣 +20 G，經驗值 +15 點。`, "perfect");
                if (Math.random() < 0.25) { 
                    let dropName = MONSTER_DROPS[activeMonster.name] || "史萊姆核心黏液";
                    if (currentRun.inventory.length < 2) { currentRun.inventory.push(dropName); addLog(`🎁 獲得食材：<strong>${dropName}</strong>！`, "perfect"); }
                }
                activeMonster = null; 
                checkLevelUpAndTriggerSelect();
            }
        } else {
            addLog(`☠️【魂歸深淵】物資遺失，強制回歸。`, "take");
            gameState = "VILLAGE"; currentEnvironment = "NORMAL";
            document.getElementById('btn-secondary-action').style.display = "none";
            resetCurrentRunData(); uploadProgressToCloud(); updateUI(); switchVillageLocation("GATE");
        }
    } catch(err) { addLog(`🚨 地下城異常：${err.message}`, "take"); document.getElementById('btn-main-action').disabled = false; }
}

function checkLevelUpAndTriggerSelect() {
    let leveledUp = false;
    while (currentRun.exp >= currentRun.nextExp) {
        currentRun.exp -= currentRun.nextExp; currentRun.lv++;
        currentRun.maxHp += 25; currentRun.hp = currentRun.maxHp; currentRun.atk += 5;
        currentRun.nextExp = Math.floor(currentRun.nextExp * 1.5); leveledUp = true;
    }
    if (leveledUp) {
        addLog(`✨👑 境界突破至 <strong>Lv.${currentRun.lv}</strong>！`, "perfect");
        if (currentRun.job === "novice" && currentRun.lv >= 10) { gameState = "REWARD"; updateUI(); triggerJobAwakeningSelect(); return; }
        if (currentRun.job !== "novice" && currentRun.lv % 10 === 0) { gameState = "REWARD"; updateUI(); triggerSkillSelectThreeOfOne(); return; }
    }
    document.getElementById('btn-main-action').disabled = false; updateUI();
}

// 💡 新增：擊殺守層首領後的「當局不朽天賦」三選一抉擇器
function triggerBossTalentSelect() {
    const container = document.getElementById('reward-choices-container');
    document.getElementById('reward-title-text').innerText = "✨ 弒神首領賜福：請選擇一項當局超越不朽天賦 ✨";
    if (!container) return; 
    container.innerHTML = "";
    
    let pool = [
        { name: "🩸 殺戮渴求 (不朽級)", desc: "當局肉身力量暴走，基礎物理攻擊力永久暴增 +30 點。", run: () => { currentRun.atk += 30; } },
        { name: "🛡️ 不落防護盾晶壁 (不朽級)", desc: "護甲高度合金化，當局固定減傷面板永久提升 +8 點。", run: () => { currentRun.block += 8; } },
        { name: "🍷 嗜血魔瞳 (神聖專屬)", desc: "解鎖局內嗜血屬性！往後任何物理普通攻擊命中魔物，皆強制轉化 6% 物理傷害修復自身生命值。", run: () => { currentRun.vampRate = (currentRun.vampRate || 0) + 0.06; } }
    ];
    
    pool.forEach(talent => {
        let btn = document.createElement('button'); btn.className = "btn-game btn-cook";
        btn.innerHTML = `<strong>${talent.name}</strong><br><span style="color:#2ecc71; font-size:11px;">${talent.desc}</span>`;
        btn.onclick = () => {
            talent.run();
            addLog(`✨【血脈共鳴】成功灌注首領天賦 ➔ 【${talent.name}】！`, "perfect");
            gameState = "BATTLE"; 
            document.getElementById('btn-main-action').disabled = false;
            updateUI(); 
            // 領主天賦選完後，順暢銜接檢查玩家本身的常規升級
            checkLevelUpAndTriggerSelect();
        };
        container.appendChild(btn);
    });
}

function triggerJobAwakeningSelect() {
    const container = document.getElementById('reward-choices-container');
    document.getElementById('reward-title-text').innerText = "👑 突破初心者極限：請選擇你的一轉職業 👑";
    if (!container) return; container.innerHTML = "";
    let jobs = [
        { id: "swordsman", name: "⚔️ 轉職：劍士", desc: "初始獲得技能【狂擊】，走高減傷物理流。" },
        { id: "magician", name: "🔮 轉職：魔法師", desc: "初始獲得技能【火箭術】，走超大魔力元素流。" },
        { id: "acolyte", name: "👼 轉職：服事", desc: "初始獲得技能【治癒術】，走高容錯率百分比回血。" }
    ];
    jobs.forEach(j => {
        let btn = document.createElement('button'); btn.className = "btn-game btn-cook";
        btn.innerHTML = `<strong>${j.name}</strong><br><span style="color:#ccc; font-size:11px;">${j.desc}</span>`;
        btn.onclick = () => {
            if (!accountMeta.unlockedJobs.includes(j.id)) accountMeta.unlockedJobs.push(j.id);
            currentRun.job = j.id;
            if(j.id === "swordsman") { currentRun.maxMp = 50; currentRun.mpRegen = 5; currentRun.skills = { "狂擊": 1 }; }
            else if(j.id === "magician") { currentRun.maxMp = 150; currentRun.mpRegen = 20; currentRun.skills = { "火箭術": 1 }; }
            else if(j.id === "acolyte") { currentRun.maxMp = 90; currentRun.mpRegen = 10; currentRun.skills = { "治癒術": 1 }; }
            addLog(`👑【榮耀轉職】血脈覺醒！演化為【${translateJob(j.id)}】！`, "perfect");
            gameState = "BATTLE"; document.getElementById('btn-main-action').disabled = false;
            uploadProgressToCloud(); updateUI(); checkLevelUpAndTriggerSelect(); 
        };
        container.appendChild(btn);
    });
}

function triggerSkillSelectThreeOfOne() {
    const container = document.getElementById('reward-choices-container');
    document.getElementById('reward-title-text').innerText = "✨ 職業整數級突破：請抽選新技能 ✨";
    if (!container) return; container.innerHTML = "";
    let choices = [...SKILLS_DATABASE[currentRun.job]].sort(() => 0.5 - Math.random()).slice(0, 3);
    choices.forEach(skill => {
        let btn = document.createElement('button'); btn.className = "btn-game btn-cook";
        let hasSkill = currentRun.skills[skill.name];
        let nextLv = hasSkill ? hasSkill + 1 : 1;
        btn.innerHTML = `🔮 <b>【${skill.name}】</b> (Lv.${nextLv})<br><span style="color:#ccc; font-size:11px;">${skill.desc}</span>`;
        btn.onclick = () => {
            currentRun.skills[skill.name] = nextLv;
            addLog(`✨【流派成型】核心賜福：【${skill.name}】晉升 Lv.${nextLv}！`, "perfect");
            gameState = "BATTLE"; document.getElementById('btn-main-action').disabled = false;
            updateUI(); checkLevelUpAndTriggerSelect();
        };
        container.appendChild(btn);
    });
}

window.onload = function() { checkCloudAccount(); };
