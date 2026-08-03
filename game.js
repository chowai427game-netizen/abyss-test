// ==========================================================================
// 🕹️ game.js：完整無閠修復版地下城遊戲邏輯核心 (Full Debugged Edition)
// ==========================================================================

// --------------------------------------------------------------------------
// 🌐 Zone 1: 全局狀態與戰鬥計時變數
// --------------------------------------------------------------------------
let combatTickerTimer = null; 
let combatRoundCounter = 1;    

let playerAtb = 0;
let monsterAtb = 0;
let envAtb = 0;
let battleTimeElapsed = 0;

let isQteActive = false;
let activeTactic = "BALANCED"; // 預設戰術: BALANCED (均衡防守), OFFENSIVE (狂暴強擊), MANUAL (手動)

// 玩家臨時狀態與村莊進食 Buff
let playerStatusEffects = {
    burn: 0,
    poison: 0,
    freeze: 0
};

let activeVillageBuffs = {
    maxHpAdd: 0,
    maxMpAdd: 0,
    atkAdd: 0,
    expRate: 1.0
};

// --------------------------------------------------------------------------
// 🚀 Zone 2: 戰鬥日記內部專屬投射物、傷害計算與視覺輔助
// --------------------------------------------------------------------------
function triggerProjectileFX(type = 'arcane') {
    const logContainer = document.getElementById('log-box');
    if (!logContainer) return;

    const proj = document.createElement('div');
    proj.className = `projectile-entity proj-${type}`;
    proj.innerHTML = `<div class="fx-core"></div>`;
    
    logContainer.appendChild(proj);

    setTimeout(() => {
        proj.remove();
    }, 450);
}

function detectProjectileType(skillName, job) {
    if (skillName.includes("火") || skillName.includes("炎") || skillName.includes("爆")) return "fire";
    if (skillName.includes("冰") || skillName.includes("霜") || skillName.includes("凍")) return "ice";
    if (skillName.includes("雷") || skillName.includes("電") || skillName.includes("震")) return "lightning";
    if (job === "archer") return "arrow";
    return "arcane";
}

function detectSkillCssClass(skillName) {
    if (skillName.includes("火") || skillName.includes("炎") || skillName.includes("爆")) return "skill-fire";
    if (skillName.includes("冰") || skillName.includes("霜") || skillName.includes("凍")) return "skill-ice";
    if (skillName.includes("雷") || skillName.includes("電") || skillName.includes("震")) return "skill-lightning";
    if (skillName.includes("聖") || skillName.includes("治癒") || skillName.includes("光")) return "skill-holy";
    if (skillName.includes("毒")) return "skill-poison";
    return "skill-bash";
}

function calculateDamage(rawAtk, targetDef, isPlayerAttacker = true, isMagic = false) {
    let safeDef = Math.max(-90, targetDef || 0); // 避免負防導致分母為零或 NaN
    let critChance = isPlayerAttacker ? (currentRun.critChance || 5) : 5;
    let isCrit = Math.random() * 100 < critChance;
    
    // 閃避率判定 (Flee / Perfect Dodge)
    let fleeVal = isPlayerAttacker ? (activeMonster?.flee || 0) : (currentRun.flee || 10);
    let hitVal = isPlayerAttacker ? (currentRun.hit || 100) : (activeMonster?.hit || 80);
    let dodgeChance = Math.max(5, Math.min(80, fleeVal - hitVal / 2));
    
    if (Math.random() * 100 < dodgeChance) {
        return { damage: 0, isCrit: false, isMiss: true };
    }

    let multiplier = isCrit ? 1.5 : 1.0;
    let defFactor = 100 / (100 + safeDef);
    let finalDmg = Math.max(1, Math.floor(rawAtk * multiplier * defFactor));

    return { damage: finalDmg, isCrit: isCrit, isMiss: false };
}

// --------------------------------------------------------------------------
// 🔑 Zone 3: 角色驗證、登入與初始職業選擇
// --------------------------------------------------------------------------
async function handleStartGame() {
    const inputName = document.getElementById('player-name-input')?.value;
    const inputPin = document.getElementById('player-pin-input')?.value;

    const result = await initOrLoadPlayer(inputName, inputPin);

    if (!result || !result.success) {
        console.warn("🔐 PIN 碼驗證失敗，阻擋進入遊戲。");
        return; 
    }

    if (result.isNewUser || !accountMeta.job || accountMeta.job === "novice") {
        renderInitialJobModal(false);
        return;
    }

    enterGameMainShell();
}

function renderInitialJobModal(isReselect = false) {
    const modal = document.getElementById('initial-job-modal');
    const list = document.getElementById('initial-job-list');
    if (!modal || !list) return;

    list.innerHTML = "";
    modal.style.display = "flex";

    const jobs = [
        { id: "swordsman", name: "⚔️ 劍士", desc: "高 HP 與物理減傷 (STR/VIT)，近戰重擊。" },
        { id: "magician", name: "🔮 魔法師", desc: "掌控冰火雷奧術 (INT/DEX)，極高魔傷與控場。" },
        { id: "acolyte", name: "✨ 服事", desc: "神聖庇護 (INT/VIT)，百分比自癒與驅魔。" },
        { id: "thief", name: "🗡️ 盜賊", desc: "高閃避與暴擊 (AGI/LUK)，劇毒與連擊。" },
        { id: "archer", name: "🏹 弓箭手", desc: "極速貫穿連射 (DEX/AGI)，遠程爆頭狙擊。" }
    ];

    jobs.forEach(j => {
        let card = document.createElement('div');
        card.style.cssText = `
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(0, 255, 204, 0.2);
            border-radius: 8px; padding: 12px; text-align: left; cursor: pointer; transition: all 0.2s;
        `;
        card.innerHTML = `
            <div style="font-size: 14px; font-weight: bold; color: #00ffcc; margin-bottom: 4px;">${j.name}</div>
            <div style="font-size: 11px; color: #aaa;">${j.desc}</div>
        `;
        card.onclick = () => { 
            if (isReselect) {
                executeReselectJob(j.id);
            } else {
                selectInitialJob(j.id);
            }
            modal.style.display = "none";
        };
        list.appendChild(card);
    });
}

function selectInitialJob(jobId) {
    accountMeta.job = jobId;
    currentRun.job = jobId;

    let initialSkills = {};
    if (typeof SKILLS_DATABASE !== "undefined" && SKILLS_DATABASE[jobId]) {
        let firstSkill = SKILLS_DATABASE[jobId][0].name;
        initialSkills[firstSkill] = 1;
    }

    accountMeta.skills = { ...initialSkills };
    currentRun.skills = { ...initialSkills };

    resetCurrentRunData();
    saveGameData();

    const modal = document.getElementById('initial-job-modal');
    if (modal) modal.style.display = "none";

    enterGameMainShell();
}

function enterGameMainShell() {
    const titleBox = document.getElementById('title-box');
    const statusPanel = document.getElementById('status-panel-box');
    const actionPanel = document.getElementById('action-panel-box');
    const villagePanel = document.getElementById('village-panel-box');
    const logWrapper = document.getElementById('log-wrapper-box');

    if (titleBox) titleBox.style.display = 'none';
    if (statusPanel) statusPanel.style.display = 'block';
    if (actionPanel) actionPanel.style.display = 'flex';
    if (villagePanel) villagePanel.style.display = 'block';
    if (logWrapper) logWrapper.style.display = 'block';

    if (typeof updateUI === "function") updateUI();
    if (typeof addLog === "function") {
        addLog(`✨ 勇者 <strong>${accountMeta.name}</strong> 順利踏入深淵邊境！當前血脈職業：<strong>${getJobChineseName(currentRun.job)}</strong>。`, "perfect");
    }
}

// --------------------------------------------------------------------------
// 🎓 Zone 4: 公會技能學習、屬性重置與轉職
// --------------------------------------------------------------------------
function executeLearnSkill(skillMeta) {
    if (!accountMeta.skills) accountMeta.skills = {};
    if (!currentRun.skills) currentRun.skills = {};

    let currentLv = (accountMeta.skills[skillMeta.name] || currentRun.skills[skillMeta.name] || 0);

    if (currentLv >= 10) {
        showMaterialAlert([`技能 [${skillMeta.name}] 已達到最高等級上限 (Lv.10)！`], "👑 已達滿級");
        return;
    }

    let nextLv = currentLv + 1;
    let goldCost = skillMeta.goldCost * nextLv;
    let missingList = [];

    if (currentRun.gold < goldCost) {
        missingList.push(`🪙 金幣不足：尚缺 ${goldCost - currentRun.gold} G (需 ${goldCost} G)`);
    }

    for (let mat in skillMeta.reqMat) {
        let reqQty = skillMeta.reqMat[mat] * nextLv;
        let currentQty = accountMeta.warehouse[mat] || 0;
        if (currentQty < reqQty) {
            missingList.push(`📦 素材 [${mat}] 不足：尚缺 ${reqQty - currentQty} 個 (需 ${reqQty} 個)`);
        }
    }

    if (missingList.length > 0) {
        showMaterialAlert(missingList, `⚠️ 技能 [${skillMeta.name}] 研習資源不足`);
        return;
    }

    currentRun.gold -= goldCost;
    for (let mat in skillMeta.reqMat) {
        let reqQty = skillMeta.reqMat[mat] * nextLv;
        accountMeta.warehouse[mat] -= reqQty;
    }

    accountMeta.skills[skillMeta.name] = nextLv;
    currentRun.skills[skillMeta.name] = nextLv;

    if (currentLv === 0) {
        addLog(`🎓🎓【公會技能傳承】成功領悟專屬奧義 ➔ <strong>[${skillMeta.name}] (Lv.1)</strong>！`, "perfect");
    } else {
        addLog(`🎓✨【公會技能突破】成功將奧義 ➔ <strong>[${skillMeta.name}]</strong> 提升至 <strong>Lv.${nextLv}</strong> (上限 Lv.10)！`, "perfect");
    }

    saveGameData();
    updateUI();
    if (typeof renderVillageGuild === "function") renderVillageGuild();
}

function executeResetStats() {
    if (currentRun.gold < 300) {
        showMaterialAlert([`🪙 金幣不足：洗點需要 300 G (當前僅有 ${currentRun.gold} G)`], "⚠️ 金幣不足");
        return;
    }

    if (!confirm("確定要消耗 300 G 洗回所有已分配的屬性點嗎？")) return;

    currentRun.gold -= 300;

    let s = accountMeta.stats || { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    let totalAllocated = (s.STR || 0) + (s.AGI || 0) + (s.VIT || 0) + (s.INT || 0) + (s.DEX || 0) + (s.LUK || 0);

    accountMeta.statPoints = (accountMeta.statPoints || 0) + totalAllocated;
    accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };

    resetCurrentRunData();
    saveGameData();
    addLog(`🎯⚖️【洗點完畢】已退還 <strong>${totalAllocated} 點</strong> 自由能力點數！`, "perfect");
    updateUI();
}

function triggerReselectJobUI() {
    if (currentRun.gold < 1000) {
        showMaterialAlert([`🪙 金幣不足：轉職洗禮需要 1,000 G (當前僅有 ${currentRun.gold} G)`], "⚠️ 金幣不足");
        return;
    }

    if (!confirm("⚠️ 警告：重選職業將使等級重置為 Lv.1，並重新選擇職業！裝備、金幣與素材將完全保留。確定進行？")) return;

    renderInitialJobModal(true);
}

function executeReselectJob(newJobId) {
    currentRun.gold -= 1000;

    accountMeta.job = newJobId;
    accountMeta.lv = 1;
    accountMeta.exp = 0;
    accountMeta.nextExp = 30;
    accountMeta.statPoints = 0;
    accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };

    let initialSkills = {};
    if (typeof SKILLS_DATABASE !== "undefined" && SKILLS_DATABASE[newJobId]) {
        let firstSkill = SKILLS_DATABASE[newJobId][0].name;
        initialSkills[firstSkill] = 1;
    }

    accountMeta.skills = { ...initialSkills };

    currentRun.job = newJobId;
    currentRun.skills = { ...initialSkills };

    resetCurrentRunData();
    saveGameData();

    addLog(`🔄⚖️【轉職洗禮完成】已成功將血脈重置為 ➔ <strong>${getJobChineseName(newJobId)} (Lv.1)</strong>！`, "perfect");
    updateUI();
}

// --------------------------------------------------------------------------
// 🎛️ Zone 5: 戰術抽屜 UI 與自動戰鬥 AI 引擎
// --------------------------------------------------------------------------
function toggleTacticsDrawer() {
    const drawer = document.getElementById('tactics-drawer-box');
    if (drawer) {
        drawer.classList.toggle('expanded');
    }
}

function selectTactic(tacticMode) {
    activeTactic = tacticMode;
    syncTacticButtonsUi();
    addLog(`🛡️【戰術切換】當前戰術姿態調控為：<strong>${tacticMode === 'OFFENSIVE' ? '🔥 狂暴強擊' : tacticMode === 'BALANCED' ? '🛡️ 均衡防守' : '🎮 手動微操'}</strong>`, "perfect");
}

function syncTacticButtonsUi() {
    const modes = ['MANUAL', 'BALANCED', 'OFFENSIVE'];
    modes.forEach(m => {
        const btn = document.getElementById(`tactic-btn-${m}`);
        if (btn) {
            btn.classList.toggle('active', activeTactic === m);
        }
    });
}

function executeAutoBattleAiTurn() {
    if (activeTactic === "MANUAL") return false;

    let hpPercent = (currentRun.hp / currentRun.maxHp) * 100;
    
    // 1. 均衡模式下的緊急救命邏輯：HP < 35% 自動使用背包含有的食糧
    if (activeTactic === "BALANCED" && hpPercent < 35 && currentRun.inventory) {
        let foodIdx = currentRun.inventory.findIndex(item => item.includes("牛巨堡") || item.includes("料理"));
        if (foodIdx !== -1) {
            executeUseDungeonItem(currentRun.inventory[foodIdx], foodIdx);
            return true;
        }
    }

    // 2. 服事 / 治癒技能自動緊急吟唱 (HP < 60%)
    if (hpPercent < 60 && currentRun.skills["治癒術"] && currentRun.mp >= 15) {
        let skLv = currentRun.skills["治癒術"];
        let healAmount = Math.floor(currentRun.maxHp * (0.2 + skLv * 0.05));
        currentRun.mp -= 15;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healAmount);
        addLog(`✨ 智能 AI 自動觸發 <span class="skill-holy">【治癒術 Lv.${skLv}】</span> 回復 <span class="heal-effect">+${healAmount} HP</span>！`, "perfect");
        return true;
    }

    // 3. 狂暴模式：優先施展傷害最高的最高階技能
    if (activeTactic === "OFFENSIVE" && typeof SKILLS_DATABASE !== "undefined") {
        let jobSkills = SKILLS_DATABASE[currentRun.job] || [];
        for (let i = jobSkills.length - 1; i >= 0; i--) {
            let sMeta = jobSkills[i];
            if (currentRun.skills[sMeta.name] && currentRun.mp >= sMeta.mp) {
                currentRun.mp -= sMeta.mp;
                let skLv = currentRun.skills[sMeta.name];
                let isMagicJob = (currentRun.job === "magician" || currentRun.job === "acolyte");
                let baseAtkPower = isMagicJob ? (currentRun.matk || 10) : (currentRun.atk || 15);
                let eff = sMeta.run(skLv, baseAtkPower, currentRun.maxMp, currentRun.hp, currentRun.maxHp);
                
                triggerProjectileFX(detectProjectileType(sMeta.name, currentRun.job));
                let fxClass = detectSkillCssClass(sMeta.name);

                let monsterDef = isMagicJob ? (activeMonster.mdef || 0) : (activeMonster.def || 0);
                let dmgRes = calculateDamage(eff.dmg || baseAtkPower, monsterDef, true, isMagicJob);

                if (dmgRes.isMiss) {
                    addLog(`💨 狂暴發動 <span class="${fxClass}">【${sMeta.name} Lv.${skLv}】</span>，但被 <span class="miss-effect">[MISS 閃過]</span>！`, "miss");
                } else {
                    activeMonster.hp -= dmgRes.damage;
                    addLog(`🔥 AI 狂暴指令！施展 <span class="${fxClass}">【${sMeta.name} Lv.${skLv}】</span> 重創 <span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup num-p-dmg">-${dmgRes.damage} HP</span>`, "skill-hit");
                }
                return true;
            }
        }
    }

    return false;
}

// --------------------------------------------------------------------------
// ⚔️ Zone 6: 地下城移動、撤退與背包道具微操
// --------------------------------------------------------------------------
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
        if (combatTickerTimer) clearInterval(combatTickerTimer);
        addLog(`🔄【重巡整備】你留在深淵 B${dungeonFloor}F 進行重巡狩獵，戰局重新載入！`, "perfect");
        gameState = "BATTLE";
        
        const mainBtn = document.getElementById('btn-main-action');
        const rerunBtn = document.getElementById('btn-rerun-action');
        if (mainBtn) mainBtn.disabled = false;
        if (rerunBtn) rerunBtn.disabled = false;

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

    if (!accountMeta.maxFloor || dungeonFloor > accountMeta.maxFloor) {
        accountMeta.maxFloor = dungeonFloor;
    }
    
    if (currentRun.inventory) {
        currentRun.inventory.forEach(item => {
            if(typeof MONSTER_DROPS !== "undefined" && (MONSTER_DROPS[item] || Object.values(MONSTER_DROPS).includes(item) || item.includes("未知物體"))) {
                accountMeta.warehouse[item] = (accountMeta.warehouse[item] || 0) + 1;
            }
        });
    }
    
    resetCurrentRunData();

    currentRun.hp = currentRun.maxHp;
    currentRun.mp = currentRun.maxMp;

    saveGameData(); 

    addLog(`🏃【撤退成功】你驚險逃回地表村莊！等級與裝備完美保留，素材已安全歸倉！`, "perfect");
    addLog(`💖💾【村莊泉水庇護】狀態已全額恢復 (HP/MP)，遊戲進度與歷史紀錄 (最高 B${accountMeta.maxFloor || 1}F) 已自動存檔！`, "perfect");

    updateUI();
    switchVillageLocation("GATE");
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
    
    if (itemName.includes("厚牛巨堡") || itemName.includes("料理")) {
        let healVal = Math.floor(currentRun.maxHp * 0.5);
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healVal);
        addLog(`🌭 熱量充能！血量大幅度回復 <span class="heal-effect">+${healVal} HP</span>！`, "perfect");
    } 
    else if (itemName.includes("永凍刨冰")) {
        activeMonster.freezeTurns = (activeMonster.freezeTurns || 0) + 2;
        addLog(`❄️ 冰爽極限！魔物被徹底凍結 <strong>2 回合</strong> 無法行動！`, "perfect");
    }
    else if (itemName.includes("禁忌血釀")) {
        let selfDmg = Math.floor(currentRun.hp * 0.2);
        currentRun.hp = Math.max(1, currentRun.hp - selfDmg);
        activeMonster.hp = 0;
        addLog(`🍷 獻祭血液扣減 ${selfDmg} HP，釋放禁忌詛咒秒殺魔物！`, "perfect");
        clearInterval(combatTickerTimer);
        executeDungeonVictorySequence();
    }
    else if (itemName.includes("未知物體")) {
        let dmg = currentEnvironment === "POISON" ? 30 : 15;
        currentRun.hp = Math.max(1, currentRun.hp - dmg);
        addLog(`🪨 焦黑物體反噬扣血！扣減 ${dmg} HP！`, "take");
    }
    
    currentRun.inventory.splice(index, 1);
    updateUI();
}

// --------------------------------------------------------------------------
// 🔨 Zone 7: 料理、鍛造、星級精煉與 QTE
// --------------------------------------------------------------------------
function executeVillageCooking(recipe) {
    let missingList = [];
    for (let ing in recipe.ingredients) {
        let reqQty = recipe.ingredients[ing];
        let currentQty = accountMeta.warehouse[ing] || 0;
        if (currentQty < reqQty) {
            missingList.push(`🌾 食材 [${ing}] 不足：尚缺 ${reqQty - currentQty} 個 (需 ${reqQty} 個)`);
        }
    }

    if (missingList.length > 0) {
        showMaterialAlert(missingList, `⚠️ 料理 [${recipe.name}] 所需食材不足`);
        return;
    }

    for (let ing in recipe.ingredients) { 
        accountMeta.warehouse[ing] -= recipe.ingredients[ing]; 
    }
    
    triggerVillageQte("COOK", recipe, (rating) => {
        if (rating === "PERFECT") {
            if (recipe.type === "village_eat") {
                activeVillageBuffs.maxHpAdd += 50;
                currentRun.maxHp += 50;
                currentRun.hp += 50;
                addLog(`🍳👑【皇家廚神・美味絕頂】現場進食！最大 HP 永久加成 +50！`, "perfect");
            } else {
                addLog(`🍳👑【皇家廚神・大成功】雙倍成品！獲得 <strong>${recipe.name} x2</strong>！`, "perfect");
                accountMeta.warehouse[recipe.name] = (accountMeta.warehouse[recipe.name] || 0) + 2;
            }
        } 
        else if (rating === "GOOD") {
            if (recipe.type === "village_eat") {
                activeVillageBuffs.maxHpAdd += 25;
                currentRun.maxHp += 25;
                currentRun.hp += 25;
                addLog(`🍳【進食成功】體能滋補！最大 HP 加成 +25！`, "perfect");
            } else {
                addLog(`🍳【料理烹飪成功】獲得 <strong>${recipe.name} (x1)</strong>！`, "perfect");
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
    let missingList = [];
    for (let ing in blueprint.ingredients) {
        let reqQty = blueprint.ingredients[ing];
        let currentQty = accountMeta.warehouse[ing] || 0;
        if (currentQty < reqQty) {
            missingList.push(`🔨 素材 [${ing}] 不足：尚缺 ${reqQty - currentQty} 個 (需 ${reqQty} 個)`);
        }
    }

    if (missingList.length > 0) {
        showMaterialAlert(missingList, `⚠️ 裝備 [${blueprint.name}] 鍛造素材不足`);
        return;
    }

    for (let ing in blueprint.ingredients) { 
        accountMeta.warehouse[ing] -= blueprint.ingredients[ing]; 
    }
    
    triggerVillageQte("FORGE", blueprint, (rating) => {
        if (rating === "PERFECT") {
            let firstIngKey = Object.keys(blueprint.ingredients)[0];
            if (firstIngKey) {
                accountMeta.warehouse[firstIngKey] = (accountMeta.warehouse[firstIngKey] || 0) + 1;
            }
            addLog(`🔨🌟【神匠顯靈・完美大成功】精工鑄造神裝：<strong>${blueprint.name}</strong>！返還素材 ${firstIngKey} x1！`, "perfect");
            accountMeta.warehouse[blueprint.name] = (accountMeta.warehouse[blueprint.name] || 0) + 1;
        } 
        else if (rating === "GOOD") {
            addLog(`🛠️【鍛造成功】成功鑄造神裝：<strong>${blueprint.name}</strong>！`, "perfect");
            accountMeta.warehouse[blueprint.name] = (accountMeta.warehouse[blueprint.name] || 0) + 1;
        } 
        else {
            addLog(`🚨【鍛造失敗】化為廢鐵：<strong>🪨 焦黑的未知物體</strong>！`, "take");
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
    
    let missingList = [];
    for (let ing in cost) {
        let reqQty = cost[ing];
        let currentQty = accountMeta.warehouse[ing] || 0;
        if (currentQty < reqQty) {
            missingList.push(`🔥 精煉素材 [${ing}] 不足：尚缺 ${reqQty - currentQty} 個 (需 ${reqQty} 個)`);
        }
    }

    if (missingList.length > 0) {
        showMaterialAlert(missingList, `⚠️ 部位精煉升星素材不足`);
        return;
    }

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
    let b = CRAFTING_BLUEPRINTS.find(x => x.name === equipName); if (!b) return;
    accountMeta.warehouse[equipName]--;
    
    let refunded = [];
    for (let ing in b.ingredients) {
        let refundQty = Math.ceil(b.ingredients[ing] * 0.5);
        accountMeta.warehouse[ing] = (accountMeta.warehouse[ing] || 0) + refundQty;
        refunded.push(`${ing} x${refundQty}`);
    }
    
    addLog(`♻️【拆解回收】你成功拆解了 [${equipName}]，獲得原料 ➔ ${refunded.join(", ")}。`, "perfect");
    saveGameData();
    updateUI();
    if(currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

function triggerVillageQte(type, targetData, successCallback) {
    const overlay = document.getElementById('qte-overlay');
    const title = document.getElementById('qte-skill-name');
    const tapBtn = document.getElementById('qte-tap-btn');
    const qteFill = document.getElementById('qte-timer-fill');

    if (!overlay || !title || !tapBtn || !qteFill) return;

    overlay.style.display = "flex";
    isQteActive = true;

    title.innerHTML = `🔨 正在加工：<strong>${targetData.name}</strong> 🔨`;

    let progress = 0;
    qteFill.style.width = "0%";
    tapBtn.innerText = "🎯 點擊判定 (0%)";

    let step = 3; 
    let qteInterval = setInterval(() => {
        if (!isQteActive) { clearInterval(qteInterval); return; }
        progress += step;
        if (progress >= 100) { clearInterval(qteInterval); resolveQteResult("MISS"); } 
        else { qteFill.style.width = progress + "%"; tapBtn.innerText = `🎯 點擊判定 (${Math.floor(progress)}%)`; }
    }, 25);

    function resolveQteResult(rating) {
        isQteActive = false; overlay.style.display = "none";
        successCallback(rating);
    }

    tapBtn.onclick = () => {
        if (!isQteActive) return;
        clearInterval(qteInterval);
        let rating = (progress >= 60 && progress <= 90) ? "PERFECT" : "GOOD";
        resolveQteResult(rating);
    };
}

// --------------------------------------------------------------------------
// 🎲 Zone 8: 隨機事件與遺蹟寶箱開鎖 QTE
// --------------------------------------------------------------------------
function triggerRandomAbyssEvent() {
    let roll = Math.random();
    if (roll < 0.5) {
        // 寶箱 QTE 事件
        addLog(`📦【深淵遺蹟】你在角落發現了一座古老的魔導寶箱！`, "perfect");
        triggerVillageQte("CHEST", { name: "古老寶箱" }, (rating) => {
            if (rating === "PERFECT") {
                let rewardG = 80 + dungeonFloor * 10;
                currentRun.gold += rewardG;
                addLog(`👑🔒【完美破解】獲得爆量金幣 +${rewardG} G！`, "perfect");
            } else if (rating === "GOOD") {
                let rewardG = 40;
                currentRun.gold += rewardG;
                addLog(`🔓【開鎖成功】獲得金幣 +${rewardG} G。`, "perfect");
            } else {
                let trapDmg = 20;
                currentRun.hp = Math.max(1, currentRun.hp - trapDmg);
                addLog(`💥【陷阱引爆】觸發反擊毒素！扣減 ${trapDmg} HP！`, "take");
            }
            resolveAbyssEvent();
        });
    } else {
        // 泉水祝福事件
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 30);
        addLog(`⛲【遠古泉水】遇見淨化泉水，HP 回復 +30。`, "perfect");
        resolveAbyssEvent();
    }
}

function resolveAbyssEvent() { 
    gameState = "ENCOUNTER_RESOLVED"; 
    const mainBtn = document.getElementById('btn-main-action');
    const rerunBtn = document.getElementById('btn-rerun-action');
    if (mainBtn) mainBtn.disabled = false;
    if (rerunBtn) rerunBtn.disabled = false;
    updateUI(); 
    runDungeonLoop(); 
}

// --------------------------------------------------------------------------
// ⚔️ Zone 9: ATB 戰鬥循環、環境 Tick 與戰術 AI
// --------------------------------------------------------------------------
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
            let bossMeta = (typeof BOSS_DATABASE !== "undefined" && BOSS_DATABASE[dungeonFloor]) || { 
                name: `👹 深淵無名魔皇`, 
                baseHp: dungeonFloor * 40, 
                baseAtk: dungeonFloor * 3, 
                baseDef: dungeonFloor * 2,
                baseMdef: dungeonFloor * 2,
                baseSpd: 20, 
                dropItem: "史萊姆黏液" 
            };
            
            // 修復：補齊 Boss 的 def / mdef 欄位
            activeMonster = { 
                name: bossMeta.name, 
                hp: bossMeta.baseHp, 
                maxHp: bossMeta.baseHp, 
                atk: bossMeta.baseAtk, 
                def: bossMeta.baseDef || bossMeta.def || (dungeonFloor * 2),
                mdef: bossMeta.baseMdef || bossMeta.mdef || (dungeonFloor * 2),
                spd: bossMeta.baseSpd, 
                freezeTurns: 0, 
                isSkipped: false, 
                isBoss: true, 
                fixedDrop: bossMeta.dropItem 
            };
            addLog(`🚨迫近🌋【領主降臨 B${dungeonFloor}F】發現大領主：<strong>${activeMonster.name}</strong>！`, "take");
        } else {
            let availableMonsters = (typeof REGULAR_MONSTERS_POOL !== "undefined") ? REGULAR_MONSTERS_POOL.filter(m => dungeonFloor >= m.minFloor && dungeonFloor <= m.maxFloor) : [];
            if (availableMonsters.length === 0 && typeof REGULAR_MONSTERS_POOL !== "undefined") availableMonsters = REGULAR_MONSTERS_POOL;
            
            let rollSeed = availableMonsters[Math.floor(Math.random() * availableMonsters.length)] || { 
                name: "史萊姆", baseHp: 30, hpScale: 10, baseAtk: 5, atkScale: 2, baseDef: 1, baseSpd: 15 
            };
            let scaledHp = Math.floor(rollSeed.baseHp + dungeonFloor * (rollSeed.hpScale || 5));
            let scaledAtk = Math.floor(rollSeed.baseAtk + dungeonFloor * (rollSeed.atkScale || 1));
            let scaledDef = Math.floor((rollSeed.baseDef || 1) + dungeonFloor * 0.5);
            let finalSpd = rollSeed.baseSpd || 15;
            
            // 修復：補齊一般魔物的 def / mdef 欄位
            activeMonster = { 
                name: rollSeed.name, 
                hp: scaledHp, 
                maxHp: scaledHp, 
                atk: scaledAtk, 
                def: scaledDef,
                mdef: scaledDef,
                spd: finalSpd, 
                freezeTurns: 0, 
                isSkipped: false, 
                isBoss: false 
            };
            addLog(`⚔️【降臨 B${dungeonFloor}F】發現魔物：<strong>${activeMonster.name}</strong>`);
        }
        
        updateUI();

        playerAtb = 0; monsterAtb = 0; envAtb = 0; battleTimeElapsed = 0;
        if(combatTickerTimer) clearInterval(combatTickerTimer);

        combatTickerTimer = setInterval(() => {
            if (gameState !== "BATTLE" || !activeMonster || currentRun.hp <= 0 || activeMonster.hp <= 0) {
                clearInterval(combatTickerTimer); return;
            }
            battleTimeElapsed += 0.25;
            playerAtb += (currentRun.spd || 20);
            monsterAtb += (activeMonster.spd || 15);
            envAtb += 15;

            if (envAtb >= 100) { envAtb -= 100; executeEnvironmentTick(); }
            
            // 修復：ATB 溢出處理，防止過高速度卡死迴圈
            if (playerAtb >= 100 && currentRun.hp > 0 && activeMonster && activeMonster.hp > 0) { 
                playerAtb = Math.min(100, playerAtb - 100); 
                executePlayerActionTick(); 
            }
            if (monsterAtb >= 100 && currentRun.hp > 0 && activeMonster && activeMonster.hp > 0) { 
                monsterAtb = Math.min(100, monsterAtb - 100); 
                executeMonsterActionTick(); 
            }
            updateUI();
        }, 250);
    } catch(err) { 
        addLog(`🚨 地下城異常：${err.message}`, "take"); 
    }
}

function executeEnvironmentTick() {
    currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + Math.floor((currentRun.mpRegen || 15) / 2));

    // 環境灼傷與毒素實時傷害 Tick
    if (currentEnvironment === "FIRE") {
        let burnDmg = 5;
        currentRun.hp = Math.max(1, currentRun.hp - burnDmg);
        addLog(`🔥【灼熱環境】岩漿熱浪侵襲，扣減 ${burnDmg} HP！`, "env");
    } else if (currentEnvironment === "POISON") {
        let poisonDmg = Math.floor(currentRun.maxHp * 0.03);
        currentRun.hp = Math.max(1, currentRun.hp - poisonDmg);
        addLog(`🧪【瘴氣劇毒】毒氣攻心，扣減 ${poisonDmg} HP！`, "env");
    }
}

function executePlayerActionTick() {
    // 優先執行戰術 AI
    if (executeAutoBattleAiTurn()) {
        if (activeMonster && activeMonster.hp <= 0) {
            clearInterval(combatTickerTimer); executeDungeonVictorySequence();
        }
        return;
    }

    const isMagicJob = (currentRun.job === "magician" || currentRun.job === "acolyte");
    const baseAtkPower = isMagicJob ? (currentRun.matk || 10) : (currentRun.atk || 15);
    
    let executedSkill = false;

    if (typeof SKILLS_DATABASE !== "undefined") {
        for (let sName of Object.keys(currentRun.skills)) {
            let sMeta = SKILLS_DATABASE[currentRun.job]?.find(s => s.name === sName);
            if (sMeta && sMeta.type === "active" && currentRun.mp >= sMeta.mp && Math.random() < 0.45) {
                executedSkill = true;
                currentRun.mp -= sMeta.mp;
                
                let skLv = currentRun.skills[sName] || 1;
                let eff = sMeta.run(skLv, baseAtkPower, currentRun.maxMp, currentRun.hp, currentRun.maxHp);
                
                triggerProjectileFX(detectProjectileType(sName, currentRun.job));
                let fxClass = detectSkillCssClass(sName);

                let monsterDef = isMagicJob ? (activeMonster.mdef || 0) : (activeMonster.def || 0);
                let dmgRes = calculateDamage(eff.dmg || baseAtkPower, monsterDef, true, isMagicJob);

                if (dmgRes.isMiss) {
                    addLog(`💨 施展 <span class="${fxClass}">【${sName} Lv.${skLv}】</span>，但被魔物 <span class="miss-effect">[MISS 閃過]</span>！<span class="num-popup num-miss">MISS</span>`, "miss");
                } else {
                    activeMonster.hp -= dmgRes.damage;
                    let numClass = isMagicJob ? "num-m-dmg" : "num-p-dmg";
                    let critText = dmgRes.isCrit ? "⚡ 暴擊！" : "";
                    addLog(`💥 核心奧義！${critText}施展 <span class="${fxClass}">【${sName} Lv.${skLv}】</span> 重創 <span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${dmgRes.damage} HP</span>`, "skill-hit");
                    
                    // 被動吸血判定 (Vampirism)
                    if (currentRun.vampRate && currentRun.vampRate > 0) {
                        let vampVal = Math.floor(dmgRes.damage * (currentRun.vampRate / 100));
                        if (vampVal > 0) {
                            currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + vampVal);
                            addLog(`🩸【血脈吸吮】汲取生命 <span class="heal-effect">+${vampVal} HP</span>`, "perfect");
                        }
                    }
                }
                break;
            }
        }
    }

    if (!executedSkill) {
        let monsterDef = isMagicJob ? (activeMonster.mdef || 0) : (activeMonster.def || 0);
        let dmgRes = calculateDamage(baseAtkPower, monsterDef, true, isMagicJob);
        
        if (dmgRes.isMiss) {
            addLog(`💨 揮砍被魔物 <span class="miss-effect">[MISS 閃過]</span> 了！<span class="num-popup num-miss">MISS</span>`, "miss");
        } else {
            activeMonster.hp -= dmgRes.damage; 
            let numClass = isMagicJob ? "num-m-dmg" : "num-p-dmg";
            let critText = dmgRes.isCrit ? "⚡ 暴擊！" : "";
            addLog(`⚔️ 普攻揮砍！${critText}<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${dmgRes.damage} HP</span>`, "deal"); 

            // 補齊：被動連擊 / 殘影追擊 (Double Strike) 判定
            if (currentRun.doubleStrike && Math.random() * 100 < currentRun.doubleStrike && activeMonster.hp > 0) {
                let extraDmg = calculateDamage(Math.floor(baseAtkPower * 0.7), monsterDef, true, isMagicJob);
                if (!extraDmg.isMiss) {
                    activeMonster.hp -= extraDmg.damage;
                    addLog(`⚡【殘影追擊】二次追擊重影！重創 <span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${extraDmg.damage} HP</span>`, "deal");
                }
            }
        }
    }

    if (activeMonster.hp <= 0) { clearInterval(combatTickerTimer); executeDungeonVictorySequence(); }
}

function executeMonsterActionTick() {
    if (activeMonster.freezeTurns > 0) { 
        activeMonster.freezeTurns--; 
        addLog(`❄️ 魔物处于冰凍狀態，無法行動！(剩餘 ${activeMonster.freezeTurns} 回合)`);
        return; 
    }
    
    let monsterAtk = activeMonster.atk || 5;
    let playerDef = currentRun.def || 0;
    
    let dmgRes = calculateDamage(monsterAtk, playerDef, false, false);
    
    if (dmgRes.isMiss) {
        addLog(`💨 勇者身形閃爍，成功 <span class="miss-effect">[MISS 閃過]</span> 了魔物的猛攻！<span class="num-popup num-miss">MISS</span>`, "miss");
        return;
    }

    let finalDmg = dmgRes.damage;
    currentRun.hp -= finalDmg; 
    addLog(`🔴 魔物暴虐反噬！<span class="strike-monster">[${accountMeta.name}]</span> <span class="num-popup num-boss-strike">-${finalDmg} HP</span>`, "take"); 
    if (currentRun.hp <= 0) { clearInterval(combatTickerTimer); executeDungeonDefeatSequence(); }
}

// --------------------------------------------------------------------------
// 🏆 Zone 10: 勝利結算、Boss 天賦、經驗與裝備穿戴
// --------------------------------------------------------------------------
function executeDungeonVictorySequence() {
    let isBossFloor = (dungeonFloor % 10 === 0);
    let rewardG = isBossFloor ? (150 + dungeonFloor * 10) : 20;
    let rewardExp = isBossFloor ? (100 + dungeonFloor * 5) : 15;

    currentRun.gold += rewardG; 
    
    addLog(`👑 <span class="gold-victory-text">VICTORY!</span> 戰鬥勝利！獲得金幣 +${rewardG} G，經驗值 +${rewardExp}。`, "victory-badge");
    
    // Boss 戰特有天賦解鎖彈窗
    if (isBossFloor) {
        triggerBossTalentReward();
    }

    activeMonster = null; 
    addExperience(rewardExp);
}

function triggerBossTalentReward() {
    addLog(`👑🌟【Boss 史詩突破】你征服了 B${dungeonFloor}F 領主，獲得永久血脈天賦覺醒選擇！`, "perfect");
    let talents = ["👑 不滅巨魔血脈 (MaxHP +100)", "⚡ 狂暴神經反射 (SPD +5)", "🩸 殘虐撕裂本能 (CRIT +5%)"];
    let chosen = talents[Math.floor(Math.random() * talents.length)];
    
    if (chosen.includes("MaxHP")) { currentRun.maxHp += 100; currentRun.hp += 100; }
    else if (chosen.includes("SPD")) { currentRun.spd += 5; }
    else if (chosen.includes("CRIT")) { currentRun.critChance += 5; }

    addLog(`✨ 天賦自動覺醒：<strong>${chosen}</strong>！`, "perfect");
}

function executeDungeonDefeatSequence() {
    addLog(`☠️【魂歸深淵】你已被擊敗！本輪經驗清零，但裝備完好。`, "take");
    accountMeta.exp = 0; currentRun.exp = 0;
    gameState = "VILLAGE"; currentEnvironment = "NORMAL";
    
    resetCurrentRunData(); 
    currentRun.hp = currentRun.maxHp; currentRun.mp = currentRun.maxMp;
    
    saveGameData(); updateUI(); switchVillageLocation("GATE");
}

function addExperience(amount) {
    accountMeta.exp = (accountMeta.exp || 0) + amount;
    currentRun.exp = accountMeta.exp;
    checkLevelUpAndTriggerSelect();
}

function checkLevelUpAndTriggerSelect() {
    while (accountMeta.exp >= accountMeta.nextExp) {
        accountMeta.exp -= accountMeta.nextExp;
        accountMeta.lv = (accountMeta.lv || 1) + 1;
        accountMeta.statPoints = (accountMeta.statPoints || 0) + 1; 
        accountMeta.nextExp = Math.floor(accountMeta.nextExp * 1.4);
        addLog(`👑 突破至 <strong>Lv.${accountMeta.lv}</strong>！獲得 1 點能力點數！`, "perfect");
    }
    
    if (gameState === "BATTLE") { 
        let btnMain = document.getElementById('btn-main-action');
        if (btnMain) btnMain.disabled = false; 
    }
    saveGameData();
    updateUI();
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
    resetCurrentRunData(); saveGameData(); updateUI(); if(currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}
