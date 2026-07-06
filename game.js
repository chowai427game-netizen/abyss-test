// 2.game.js
// ==========================================================================
// 🕹️ 命運深淵：核心控制、10層領主攔截與全分流文字打擊特效引擎 (完美體版)
// ==========================================================================

function handleToggleAuto(checkbox) {
    isAutoBattleMode = checkbox;
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

async function runDungeonLoop() {
    try {
        document.getElementById('btn-main-action').disabled = true;
        
        let isBossFloor = (dungeonFloor % 10 === 0);
        if (!isBossFloor && Math.random() < 0.25 && gameState !== "ENCOUNTER_RESOLVED") {
            gameState = "ENCOUNTER";
            updateUI();
            triggerRandomAbyssEvent(); 
            return; 
        }
        
        if (gameState === "ENCOUNTER_RESOLVED") {
            gameState = "BATTLE";
        }

        currentEnvironment = (dungeonFloor > 1 && Math.random() < 0.35) ? ["FIRE", "ICE", "POISON", "VOID"][Math.floor(Math.random() * 4)] : "NORMAL";
        
        if (isBossFloor) {
            let bossMeta = BOSS_DATABASE[dungeonFloor] || { name: `👹 深淵無名魔皇 Tier.${dungeonFloor/10}`, baseHp: dungeonFloor * 40, baseAtk: dungeonFloor * 3, dropItem: "史萊姆核心黏液" };
            activeMonster = { name: bossMeta.name, hp: bossMeta.baseHp, maxHp: bossMeta.baseHp, atk: bossMeta.baseAtk, freezeTurns: 0, isSkipped: false, isBoss: true, fixedDrop: bossMeta.dropItem };
            addLog(`🚨🌋【領主降臨 B${dungeonFloor}F】警告！遭遇深淵大領主：<strong>${activeMonster.name}</strong>！`, "take");
        } else {
            let rollSeed = REGULAR_MONSTERS_POOL[Math.floor(Math.random() * REGULAR_MONSTERS_POOL.length)];
            let scaledHp = Math.floor(rollSeed.baseHp + dungeonFloor * rollSeed.hpScale);
            let scaledAtk = Math.floor(rollSeed.baseAtk + dungeonFloor * rollSeed.atkScale);
            activeMonster = { name: rollSeed.name, hp: scaledHp, maxHp: scaledHp, atk: scaledAtk, freezeTurns: 0, isSkipped: false, isBoss: false };
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
            
            // 💡 修正：燃燒與劇毒跳字效果同步注入打擊動態 class
            if (playerStatusEffects.burn > 0) { 
                let bDmg = playerStatusEffects.burn * 3;
                currentRun.hp = Math.max(1, currentRun.hp - bDmg); 
                addLog(`🔥【異常燃燒】烈火灼燒！勇者 <span class="strike-monster">[${accountMeta.name}]</span> 全身焦黑！<span class="num-popup num-boss-strike">-${bDmg} HP</span>`, "env"); 
            }
            if (playerStatusEffects.poison > 0) { 
                let pDmg = Math.floor(currentRun.maxHp * 0.06 * playerStatusEffects.poison); 
                currentRun.hp = Math.max(1, currentRun.hp - pDmg); 
                addLog(`🧪【異常劇毒】毒素攻心！勇者 <span class="strike-monster">[${accountMeta.name}]</span> 體力崩解！<span class="num-popup num-boss-strike">-${pDmg} HP</span>`, "env"); 
            }
            
            currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + currentRun.mpRegen); updateUI();
            
            if (currentRun.skills["快速回復"]) {
                let hAmt = Math.floor(currentRun.maxHp * 0.08 * currentRun.skills["快速回復"]);
                if (currentEnvironment === "ICE" && !currentRun.activeVillageBuffs.includes("🍲 皇家銀河蟹肉宴")) { hAmt = Math.floor(hAmt * 0.4); addLog(`❄️【冰原禁制】被動回復力受到壓制！`, "env"); }
                currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + hAmt);
                addLog(`🟢【開局被動】細胞自動修復！勇者 <span class="strike-holy">[${accountMeta.name}]</span> 聖光圍繞！<span class="num-popup num-h-heal">+${hAmt} HP</span>`);
            }

            let activeTriggered = false;
            for (let sName of Object.keys(currentRun.skills)) {
                let sMeta = SKILLS_DATABASE[currentRun.job]?.find(s => s.name === sName);
                if (sMeta && sMeta.type === "active" && currentRun.mp >= sMeta.mp && Math.random() < 0.40) {
                    addLog(`🔮 魔力大激盪 ➔ 引導【${sName} Lv.${currentRun.skills[sName]}】`); activeTriggered = true;
                    let isPerfect = await triggerQteSystem(sName, 1200);
                    if (gameState !== "BATTLE") return;
                    if (currentEnvironment === "POISON") { playerStatusEffects.poison++; addLog(`🧪【沼澤毒化】引導魔法深度感染！`, "env"); }
                    
                    let hitClass = currentRun.job === "swordsman" || currentRun.job === "novice" ? "strike-slash" : (currentRun.job === "magician" ? "strike-magic" : "strike-holy");
                    let numClass = currentRun.job === "magician" ? "num-m-dmg" : "num-p-dmg";

                    if (isPerfect) {
                        currentRun.mp -= sMeta.mp; let eff = sMeta.run(currentRun.skills[sName], currentRun.atk, currentRun.maxMp, currentRun.hp);
                        if (sName === "火箭術" && currentEnvironment === "FIRE") { eff.baseFire = Math.floor(eff.baseFire * 1.5); addLog(`🌋【力場共鳴】火箭術爆發 1.5 倍！`, "deal"); }
                        
                        if (eff.dmg) { 
                            activeMonster.hp -= eff.dmg; 
                            addLog(`💥【完美釋放】核心技轟鳴！使 <span class="${hitClass}">[${activeMonster.name}]</span> 爆開裂痕！<span class="num-popup ${numClass}">-${eff.dmg} HP</span>`, "perfect"); 
                        }
                        if (eff.fireDmg) { 
                            activeMonster.hp -= eff.fireDmg; 
                            addLog(`🔥【完美釋放】怒爆烈焰！使 <span class="${hitClass}">[${activeMonster.name}]</span> 全身引燃！<span class="num-popup num-m-dmg">-${eff.fireDmg} HP</span>`, "perfect"); 
                        }
                        if (eff.blockBuff) { currentRun.block += eff.blockBuff; addLog(`🛡️【完美釋放】固定減傷 +${eff.blockBuff}！`, "perfect"); }
                        if (eff.healPercent) {
                            let h = Math.floor(eff.lostHp * eff.healPercent);
                            if (currentEnvironment === "ICE" && !currentRun.activeVillageBuffs.includes("🍲 皇家銀河蟹肉宴")) h = Math.floor(h * 0.4);
                            currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + h);
                            let selfHitClass = currentRun.job === "acolyte" ? "strike-holy" : "strike-slash";
                            addLog(`🩹【完美釋放】神聖洗禮！勇者 <span class="${selfHitClass}">[${accountMeta.name}]</span> 聖光圍繞！<span class="num-popup num-h-heal">+${h} HP</span>`, "perfect");
                        }
                        if (eff.mpRestore) { currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + eff.mpRestore); addLog(`🔵【完美釋放】禪心回湧 +${eff.mpRestore}！`, "perfect"); }
                        if (eff.cureStatus) { playerStatusEffects.burn = 0; playerStatusEffects.poison = 0; addLog(`🩹【聖水淨化】異常狀態斬斷！`, "perfect"); }
                        if (eff.globalFreezeTurns) { currentEnvironment = "ICE"; addLog(`❄️【人為氣候】轉化為【永凍冰原】！`, "perfect"); }
                    } else {
                        // 💡 修正：QTE 失敗時的普通突刺，精準灌注職業特效與跳字
                        activeMonster.hp -= currentRun.atk; 
                        addLog(`⚔️ 普攻突刺！使 <span class="${hitClass}">[${activeMonster.name}]</span> 鮮血濺出！<span class="num-popup ${numClass}">-${currentRun.atk} HP</span>`, "deal");
                    }
                    break;
                }
            }
            
            // 💡 修正：基礎物理普通攻擊（包含初心者），全面灌注職業打擊感 class 與 Impact 跳字
            if (!activeTriggered) { 
                activeMonster.hp -= currentRun.atk; 
                let hitClass = currentRun.job === "swordsman" || currentRun.job === "novice" ? "strike-slash" : (currentRun.job === "magician" ? "strike-magic" : "strike-holy");
                let numClass = currentRun.job === "magician" ? "num-m-dmg" : "num-p-dmg";
                addLog(`⚔️ 普攻揮砍！使 <span class="${hitClass}">[${activeMonster.name}]</span> 被正面重劈！<span class="num-popup ${numClass}">-${currentRun.atk} HP</span>`, "deal"); 
            }
            if (activeMonster.hp <= 0) break;
            await new Promise(r => setTimeout(r, 800)); if (gameState !== "BATTLE") return;

            // 🔴 魔物反擊回合（全面包裹 strike-monster 與大字彈窗 num-boss-strike）
            if (activeMonster.freezeTurns > 0) { addLog(`❄️ 魔物冰封中無法動彈。`); activeMonster.freezeTurns--; } 
            else {
                let finalDmg = Math.max(1, activeMonster.atk - currentRun.block);
                if (playerShield > 0) {
                    if (finalDmg <= playerShield) { playerShield -= finalDmg; addLog(`🛡️ 魔物重撞！被護盾抵消。`, "deal"); }
                    else { 
                        let over = finalDmg - playerShield; playerShield = 0; currentRun.hp -= over; 
                        addLog(`🔴 護盾粉碎！勇者 <span class="strike-monster">[${accountMeta.name}]</span> 慘遭重擊！<span class="num-popup num-boss-strike">-${over} HP</span>`, "take"); 
                    }
                } else { 
                    currentRun.hp -= finalDmg; 
                    addLog(`🔴 魔物暴虐反噬！勇者 <span class="strike-monster">[${accountMeta.name}]</span> 肉身承受痛擊！<span class="num-popup num-boss-strike">-${finalDmg} HP</span>`, "take"); 
                }
            }
            if (currentEnvironment === "FIRE" && !currentRun.activeVillageBuffs.includes("🍧 萬年永凍刨冰")) { currentRun.hp = Math.max(1, currentRun.hp - 8); addLog(`🌋 熔岩灼燒受到 -8 火傷。`, "env"); }
            updateUI(); if (currentRun.hp <= 0) break;
            round++; await new Promise(r => setTimeout(r, 1000));
        }
        if (gameState !== "BATTLE") return;

        if (currentRun.hp > 0) {
            currentRun.gold += isBossFloor ? 150 : 20; 
            currentRun.exp += isBossFloor ? 100 : 15;
            
            if (activeMonster.isSkipped) { 
                addLog("🔮 成功撕裂長空遁走..."); 
                activeMonster = null; 
                checkLevelUpAndTriggerSelect();
            } else {
                if (isBossFloor) {
                    addLog(`🏆【史詩大捷】成功討伐大領主 [${activeMonster.name}]！金幣 +150 G，經驗 +100 點！`, "perfect");
                    let drop = activeMonster.fixedDrop;
                    accountMeta.warehouse[drop] = (accountMeta.warehouse[drop] || 0) + 1;
                    addLog(`🎁【領主血脈抽離】特殊戰利品已強制傳送回雲端永久倉庫 ➔ <strong>${drop} (x1)</strong>！`, "perfect");
                    activeMonster = null;
                    gameState = "REWARD";
                    updateUI();
                    triggerBossTalentReward();
                } else {
                    addLog(`🎉【大捷】殲滅魔物！臨時金幣 +20 G，經驗值 +15 點。`, "perfect");
                    if (Math.random() < 0.25) { 
                        let dropName = MONSTER_DROPS[activeMonster.name] || "史萊姆核心黏液";
                        if (currentRun.inventory.length < 2) { currentRun.inventory.push(dropName); addLog(`🎁 獲得食材：<strong>${dropName}</strong>！`, "perfect"); }
                    }
                    activeMonster = null; 
                    checkLevelUpAndTriggerSelect();
                }
            }
        } else {
            addLog(`☠️【魂歸深淵】物資遺失，強制回歸。`, "take");
            gameState = "VILLAGE"; currentEnvironment = "NORMAL";
            document.getElementById('btn-secondary-action').style.display = "none";
            resetCurrentRunData(); uploadProgressToCloud(); updateUI(); switchVillageLocation("GATE");
        }
    } catch(err) { addLog(`🚨 地下城異常：${err.message}`, "take"); document.getElementById('btn-main-action').disabled = false; }
}

function triggerBossTalentReward() {
    const container = document.getElementById('reward-choices-container');
    document.getElementById('reward-title-text').innerText = `✨ 討伐 B${dungeonFloor}F 領主大捷：請汲取一項深淵永久主宰天賦 ✨`;
    if (!container) return;
    container.innerHTML = "";
    
    let perks = [
        { name: "👑 不滅巨魔血脈 (Troll Blood)", desc: "局內【固定減傷】面板直接永久暴增 +6 點！", run: () => { currentRun.block += 6; } },
        { name: "⚡ 狂暴神經反射 (Hyper Reflexes)", desc: "局內【完美閃避】機率永久 +8%，且QTE基礎安全詠唱時間延長 100ms！", run: () => { currentRun.dodgeChance += 8; currentRun.qteBuffDuration += 100; } },
        { name: "🩸 殘虐撕裂本能 (Vampiric Cleave)", desc: "局內【暴擊機率】面板永續固定 +10%！", run: () => { currentRun.critChance += 10; } }
    ];
    
    perks.forEach(perk => {
        let btn = document.createElement('button');
        btn.className = "btn-game btn-cook";
        btn.innerHTML = `<strong>${perk.name}</strong><br><span style="color:#2ecc71; font-size:11px;">${perk.desc}</span>`;
        btn.onclick = () => {
            perk.run();
            addLog(`👑【天賦覺醒】你融合了領主核心，成功加冕天賦：[${perk.name}]！`, "perfect");
            gameState = "BATTLE";
            document.getElementById('btn-main-action').disabled = false;
            uploadProgressToCloud();
            updateUI();
            checkLevelUpAndTriggerSelect();
        };
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
    if (leveledUp) {
        addLog(`✨👑 境界突破至 <strong>Lv.${currentRun.lv}</strong>！`, "perfect");
        if (currentRun.job === "novice" && currentRun.lv >= 10) { gameState = "REWARD"; updateUI(); triggerJobAwakeningSelect(); return; }
        if (currentRun.job !== "novice" && currentRun.lv % 10 === 0) { gameState = "REWARD"; updateUI(); triggerSkillSelectThreeOfOne(); return; }
    }
    if (gameState === "BATTLE") {
        document.getElementById('btn-main-action').disabled = false;
    }
    updateUI();
}

window.onload = function() { checkCloudAccount(); };

// ==========================================================================
// 🌌 命運深淵：奇遇事件路由與抉擇結果處理核心
// ==========================================================================

function triggerRandomAbyssEvent() {
    const container = document.getElementById('reward-choices-container');
    const title = document.getElementById('reward-title-text');
    if (!container || !title) return;
    container.innerHTML = "";

    let eventType = Math.floor(Math.random() * 3);

    if (eventType === 0) {
        title.innerText = "🛒 流浪黑市商人 • 冥河折扣 🛒";
        addLog(`🌌【深淵奇遇 B${dungeonFloor}F】虛空裂縫打開，一位披著破爛斗篷的流浪商人向你展示了禁忌物資。`);
        let rolledGoods = [...MARKET_ITEMS_POOL].sort(() => 0.5 - Math.random()).slice(0, 2);
        buildBlackMarketUI(rolledGoods);
    } 
    else if (eventType === 1) {
        title.innerText = "🩸 命運邪神祭壇 • 血脈契約 🩸";
        addLog(`🌌【深淵奇遇 B${dungeonFloor}F】亂石堆中聳立著一座流淌著黑血的古老祭壇，地底傳來索取祭品品嘅低語。`);
        
        let btnDeal = document.createElement('button');
        btnDeal.className = "btn-game btn-cook";
        btnDeal.innerHTML = `<strong>🩸 簽訂血脈契約</strong><br><span style="color:#ff4757;">代價：扣減生命上限 Max HP -25 ➔ 報酬：永久灌注 +15 基礎攻擊力！</span>`;
        btnDeal.onclick = () => {
            currentRun.maxHp = Math.max(15, currentRun.maxHp - 25);
            currentRun.hp = Math.min(currentRun.hp, currentRun.maxHp);
            currentRun.atk += 15;
            addLog(`🩸【邪神交易完成】你切開了手腕，獻祭生命源泉！身體虛弱，但無盡的殺意充盈靈魂 (+15 ATK)！`, "take");
            resolveAbyssEvent();
        };
        container.appendChild(btnDeal);

        let btnLeave = document.createElement('button');
        btnLeave.className = "btn-game btn-rest";
        btnLeave.innerHTML = "🧘 保持理智，無視誘惑離開";
        btnLeave.onclick = () => {
            addLog(`🧘 你守住了靈魂的清明，握緊長劍，大步繞過了邪神祭壇。`);
            resolveAbyssEvent();
        };
        container.appendChild(btnLeave);
    } 
    else {
        title.innerText = "✨ 深淵流螢神泉 • 命運的昂貴代價 ✨";
        addLog(`🌌【深淵奇遇 B${dungeonFloor}F】前方亂石後傳來泉水聲，一片散發著治癒微光的魔導神泉出現在眼前。`);
        
        let btnDrink = document.createElement('button');
        btnDrink.className = "btn-game btn-cook";
        btnDrink.innerHTML = `<strong>🧪 痛飲不老神泉</strong><br><span style="color:#2ecc71;">報酬：氣血當場奶滿 +80 HP！➔ 代價：下 3 回合 QTE 判定安全時間暴跌 300ms！</span>`;
        btnDrink.onclick = () => {
            currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 80);
            currentRun.qteBuffDuration -= 300; 
            currentRun.qteBuffTurns = 3;       
            addLog(`✨【神泉滋養完成】泉水修復了你肉身的重創 (+80 HP)，但強烈的舒適感讓你的神經反射短暫變得有些恍惚遲鈍！`, "perfect");
            resolveAbyssEvent();
        };
        container.appendChild(btnDrink);

        let btnLeave = document.createElement('button');
        btnLeave.className = "btn-game btn-rest";
        btnLeave.innerHTML = "🏃 擔心泉水有詐，直接路過";
        btnLeave.onclick = () => {
            addLog(`🏃 謹慎至上，你只是用泉水洗淨了臉上的血漬，並未飲用，踏步離開。`);
            resolveAbyssEvent();
        };
        container.appendChild(btnLeave);
    }
    updateUI();
}

function buildBlackMarketUI(goodsList) {
    const container = document.getElementById('reward-choices-container');
    if (!container) return;
    container.innerHTML = "";

    goodsList.forEach(item => {
        let btn = document.createElement('button');
        btn.className = "btn-game btn-cook";
        btn.innerHTML = `🪙 <b>購買：[${item.name}]</b><br><span style="color:#aaa;">${item.desc}</span><br><span style="color:#ffd700; font-weight:bold;">售價：${item.price} 臨時金幣</span> (當前財富: ${currentRun.gold}G)`;
        
        btn.onclick = () => {
            if (currentRun.gold < item.price) { alert("🪙 局內臨時金幣不足，無法交易！"); return; }
            if (currentRun.inventory.length >= 2) { alert("🎒 你的戰術背包快捷欄已經爆滿！"); return; }
            
            currentRun.gold -= item.price;
            currentRun.inventory.push(item.name);
            addLog(`🛒【黑市交易成功】你付出了 ${item.price} G 臨時金幣，購入了 <strong>${item.name}</strong> 放入戰術背包！`);
            
            buildBlackMarketUI(goodsList);
            updateUI();
        };
        container.appendChild(btn);
    });

    let btnExit = document.createElement('button');
    btnExit.className = "btn-game btn-rest";
    btnExit.innerHTML = "🏃 結束交易，收起背包繼續出發";
    btnExit.onclick = () => {
        addLog(`🏃 你收起裝備，向流浪商人致意告別，繼續踏上深淵征途。`);
        resolveAbyssEvent();
    };
    container.appendChild(btnExit);
}

function resolveAbyssEvent() {
    gameState = "ENCOUNTER_RESOLVED";
    document.getElementById('btn-main-action').disabled = false;
    updateUI();
    runDungeonLoop(); 
}
// game.js - 注入重巡大腦控制器
async function handleRerunAction() {
    try {
        // 鎖定所有按鈕防止連點 Bug
        document.getElementById('btn-main-action').disabled = true;
        document.getElementById('btn-rerun-action').disabled = true;
        
        addLog(`🔄【戰術重巡】勇者無視了領主房間的咆哮，悄悄折返 B${dungeonFloor}F 安全通道重新掃蕩整備！`, "deal");
        
        // 核心邏輯：層數 dungeonFloor 保持不變，直接重新執行地下城生成大循環
        await runDungeonLoop();
        
    } catch(err) {
        addLog(`🚨 重巡力場干擾崩潰：${err.message}`, "take");
        document.getElementById('btn-main-action').disabled = false;
        document.getElementById('btn-rerun-action').disabled = false;
    }
}
