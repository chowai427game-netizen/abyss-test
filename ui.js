// ==========================================================================
// 📺 ui.js：分頁渲染、配點 UI（六大屬性）與 QTE 面板同步核心
// ==========================================================================

const DOM = {
    isInitialized: false,
    elements: {},
    init() {
        if (this.isInitialized) return;
        const keys = [
            'p-name', 'p-job', 'p-lv', 'p-exp-text', 'p-hp', 'p-maxhp', 'p-mp', 'p-maxmp',
            'hp-bar-fill', 'mp-bar-fill', 'p-atb-row', 'p-atb-text', 'p-atb-bar-fill',
            'p-gold', 'p-atk', 'p-block', 'p-crit', 'p-spd', 'p-dodge', 'p-vamp',
            'p-skills-list', 'p-stat-points', 'p-equip-weapon', 'p-equip-armor', 'p-equip-accessory',
            'btn-main-action', 'btn-rerun-action', 'btn-secondary-action', 'btn-auto-battle',
            'env-alert-bar', 'monster-status-card', 'm-name', 'm-hp-text', 'm-hp-bar',
            'm-atb-row', 'm-atb-text', 'm-atb-bar-fill', 'm-atk', 'm-spd',
            'reward-panel-box', 'log-box', 'title-box', 'status-panel-box', 'action-panel-box',
            'village-panel-box', 'log-wrapper-box', 'tactics-drawer-box', 'char-folder-summary',
            'stat-alloc-grid', 'bag-capacity-text', 'bag-slots-container', 'location-text',
            'guild-skills-container', 'kitchen-warehouse-display', 'recipes-container',
            'workshop-warehouse-display', 'blueprints-container'
        ];
        keys.forEach(key => {
            this.elements[key] = document.getElementById(key);
        });
        this.isInitialized = true;
    },
    get(key) {
        if (!this.isInitialized) this.init();
        return this.elements[key] || document.getElementById(key);
    }
};

let activeCookingRange = "1-10";
let activeCraftingCategory = "all";
let activeCraftingLvlRange = "1-10";

// ==========================================
// 1. 六大屬性點數分配邏輯 (STR, AGI, VIT, INT, DEX, LUK)
// ==========================================
function allocateStatPoint(statKey) {
    if (!accountMeta.statPoints || accountMeta.statPoints <= 0) {
        alert("尚無可分配的能力點數！");
        return;
    }
    
    if (!accountMeta.stats) {
        accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    }
    
    accountMeta.statPoints--;
    accountMeta.stats[statKey] = (accountMeta.stats[statKey] || 0) + 1;
    
    resetCurrentRunData();
    saveGameData();
    
    addLog(`⚡ 屬性強化：<strong>${statKey}</strong> 提升至 ${accountMeta.stats[statKey]}！`, "perfect");
    updateUI();
}

// ==========================================
// 2. 角色資料與裝備介面同步
// ==========================================
function syncCharacterDataUi() {
    if (!accountMeta || !currentRun) return;

    // 基本資訊
    const nameEl = DOM.get('p-name');
    const jobEl = DOM.get('p-job');
    const lvEl = DOM.get('p-lv');
    const expTextEl = DOM.get('p-exp-text');
    
    if (nameEl) nameEl.innerText = accountMeta.name || "無名勇者";
    if (jobEl) jobEl.innerText = getJobChineseName(currentRun.job);
    if (lvEl) lvEl.innerText = accountMeta.lv || currentRun.lv || 1;
    if (expTextEl) expTextEl.innerText = `${accountMeta.exp || 0} / ${accountMeta.nextExp || currentRun.nextExp || 30}`;

    // 可用點數與摺疊面板標題
    const pts = accountMeta.statPoints || 0;
    const ptsEl = DOM.get('p-stat-points');
    if (ptsEl) ptsEl.innerText = pts;

    const folderSummary = DOM.get('char-folder-summary');
    if (folderSummary) {
        folderSummary.innerHTML = pts > 0 
            ? `🔍 展開角色面板 <span style="color: #00ffcc; font-weight: bold;">[✨ ${pts} 點數待分配]</span>`
            : `🔍 展開查看 戰偶裝備、配點與詳細數值`;
    }

    // 六大屬性配點矩陣
    const gridEl = DOM.get('stat-alloc-grid');
    if (gridEl) {
        gridEl.innerHTML = "";
        const statConfig = [
            { key: "STR", name: "⚔️ 力量", desc: "近戰ATK / 負重上限" },
            { key: "AGI", name: "⚡ 敏捷", desc: "攻速ASPD / 迴避FLEE" },
            { key: "VIT", name: "🛡️ 體質", desc: "HP上限 / 物理DEF" },
            { key: "INT", name: "🔮 智力", desc: "魔攻MATK / 魔防MDEF" },
            { key: "DEX", name: "🎯 靈巧", desc: "命中HIT / 縮短詠唱" },
            { key: "LUK", name: "🎰 幸運", desc: "暴擊CRIT / 完全迴避" }
        ];

        const hasPoints = pts > 0;
        const currentStats = accountMeta.stats || { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };

        statConfig.forEach(s => {
            const val = currentStats[s.key] || 0;
            const cell = document.createElement('div');
            cell.style.cssText = `
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 4px; padding: 4px 6px;
                display: flex; justify-content: space-between; align-items: center;
            `;

            cell.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 11px; color: #ddd;">${s.name} <b style="color: #00ffcc;">${val}</b></span>
                    <span style="font-size: 9px; color: #777;">${s.desc}</span>
                </div>
                <button class="btn-game" 
                    style="padding: 2px 6px; font-size: 11px; min-width: 22px; height: 22px; line-height: 1;"
                    ${hasPoints ? "" : "disabled"} 
                    onclick="allocateStatPoint('${s.key}')">+</button>
            `;
            gridEl.appendChild(cell);
        });
    }

    // 生命與能量條
    const hpEl = DOM.get('p-hp');
    const maxHpEl = DOM.get('p-maxhp');
    const mpEl = DOM.get('p-mp');
    const maxMpEl = DOM.get('p-maxmp');
    
    if (hpEl) hpEl.innerText = currentRun.hp;
    if (maxHpEl) maxHpEl.innerText = currentRun.maxHp;
    if (mpEl) mpEl.innerText = currentRun.mp;
    if (maxMpEl) maxMpEl.innerText = currentRun.maxMp;

    const hpBar = DOM.get('hp-bar-fill');
    const mpBar = DOM.get('mp-bar-fill');
    if (hpBar) hpBar.style.width = `${Math.max(0, Math.min(100, (currentRun.hp / currentRun.maxHp) * 100))}%`;
    if (mpBar) mpBar.style.width = `${Math.max(0, Math.min(100, (currentRun.mp / currentRun.maxMp) * 100))}%`;

    // 玩家 ATB 蓄力軌道
    const pAtbRow = DOM.get('p-atb-row');
    if (pAtbRow) {
        if (gameState === "VILLAGE") {
            pAtbRow.style.display = "none";
        } else {
            pAtbRow.style.display = "block";
            const pAtbPercent = Math.min(100, Math.max(0, typeof playerAtb !== "undefined" ? playerAtb : 0));
            const pAtbBar = DOM.get('p-atb-bar-fill');
            
            if (pAtbBar) {
                const currentW = parseFloat(pAtbBar.style.width) || 0;
                if (pAtbPercent < currentW) {
                    pAtbBar.style.transition = "none";
                    pAtbBar.style.width = "0%";
                    pAtbBar.offsetHeight; // 強制重繪
                }
                pAtbBar.style.transition = "width 0.25s linear";
                pAtbBar.style.width = `${pAtbPercent}%`;
            }
        }
    }

    // 詳細面板數值更新
    const setTxt = (key, txt) => { const e = DOM.get(key); if (e) e.innerText = txt; };
    setTxt('p-gold', currentRun.gold || 0);
    setTxt('p-atk', `${currentRun.atk} (魔 ${currentRun.matk})`);
    setTxt('p-block', `${currentRun.def} (魔防 ${currentRun.mdef})`);
    setTxt('p-spd', currentRun.spd);
    setTxt('p-crit', `${currentRun.critChance}%`);
    setTxt('p-dodge', `${Math.floor(currentRun.flee)} (完迴 ${currentRun.perfectDodge}%)`);
    setTxt('p-vamp', `${Math.floor(currentRun.hit)} HIT`);

    const skList = Object.keys(currentRun.skills || {}).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ");
    const skillListEl = DOM.get('p-skills-list');
    if (skillListEl) skillListEl.innerText = skList || "基本打擊";

    // 裝備與星級
    const wStar = (accountMeta.equipmentStars?.weapon || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.weapon}]` : "";
    const aStar = (accountMeta.equipmentStars?.armor || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.armor}]` : "";
    const cStar = (accountMeta.equipmentStars?.accessory || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.accessory}]` : "";

    setTxt('p-equip-weapon', (accountMeta.equipment?.weapon || "空手") + wStar);
    setTxt('p-equip-armor', (accountMeta.equipment?.armor || "布衣") + aStar);
    setTxt('p-equip-accessory', (accountMeta.equipment?.accessory || "無") + cStar);

    // 行軍背包
    setTxt('bag-capacity-text', `🎒 ${currentRun.inventory?.length || 0} / ${MAX_BAG_SIZE}`);

    const bagContainer = DOM.get('bag-slots-container');
    if (bagContainer) {
        bagContainer.innerHTML = "";
        for (let i = 0; i < MAX_BAG_SIZE; i++) {
            const item = currentRun.inventory[i];
            const slot = document.createElement('div');
            slot.style.cssText = `
                height: 32px;
                border: 1px dashed ${item ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.15)"};
                background: ${item ? "rgba(255,215,0,0.08)" : "rgba(0,0,0,0.2)"};
                border-radius: 4px; display: flex; align-items: center; justify-content: center;
                font-size: 10px; cursor: ${item ? "pointer" : "default"}; position: relative;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px;
                color: ${item ? "#ffd700" : "#666"};
            `;

            if (item) {
                slot.innerText = item;
                slot.title = `戰鬥中點擊使用 / 村莊點擊退回倉庫 (${item})`;
                slot.onclick = () => {
                    if (gameState === "BATTLE") {
                        executeUseDungeonItem(item, i);
                    } else {
                        removeBagItem(i);
                    }
                };
            } else {
                slot.innerHTML = `<span style="color:#444;">空</span>`;
            }
            bagContainer.appendChild(slot);
        }
    }
}

function getJobChineseName(j) {
    const jobNames = {
        swordsman: "劍士",
        magician: "魔法師",
        acolyte: "服事",
        thief: "盜賊",
        archer: "弓箭手"
    };
    return jobNames[j] || "劍士";
}

// ==========================================
// 3. 村莊地點切換
// ==========================================
function switchVillageLocation(targetLoc) {
    currentVillageLocation = targetLoc;
    
    const panels = ['v-loc-gate', 'v-loc-guild', 'v-loc-kitchen', 'v-loc-workshop', 'v-loc-square'];
    panels.forEach(p => {
        const el = DOM.get(p);
        if (el) el.style.display = 'none';
    });
    
    const tabs = { 
        'GATE': 'btn-tab-gate', 
        'GUILD': 'btn-tab-guild',
        'KITCHEN': 'btn-tab-kitchen', 
        'SQUARE': 'btn-tab-square', 
        'WORKSHOP': 'btn-tab-workshop' 
    };
    
    Object.keys(tabs).forEach(k => {
        const tBtn = DOM.get(tabs[k]);
        if (tBtn) {
            tBtn.classList.toggle('active', k === targetLoc);
        }
    });
    
    const locTextEl = DOM.get('location-text');
    const locMap = {
        GATE: { el: 'v-loc-gate', text: "⛺ 地表村莊 ➔ 傳送大殿" },
        GUILD: { el: 'v-loc-guild', text: "🏛️ 地表村莊 ➔ 冒險者公會", render: renderVillageGuild },
        KITCHEN: { el: 'v-loc-kitchen', text: "🍳 地表村莊 ➔ 皇家料理屋", render: renderVillageCookingWorkshop },
        SQUARE: { el: 'v-loc-square', text: "💬 地表村莊 ➔ 中央廣場" },
        WORKSHOP: { el: 'v-loc-workshop', text: "🛠️ 地表村莊 ➔ 魔導加工所", render: renderVillageWorkshop }
    };

    if (locMap[targetLoc]) {
        const target = locMap[targetLoc];
        const el = DOM.get(target.el);
        if (el) el.style.display = 'block';
        if (locTextEl) locTextEl.innerHTML = target.text;
        if (target.render) target.render();
    }
    
    updateUI();
}

// ==========================================
// 4. 全局 UI 狀態同步與更新
// ==========================================
function updateUI() {
    const titleBox = DOM.get('title-box');
    const statusBox = DOM.get('status-panel-box');
    const actionBox = DOM.get('action-panel-box');
    const villageBox = DOM.get('village-panel-box');
    const rewardBox = DOM.get('reward-panel-box');
    const logBox = DOM.get('log-box');
    const envBar = DOM.get('env-alert-bar');
    const autoBtn = DOM.get('btn-auto-battle');
    const logWrapper = DOM.get('log-wrapper-box');

    if (gameState === "VILLAGE") {
        if (titleBox) titleBox.style.display = "none"; 
        if (statusBox) statusBox.style.display = "grid";
        if (actionBox) actionBox.style.display = "flex";
        if (villageBox) villageBox.style.display = "block";
        if (rewardBox) rewardBox.style.display = "none";
        
        if (logWrapper) logWrapper.style.display = "block"; 
        if (envBar) envBar.style.display = "none";
        if (autoBtn) autoBtn.style.display = "none";
        
        const drawer = DOM.get('tactics-drawer-box');
        if (drawer) drawer.classList.remove('expanded');
        
        const mainActionBtn = DOM.get('btn-main-action');
        if (mainActionBtn) {
            mainActionBtn.innerText = "🔮 啟動傳送門降臨深淵 B1F";
            mainActionBtn.disabled = false; 
        }
        const rerunBtn = DOM.get('btn-rerun-action');
        if (rerunBtn) rerunBtn.style.display = "none";
        
        syncCharacterDataUi();
        return; 
    }
    
    if (titleBox) titleBox.style.display = "none";
    if (statusBox) statusBox.style.display = "grid";
    if (actionBox) actionBox.style.display = "flex";
    if (villageBox) villageBox.style.display = "none";
    if (logBox) logBox.style.display = "block";
    if (logWrapper) logWrapper.style.display = "block"; 
    if (envBar) envBar.style.display = "block";
    if (autoBtn) autoBtn.style.display = "block"; 
    
    const actBtn = DOM.get('btn-main-action');
    if (actBtn) {
        actBtn.innerText = (dungeonFloor % 10 === 0) ? `👹 討伐大領主 B${dungeonFloor}F 核心` : `⚔️ 深入突進下一層 B${dungeonFloor+1}F`;
    }
    const rerunBtn = DOM.get('btn-rerun-action');
    if (rerunBtn) {
        rerunBtn.style.display = (dungeonFloor > 0 && (dungeonFloor + 1) % 10 === 0) ? "block" : "none";
    }

    if (envBar && typeof ENVIRONMENT_DATABASE !== "undefined" && ENVIRONMENT_DATABASE[currentEnvironment]) {
        envBar.className = ENVIRONMENT_DATABASE[currentEnvironment].className;
        envBar.innerHTML = `${ENVIRONMENT_DATABASE[currentEnvironment].logText} (B${dungeonFloor}F)`;
    }

    const monBox = DOM.get('monster-status-card');
    if (activeMonster && monBox) {
        monBox.style.display = "block";
        DOM.get('m-name').innerText = activeMonster.name;
        DOM.get('m-hp-text').innerText = `${activeMonster.hp} / ${activeMonster.maxHp}`;
        DOM.get('m-hp-bar').style.width = `${Math.max(0, (activeMonster.hp / activeMonster.maxHp) * 100)}%`;
        DOM.get('m-atk').innerText = activeMonster.atk;
        DOM.get('m-spd').innerText = activeMonster.spd;

        const mAtbRow = DOM.get('m-atb-row');
        if (mAtbRow) {
            mAtbRow.style.display = "block";
            const mAtbPercent = Math.min(100, Math.max(0, typeof monsterAtb !== "undefined" ? monsterAtb : 0));
            const mAtbBar = DOM.get('m-atb-bar-fill');
            
            if (mAtbBar) {
                const currentW = parseFloat(mAtbBar.style.width) || 0;
                if (mAtbPercent < currentW) {
                    mAtbBar.style.transition = "none";
                    mAtbBar.style.width = "0%";
                    mAtbBar.offsetHeight; 
                }
                mAtbBar.style.transition = "width 0.25s linear"; 
                mAtbBar.style.width = `${mAtbPercent}%`;
            }
        }
    } else if (monBox) {
        monBox.style.display = "none";
        const mAtbRow = DOM.get('m-atb-row');
        if (mAtbRow) mAtbRow.style.display = "none";
    }

    if (rewardBox) {
        rewardBox.style.display = (gameState === "REWARD" || gameState === "ENCOUNTER") ? "block" : "none";
    }
    
    syncCharacterDataUi();
}

// ==========================================
// 5. 公會技能頁面渲染
// ==========================================
function renderVillageGuild() {
    const container = DOM.get('guild-skills-container');
    if (!container || typeof SKILLS_DATABASE === "undefined") return;
    container.innerHTML = "";

    const jobSkills = SKILLS_DATABASE[currentRun.job] || [];

    jobSkills.forEach(s => {
        const card = document.createElement('div');
        card.style.cssText = "background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; width: 100%;";

        const isLearned = currentRun.skills && currentRun.skills[s.name];
        const hasLevel = (accountMeta.lv || currentRun.lv || 1) >= s.reqLv;
        const hasGold = currentRun.gold >= s.goldCost;
        
        const reqMatText = Object.keys(s.reqMat || {}).map(k => `${k} x${s.reqMat[k]}`).join(", ");
        let hasMats = true;
        for (let mat in s.reqMat) {
            if ((accountMeta.warehouse[mat] || 0) < s.reqMat[mat]) hasMats = false;
        }

        let statusBadge = "";
        let btnDisabled = false;

        if (isLearned) {
            statusBadge = `<span style="color: #2ecc71; font-weight: bold; font-size: 11px;">[已精通]</span>`;
            btnDisabled = true;
        } else if (!hasLevel) {
            statusBadge = `<span style="color: #e74c3c; font-size: 11px;">[需 Lv.${s.reqLv}]</span>`;
            btnDisabled = true;
        } else if (!hasGold || !hasMats) {
            statusBadge = `<span style="color: #e67e22; font-size: 11px;">[資源不足]</span>`;
            btnDisabled = true;
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: #ffd700; font-size: 13px;">${s.name} ${statusBadge}</strong>
                <span style="font-size: 11px; color: #00ffcc;">消耗: 🪙 ${s.goldCost} G</span>
            </div>
            <p style="font-size: 11px; color: #aaa; margin: 4px 0;">${s.desc}</p>
            ${reqMatText ? `<div style="font-size: 10px; color: #8e8e93;">📦 所需素材：${reqMatText}</div>` : ""}
            <div style="margin-top: 6px;"></div>
        `;

        const btnLearn = document.createElement('button');
        btnLearn.className = "btn-game btn-explore";
        btnLearn.style.cssText = "padding: 4px 10px; font-size: 11px;";
        btnLearn.innerText = isLearned ? "✅ 已習得" : "🎓 學習傳承技能";
        btnLearn.disabled = btnDisabled;
        btnLearn.onclick = () => { executeLearnSkill(s); };

        card.appendChild(btnLearn);
        container.appendChild(card);
    });
}

// ==========================================
// 6. 料理屋頁面渲染
// ==========================================
function renderVillageCookingWorkshop() {
    const wBox = DOM.get('kitchen-warehouse-display');
    if (wBox) {
        const wItems = Object.keys(accountMeta.warehouse || {}).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
        wBox.innerHTML = `📦 <strong>當前倉庫現存食材：</strong><br>${wItems || "暫無任何行軍素材"}`;
    }
    
    const rContainer = DOM.get('recipes-container');
    if (!rContainer) return;
    rContainer.innerHTML = "";

    if (typeof RECIPES_DATABASE === "undefined") return;
    const filteredRecipes = RECIPES_DATABASE.filter(r => r.range === activeCookingRange);

    if (filteredRecipes.length === 0) {
        rContainer.innerHTML = `<div style="color:#555; font-size:12px; padding:15px; width:100%; text-align:center;">🌿 該層數配方尚在通訊重構成形中...</div>`;
        return;
    }

    filteredRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.style.cssText = "background: rgba(0,0,0,0.25); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 8px; width: 100%; text-align: left;";

        const ingList = Object.keys(recipe.ingredients).map(k => `${k} x${recipe.ingredients[k]}`).join(", ");
        let hasIngredients = true;
        for (let ing in recipe.ingredients) {
            if ((accountMeta.warehouse[ing] || 0) < recipe.ingredients[ing]) hasIngredients = false;
        }

        card.innerHTML = `
            <strong style="color:#2ecc71; font-size:13px;">${recipe.name}</strong>
            <p style="margin:4px 0; font-size:12px; color:#aaa;">${recipe.desc}</p>
            <span style="font-size:11px; color:#8e8e93;">🌾 所需配料：${ingList}</span>
            <div style="margin-top:8px;"></div>
        `;

        const btnCook = document.createElement('button');
        btnCook.className = "btn-game btn-cook";
        btnCook.style.cssText = "padding: 4px 10px; font-size: 11px;";
        btnCook.innerHTML = recipe.type === "village_eat" ? "🍴 當場進食獲得長效 Buff" : "🍳 烹飪納入快捷欄";
        btnCook.disabled = !hasIngredients;
        btnCook.onclick = () => { executeVillageCooking(recipe); };
        
        card.appendChild(btnCook);
        rContainer.appendChild(card);
    });
}

// ==========================================
// 7. 精煉升星與加工所頁面渲染
// ==========================================
function renderStarUpRow(slot, displayName, currentStar) {
    const starsStr = "⭐".repeat(currentStar) + "☆".repeat(5 - currentStar);
    let upgradeBtn = "";
    
    if (currentStar >= 5) {
        upgradeBtn = `<span style="color: #ffd700; font-size: 11px; font-weight: bold;">[已臻滿星]</span>`;
    } else {
        const cost = getStarUpCost(slot, currentStar);
        const costText = Object.keys(cost).map(k => `${k} x${cost[k]}`).join(", ");
        
        let canUpgrade = true;
        for (let ing in cost) {
            if ((accountMeta.warehouse[ing] || 0) < cost[ing]) canUpgrade = false;
        }
        
        upgradeBtn = `
            <button class="btn-game btn-rerun" style="padding: 4px 8px; font-size: 11px;" ${canUpgrade ? "" : "disabled"} onclick="executeSlotStarUp('${slot}')">
                🔥 升星 (需 ${costText})
            </button>
        `;
    }
    
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 6px 10px; border-radius: 8px;">
            <span style="font-size: 12px; font-weight: bold; color: #fff;">${displayName} [${starsStr}]</span>
            ${upgradeBtn}
        </div>
    `;
}

function renderVillageWorkshop() {
    const wBox = DOM.get('workshop-warehouse-display');
    if (wBox) {
        const wItems = Object.keys(accountMeta.warehouse || {}).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
        wBox.innerHTML = `📦 <strong>雲端永久素材與裝備庫存：</strong><br>${wItems || "倉庫空空如也"}`;
    }
    
    const bContainer = DOM.get('blueprints-container');
    if (!bContainer) return;
    bContainer.innerHTML = "";
    
    const starPanel = document.createElement('div');
    starPanel.className = "dynamic-panel reward-style";
    starPanel.style.cssText = "border: 1px solid rgba(212, 175, 55, 0.4); background: rgba(15, 13, 10, 0.5); margin-bottom: 15px; padding: 12px; width: 100%;";
    
    starPanel.innerHTML = `
        <div class="panel-title" style="color: #ffd700; margin-bottom: 8px;">🌟 皇家部位星級精煉台 (永久繼承) 🌟</div>
        <p style="font-size: 11px; color: #8e8e93; text-align: center; margin: 0 0 10px 0;">部位強化屬性永久提升：每⭐提升對應部位屬性額外加乘 +15%</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${renderStarUpRow("weapon", "🗡️ 武器槽位", accountMeta.equipmentStars.weapon)}
            ${renderStarUpRow("armor", "👕 防具槽位", accountMeta.equipmentStars.armor)}
            ${renderStarUpRow("accessory", "💍 飾品槽位", accountMeta.equipmentStars.accessory)}
        </div>
    `;
    bContainer.appendChild(starPanel);

    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    const filteredBlueprints = CRAFTING_BLUEPRINTS.filter(b => {
        const matchCat = (activeCraftingCategory === "all" || b.type === activeCraftingCategory);
        const matchLvl = (b.range === activeCraftingLvlRange);
        return matchCat && matchLvl;
    });

    if (filteredBlueprints.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.innerHTML = `<div style="color:#555; font-size:12px; padding:20px; width:100%; text-align:center;">🔨 該級別無此分類神裝，等待神匠開拓藍圖...</div>`;
        bContainer.appendChild(emptyDiv);
        return;
    }

    filteredBlueprints.forEach(blueprint => {
        const btnWrapper = document.createElement('div');
        btnWrapper.style.cssText = "background: rgba(0,0,0,0.2); padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 10px; text-align: left; width: 100%;";

        const reqText = Object.keys(blueprint.ingredients).map(k => `${k} x${blueprint.ingredients[k]}`).join(", ");
        const statText = Object.keys(blueprint.stats).map(k => {
            const nameMap = { atk: "攻擊", spd: "速度", mpRegen: "回魔", block: "減傷", maxHp: "生命", flee: "閃避" };
            const name = nameMap[k] || k;
            return `${name} ${blueprint.stats[k] > 0 ? '+' : ''}${blueprint.stats[k]}`;
        }).join(", ");

        const titleHtml = `<strong style="color:#fff; font-size:14px;">${blueprint.name}</strong> <span style="color:#ffd700; font-size:11px; font-weight:bold;">[${statText}]</span>`;
        const infoP = document.createElement('p');
        infoP.style.cssText = "margin: 0 0 10px 0; font-size: 12px; color: #babcbf; line-height: 1.5;";
        infoP.innerHTML = `${titleHtml}<br>${blueprint.desc}<br><span style="color:#8e8e93; font-size:11px;">🔨 所需素材：${reqText}</span>`;
        btnWrapper.appendChild(infoP);

        let canForge = true;
        for (let ing in blueprint.ingredients) {
            if ((accountMeta.warehouse[ing] || 0) < blueprint.ingredients[ing]) canForge = false;
        }

        const btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.cssText = "padding: 6px 12px; font-size: 11px; margin-right: 8px;";
        btnForge.innerHTML = "🔨 消耗材料打造";
        btnForge.disabled = !canForge; 
        btnForge.onclick = () => { executeForgeEquipment(blueprint); };
        btnWrapper.appendChild(btnForge);

        const isEquipped = (accountMeta.equipment.weapon === blueprint.name || accountMeta.equipment.armor === blueprint.name || accountMeta.equipment.accessory === blueprint.name);
        const hasInWarehouse = (accountMeta.warehouse[blueprint.name] || 0) > 0;

        if (isEquipped) {
            const btnUnequip = document.createElement('button');
            btnUnequip.className = "btn-game btn-rest"; 
            btnUnequip.style.cssText = "padding: 6px 12px; font-size: 11px;";
            btnUnequip.innerHTML = "❌ 卸下神裝";
            btnUnequip.onclick = () => { executeEquipAction(blueprint.name, "unequip"); };
            btnWrapper.appendChild(btnUnequip);
        } else if (hasInWarehouse) {
            const btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-rerun"; 
            btnEquip.style.cssText = "padding: 6px 12px; font-size: 11px;";
            btnEquip.innerHTML = "⚡ 穿戴上身";
            btnEquip.onclick = () => { executeEquipAction(blueprint.name, "equip"); };
            btnWrapper.appendChild(btnEquip);

            const btnDismantle = document.createElement('button');
            btnDismantle.className = "btn-game btn-rest"; 
            btnDismantle.style.cssText = "padding: 6px 12px; font-size: 11px; margin-left: 6px; background: linear-gradient(135deg, #c0392b 0%, #962d00 100%) !important;";
            btnDismantle.innerHTML = "♻️ 拆解回收";
            btnDismantle.onclick = () => { executeDismantle(blueprint.name); };
            btnWrapper.appendChild(btnDismantle);
        }

        bContainer.appendChild(btnWrapper);
    });
}

// ==========================================
// 8. 戰鬥日誌添加器
// ==========================================
function addLog(msg, type = "deal") {
    const box = DOM.get('log-box');
    if (!box) return;

    const classMap = {
        take: " log-take-dmg",
        perfect: " log-perfect",
        env: " log-env-tick",
        "victory-badge": " log-victory-badge"
    };

    const p = document.createElement('div');
    p.className = `log-row-box${classMap[type] || ""}`;
    p.innerHTML = msg;
    box.appendChild(p);
    
    box.scrollTo({
        top: box.scrollHeight,
        behavior: 'smooth'
    });
}
