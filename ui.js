// ==========================================================================
// 📺 ui.js：介面控制、選單渲染與數據同步核心
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
            const el = document.getElementById(key);
            if (el) this.elements[key] = el;
        });
        this.isInitialized = true;
    },
    get(key) {
        if (!this.isInitialized) this.init();
        if (!this.elements[key]) {
            const el = document.getElementById(key);
            if (el) this.elements[key] = el;
            return el;
        }
        return this.elements[key];
    }
};

let activeCookingRange = "1-10";
let activeCraftingCategory = "all";
let activeCraftingLvlRange = "1-10";

function showMaterialAlert(missingDetails, title = "⚠️ 所需材料 / 金幣不足！") {
    let overlay = document.getElementById('mat-alert-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mat-alert-overlay';
        overlay.innerHTML = `
            <div class="mat-alert-box">
                <div class="mat-alert-header" id="mat-alert-header-title">⚠️ 材料不足</div>
                <div class="mat-alert-content" id="mat-alert-body-content"></div>
                <button class="mat-alert-btn" onclick="hideMaterialAlert()">確認並返回</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const titleEl = document.getElementById('mat-alert-header-title');
    const bodyEl = document.getElementById('mat-alert-body-content');

    if (titleEl) titleEl.innerText = title;
    if (bodyEl) {
        if (Array.isArray(missingDetails)) {
            bodyEl.innerHTML = missingDetails.map(item => `• ${item}`).join('<br>');
        } else {
            bodyEl.innerHTML = missingDetails;
        }
    }

    overlay.classList.add('active');
}

function hideMaterialAlert() {
    const overlay = document.getElementById('mat-alert-overlay');
    if (overlay) overlay.classList.remove('active');
}

function allocateStatPoint(statKey) {
    if (!accountMeta.statPoints || accountMeta.statPoints <= 0) {
        showMaterialAlert(["自由能力點數不足，無法升級屬性！"], "⚠️ 點數不足");
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

function syncCharacterDataUi() {
    if (!accountMeta || !currentRun) return;

    const nameEl = DOM.get('p-name');
    const jobEl = DOM.get('p-job');
    const lvEl = DOM.get('p-lv');
    const expTextEl = DOM.get('p-exp-text');
    
    if (nameEl) nameEl.innerText = accountMeta.name || "無名勇者";
    if (jobEl) jobEl.innerText = getJobChineseName(currentRun.job);
    if (lvEl) lvEl.innerText = accountMeta.lv || currentRun.lv || 1;
    if (expTextEl) expTextEl.innerText = `${accountMeta.exp || 0} / ${accountMeta.nextExp || currentRun.nextExp || 30}`;

    const pts = accountMeta.statPoints || 0;
    const ptsEl = DOM.get('p-stat-points');
    if (ptsEl) ptsEl.innerText = pts;

    const folderSummary = DOM.get('char-folder-summary');
    if (folderSummary) {
        folderSummary.innerHTML = pts > 0 
            ? `🔍 展開角色面板 <span style="color: #00ffcc; font-weight: bold;">[✨ ${pts} 點數待分配]</span>`
            : `🔍 展開查看 戰偶裝備、配點與詳細數值`;
    }

    const gridEl = DOM.get('stat-alloc-grid');
    if (gridEl) {
        gridEl.innerHTML = "";
        const statConfig = [
            { key: "STR", name: "⚔️ 力量", desc: "近戰ATK / 負重" },
            { key: "AGI", name: "⚡ 敏捷", desc: "攻速 / 迴避" },
            { key: "VIT", name: "🛡️ 體質", desc: "HP上限 / 防禦" },
            { key: "INT", name: "🔮 智力", desc: "魔攻 / 魔防" },
            { key: "DEX", name: "🎯 靈巧", desc: "命中 / 詠唱" },
            { key: "LUK", name: "🎰 幸運", desc: "暴擊 / 完迴" }
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
                    pAtbBar.offsetHeight;
                }
                pAtbBar.style.transition = "width 0.25s linear";
                pAtbBar.style.width = `${pAtbPercent}%`;
            }
        }
    }

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

    const wStar = (accountMeta.equipmentStars?.weapon || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.weapon}]` : "";
    const aStar = (accountMeta.equipmentStars?.armor || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.armor}]` : "";
    const cStar = (accountMeta.equipmentStars?.accessory || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.accessory}]` : "";

    setTxt('p-equip-weapon', (accountMeta.equipment?.weapon || "空手") + wStar);
    setTxt('p-equip-armor', (accountMeta.equipment?.armor || "布衣") + aStar);
    setTxt('p-equip-accessory', (accountMeta.equipment?.accessory || "無") + cStar);

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
                slot.title = `點擊使用 / 退回倉庫 (${item})`;
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
    const jobNames = { swordsman: "劍士", magician: "魔法師", acolyte: "服事", thief: "盜賊", archer: "弓箭手" };
    return jobNames[j] || "劍士";
}

function switchVillageLocation(targetLoc) {
    currentVillageLocation = targetLoc;
    
    const panels = ['v-loc-gate', 'v-loc-guild', 'v-loc-kitchen', 'v-loc-workshop', 'v-loc-square'];
    panels.forEach(p => {
        const el = DOM.get(p);
        if (el) el.style.display = 'none';
    });
    
    const tabs = { 'GATE': 'btn-tab-gate', 'GUILD': 'btn-tab-guild', 'KITCHEN': 'btn-tab-kitchen', 'SQUARE': 'btn-tab-square', 'WORKSHOP': 'btn-tab-workshop' };
    
    Object.keys(tabs).forEach(k => {
        const tBtn = DOM.get(tabs[k]);
        if (tBtn) tBtn.classList.toggle('active', k === targetLoc);
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

function renderVillageGuild() {
    const container = DOM.get('guild-skills-container');
    if (!container || typeof SKILLS_DATABASE === "undefined") return;
    container.innerHTML = "";

    const jobSkills = SKILLS_DATABASE[currentRun.job] || [];

    jobSkills.forEach(s => {
        const card = document.createElement('div');
        card.style.cssText = "background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; width: 100%;";

        const currentLv = (accountMeta.skills && accountMeta.skills[s.name]) || (currentRun.skills && currentRun.skills[s.name]) || 0;
        const isMaxLevel = currentLv >= 10;
        const nextLv = currentLv + 1;

        const goldCost = s.goldCost * nextLv;
        const hasLevel = (accountMeta.lv || currentRun.lv || 1) >= s.reqLv;
        const hasGold = currentRun.gold >= goldCost;
        
        let reqMatTextArr = [];
        let hasMats = true;
        for (let mat in s.reqMat) {
            let reqQty = s.reqMat[mat] * nextLv;
            reqMatTextArr.push(`${mat} x${reqQty}`);
            if ((accountMeta.warehouse[mat] || 0) < reqQty) hasMats = false;
        }
        const reqMatText = reqMatTextArr.join(", ");

        let statusBadge = "";
        let btnDisabled = false;

        if (isMaxLevel) {
            statusBadge = `<span style="color: #ffd700; font-weight: bold; font-size: 11px;">[已滿級 Lv.10]</span>`;
            btnDisabled = true;
        } else if (currentLv > 0) {
            statusBadge = `<span style="color: #2ecc71; font-weight: bold; font-size: 11px;">[當前 Lv.${currentLv}]</span>`;
        } else {
            statusBadge = `<span style="color: #8e8e93; font-size: 11px;">[未習得]</span>`;
        }

        if (!isMaxLevel) {
            if (!hasLevel) {
                statusBadge += ` <span style="color: #e74c3c; font-size: 11px;">(需 Lv.${s.reqLv})</span>`;
                btnDisabled = true;
            } else if (!hasGold || !hasMats) {
                statusBadge += ` <span style="color: #e67e22; font-size: 11px;">(資源不足)</span>`;
                btnDisabled = true;
            }
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: #ffd700; font-size: 13px;">${s.name} ${statusBadge}</strong>
                <span style="font-size: 11px; color: #00ffcc;">${isMaxLevel ? "已達上限" : `下級消耗: 🪙 ${goldCost} G`}</span>
            </div>
            <p style="font-size: 11px; color: #aaa; margin: 4px 0;">${s.desc}</p>
            ${(!isMaxLevel && reqMatText) ? `<div style="font-size: 10px; color: #8e8e93;">📦 升級素材：${reqMatText}</div>` : ""}
            <div style="margin-top: 6px;"></div>
        `;

        const btnLearn = document.createElement('button');
        btnLearn.className = "btn-game btn-explore";
        btnLearn.style.cssText = "padding: 4px 10px; font-size: 11px;";
        
        if (isMaxLevel) {
            btnLearn.innerText = "👑 已達滿級 (Lv.10)";
        } else if (currentLv > 0) {
            btnLearn.innerText = `⚡ 升級至 Lv.${nextLv}`;
        } else {
            btnLearn.innerText = "🎓 學習傳承技能";
        }

        btnLearn.disabled = btnDisabled;
        btnLearn.onclick = () => { executeLearnSkill(s); };

        card.appendChild(btnLearn);
        container.appendChild(card);
    });
}

function renderVillageCookingWorkshop() {
    const wBox = DOM.get('kitchen-warehouse-display');
    if (wBox) {
        const wItems = Object.keys(accountMeta.warehouse || {}).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
        wBox.innerHTML = `📦 <strong>當前倉庫現存食材：</strong><br>${wItems || "暫無任何行軍素材"}`;
    }
    
    const rContainer = DOM.get('recipes-container');
    if (!rContainer) return;
    rContainer.innerHTML = "";

    const selectorControl = document.createElement('div');
    selectorControl.style.cssText = "margin-bottom: 12px; width: 100%;";
    selectorControl.innerHTML = `
        <label style="font-size: 11px; color: #ffd700; font-weight: bold; display: block; margin-bottom: 4px;">🍳 選擇食譜開發樓層：</label>
        <select class="select-game" onchange="changeCookingTab(this.value)">
            <option value="1-10" ${activeCookingRange === "1-10" ? "selected" : ""}>📜 深淵階層 B1F ~ B10F 食譜</option>
            <option value="11-20" ${activeCookingRange === "11-20" ? "selected" : ""}>📜 深淵階層 B11F ~ B20F 食譜</option>
            <option value="21-30" ${activeCookingRange === "21-30" ? "selected" : ""}>📜 深淵階層 B21F ~ B30F 食譜</option>
            <option value="31-40" ${activeCookingRange === "31-40" ? "selected" : ""}>📜 深淵階層 B31F ~ B40F 食譜</option>
            <option value="41-50" ${activeCookingRange === "41-50" ? "selected" : ""}>📜 深淵階層 B41F ~ B50F 食譜</option>
        </select>
    `;
    rContainer.appendChild(selectorControl);

    if (typeof RECIPES_DATABASE === "undefined") return;
    const filteredRecipes = RECIPES_DATABASE.filter(r => r.range === activeCookingRange);

    if (filteredRecipes.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = "color:#555; font-size:12px; padding:15px; width:100%; text-align:center;";
        emptyMsg.innerText = "🌿 該層數配方尚在通訊重構成形中...";
        rContainer.appendChild(emptyMsg);
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
        btnCook.onclick = () => { executeVillageCooking(recipe); };
        
        card.appendChild(btnCook);
        rContainer.appendChild(card);
    });
}

function renderStarUpRow(slot, displayName, currentLvl) {
    let upgradeBtn = "";
    
    if (currentLvl >= 11) {
        upgradeBtn = `<span style="color: #ffd700; font-size: 11px; font-weight: bold;">[已達最高 +11]</span>`;
    } else {
        upgradeBtn = `
            <button class="btn-game btn-rerun" style="padding: 4px 10px; font-size: 11px;" onclick="refineEquipmentSlot('${slot}')">
                🔥 強化升級 (+${currentLvl + 1})
            </button>
        `;
    }
    
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 8px; margin-bottom: 6px;">
            <span style="font-size: 12px; font-weight: bold; color: #fff;">
                ${displayName} 
                <span style="color: #ffd700; font-weight: bold; margin-left: 6px;">+${currentLvl || 0} / +11</span>
            </span>
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

    // 藍圖種類與等級選單
    const selectorWrapper = document.createElement('div');
    selectorWrapper.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; width: 100%;";
    selectorWrapper.innerHTML = `
        <div>
            <label style="font-size: 11px; color: #ffd700; font-weight: bold; display: block; margin-bottom: 4px;">🛠️ 選擇藍圖種類：</label>
            <select class="select-game" onchange="changeCraftingCat(this.value)">
                <option value="all" ${activeCraftingCategory === "all" ? "selected" : ""}>🌐 全部神裝藍圖</option>
                <option value="weapon" ${activeCraftingCategory === "weapon" ? "selected" : ""}>🗡️ 武器藍圖</option>
                <option value="armor" ${activeCraftingCategory === "armor" ? "selected" : ""}>👕 防具藍圖</option>
                <option value="accessory" ${activeCraftingCategory === "accessory" ? "selected" : ""}>💍 飾品藍圖</option>
            </select>
        </div>
        <div>
            <label style="font-size: 11px; color: #ffd700; font-weight: bold; display: block; margin-bottom: 4px;">📜 選擇解鎖等級：</label>
            <select class="select-game" onchange="changeCraftingLvl(this.value)">
                <option value="1-10" ${activeCraftingLvlRange === "1-10" ? "selected" : ""}>📜 階層 B1F ~ B10F</option>
                <option value="11-20" ${activeCraftingLvlRange === "11-20" ? "selected" : ""}>📜 階層 B11F ~ B20F</option>
                <option value="21-30" ${activeCraftingLvlRange === "21-30" ? "selected" : ""}>📜 階層 B21F ~ B30F</option>
            </select>
        </div>
    `;
    bContainer.appendChild(selectorWrapper);

    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    const filteredBlueprints = CRAFTING_BLUEPRINTS.filter(b => {
        const matchCat = (activeCraftingCategory === "all" || b.type === activeCraftingCategory);
        const matchLvl = (b.range === activeCraftingLvlRange);
        return matchCat && matchLvl;
    });

    filteredBlueprints.forEach(blueprint => {
        const btnWrapper = document.createElement('div');
        btnWrapper.style.cssText = "background: rgba(0,0,0,0.2); padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 10px; text-align: left; width: 100%;";

        const reqText = Object.keys(blueprint.ingredients).map(k => `${k} x${blueprint.ingredients[k]}`).join(", ");
        
        // 取得該裝備當前的獨立強化等級
        const itemRefineLvl = accountMeta.itemRefines?.[blueprint.name] || 0;
        const refineBadge = itemRefineLvl > 0 ? `<span style="color:#ffd700; font-weight:bold;"> (+${itemRefineLvl})</span>` : "";

        const statText = Object.keys(blueprint.stats).map(k => {
            const nameMap = { atk: "攻擊", spd: "速度", mpRegen: "回魔", block: "減傷", maxHp: "生命", flee: "閃避" };
            const name = nameMap[k] || k;
            
            // 計算加上獨立強化後的總數值（例如每級加成 15%）
            const baseVal = blueprint.stats[k];
            const finalVal = Math.floor(baseVal * (1 + itemRefineLvl * 0.15));
            return `${name} +${finalVal}`;
        }).join(", ");

        const titleHtml = `<strong style="color:#fff; font-size:14px;">${blueprint.name}${refineBadge}</strong> <span style="color:#00ffcc; font-size:11px; font-weight:bold;">[${statText}]</span>`;
        
        const infoP = document.createElement('p');
        infoP.style.cssText = "margin: 0 0 10px 0; font-size: 12px; color: #babcbf; line-height: 1.5;";
        infoP.innerHTML = `${titleHtml}<br>${blueprint.desc}<br><span style="color:#8e8e93; font-size:11px;">🔨 所需打造素材：${reqText}</span>`;
        btnWrapper.appendChild(infoP);

        // 1. 打造按鈕
        const btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.cssText = "padding: 6px 12px; font-size: 11px; margin-right: 6px;";
        btnForge.innerHTML = "🔨 消耗材料打造";
        btnForge.onclick = () => { executeForgeEquipment(blueprint); };
        btnWrapper.appendChild(btnForge);

        const isEquipped = (accountMeta.equipment.weapon === blueprint.name || accountMeta.equipment.armor === blueprint.name || accountMeta.equipment.accessory === blueprint.name);
        const hasInWarehouse = (accountMeta.warehouse[blueprint.name] || 0) > 0;

        // 2. 獨立強化按鈕（只要有擁有或穿戴即可強化）
        if (isEquipped || hasInWarehouse) {
            const btnRefine = document.createElement('button');
            btnRefine.className = "btn-game btn-rerun";
            btnRefine.style.cssText = "padding: 6px 12px; font-size: 11px; margin-right: 6px;";
            btnRefine.innerHTML = `🔥 精鍊升級 (+${itemRefineLvl + 1})`;
            btnRefine.onclick = () => { refineSpecificEquipment(blueprint.name); };
            btnWrapper.appendChild(btnRefine);
        }

        // 3. 穿戴 / 卸下 / 拆解按鈕
        if (isEquipped) {
            const btnUnequip = document.createElement('button');
            btnUnequip.className = "btn-game btn-rest"; 
            btnUnequip.style.cssText = "padding: 6px 12px; font-size: 11px;";
            btnUnequip.innerHTML = "❌ 卸下";
            btnUnequip.onclick = () => { executeEquipAction(blueprint.name, "unequip"); };
            btnWrapper.appendChild(btnUnequip);
        } else if (hasInWarehouse) {
            const btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-rerun"; 
            btnEquip.style.cssText = "padding: 6px 12px; font-size: 11px; margin-right: 6px;";
            btnEquip.innerHTML = "⚡ 穿戴";
            btnEquip.onclick = () => { executeEquipAction(blueprint.name, "equip"); };
            btnWrapper.appendChild(btnEquip);
        }

        bContainer.appendChild(btnWrapper);
    });
}

function addLog(msg, type = "deal") {
    const box = DOM.get('log-box');
    if (!box) return;

    const classMap = {
        take: " log-take-dmg",
        perfect: " log-perfect",
        env: " log-env-tick",
        miss: " log-miss",
        "skill-hit": " log-skill-hit",
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

function changeCookingTab(range) {
    activeCookingRange = range;
    renderVillageCookingWorkshop();
}

function changeCraftingCat(cat) {
    activeCraftingCategory = cat;
    renderVillageWorkshop();
}

function changeCraftingLvl(range) {
    activeCraftingLvlRange = range;
    renderVillageWorkshop();
}
