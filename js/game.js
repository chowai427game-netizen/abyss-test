// ==========================================================================
// 🕹️ game.js：完整地下城戰鬥、40種奇遇卡片與動態環境力場引擎 (v5.3 Fix-Rest-Node-Bug)
// ==========================================================================

let combatTickerTimer = null;
let combatIntroStartTimer = null;
let combatPaused = false;
let manualPauseRequested = false;
let tacticsDrawerPaused = false;
let manualTurnPaused = false;
let combatRoundCounter = 1;     
let bossVictoryUnlockTimer = null;
let bossVictoryAutoCloseTimer = null;
let bossVictoryCloseHandler = null;

let playerAtb = 0;
let monsterAtb = 0;
let envAtb = 0;
let battleTimeElapsed = 0;

let isQteActive = false;
let activeTactic = "BALANCED";
let pendingCombatItem = null;
let pendingCombatCommand = null;

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

function bindLoginFormSubmit() {
    const form = document.getElementById('login-form');
    if (!form || form.dataset.startGameBound === "true" || window.__ABYSS_LOGIN_SUBMIT_BOUND__) return;

    form.removeAttribute('onsubmit');
    form.dataset.startGameBound = "true";
    window.__ABYSS_LOGIN_SUBMIT_BOUND__ = true;
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        handleStartGame();
    });
}

if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', bindLoginFormSubmit, { once: true });
} else {
    bindLoginFormSubmit();
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

function normalizeTacticMode(tacticMode) {
    return ["MANUAL", "SEMI", "BALANCED", "OFFENSIVE"].includes(tacticMode) ? tacticMode : "BALANCED";
}

function toggleTacticsDrawer() {
    const drawer = document.getElementById('tactics-drawer-box');
    if (!drawer) return false;
    const expanded = drawer.classList.toggle('expanded');
    const trigger = document.getElementById('tactic-trigger-btn');
    if (trigger) trigger.setAttribute('aria-expanded', String(expanded));
    const mainAction = document.getElementById('btn-main-action');
    if (mainAction) mainAction.setAttribute('aria-expanded', String(expanded));
    if (gameState === "BATTLE" && activeMonster && activeMonster.hp > 0) {
        tacticsDrawerPaused = expanded;
        refreshCombatPauseState();
    }
    return expanded;
}

function selectTactic(tacticMode) {
    if (!["MANUAL", "SEMI", "BALANCED", "OFFENSIVE"].includes(tacticMode)) return false;
    if (manualTurnPaused && tacticMode !== "MANUAL") {
        manualTurnPaused = false;
        playerAtb = Math.min(100, (Number(playerAtb) || 0) + 100);
        refreshCombatPauseState();
    }
    activeTactic = tacticMode;
    if (typeof currentRun !== "undefined" && currentRun) currentRun.tactic = tacticMode;
    syncTacticButtonsUi();

    const tacticNames = {
        MANUAL: "🎮 手動指令",
        SEMI: "🌓 半自動",
        BALANCED: "⚖️ 均衡防守",
        OFFENSIVE: "🔥 狂暴強擊"
    };
    if (typeof addLog === "function") {
        addLog(`🛡️【戰術切換】當前姿態：<strong>${tacticNames[tacticMode]}</strong>`, "perfect");
    }
    if (typeof updateUI === "function") updateUI();
    return true;
}

function syncTacticButtonsUi() {
    activeTactic = normalizeTacticMode(activeTactic);
    const modes = ['MANUAL', 'SEMI', 'BALANCED', 'OFFENSIVE'];
    modes.forEach((mode) => {
        const button = document.getElementById(`tactic-btn-${mode}`);
        if (!button) return;
        button.classList.toggle('active', activeTactic === mode);
        button.setAttribute('aria-pressed', String(activeTactic === mode));
    });
}

function syncCombatPauseUi() {
    if (typeof document === "undefined") return;
    const button = document.getElementById('combat-pause-btn');
    const status = document.getElementById('combat-pause-status');
    const inBattle = typeof gameState !== "undefined" && gameState === "BATTLE" &&
        typeof activeMonster !== "undefined" && activeMonster && activeMonster.hp > 0 &&
        typeof currentRun !== "undefined" && currentRun && currentRun.hp > 0;
    const paused = Boolean(inBattle && combatPaused);

    if (button) {
        button.disabled = !inBattle || tacticsDrawerPaused || manualTurnPaused;
        button.textContent = tacticsDrawerPaused ? "🔒 關閉選單以恢復" : (manualTurnPaused ? "🎮 請先完成指令" : (paused ? "▶️ 恢復戰鬥" : "⏸️ 暫停戰鬥"));
        button.setAttribute('aria-pressed', String(paused));
        button.setAttribute('aria-label', tacticsDrawerPaused ? "關閉戰術選單以恢復戰鬥" : (manualTurnPaused ? "請先完成你的戰鬥指令" : (paused ? "恢復自動戰鬥" : "暫停自動戰鬥")));
    }
    if (status) {
        status.textContent = inBattle
            ? (tacticsDrawerPaused ? "戰術選單開啟；敵人、環境與行動條已暫停。" : (manualPauseRequested ? "已手動暫停；敵人、環境與行動條停止。" : (manualTurnPaused ? "等待你的戰鬥指令。" : (paused ? "戰鬥暫停中。" : "自動戰鬥運作中"))))
            : "尚未進入戰鬥";
    }
}

function refreshCombatPauseState() {
    const wasPaused = combatPaused;
    combatPaused = Boolean(manualPauseRequested || tacticsDrawerPaused || manualTurnPaused);
    if (combatPaused) {
        clearCombatTicker();
    } else if (wasPaused && gameState === "BATTLE" && combatIntroStartTimer === null) {
        startCombatTicker();
    }
    syncCombatPauseUi();
}

function clearCombatTicker() {
    if (combatTickerTimer !== null) {
        const timer = combatTickerTimer;
        combatTickerTimer = null;
        clearInterval(timer);
    }
}

function stopCombatTicker() {
    clearCombatTicker();
    pendingCombatItem = null;
    pendingCombatCommand = null;
    manualPauseRequested = false;
    tacticsDrawerPaused = false;
    manualTurnPaused = false;
    combatPaused = false;
    syncCombatPauseUi();
}

function startCombatTicker() {
    if (combatPaused || combatTickerTimer !== null || gameState !== "BATTLE" || !activeMonster) return false;
    combatTickerTimer = setInterval(handleCombatTickerTick, 250);
    syncCombatPauseUi();
    return true;
}

function getPlayerAtbGain(speed) {
    const effectiveSpeed = Math.max(0, Number(speed) || 0);
    const baselineSpeed = 20;
    // 超出基準的攻速再額外乘 1.5；AGI 對 SPD 的貢獻因此比舊公式更明顯。
    const agilityBonus = Math.max(0, effectiveSpeed - baselineSpeed) * 0.5;
    return Math.min(100, effectiveSpeed + agilityBonus);
}

function handleCombatTickerTick() {
    if (combatPaused) return;
    if (gameState !== "BATTLE" || !activeMonster || currentRun.hp <= 0 || activeMonster.hp <= 0) {
        stopCombatTicker();
        return;
    }

    battleTimeElapsed += 0.25;
    tickSkillCooldowns(0.25);
    playerAtb += getPlayerAtbGain((currentRun.spd || 20) + getActiveCombatBuff("spdBuff"));
    monsterAtb += (activeMonster.spd || 15);
    envAtb += 15;

    if (envAtb >= 100) {
        envAtb -= 100;
        executeEnvironmentTick();
    }
    if (gameState === "BATTLE" && playerAtb >= 100 && currentRun.hp > 0 && activeMonster && activeMonster.hp > 0) {
        playerAtb = Math.min(100, playerAtb - 100);
        if (activeTactic === "MANUAL") {
            manualTurnPaused = true;
            refreshCombatPauseState();
            if (typeof addLog === "function") addLog("🎮【你的回合】選擇戰鬥、技能或道具。", "perfect");
        } else {
            executePlayerActionTick();
        }
    }
    if (gameState === "BATTLE" && !combatPaused && monsterAtb >= 100 && currentRun.hp > 0 && activeMonster && activeMonster.hp > 0) {
        monsterAtb = Math.min(100, monsterAtb - 100);
        executeMonsterActionTick();
    }
    if (typeof updateUI === "function") updateUI();
}

function toggleCombatPause() {
    if (gameState !== "BATTLE" || !activeMonster || activeMonster.hp <= 0 || !currentRun || currentRun.hp <= 0) {
        syncCombatPauseUi();
        return false;
    }

    manualPauseRequested = !manualPauseRequested;
    refreshCombatPauseState();
    if (manualPauseRequested) {
        if (typeof addLog === "function") addLog("⏸️【戰鬥暫停】怪物、環境與行動條計時已停止。", "env");
    } else {
        if (typeof addLog === "function") addLog("▶️【戰鬥恢復】自動戰鬥計時繼續。", "perfect");
    }
    return true;
}

// --------------------------------------------------------------------------
// ⚡ 自動戰鬥策略選擇與共用行動執行器
// --------------------------------------------------------------------------
function getSkillCooldownSeconds(skillMeta) {
    if (!skillMeta) return 0;
    const configured = skillMeta.cooldownSeconds ?? (typeof SKILL_COOLDOWN_SECONDS !== "undefined" ? SKILL_COOLDOWN_SECONDS[skillMeta.id] : 0);
    const seconds = Number(configured);
    return Number.isFinite(seconds) ? Math.max(0, Math.min(120, Math.floor(seconds))) : 0;
}

function getSkillCooldownRemaining(skillMeta) {
    if (!skillMeta?.id || !currentRun) return 0;
    const cooldowns = currentRun.skillCooldowns;
    if (!cooldowns || typeof cooldowns !== "object") return 0;
    let remaining = Number(cooldowns[skillMeta.id]) || 0;
    // Migrate cooldown timestamps saved by the previous release into active-combat seconds.
    if (remaining > 120) {
        remaining = Math.max(0, (remaining - Date.now()) / 1000);
        cooldowns[skillMeta.id] = remaining;
    }
    if (remaining <= 0) {
        delete cooldowns[skillMeta.id];
        return 0;
    }
    return Math.ceil(remaining);
}

function tickSkillCooldowns(elapsedSeconds = 0.25) {
    if (!currentRun?.skillCooldowns || typeof currentRun.skillCooldowns !== "object") return;
    const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
    for (const [skillId, storedValue] of Object.entries(currentRun.skillCooldowns)) {
        let remaining = Number(storedValue) || 0;
        if (remaining > 120) remaining = Math.max(0, (remaining - Date.now()) / 1000);
        remaining = Math.max(0, remaining - elapsed);
        if (remaining <= 0) delete currentRun.skillCooldowns[skillId];
        else currentRun.skillCooldowns[skillId] = remaining;
    }
}

function getCombatSkillCandidates() {
    if (!currentRun || !currentRun.skills) return [];
    let jobSkills = [];
    try {
        jobSkills = typeof getAllSkillsForJob === "function"
            ? getAllSkillsForJob(currentRun.job)
            : ((typeof SKILLS_DATABASE !== "undefined" && SKILLS_DATABASE[currentRun.job]) || []);
    } catch (error) {
        jobSkills = [];
    }
    if (!Array.isArray(jobSkills)) jobSkills = [];

    const isMagicJob = ["magician", "acolyte", "wizard", "priest", "sage"].includes(currentRun.job);
    const baseAttack = isMagicJob ? (currentRun.matk || 10) : (currentRun.atk || 15);
    return jobSkills.reduce((candidates, skillMeta, order) => {
        if (!skillMeta || skillMeta.type !== "active" || typeof skillMeta.run !== "function") return candidates;
        const skillLevel = Number(currentRun.skills[skillMeta.name]) || 0;
        const mpCost = Math.max(0, Number(skillMeta.mp) || 0);
        if (skillLevel <= 0 || (Number(currentRun.mp) || 0) < mpCost || getSkillCooldownRemaining(skillMeta) > 0) return candidates;
        try {
            const effect = skillMeta.run(skillLevel, baseAttack, currentRun.maxMp, currentRun.hp, currentRun.maxHp, currentRun);
            if (effect && typeof effect === "object") candidates.push({ skillMeta, skillLevel, mpCost, effect, order });
        } catch (error) {
            if (typeof console !== "undefined" && console.warn) console.warn(`技能 ${skillMeta.name} 無法解析`, error);
        }
        return candidates;
    }, []);
}

function isHealingSkillEffect(effect) {
    return Boolean(effect && (Number(effect.healAmount) > 0 || Number(effect.healPercent) > 0));
}

function isDamagingSkillEffect(effect) {
    return Boolean(effect && (Number(effect.dmg) > 0 || Number(effect.physicalDmg) > 0 || Number(effect.magicDmg) > 0));
}

function applySkillForcedCritical(result, effect, jobTraits) {
    if (!result || result.isMiss || !effect?.forceCrit) return result;
    const traitBonus = Number(jobTraits?.critDamageBonus) || 0;
    const skillBonus = Math.max(0, Number(effect.critDamageBonus) || 0);
    const normalMultiplier = Math.max(1, 1.5 + traitBonus);
    const skillMultiplier = normalMultiplier + skillBonus;
    if (!result.isCrit) {
        result.isCrit = true;
        result.damage = Math.floor(Number(result.damage) * skillMultiplier);
    } else if (skillBonus > 0) {
        result.damage = Math.floor(Number(result.damage) * skillMultiplier / normalMultiplier);
    }
    return result;
}

function getActiveCombatBuff(key) {
    const buff = currentRun?.activeCombatBuffs?.[key];
    return buff && Number(buff.turns) > 0 ? Number(buff.value) || 0 : 0;
}

function tickCombatBuffs() {
    if (!currentRun || !currentRun.activeCombatBuffs) return;
    for (const [key, buff] of Object.entries(currentRun.activeCombatBuffs)) {
        buff.turns = Math.max(0, (Number(buff.turns) || 0) - 1);
        if (buff.turns <= 0) delete currentRun.activeCombatBuffs[key];
    }
}

function isCombatUtilitySkillEffect(effect) {
    return Boolean(effect && (
        Number(effect.blockBuff) > 0 || Number(effect.mdefBuff) > 0 || Number(effect.dodgeBuff) > 0 || Number(effect.spdBuff) > 0 ||
        Number(effect.permAtk) > 0 || Number(effect.permHp) > 0 || Number(effect.permDodge) > 0 ||
        Number(effect.bossDmgCut) > 0 || Number(effect.thornsFire) > 0 || effect.guaranteedCritNext
    ));
}

function isUsefulCombatUtilitySkill(candidate) {
    if (!candidate || !isCombatUtilitySkillEffect(candidate.effect)) return false;
    const effect = candidate.effect;
    const used = currentRun.skillBuffsUsed || {};
    if ((Number(effect.permAtk) > 0 || Number(effect.permHp) > 0 || Number(effect.permDodge) > 0 || effect.guaranteedCritNext) && used[candidate.skillMeta.id]) return false;
    if (Number(effect.bossDmgCut) > 0 && (!activeMonster?.isBoss || Number(currentRun.bossDmgCut) > 0)) return false;
    if (Number(effect.blockBuff) > 0 && getActiveCombatBuff("blockBuff") > 0) return false;
    if (Number(effect.mdefBuff) > 0 && getActiveCombatBuff("mdefBuff") > 0) return false;
    if (Number(effect.dodgeBuff) > 0 && getActiveCombatBuff("dodgeBuff") > 0) return false;
    if (Number(effect.spdBuff) > 0 && getActiveCombatBuff("spdBuff") > 0) return false;
    if (Number(effect.thornsFire) > 0 && getActiveCombatBuff("thornsFire") > 0) return false;
    return true;
}

function chooseAutoBattleAction() {
    if (!activeMonster || activeMonster.hp <= 0) return { type: "none" };
    const mode = normalizeTacticMode(activeTactic);
    if (mode === "MANUAL") return { type: "basic" };
    const autoMode = mode === "SEMI" ? "BALANCED" : mode;

    const candidates = getCombatSkillCandidates();
    const hpPercent = (Number(currentRun.hp) / Math.max(1, Number(currentRun.maxHp) || 1)) * 100;

    if (autoMode === "BALANCED") {
        if (hpPercent < 60) {
            const healingSkill = candidates
                .filter((candidate) => isHealingSkillEffect(candidate.effect))
                .sort((a, b) => {
                    const healA = Number(a.effect.healAmount) || Math.floor((currentRun.maxHp || 100) * (Number(a.effect.healPercent) || 0));
                    const healB = Number(b.effect.healAmount) || Math.floor((currentRun.maxHp || 100) * (Number(b.effect.healPercent) || 0));
                    return healB - healA || a.order - b.order;
                })[0];
            if (healingSkill) return { type: "skill", candidate: healingSkill };
        }

        if (hpPercent < 35 && Array.isArray(currentRun.inventory)) {
            const healingItemNames = ["厚牛巨堡", "料理", "牛扒", "炸薯", "烤野豬肉", "初級治癒", "強效魔藥", "壁虎乾", "活力合劑"];
            const itemIndex = currentRun.inventory.findIndex((item) => healingItemNames.some((name) => String(item || "").includes(name)));
            if (itemIndex >= 0) return { type: "item", itemIndex };
        }

        const maxMp = Math.max(0, Number(currentRun.maxMp) || 0);
        const mp = Math.max(0, Number(currentRun.mp) || 0);
        if (maxMp > 0 && mp < maxMp * 0.55) {
            const restoreSkill = candidates
                .filter((candidate) => Number(candidate.effect.mpRestore) > 0)
                .sort((a, b) => Number(b.effect.mpRestore) - Number(a.effect.mpRestore))[0];
            if (restoreSkill) return { type: "skill", candidate: restoreSkill };
        }

        const reserveMp = Math.ceil(maxMp * 0.3);
        const defensiveShield = candidates
            .filter((candidate) => Number(candidate.effect.shieldGain) > 0 && currentRun.mp - candidate.mpCost >= reserveMp)
            .sort((a, b) => Number(b.effect.shieldGain) - Number(a.effect.shieldGain))[0];
        if (hpPercent < 75 && defensiveShield && (Number(currentRun.shield) || 0) < Number(defensiveShield.effect.shieldGain) * 0.5) {
            return { type: "skill", candidate: defensiveShield };
        }

        const utilitySkill = candidates.find(isUsefulCombatUtilitySkill);
        if (utilitySkill) return { type: "skill", candidate: utilitySkill };

        const attackSkill = [...candidates].reverse().find((candidate) =>
            isDamagingSkillEffect(candidate.effect) &&
            !isHealingSkillEffect(candidate.effect) &&
            (!candidate.effect.explodePoison || Number(activeMonster.poisonStacks) > 0) &&
            (!candidate.effect.consumeAllMp || activeMonster.isBoss || (Number(activeMonster.hp) / Math.max(1, Number(activeMonster.maxHp) || 1)) <= 0.35) &&
            currentRun.mp - candidate.mpCost >= reserveMp
        );
        return attackSkill ? { type: "skill", candidate: attackSkill } : { type: "basic" };
    }

    const offensiveSkill = [...candidates].reverse().find((candidate) =>
        isDamagingSkillEffect(candidate.effect) && !isHealingSkillEffect(candidate.effect) &&
        (!candidate.effect.explodePoison || Number(activeMonster.poisonStacks) > 0)
    );
    if (offensiveSkill) return { type: "skill", candidate: offensiveSkill };
    const utilitySkill = candidates.find(isUsefulCombatUtilitySkill);
    return utilitySkill ? { type: "skill", candidate: utilitySkill } : { type: "basic" };
}

function executeAutoBattleAiTurn() {
    if (!activeMonster || activeMonster.hp <= 0) return false;
    const action = chooseAutoBattleAction();
    if (action.type === "skill") {
        const candidate = action.candidate;
        if (executeActiveSkill(candidate.skillMeta, candidate.skillLevel, candidate.effect)) return true;
        return executeBasicAttack();
    }
    if (action.type === "item") {
        if (typeof executeUseDungeonItem === "function") {
            executeUseDungeonItem(currentRun.inventory[action.itemIndex], action.itemIndex);
            return true;
        }
        return executeBasicAttack();
    }
    if (action.type === "basic") return executeBasicAttack();
    return false;
}

function executeActiveSkill(skillMeta, skillLevel, preparedEffect = null) {
    if (!skillMeta || !activeMonster || activeMonster.hp <= 0 || !currentRun) return false;
    if (getSkillCooldownRemaining(skillMeta) > 0) return false;
    const mpCost = Math.max(0, Number(skillMeta.mp) || 0);
    if ((Number(currentRun.mp) || 0) < mpCost) return false;

    const isMagicJob = ["magician", "acolyte", "wizard", "priest", "sage"].includes(currentRun.job);
    const baseAttack = isMagicJob ? (currentRun.matk || 10) : (currentRun.atk || 15);
    let effect = preparedEffect ? { ...preparedEffect } : null;
    if (!effect) {
        try {
            effect = skillMeta.run(skillLevel, baseAttack, currentRun.maxMp, currentRun.hp, currentRun.maxHp, currentRun);
        } catch (error) {
            return false;
        }
    }
    if (!effect || typeof effect !== "object") return false;

    const hasSupportedEffect = isDamagingSkillEffect(effect) || isHealingSkillEffect(effect) ||
        Number(effect.shieldGain) > 0 || Number(effect.mpRestore) > 0 ||
        isCombatUtilitySkillEffect(effect) || Number(effect.stealGold) > 0 || effect.stealMat;
    if (!hasSupportedEffect) return false;
    if (Number(effect.bossDmgCut) > 0 && !activeMonster.isBoss) return false;
    if (effect.explodePoison && Number(activeMonster.poisonStacks) <= 0) return false;

    const cooldownSeconds = getSkillCooldownSeconds(skillMeta);
    if (cooldownSeconds > 0) {
        currentRun.skillCooldowns ||= {};
        currentRun.skillCooldowns[skillMeta.id] = cooldownSeconds;
    }

    const jobTraits = currentRun.jobCombatTraits || {};
    const freeCast = !!effect.isMagic && Number(jobTraits.freeSkillMpChance) > 0 && Math.random() < Number(jobTraits.freeSkillMpChance);
    if (!freeCast) currentRun.mp = Math.max(0, (Number(currentRun.mp) || 0) - mpCost);
    if (effect.consumeAllMp) {
        const remainingMp = Math.max(0, Number(currentRun.mp) || 0);
        if (Number(effect.mpBonusDamageRate) > 0 && Number(effect.dmg) > 0) {
            effect.dmg += Math.floor(remainingMp * Number(effect.mpBonusDamageRate));
        }
        currentRun.mp = 0;
        if (typeof addLog === "function") addLog(`🔵【耗盡魔力】${skillMeta.name || "技能"}吸收剩餘 ${remainingMp} MP 強化這次攻擊！`, "perfect");
    }
    if (currentRun.job === "sage" && effect.isMagic && Number(effect.dmg) > 0 && Math.random() < (Number(jobTraits.doubleCastChance) || 0)) {
        effect.dmg = Math.floor(Number(effect.dmg) * 2);
        effect.hitCount = Math.max(1, Math.floor(Number(effect.hitCount) || 1) * 2);
        if (typeof addLog === "function") addLog("📖【自由詠唱】賢者觸發連續施法，魔法傷害加倍！", "perfect");
    }
    const skillName = String(skillMeta.name || "技能");
    const fxClass = typeof detectSkillCssClass === "function" ? detectSkillCssClass(skillName) : "skill-hit";
    const vfx = typeof spawnVfx === "function" ? spawnVfx : () => {};
    if (typeof showBattleSkillCastCue === "function") showBattleSkillCastCue(skillName, fxClass, effect);
    if (cooldownSeconds > 0 && typeof addLog === "function") addLog(`⏳【${skillName}】進入冷卻，${cooldownSeconds} 秒後可再次使用。`, "env");
    if (freeCast && typeof addLog === "function") addLog("✨【元素共鳴】本次魔法不消耗 MP！", "perfect");

    if (Number(effect.shieldGain) > 0) {
        const shieldGain = Math.floor(Number(effect.shieldGain) * (Number(jobTraits.shieldMultiplier) || 1));
        currentRun.shield = (Number(currentRun.shield) || 0) + shieldGain;
        vfx("shield", { anchor: "player", text: `+${shieldGain}` });
        if (typeof addLog === "function") addLog(`🛡️ 施展 <span class="${fxClass}">【${skillName} Lv.${skillLevel}】</span>，獲得 <strong>+${shieldGain} Shield</strong>！`, "perfect");
    }

    if (isHealingSkillEffect(effect)) {
        const baseHealValue = Number(effect.healAmount) || Math.floor((currentRun.maxHp || 100) * (Number(effect.healPercent) || 0));
        const healValue = Math.floor(baseHealValue * (Number(jobTraits.healMultiplier) || 1));
        const hpBefore = Number(currentRun.hp) || 0;
        currentRun.hp = Math.min(currentRun.maxHp, hpBefore + healValue);
        const actualHeal = Math.max(0, currentRun.hp - hpBefore);
        vfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`✨ 施展 <span class="${fxClass}">【${skillName} Lv.${skillLevel}】</span>，回復 <span class="heal-effect">+${actualHeal} HP</span>！`, "perfect");
    }

    if (Number(effect.mpRestore) > 0) {
        const mpBefore = Number(currentRun.mp) || 0;
        currentRun.mp = Math.min(currentRun.maxMp || 0, mpBefore + Number(effect.mpRestore));
        const restoredMp = Math.max(0, currentRun.mp - mpBefore);
        vfx("heal", { anchor: "player", text: `+${restoredMp} MP`, variant: "mana", labelKind: "mana" });
        if (typeof addLog === "function") addLog(`🔷 施展 <span class="${fxClass}">【${skillName} Lv.${skillLevel}】</span>，回復 <span class="heal-effect">+${restoredMp} MP</span>！`, "perfect");
    }

    if (isCombatUtilitySkillEffect(effect)) {
        const duration = Math.max(1, Math.floor(Number(effect.turns || effect.duration) || 1));
        currentRun.activeCombatBuffs ||= {};
        currentRun.skillBuffsUsed ||= {};
        if (Number(effect.blockBuff) > 0) currentRun.activeCombatBuffs.blockBuff = { value: Number(effect.blockBuff), turns: duration };
        if (Number(effect.mdefBuff) > 0) currentRun.activeCombatBuffs.mdefBuff = { value: Number(effect.mdefBuff), turns: duration };
        if (Number(effect.dodgeBuff) > 0) currentRun.activeCombatBuffs.dodgeBuff = { value: Number(effect.dodgeBuff), turns: duration };
        if (Number(effect.spdBuff) > 0) currentRun.activeCombatBuffs.spdBuff = { value: Number(effect.spdBuff), turns: duration };
        if (Number(effect.thornsFire) > 0) currentRun.activeCombatBuffs.thornsFire = { value: Number(effect.thornsFire), turns: duration };
        if (Number(effect.bossDmgCut) > 0) currentRun.bossDmgCut = Math.min(0.9, Number(effect.bossDmgCut));
        if (Number(effect.permAtk) > 0 || Number(effect.permHp) > 0 || Number(effect.permDodge) > 0) {
            currentRun.runBonuses ||= {};
            if (Number(effect.permAtk) > 0) {
                const attackKey = isMagicJob ? "matk" : "atk";
                currentRun.runBonuses[attackKey] = (Number(currentRun.runBonuses[attackKey]) || 0) + Number(effect.permAtk);
            }
            if (Number(effect.permHp) > 0) currentRun.runBonuses.maxHp = (Number(currentRun.runBonuses.maxHp) || 0) + Number(effect.permHp);
            if (Number(effect.permDodge) > 0) currentRun.runBonuses.perfectDodge = (Number(currentRun.runBonuses.perfectDodge) || 0) + Number(effect.permDodge);
            if (typeof resetCurrentRunData === "function") resetCurrentRunData();
        }
        if (effect.guaranteedCritNext) currentRun.guaranteedCritNext = true;
        if (Number(effect.permAtk) > 0 || Number(effect.permHp) > 0 || Number(effect.permDodge) > 0 || effect.guaranteedCritNext) {
            currentRun.skillBuffsUsed[skillMeta.id] = true;
        }
        if (typeof addLog === "function") {
            if (Number(effect.bossDmgCut) > 0) addLog(`✨ 施展【${skillName}】，下一次首領攻擊傷害降低 ${Math.floor(Number(effect.bossDmgCut) * 100)}%！`, "perfect");
            else if (effect.guaranteedCritNext && Number(effect.permDodge) > 0) addLog(`✨ 施展【${skillName}】，完美閃避永久提升，下一次攻擊必定暴擊！`, "perfect");
            else if (Number(effect.permAtk) > 0 || Number(effect.permHp) > 0 || Number(effect.permDodge) > 0) addLog(`✨ 施展【${skillName}】，永久強化本局冒險能力！`, "perfect");
            else if (effect.guaranteedCritNext) addLog(`✨ 施展【${skillName}】，完美閃避永久提升，下一次攻擊必定暴擊！`, "perfect");
            else addLog(`✨ 施展【${skillName}】，獲得持續 ${duration} 次自身行動的戰鬥增益！`, "perfect");
        }
    }

    if (isDamagingSkillEffect(effect)) {
        const hybridHitCount = (Number(effect.physicalDmg) > 0 ? 1 : 0) + (Number(effect.magicDmg) > 0 ? 1 : 0);
        const hitCount = Math.max(1, Math.floor(Number(effect.hitCount) || hybridHitCount || (effect.isTripleHit ? 3 : (effect.isDoubleHit ? 2 : 1))));
        const skillVfx = typeof resolveSkillVfx === "function" ? resolveSkillVfx(skillMeta, currentRun.job) : { projectileType: "slash" };
        if (typeof triggerProjectileFX === "function") triggerProjectileFX(skillVfx.projectileType || "slash", hitCount, skillVfx);

        let damageApplied = false;
        if ((Number(effect.physicalDmg) > 0 || Number(effect.magicDmg) > 0) && !effect.explodePoison) {
            const components = [];
            if (Number(effect.physicalDmg) > 0) components.push({ damage: Number(effect.physicalDmg), defense: Number(activeMonster.def) || 0, isMagic: false });
            if (Number(effect.magicDmg) > 0) components.push({ damage: Number(effect.magicDmg), defense: Number(activeMonster.mdef) || 0, isMagic: true });
            let totalDamage = 0;
            let totalAbsorbed = 0;
            let totalHits = 0;
            for (const component of components) {
                const componentResult = typeof calculateDamage === "function"
                    ? calculateDamage(component.damage, component.defense, true, component.isMagic)
                    : { damage: component.damage, isMiss: false, isCrit: false };
                if (componentResult.isMiss) continue;
                applySkillForcedCritical(componentResult, effect, jobTraits);
                const hitResult = applyDamageWithShield(activeMonster, componentResult.damage);
                totalDamage += hitResult.actualHpDmg;
                totalAbsorbed += hitResult.absorbed;
                totalHits++;
                damageApplied = true;
            }
            if (totalAbsorbed > 0) vfx("shield", { anchor: "monster", text: `-${totalAbsorbed}` });
            vfx("hit", { anchor: "monster", text: `-${totalDamage} HP`, firstPersonAttack: true, result: "hit" });
            if (typeof addLog === "function") addLog(`✝️【${skillName} Lv.${skillLevel}】物理與魔法各判定一次（命中 ${totalHits}/${components.length}），合計造成 <span class="num-popup num-p-dmg">-${totalDamage} HP</span>！`, "skill-hit");
        } else if (effect.explodePoison && Number(activeMonster.poisonStacks) > 0) {
            const poisonStacks = Number(activeMonster.poisonStacks) || 0;
            const rawExplosionDamage = Number(effect.dmg) + poisonStacks * 70;
            const result = applyDamageWithShield(activeMonster, rawExplosionDamage);
            if (result.absorbed > 0) vfx("shield", { anchor: "monster", text: `-${result.absorbed}` });
            vfx("hit", { anchor: "monster", text: `-${result.actualHpDmg}`, firstPersonAttack: true, result: "hit", particleCount: typeof prefersReducedMotion === "function" && prefersReducedMotion() ? 0 : 4 });
            activeMonster.poisonStacks = 0;
            damageApplied = true;
            if (typeof addLog === "function") addLog(`🧪💥 引爆全部 <span class="skill-poison">${poisonStacks} 層劇毒</span>！造成 <span class="num-popup num-p-dmg">-${result.actualHpDmg} HP</span>！`, "skill-hit");
        } else {
            let rawDamage = Number(effect.dmg);
            let targetDef = (isMagicJob || effect.isMagic) ? (activeMonster.mdef || 0) : (activeMonster.def || 0);
            if (Number(effect.pierceArmor) > 0) {
                const pierce = Math.max(0, Math.min(1, Number(effect.pierceArmor)));
                targetDef = Math.floor(targetDef * (1 - pierce));
            }
            if (effect.ignoreDef) targetDef = 0;

            let elementalBonus = 0;
            if (Number(effect.bonusVsFrozen) > 0 && Number(activeMonster.freezeTurns) > 0) elementalBonus += Number(effect.bonusVsFrozen);
            if (Number(effect.bonusVsBurning) > 0 && Number(activeMonster.burnStacks) > 0) elementalBonus += Number(effect.bonusVsBurning);
            if (Number(effect.bonusVsPoisoned) > 0 && Number(activeMonster.poisonStacks) > 0) elementalBonus += Number(effect.bonusVsPoisoned);
            if (elementalBonus > 0) {
                rawDamage = Math.floor(rawDamage * (1 + elementalBonus));
                if (typeof addLog === "function") addLog(`✨【元素克制】${skillName} 對應目標狀態，傷害提高 ${Math.floor(elementalBonus * 100)}%！`, "perfect");
            }

            let damageResult = typeof calculateDamage === "function"
                ? calculateDamage(rawDamage, targetDef, true, (isMagicJob || effect.isMagic))
                : { damage: rawDamage, isMiss: false, isCrit: false };
            applySkillForcedCritical(damageResult, effect, jobTraits);

            if (damageResult.isMiss) {
                vfx("miss", { anchor: "monster", text: "MISS", firstPersonAttack: true, result: "miss" });
                if (typeof addLog === "function") addLog(`💨 施展 <span class="${fxClass}">【${skillName} Lv.${skillLevel}】</span>，但被魔物 <span class="miss-effect">[MISS 閃過]</span>！`, "miss");
            } else {
                let totalDamage = 0;
                let totalAbsorbed = 0;
                for (let hit = 0; hit < hitCount; hit++) {
                    const oneHitDamage = Math.max(1, Math.floor(damageResult.damage / hitCount));
                    const result = applyDamageWithShield(activeMonster, oneHitDamage);
                    totalDamage += result.actualHpDmg;
                    totalAbsorbed += result.absorbed;
                }
                if (totalAbsorbed > 0) vfx("shield", { anchor: "monster", text: `-${totalAbsorbed}` });
                const hitLabel = `-${totalDamage}${hitCount > 1 ? ` ×${hitCount}` : ""} HP`;
                vfx(damageResult.isCrit ? "crit" : "hit", { anchor: "monster", text: hitLabel, firstPersonAttack: true, result: damageResult.isCrit ? "crit" : "hit" });
                const numClass = (isMagicJob || effect.isMagic) ? "num-m-dmg" : "num-p-dmg";
                const critTag = damageResult.isCrit ? `<span class="skill-crit">⚡ 暴擊！</span>` : "";
                if (typeof addLog === "function") {
                    addLog(`💥 ${critTag}施展 <span class="${fxClass}">【${skillName} Lv.${skillLevel}】${hitCount > 1 ? `(${hitCount}連發)` : ""}</span> 重創 <span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${totalDamage} HP</span>`, "skill-hit");
                }
                damageApplied = true;
            }
        }

        if (damageApplied && Number(effect.shieldBreak) > 0 && Number(activeMonster.shield) > 0) {
            const shatteredShield = Number(activeMonster.shield) || 0;
            activeMonster.shield = 0;
            if (typeof addLog === "function") addLog(`🛡️【破盾】${skillName}擊碎敵方 ${shatteredShield} 點護盾！`, "skill-hit");
        }
        if (damageApplied && effect.dispel) {
            const strippedShield = Number(activeMonster.shield) || 0;
            activeMonster.shield = 0;
            let strippedBuffCount = 0;
            for (const key of ["activeBuffs", "buffs"]) {
                if (!Object.prototype.hasOwnProperty.call(activeMonster, key)) continue;
                const value = activeMonster[key];
                strippedBuffCount += Array.isArray(value) ? value.length : (value && typeof value === "object" ? Object.keys(value).length : 0);
                delete activeMonster[key];
            }
            for (const key of ["atkBuff", "defBuff", "mdefBuff", "spdBuff"]) {
                if (Number(activeMonster[key]) > 0) { strippedBuffCount++; delete activeMonster[key]; }
            }
            if (typeof addLog === "function") addLog(`📖【解除魔法】${skillName}驅散護盾 ${strippedShield} 點與 ${strippedBuffCount} 個敵方增益！`, "perfect");
        }
        if (damageApplied && Number(effect.stealGold) > 0) {
            const stolenGold = Math.max(0, Math.floor(Number(effect.stealGold)));
            currentRun.gold = (Number(currentRun.gold) || 0) + stolenGold;
            if (typeof addLog === "function") addLog(`💰【偷竊成功】從魔物身上奪得 ${stolenGold} G！`, "perfect");
        }
        if (damageApplied && effect.stealMat) {
            const stolenItem = activeMonster.dropItem || (typeof getMonsterDrop === "function" ? getMonsterDrop(activeMonster.name) : null);
            if (stolenItem && typeof safePushToInventory === "function") {
                const message = safePushToInventory(currentRun, accountMeta, stolenItem);
                if (typeof addLog === "function") addLog(`🎒【素材竊取】${message}`, "perfect");
            }
        }

        if (damageApplied && activeMonster.hp > 0) {
            if (Number(effect.poisonStacks) > 0) activeMonster.poisonStacks = (Number(activeMonster.poisonStacks) || 0) + Number(effect.poisonStacks);
            if (Number(effect.burnStacks) > 0) activeMonster.burnStacks = (Number(activeMonster.burnStacks) || 0) + Number(effect.burnStacks);
            const freezeChance = Math.max(0, Math.min(100, Number(effect.freezeChance) || 0));
            if (freezeChance > 0 && Math.random() * 100 < freezeChance) {
                activeMonster.freezeTurns = (Number(activeMonster.freezeTurns) || 0) + 1;
                if (typeof addLog === "function") addLog("❄️【極寒冷凍】魔物被凍結 1 回合！", "perfect");
            }
            const stunChance = Math.max(0, Math.min(100, Number(effect.stunChance) || 0));
            if (stunChance > 0 && Math.random() * 100 < stunChance) {
                activeMonster.stunTurns = (Number(activeMonster.stunTurns) || 0) + 1;
                if (typeof addLog === "function") addLog("💫【強制眩暈】魔物被擊暈 1 回合！", "perfect");
            }
            if (activeMonster.hp > 0 && Number(jobTraits.falconChance) > 0 && Math.random() < Number(jobTraits.falconChance)) {
                const falconDamage = Math.max(1, Math.floor((currentRun.atk || 15) * 0.5));
                const falconResult = applyDamageWithShield(activeMonster, falconDamage);
                if (typeof addLog === "function") addLog(`🦅【獵鷹協同】獵鷹追加無視防禦傷害 -${falconResult.actualHpDmg} HP！`, "skill-hit");
            }
        }
    }
    return true;
}

function executeBasicAttack() {
    if (!activeMonster || activeMonster.hp <= 0 || !currentRun) return false;
    const isMagicJob = ["magician", "acolyte", "wizard", "priest", "sage"].includes(currentRun.job);
    const attackPower = isMagicJob ? (currentRun.matk || 10) : (currentRun.atk || 15);
    const defense = isMagicJob ? (activeMonster.mdef || 0) : (activeMonster.def || 0);
    const damageResult = typeof calculateDamage === "function"
        ? calculateDamage(attackPower, defense, true, isMagicJob)
        : { damage: attackPower, isMiss: false, isCrit: false };
    const vfx = typeof spawnVfx === "function" ? spawnVfx : () => {};

    if (damageResult.isMiss) {
        vfx("miss", { anchor: "monster", text: "MISS", firstPersonAttack: true, result: "miss" });
        if (typeof addLog === "function") addLog(`💨 基本攻擊被魔物 <span class="miss-effect">[MISS 閃過]</span>！`, "miss");
        return true;
    }

    const result = applyDamageWithShield(activeMonster, damageResult.damage);
    let totalDamage = result.actualHpDmg;
    let hitCount = 1;
    const jobTraits = currentRun.jobCombatTraits || {};
    if (!isMagicJob && Number(currentRun.doubleStrike) > 0 && Math.random() < Number(currentRun.doubleStrike) && activeMonster.hp > 0) {
        const secondHit = calculateDamage(attackPower, defense, true, false);
        if (!secondHit.isMiss) {
            const secondResult = applyDamageWithShield(activeMonster, secondHit.damage);
            totalDamage += secondResult.actualHpDmg;
            hitCount++;
        }
    }
    if (activeMonster.hp > 0 && Number(jobTraits.falconChance) > 0 && Math.random() < Number(jobTraits.falconChance)) {
        const falconResult = applyDamageWithShield(activeMonster, Math.max(1, Math.floor((currentRun.atk || 15) * 0.5)));
        totalDamage += falconResult.actualHpDmg;
    }
    if (result.absorbed > 0) vfx("shield", { anchor: "monster", text: `-${result.absorbed}` });
    vfx(damageResult.isCrit ? "crit" : "hit", { anchor: "monster", text: `-${totalDamage}${hitCount > 1 ? ` ×${hitCount}` : ""}`, firstPersonAttack: true, result: damageResult.isCrit ? "crit" : "hit" });
    const numClass = isMagicJob ? "num-m-dmg" : "num-p-dmg";
    const critText = damageResult.isCrit ? `<span class="skill-crit">⚡ 暴擊！</span>` : "";
    if (typeof addLog === "function") {
        addLog(`⚔️ 基本攻擊！${critText}<span class="strike-slash">[${activeMonster.name}]</span> <span class="num-popup ${numClass}">-${totalDamage}${hitCount > 1 ? ` ×${hitCount}` : ""} HP</span>`, "deal");
    }
    return true;
}
// ==========================================================================
// 🧭 肉鴿分支地圖與 40 種奇遇卡片對接引擎
// ==========================================================================

const ROUTE_THEME_LIBRARY = [
    {
        id: "rift",
        name: "裂縫之門",
        icon: "🕳️",
        color: "#8b5cf6",
        omen: "裂縫深處傳來低語，像是某種古老存在正在觀望你。",
        riskText: "這條路充滿不明異動，走進去可能遇見變異敵人。",
        rewardText: "但若邊緣走位得當，通常能找到稀有殘骸或隱藏寶物。"
    },
    {
        id: "altar",
        name: "祭壇遺跡",
        icon: "🗿",
        color: "#f59e0b",
        omen: "石祭壇上殘留血跡與古老符文，周圍空氣都帶著咒語。",
        riskText: "你可能面對祭儀守衛或詛咒波動，風險不小。",
        rewardText: "然而這裡通常藏著稀有素材、神秘藥劑與隱藏任務線索。"
    },
    {
        id: "mist",
        name: "迷霧小徑",
        icon: "🌫️",
        color: "#38bdf8",
        omen: "霧氣像在引導你前進，四周卻看不清真正出口在哪裡。",
        riskText: "路徑較安定，但迷霧很容易讓人誤判方向與伏擊點。",
        rewardText: "這條路適合補給、休整與撿拾零碎物資。"
    },
    {
        id: "cache",
        name: "遺失寶庫",
        icon: "💎",
        color: "#22c55e",
        omen: "殘破箱櫃與金屬碎片堆在一起，像是被遺忘的寶藏。",
        riskText: "寶庫往往會有陷阱與守護機關，任何踏錯一步都可能招來反擊。",
        rewardText: "若能穿過，通常能拿到高價裝備、奇珍和大量金幣。"
    },
    {
        id: "bloodytrail",
        name: "血跡小徑",
        icon: "🩸",
        color: "#ef4444",
        omen: "地面顆粒狀的血跡從深處延伸過來，像是剛剛有人跑過。",
        riskText: "這裡很可能有戰鬥、追擊與突發敵人。",
        rewardText: "也常帶來稀有戰利品與強勁戰鬥數據。"
    },
    {
        id: "echo",
        name: "回音廊道",
        icon: "🔊",
        color: "#a78bfa",
        omen: "空洞的回音像在對你說話，彷彿這條路曾經有人走過。",
        riskText: "聲音不斷變換，會讓人誤判危險和獎勵的真實方向。",
        rewardText: "但若你能保持清醒，常能得到命運的額外啟示。"
    },
    {
        id: "sanctum",
        name: "淨化小堂",
        icon: "✨",
        color: "#2dd4bf",
        omen: "一縷光芒從瓦礫之中滲出，像被遺忘的守護力場。",
        riskText: "這裡通常較安全，但不知是否有暗影伺機而動。",
        rewardText: "適合治療、恢復、補給與小幅屬性加成。"
    },
    {
        id: "shrine",
        name: "黑暗神龕",
        icon: "🕯️",
        color: "#f97316",
        omen: "燃盡的蠟燭在無風中燃燒，像有人守在黑暗另一側。",
        riskText: "儀式神龕常常伴隨詛咒與超常現象，冒進不一定安全。",
        rewardText: "一旦通過，往往會帶來驚人的獎勵與劇烈增益。"
    }
];

function weightedPick(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) return item;
    }
    return items[0];
}

function buildRandomRouteNode(floor, baseType) {
    const theme = ROUTE_THEME_LIBRARY[Math.floor(Math.random() * ROUTE_THEME_LIBRARY.length)];
    const dangerBase = 28 + floor * 1.15 + Math.random() * 30;
    const rewardBase = 20 + floor * 0.9 + Math.random() * 28;

    let danger = Math.min(96, Math.round(dangerBase));
    let reward = Math.min(96, Math.round(rewardBase));

    if (baseType === "REST_SHOP") {
        danger = Math.min(65, Math.round(danger * 0.55));
        reward = Math.min(85, Math.round(reward * 1.1));
    } else if (baseType === "EVENT") {
        danger = Math.min(88, Math.round(danger * 0.8));
        reward = Math.min(92, Math.round(reward * 1.15));
    } else if (baseType === "ELITE") {
        danger = Math.min(98, Math.round(danger * 1.2));
        reward = Math.min(98, Math.round(reward * 1.32));
    } else if (baseType === "COMBAT") {
        danger = Math.min(90, Math.round(danger * 0.95));
        reward = Math.min(88, Math.round(reward * 1.08));
    }

    const riskLabel = danger >= 75 ? "極危" : danger >= 50 ? "高危" : danger >= 30 ? "中危" : "低危";
    const rewardLabel = reward >= 75 ? "巨額" : reward >= 50 ? "優厚" : reward >= 30 ? "穩妥" : "微薄";

    return {
        type: baseType,
        title: `${theme.icon} ${theme.name}`,
        desc: `${theme.omen} ${theme.riskText} ${theme.rewardText}`,
        icon: theme.icon,
        color: theme.color,
        danger,
        reward,
        clue: theme.omen,
        riskLabel,
        rewardLabel,
        themeName: theme.name,
        variant: theme.id
    };
}

function generateRouteNodes(floor) {
    if (floor % 10 === 0) {
        return [{
            type: "BOSS",
            title: `👹 領主巨室 (B${floor}F)`,
            desc: "深淵真相在這裡沉睡，殘破的王座上，壓迫感像一張巨口正等著你靠近。",
            icon: "👹",
            color: "#ff3838",
            danger: 98,
            reward: 96,
            clue: "最終的命運就在這裡揭開，這一層不只是戰鬥，而是試煉。",
            riskLabel: "極危",
            rewardLabel: "巨額",
            themeName: "領主巨室",
            variant: "boss"
        }];
    }

    const typesPool = [
        { type: "COMBAT", weight: 42 },
        { type: "ELITE", weight: 20 },
        { type: "EVENT", weight: 24 },
        { type: "REST_SHOP", weight: 14 }
    ];

    let choices = [];
    let count = Math.random() < 0.38 ? 2 : 3;

    for (let i = 0; i < count; i++) {
        const selected = weightedPick(typesPool);
        choices.push(buildRandomRouteNode(floor, selected.type));
    }

    if (!choices.some(c => c.type === "COMBAT" || c.type === "ELITE")) {
        choices[0] = buildRandomRouteNode(floor, "COMBAT");
    }

    if (!choices.some(c => c.type === "EVENT")) {
        choices[Math.min(choices.length - 1, 1)] = buildRandomRouteNode(floor, "EVENT");
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
        const riskBar = Math.max(10, Math.min(100, node.danger || 50));
        const rewardBar = Math.max(10, Math.min(100, node.reward || 50));

        btn.style.cssText = `
            background: linear-gradient(135deg, rgba(20, 20, 28, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%);
            border: 1px solid ${node.color || '#ffd700'};
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 10px;
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
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px;">
                <span style="font-size: 15px; font-weight: bold; color: ${node.color}; line-height: 1.3;">${node.icon} ${node.title}</span>
                <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: ${node.color}22; color: ${node.color}; border: 1px solid ${node.color}55; white-space: nowrap;">分支 #${idx + 1}</span>
            </div>
            <div style="font-size: 11px; color: #d1d1d6; line-height: 1.5; margin-bottom: 10px;">${node.clue || node.desc}</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                <span style="font-size: 10px; padding: 3px 7px; border-radius: 999px; background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.4); color: #ff9090;">危險 ${node.riskLabel || '中危'} ${riskBar}%</span>
                <span style="font-size: 10px; padding: 3px 7px; border-radius: 999px; background: rgba(34,197,94,0.14); border: 1px solid rgba(34,197,94,0.4); color: #8ef0a5;">報酬 ${node.rewardLabel || '穩妥'} ${rewardBar}%</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <div style="height: 7px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06);">
                    <div style="height: 100%; width: ${riskBar}%; background: linear-gradient(90deg, #f87171, #ef4444); border-radius: inherit;"></div>
                </div>
                <div style="height: 7px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06);">
                    <div style="height: 100%; width: ${rewardBar}%; background: linear-gradient(90deg, #34d399, #22c55e); border-radius: inherit;"></div>
                </div>
            </div>
        `;

        btn.onclick = () => {
            selectRouteNode(idx);
        };

        routeContainer.appendChild(btn);
    });

    const villagePanel = document.getElementById('village-panel-box');
    if (villagePanel) villagePanel.style.display = "none";
}


function applyRouteNodeSpecialEffects(node) {
    if (!node || !node.variant) return false;

    const thisFloor = dungeonFloor || 1;
    let triggerExtra = false;

    if (node.variant === "sanctum") {
        const healHp = Math.floor(currentRun.maxHp * 0.18);
        const healMp = Math.floor(currentRun.maxMp * 0.2);
        const hpBeforeHeal = currentRun.hp;
        const mpBeforeHeal = currentRun.mp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healHp);
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + healMp);
        const actualHpGain = Math.max(0, currentRun.hp - hpBeforeHeal);
        const actualMpGain = Math.max(0, currentRun.mp - mpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHpGain} HP` });
        spawnVfx("heal", { anchor: "player", text: `+${actualMpGain} MP`, variant: "mana", labelKind: "mana" });
        if (typeof addLog === "function") {
            addLog(`✨【淨化小堂】你撿起失落的護符，HP +${actualHpGain}、MP +${actualMpGain}，心神稍微安定。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "mist") {
        const bonusGold = 18 + thisFloor * 2;
        currentRun.gold += bonusGold;
        if (typeof addLog === "function") {
            addLog(`🌫️【迷霧小徑】你在不明霧中找到一小袋散落金屬與銀幣，獲得 +${bonusGold} G。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "cache") {
        const cacheGold = 30 + thisFloor * 3;
        currentRun.gold += cacheGold;
        if (typeof addLog === "function") {
            addLog(`💎【遺失寶庫】深處的箱櫃在你觸碰時發出嗡鳴，裡頭混著古老金屬與寶石，獲得 +${cacheGold} G。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "rift") {
        const roll = Math.random();
        if (roll < 0.45) {
            const loss = 12 + thisFloor * 2;
            currentRun.hp = Math.max(1, currentRun.hp - loss);
            if (typeof addLog === "function") {
                addLog(`🕳️【裂縫之門】你踩進扭曲邊緣，裂縫噴出詛咒之風，損失 <span class="num-popup num-boss-strike">-${loss} HP</span>。`, "take");
            }
        } else {
            const reward = 12 + thisFloor * 2;
            currentRun.gold += reward;
            if (typeof addLog === "function") {
                addLog(`🕳️【裂縫之門】你抓住一枚隨裂縫飄出的碎片，短暫得到異常靈感，獲得 +${reward} G。`, "perfect");
            }
        }
        triggerExtra = true;
    }

    if (node.variant === "bloodytrail") {
        const bonusPower = 3 + Math.floor(thisFloor / 10);
        currentRun.atk = (currentRun.atk || 0) + bonusPower;
        if (typeof addLog === "function") {
            addLog(`🩸【血跡小徑】你跟隨濃烈血跡，短時間內感到戰意被點燃，ATK +${bonusPower}。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "echo") {
        const revealGold = 10 + thisFloor * 2;
        currentRun.gold += revealGold;
        if (typeof addLog === "function") {
            addLog(`🔊【回音廊道】低語在你耳邊迴盪，像在提示某個被埋藏的路線，獲得 +${revealGold} G。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "altar") {
        const omenRoll = Math.random();
        if (omenRoll < 0.55) {
            currentRun.shield = (currentRun.shield || 0) + 18;
            if (typeof addLog === "function") {
                addLog(`🗿【祭壇遺跡】你在祭台前接過一枚護符，身上浮現一圈細緻護盾，Shield +18。`, "perfect");
            }
        } else {
            const curse = 10 + thisFloor * 2;
            currentRun.hp = Math.max(1, currentRun.hp - curse);
            if (typeof addLog === "function") {
                addLog(`🗿【祭壇遺跡】祭壇之力反噬，詛咒印記在你皮膚上蔓延，損失 <span class="num-popup num-boss-strike">-${curse} HP</span>。`, "take");
            }
        }
        triggerExtra = true;
    }

    if (node.variant === "shrine") {
        const shrineRoll = Math.random();
        if (shrineRoll < 0.6) {
            const extraReward = 40 + thisFloor * 4;
            currentRun.gold += extraReward;
            if (typeof addLog === "function") {
                addLog(`🕯️【黑暗神龕】神龕在你祈願時發出微光，祂似乎看見了你的意志，獲得 +${extraReward} G。`, "perfect");
            }
        } else {
            const damage = 20 + thisFloor * 3;
            currentRun.hp = Math.max(1, currentRun.hp - damage);
            if (typeof addLog === "function") {
                addLog(`🕯️【黑暗神龕】神龕的黑暗意志回應了你的祈求，卻以反噬作為代價，損失 <span class="num-popup num-boss-strike">-${damage} HP</span>。`, "take");
            }
        }
        triggerExtra = true;
    }

    return triggerExtra;
}

function buildRouteEncounterSummary(node) {
    if (!node) return "深淵中的未知路徑，沒有任何可確定的歷史痕跡。";

    const routeTypeText = {
        COMBAT: "這裡像是一處深淵狩獵場，敵人將迎面而來。",
        ELITE: "這裡必然有更強大的異種守衛，勝負可能瞬間翻轉。",
        EVENT: "這裡像是命運卡牌打開的地方，未知的選擇正等著你。",
        REST_SHOP: "這裡聽起來像是失落旅人的藏身處，適合恢復狀態與補給。",
        BOSS: "這裡是地底最深的試煉，所有過往都匯聚在這裡。"
    };

    return `${routeTypeText[node.type] || "這條路似乎暗藏了某種真正的試煉。"} ${node.clue || node.desc}`;
}

function resolveRouteNodeSpecial(selectedNode) {
    if (!selectedNode) return;

    const extra = applyRouteNodeSpecialEffects(selectedNode);
    if (extra && typeof updateUI === "function") {
        updateUI();
    }
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
        const summary = buildRouteEncounterSummary(selectedNode);
        addLog(`🧭【探險抉擇】你選擇前往 <strong>${selectedNode.title}</strong>；此路線危險度 ${selectedNode.riskLabel || '中危'}，預期報酬 ${selectedNode.rewardLabel || '穩妥'}。<br>${summary}`, "perfect");
    }

    resolveRouteNodeSpecial(selectedNode);

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

function triggerRandomAbyssEvent() {
    const roll = Math.random();

    // 45% 觸發 40 種命運抉擇奇遇
    if (roll < 0.45 && typeof getRandomAbyssEvent === "function") {
        const ev = getRandomAbyssEvent();
        if (ev) {
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

    // 10% 遠古泉水回復
    currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 30);
    if (typeof addLog === "function") addLog(`⛲【遠古泉水】遇見淨化泉水，HP 回復 +30。`, "perfect");
    resolveAbyssEvent();
}

function renderAbyssEventCard(eventObj) {
    const rewardBox = document.getElementById('reward-panel-box');
    const rewardContainer = document.getElementById('reward-choices-container');
    const rewardTitle = document.getElementById('reward-title-text');

    if (!rewardBox || !rewardContainer) return;

    rewardContainer.innerHTML = "";
    rewardBox.style.display = "block";
    rewardBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (rewardTitle) rewardTitle.innerText = `✨ ${eventObj.title} ✨`;

    const descDiv = document.createElement('div');
    descDiv.style.cssText = "width: 100%; font-size: 12px; color: #d1d1d6; margin-bottom: 12px; line-height: 1.5; text-align: left;";
    descDiv.innerText = eventObj.desc;
    rewardContainer.appendChild(descDiv);

    eventObj.choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = "btn-game btn-explore full-width margin-top-sm";
        btn.style.cssText = "text-align: left; padding: 10px; font-size: 11px; white-space: normal; width: 100%; cursor: pointer;";
        btn.innerText = choice.text;

        btn.onclick = () => {
            btn.disabled = true;
            let logMsg = choice.run(currentRun, accountMeta);
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
// 🛠️ 🎯 修復版：休憩營地節點 (修復無按鈕卡死 + 加入備援防護)
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
            const hpBeforeHeal = currentRun.hp;
            const mpBeforeHeal = currentRun.mp;
            currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + hpGain);
            currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + mpGain);
            const actualHpGain = Math.max(0, currentRun.hp - hpBeforeHeal);
            const actualMpGain = Math.max(0, currentRun.mp - mpBeforeHeal);
            spawnVfx("heal", { anchor: "player", text: `+${actualHpGain} HP` });
            spawnVfx("heal", { anchor: "player", text: `+${actualMpGain} MP`, variant: "mana", labelKind: "mana" });
            if (typeof addLog === "function") addLog(`⛺【靈魂滋養】沐浴在泉水中，回復 <span class="heal-effect">+${actualHpGain} HP</span> 與 <span class="heal-effect">+${actualMpGain} MP</span>！`, "perfect");
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
        // 🛡️ 備援機制：如果畫面沒有 reward-choices-container DOM 節點，直接進行回復並流轉，絕不卡死
        let hpGain = Math.floor(currentRun.maxHp * 0.5);
        let mpGain = Math.floor(currentRun.maxMp * 0.5);
        const hpBeforeHeal = currentRun.hp;
        const mpBeforeHeal = currentRun.mp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + hpGain);
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + mpGain);
        const actualHpGain = Math.max(0, currentRun.hp - hpBeforeHeal);
        const actualMpGain = Math.max(0, currentRun.mp - mpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHpGain} HP` });
        spawnVfx("heal", { anchor: "player", text: `+${actualMpGain} MP`, variant: "mana", labelKind: "mana" });
        if (typeof addLog === "function") addLog(`⛺【靈魂滋養 (自動備援)】沐浴在泉水中，回復 <span class="heal-effect">+${actualHpGain} HP</span> 與 <span class="heal-effect">+${actualMpGain} MP</span>！`, "perfect");
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
        if (combatIntroStartTimer !== null) {
            clearTimeout(combatIntroStartTimer);
            combatIntroStartTimer = null;
        }
        stopCombatTicker();
        clearVfxLayer();
        pendingCombatItem = null;

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
        let shouldSpawnBossEntryVfx = false;

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
                flee: bossMeta.flee || 0,
                hit: bossMeta.hit || Math.min(96, 82 + Math.floor((bossMeta.baseSpd || 20) * 0.25)),
                perfectDodge: bossMeta.perfectDodge || Math.min(15, Math.floor((bossMeta.flee || 0) * 0.1)),
                shield: bossMeta.baseShield || 0,
                poisonStacks: 0,
                burnStacks: 0,
                freezeTurns: 0, 
                stunTurns: 0,
                isSkipped: false, 
                isBoss: true, 
                attackType: bossMeta.attackType || "physical",
                fixedDrop: bossMeta.dropItem 
            };
            shouldSpawnBossEntryVfx = true;
            if (typeof addLog === "function") addLog(`🚨迫近🌋【領主降臨 B${dungeonFloor}F】發現大領主：<strong>${activeMonster.name}</strong>！`, "take");
        } else {
            const generatedMonster = typeof spawnMonsterForFloor === "function"
                ? spawnMonsterForFloor(dungeonFloor)
                : null;
            const fallbackMonster = generatedMonster || {
                name: "史萊姆", hp: 30 + dungeonFloor * 10, maxHp: 30 + dungeonFloor * 10, atk: 5 + dungeonFloor * 2,
                def: 1 + Math.floor(dungeonFloor * 0.5), mdef: 1 + Math.floor(dungeonFloor * 0.5),
                spd: 15, flee: 5, hit: 82, perfectDodge: 0, dropItem: "史萊姆黏液"
            };
            const eliteScale = isEliteNode ? 1.4 : 1;
            const scaledHp = Math.floor(fallbackMonster.maxHp * eliteScale);
            activeMonster = {
                ...fallbackMonster,
                name: isEliteNode ? `💀 精英・${fallbackMonster.name}` : fallbackMonster.name,
                hp: scaledHp,
                maxHp: scaledHp,
                atk: Math.floor(fallbackMonster.atk * eliteScale),
                def: Math.floor(fallbackMonster.def * eliteScale),
                mdef: Math.floor(fallbackMonster.mdef * eliteScale),
                spd: Math.min(80, Math.floor(fallbackMonster.spd * (isEliteNode ? 1.1 : 1))),
                shield: 0,
                poisonStacks: 0,
                burnStacks: 0,
                freezeTurns: 0, 
                stunTurns: 0,
                isSkipped: false, 
                isBoss: false,
                isElite: isEliteNode,
                fixedDrop: fallbackMonster.dropItem
            };
            
            let eliteText = isEliteNode ? ` 🔥【狂暴精英對決】` : ``;
            if (typeof addLog === "function") addLog(`⚔️【降臨 B${dungeonFloor}F】${eliteText}發現魔物：<strong>${activeMonster.name}</strong>`);
        }
        
        activeTactic = normalizeTacticMode((currentRun && currentRun.tactic) || activeTactic);
        if (currentRun) currentRun.tactic = activeTactic;
        combatPaused = false;
        playerAtb = 0; monsterAtb = 0; envAtb = 0; battleTimeElapsed = 0;
        syncTacticButtonsUi();
        syncCombatPauseUi();
        if (typeof updateUI === "function") updateUI();
        if (shouldSpawnBossEntryVfx) {
            scheduleVfx(() => {
                spawnVfx("boss-entry", { anchor: "monster", duration: 900, particleCount: prefersReducedMotion() ? 0 : 4 });
            });
        }
        const introDelay = typeof playBattleSceneEncounterIntro === "function" ? playBattleSceneEncounterIntro() : 0;
        if (introDelay > 0) {
            combatIntroStartTimer = setTimeout(() => {
                combatIntroStartTimer = null;
                if (gameState === "BATTLE" && activeMonster && currentRun && currentRun.hp > 0) startCombatTicker();
            }, introDelay);
        } else {
            startCombatTicker();
        }
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

function queueCombatItemUse(index) {
    if (gameState !== "BATTLE" || !activeMonster || activeMonster.hp <= 0 || !currentRun || !Array.isArray(currentRun.inventory)) return false;
    const itemName = currentRun.inventory[index];
    if (!itemName) return false;

    if (activeTactic === "SEMI") return queueSemiCombatCommand("item", index);
    if (manualTurnPaused) return submitManualBattleCommand("item", index);

    if (pendingCombatItem && pendingCombatItem.itemIndex === index && pendingCombatItem.itemName === itemName) {
        pendingCombatItem = null;
        if (typeof addLog === "function") addLog(`↩️【行動取消】已取消使用 ${itemName} 的預約。`, "env");
    } else {
        pendingCombatItem = { itemIndex: index, itemName: String(itemName) };
        if (typeof addLog === "function") addLog(`🧪【行動預約】${itemName} 已排入下一次我方 ATB 行動。`, "perfect");
    }
    if (typeof updateUI === "function") updateUI();
    return true;
}

function isUsableCombatItem(itemName) {
    const usableFragments = [
        "微光初級治癒藥水", "皇家大瓶強效魔藥", "秘銀奧術回魔劑", "聖使神聖活力合劑",
        "大快活厚牛巨堡", "烤野豬肉大串", "萬年永凍刨冰", "毒腺烈性催化劑",
        "炙烤熔岩壁虎乾", "魔導奧術瓊漿", "時空鹽焗醃肉", "逆轉禁忌血釀", "地龍魔爪厚炸薯",
        "厚牛巨堡", "烤野豬肉", "永凍刨冰", "強效魔藥", "初級治癒", "壁虎乾", "回魔劑", "瓊漿", "未知物體"
    ];
    const name = String(itemName || "");
    return usableFragments.some((fragment) => name.includes(fragment));
}

function createCombatCommand(type, value) {
    if (!currentRun || !activeMonster || activeMonster.hp <= 0) return null;
    if (type === "basic") return { type: "basic" };
    if (type === "skill") {
        const candidate = getCombatSkillCandidates().find((entry) => entry.skillMeta.id === value);
        return candidate ? { type: "skill", skillId: candidate.skillMeta.id, skillName: candidate.skillMeta.name } : null;
    }
    if (type === "item") {
        const itemIndex = Number(value);
        const itemName = currentRun.inventory?.[itemIndex];
        if (!Number.isInteger(itemIndex) || !isUsableCombatItem(itemName)) return null;
        return { type: "item", itemIndex, itemName: String(itemName) };
    }
    return null;
}

function queueSemiCombatCommand(type, value = null) {
    if (gameState !== "BATTLE" || activeTactic !== "SEMI") return false;
    const command = createCombatCommand(type, value);
    if (!command) {
        if (typeof addLog === "function") addLog("⚠️【預約失敗】此技能或道具目前無法使用。", "env");
        return false;
    }
    pendingCombatCommand = command;
    pendingCombatItem = null;
    const commandName = command.skillName || command.itemName || "普攻";
    if (typeof addLog === "function") addLog(`📌【半自動預約】${commandName} 已排入下次我方 ATB 行動。`, "perfect");
    if (typeof updateUI === "function") updateUI();
    return true;
}

function submitManualBattleCommand(type, value = null) {
    if (gameState !== "BATTLE" || !manualTurnPaused) return false;
    const command = createCombatCommand(type, value);
    if (!command) {
        if (typeof addLog === "function") addLog("⚠️【指令未執行】目前 MP、冷卻或背包狀態不允許使用。", "env");
        return false;
    }
    pendingCombatCommand = command;
    pendingCombatItem = null;
    manualTurnPaused = false;
    refreshCombatPauseState();
    executePlayerActionTick();
    if (typeof updateUI === "function") updateUI();
    return true;
}

function executePlayerActionTick() {
    if (!activeMonster || activeMonster.hp <= 0) return;

    tickCombatBuffs();

    if (activeMonster.poisonStacks > 0) {
        const poisonDamage = Math.floor(activeMonster.poisonStacks * 15 + activeMonster.maxHp * 0.02);
        const result = applyDamageWithShield(activeMonster, poisonDamage);
        if (typeof addLog === "function") addLog(`🧪【劇毒蔓延】<span class="strike-slash">[${activeMonster.name}]</span> 受到 ${activeMonster.poisonStacks} 層劇毒打擊 <span class="num-popup num-p-dmg">-${result.actualHpDmg} HP</span>`, "env");
    }
    if (activeMonster.hp > 0 && activeMonster.burnStacks > 0) {
        const burnDamage = Math.floor(activeMonster.burnStacks * 20);
        const result = applyDamageWithShield(activeMonster, burnDamage);
        activeMonster.burnStacks = Math.max(0, activeMonster.burnStacks - 1);
        if (typeof addLog === "function") addLog(`🔥【烈焰灼燒】<span class="strike-slash">[${activeMonster.name}]</span> 被火焰灼燒 <span class="num-popup num-p-dmg">-${result.actualHpDmg} HP</span>`, "env");
    }

    if (activeMonster.hp <= 0) {
        stopCombatTicker();
        executeDungeonVictorySequence();
        return;
    }

    let usedQueuedAction = false;
    if (pendingCombatCommand) {
        const queued = pendingCombatCommand;
        pendingCombatCommand = null;
        if (queued.type === "basic") {
            executeBasicAttack();
            usedQueuedAction = true;
        } else if (queued.type === "skill") {
            const candidate = getCombatSkillCandidates().find((entry) => entry.skillMeta.id === queued.skillId);
            if (candidate) usedQueuedAction = executeActiveSkill(candidate.skillMeta, candidate.skillLevel, candidate.effect);
        } else if (queued.type === "item") {
            let itemIndex = queued.itemIndex;
            if (currentRun.inventory?.[itemIndex] !== queued.itemName) {
                itemIndex = currentRun.inventory?.findIndex((item) => item === queued.itemName) ?? -1;
            }
            if (itemIndex >= 0 && isUsableCombatItem(currentRun.inventory?.[itemIndex])) {
                executeUseDungeonItem(currentRun.inventory[itemIndex], itemIndex);
                usedQueuedAction = true;
            }
        }
        if (!usedQueuedAction && typeof addLog === "function") addLog("⚠️【預約指令失效】改為自動選擇可用行動。", "env");
    }

    if (!usedQueuedAction && pendingCombatItem) {
        const queued = pendingCombatItem;
        pendingCombatItem = null;
        let itemIndex = queued.itemIndex;
        if (currentRun.inventory?.[itemIndex] !== queued.itemName) {
            itemIndex = currentRun.inventory?.findIndex((item) => item === queued.itemName) ?? -1;
        }
        if (itemIndex >= 0 && currentRun.inventory?.[itemIndex]) {
            executeUseDungeonItem(currentRun.inventory[itemIndex], itemIndex);
            usedQueuedAction = true;
        } else if (typeof addLog === "function") {
            addLog("⚠️【行動取消】預約的道具已不在背包中。", "env");
        }
    }
    if (!usedQueuedAction && activeMonster && activeMonster.hp > 0 && gameState === "BATTLE") executeAutoBattleAiTurn();
    if (activeMonster && activeMonster.hp <= 0) {
        stopCombatTicker();
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
    const monsterUsesMagic = activeMonster.attackType === "magic" || activeMonster.isMagic === true;
    let playerDef = monsterUsesMagic ? (currentRun.mdef || 0) : (currentRun.def || 0);
    
    let dmgRes = typeof calculateDamage === "function" ? calculateDamage(monsterAtk, playerDef, false, monsterUsesMagic) : { damage: monsterAtk, isMiss: false };
    
    if (dmgRes.isMiss) {
        spawnVfx("miss", { anchor: "player", text: "MISS" });
        if (typeof addLog === "function") addLog(`💨 勇者身形閃爍，成功 <span class="miss-effect">[MISS 閃過]</span> 了魔物的猛攻！<span class="num-popup num-miss">MISS</span>`, "miss");
        return;
    }

    let res = applyDamageWithShield(currentRun, dmgRes.damage);
    const jobTraits = currentRun.jobCombatTraits || {};
    if (currentRun.job === "swordsman" && activeMonster.hp > 0 && Math.random() < 0.15) {
        currentRun.shield = (Number(currentRun.shield) || 0) + 30;
        if (typeof addLog === "function") addLog("🛡️【鋼鐵意志】受擊後獲得 30 點護盾！", "perfect");
    }
    if (activeMonster.hp > 0 && Number(jobTraits.reflectChance) > 0 && Math.random() < Number(jobTraits.reflectChance)) {
        const reflected = Math.max(1, Math.floor(dmgRes.damage * (Number(jobTraits.reflectDamageRate) || 0)));
        const reflectResult = applyDamageWithShield(activeMonster, reflected);
        if (typeof addLog === "function") addLog(`🔁【聖殿壁壘】反彈 ${reflectResult.actualHpDmg} 點傷害！`, "skill-hit");
    }
    const thornsDamage = getActiveCombatBuff("thornsFire");
    if (activeMonster.hp > 0 && thornsDamage > 0) {
        const thornsResult = applyDamageWithShield(activeMonster, thornsDamage);
        if (activeMonster.hp > 0) activeMonster.burnStacks = (Number(activeMonster.burnStacks) || 0) + 1;
        if (typeof addLog === "function") addLog(`🔥【火牆反噬】魔物受到 ${thornsResult.actualHpDmg} 點火焰傷害！`, "skill-hit");
    }
    if (res.absorbed > 0) spawnVfx("shield", { anchor: "player", text: `-${res.absorbed}` });
    if (res.actualHpDmg > 0) spawnVfx("hit", { anchor: "player", text: `-${res.actualHpDmg}`, variant: "damage" });
    let shieldMsg = res.absorbed > 0 ? `🛡️ 護盾吸收了 ${res.absorbed} 點傷害！` : "";

    if (typeof addLog === "function") {
        addLog(`🔴 魔物暴虐反噬！${shieldMsg}<span class="strike-monster">[${accountMeta.name || "勇者"}]</span> <span class="num-popup num-boss-strike">-${res.actualHpDmg} HP</span>`, "take"); 
    }
    
    if (currentRun.hp <= 0) { 
        stopCombatTicker();
        executeDungeonDefeatSequence(); 
    } else if (activeMonster && activeMonster.hp <= 0) {
        stopCombatTicker();
        executeDungeonVictorySequence();
    }
}

// --------------------------------------------------------------------------
// 👑 勝利與戰敗序列
// --------------------------------------------------------------------------
function executeDungeonVictorySequence() {
    pendingCombatItem = null;
    let isBossFloor = (dungeonFloor % 10 === 0);
    let isElite = activeMonster?.isElite || false;
    const defeatedWasBoss = !!activeMonster?.isBoss;
    const monsterCard = typeof document !== "undefined" ? document.getElementById("monster-status-card") : null;
    const defeatVfxPosition = { x: 50, y: 46 };
    if (monsterCard && typeof window !== "undefined" && typeof monsterCard.getBoundingClientRect === "function") {
        const rect = monsterCard.getBoundingClientRect();
        const width = Math.max(1, window.innerWidth || 1);
        const height = Math.max(1, window.innerHeight || 1);
        defeatVfxPosition.x = clampVfxPercent((rect.left + rect.width * 0.5) / width * 100, 50);
        defeatVfxPosition.y = clampVfxPercent((rect.top + rect.height * 0.45) / height * 100, 46);
    }

    let multiplier = isBossFloor ? 3.0 : (isElite ? 1.8 : 1.0);
    const lootMultiplier = Number(currentRun.jobCombatTraits?.lootMultiplier) || 1;
    let rewardG = Math.floor((15 + Math.floor(dungeonFloor * 1.5)) * multiplier * lootMultiplier);
    let rewardExperience = Math.floor((12 + dungeonFloor * 2) * multiplier);

    currentRun.gold += rewardG; 
    let victoryTag = isElite ? `💀 精英討伐成功！` : (isBossFloor ? `👑 領主討伐成功！` : `⚔️ 戰鬥勝利！`);
    if (typeof addLog === "function") addLog(`${victoryTag} <span class="gold-victory-text">VICTORY!</span> 獲得金幣 +${rewardG} G，經驗值 +${rewardExperience}。`, "victory-badge");
    
    const defeatedMonsterName = activeMonster?.name ? activeMonster.name.replace("💀 精英・", "") : null;
    let dropItemName = activeMonster?.fixedDrop || (typeof MONSTER_DROPS !== "undefined" && defeatedMonsterName ? MONSTER_DROPS[defeatedMonsterName] : null);
    if (dropItemName) {
        for (let drop = 0; drop < lootMultiplier; drop++) {
            let msg = safePushToInventory(currentRun, accountMeta, dropItemName);
            if (typeof addLog === "function") addLog(msg, "perfect");
        }
    }

    if (isElite && Math.random() < 0.5) {
        let extraDrop = "史萊姆黏液";
        let msgExtra = safePushToInventory(currentRun, accountMeta, extraDrop);
        if (typeof addLog === "function") addLog(`🌟【精英額外戰利品】${msgExtra}`, "perfect");
    }

    const defeatedBossName = activeMonster?.name || "深淵領主";
    if (defeatedWasBoss) {
        spawnVfx("boss-defeat", { ...defeatVfxPosition, duration: 1200, particleCount: prefersReducedMotion() ? 0 : 5 });
    } else {
        spawnVfx("hit", { ...defeatVfxPosition, variant: "defeat", duration: 520, particleCount: prefersReducedMotion() ? 0 : 3 });
    }
    activeMonster = null;
    gameState = "ENCOUNTER_RESOLVED";

    const isCampaignFinale = defeatedWasBoss && dungeonFloor === 60;
    if (isBossFloor) {
        if (!isCampaignFinale) triggerBossVictoryModal(defeatedBossName);
        triggerBossTalentReward(dungeonFloor);
    } else {
        const rewardBox = document.getElementById('reward-panel-box');
        const rewardContainer = document.getElementById('reward-choices-container');
        const rewardTitle = document.getElementById('reward-title-text');
        if (rewardContainer) rewardContainer.innerHTML = "";
        if (rewardTitle) rewardTitle.innerText = "";
        if (rewardBox) rewardBox.style.display = "none";
    }

    addExperience(rewardExperience);
    if (isCampaignFinale) {
        gameState = "ENDING";
        accountMeta.campaignCleared = true;
        showCampaignEndingModal();
        if (typeof saveGameData === "function") saveGameData();
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

    if (typeof updateUI === "function") updateUI();
}

function triggerBossVictoryModal(bossName) {
    const overlay = document.getElementById('boss-victory-overlay');
    const nameEl = document.getElementById('victory-boss-name');
    if (!overlay) return;
    if (nameEl) nameEl.innerText = bossName || "LEGENDARY BOSS DEFEATED";

    if (bossVictoryUnlockTimer) clearTimeout(bossVictoryUnlockTimer);
    if (bossVictoryAutoCloseTimer) clearTimeout(bossVictoryAutoCloseTimer);
    if (bossVictoryCloseHandler) {
        overlay.removeEventListener('click', bossVictoryCloseHandler);
    }
    overlay.style.display = 'flex';

    bossVictoryCloseHandler = () => {
        overlay.style.display = 'none';
        overlay.removeEventListener('click', bossVictoryCloseHandler);
        bossVictoryUnlockTimer = null;
        bossVictoryAutoCloseTimer = null;
        bossVictoryCloseHandler = null;
    };

    bossVictoryUnlockTimer = setTimeout(() => {
        overlay.addEventListener('click', bossVictoryCloseHandler);
    }, 800);

    bossVictoryAutoCloseTimer = setTimeout(bossVictoryCloseHandler, 5000);
}

function triggerBossTalentReward(floor = dungeonFloor) {
    if (!Array.isArray(accountMeta.claimedBossFloors)) accountMeta.claimedBossFloors = [];
    if (accountMeta.claimedBossFloors.includes(floor)) {
        if (typeof addLog === "function") addLog(`✨ B${floor}F 的永久天賦已領取過；本次重巡不會重複發放。`, "perfect");
        return false;
    }

    if (typeof addLog === "function") addLog(`👑🌟【Boss 史詩突破】你征服了 B${dungeonFloor}F 領主，獲得一次隨機的永久血脈天賦覺醒！`, "perfect");
    const talents = ["👑 不滅巨魔血脈 (MaxHP +100)", "⚡ 狂暴神經反射 (SPD +5)", "🩸 殘虐撕裂本能 (CRIT +5%)"];
    const chosen = talents[Math.floor(Math.random() * talents.length)];
    accountMeta.claimedBossFloors.push(floor);

    if (!accountMeta.bossTalentBonuses) {
        accountMeta.bossTalentBonuses = { maxHp: 0, spd: 0, critChance: 0 };
    }

    if (chosen.includes("MaxHP")) {
        accountMeta.bossTalentBonuses.maxHp += 100;
    } else if (chosen.includes("SPD")) {
        accountMeta.bossTalentBonuses.spd += 5;
    } else if (chosen.includes("CRIT")) {
        accountMeta.bossTalentBonuses.critChance += 5;
    }

    if (typeof resetCurrentRunData === "function") resetCurrentRunData();
    if (typeof addLog === "function") addLog(`✨ 天賦自動覺醒：<strong>${chosen}</strong>！`, "perfect");
    return true;
}

function showCampaignEndingModal() {
    const overlay = document.getElementById("game-ending-overlay");
    if (!overlay) return;
    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
}

function closeCampaignEndingModal() {
    const overlay = document.getElementById("game-ending-overlay");
    if (overlay) {
        overlay.style.display = "none";
        overlay.setAttribute("aria-hidden", "true");
    }
    handleSecondaryAction();
}

function executeDungeonDefeatSequence() {
    pendingCombatItem = null;
    clearVfxLayer();
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
    const previousLevel = Number(accountMeta.lv) || 1;
    while (accountMeta.exp >= accountMeta.nextExp) {
        accountMeta.exp -= accountMeta.nextExp;
        accountMeta.lv = (accountMeta.lv || 1) + 1;
        currentRun.lv = accountMeta.lv;
        accountMeta.statPoints = (accountMeta.statPoints || 0) + 3;

        accountMeta.nextExp = Math.floor(accountMeta.nextExp * 1.4);
        currentRun.nextExp = accountMeta.nextExp;
        currentRun.exp = accountMeta.exp;

        if (typeof addLog === "function") addLog(`👑 突破至 <strong>Lv.${accountMeta.lv}</strong>！獲得 3 點能力點數！`, "perfect");
    }

    if (accountMeta.lv > previousLevel && typeof resetCurrentRunData === "function") resetCurrentRunData();

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
            clearVfxLayer();
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
        clearVfxLayer();
        stopCombatTicker();
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
    clearVfxLayer();
    stopCombatTicker();
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
// 🛠️ 物品使用、鍛造與精鍊
// --------------------------------------------------------------------------
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
    
    if (itemName.includes("微光初級治癒藥水")) {
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 50);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🧪 初級治癒藥水回復 <span class="heal-effect">+${actualHeal} HP</span>！`, "perfect");
    }
    else if (itemName.includes("皇家大瓶強效魔藥")) {
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 150);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🧪 皇家強效魔藥回復 <span class="heal-effect">+${actualHeal} HP</span>！`, "perfect");
    }
    else if (itemName.includes("聖使神聖活力合劑")) {
        const hpBeforeHeal = currentRun.hp;
        const mpBeforeHeal = currentRun.mp;
        currentRun.hp = currentRun.maxHp;
        currentRun.mp = currentRun.maxMp;
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        const actualMpGain = Math.max(0, currentRun.mp - mpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`✨ 神聖活力合劑補滿生命與魔力 <span class="heal-effect">+${actualHeal} HP</span>、<span class="heal-effect">+${actualMpGain} MP</span>！`, "perfect");
    }
    else if (itemName.includes("秘銀奧術回魔劑")) {
        const mpBeforeHeal = currentRun.mp;
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + 40);
        const actualMpGain = Math.max(0, currentRun.mp - mpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualMpGain} MP`, variant: "mana", labelKind: "mana" });
        if (typeof addLog === "function") addLog(`🔵 奧術回魔劑回復 <span class="heal-effect">+${actualMpGain} MP</span>！`, "perfect");
    }
    else if (itemName.includes("大快活厚牛巨堡")) {
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 100);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        currentRun.shield = (Number(currentRun.shield) || 0) + 80;
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🌭 厚牛巨堡回復 <span class="heal-effect">+${actualHeal} HP</span>，並獲得 80 點護盾！`, "perfect");
    }
    else if (itemName.includes("烤野豬肉大串")) {
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 60);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        currentRun.shield = (Number(currentRun.shield) || 0) + 20;
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🥩 烤野豬肉回復 <span class="heal-effect">+${actualHeal} HP</span>，並獲得 20 點護盾！`, "perfect");
    }
    else if (itemName.includes("地龍魔爪厚炸薯")) {
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + 250);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        currentRun.burnStacks = 0;
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🍟 厚炸薯回復 <span class="heal-effect">+${actualHeal} HP</span>，並解除灼燒！`, "perfect");
    }
    else if (itemName.includes("時空鹽焗醃肉")) {
        playerAtb = Math.min(100, playerAtb + 50);
        if (typeof addLog === "function") addLog("🥩 時空醃肉推進我方 ATB 行動條 50%！", "perfect");
    }
    else if (itemName.includes("毒腺烈性催化劑")) {
        const result = applyDamageWithShield(activeMonster, 150);
        spawnVfx("hit", { anchor: "monster", text: `-${result.actualHpDmg}`, variant: "damage" });
        if (typeof addLog === "function") addLog(`🧪 毒腺催化劑造成 <span class="num-popup num-p-dmg">-${result.actualHpDmg} HP</span> 傷害！`, "skill-hit");
    }
    else if (itemName.includes("厚牛巨堡") || itemName.includes("料理") || itemName.includes("牛扒") || itemName.includes("炸薯")) {
        let healVal = Math.floor(currentRun.maxHp * 0.5);
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healVal);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🌭 熱量充能！血量大幅度回復 <span class="heal-effect">+${actualHeal} HP</span>！`, "perfect");
    }
    else if (itemName.includes("烤野豬肉") || itemName.includes("初級治癒")) {
        let healVal = 60;
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healVal);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🥩 生命回復 <span class="heal-effect">+${actualHeal} HP</span>！`, "perfect");
    }
    else if (itemName.includes("強效魔藥") || itemName.includes("壁虎乾")) {
        let healVal = 180;
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healVal);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🧪 強效滋補！生命回復 <span class="heal-effect">+${actualHeal} HP</span>！`, "perfect");
    }
    else if (itemName.includes("回魔劑") || itemName.includes("瓊漿")) {
        let mpVal = 80;
        const mpBeforeHeal = currentRun.mp;
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + mpVal);
        const actualMpGain = Math.max(0, currentRun.mp - mpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualMpGain} MP`, variant: "mana", labelKind: "mana" });
        if (typeof addLog === "function") addLog(`🍷 魔力泉湧！回復 <span class="heal-effect">+${actualMpGain} MP</span>！`, "perfect");
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
        stopCombatTicker();
        executeDungeonVictorySequence();
        return;
    }
    else if (itemName.includes("未知物體")) {
        let dmg = currentEnvironment === "POISON" ? 30 : 15;
        currentRun.hp = Math.max(1, currentRun.hp - dmg);
        spawnVfx("hit", { anchor: "player", text: `-${dmg}`, variant: "damage" });
        if (typeof addLog === "function") addLog(`🪨 焦黑物體反噬扣血！扣減 ${dmg} HP！`, "take");
    }
    else {
        let genericHeal = 40;
        const hpBeforeHeal = currentRun.hp;
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + genericHeal);
        const actualHeal = Math.max(0, currentRun.hp - hpBeforeHeal);
        spawnVfx("heal", { anchor: "player", text: `+${actualHeal} HP` });
        if (typeof addLog === "function") addLog(`🍙 食用物資，回復 <span class="heal-effect">+${actualHeal} HP</span>。`, "perfect");
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
    if (currentVillageLocation === "WORKSHOP" && typeof renderVillageWorkshop === "function") {
        renderVillageWorkshop();
    }
}

function executeDismantle(equipName) {
    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    let b = typeof getItemBlueprintByName === "function" ? getItemBlueprintByName(equipName) : CRAFTING_BLUEPRINTS.find(x => x.name === equipName);
    if (!b) return;

    const equippedSlot = Object.keys(accountMeta.equipment || {}).find(slot => accountMeta.equipment[slot] === equipName);
    if (equippedSlot) {
        if (typeof addLog === "function") addLog(`⚠️【拆解失敗】請先卸下已裝備的 <strong>[${equipName}]</strong> 再進行拆解。`, "warn");
        return;
    }

    if (!accountMeta.warehouse || !accountMeta.warehouse[equipName]) return;
    accountMeta.warehouse[equipName]--;
    if (accountMeta.warehouse[equipName] <= 0) delete accountMeta.warehouse[equipName];

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
        if (accountMeta.warehouse[equipName]) {
            accountMeta.warehouse[equipName]--;
            if (accountMeta.warehouse[equipName] <= 0) delete accountMeta.warehouse[equipName];
        }
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
    window.handleStartGame = handleStartGame;
    window.renderInitialJobModal = renderInitialJobModal;
    window.selectInitialJob = selectInitialJob;
    window.enterGameMainShell = enterGameMainShell;
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
}
