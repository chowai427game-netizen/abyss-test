// ==========================================================================
// 📺 ui.js：介面控制、選單渲染與數據同步核心 (UI/UX 深度優化版)
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

// --------------------------------------------------------------------------
// 🎒 背包與倉庫高效率互轉機制 (Deposit & Withdraw & Batch Deposit)
// --------------------------------------------------------------------------

// 1. 從倉庫領取 1 個料理/物品至背包
function executeWithdrawFoodFromWarehouse(itemName) {
    if (!currentRun.inventory) currentRun.inventory = [];
    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;

    if (currentRun.inventory.length >= maxBag) {
        showMaterialAlert([`🎒 背包容量已滿 (${currentRun.inventory.length}/${maxBag})，無法再取出更多物品！`], "⚠️ 背包已滿");
        return;
    }

    const qtyInWarehouse = accountMeta.warehouse?.[itemName] || 0;
    if (qtyInWarehouse <= 0) {
        showMaterialAlert([`📦 倉庫內已無存貨 (${itemName})！`], "⚠️ 庫存不足");
        return;
    }

    accountMeta.warehouse[itemName]--;
    if (accountMeta.warehouse[itemName] <= 0) {
        delete accountMeta.warehouse[itemName];
    }
    currentRun.inventory.push(itemName);

    if (typeof saveGameData === "function") saveGameData();
    addLog(`🎒 從倉庫取出 <strong>${itemName}</strong> 放入攜帶背包。`, "perfect");
    
    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
}

// 2. 在村莊時將指定背包物品退回存入倉庫
function executeDepositBagItemToWarehouse(bagIndex) {
    if (!currentRun.inventory || !currentRun.inventory[bagIndex]) return;

    const itemName = currentRun.inventory[bagIndex];
    currentRun.inventory.splice(bagIndex, 1);

    if (!accountMeta.warehouse) accountMeta.warehouse = {};
    accountMeta.warehouse[itemName] = (accountMeta.warehouse[itemName] || 0) + 1;

    if (typeof saveGameData === "function") saveGameData();
    addLog(`📦 已將背包中的 <strong>${itemName}</strong> 退回存放至倉庫。`, "perfect");

    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
    if (currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

// 3. ✨ [UI/UX 新功能] 一鍵將背包內所有物品全存入倉庫
function executeDepositAllBagItems() {
    if (!currentRun.inventory || currentRun.inventory.length === 0) {
        showMaterialAlert(["背包內目前沒有任何物品！"], "💡 提示");
        return;
    }

    const count = currentRun.inventory.length;
    if (!accountMeta.warehouse) accountMeta.warehouse = {};

    currentRun.inventory.forEach(itemName => {
        accountMeta.warehouse[itemName] = (accountMeta.warehouse[itemName] || 0) + 1;
    });

    currentRun.inventory = [];

    if (typeof saveGameData === "function") saveGameData();
    addLog(`📦 已將背包內全部 <strong>${count}</strong> 件物品一次性轉存至倉庫！`, "perfect");

    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
    if (currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

// --------------------------------------------------------------------------
// ⚔️ 裝備數值比對預覽計算 (Stat Comparison Helper)
// --------------------------------------------------------------------------
function getEquipmentStatDiff(blueprint) {
    if (!blueprint || !blueprint.stats) return "";

    const slotType = blueprint.type; // weapon, armor, accessory
    const currentlyEquippedName = accountMeta.equipment?.[slotType];

    let currentStats = {};
    if (currentlyEquippedName && typeof CRAFTING_BLUEPRINTS !== "undefined") {
        const equippedBp = CRAFTING_BLUEPRINTS.find(b => b.name === currentlyEquippedName);
        if (equippedBp) {
            const currentRefineLvl = accountMeta.itemRefines?.[currentlyEquippedName] || 0;
            for (let k in equippedBp.stats) {
                currentStats[k] = Math.floor(equippedBp.stats[k] * (1 + currentRefineLvl * 0.15));
            }
        }
    }

    const itemRefineLvl = accountMeta.itemRefines?.[blueprint.name] || 0;
    const nameMap = { atk: "攻擊", spd: "速度", mpRegen: "回魔", block: "減傷", maxHp: "生命", flee: "閃避" };

    let diffParts = [];
    for (let statKey in blueprint.stats) {
        const newBase = blueprint.stats[statKey];
        const newFinal = Math.floor(newBase * (1 + itemRefineLvl * 0.15));
        const oldFinal = currentStats[statKey] || 0;
        const diff = newFinal - oldFinal;

        const label = nameMap[statKey] || statKey;
        if (diff > 0) {
            diffParts.push(`${label} +${newFinal} <span style="color:#2ecc71; font-weight:bold;">(🟢 +${diff})</span>`);
        } else if (diff < 0) {
            diffParts.push(`${label} +${newFinal} <span style="color:#ff4757; font-weight:bold;">(🔴 ${diff})</span>`);
        } else {
            diffParts.push(`${label} +${newFinal} <span style="color:#8e8e93;">(=)</span>`);
        }
    }

    return diffParts.join(" | ");
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

    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;
    const invLen = currentRun.inventory?.length || 0;
    
    // ✨ [UI/UX 優化] 動態背包抬頭與一鍵全存按鈕
    const capTextEl = DOM.get('bag-capacity-text');
    if (capTextEl) {
        if (gameState === "VILLAGE" && invLen > 0) {
            capTextEl.innerHTML = `🎒 ${invLen} / ${maxBag} <button class="btn-game btn-rest" style="padding: 2px 8px; font-size: 10px; margin-left: 6px;" onclick="executeDepositAllBagItems()">📦 一鍵全存</button>`;
        } else {
            capTextEl.innerText = `🎒 ${invLen} / ${maxBag}`;
        }
    }

    const bagContainer = DOM.get('bag-slots-container');
    if (bagContainer) {
        bagContainer.innerHTML = "";
        for (let i = 0; i < maxBag; i++) {
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
                transition: all 0.2s ease;
            `;

            if (item) {
                slot.innerText = item;
                slot.title = gameState === "BATTLE" ? `點擊在戰鬥中使用 (${item})` : `點擊存入倉庫 (${item})`;
                slot.onclick = () => {
                    if (gameState === "BATTLE") {
                        if (typeof executeUseDungeonItem === "function") {
                            executeUseDungeonItem(item, i);
                        }
                    } else {
                        executeDepositBagItemToWarehouse(i);
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
    if (typeof JOB_DATABASE !== "undefined" && JOB_DATABASE[j]) {
        return JOB_DATABASE[j].name;
    }
    const jobNames = { 
        swordsman: "劍士", magician: "魔法師", acolyte: "服事", thief: "盜賊", archer: "弓箭手",
        knight: "騎士", crusader: "十字軍", wizard: "巫師", sage: "賢者", 
        priest: "祭司", monk: "武僧", assassin: "刺客", rogue: "流氓", hunter: "獵人", bard_dancer: "詩人/舞孃"
    };
    return jobNames[j] || "無名勇者";
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

// --------------------------------------------------------------------------
// 🛠️ 輔助函式：格式化技能效果 Preview 文字
// --------------------------------------------------------------------------
function formatSkillEffectText(s, lv, playerRun) {
    if (!lv || lv <= 0) return "未領悟";
    if (s.type === "passive") {
        if (s.passiveStats) {
            let statsArr = [];
            for (let k in s.passiveStats) {
                statsArr.push(`${k}: +${s.passiveStats[k]}`);
            }
            return `【被動屬性】${statsArr.join(", ")}`;
        }
        return "【被動常駐效果】";
    }

    const isMagicJob = (playerRun.job === "magician" || playerRun.job === "acolyte" || playerRun.job === "wizard" || playerRun.job === "priest" || playerRun.job === "sage");
    const baseAtk = isMagicJob ? (playerRun.matk || 10) : (playerRun.atk || 15);
    const maxMp = playerRun.maxMp || 100;
    const maxHp = playerRun.maxHp || 100;

    let eff = s.run(lv, baseAtk, maxMp, maxHp, maxHp);
    if (!eff) return "無特定數值";

    let parts = [];
    if (eff.dmg) {
        let hits = eff.hitCount || (eff.isTripleHit ? 3 : (eff.isDoubleHit ? 2 : 1));
        parts.push(`合共傷害: <strong>${eff.dmg}</strong> (${hits} 連發)`);
    }
    if (eff.healAmount) parts.push(`回復: <strong>+${eff.healAmount} HP</strong>`);
    if (eff.healPercent) parts.push(`回復: <strong>+${Math.floor(maxHp * eff.healPercent)} HP (${Math.round(eff.healPercent * 100)}%)</strong>`);
    if (eff.mpRestore) parts.push(`魔力回復: <strong>+${eff.mpRestore} MP</strong>`);
    if (eff.shieldGain) parts.push(`護盾: <strong>+${eff.shieldGain} Shield</strong>`);
    if (eff.blockBuff) parts.push(`減傷: <strong>+${eff.blockBuff} Block</strong>`);
    if (eff.stunChance) parts.push(`眩暈: <strong>${eff.stunChance}%</strong>`);
    if (eff.freezeChance) parts.push(`凍結: <strong>${eff.freezeChance}%</strong>`);
    if (eff.burnStacks) parts.push(`燃燒: <strong>+${eff.burnStacks} 層</strong>`);
    if (eff.poisonStacks) parts.push(`劇毒: <strong>+${eff.poisonStacks} 層</strong>`);

    return parts.length > 0 ? parts.join(" | ") : "特殊效果觸發";
}

// --------------------------------------------------------------------------
// 🏛️ 冒險者公會技能面板
// --------------------------------------------------------------------------
function renderVillageGuild() {
    const container = DOM.get('guild-skills-container');
    if (!container || typeof SKILLS_DATABASE === "undefined") return;
    container.innerHTML = "";

    const playerLv = accountMeta.lv || currentRun.lv || 1;
    const currentJob = currentRun.job;

    if (typeof canAdvanceJob === "function" && canAdvanceJob(currentRun)) {
        const advBanner = document.createElement('div');
        advBanner.style.cssText = `
            background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 140, 0, 0.3));
            border: 2px solid #ffd700; border-radius: 10px; padding: 12px; margin-bottom: 15px;
            text-align: center; box-shadow: 0 0 12px rgba(255, 215, 0, 0.3); width: 100%;
        `;
        advBanner.innerHTML = `
            <div style="font-size: 15px; font-weight: bold; color: #ffd700; margin-bottom: 4px;">
                🌟【血脈突破】你已具備資格進行皇家二轉突破儀式！
            </div>
            <p style="font-size: 11px; color: #e0e0e0; margin-bottom: 8px;">
                角色已達到 Lv.20！前往踏入更高階的職業殿堂，解鎖終極戰術能力。
            </p>
            <button class="btn-game btn-rerun" style="padding: 6px 16px; font-size: 12px; font-weight: bold;" onclick="openJobAdvancementModal()">
                🏇✨ 開啟二转突破選擇
            </button>
        `;
        container.appendChild(advBanner);
    }

    const jobSkills = typeof getAllSkillsForJob === "function" ? getAllSkillsForJob(currentJob) : (SKILLS_DATABASE[currentJob] || []);

    jobSkills.forEach(s => {
        const card = document.createElement('div');
        card.style.cssText = "background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 10px; width: 100%; text-align: left;";

        const currentLv = (accountMeta.skills && accountMeta.skills[s.name]) || (currentRun.skills && currentRun.skills[s.name]) || 0;
        const isMaxLevel = currentLv >= 10;
        const nextLv = currentLv + 1;

        const goldCost = s.goldCost * nextLv;
        const hasLevel = playerLv >= s.reqLv;
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

        const skillTypeTag = s.type === "passive" ? `<span style="color:#00ffcc; font-size:10px;">【被動】</span>` : `<span style="color:#ff9f43; font-size:10px;">【主動 MP:${s.mp}】</span>`;

        const curDmgText = formatSkillEffectText(s, currentLv, currentRun);
        const nextDmgText = !isMaxLevel ? formatSkillEffectText(s, nextLv, currentRun) : "已達最高滿級";

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong style="color: #ffd700; font-size: 13px;">${skillTypeTag} ${s.name} ${statusBadge}</strong>
                <span style="font-size: 11px; color: #00ffcc;">${isMaxLevel ? "已達上限" : `下級消耗: 🪙 ${goldCost} G`}</span>
            </div>
            
            <p style="font-size: 11px; color: #aaa; margin: 4px 0;">${s.desc}</p>
            
            <div style="background: rgba(0,0,0,0.4); padding: 6px 10px; border-radius: 6px; font-size: 11px; margin: 6px 0; border: 1px solid rgba(255,255,255,0.05);">
                <div>🔹 當前威力：${curDmgText}</div>
                ${!isMaxLevel ? `<div style="color: #00ffcc; margin-top: 2px;">⚡ 下級突破：${nextDmgText}</div>` : ''}
            </div>

            ${(!isMaxLevel && reqMatText) ? `<div style="font-size: 10px; color: #8e8e93; margin-bottom: 6px;">📦 升級素材：${reqMatText}</div>` : ""}
        `;

        const btnLearn = document.createElement('button');
        btnLearn.className = "btn-game btn-explore";
        btnLearn.style.cssText = "padding: 6px 12px; font-size: 11px; font-weight: bold; width: 100%; margin-top: 4px;";
        
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

// --------------------------------------------------------------------------
// 🍳 皇家料理屋介面
// --------------------------------------------------------------------------
function renderVillageCookingWorkshop() {
    const wBox = DOM.get('kitchen-warehouse-display');
    if (wBox) {
        wBox.innerHTML = "";

        const warehouseData = accountMeta.warehouse || {};
        let rawMaterials = [];
        let cookedDishes = [];

        const recipeNames = typeof RECIPES_DATABASE !== "undefined" ? RECIPES_DATABASE.map(r => r.name) : [];

        for (let itemKey in warehouseData) {
            let count = warehouseData[itemKey];
            if (count <= 0) continue;

            if (recipeNames.includes(itemKey)) {
                cookedDishes.push({ name: itemKey, qty: count });
            } else {
                rawMaterials.push(`${itemKey} (x${count})`);
            }
        }

        const rawMatText = rawMaterials.join(" | ") || "暫無基礎食材";
        const rawMatContainer = document.createElement('div');
        rawMatContainer.style.cssText = "margin-bottom: 10px; color: #aaa; font-size: 11px; line-height: 1.5;";
        rawMatContainer.innerHTML = `📦 <strong>當前倉庫現存食材：</strong><br>${rawMatText}`;
        wBox.appendChild(rawMatContainer);

        if (cookedDishes.length > 0) {
            const cookedHeader = document.createElement('div');
            cookedHeader.style.cssText = "color: #ffd700; font-weight: bold; font-size: 12px; margin: 10px 0 6px 0; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;";
            cookedHeader.innerText = "🍱 倉庫備用成品料理 (點擊取出至背包)：";
            wBox.appendChild(cookedHeader);

            const dishesGrid = document.createElement('div');
            dishesGrid.style.cssText = "display: flex; flex-direction: column; gap: 6px;";

            cookedDishes.forEach(d => {
                const dishRow = document.createElement('div');
                dishRow.style.cssText = `
                    display: flex; justify-content: space-between; align-items: center;
                    background: rgba(255, 215, 0, 0.05); border: 1px solid rgba(255, 215, 0, 0.2);
                    border-radius: 6px; padding: 6px 10px; font-size: 12px;
                `;
                dishRow.innerHTML = `
                    <span>🍱 <strong>${d.name}</strong> <span style="color: #ffd700;">(x${d.qty})</span></span>
                `;

                const btnWithdraw = document.createElement('button');
                btnWithdraw.className = "btn-game btn-explore";
                btnWithdraw.style.cssText = "padding: 3px 8px; font-size: 11px; font-weight: bold;";
                btnWithdraw.innerText = "🎒 取出 1 個";
                btnWithdraw.onclick = () => { executeWithdrawFoodFromWarehouse(d.name); };

                dishRow.appendChild(btnWithdraw);
                dishesGrid.appendChild(dishRow);
            });

            wBox.appendChild(dishesGrid);
        }
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
        btnCook.innerHTML = recipe.type === "village_eat" ? "🍴 當場進食獲得長效 Buff" : "🍳 烹飪產出存入倉庫";
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

// --------------------------------------------------------------------------
// 🛠️ 加工所介面 (含裝備數值動態比對預覽)
// --------------------------------------------------------------------------
function renderVillageWorkshop() {
    const wBox = DOM.get('workshop-warehouse-display');
    if (wBox) {
        const wItems = Object.keys(accountMeta.warehouse || {}).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
        wBox.innerHTML = `📦 <strong>雲端永久素材與裝備庫存：</strong><br>${wItems || "倉庫空空如也"}`;
    }
    
    const bContainer = DOM.get('blueprints-container');
    if (!bContainer) return;
    bContainer.innerHTML = "";

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
        
        const itemRefineLvl = accountMeta.itemRefines?.[blueprint.name] || 0;
        const refineBadge = itemRefineLvl > 0 ? `<span style="color:#ffd700; font-weight:bold;"> (+${itemRefineLvl})</span>` : "";

        // ✨ [UI/UX 優化] 計算與身上當前裝備的數值差異比對
        const statDiffHtml = getEquipmentStatDiff(blueprint);

        const titleHtml = `<strong style="color:#fff; font-size:14px;">${blueprint.name}${refineBadge}</strong>`;
        
        const infoP = document.createElement('p');
        infoP.style.cssText = "margin: 0 0 10px 0; font-size: 12px; color: #babcbf; line-height: 1.5;";
        infoP.innerHTML = `
            ${titleHtml}<br>
            <div style="background: rgba(0,0,0,0.3); padding: 5px 8px; border-radius: 6px; margin: 4px 0; border: 1px solid rgba(255,255,255,0.05); font-size:11px;">
                📊 <strong>穿戴屬性比對：</strong> ${statDiffHtml}
            </div>
            ${blueprint.desc}<br>
            <span style="color:#8e8e93; font-size:11px;">🔨 所需打造素材：${reqText}</span>
        `;
        btnWrapper.appendChild(infoP);

        const btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.cssText = "padding: 6px 12px; font-size: 11px; margin-right: 6px;";
        btnForge.innerHTML = "🔨 消耗材料打造";
        btnForge.onclick = () => { executeForgeEquipment(blueprint); };
        btnWrapper.appendChild(btnForge);

        const isEquipped = (accountMeta.equipment.weapon === blueprint.name || accountMeta.equipment.armor === blueprint.name || accountMeta.equipment.accessory === blueprint.name);
        const hasInWarehouse = (accountMeta.warehouse[blueprint.name] || 0) > 0;

        if (isEquipped || hasInWarehouse) {
            const btnRefine = document.createElement('button');
            btnRefine.className = "btn-game btn-rerun";
            btnRefine.style.cssText = "padding: 6px 12px; font-size: 11px; margin-right: 6px;";
            btnRefine.innerHTML = `🔥 精鍊升級 (+${itemRefineLvl + 1})`;
            btnRefine.onclick = () => { refineSpecificEquipment(blueprint.name); };
            btnWrapper.appendChild(btnRefine);
        }

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

// ==========================================================================
// 🍞 1. Toast 輕量通知 API
// ==========================================================================
function showToast(msg, type = "info") {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${type === 'success' ? 'toast-success' : type === 'warn' ? 'toast-warn' : ''}`;
    toast.innerText = msg;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 250);
    }, 2000);
}

// 替代原本彈窗的提示：如提領料理或全存時改用輕量 Toast
function executeDepositAllBagItems() {
    if (!currentRun.inventory || currentRun.inventory.length === 0) {
        showToast("🎒 背包內目前沒有物品！", "warn");
        return;
    }

    const count = currentRun.inventory.length;
    if (!accountMeta.warehouse) accountMeta.warehouse = {};

    currentRun.inventory.forEach(itemName => {
        accountMeta.warehouse[itemName] = (accountMeta.warehouse[itemName] || 0) + 1;
    });

    currentRun.inventory = [];
    if (typeof saveGameData === "function") saveGameData();
    
    showToast(`📦 已將 ${count} 件物品全存入倉庫！`, "success");
    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
    if (currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

// ==========================================================================
// 👻 2. 血條「殘影白條」平滑過渡控制
// ==========================================================================
let ghostHpTimer = null;
let ghostMonsterHpTimer = null;

function updateHpBarWithGhost(current, max, fillElId, ghostElId) {
    const fillEl = DOM.get(fillElId);
    const ghostEl = DOM.get(ghostElId);
    if (!fillEl || !ghostEl) return;

    const targetPct = Math.max(0, Math.min(100, (current / max) * 100));
    const currentGhostPct = parseFloat(ghostEl.style.width) || 100;

    // 扣血時：主血條立刻縮短，白條延遲 0.2 秒後跟進
    if (targetPct < currentGhostPct) {
        fillEl.style.width = `${targetPct}%`;
        clearTimeout(ghostHpTimer);
        ghostHpTimer = setTimeout(() => {
            ghostEl.style.width = `${targetPct}%`;
        }, 200);
    } else {
        // 回血時：兩條同時增加
        fillEl.style.width = `${targetPct}%`;
        ghostEl.style.width = `${targetPct}%`;
    }
}

// ==========================================================================
// 🎴 3. 懸停與長按詳細卡片 (Floating Item Card)
// ==========================================================================
let touchCardTimer = null;

function showFloatingCard(e, title, type, desc, stats = "") {
    let card = document.getElementById('floating-item-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'floating-item-card';
        document.body.appendChild(card);
    }

    card.innerHTML = `
        <div class="item-card-title">
            <span>${title}</span>
            <span class="item-card-type">${type}</span>
        </div>
        <div class="item-card-body">${desc}</div>
        ${stats ? `<div class="item-card-stats">${stats}</div>` : ''}
    `;

    // 定位計算：根據手指/滑鼠座標調整，避免超出螢幕邊界
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let posX = clientX + 15;
    let posY = clientY - 40;

    if (posX + 230 > window.innerWidth) posX = clientX - 235;
    if (posY < 10) posY = 10;

    card.style.left = `${posX}px`;
    card.style.top = `${posY}px`;
    card.classList.add('active');
}

function hideFloatingCard() {
    clearTimeout(touchCardTimer);
    const card = document.getElementById('floating-item-card');
    if (card) card.classList.remove('active');
}

// 為背包格子綁定長按與懸停事件
function attachItemCardEvents(element, itemName) {
    if (!element || !itemName) return;

    // 取得物品詳細資料（料理或裝備）
    let desc = "攜帶型冒險道具。";
    let type = "消耗品";
    let stats = "";

    if (typeof RECIPES_DATABASE !== "undefined") {
        const recipe = RECIPES_DATABASE.find(r => r.name === itemName);
        if (recipe) {
            desc = recipe.desc;
            type = recipe.type === "village_eat" ? "長效 Buff 料理" : "戰鬥回復料理";
        }
    }

    if (typeof CRAFTING_BLUEPRINTS !== "undefined") {
        const bp = CRAFTING_BLUEPRINTS.find(b => b.name === itemName);
        if (bp) {
            desc = bp.desc;
            type = "裝備";
            stats = Object.keys(bp.stats).map(k => `${k}: +${bp.stats[k]}`).join(" | ");
        }
    }

    // 🖥️ 滑鼠懸停（電腦）
    element.onmouseenter = (e) => showFloatingCard(e, itemName, type, desc, stats);
    element.onmouseleave = () => hideFloatingCard();

    // 📱 長按 0.3 秒觸發（手機）
    element.ontouchstart = (e) => {
        touchCardTimer = setTimeout(() => {
            showFloatingCard(e, itemName, type, desc, stats);
        }, 300);
    };
    element.ontouchend = () => hideFloatingCard();
    element.ontouchcancel = () => hideFloatingCard();
}
