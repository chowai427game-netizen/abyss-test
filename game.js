// ==========================================================================
// 🕹️ game.js：完整地下城戰鬥、40種奇遇卡片與動態環境力場引擎 (v5.4 Mobile-RWD & Event-Fix)
// ==========================================================================

let combatTickerTimer = null; 
let combatRoundCounter = 1;     

let playerAtb = 0;
let monsterAtb = 0;
let envAtb = 0;
let battleTimeElapsed = 0;

let isQteActive = false;
let activeTactic = "BALANCED";

// --------------------------------------------------------------------------
// 📱 注入手機端加工所 RWD 防衝撞專用 CSS 樣式
// --------------------------------------------------------------------------
(function injectMobileWorkshopStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById('mobile-workshop-override-style')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'mobile-workshop-override-style';
    styleEl.innerHTML = `
        /* 手機端加工所卡片重構與防重疊樣式 */
        .workshop-grid-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 12px;
            width: 100%;
            box-sizing: border-box;
            padding: 4px 0;
        }

        .workshop-card-mobile {
            background: linear-gradient(135deg, rgba(20, 24, 33, 0.95) 0%, rgba(12, 15, 22, 0.98) 100%);
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 10px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            box-sizing: border-box;
            width: 100%;
        }

        .workshop-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .workshop-card-title {
            font-size: 14px;
            font-weight: bold;
            color: #ffd700;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .workshop-card-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(0, 255, 204, 0.15);
            color: #00ffcc;
            border: 1px solid rgba(0, 255, 204, 0.4);
        }

        .workshop-card-body {
            font-size: 11px;
            color: #cccccc;
            margin-bottom: 10px;
            line-height: 1.5;
        }

        .workshop-card-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: auto;
            padding-top: 8px;
            width: 100%;
            box-sizing: border-box;
        }

        .workshop-btn-sub {
            flex: 1 1 calc(50% - 6px);
            min-width: 90px;
            padding: 8px 4px;
            font-size: 11px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            text-align: center;
            box-sizing: border-box;
            white-space: nowrap;
        }

        @media (max-width: 600px) {
            .workshop-grid-container {
                grid-template-columns: 1fr !important;
            }
            .workshop-btn-sub {
                flex: 1 1 100% !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
})();

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

if (typeof window !== "undefined") {
    window.safePushToInventory = safePushToInventory;
}

// --------------------------------------------------------------------------
// 🛡️ 護盾傷害吸收邏輯
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
// 💥 戰場特效與多投射物連發機制
// --------------------------------------------------------------------------
function triggerProjectileFX(type = 'arcane', count = 1) {
    const logContainer = document.getElementById('log-box');
    if (!logContainer) return;

    const maxCount = Math.min(count, 10); 
    
    for (let i = 0; i < maxCount; i++) {
        setTimeout(() => {
            const proj = document.createElement('div');
            proj.className = `projectile-entity proj-${type}`;
            proj.style.pointerEvents = 'none';
            proj.innerHTML = `<div class="fx-core"></div>`;
            logContainer.appendChild(proj);

            setTimeout(() => {
                if (proj && proj.parentNode) proj.remove();
            }, 450);
        }, i * 65);
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

    try {
        if (typeof initOrLoadPlayer === "function") {
            const result = await initOrLoadPlayer(inputName, inputPin);

            if (!result || !result.success) {
                console.warn("🔐 PIN 碼驗證失敗，阻擋進入遊戲。");
                if (typeof showToast === "function") showToast("🔐 驗證失敗，請檢查 PIN 碼", "warn");
                return; 
            }

            if (result.isNewUser || !accountMeta.job || accountMeta.job === "novice") {
                renderInitialJobModal(false);
                return;
            }
        }
    } catch (err) {
        console.error("🚨 載入角色發生異常:", err);
        if (typeof showToast === "function") showToast("網路連線或載入異常，請重試", "warn");
        return;
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
    gameState = "VILLAGE";
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

// --------------------------------------------------------------------------
// ⚡ 自動戰鬥 AI 邏輯
// --------------------------------------------------------------------------
function executeAutoBattleAiTurn() {
    if (activeTactic === "MANUAL") return false;
    if (!activeMonster || activeMonster.hp <= 0) return false;

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

    if (activeTactic === "OFFENSIVE") {
        const jobSkills = typeof getAllSkillsForJob === "function" ? getAllSkillsForJob(currentRun.job) : (SKILLS_DATABASE[currentRun.job] || []);
        
        for (let i = jobSkills.length - 1; i >= 0; i--) {
            let sMeta = jobSkills[i];
            if (sMeta.type !== "active") continue;

            if (currentRun.skills && currentRun.skills[sMeta.name] && currentRun.mp >= sMeta.mp) {
                let skLv = currentRun.skills[sMeta.name];
                let isMagicJob = (currentRun.job === "magician" || currentRun.job === "acolyte" || currentRun.job === "wizard" || currentRun.job === "priest" || currentRun.job === "sage");
                let baseAtkPower = isMagicJob ? (currentRun.matk || 10) : (currentRun.atk || 15);
                let eff = sMeta.run(skLv, baseAtkPower, currentRun.maxMp, currentRun.hp, currentRun.maxHp);
                
                if (eff.dmg && activeMonster && activeMonster.hp > 0) {
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

// ==========================================================================
// 🧭 肉鴿分支地圖與 40 種奇遇卡片對接引擎
// ==========================================================================

function generateRouteNodes(floor) {
    if (floor % 10 === 0) {
        return [{
            type: "BOSS",
            title: `👹 領主巨室 (B${floor}F)`,
            desc: "龐大的壓迫感席捲全身，深淵領主在此等候著你的血脈挑戰！",
            icon: "👹",
            color: "#ff3838"
        }];
    }

    const typesPool = [
        { type: "COMBAT", title: "⚔️ 魔物遭遇", desc: "常規深淵魔物遊盪，適合穩健獲取經驗與金幣。", icon: "⚔️", weight: 55, color: "#00ffcc" },
        { type: "ELITE", title: "💀 精英巡邏", desc: "強大的精英魔物！(1.6倍威力，保證雙倍掉落與高階裝備)", icon: "💀", weight: 22, color: "#ff4757" },
        { type: "EVENT", title: "❓ 命運遭遇", desc: "40種邪神/仙子/古墓奇遇抉擇，或神秘隨機寶箱。", icon: "❓", weight: 15, color: "#a55eea" },
        { type: "REST_SHOP", title: "⛺ 靈魂休憩所", desc: "溫馨的魔導營地，回復 50% HP/MP 或獲得遺物補給。", icon: "⛺", weight: 8, color: "#2ecc71" }
    ];

    let choices = [];
    let count = Math.random() < 0.4 ? 2 : 3;

    for (let i = 0; i < count; i++) {
        let totalWeight = typesPool.reduce((acc, curr) => acc + curr.weight, 0);
        let roll = Math.random() * totalWeight;
        let accumulated = 0;
        let selected = typesPool[0];

        for (let t of typesPool) {
            accumulated += t.weight;
            if (roll <= accumulated) {
                selected = t;
                break;
            }
        }
        choices.push({ ...selected });
    }

    if (!choices.some(c => c.type === "COMBAT" || c.type === "ELITE")) {
        choices[0] = { ...typesPool[0] };
    }

    return choices;
}

function renderRouteSelectionPanel() {
    const routeBox = document.getElementById('route-panel-box');
    const routeContainer = document.getElementById('route-choices-container');
    const monsterCard = document.getElementById('monster-status-card');
    
    if (!routeBox || !routeContainer) return;

    if (!currentRun.currentNodes || currentRun.currentNodes.length === 0) {
        currentRun.currentNodes = generateRouteNodes(dungeonFloor || 1);
        if (typeof saveGameData === "function") saveGameData();
    }

    routeContainer.innerHTML = "";
    routeBox.style.display = "block";
    if (monsterCard) monsterCard.style.display = "none";

    const titleEl = document.getElementById('route-title-text');
    if (titleEl) {
        titleEl.innerText = `🧭 命運分流：選擇前進 B${dungeonFloor}F 路線 🧭`;
    }

    currentRun.currentNodes.forEach((node, idx) => {
        const btn = document.createElement('div');
        btn.style.cssText = `
            background: linear-gradient(135deg, rgba(20, 20, 28, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%);
            border: 1px solid ${node.color || '#ffd700'};
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.25s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), inset 0 0 10px ${node.color}22;
        `;

        btn.onmouseover = () => {
            btn.style.transform = "translateY(-2px)";
            btn.style.boxShadow = `0 6px 20px ${node.color}66, inset 0 0 15px ${node.color}44`;
        };
        btn.onmouseout = () => {
            btn.style.transform = "translateY(0)";
            btn.style.boxShadow = `0 4px 15px rgba(0, 0, 0, 0.5), inset 0 0 10px ${node.color}22`;
        };

        btn.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 15px; font-weight: bold; color: ${node.color};">${node.icon} ${node.title}</span>
                <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: ${node.color}22; color: ${node.color}; border: 1px solid ${node.color}55;">分支 #${idx + 1}</span>
            </div>
            <div style="font-size: 11px; color: #d1d1d6; line-height: 1.5;">${node.desc}</div>
        `;

        btn.onclick = () => {
            selectRouteNode(idx);
        };

        routeContainer.appendChild(btn);
    });

    const villagePanel = document.getElementById('village-panel-box');
    if (villagePanel) villagePanel.style.display = "none";
}

function selectRouteNode(index) {
    if (!currentRun.currentNodes || !currentRun.currentNodes[index]) return;

    const selectedNode = currentRun.currentNodes[index];
    currentRun.selectedNodeType = selectedNode.type;
    currentRun.currentNodes = [];

    const routeBox = document.getElementById('route-panel-box');
    if (routeBox) routeBox.style.display = "none";

    const actionPanel = document.getElementById('action-panel-box');
    if (actionPanel) actionPanel.style.display = "flex";

    if (typeof addLog === "function") {
        addLog(`🧭【路線抉擇】你果斷踏入了 <strong>${selectedNode.title}</strong>！`, "perfect");
    }

    if (selectedNode.type === "REST_SHOP") {
        executeRestShopNode();
    } else if (selectedNode.type === "EVENT") {
        gameState = "ENCOUNTER";
        if (typeof updateUI === "function") updateUI();
        triggerRandomAbyssEvent();
    } else {
        gameState = "BATTLE";
        if (typeof updateUI === "function") updateUI();
        startNodeCombat(selectedNode.type);
    }
}

// --------------------------------------------------------------------------
// 🎯 修復版：命運遭遇（奇遇與寶箱）觸發引擎 (安全防死鎖)
// --------------------------------------------------------------------------
function triggerRandomAbyssEvent() {
    const roll = Math.random();

    // 45% 觸發 40 種命運抉擇奇遇
    if (roll < 0.45 && typeof getRandomAbyssEvent === "function") {
        const ev = getRandomAbyssEvent();
        if (ev && ev.choices && ev.choices.length > 0) {
            renderAbyssEventCard(ev);
            return;
        }
    }

    // 45% 觸發寶箱開鎖 QTE
    if (roll < 0.90 && typeof drawRandomChest === "function") {
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
        return;
    }

    // 10% 遠古泉水保底回復
    currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 30);
    if (typeof addLog === "function") addLog(`⛲【遠古泉水】遇見淨化泉水，HP 回復 +30。`, "perfect");
    resolveAbyssEvent();
}

// --------------------------------------------------------------------------
// 🎯 修復版：奇遇卡片渲染與選項執行防護 (防止未發動/無 Log)
// --------------------------------------------------------------------------
function renderAbyssEventCard(eventObj) {
    const rewardBox = document.getElementById('reward-panel-box');
    const rewardContainer = document.getElementById('reward-choices-container');
    const rewardTitle = document.getElementById('reward-title-text');

    if (!rewardBox || !rewardContainer) {
        resolveAbyssEvent();
        return;
    }

    rewardContainer.innerHTML = "";
    rewardBox.style.display = "block";
    rewardBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (rewardTitle) rewardTitle.innerText = `✨ ${eventObj.title} ✨`;

    const descDiv = document.createElement('div');
    descDiv.style.cssText = "width: 100%; font-size: 12px; color: #d1d1d6; margin-bottom: 12px; line-height: 1.5; text-align: left;";
    descDiv.innerText = eventObj.desc || "命運的迷霧在四周蔓延，請做出你的抉擇……";
    rewardContainer.appendChild(descDiv);

    (eventObj.choices || []).forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = "btn-game btn-explore full-width margin-top-sm";
        btn.style.cssText = "text-align: left; padding: 10px; font-size: 11px; white-space: normal; width: 100%; cursor: pointer; margin-top: 6px;";
        btn.innerText = choice.text;

        btn.onclick = () => {
            btn.disabled = true;
            let logMsg = "";
            try {
                if (typeof choice.run === "function") {
                    logMsg = choice.run(currentRun, accountMeta);
                }
            } catch (err) {
                console.error("🚨 奇遇執行異常:", err);
                logMsg = "✨ 命運之理運轉，周圍空氣微微震盪，奇遇和平結束。";
            }

            if (!logMsg || typeof logMsg !== "string") {
                logMsg = "✨ 命運的波導悄然拂過，你的體能獲得了潛在的微幅滋育。";
            }

            if (typeof addLog === "function") {
                addLog(`🌀【奇遇結算】${logMsg}`, "perfect");
            }
            if (typeof recalculateRunStats === "function") recalculateRunStats();
            if (typeof saveGameData === "function") saveGameData();
            if (typeof updateUI === "function") updateUI();

            rewardBox.style.display = "none";
            resolveAbyssEvent();
        };

        rewardContainer.appendChild(btn);
    });

    if (typeof updateUI === "function") updateUI();
}

function resolveAbyssEvent() { 
    gameState = "ENCOUNTER_RESOLVED"; 
    const rewardBox = document.getElementById('reward-panel-box');
    if (rewardBox) rewardBox.style.display = "none";

    const mainBtn = document.getElementById('btn-main-action');
    const rerunBtn = document.getElementById('btn-rerun-action');
    if (mainBtn) {
        mainBtn.disabled = false;
        mainBtn.innerText = `🧭 前進下一層 (B${(dungeonFloor || 1) + 1}F)`;
        mainBtn.style.display = "block";
    }
    if (rerunBtn) {
        rerunBtn.disabled = false;
        rerunBtn.style.display = "block";
    }

    if (typeof saveGameData === "function") saveGameData();
    if (typeof updateUI === "function") updateUI(); 
}

// --------------------------------------------------------------------------
// ⛺ 靈魂休憩營地節點
// --------------------------------------------------------------------------
function executeRestShopNode() {
    gameState = "REWARD";
    const rewardBox = document.getElementById('reward-panel-box');
    const rewardContainer = document.getElementById('reward-choices-container');
    const rewardTitle = document.getElementById('reward-title-text');

    if (rewardBox) {
        rewardBox.style.display = "block";
        rewardBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (rewardTitle) rewardTitle.innerText = "⛺ 靈魂休憩營地：請選擇補給 ⛺";

    if (rewardContainer) {
        rewardContainer.innerHTML = "";

        const healChoice = document.createElement('button');
        healChoice.className = "btn-game btn-explore full-width margin-top-sm";
        healChoice.style.cssText = "width: 100%; padding: 12px; margin-top: 8px; font-size: 13px; font-weight: bold; text-align: left; cursor: pointer; background: linear-gradient(135deg, rgba(46,204,113,0.3) 0%, rgba(39,174,96,0.5) 100%); border: 1px solid #2ecc71; color: #fff; border-radius: 8px;";
        healChoice.innerHTML = "💖 靈魂泉水滋養 (回復 50% HP 與 MP)";
        healChoice.onclick = () => {
            let hpGain = Math.floor(currentRun.maxHp * 0.5);
            let mpGain = Math.floor(currentRun.maxMp * 0.5);
            currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + hpGain);
            currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + mpGain);
            if (typeof addLog === "function") addLog(`⛺【靈魂滋養】沐浴在泉水中，回復 <span class="heal-effect">+${hpGain} HP</span> 與 <span class="heal-effect">+${mpGain} MP</span>！`, "perfect");
            resolveRestNodeDone();
        };

        const goldChoice = document.createElement('button');
        goldChoice.className = "btn-game btn-rerun full-width margin-top-sm";
        goldChoice.style.cssText = "width: 100%; padding: 12px; margin-top: 8px; font-size: 13px; font-weight: bold; text-align: left; cursor: pointer; background: linear-gradient(135deg, rgba(241,196,15,0.3) 0%, rgba(243,156,18,0.5) 100%); border: 1px solid #f1c40f; color: #fff; border-radius: 8px;";
        goldChoice.innerHTML = `🪙 尋獲前人遺物 (獲得 +${50 + (dungeonFloor || 1) * 10} G 金幣)`;
        goldChoice.onclick = () => {
            let goldGain = 50 + (dungeonFloor || 1) * 10;
            currentRun.gold += goldGain;
            if (typeof addLog === "function") addLog(`🪙【遺物翻找】翻找遠古骸骨，獲得金幣 <span class="gold-victory-text">+${goldGain} G</span>！`, "perfect");
            resolveRestNodeDone();
        };

        rewardContainer.appendChild(healChoice);
        rewardContainer.appendChild(goldChoice);
    } else {
        let hpGain = Math.floor(currentRun.maxHp * 0.5);
        let mpGain = Math.floor(currentRun.maxMp * 0.5);
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + hpGain);
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + mpGain);
        if (typeof addLog === "function") addLog(`⛺【靈魂滋養 (自動補給)】回復 <span class="heal-effect">+${hpGain} HP</span> 與 <span class="heal-effect">+${mpGain} MP</span>！`, "perfect");
        resolveRestNodeDone();
        return;
    }

    if (typeof updateUI === "function") updateUI();
}

function resolveRestNodeDone() {
    const rewardBox = document.getElementById('reward-panel-box');
    if (rewardBox) rewardBox.style.display = "none";

    gameState = "ENCOUNTER_RESOLVED";
    
    const mainBtn = document.getElementById('btn-main-action');
    const rerunBtn = document.getElementById('btn-rerun-action');
    if (mainBtn) {
        mainBtn.disabled = false;
        mainBtn.innerText = `🧭 前進下一層 (B${(dungeonFloor || 1) + 1}F)`;
        mainBtn.style.display = "block";
    }
    if (rerunBtn) {
        rerunBtn.disabled = false;
        rerunBtn.style.display = "block";
    }

    if (typeof saveGameData === "function") saveGameData();
    if (typeof updateUI === "function") updateUI();
}

// --------------------------------------------------------------------------
// ⚔️ 戰鬥初始化與動態環境力場結合
// --------------------------------------------------------------------------
function startNodeCombat(nodeType) {
    try {
        if (combatTickerTimer) clearInterval(combatTickerTimer);

        const monsterCard = document.getElementById('monster-status-card');
        if (monsterCard) monsterCard.style.display = "grid";

        if (typeof getEnvironmentConfig === "function") {
            const envConfig = getEnvironmentConfig(dungeonFloor);
            currentEnvironment = envConfig.id;
            const envAlertEl = document.getElementById('env-alert-bar');
            if (envAlertEl) {
                envAlertEl.style.display = "block";
                envAlertEl.className = envConfig.className || "env-zone-normal";
                envAlertEl.innerText = envConfig.logText || "✨ 當前環境力場穩定";
            }
        } else {
            currentEnvironment = "NORMAL";
        }
        
        const isBossNode = (nodeType === "BOSS" || dungeonFloor % 10 === 0);
        const isEliteNode = (nodeType === "ELITE");

        if (isBossNode) {
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

            let scaleFactor = isEliteNode ? 1.6 : 1.0;
            let scaledHp = Math.floor((rollSeed.baseHp + dungeonFloor * (rollSeed.hpScale || 5)) * scaleFactor);
            let scaledAtk = Math.floor((rollSeed.baseAtk + dungeonFloor * (rollSeed.atkScale || 1)) * scaleFactor);
            let scaledDef = Math.floor(((rollSeed.baseDef || 1) + dungeonFloor * 0.5) * scaleFactor);
            let finalSpd = Math.floor((rollSeed.baseSpd || 15) * (isEliteNode ? 1.2 : 1.0));
            
            activeMonster = { 
                name: isEliteNode ? `💀 精英・${rollSeed.name}` : rollSeed.name, 
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
                isBoss: false,
                isElite: isEliteNode
            };
            
            let eliteText = isEliteNode ? ` 🔥【狂暴精英對決】` : ``;
            if (typeof addLog === "function") addLog(`⚔️【降臨 B${dungeonFloor}F】${eliteText}發現魔物：<strong>${activeMonster.name}</strong>`);
        }
        
        if (typeof updateUI === "function") updateUI();

        playerAtb = 0; monsterAtb = 0; envAtb = 0; battleTimeElapsed = 0;

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

// --------------------------------------------------------------------------
// 🗡️ 戰鬥 Tick 與環境傷害
// --------------------------------------------------------------------------
function executeEnvironmentTick() {
    if (typeof applyEnvironmentTurnEffect === "function") {
        const envRes = applyEnvironmentTurnEffect(currentRun, currentEnvironment);
        if (envRes.msg && typeof addLog === "function") {
            addLog(envRes.msg, "env");
        }
    } else {
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + Math.floor((currentRun.mpRegen || 15) / 2));
    }
}

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

    if (!executedSkill && activeMonster && activeMonster.hp > 0) {
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

    if (activeMonster && activeMonster.hp <= 0) { 
        if (combatTickerTimer) clearInterval(combatTickerTimer); 
        executeDungeonVictorySequence(); 
    }
}

function executeMonsterActionTick() {
    if (!activeMonster || activeMonster.hp <= 0) return;

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

// --------------------------------------------------------------------------
// 👑 勝利與戰敗序列
// --------------------------------------------------------------------------
function executeDungeonVictorySequence() {
    let isBossFloor = (dungeonFloor % 10 === 0);
    let isElite = activeMonster?.isElite || false;

    let multiplier = isBossFloor ? 3.0 : (isElite ? 1.8 : 1.0);
    let rewardG = Math.floor((15 + Math.floor(dungeonFloor * 1.5)) * multiplier);
    let rewardExp = Math.floor((12 + dungeonFloor * 2) * multiplier);

    currentRun.gold += rewardG; 
    let victoryTag = isElite ? `💀 精英討伐成功！` : (isBossFloor ? `👑 領主討伐成功！` : `⚔️ 戰鬥勝利！`);
    if (typeof addLog === "function") addLog(`${victoryTag} <span class="gold-victory-text">VICTORY!</span> 獲得金幣 +${rewardG} G，經驗值 +${rewardExp}。`, "victory-badge");
    
    let dropItemName = activeMonster?.fixedDrop || (typeof MONSTER_DROPS !== "undefined" ? MONSTER_DROPS[activeMonster?.name.replace("💀 精英・", "")] : null);
    if (dropItemName) {
        let msg = safePushToInventory(currentRun, accountMeta, dropItemName);
        if (typeof addLog === "function") addLog(msg, "perfect");
    }

    if (isElite && Math.random() < 0.5) {
        let extraDrop = "史萊姆黏液";
        let msgExtra = safePushToInventory(currentRun, accountMeta, extraDrop);
        if (typeof addLog === "function") addLog(`🌟【精英額外戰利品】${msgExtra}`, "perfect");
    }

    activeMonster = null; 
    gameState = "ENCOUNTER_RESOLVED"; 

    if (isBossFloor) {
        triggerBossVictoryModal(activeMonster?.name);
        triggerBossTalentReward();
    } else {
        const rewardBox = document.getElementById('reward-panel-box');
        if (rewardBox) rewardBox.innerHTML = "";
    }

    const mainBtn = document.getElementById('btn-main-action');
    const rerunBtn = document.getElementById('btn-rerun-action');
    if (mainBtn) {
        mainBtn.disabled = false;
        mainBtn.innerText = `🧭 前進下一層 (B${(dungeonFloor || 1) + 1}F)`;
        mainBtn.style.display = "block";
    }
    if (rerunBtn) {
        rerunBtn.disabled = false;
        rerunBtn.style.display = "block";
    }

    addExperience(rewardExp);
    
    if (typeof updateUI === "function") updateUI();
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

    setTimeout(() => {
        overlay.addEventListener('click', closeHandler);
    }, 800);

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
    currentRun.currentNodes = [];
    
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

    if (gameState === "BATTLE" || gameState === "REWARD" || gameState === "ENCOUNTER_RESOLVED") { 
        let btnMain = document.getElementById('btn-main-action');
        if (btnMain) btnMain.disabled = false; 
    }
    
    if (typeof saveGameData === "function") saveGameData();
    if (typeof updateUI === "function") updateUI();
}

function handleMainAction() {
    try {
        if (typeof gameState === "undefined" || gameState === "VILLAGE") {
            gameState = "SELECT_ROUTE";
            dungeonFloor = 1;
            const secBtn = document.getElementById('btn-secondary-action');
            if (secBtn) {
                secBtn.style.display = "block";
                secBtn.innerText = "🏃 撤退逃回地表村莊";
            }
            if (typeof updateUI === "function") updateUI();
            renderRouteSelectionPanel();
        } else if (gameState === "BATTLE" || gameState === "REWARD" || gameState === "ENCOUNTER_RESOLVED" || gameState === "ENCOUNTER") {
            gameState = "SELECT_ROUTE";
            dungeonFloor = (dungeonFloor || 0) + 1;
            if (typeof updateUI === "function") updateUI();
            renderRouteSelectionPanel();
        } else if (gameState === "SELECT_ROUTE") {
            renderRouteSelectionPanel();
        }
    } catch(err) {
        if (typeof addLog === "function") addLog(`🚨【動作發動失敗】主按鈕鏈接錯誤：${err.message}`, "take");
    }
}

function handleRerunAction() {
    try {
        if (combatTickerTimer) clearInterval(combatTickerTimer);
        if (typeof addLog === "function") addLog(`🔄【重巡整備】你留在深淵 B${dungeonFloor}F 進行重巡狩獵，戰局重新載入！`, "perfect");
        gameState = "SELECT_ROUTE";
        
        const mainBtn = document.getElementById('btn-main-action');
        const rerunBtn = document.getElementById('btn-rerun-action');
        if (mainBtn) mainBtn.disabled = false;
        if (rerunBtn) rerunBtn.disabled = false;

        if (typeof updateUI === "function") updateUI();
        renderRouteSelectionPanel();
    } catch(err) {
        if (typeof addLog === "function") addLog(`🚨【重巡失敗】: ${err.message}`, "take");
    }
}

function handleSecondaryAction() {
    if (combatTickerTimer) clearInterval(combatTickerTimer);
    gameState = "VILLAGE";
    currentEnvironment = "NORMAL";
    currentRun.currentNodes = [];
    
    const secBtn = document.getElementById('btn-secondary-action');
    if (secBtn) secBtn.style.display = "none";

    const routeBox = document.getElementById('route-panel-box');
    if (routeBox) routeBox.style.display = "none";
    
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

function startNextFloor() { handleMainAction(); }
function rerunCurrentFloor() { handleRerunAction(); }
function returnToVillage() { handleSecondaryAction(); }

// --------------------------------------------------------------------------
// 🛠️ 🎯 重構版：皇家魔導加工所 (Mobile-First RWD 無重疊渲染引擎)
// --------------------------------------------------------------------------
function renderVillageWorkshop() {
    const workshopContainer = document.getElementById('workshop-content-box') || document.getElementById('village-location-content');
    if (!workshopContainer) return;

    if (typeof CRAFTING_BLUEPRINTS === "undefined") {
        workshopContainer.innerHTML = "<div style='color:#aaa; font-size:12px; padding:20px;'>🛠️ 藍圖資料庫連線中...</div>";
        return;
    }

    let html = `
        <div style="width: 100%; box-sizing: border-box;">
            <div style="font-size: 14px; font-weight: bold; color: #ffd700; margin-bottom: 8px; text-align: left; display: flex; justify-content: space-between; align-items: center;">
                <span>🛠️ 皇家魔導加工所 (神裝鍛造 & 精鍊)</span>
                <span style="font-size: 11px; color: #00ffcc;">🪙 擁有金幣: ${currentRun.gold || 0} G</span>
            </div>
            <div class="workshop-grid-container">
    `;

    CRAFTING_BLUEPRINTS.forEach(bp => {
        const curRefine = (accountMeta.itemRefines && accountMeta.itemRefines[bp.name]) || 0;
        const refineTag = curRefine > 0 ? `<span style="color:#ffd700; font-weight:bold;"> (+${curRefine})</span>` : "";

        let isEquipped = false;
        if (accountMeta.equipment) {
            for (let slot in accountMeta.equipment) {
                if (accountMeta.equipment[slot] === bp.name) {
                    isEquipped = true;
                    break;
                }
            }
        }

        const warehouseCount = (accountMeta.warehouse && accountMeta.warehouse[bp.name]) || 0;

        // 素材需求檢測
        let matList = [];
        let canForge = true;
        for (let mat in bp.ingredients) {
            let req = bp.ingredients[mat];
            let has = (accountMeta.warehouse && accountMeta.warehouse[mat]) || 0;
            if (has < req) canForge = false;
            matList.push(`${mat}: <span style="color:${has >= req ? '#00ffcc' : '#ff4757'};">${has}/${req}</span>`);
        }

        const nextRefineCost = (curRefine + 1) * 100;

        html += `
            <div class="workshop-card-mobile">
                <div class="workshop-card-header">
                    <div class="workshop-card-title">
                        <span>⚔️ ${bp.name}${refineTag}</span>
                    </div>
                    <div>
                        ${isEquipped ? '<span class="workshop-card-badge" style="background:rgba(46,204,113,0.2); color:#2ecc71; border-color:#2ecc71;">已裝備</span>' : ''}
                        ${warehouseCount > 0 ? `<span class="workshop-card-badge">倉庫 x${warehouseCount}</span>` : ''}
                    </div>
                </div>

                <div class="workshop-card-body">
                    <div style="color: #aaa; margin-bottom: 4px;"><strong>配方需求：</strong>${matList.join(" | ")}</div>
                    <div style="color: #7d5fff;"><strong>部位：</strong>${bp.type || "裝備"} | <strong>基礎屬性：</strong>ATK/DEF +${bp.statBonus || 10}</div>
                </div>

                <div class="workshop-card-actions">
                    <button type="button" class="btn-game btn-explore workshop-btn-sub" 
                            style="background: linear-gradient(135deg, rgba(0,255,204,0.2) 0%, rgba(0,184,148,0.4) 100%); border:1px solid #00ffcc; color:#fff;"
                            onclick="executeForgeEquipmentByName('${bp.name}')">
                        🔨 打造神裝
                    </button>

                    ${(isEquipped || warehouseCount > 0) ? `
                        <button type="button" class="btn-game btn-rerun workshop-btn-sub" 
                                style="background: linear-gradient(135deg, rgba(241,196,15,0.25) 0%, rgba(243,156,18,0.45) 100%); border:1px solid #f1c40f; color:#fff;"
                                onclick="refineSpecificEquipment('${bp.name}')">
                            ✨ 強化 +${curRefine + 1} (${nextRefineCost}G)
                        </button>
                    ` : ''}

                    ${warehouseCount > 0 && !isEquipped ? `
                        <button type="button" class="btn-game btn-explore workshop-btn-sub" 
                                style="background: linear-gradient(135deg, rgba(52,152,219,0.3) 0%, rgba(41,128,185,0.5) 100%); border:1px solid #3498db; color:#fff;"
                                onclick="executeEquipAction('${bp.name}', 'equip')">
                            🛡️ 佩戴上身
                        </button>
                    ` : ''}

                    ${isEquipped ? `
                        <button type="button" class="btn-game btn-rest workshop-btn-sub" 
                                style="background: linear-gradient(135deg, rgba(231,76,60,0.3) 0%, rgba(192,57,43,0.5) 100%); border:1px solid #e74c3c; color:#fff;"
                                onclick="executeEquipAction('${bp.name}', 'unequip')">
                            ❌ 卸下裝備
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    });

    html += `</div></div>`;
    workshopContainer.innerHTML = html;
}

function executeForgeEquipmentByName(bpName) {
    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    let blueprint = CRAFTING_BLUEPRINTS.find(b => b.name === bpName);
    if (blueprint) {
        executeForgeEquipment(blueprint);
    }
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
    else if (itemName.includes("回魔劑") || itemName.includes("瓊漿")) {
        let mpVal = 80;
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + mpVal);
        if (typeof addLog === "function") addLog(`🍷 魔力泉湧！回復 <span class="heal-effect">+${mpVal} MP</span>！`, "perfect");
    }
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
        if (typeof renderVillageWorkshop === "function") renderVillageWorkshop();
    });
}

function refineSpecificEquipment(equipName) {
    if (!accountMeta.itemRefines) accountMeta.itemRefines = {};

    const curLvl = accountMeta.itemRefines[equipName] || 0;

    if (curLvl >= 20) {
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert([`[${equipName}] 已達到最高強化極限 (+20)！`], "🌟 已達神裝頂峰");
        }
        return;
    }

    const nextLvl = curLvl + 1;
    const goldCost = nextLvl * 100;

    if ((currentRun.gold || 0) < goldCost) {
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert([`強化至 +${nextLvl} 需要 🪙 ${goldCost} G (當前僅有 ${currentRun.gold || 0} G)`], "⚠️ 金幣不足");
        }
        return;
    }

    currentRun.gold -= goldCost;

    let successRate = 1.0;
    let failureType = "NONE"; 

    if (nextLvl <= 5) {
        successRate = 1.00;
        failureType = "NONE";
    } 
    else if (nextLvl <= 10) {
        const transitionRates = { 6: 0.70, 7: 0.60, 8: 0.50, 9: 0.40, 10: 0.30 };
        successRate = transitionRates[nextLvl];
        failureType = "DOWNGRADE";
    } 
    else {
        const shuraRates = {
            11: 0.15, 12: 0.12, 13: 0.10, 14: 0.08, 15: 0.05,
            16: 0.04, 17: 0.03, 18: 0.02, 19: 0.01, 20: 0.005
        };
        successRate = shuraRates[nextLvl] || 0.005;
        failureType = "BREAK";
    }

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
    if (typeof renderVillageWorkshop === "function") renderVillageWorkshop();
}

function executeDismantle(equipName) {
    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    let b = typeof getItemBlueprintByName === "function" ? getItemBlueprintByName(equipName) : CRAFTING_BLUEPRINTS.find(x => x.name === equipName); 
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
    if (typeof renderVillageWorkshop === "function") renderVillageWorkshop();
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

function executeEquipAction(equipName, actionType) {
    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    let blueprint = typeof getItemBlueprintByName === "function" ? getItemBlueprintByName(equipName) : CRAFTING_BLUEPRINTS.find(b => b.name === equipName); 
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
    if (typeof renderVillageWorkshop === "function") renderVillageWorkshop();
}

// --------------------------------------------------------------------------
// 🏇 皇家二轉突破儀式系統
// --------------------------------------------------------------------------
function openJobAdvancementModal() {
    const overlay = document.getElementById('job-advancement-overlay');
    const listContainer = document.getElementById('job-advancement-list');
    
    const currentBaseJob = currentRun.job;
    const choices = (typeof ADVANCED_JOBS_DATABASE !== "undefined") ? (ADVANCED_JOBS_DATABASE[currentBaseJob] || []) : [];

    if (choices.length === 0) {
        if (typeof showMaterialAlert === "function") {
            showMaterialAlert(["當前職業無法進行二轉突破或已達極限！"], "⚠️ 無法轉職");
        } else {
            alert("當前職業無法進行二轉突破！");
        }
        return;
    }

    if (listContainer) {
        listContainer.innerHTML = choices.map(j => `
            <div class="job-card" style="background: rgba(20, 20, 30, 0.9); border: 1px solid #ffd700; border-radius: 12px; padding: 14px; margin-bottom: 10px; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 16px; font-weight: bold; color: #ffd700;">${j.icon} ${j.name}</span>
                    <span style="font-size: 11px; color: #00ffcc;">[需要 Lv.${j.reqLv}]</span>
                </div>
                <p style="font-size: 11px; color: #ccc; margin-bottom: 10px; line-height: 1.4;">${j.desc}</p>
                <button type="button" class="btn-game btn-rerun full-width" onclick="executeAdvanceJob('${j.id}')">
                    ✨ 選擇繼承血脈 ➔ ${j.name}
                </button>
            </div>
        `).join("");
    }

    if (overlay) {
        overlay.style.display = "flex";
    }
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

// --------------------------------------------------------------------------
// 🌐 全域 API 顯式掛載
// --------------------------------------------------------------------------
if (typeof window !== "undefined") {
    window.startNextFloor = startNextFloor;
    window.rerunCurrentFloor = rerunCurrentFloor;
    window.returnToVillage = returnToVillage;
    window.handleMainAction = handleMainAction;
    window.handleRerunAction = handleRerunAction;
    window.handleSecondaryAction = handleSecondaryAction;
    window.selectRouteNode = selectRouteNode;
    window.removeBagItem = removeBagItem;
    window.executeUseDungeonItem = executeUseDungeonItem;
    window.executeVillageCooking = executeVillageCooking;
    window.executeForgeEquipment = executeForgeEquipment;
    window.refineSpecificEquipment = refineSpecificEquipment;
    window.executeDismantle = executeDismantle;
    window.executeEquipAction = executeEquipAction;
    window.openJobAdvancementModal = openJobAdvancementModal;
    window.closeJobAdvancementModal = closeJobAdvancementModal;
    window.executeAdvanceJob = executeAdvanceJob;
    window.renderVillageWorkshop = renderVillageWorkshop;
    window.executeForgeEquipmentByName = executeForgeEquipmentByName;
}
