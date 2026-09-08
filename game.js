// ==========================================================================
// 🕹️ game.js：完整地下城戰鬥與狀態異常核心引擎 (Hyper-Optimized Engine)
// ==========================================================================

let combatTickerTimer = null; 
let combatRoundCounter = 1;    

let playerAtb = 0;
let monsterAtb = 0;
let envAtb = 0;
let battleTimeElapsed = 0;

let isQteActive = false;
let activeTactic = "BALANCED";

// 📦 安全物品放入背包/倉庫流轉防護
function safePushToInventory(run, account, itemName) {
    if (!run) return "";
    if (!run.inventory) run.inventory = [];
    
    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;

    if (run.inventory.length < maxBag) {
        run.inventory.push(itemName);
        return `🎒 獲得戰利品 ➔ <strong>[${itemName}]</strong> (已放入隨身背包)`;
    } else {
        if (!account) return `⚠️ 背包已滿，無法取得 [${itemName}]`;
        if (!account.warehouse) account.warehouse = {};
        account.warehouse[itemName] = (account.warehouse[itemName] || 0) + 1;
        return `📦 背包空間已滿！戰利品 ➔ <strong>[${itemName}]</strong> 已自動傳送至地表倉庫！`;
    }
}

// --------------------------------------------------------------------------
// 🛡️ 護盾傷害吸收邏輯 (Shield Absorption Helper)
// --------------------------------------------------------------------------
function applyDamageWithShield(target, rawDamage) {
    if (!target) return { absorbed: 0, actualHpDmg: 0 };
    
    let absorbed = 0;
    let actualHpDmg = rawDamage;

    if (target.shield && target.shield > 0) {
        if (target.shield >= rawDamage) {
            target.shield -= rawDamage;
            absorbed = rawDamage;
            actualHpDmg = 0;
        } else {
            absorbed = target.shield;
            actualHpDmg = rawDamage - target.shield;
            target.shield = 0;
        }
    }

    target.hp = Math.max(0, target.hp - actualHpDmg);
    return { absorbed, actualHpDmg };
}

// --------------------------------------------------------------------------
// 💥 戰鬥特效與多投射物連發機制 (Staggered Multi-Projectiles FX)
// --------------------------------------------------------------------------
function triggerProjectileFX(type = 'arcane', count = 1) {
    const logContainer = document.getElementById('log-box');
    if (!logContainer) return;

    // 限制單次視覺最大投射物數量為 10 發，避免 DOM 過載
    const maxCount = Math.min(count, 10); 
    
    for (let i = 0; i < maxCount; i++) {
        setTimeout(() => {
            const proj = document.createElement('div');
            proj.className = `projectile-entity proj-${type}`;
            proj.innerHTML = `<div class="fx-core"></div>`;
            logContainer.appendChild(proj);

            setTimeout(() => {
                if (proj && proj.parentNode) proj.remove();
            }, 450);
        }, i * 65); // 每發投射物間隔 65ms 陸續飛出
    }
}

function detectProjectileType(skillName, job) {
    if (!skillName) return "arcane";
    if (skillName.includes("火") || skillName.includes("炎") || skillName.includes("爆") || skillName.includes("隕")) return "fire";
    if (skillName.includes("冰") || skillName.includes("霜") || skillName.includes("凍") || skillName.includes("雪")) return "ice";
    if (skillName.includes("雷") || skillName.includes("電") || skillName.includes("震")) return "lightning";
    if (skillName.includes("聖") || skillName.includes("治癒") || skillName.includes("光") || skillName.includes("驅魔")) return "holy";
    if (job === "archer" || job === "hunter" || job === "bard_dancer") return "arrow";
    return "arcane";
}

function detectSkillCssClass(skillName) {
    if (!skillName) return "skill-bash";
    if (skillName.includes("火") || skillName.includes("炎") || skillName.includes("爆") || skillName.includes("隕")) return "skill-fire";
    if (skillName.includes("冰") || skillName.includes("霜") || skillName.includes("凍") || skillName.includes("雪")) return "skill-ice";
    if (skillName.includes("雷") || skillName.includes("電") || skillName.includes("震")) return "skill-lightning";
    if (skillName.includes("聖") || skillName.includes("治癒") || skillName.includes("光") || skillName.includes("頌歌")) return "skill-holy";
    if (skillName.includes("毒")) return "skill-poison";
    return "skill-bash";
}

// --------------------------------------------------------------------------
// 🎮 遊戲啟動與角色登入 flow
// --------------------------------------------------------------------------
async function handleStartGame() {
    const inputName = document.getElementById('player-name-input')?.value;
    const inputPin = document.getElementById('player-pin-input')?.value;

    if (typeof initOrLoadPlayer === "function") {
        const result = await initOrLoadPlayer(inputName, inputPin);

        if (!result || !result.success) {
            console.warn("🔐 PIN 碼驗證失敗，阻擋進入遊戲。");
            return; 
        }

        if (result.isNewUser || !accountMeta.job || accountMeta.job === "novice") {
            renderInitialJobModal(false);
            return;
        }
    }

    enterGameMainShell();
}

// --------------------------------------------------------------------------
// 🎭 職業選擇與重選 Modal
// --------------------------------------------------------------------------
function renderInitialJobModal(isReselect = false) {
    const modal = document.getElementById('initial-job-modal');
    const list = document.getElementById('initial-job-list');
    const titleEl = document.getElementById('job-modal-title');
    if (!modal || !list) return;

    list.innerHTML = "";
    modal.style.display = "flex";

    if (titleEl) {
        titleEl.innerText = isReselect ? "🔄 重選血脈職業 (耗費 1,000 G)" : "🎭 選擇你的初始冒險血脈";
    }

    const jobs = [
        { id: "swordsman", name: "⚔️ 劍士", desc: "高 HP 與物理減傷 (STR/VIT)，近戰重擊。" },
        { id: "magician", name: "🔮 魔法師", desc: "掌控冰火雷奧術 (INT/DEX)，極高魔傷與控場。" },
        { id: "acolyte", name: "✨ 服事", desc: "神聖庇護 (INT/VIT)，百分比自癒與驅魔。" },
        { id: "thief", name: "🗡️ 盜賊", desc: "高閃避與暴擊 (AGI/LUK)，劇毒與連擊。" },
        { id: "archer", name: "🏹 弓箭手", desc: "極速貫穿連射 (DEX/AGI)，遠程爆頭狙擊。" }
    ];

    jobs.forEach(j => {
        const card = document.createElement('div');
        card.style.cssText = `
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(0, 255, 204, 0.3);
            border-radius: 8px; padding: 12px; text-align: left; cursor: pointer; transition: all 0.2s;
            margin-bottom: 6px;
        `;
        card.onmouseover = () => { card.style.borderColor = "#ffd700"; card.style.background = "rgba(255,215,0,0.15)"; };
        card.onmouseout = () => { card.style.borderColor = "rgba(0, 255, 204, 0.3)"; card.style.background = "rgba(0, 0, 0, 0.5)"; };
        
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

    let closeBtn = document.getElementById('initial-job-close-btn');
    if (!closeBtn) {
        closeBtn = document.createElement('button');
        closeBtn.id = 'initial-job-close-btn';
        closeBtn.className = 'btn-game btn-rest';
        closeBtn.style.cssText = 'width: 100%; margin-top: 12px; padding: 8px 0; font-size: 12px; font-weight: bold;';
        closeBtn.innerText = '❌ 取消關閉';
        closeBtn.onclick = () => { modal.style.display = 'none'; };
        const modalCard = modal.querySelector('.modal-card');
        if (modalCard) modalCard.appendChild(closeBtn);
    }
    closeBtn.style.display = isReselect ? 'block' : 'none';
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

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    if (typeof saveGameData === "function") saveGameData();

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
    if (statusPanel) statusPanel.style.display = 'grid';
    if (actionPanel) actionPanel.style.display = 'flex';
    if (villagePanel) villagePanel.style.display = 'block';
    if (logWrapper) logWrapper.style.display = 'block';

    const displayJobName = typeof getJobChineseName === "function" ? getJobChineseName(currentRun.job) : (typeof JOB_DATABASE !== "undefined" && JOB_DATABASE[currentRun.job] ? JOB_DATABASE[currentRun.job].name : currentRun.job);

    if (typeof updateUI === "function") updateUI();
    if (typeof addLog === "function") {
        addLog(`✨ 勇者 <strong>${accountMeta.name || "冒險者"}</strong> 順利踏入深淵邊境！當前血脈職業：<strong>${displayJobName}</strong>。`, "perfect");
    }
}

function executeLearnSkill(skillMeta) {
    if (!accountMeta.skills) accountMeta.skills = {};
    if (!currentRun.skills) currentRun.skills = {};

    const currentLv = (accountMeta.skills[skillMeta.name] || currentRun.skills[skillMeta.name] || 0);
    
    if (typeof canLearnSkill === "function") {
        const check = canLearnSkill(
            { lv: accountMeta.lv || currentRun.lv || 1, gold: currentRun.gold },
            skillMeta,
            accountMeta.warehouse || {},
            currentLv
        );

        if (!check.canLearn) {
            if (typeof showMaterialAlert === "function") {
                showMaterialAlert([check.reason], `⚠️ 技能 [${skillMeta.name}] 研習失敗`);
            } else {
                alert(check.reason);
            }
            return;
        }
    }

    const nextLv = currentLv + 1;
    const goldCost = skillMeta.goldCost * nextLv;
    
    currentRun.gold -= goldCost;
    for (let mat in skillMeta.reqMat) {
        let reqQty = skillMeta.reqMat[mat] * nextLv;
        if (accountMeta.warehouse[mat]) {
            accountMeta.warehouse[mat] -= reqQty;
        }
    }

    accountMeta.skills[skillMeta.name] = nextLv;
    currentRun.skills[skillMeta.name] = nextLv;

    if (currentLv === 0) {
        if (typeof addLog === "function") addLog(`🎓🎓【公會技能傳承】成功領悟專屬奧義 ➔ <strong>[${skillMeta.name}] (Lv.1)</strong>！`, "perfect");
    } else {
        if (typeof addLog === "function") addLog(`🎓✨【公會技能突破】成功將奧義 ➔ <strong>[${skillMeta.name}]</strong> 提升至 <strong>Lv.${nextLv}</strong>！`, "perfect");
    }

    if (skillMeta.type === "passive" && typeof resetCurrentRunData === "function") {
        resetCurrentRunData();
    }

    if (typeof saveGameData === "function") saveGameData();
    if (typeof updateUI === "function") updateUI();
    if (typeof renderVillageGuild === "function") renderVillageGuild();
}

function executeResetStats() {
    const goldAvailable = (currentRun && currentRun.gold !== undefined) ? currentRun.gold : (accountMeta ? accountMeta.gold : 0);
    if (goldAvailable < 300) {
        const msg = `🪙 金幣不足：洗點需要 300 G (當前僅有 ${goldAvailable} G)`;
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert([msg], "⚠️ 金幣不足");
        } else {
            alert(msg);
        }
        return;
    }

    currentRun.gold -= 300;

    const s = accountMeta.stats || { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    const totalAllocated = (s.STR || 0) + (s.AGI || 0) + (s.VIT || 0) + (s.INT || 0) + (s.DEX || 0) + (s.LUK || 0);

    accountMeta.statPoints = (accountMeta.statPoints || 0) + totalAllocated;
    accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    if (typeof saveGameData === "function") saveGameData();
    if (typeof addLog === "function") addLog(`🎯⚖️【洗點完畢】已退還 <strong>${totalAllocated} 點</strong> 自由能力點數！`, "perfect");
    if (typeof updateUI === "function") updateUI();
}

function triggerReselectJobUI() {
    const goldAvailable = (currentRun && currentRun.gold !== undefined) ? currentRun.gold : (accountMeta ? accountMeta.gold : 0);
    
    if (goldAvailable < 1000) {
        const msg = `🪙 金幣不足：轉職洗禮需要 1,000 G (當前僅有 ${goldAvailable} G)`;
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert([msg], "⚠️ 金幣不足");
        } else {
            alert(msg);
        }
        return;
    }

    renderInitialJobModal(true);
}

function executeReselectJob(newJobId) {
    if (currentRun.gold < 1000) {
        const msg = `🪙 金幣不足：轉職洗禮需要 1,000 G`;
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert([msg], "⚠️ 金幣不足");
        } else {
            alert(msg);
        }
        return;
    }

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

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    if (typeof saveGameData === "function") saveGameData();

    const displayJobName = typeof getJobChineseName === "function" ? getJobChineseName(newJobId) : (typeof JOB_DATABASE !== "undefined" && JOB_DATABASE[newJobId] ? JOB_DATABASE[newJobId].name : newJobId);

    if (typeof addLog === "function") {
        addLog(`🔄⚖️【轉職洗禮完成】已成功將血脈重置為 ➔ <strong>${displayJobName} (Lv.1)</strong>！`, "perfect");
    }
    
    if (typeof updateUI === "function") updateUI();
    if (typeof renderVillageGuild === "function") renderVillageGuild();
}

function toggleTacticsDrawer() {
    const drawer = document.getElementById('tactics-drawer-box');
    if (drawer) drawer.classList.toggle('expanded');
}

function selectTactic(tacticMode) {
    activeTactic = tacticMode;
    syncTacticButtonsUi();
    if (typeof addLog === "function") {
        addLog(`🛡️【戰術切換】當前戰術姿態調控為：<strong>${tacticMode === 'OFFENSIVE' ? '🔥 狂暴強擊' : tacticMode === 'BALANCED' ? '🛡️ 均衡防守' : '🎮 手動微操'}</strong>`, "perfect");
    }
}

function syncTacticButtonsUi() {
    const modes = ['MANUAL', 'BALANCED', 'OFFENSIVE'];
    modes.forEach(m => {
        const btn = document.getElementById(`tactic-btn-${m}`);
        if (btn) btn.classList.toggle('active', activeTactic === m);
    });
}

function executeAutoBattleAiTurn() {
    if (activeTactic === "MANUAL") return false;

    const hpPercent = (currentRun.hp / currentRun.maxHp) * 100;
    
    if (activeTactic === "BALANCED" && hpPercent < 35 && currentRun.inventory) {
        let foodIdx = currentRun.inventory.findIndex(item => item.includes("牛巨堡") || item.includes("料理"));
        if (foodIdx !== -1) {
            executeUseDungeonItem(currentRun.inventory[foodIdx], foodIdx);
            return true;
        }
    }

    if (hpPercent < 60 && currentRun.skills && currentRun.skills["治癒術"] && currentRun.mp >= 20) {
        const skLv = currentRun.skills["治癒術"];
        const healAmount = Math.floor(currentRun.maxHp * (0.18 + skLv * 0.08));
        currentRun.mp -= 20;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healAmount);
        if (typeof addLog === "function") {
            addLog(`✨ 智能 AI 自動觸發 <span class="skill-holy">【治癒術 Lv.${skLv}】</span> 回復 <span class="heal-effect">+${healAmount} HP</span>！`, "perfect");
        }
        return true;
    }

    if (activeTactic === "OFFENSIVE" && typeof SKILLS_DATABASE !== "undefined") {
        const jobSkills = SKILLS_DATABASE[currentRun.job] || [];
        for (let i = jobSkills.length - 1; i >= 0; i--) {
            let sMeta = jobSkills[i];
            if (currentRun.skills && currentRun.skills[sMeta.name] && currentRun.mp >= sMeta.mp) {
                let skLv = currentRun.skills[sMeta.name];
                let isMagicJob = (currentRun.job === "magician" || currentRun.job === "acolyte" || currentRun.job === "wizard" || currentRun.job === "priest" || currentRun.job === "sage");
                let baseAtkPower = isMagicJob ? (currentRun.matk || 10) : (currentRun.atk || 15);
                let eff = sMeta.run(skLv, baseAtkPower, currentRun.maxMp, currentRun.hp, currentRun.maxHp);
                
                if (eff.dmg && activeMonster) {
                    currentRun.mp -= sMeta.mp;
                    triggerProjectileFX(detectProjectileType(sMeta.name, currentRun.job));
                    let fxClass = detectSkillCssClass(sMeta.name);

                    let monsterDef = (isMagicJob || eff.isMagic) ? (activeMonster.mdef || 0) : (activeMonster.def || 0);
                    let dmgRes = typeof calculateDamage === "function" ? calculateDamage(eff.dmg, monsterDef, true, (isMagicJob || eff.isMagic)) : { damage: eff.dmg, isMiss: false };

                    if (dmgRes.isMiss) {
                        if (typeof addLog === "function") addLog(`💨 狂暴發動 <span class="${fxClass}">【${sMeta.name} Lv.${skLv}】</span>，但被 <span class="miss-effect">[MISS 閃過]</span>！`, "miss");
                    } else {
                        let res = applyDamageWithShield(activeMonster, dmgRes.damage);
                        let shieldText = res.absorbed > 0 ? `🛡️ 護盾吸收 ${res.absorbed} | ` : "";
                        if (typeof addLog === "function") {
                            addLog(`🔥 AI 狂暴指令！施展 <span class="${fxClass}">【${sMeta.name} Lv.${skLv}】</span> 重創 <span class="strike-slash">[${activeMonster.name}]</span> ${shieldText}<span class="num-popup num-p-dmg">-${res.actualHpDmg} HP</span>`, "skill-hit");
                        }
                    }
                    return true;
                }
            }
        }
    }

    return false;
}

function handleMainAction() {
    try {
        if (gameState === "VILLAGE") {
            gameState = "BATTLE";
            dungeonFloor = 1;
            const secBtn = document.getElementById('btn-secondary-action');
            if (secBtn) {
                secBtn.style.display = "block";
                secBtn.innerText = "🏃 撤退逃回地表村莊";
            }
            if (typeof updateUI === "function") updateUI();
            runDungeonLoop();
        } else if (gameState === "BATTLE") {
            dungeonFloor++;
            if (typeof updateUI === "function") updateUI();
            runDungeonLoop();
        }
    } catch(err) {
        if (typeof addLog === "function") addLog(`🚨【動作發動失敗】主按鈕鏈接錯誤：${err.message}`, "take");
    }
}

function handleRerunAction() {
    try {
        if (combatTickerTimer) clearInterval(combatTickerTimer);
        if (typeof addLog === "function") addLog(`🔄【重巡整備】你留在深淵 B${dungeonFloor}F 進行重巡狩獵，戰局重新載入！`, "perfect");
        gameState = "BATTLE";
        
        const mainBtn = document.getElementById('btn-main-action');
        const rerunBtn = document.getElementById('btn-rerun-action');
        if (mainBtn) mainBtn.disabled = false;
        if (rerunBtn) rerunBtn.disabled = false;

        if (typeof updateUI === "function") updateUI();
        runDungeonLoop();
    } catch(err) {
        if (typeof addLog === "function") addLog(`🚨【重巡失敗】: ${err.message}`, "take");
    }
}

function handleSecondaryAction() {
    if (combatTickerTimer) clearInterval(combatTickerTimer);
    gameState = "VILLAGE";
    currentEnvironment = "NORMAL";
    
    const secBtn = document.getElementById('btn-secondary-action');
    if (secBtn) secBtn.style.display = "none";
    
    if (isQteActive) {
        isQteActive = false;
        const qteOverlay = document.getElementById('qte-overlay');
        if (qteOverlay) qteOverlay.style.display = 'none';
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
    
    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    currentRun.hp = currentRun.maxHp;
    currentRun.mp = currentRun.maxMp;
    currentRun.shield = 0;
    currentRun.poisonStacks = 0;
    currentRun.burnStacks = 0;

    if (typeof saveGameData === "function") saveGameData(); 

    if (typeof addLog === "function") {
        addLog(`🏃【撤退成功】你驚險逃回地表村莊！等級與裝備完美保留，素材已安全歸倉！`, "perfect");
        addLog(`💖💾【村莊泉水庇護】狀態已全額恢復，遊戲進度與歷史紀錄 (最高 B${accountMeta.maxFloor || 1}F) 已自動存檔！`, "perfect");
    }

    if (typeof updateUI === "function") updateUI();
    if (typeof switchVillageLocation === "function") switchVillageLocation("GATE");
}

function removeBagItem(index) {
    if (!currentRun.inventory || index < 0 || index >= currentRun.inventory.length) return;
    
    const itemName = currentRun.inventory.splice(index, 1)[0];
    accountMeta.warehouse[itemName] = (accountMeta.warehouse[itemName] || 0) + 1;
    
    if (typeof addLog === "function") addLog(`📦 已將 <strong>${itemName}</strong> 放回倉庫。`);
    if (typeof saveGameData === "function") saveGameData();
    if (typeof updateUI === "function") updateUI();
}

function executeUseDungeonItem(itemName, index) {
    if (gameState !== "BATTLE" || !activeMonster) return;
    if (typeof addLog === "function") addLog(`⚡🎒【快捷物資微操】勇者果斷捏碎消耗品 ➔ <strong>${itemName}</strong>！`, "deal");
    
    // 1. 回復 HP 類
    if (itemName.includes("厚牛巨堡") || itemName.includes("料理") || itemName.includes("牛扒") || itemName.includes("炸薯")) {
        let healVal = Math.floor(currentRun.maxHp * 0.5);
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healVal);
        if (typeof addLog === "function") addLog(`🌭 熱量充能！血量大幅度回復 <span class="heal-effect">+${healVal} HP</span>！`, "perfect");
    }
    else if (itemName.includes("烤野豬肉") || itemName.includes("初級治癒")) {
        let healVal = 60;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healVal);
        if (typeof addLog === "function") addLog(`🥩 生命回復 <span class="heal-effect">+${healVal} HP</span>！`, "perfect");
    }
    else if (itemName.includes("強效魔藥") || itemName.includes("壁虎乾")) {
        let healVal = 180;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healVal);
        if (typeof addLog === "function") addLog(`🧪 強效滋補！生命回復 <span class="heal-effect">+${healVal} HP</span>！`, "perfect");
    }
    // 2. 回復 MP 類
    else if (itemName.includes("回魔劑") || itemName.includes("瓊漿")) {
        let mpVal = 80;
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + mpVal);
        if (typeof addLog === "function") addLog(`🍷 魔力泉湧！回復 <span class="heal-effect">+${mpVal} MP</span>！`, "perfect");
    }
    // 3. 特殊控場與即死類
    else if (itemName.includes("永凍刨冰")) {
        activeMonster.freezeTurns = (activeMonster.freezeTurns || 0) + 2;
        if (typeof addLog === "function") addLog(`❄️ 冰爽極限！魔物被徹底凍結 <strong>2 回合</strong> 無法行動！`, "perfect");
    }
    else if (itemName.includes("禁忌血釀")) {
        let selfDmg = Math.floor(currentRun.hp * 0.2);
        currentRun.hp = Math.max(1, currentRun.hp - selfDmg);
        activeMonster.hp = 0;
        if (typeof addLog === "function") addLog(`🍷 獻祭血液扣減 ${selfDmg} HP，釋放禁忌詛咒秒殺魔物！`, "take");
        if (combatTickerTimer) clearInterval(combatTickerTimer);
        executeDungeonVictorySequence();
        return;
    }
    else if (itemName.includes("未知物體")) {
        let dmg = currentEnvironment === "POISON" ? 30 : 15;
        currentRun.hp = Math.max(1, currentRun.hp - dmg);
        if (typeof addLog === "function") addLog(`🪨 焦黑物體反噬扣血！扣減 ${dmg} HP！`, "take");
    }
    else {
        let genericHeal = 40;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + genericHeal);
        if (typeof addLog === "function") addLog(`🍙 食用物資，回復 <span class="heal-effect">+${genericHeal} HP</span>。`, "perfect");
    }
    
    currentRun.inventory.splice(index, 1);
    if (typeof updateUI === "function") updateUI();
}

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
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert(missingList, `⚠️ 料理 [${recipe.name}] 所需食材不足`);
        }
        return;
    }

    for (let ing in recipe.ingredients) { 
        accountMeta.warehouse[ing] -= recipe.ingredients[ing]; 
    }
    
    triggerVillageQte("COOK", recipe, (rating) => {
        if (rating === "PERFECT") {
            if (recipe.type === "village_eat") {
                if (typeof activeVillageBuffs !== "undefined") activeVillageBuffs.maxHpAdd += 50;
                currentRun.maxHp += 50;
                currentRun.hp += 50;
                if (typeof addLog === "function") addLog(`🍳👑【皇家廚神・美味絕頂】現場進食！最大 HP 永久加成 +50！`, "perfect");
            } else {
                if (typeof addLog === "function") addLog(`🍳👑【皇家廚神・大成功】雙倍成品！獲得 <strong>${recipe.name} x2</strong>！`, "perfect");
                accountMeta.warehouse[recipe.name] = (accountMeta.warehouse[recipe.name] || 0) + 2;
            }
        } 
        else if (rating === "GOOD") {
            if (recipe.type === "village_eat") {
                if (typeof activeVillageBuffs !== "undefined") activeVillageBuffs.maxHpAdd += 25;
                currentRun.maxHp += 25;
                currentRun.hp += 25;
                if (typeof addLog === "function") addLog(`🍳【進食成功】體能滋補！最大 HP 加成 +25！`, "perfect");
            } else {
                if (typeof addLog === "function") addLog(`🍳【料理烹飪成功】獲得 <strong>${recipe.name} (x1)</strong>！`, "perfect");
                accountMeta.warehouse[recipe.name] = (accountMeta.warehouse[recipe.name] || 0) + 1;
            }
        } 
        else {
            if (typeof addLog === "function") addLog(`💥【料理大失敗】湯汁溢出熔毀，化為：<strong>🪨 焦黑的未知物體</strong>！`, "take");
            accountMeta.warehouse["🪨 焦黑的未知物體"] = (accountMeta.warehouse["🪨 焦黑的未知物體"] || 0) + 1;
        }
        if (typeof saveGameData === "function") saveGameData(); 
        if (typeof updateUI === "function") updateUI(); 
        if (typeof renderVillageCookingWorkshop === "function") renderVillageCookingWorkshop();
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
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert(missingList, `⚠️ 裝備 [${blueprint.name}] 鍛造素材不足`);
        }
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
            if (typeof addLog === "function") addLog(`🔨🌟【神匠顯靈・完美大成功】精工鑄造神裝：<strong>${blueprint.name}</strong>！返還素材 ${firstIngKey} x1！`, "perfect");
            accountMeta.warehouse[blueprint.name] = (accountMeta.warehouse[blueprint.name] || 0) + 1;
        } 
        else if (rating === "GOOD") {
            if (typeof addLog === "function") addLog(`🛠️【鍛造成功】成功鑄造神裝：<strong>${blueprint.name}</strong>！`, "perfect");
            accountMeta.warehouse[blueprint.name] = (accountMeta.warehouse[blueprint.name] || 0) + 1;
        } 
        else {
            if (typeof addLog === "function") addLog(`🚨【鍛造失敗】化為廢鐵：<strong>🪨 焦黑的未知物體</strong>！`, "take");
            accountMeta.warehouse["🪨 焦黑的未知物體"] = (accountMeta.warehouse["🪨 焦黑的未知物體"] || 0) + 1;
        }
        if (typeof saveGameData === "function") saveGameData(); 
        if (typeof updateUI === "function") updateUI(); 
        if (currentVillageLocation === "WORKSHOP" && typeof renderVillageWorkshop === "function") renderVillageWorkshop();
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

// ==========================================================================
// ⚒️ 單一藍圖裝備獨立強化系統 (+1 ~ +20 安定/降階/爆裝修羅道)
// ==========================================================================
function refineSpecificEquipment(equipName) {
    if (!accountMeta.itemRefines) accountMeta.itemRefines = {};

    const curLvl = accountMeta.itemRefines[equipName] || 0;

    // 1. 上限檢查
    if (curLvl >= 20) {
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert([`[${equipName}] 已達到最高強化極限 (+20)！`], "🌟 已達神裝頂峰");
        }
        return;
    }

    const nextLvl = curLvl + 1;

    // 2. 強化金幣需求
    const goldCost = nextLvl * 100;
    if ((currentRun.gold || 0) < goldCost) {
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert([`強化至 +${nextLvl} 需要 🪙 ${goldCost} G (當前僅有 ${currentRun.gold || 0} G)`], "⚠️ 金幣不足");
        }
        return;
    }

    currentRun.gold -= goldCost;

    // 3. 設定三階段機率與失敗懲罰類型
    let successRate = 1.0;
    let failureType = "NONE"; 

    if (nextLvl <= 5) {
        // 🟢【新手安定期】(+1 ~ +5)：100% 成功
        successRate = 1.00;
        failureType = "NONE";
    } 
    else if (nextLvl <= 10) {
        // 🟡【過渡陣痛期】(+6 ~ +10)：70% ~ 30%，失敗退回 1 階
        const transitionRates = { 6: 0.70, 7: 0.60, 8: 0.50, 9: 0.40, 10: 0.30 };
        successRate = transitionRates[nextLvl];
        failureType = "DOWNGRADE";
    } 
    else {
        // 🔴【神裝修羅道】(+11 ~ +20)：15% ~ 0.5%，失敗裝備直接永久破壞
        const shuraRates = {
            11: 0.15, 12: 0.12, 13: 0.10, 14: 0.08, 15: 0.05,
            16: 0.04, 17: 0.03, 18: 0.02, 19: 0.01, 20: 0.005
        };
        successRate = shuraRates[nextLvl] || 0.005;
        failureType = "BREAK";
    }

    // 4. 進行機率判定
    const roll = Math.random();

    if (roll < successRate) {
        accountMeta.itemRefines[equipName] = nextLvl;
        if (typeof addLog === "function") addLog(`🎉【強化成功！】<strong>[${equipName}]</strong> 成功升級至 <span style="color:#ffd700; font-weight:bold;">+${nextLvl}</span>！(消耗 ${goldCost} G)`, "perfect");
        if (typeof showToast === "function") showToast(`✨ [${equipName}] 成功強化至 +${nextLvl}！`, "success");
    } else {
        if (failureType === "DOWNGRADE") {
            const newLvl = Math.max(0, curLvl - 1);
            accountMeta.itemRefines[equipName] = newLvl;
            if (typeof addLog === "function") addLog(`💥【強化失敗！】<strong>[${equipName}]</strong> 能量反噬倒退 1 級，降至 <strong>+${newLvl}</strong>！`, "take");
            if (typeof showToast === "function") showToast(`💥 [${equipName}] 強化失敗，降至 +${newLvl}`, "warn");
        } 
        else if (failureType === "BREAK") {
            let isEquipped = false;
            for (let slot in accountMeta.equipment) {
                if (accountMeta.equipment[slot] === equipName) {
                    accountMeta.equipment[slot] = null; 
                    isEquipped = true;
                    break;
                }
            }

            if (!isEquipped && accountMeta.warehouse && accountMeta.warehouse[equipName] > 0) {
                accountMeta.warehouse[equipName]--;
            }

            accountMeta.itemRefines[equipName] = 0;

            if (typeof addLog === "function") addLog(`☠️💥【神裝碎裂！爆裝！】<strong>[${equipName}] (+${curLvl})</strong> 在修羅道極限強化中承受不住魔力衝擊，<strong>完全碎裂永久破壞</strong>！`, "take");
            if (typeof showMaterialAlert === "function") {
                showMaterialAlert([`💥 裝備 [${equipName}] (+${curLvl}) 在衝擊 +${nextLvl} 時承受不住魔力，完全碎裂銷毀！`], "☠️ 裝備完全破壞");
            }
        } 
        else {
            if (typeof addLog === "function") addLog(`❌【強化失敗！】<strong>[${equipName}]</strong> 等級保持 <strong>+${curLvl}</strong> 不變。`, "miss");
        }
    }

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    if (typeof saveGameData === "function") saveGameData();
    if (typeof updateUI === "function") updateUI();
    if (currentVillageLocation === "WORKSHOP" && typeof renderVillageWorkshop === "function") {
        renderVillageWorkshop();
    }
}

function executeDismantle(equipName) {
    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    let b = CRAFTING_BLUEPRINTS.find(x => x.name === equipName); 
    if (!b) return;

    if (accountMeta.warehouse[equipName]) accountMeta.warehouse[equipName]--;
    
    let refunded = [];
    for (let ing in b.ingredients) {
        let refundQty = Math.ceil(b.ingredients[ing] * 0.5);
        accountMeta.warehouse[ing] = (accountMeta.warehouse[ing] || 0) + refundQty;
        refunded.push(`${ing} x${refundQty}`);
    }
    
    if (typeof addLog === "function") addLog(`♻️【拆解回收】你成功拆解了 [${equipName}]，獲得原料 ➔ ${refunded.join(", ")}。`, "perfect");
    if (typeof saveGameData === "function") saveGameData();
    if (typeof updateUI === "function") updateUI();
    if (currentVillageLocation === "WORKSHOP" && typeof renderVillageWorkshop === "function") renderVillageWorkshop();
}

function triggerVillageQte(type, targetData, successCallback) {
    const overlay = document.getElementById('qte-overlay');
    const title = document.getElementById('qte-skill-name');
    const tapBtn = document.getElementById('qte-tap-btn');
    const qteFill = document.getElementById('qte-timer-fill');

    if (!overlay || !title || !tapBtn || !qteFill) {
        if (successCallback) successCallback("GOOD");
        return;
    }

    overlay.style.display = "flex";
    isQteActive = true;

    title.innerHTML = `🔨 正在加工：<strong>${targetData.name}</strong> 🔨`;

    let progress = 0;
    qteFill.style.width = "0%";
    tapBtn.innerText = "🎯 點擊判定 (0%)";

    const step = 3; 
    const qteInterval = setInterval(() => {
        if (!isQteActive) { clearInterval(qteInterval); return; }
        progress += step;
        if (progress >= 100) { 
            resolveQteResult("MISS"); 
        } else { 
            qteFill.style.width = progress + "%"; 
            tapBtn.innerText = `🎯 點擊判定 (${Math.floor(progress)}%)`; 
        }
    }, 25);

    function resolveQteResult(rating) {
        if (!isQteActive) return;
        isQteActive = false;
        if (qteInterval) clearInterval(qteInterval);
        tapBtn.onclick = null;
        overlay.style.display = "none";
        if (successCallback) successCallback(rating);
    }

    tapBtn.onclick = () => {
        if (!isQteActive) return;
        let rating = (progress >= 60 && progress <= 90) ? "PERFECT" : "GOOD";
        resolveQteResult(rating);
    };
}

function triggerRandomAbyssEvent() {
    const roll = Math.random();
    
    if (roll < 0.5 && typeof drawRandomChest === "function") {
        const chest = drawRandomChest();

        let difficulty = "easy";
        if (chest.tier === 1 || chest.tier === 2) difficulty = "hard"; 
        else if (chest.tier === 3) difficulty = "medium"; 
        else if (chest.tier === 4) difficulty = "easy";  

        if (typeof addLog === "function") {
            addLog(`📦【深淵遺蹟】你在角落發現了一座 <strong style="color:${chest.color || '#ffd700'};">[${chest.name}] (${chest.tierName || '普通'})</strong>！`, "perfect");
        }

        if (typeof openChestInspectionModal === "function") {
            openChestInspectionModal(chest.name, difficulty, (isForcedOpen) => {
                if (typeof openChestAndGetLoot === "function") {
                    const lootRes = openChestAndGetLoot(chest, currentRun, accountMeta);
                    
                    if (!isForcedOpen) {
                        if (typeof addLog === "function") {
                            addLog(`👑🔒【360°解鎖成功】完美開鎖！獲得金幣 <span class="gold-victory-text">+${lootRes.gold} G</span>！`, "perfect");
                            addLog(lootRes.msg, "perfect");
                        }
                    } else {
                        const halfGold = Math.floor(lootRes.gold * 0.5);
                        currentRun.gold = Math.max(0, currentRun.gold - (lootRes.gold - halfGold)); 

                        if (typeof addLog === "function") {
                            addLog(`🔓【強行撬鎖】撬開了寶箱！獲得折半金幣 +${halfGold} G。`, "perfect");
                            addLog(lootRes.msg, "perfect");
                        }
                    }
                }

                if (typeof saveGameData === "function") saveGameData();
                resolveAbyssEvent();
            });
        } else {
            resolveAbyssEvent();
        }
    } else {
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 30);
        if (typeof addLog === "function") addLog(`⛲【遠古泉水】遇見淨化泉水，HP 回復 +30。`, "perfect");
        resolveAbyssEvent();
    }
}

function resolveAbyssEvent() { 
    gameState = "ENCOUNTER_RESOLVED"; 
    const mainBtn = document.getElementById('btn-main-action');
    const rerunBtn = document.getElementById('btn-rerun-action');
    if (mainBtn) mainBtn.disabled = false;
    if (rerunBtn) rerunBtn.disabled = false;
    if (typeof updateUI === "function") updateUI(); 
    runDungeonLoop(); 
}

// --------------------------------------------------------------------------
// ⚔️ 地下城主戰鬥迴圈 (Dungeon Loop Engine)
// --------------------------------------------------------------------------
async function runDungeonLoop() {
    try {
        const mainBtn = document.getElementById('btn-main-action');
        if (mainBtn) mainBtn.disabled = true;
        const rerunBtn = document.getElementById('btn-rerun-action');
        if (rerunBtn) rerunBtn.disabled = true;

        const isBossFloor = (dungeonFloor % 10 === 0);
        if (!isBossFloor && Math.random() < 0.25 && gameState !== "ENCOUNTER_RESOLVED") {
            gameState = "ENCOUNTER"; 
            if (typeof updateUI === "function") updateUI(); 
            triggerRandomAbyssEvent(); 
            return; 
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
            
            activeMonster = { 
                name: bossMeta.name, 
                hp: bossMeta.baseHp, 
                maxHp: bossMeta.baseHp, 
                atk: bossMeta.baseAtk, 
                def: bossMeta.baseDef || bossMeta.def || (dungeonFloor * 2),
                mdef: bossMeta.baseMdef || bossMeta.mdef || (dungeonFloor * 2),
                spd: bossMeta.baseSpd, 
                shield: 0,
                poisonStacks: 0,
                burnStacks: 0,
                freezeTurns: 0, 
                stunTurns: 0,
                isSkipped: false, 
                isBoss: true, 
                fixedDrop: bossMeta.dropItem 
            };
            if (typeof addLog === "function") addLog(`🚨迫近🌋【領主降臨 B${dungeonFloor}F】發現大領主：<strong>${activeMonster.name}</strong>！`, "take");
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
            
            activeMonster = { 
                name: rollSeed.name, 
                hp: scaledHp, 
                maxHp: scaledHp, 
                atk: scaledAtk, 
                def: scaledDef,
                mdef: scaledDef,
                spd: finalSpd, 
                shield: 0,
                poisonStacks: 0,
                burnStacks: 0,
                freezeTurns: 0, 
                stunTurns: 0,
                isSkipped: false, 
                isBoss: false 
            };
            if (typeof addLog === "function") addLog(`⚔️【降臨 B${dungeonFloor}F】發現魔物：<strong>${activeMonster.name}</strong>`);
        }
        
        if (typeof updateUI === "function") updateUI();

        playerAtb = 0; monsterAtb = 0; envAtb = 0; battleTimeElapsed = 0;
        if (combatTickerTimer) clearInterval(combatTickerTimer);

        combatTickerTimer = setInterval(() => {
            if (gameState !== "BATTLE" || !activeMonster || currentRun.hp <= 0 || activeMonster.hp <= 0) {
                clearInterval(combatTickerTimer); 
                return;
            }
            battleTimeElapsed += 0.25;
            playerAtb += (currentRun.spd || 20);
            monsterAtb += (activeMonster.spd || 15);
            envAtb += 15;

            if (envAtb >= 100) { envAtb -= 100; executeEnvironmentTick(); }
            if (playerAtb >= 100 && currentRun.hp > 0 && activeMonster && activeMonster.hp > 0) { 
                playerAtb = Math.min(100, playerAtb - 100); 
                executePlayerActionTick(); 
            }
            if (monsterAtb >= 100 && currentRun.hp > 0 && activeMonster && activeMonster.hp > 0) { 
                monsterAtb = Math.min(100, monsterAtb - 100); 
                executeMonsterActionTick(); 
            }
            if (typeof updateUI === "function") updateUI();
        }, 250);
    } catch(err) { 
        if (typeof addLog === "function") addLog(`🚨 地下城異常：${err.message}`, "take"); 
    }
}

function executeEnvironmentTick() {
    currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + Math.floor((currentRun.mpRegen || 15) / 2));

    if (currentEnvironment === "FIRE") {
        let burnDmg = 5;
        let res = applyDamageWithShield(currentRun, burnDmg);
        if (typeof addLog === "function") addLog(`🔥【灼熱環境】岩漿熱浪侵襲，扣減 ${res.actualHpDmg} HP！`, "env");
    } else if (currentEnvironment === "POISON") {
        let poisonDmg = Math.floor(currentRun.maxHp * 0.03);
        let res = applyDamageWithShield(currentRun, poisonDmg);
        if (typeof addLog === "function") addLog(`🧪【瘴氣劇毒】毒氣攻心，扣減 ${res.actualHpDmg} HP！`, "env");
    }
}

// --------------------------------------------------------------------------
// 🗡️ 玩家行動 Tick (支援多段動態打擊)
// --------------------------------------------------------------------------
function executePlayerActionTick() {
    if (activeMonster && activeMonster.hp > 0) {
        if (activeMonster.poisonStacks > 0) {
            let poisonDmg = Math.floor(activeMonster.poisonStacks * 15 + activeMonster.maxHp * 0.02);
            let res = applyDamageWithShield(activeMonster, poisonDmg);
            if (typeof addLog === "function") addLog(`🧪【劇毒蔓延】<span class="strike-slash">[${activeMonster.name}]</span> 受到 <span class="skill-poison">${activeMonster.poisonStacks} 層劇毒</span> 蝕骨打擊 <span class="num-popup num-p-dmg">-${res.actualHpDmg} HP</span>`, "env");
        }
        if (activeMonster.burnStacks > 0) {
            let burnDmg = Math.floor(activeMonster.burnStacks * 20);
            let res = applyDamageWithShield(activeMonster, burnDmg);
            activeMonster.burnStacks = Math.max(0, activeMonster.burnStacks - 1);
            if (typeof addLog === "function") addLog(`🔥【烈焰灼燒】<span class="strike-slash">[${activeMonster.name}]</span> 被火焰灼燒 <span class="num-popup num-p-dmg">-${res.actualHpDmg} HP</span>`, "env");
        }
    }

    if (activeMonster && activeMonster.hp <= 0) {
        if (combatTickerTimer) clearInterval(combatTickerTimer);
        executeDungeonVictorySequence();
        return;
    }

    if (executeAutoBattleAiTurn()) {
        if (activeMonster && activeMonster.hp <= 0) {
            if (combatTickerTimer) clearInterval(combatTickerTimer); 
            executeDungeonVictorySequence();
        }
        return;
    }

    const isMagicJob = (currentRun.job === "magician" || currentRun.job === "acolyte" || currentRun.job === "wizard" || currentRun.job === "priest" || currentRun.job === "sage");
    const baseAtkPower = isMagicJob ? (currentRun.matk || 10) : (currentRun.atk || 15);
    let executedSkill = false;

    if (typeof SKILLS_DATABASE !== "undefined") {
        let availableSkills = typeof getAllSkillsForJob === "function" ? getAllSkillsForJob(currentRun.job) : (SKILLS_DATABASE[currentRun.job] || []);

        for (let sMeta of availableSkills) {
            if (sMeta.type !== "active") continue;
            let skLv = (currentRun.skills && currentRun.skills[sMeta.name]) || 0;

            if (skLv > 0 && currentRun.mp >= sMeta.mp && Math.random() < 0.50) {
                executedSkill = true;
                currentRun.mp -= sMeta.mp;
                
                let eff = sMeta.run(skLv, baseAtkPower, currentRun.maxMp, currentRun.hp, currentRun.maxHp);
                let hitCount = eff.hitCount || (eff.isTripleHit ? 3 : (eff.isDoubleHit ? 2 : 1));
                
                triggerProjectileFX(detectProjectileType(sMeta.name, currentRun.job), hitCount);
                let fxClass = detectSkillCssClass(sMeta.name);

                if (eff.shieldGain) {
                    currentRun.shield = (currentRun.shield || 0) + eff.shieldGain;
                    if (typeof addLog === "function") addLog(`🛡️ 施展 <span class="${fxClass}">【${sMeta.name} Lv.${skLv}】</span>，成功加載晶體護盾 <span style="color:#00ffcc; font-weight:bold;">+${eff.shieldGain} Shield</span>！`, "perfect");
                }

                if (eff.healPercent || eff.healAmount) {
                    let healVal = eff.healAmount || Math.floor((currentRun.maxHp || 100) * eff.healPercent);
                    currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healVal);
                    if (typeof addLog === "function") addLog(`✨ 施展 <span class="${fxClass}">【${sMeta.name} Lv.${skLv}】</span>，回復 <span class="heal-effect">+${healVal} HP</span>！`, "perfect");
                }

                if (eff.explodePoison && activeMonster.poisonStacks > 0) {
                    let explodeDmg = eff.dmg + (activeMonster.poisonStacks * 70);
                    let res = applyDamageWithShield(activeMonster, explodeDmg);
                    if (typeof addLog === "function") addLog(`🧪💥 引爆全部 <span class="skill-poison">${activeMonster.poisonStacks} 層劇毒</span>！對 <span class="strike-slash">[${activeMonster.name}]</span> 造成核爆級真傷 <span class="num-popup num-p-dmg">-${res.actualHpDmg} HP</span>！`, "skill-hit");
                    activeMonster.poisonStacks = 0;
                }
                else if (eff.dmg) {
                    let rawAtk = eff.dmg;
                    let targetDef = (isMagicJob || eff.isMagic) ? (activeMonster.mdef || 0) : (activeMonster.def || 0);

                    if (eff.pierceArmor) targetDef = Math.floor(targetDef * (1 - eff.pierceArmor));
                    if (eff.ignoreDef) targetDef = 0;

                    if (sMeta.name.includes("火箭") && activeMonster.freezeTurns > 0) {
                        rawAtk = Math.floor(rawAtk * 2.5);
                        if (typeof addLog === "function") addLog(`🔥❄️【冰火暴擊】魔物處於冰凍狀態！火箭術觸發 2.5 倍爆發傷害！`, "perfect");
                    }

                    let dmgRes = typeof calculateDamage === "function" ? calculateDamage(rawAtk, targetDef, true, (isMagicJob || eff.isMagic)) : { damage: rawAtk, isMiss: false };

                    if (eff.forceCrit) {
                        dmgRes.isCrit = true;
                        dmgRes.damage = Math.floor(dmgRes.damage * 1.5);
                    }

                    if (dmgRes.isMiss) {
                        if (typeof addLog === "function") addLog(`💨 施展 <span class="${fxClass}">【${sMeta.name} Lv.${skLv}】</span>，但被魔物 <span class="miss-effect">[MISS 閃過]</span> 了！<span class="num-popup num-miss">MISS</span>`, "miss");
                    } else {
                        let totalActualDmg = 0;

                        for (let h = 0; h < hitCount; h++) {
                            let singleHitDmg = Math.max(1, Math.floor(dmgRes.damage / hitCount));
                            let res = applyDamageWithShield(activeMonster, singleHitDmg);
                            totalActualDmg += res.actualHpDmg;
                        }

                        let numClass = (isMagicJob || eff.isMagic) ? "num-m-dmg" : "num-p-dmg";
                        let critTag = dmgRes.isCrit ? `<span class="skill-crit">⚡ 暴擊！</span>` : "";
                        let multiTag = hitCount > 1 ? `(${hitCount}連發)` : "";

                        if (typeof addLog === "function") {
                            addLog(`💥 奧義爆發！${critTag}施展 <span class="${fxClass}">【${sMeta.name} Lv.${skLv}】${multiTag}</span> 重創 <span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${totalActualDmg} HP</span> (合共)`, "skill-hit");
                        }
                        
                        if (eff.poisonStacks) {
                            activeMonster.poisonStacks = (activeMonster.poisonStacks || 0) + eff.poisonStacks;
                        }
                        if (eff.burnStacks) {
                            activeMonster.burnStacks = (activeMonster.burnStacks || 0) + eff.burnStacks;
                        }
                        if (eff.freezeChance && Math.random() * 100 < eff.freezeChance) {
                            activeMonster.freezeTurns = (activeMonster.freezeTurns || 0) + 1;
                            if (typeof addLog === "function") addLog(`❄️【極寒冷凍】魔物被強行 <span class="skill-ice">【凍結】1 回合</span>！`, "perfect");
                        }
                    }
                }
                break;
            }
        }
    }

    if (!executedSkill) {
        let monsterDef = isMagicJob ? (activeMonster.mdef || 0) : (activeMonster.def || 0);
        let dmgRes = typeof calculateDamage === "function" ? calculateDamage(baseAtkPower, monsterDef, true, isMagicJob) : { damage: baseAtkPower, isMiss: false };
        
        if (dmgRes.isMiss) {
            if (typeof addLog === "function") addLog(`💨 揮砍被魔物 <span class="miss-effect">[MISS 閃過]</span> 了！<span class="num-popup num-miss">MISS</span>`, "miss");
        } else {
            let res = applyDamageWithShield(activeMonster, dmgRes.damage);
            let numClass = isMagicJob ? "num-m-dmg" : "num-p-dmg";
            let critText = dmgRes.isCrit ? `<span class="skill-crit">⚡ 暴擊！</span>` : "";
            
            if (typeof addLog === "function") {
                addLog(`⚔️ 普攻揮砍！${critText}<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${res.actualHpDmg} HP</span>`, "deal"); 
            }
        }
    }

    if (activeMonster.hp <= 0) { 
        if (combatTickerTimer) clearInterval(combatTickerTimer); 
        executeDungeonVictorySequence(); 
    }
}

// --------------------------------------------------------------------------
// 👹 魔物行動 Tick
// --------------------------------------------------------------------------
function executeMonsterActionTick() {
    if (activeMonster.freezeTurns > 0) { 
        activeMonster.freezeTurns--; 
        if (typeof addLog === "function") addLog(`❄️ 魔物處於 <span class="skill-ice">【冰凍狀態】</span>，無法行動！(剩餘 ${activeMonster.freezeTurns} 回合)`, "perfect");
        return; 
    }

    if (activeMonster.stunTurns > 0) {
        activeMonster.stunTurns--;
        if (typeof addLog === "function") addLog(`💫 魔物處於 <span class="skill-bash">【眩暈狀態】</span>，陷入混亂無法行動！`, "perfect");
        return;
    }
    
    let monsterAtk = activeMonster.atk || 5;
    let playerDef = currentRun.def || 0;
    
    let dmgRes = typeof calculateDamage === "function" ? calculateDamage(monsterAtk, playerDef, false, false) : { damage: monsterAtk, isMiss: false };
    
    if (dmgRes.isMiss) {
        if (typeof addLog === "function") addLog(`💨 勇者身形閃爍，成功 <span class="miss-effect">[MISS 閃過]</span> 了魔物的猛攻！<span class="num-popup num-miss">MISS</span>`, "miss");
        return;
    }

    let res = applyDamageWithShield(currentRun, dmgRes.damage);
    let shieldMsg = res.absorbed > 0 ? `🛡️ 護盾吸收了 ${res.absorbed} 點傷害！` : "";

    if (typeof addLog === "function") {
        addLog(`🔴 魔物暴虐反噬！${shieldMsg}<span class="strike-monster">[${accountMeta.name || "勇者"}]</span> <span class="num-popup num-boss-strike">-${res.actualHpDmg} HP</span>`, "take"); 
    }
    
    if (currentRun.hp <= 0) { 
        if (combatTickerTimer) clearInterval(combatTickerTimer); 
        executeDungeonDefeatSequence(); 
    }
}

function executeDungeonVictorySequence() {
    let isBossFloor = (dungeonFloor % 10 === 0);
    let rewardG = isBossFloor ? (150 + dungeonFloor * 10) : (15 + Math.floor(dungeonFloor * 1.5));
    let rewardExp = isBossFloor ? (100 + dungeonFloor * 5) : (12 + dungeonFloor * 2);

    currentRun.gold += rewardG; 
    if (typeof addLog === "function") addLog(`👑 <span class="gold-victory-text">VICTORY!</span> 戰鬥勝利！獲得金幣 +${rewardG} G，經驗值 +${rewardExp}。`, "victory-badge");
    
    let dropItemName = activeMonster?.fixedDrop || (typeof MONSTER_DROPS !== "undefined" ? MONSTER_DROPS[activeMonster?.name] : null);
    if (dropItemName) {
        let msg = safePushToInventory(currentRun, accountMeta, dropItemName);
        if (typeof addLog === "function") addLog(msg, "perfect");
    }

    if (isBossFloor) {
        triggerBossVictoryModal(activeMonster?.name);
        triggerBossTalentReward();
    }

    activeMonster = null; 
    addExperience(rewardExp);
}

function triggerBossVictoryModal(bossName) {
    const overlay = document.getElementById('boss-victory-overlay');
    const nameEl = document.getElementById('victory-boss-name');
    if (!overlay) return;
    if (nameEl) nameEl.innerText = bossName || "LEGENDARY BOSS DEFEATED";
    overlay.style.display = 'flex';
    
    const closeHandler = () => {
        overlay.style.display = 'none';
        overlay.removeEventListener('click', closeHandler);
    };
    overlay.addEventListener('click', closeHandler);
    setTimeout(closeHandler, 5000);
}

function triggerBossTalentReward() {
    if (typeof addLog === "function") addLog(`👑🌟【Boss 史詩突破】你征服了 B${dungeonFloor}F 領主，獲得永久血脈天賦覺醒選擇！`, "perfect");
    const talents = ["👑 不滅巨魔血脈 (MaxHP +100)", "⚡ 狂暴神經反射 (SPD +5)", "🩸 殘虐撕裂本能 (CRIT +5%)"];
    const chosen = talents[Math.floor(Math.random() * talents.length)];
    
    if (chosen.includes("MaxHP")) { currentRun.maxHp += 100; currentRun.hp += 100; }
    else if (chosen.includes("SPD")) { currentRun.spd += 5; }
    else if (chosen.includes("CRIT")) { currentRun.critChance += 5; }

    if (typeof addLog === "function") addLog(`✨ 天賦自動覺醒：<strong>${chosen}</strong>！`, "perfect");
}

function executeDungeonDefeatSequence() {
    let lostExp = Math.floor((accountMeta.exp || 0) * 0.3);
    accountMeta.exp = Math.max(0, (accountMeta.exp || 0) - lostExp);
    currentRun.exp = accountMeta.exp;

    if (typeof addLog === "function") addLog(`☠️【魂歸深淵】你已被擊敗！損失了 30% 經驗值 (-${lostExp} EXP)，已緊急送回地表村莊。`, "take");
    
    gameState = "VILLAGE"; 
    currentEnvironment = "NORMAL";
    
    if (typeof resetCurrentRunData === "function") resetCurrentRunData(); 
    currentRun.hp = currentRun.maxHp; 
    currentRun.mp = currentRun.maxMp;
    currentRun.shield = 0;
    
    if (typeof saveGameData === "function") saveGameData(); 
    if (typeof updateUI === "function") updateUI(); 
    if (typeof switchVillageLocation === "function") switchVillageLocation("GATE");
}

function addExperience(amount) {
    accountMeta.exp = (accountMeta.exp || 0) + amount;
    currentRun.exp = accountMeta.exp;
    checkLevelUpAndTriggerSelect();
}

function checkLevelUpAndTriggerSelect() {
    if (accountMeta.exp >= accountMeta.nextExp) {
        accountMeta.lv = (accountMeta.lv || 1) + 1;
        currentRun.lv = accountMeta.lv; 
        accountMeta.statPoints = (accountMeta.statPoints || 0) + 3; 
        
        accountMeta.exp = 0;
        currentRun.exp = 0;
        
        accountMeta.nextExp = Math.floor(accountMeta.nextExp * 1.4);
        currentRun.nextExp = accountMeta.nextExp;

        if (typeof addLog === "function") addLog(`👑 突破至 <strong>Lv.${accountMeta.lv}</strong>！獲得 3 點能力點數！`, "perfect");
    }

    if (gameState === "BATTLE") { 
        let btnMain = document.getElementById('btn-main-action');
        if (btnMain) btnMain.disabled = false; 
    }
    
    if (typeof saveGameData === "function") saveGameData();
    if (typeof updateUI === "function") updateUI();
}

function executeEquipAction(equipName, actionType) {
    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    let blueprint = CRAFTING_BLUEPRINTS.find(b => b.name === equipName); 
    if (!blueprint) return;
    
    let slot = blueprint.type;
    if (actionType === "equip") {
        if (accountMeta.equipment && accountMeta.equipment[slot]) { 
            let old = accountMeta.equipment[slot]; 
            accountMeta.warehouse[old] = (accountMeta.warehouse[old] || 0) + 1; 
        }
        if (accountMeta.warehouse[equipName]) accountMeta.warehouse[equipName]--; 
        if (!accountMeta.equipment) accountMeta.equipment = {};
        accountMeta.equipment[slot] = equipName;
    } else {
        if (!accountMeta.equipment) accountMeta.equipment = {};
        accountMeta.equipment[slot] = null; 
        accountMeta.warehouse[equipName] = (accountMeta.warehouse[equipName] || 0) + 1;
    }
    if (typeof resetCurrentRunData === "function") resetCurrentRunData(); 
    if (typeof saveGameData === "function") saveGameData(); 
    if (typeof updateUI === "function") updateUI(); 
    if (currentVillageLocation === "WORKSHOP" && typeof renderVillageWorkshop === "function") renderVillageWorkshop();
}

// ==========================================================================
// 🏇 皇家二轉突破儀式系統
// ==========================================================================

function openJobAdvancementModal() {
    let overlay = document.getElementById('job-advancement-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'job-advancement-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
            display: flex; justify-content: center; align-items: center; z-index: 10000; padding: 15px; box-sizing: border-box;
        `;
        document.body.appendChild(overlay);
    }

    const currentBaseJob = currentRun.job;
    const choices = (typeof ADVANCED_JOBS_DATABASE !== "undefined") ? (ADVANCED_JOBS_DATABASE[currentBaseJob] || []) : [];

    if (choices.length === 0) {
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert(["當前職業無法進行二轉突破！"], "⚠️ 無法轉職");
        }
        return;
    }

    const cardsHtml = choices.map(j => `
        <div style="
            background: rgba(20, 20, 30, 0.9); border: 1px solid #ffd700; border-radius: 12px;
            padding: 14px; margin-bottom: 10px; text-align: left; transition: all 0.2s;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 16px; font-weight: bold; color: #ffd700;">${j.icon} ${j.name}</span>
                <span style="font-size: 11px; color: #00ffcc;">[需要 Lv.${j.reqLv}]</span>
            </div>
            <p style="font-size: 11px; color: #ccc; margin-bottom: 10px; line-height: 1.4;">${j.desc}</p>
            <button class="btn-game btn-rerun" style="width: 100%; padding: 6px 0; font-size: 12px; font-weight: bold;" onclick="executeAdvanceJob('${j.id}')">
                ✨ 選擇繼承血脈 ➔ ${j.name}
            </button>
        </div>
    `).join("");

    overlay.innerHTML = `
        <div style="
            background: #121216; border: 2px solid #ffd700; border-radius: 15px;
            padding: 20px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 0 25px rgba(255, 215, 0, 0.4);
        ">
            <h3 style="color: #ffd700; margin-top: 0; font-size: 18px;">👑 皇家二轉突破選擇</h3>
            <p style="font-size: 11px; color: #aaa; margin-bottom: 15px;">
                請選擇你未來的專精道路。轉職後將保留原有等級與技能，並解鎖專屬二轉天賦與新技能庫！
            </p>
            <div>${cardsHtml}</div>
            <button class="btn-game btn-rest" style="margin-top: 10px; width: 100%; padding: 6px 0; font-size: 12px;" onclick="closeJobAdvancementModal()">
                取消並返回
            </button>
        </div>
    `;

    overlay.style.display = "flex";
}

function closeJobAdvancementModal() {
    const overlay = document.getElementById('job-advancement-overlay');
    if (overlay) overlay.style.display = "none";
}

function executeAdvanceJob(newJobId) {
    if (typeof JOB_DATABASE === "undefined") return;
    const newJobObj = JOB_DATABASE[newJobId];
    if (!newJobObj) return;

    accountMeta.job = newJobId;
    currentRun.job = newJobId;

    if (typeof SKILLS_DATABASE !== "undefined") {
        const newJobSkills = SKILLS_DATABASE[newJobId];
        if (newJobSkills && newJobSkills.length > 0) {
            const firstSkillName = newJobSkills[0].name;
            if (!accountMeta.skills) accountMeta.skills = {};
            if (!currentRun.skills) currentRun.skills = {};

            if (!accountMeta.skills[firstSkillName]) {
                accountMeta.skills[firstSkillName] = 1;
                currentRun.skills[firstSkillName] = 1;
                if (typeof addLog === "function") addLog(`🎓✨【轉職賜福】自動獲得二轉奧義：<strong>[${firstSkillName}] (Lv.1)</strong>！`, "perfect");
            }
        }
    }

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    if (typeof saveGameData === "function") saveGameData();

    if (typeof addLog === "function") {
        addLog(`👑🏇🌟【二轉血脈覺醒】恭喜突破轉職為 ➔ <strong style="color:#ffd700;">${newJobObj.icon || ''} ${newJobObj.name}</strong>！解鎖全新進階技能樹！`, "victory-badge");
    }

    closeJobAdvancementModal();
    if (typeof updateUI === "function") updateUI();
    if (typeof renderVillageGuild === "function") renderVillageGuild();
}
