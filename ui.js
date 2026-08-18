// ==========================================================================
// 📺 ui.js：介面控制、選單渲染與數據同步核心 (Floating UI 極致優化版)
// ==========================================================================

const DOM = {
    isInitialized: false,
    elements: {},
    init() {
        if (this.isInitialized) return;
        const keys = [
            'p-name', 'p-job', 'p-lv', 'p-exp-text', 'p-hp', 'p-maxhp', 'p-mp', 'p-maxmp',
            'hp-bar-fill', 'hp-bar-ghost', 'mp-bar-fill', 'p-atb-row', 'p-atb-text', 'p-atb-bar-fill',
            'p-gold', 'p-atk', 'p-block', 'p-crit', 'p-spd', 'p-dodge', 'p-vamp',
            'p-skills-list', 'p-stat-points', 'p-equip-weapon', 'p-equip-armor', 'p-equip-accessory',
            'btn-main-action', 'btn-rerun-action', 'btn-secondary-action', 'btn-auto-battle',
            'env-alert-bar', 'monster-status-card', 'm-name', 'm-hp-text', 'm-hp-bar', 'm-hp-bar-ghost',
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

// ==========================================================================
// 🍞 1. 輕量通知與提示 API (Toast & Floating Cards)
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
    const card = document.getElementById('floating-item-card');
    if (card) card.classList.remove('active');
}

// ✨ 通用 Floating Card 綁定引擎 (懸停與長按)
function bindFloatingCard(element, getCardDataFn) {
    if (!element) return;
    let touchTimer = null;

    element.onmouseenter = (e) => {
        const data = getCardDataFn();
        if (data) showFloatingCard(e, data.title, data.type, data.desc, data.stats);
    };
    element.onmouseleave = () => hideFloatingCard();

    element.ontouchstart = (e) => {
        touchTimer = setTimeout(() => {
            const data = getCardDataFn();
            if (data) showFloatingCard(e, data.title, data.type, data.desc, data.stats);
        }, 250);
    };
    element.ontouchend = () => { clearTimeout(touchTimer); hideFloatingCard(); };
    element.ontouchcancel = () => { clearTimeout(touchTimer); hideFloatingCard(); };
}

// ⚠️ 重大警告仍保留置中彈窗
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

// ==========================================================================
// 👻 2. 血條「殘影白條」平滑過渡控制
// ==========================================================================
let ghostHpTimer = null;
function updateHpBarWithGhost(current, max, fillElId, ghostElId) {
    const fillEl = DOM.get(fillElId);
    const ghostEl = DOM.get(ghostElId);
    if (!fillEl) return;
    
    const targetPct = Math.max(0, Math.min(100, (current / max) * 100));
    fillEl.style.width = `${targetPct}%`;

    if (!ghostEl) return;
    const currentGhostPct = parseFloat(ghostEl.style.width) || 100;

    if (targetPct < currentGhostPct) {
        clearTimeout(ghostHpTimer);
        ghostHpTimer = setTimeout(() => { ghostEl.style.width = `${targetPct}%`; }, 200);
    } else {
        ghostEl.style.width = `${targetPct}%`;
    }
}

// ==========================================================================
// 🎒 背包與倉庫高效率互轉機制
// ==========================================================================
function executeWithdrawFoodFromWarehouse(itemName) {
    if (!currentRun.inventory) currentRun.inventory = [];
    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;
    if (currentRun.inventory.length >= maxBag) {
        showToast(`🎒 背包已滿 (${maxBag}/${maxBag})`, "warn");
        return;
    }
    const qtyInWarehouse = accountMeta.warehouse?.[itemName] || 0;
    if (qtyInWarehouse <= 0) return;

    accountMeta.warehouse[itemName]--;
    if (accountMeta.warehouse[itemName] <= 0) delete accountMeta.warehouse[itemName];
    currentRun.inventory.push(itemName);

    if (typeof saveGameData === "function") saveGameData();
    showToast(`🎒 取出 ${itemName}`, "success");
    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
}

function executeDepositBagItemToWarehouse(bagIndex) {
    if (!currentRun.inventory || !currentRun.inventory[bagIndex]) return;
    const itemName = currentRun.inventory[bagIndex];
    currentRun.inventory.splice(bagIndex, 1);

    if (!accountMeta.warehouse) accountMeta.warehouse = {};
    accountMeta.warehouse[itemName] = (accountMeta.warehouse[itemName] || 0) + 1;

    if (typeof saveGameData === "function") saveGameData();
    showToast(`📦 退回 ${itemName}`, "success");
    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
    if (currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

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

function allocateStatPoint(statKey) {
    if (!accountMeta.statPoints || accountMeta.statPoints <= 0) {
        showToast("⚠️ 點數不足", "warn");
        return;
    }
    if (!accountMeta.stats) accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    accountMeta.statPoints--;
    accountMeta.stats[statKey] = (accountMeta.stats[statKey] || 0) + 1;
    resetCurrentRunData();
    saveGameData();
    addLog(`⚡ 屬性強化：<strong>${statKey}</strong> 提升至 ${accountMeta.stats[statKey]}！`, "perfect");
    updateUI();
}

function getEquipmentStatDiff(blueprint) {
    if (!blueprint || !blueprint.stats) return "";
    const slotType = blueprint.type; 
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
        if (diff > 0) diffParts.push(`${label} +${newFinal} <span style="color:#2ecc71;">(🟢 +${diff})</span>`);
        else if (diff < 0) diffParts.push(`${label} +${newFinal} <span style="color:#ff4757;">(🔴 ${diff})</span>`);
        else diffParts.push(`${label} +${newFinal} <span style="color:#8e8e93;">(=)</span>`);
    }
    return diffParts.join(" | ");
}

function syncCharacterDataUi() {
    if (!accountMeta || !currentRun) return;

    const setTxt = (key, txt) => { const e = DOM.get(key); if (e) e.innerText = txt; };
    setTxt('p-name', accountMeta.name || "無名勇者");
    setTxt('p-job', getJobChineseName(currentRun.job));
    setTxt('p-lv', accountMeta.lv || currentRun.lv || 1);
    setTxt('p-exp-text', `${accountMeta.exp || 0} / ${accountMeta.nextExp || currentRun.nextExp || 30}`);

    const pts = accountMeta.statPoints || 0;
    setTxt('p-stat-points', pts);

    const folderSummary = DOM.get('char-folder-summary');
    if (folderSummary) {
        folderSummary.innerHTML = pts > 0 
            ? `🔍 展開角色面板 <span style="color: #00ffcc; font-weight: bold;">[✨ ${pts} 點數待分配]</span>`
            : `🔍 展開查看 戰偶裝備、配點與詳細數值`;
    }

    // ✨ 配點網格 Floating Card 化 (簡化 HTML 視覺)
    const gridEl = DOM.get('stat-alloc-grid');
    if (gridEl) {
        gridEl.innerHTML = "";
        const statConfig = [
            { key: "STR", name: "⚔️ 力量", desc: "影響近戰物理傷害與負重能力。" },
            { key: "AGI", name: "⚡ 敏捷", desc: "提升攻擊速度與基礎閃避率。" },
            { key: "VIT", name: "🛡️ 體質", desc: "增加最大生命值(HP)與物理減傷。" },
            { key: "INT", name: "🔮 智力", desc: "增強魔法攻擊與魔法防禦力。" },
            { key: "DEX", name: "🎯 靈巧", desc: "提升物理命中率，減少技能詠唱時間。" },
            { key: "LUK", name: "🎰 幸運", desc: "提高暴擊機率與觸發完美迴避的機會。" }
        ];

        const hasPoints = pts > 0;
        const currentStats = accountMeta.stats || { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };

        statConfig.forEach(s => {
            const val = currentStats[s.key] || 0;
            const cell = document.createElement('div');
            cell.style.cssText = `
                background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 4px; padding: 6px; display: flex; justify-content: space-between; align-items: center;
                cursor: help;
            `;
            cell.innerHTML = `
                <span style="font-size: 11px; color: #ddd;">${s.name} <b style="color: #00ffcc;">${val}</b></span>
                <button class="btn-game" style="padding: 2px 6px; font-size: 11px; line-height: 1;"
                    ${hasPoints ? "" : "disabled"} onclick="allocateStatPoint('${s.key}')">+</button>
            `;
            bindFloatingCard(cell, () => ({
                title: `${s.name} (${s.key})`, type: "基礎屬性配點", desc: s.desc, stats: `點擊 [+] 消耗自由點數升級`
            }));
            gridEl.appendChild(cell);
        });
    }

    setTxt('p-hp', currentRun.hp);
    setTxt('p-maxhp', currentRun.maxHp);
    setTxt('p-mp', currentRun.mp);
    setTxt('p-maxmp', currentRun.maxMp);
    
    // 套用血條殘影
    updateHpBarWithGhost(currentRun.hp, currentRun.maxHp, 'hp-bar-fill', 'hp-bar-ghost');
    
    const mpBar = DOM.get('mp-bar-fill');
    if (mpBar) mpBar.style.width = `${Math.max(0, Math.min(100, (currentRun.mp / currentRun.maxMp) * 100))}%`;

    const pAtbRow = DOM.get('p-atb-row');
    if (pAtbRow) {
        if (gameState === "VILLAGE") pAtbRow.style.display = "none";
        else {
            pAtbRow.style.display = "block";
            const pAtbBar = DOM.get('p-atb-bar-fill');
            const pAtbPercent = Math.min(100, Math.max(0, typeof playerAtb !== "undefined" ? playerAtb : 0));
            if (pAtbBar) {
                if (pAtbPercent < parseFloat(pAtbBar.style.width || 0)) {
                    pAtbBar.style.transition = "none"; pAtbBar.style.width = "0%"; pAtbBar.offsetHeight;
                }
                pAtbBar.style.transition = "width 0.25s linear";
                pAtbBar.style.width = `${pAtbPercent}%`;
            }
        }
    }

    setTxt('p-gold', currentRun.gold || 0);
    setTxt('p-atk', `${currentRun.atk} (魔 ${currentRun.matk})`);
    setTxt('p-block', `${currentRun.def} (魔防 ${currentRun.mdef})`);
    setTxt('p-spd', currentRun.spd);
    setTxt('p-crit', `${currentRun.critChance}%`);
    setTxt('p-dodge', `${Math.floor(currentRun.flee)} (完迴 ${currentRun.perfectDodge}%)`);
    setTxt('p-vamp', `${Math.floor(currentRun.hit)} HIT`);

    setTxt('p-skills-list', Object.keys(currentRun.skills || {}).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ") || "基本打擊");

    const wStar = (accountMeta.equipmentStars?.weapon || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.weapon}]` : "";
    const aStar = (accountMeta.equipmentStars?.armor || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.armor}]` : "";
    const cStar = (accountMeta.equipmentStars?.accessory || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.accessory}]` : "";

    setTxt('p-equip-weapon', (accountMeta.equipment?.weapon || "空手") + wStar);
    setTxt('p-equip-armor', (accountMeta.equipment?.armor || "布衣") + aStar);
    setTxt('p-equip-accessory', (accountMeta.equipment?.accessory || "無") + cStar);

    // ✨ 紙娃娃裝備 Floating Card
    ['weapon', 'armor', 'accessory'].forEach(slotType => {
        const el = document.getElementById(`slot-${slotType}`);
        if (el) {
            bindFloatingCard(el, () => {
                const itemName = accountMeta.equipment?.[slotType];
                if (!itemName || itemName === "空手" || itemName === "布衣" || itemName === "無") return null;
                const bp = typeof CRAFTING_BLUEPRINTS !== 'undefined' ? CRAFTING_BLUEPRINTS.find(b=>b.name===itemName) : null;
                if (!bp) return { title: itemName, type: "裝備", desc: "基礎裝備", stats: "" };
                const refine = accountMeta.itemRefines?.[itemName] || 0;
                return {
                    title: `${itemName} (+${refine})`,
                    type: "當前裝備中",
                    desc: bp.desc,
                    stats: Object.keys(bp.stats).map(k => `${k}: +${Math.floor(bp.stats[k]*(1+refine*0.15))}`).join(" | ")
                };
            });
        }
    });

    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;
    const invLen = currentRun.inventory?.length || 0;
    
    const capTextEl = DOM.get('bag-capacity-text');
    if (capTextEl) {
        if (gameState === "VILLAGE" && invLen > 0) {
            capTextEl.innerHTML = `🎒 ${invLen} / ${maxBag} <button class="btn-game btn-rest" style="padding: 2px 8px; font-size: 10px; margin-left: 6px;" onclick="executeDepositAllBagItems()">📦 一鍵全存</button>`;
        } else {
            capTextEl.innerText = `🎒 ${invLen} / ${maxBag}`;
        }
    }

    // ✨ 背包物品 Floating Card
    const bagContainer = DOM.get('bag-slots-container');
    if (bagContainer) {
        bagContainer.innerHTML = "";
        for (let i = 0; i < maxBag; i++) {
            const item = currentRun.inventory[i];
            const slot = document.createElement('div');
            slot.style.cssText = `
                height: 32px; border: 1px dashed ${item ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.15)"};
                background: ${item ? "rgba(255,215,0,0.08)" : "rgba(0,0,0,0.2)"};
                border-radius: 4px; display: flex; align-items: center; justify-content: center;
                font-size: 10px; cursor: ${item ? "pointer" : "default"}; overflow: hidden;
                text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; color: ${item ? "#ffd700" : "#666"};
            `;

            if (item) {
                slot.innerText = item;
                slot.onclick = () => {
                    if (gameState === "BATTLE") { if (typeof executeUseDungeonItem === "function") executeUseDungeonItem(item, i); } 
                    else { executeDepositBagItemToWarehouse(i); }
                };
                
                bindFloatingCard(slot, () => {
                    let desc = "攜帶型冒險道具。"; let type = "消耗品"; let stats = "";
                    if (typeof RECIPES_DATABASE !== "undefined") {
                        const recipe = RECIPES_DATABASE.find(r => r.name === item);
                        if (recipe) { desc = recipe.desc; type = recipe.type === "village_eat" ? "長效 Buff 料理" : "戰鬥回復料理"; }
                    }
                    if (typeof CRAFTING_BLUEPRINTS !== "undefined") {
                        const bp = CRAFTING_BLUEPRINTS.find(b => b.name === item);
                        if (bp) { desc = bp.desc; type = "裝備"; stats = Object.keys(bp.stats).map(k => `${k}: +${bp.stats[k]}`).join(" | "); }
                    }
                    return { title: item, type, desc, stats: stats || (gameState === "VILLAGE" ? "💡 點擊：退回倉庫" : "💡 點擊：戰鬥中使用") };
                });
            } else {
                slot.innerHTML = `<span style="color:#444;">空</span>`;
            }
            bagContainer.appendChild(slot);
        }
    }
}

function getJobChineseName(j) {
    if (typeof JOB_DATABASE !== "undefined" && JOB_DATABASE[j]) return JOB_DATABASE[j].name;
    const jobNames = { swordsman: "劍士", magician: "魔法師", acolyte: "服事", thief: "盜賊", archer: "弓箭手", knight: "騎士", crusader: "十字軍", wizard: "巫師", sage: "賢者", priest: "祭司", monk: "武僧", assassin: "刺客", rogue: "流氓", hunter: "獵人", bard_dancer: "詩人/舞孃" };
    return jobNames[j] || "無名勇者";
}

function switchVillageLocation(targetLoc) {
    currentVillageLocation = targetLoc;
    const panels = ['v-loc-gate', 'v-loc-guild', 'v-loc-kitchen', 'v-loc-workshop', 'v-loc-square'];
    panels.forEach(p => { const el = DOM.get(p); if (el) el.style.display = 'none'; });
    
    const tabs = { 'GATE': 'btn-tab-gate', 'GUILD': 'btn-tab-guild', 'KITCHEN': 'btn-tab-kitchen', 'SQUARE': 'btn-tab-square', 'WORKSHOP': 'btn-tab-workshop' };
    Object.keys(tabs).forEach(k => { const tBtn = DOM.get(tabs[k]); if (tBtn) tBtn.classList.toggle('active', k === targetLoc); });
    
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
        if (mainActionBtn) { mainActionBtn.innerText = "🔮 啟動傳送門降臨深淵 B1F"; mainActionBtn.disabled = false; }
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
    if (actBtn) actBtn.innerText = (dungeonFloor % 10 === 0) ? `👹 討伐大領主 B${dungeonFloor}F 核心` : `⚔️ 深入突進下一層 B${dungeonFloor+1}F`;
    const rerunBtn = DOM.get('btn-rerun-action');
    if (rerunBtn) rerunBtn.style.display = (dungeonFloor > 0 && (dungeonFloor + 1) % 10 === 0) ? "block" : "none";

    // ✨ 環境力場 Floating Card
    if (envBar && typeof ENVIRONMENT_DATABASE !== "undefined" && ENVIRONMENT_DATABASE[currentEnvironment]) {
        envBar.className = ENVIRONMENT_DATABASE[currentEnvironment].className;
        envBar.innerHTML = `${ENVIRONMENT_DATABASE[currentEnvironment].logText} (B${dungeonFloor}F)`;
        bindFloatingCard(envBar, () => ({
            title: "🌍 當前環境力場", type: "被動環境", desc: ENVIRONMENT_DATABASE[currentEnvironment].logText, stats: "根據層數自動附加特殊增益或傷害限制。"
        }));
    }

    const monBox = DOM.get('monster-status-card');
    if (activeMonster && monBox) {
        monBox.style.display = "block";
        DOM.get('m-name').innerText = activeMonster.name;
        DOM.get('m-hp-text').innerText = `${activeMonster.hp} / ${activeMonster.maxHp}`;
        DOM.get('m-atk').innerText = activeMonster.atk;
        DOM.get('m-spd').innerText = activeMonster.spd;

        // 套用魔物血條殘影
        updateHpBarWithGhost(activeMonster.hp, activeMonster.maxHp, 'm-hp-bar', 'm-hp-bar-ghost');

        const mAtbRow = DOM.get('m-atb-row');
        if (mAtbRow) {
            mAtbRow.style.display = "block";
            const mAtbBar = DOM.get('m-atb-bar-fill');
            const mAtbPercent = Math.min(100, Math.max(0, typeof monsterAtb !== "undefined" ? monsterAtb : 0));
            if (mAtbBar) {
                if (mAtbPercent < parseFloat(mAtbBar.style.width || 0)) {
                    mAtbBar.style.transition = "none"; mAtbBar.style.width = "0%"; mAtbBar.offsetHeight; 
                }
                mAtbBar.style.transition = "width 0.25s linear"; mAtbBar.style.width = `${mAtbPercent}%`;
            }
        }

        // ✨ 魔物狀態 Floating Card
        bindFloatingCard(monBox, () => ({
            title: `👹 ${activeMonster.name}`, type: "深淵實體", desc: "盤踞於此層的危險生物，請時刻注意其行動條的積累速度。", stats: `攻擊: ${activeMonster.atk} | 速度: ${activeMonster.spd}`
        }));
    } else if (monBox) {
        monBox.style.display = "none";
        if (DOM.get('m-atb-row')) DOM.get('m-atb-row').style.display = "none";
    }

    if (rewardBox) rewardBox.style.display = (gameState === "REWARD" || gameState === "ENCOUNTER") ? "block" : "none";
    syncCharacterDataUi();
}

function formatSkillEffectText(s, lv, playerRun) {
    if (!lv || lv <= 0) return "未領悟";
    if (s.type === "passive") {
        if (s.passiveStats) {
            let statsArr = [];
            for (let k in s.passiveStats) statsArr.push(`${k}: +${s.passiveStats[k]}`);
            return `【被動屬性】${statsArr.join(", ")}`;
        }
        return "【被動常駐效果】";
    }
    const isMagicJob = (playerRun.job === "magician" || playerRun.job === "acolyte" || playerRun.job === "wizard" || playerRun.job === "priest" || playerRun.job === "sage");
    const baseAtk = isMagicJob ? (playerRun.matk || 10) : (playerRun.atk || 15);
    let eff = s.run(lv, baseAtk, playerRun.maxMp || 100, playerRun.maxHp || 100, playerRun.maxHp || 100);
    if (!eff) return "無特定數值";

    let parts = [];
    if (eff.dmg) parts.push(`傷害: <strong>${eff.dmg}</strong> (${eff.hitCount || (eff.isTripleHit ? 3 : (eff.isDoubleHit ? 2 : 1))} 連發)`);
    if (eff.healAmount) parts.push(`回復: <strong>+${eff.healAmount} HP</strong>`);
    if (eff.healPercent) parts.push(`回復: <strong>+${Math.floor((playerRun.maxHp||100) * eff.healPercent)} HP (${Math.round(eff.healPercent * 100)}%)</strong>`);
    if (eff.mpRestore) parts.push(`回魔: <strong>+${eff.mpRestore} MP</strong>`);
    if (eff.shieldGain) parts.push(`護盾: <strong>+${eff.shieldGain}</strong>`);
    return parts.length > 0 ? parts.join(" | ") : "特殊效果觸發";
}

// --------------------------------------------------------------------------
// 🏛️ 冒險者公會技能面板 (Floating UI 極簡版)
// --------------------------------------------------------------------------
function renderVillageGuild() {
    const container = DOM.get('guild-skills-container');
    if (!container || typeof SKILLS_DATABASE === "undefined") return;
    container.innerHTML = "";
    const playerLv = accountMeta.lv || currentRun.lv || 1;

    const jobSkills = typeof getAllSkillsForJob === "function" ? getAllSkillsForJob(currentRun.job) : (SKILLS_DATABASE[currentRun.job] || []);

    jobSkills.forEach(s => {
        const card = document.createElement('div');
        card.style.cssText = "background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px; width: 100%; text-align: left; cursor: help;";

        const currentLv = (accountMeta.skills && accountMeta.skills[s.name]) || (currentRun.skills && currentRun.skills[s.name]) || 0;
        const isMaxLevel = currentLv >= 10;
        const nextLv = currentLv + 1;
        const goldCost = s.goldCost * nextLv;
        
        let reqMatTextArr = [];
        let hasMats = true;
        for (let mat in s.reqMat) {
            let reqQty = s.reqMat[mat] * nextLv;
            reqMatTextArr.push(`${mat} x${reqQty}`);
            if ((accountMeta.warehouse[mat] || 0) < reqQty) hasMats = false;
        }

        let statusBadge = isMaxLevel ? `<span style="color:#ffd700; font-size:11px;">[已滿級]</span>` : (currentLv > 0 ? `<span style="color:#2ecc71; font-size:11px;">[Lv.${currentLv}]</span>` : `<span style="color:#8e8e93; font-size:11px;">[未習得]</span>`);
        let btnDisabled = isMaxLevel || playerLv < s.reqLv || currentRun.gold < goldCost || !hasMats;

        // 精簡 HTML
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: #ffd700; font-size: 13px;">${s.name} ${statusBadge}</strong>
                <span style="font-size: 11px; color: #00ffcc;">${isMaxLevel ? "" : `🪙 ${goldCost} G`}</span>
            </div>
        `;

        const btnLearn = document.createElement('button');
        btnLearn.className = "btn-game btn-explore";
        btnLearn.style.cssText = "padding: 6px 12px; font-size: 11px; font-weight: bold; width: 100%;";
        btnLearn.innerText = isMaxLevel ? "👑 已達滿級" : (currentLv > 0 ? `⚡ 升級至 Lv.${nextLv}` : "🎓 學習傳承");
        btnLearn.disabled = btnDisabled;
        btnLearn.onclick = () => { executeLearnSkill(s); };
        card.appendChild(btnLearn);
        
        // ✨ Floating Card 隱藏複雜資訊
        const curDmgText = formatSkillEffectText(s, currentLv, currentRun);
        const nextDmgText = !isMaxLevel ? formatSkillEffectText(s, nextLv, currentRun) : "已達滿級";
        bindFloatingCard(card, () => ({
            title: s.name, type: s.type === "passive" ? "【被動】" : `【主動 MP:${s.mp}】`, desc: s.desc,
            stats: `🔹 當前：${curDmgText}<br>${!isMaxLevel ? `⚡ 下級：${nextDmgText}<br>📦 素材：${reqMatTextArr.join(", ") || "無"}` : ""}`
        }));

        container.appendChild(card);
    });
}

// --------------------------------------------------------------------------
// 🍳 皇家料理屋介面 (Floating UI 極簡版)
// --------------------------------------------------------------------------
function renderVillageCookingWorkshop() {
    const wBox = DOM.get('kitchen-warehouse-display');
    if (wBox) {
        wBox.innerHTML = "";
        const warehouseData = accountMeta.warehouse || {};
        let rawMaterials = [], cookedDishes = [];
        const recipeNames = typeof RECIPES_DATABASE !== "undefined" ? RECIPES_DATABASE.map(r => r.name) : [];

        for (let itemKey in warehouseData) {
            let count = warehouseData[itemKey];
            if (count <= 0) continue;
            if (recipeNames.includes(itemKey)) cookedDishes.push({ name: itemKey, qty: count });
            else rawMaterials.push(`${itemKey} (x${count})`);
        }

        const rawMatContainer = document.createElement('div');
        rawMatContainer.style.cssText = "margin-bottom: 10px; color: #aaa; font-size: 11px; line-height: 1.5;";
        rawMatContainer.innerHTML = `📦 <strong>當前倉庫現存食材：</strong><br>${rawMaterials.join(" | ") || "暫無基礎食材"}`;
        wBox.appendChild(rawMatContainer);

        if (cookedDishes.length > 0) {
            const cookedHeader = document.createElement('div');
            cookedHeader.style.cssText = "color: #ffd700; font-weight: bold; font-size: 12px; margin: 10px 0 6px 0; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;";
            cookedHeader.innerText = "🍱 倉庫備用成品料理 (點擊取出)：";
            wBox.appendChild(cookedHeader);

            const dishesGrid = document.createElement('div');
            dishesGrid.style.cssText = "display: flex; flex-direction: column; gap: 6px;";
            cookedDishes.forEach(d => {
                const dishRow = document.createElement('div');
                dishRow.style.cssText = `display: flex; justify-content: space-between; align-items: center; background: rgba(255, 215, 0, 0.05); border: 1px solid rgba(255, 215, 0, 0.2); border-radius: 6px; padding: 6px 10px; font-size: 12px;`;
                dishRow.innerHTML = `<span>🍱 <strong>${d.name}</strong> <span style="color: #ffd700;">(x${d.qty})</span></span>`;
                const btnWithdraw = document.createElement('button');
                btnWithdraw.className = "btn-game btn-explore";
                btnWithdraw.style.cssText = "padding: 3px 8px; font-size: 11px;";
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
    selectorControl.innerHTML = `<label style="font-size: 11px; color: #ffd700; font-weight: bold; display: block; margin-bottom: 4px;">🍳 選擇食譜開發樓層：</label><select class="select-game" onchange="changeCookingTab(this.value)"><option value="1-10" ${activeCookingRange === "1-10" ? "selected" : ""}>📜 深淵階層 B1F ~ B10F 食譜</option><option value="11-20" ${activeCookingRange === "11-20" ? "selected" : ""}>📜 深淵階層 B11F ~ B20F 食譜</option><option value="21-30" ${activeCookingRange === "21-30" ? "selected" : ""}>📜 深淵階層 B21F ~ B30F 食譜</option></select>`;
    rContainer.appendChild(selectorControl);

    const filteredRecipes = (typeof RECIPES_DATABASE !== "undefined" ? RECIPES_DATABASE : []).filter(r => r.range === activeCookingRange);
    filteredRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.style.cssText = "background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 8px; width: 100%; text-align: left; cursor: help;";
        
        let hasIngredients = true;
        for (let ing in recipe.ingredients) { if ((accountMeta.warehouse[ing] || 0) < recipe.ingredients[ing]) hasIngredients = false; }
        
        // 精簡 HTML
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color:#2ecc71; font-size:13px;">${recipe.name}</strong>
                <span style="font-size:11px; color:#8e8e93;">${hasIngredients ? '🟢 素材充足' : '🔴 素材不足'}</span>
            </div>
        `;
        const btnCook = document.createElement('button');
        btnCook.className = "btn-game btn-cook";
        btnCook.style.cssText = "padding: 4px 10px; font-size: 11px; width: 100%;";
        btnCook.innerHTML = recipe.type === "village_eat" ? "🍴 當場進食獲得長效 Buff" : "🍳 烹飪產出存入倉庫";
        btnCook.onclick = () => { executeVillageCooking(recipe); };
        card.appendChild(btnCook);
        
        // ✨ Floating Card 隱藏複雜資訊
        bindFloatingCard(card, () => ({
            title: recipe.name, type: recipe.type === "village_eat" ? "長效 Buff" : "消耗品", desc: recipe.desc,
            stats: `🌾 需求：${Object.keys(recipe.ingredients).map(k => `${k} x${recipe.ingredients[k]}`).join(", ")}`
        }));
        rContainer.appendChild(card);
    });
}

// --------------------------------------------------------------------------
// 🛠️ 加工所介面 (Floating UI 極簡版)
// --------------------------------------------------------------------------
function renderVillageWorkshop() {
    const wBox = DOM.get('workshop-warehouse-display');
    if (wBox) wBox.innerHTML = `📦 <strong>雲端永久素材與裝備庫存：</strong><br>${Object.keys(accountMeta.warehouse || {}).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ") || "倉庫空空如也"}`;
    
    const bContainer = DOM.get('blueprints-container');
    if (!bContainer) return;
    bContainer.innerHTML = "";

    const selectorWrapper = document.createElement('div');
    selectorWrapper.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; width: 100%;";
    selectorWrapper.innerHTML = `
        <div><label style="font-size: 11px; color: #ffd700; font-weight: bold; display: block; margin-bottom: 4px;">🛠️ 選擇藍圖種類：</label><select class="select-game" onchange="changeCraftingCat(this.value)"><option value="all" ${activeCraftingCategory === "all" ? "selected" : ""}>🌐 全部神裝</option><option value="weapon" ${activeCraftingCategory === "weapon" ? "selected" : ""}>🗡️ 武器</option><option value="armor" ${activeCraftingCategory === "armor" ? "selected" : ""}>👕 防具</option><option value="accessory" ${activeCraftingCategory === "accessory" ? "selected" : ""}>💍 飾品</option></select></div>
        <div><label style="font-size: 11px; color: #ffd700; font-weight: bold; display: block; margin-bottom: 4px;">📜 解鎖等級：</label><select class="select-game" onchange="changeCraftingLvl(this.value)"><option value="1-10" ${activeCraftingLvlRange === "1-10" ? "selected" : ""}>階層 B1F ~ B10F</option><option value="11-20" ${activeCraftingLvlRange === "11-20" ? "selected" : ""}>階層 B11F ~ B20F</option><option value="21-30" ${activeCraftingLvlRange === "21-30" ? "selected" : ""}>階層 B21F ~ B30F</option></select></div>
    `;
    bContainer.appendChild(selectorWrapper);

    const filteredBlueprints = (typeof CRAFTING_BLUEPRINTS !== "undefined" ? CRAFTING_BLUEPRINTS : []).filter(b => (activeCraftingCategory === "all" || b.type === activeCraftingCategory) && (b.range === activeCraftingLvlRange));

    filteredBlueprints.forEach(blueprint => {
        const btnWrapper = document.createElement('div');
        btnWrapper.style.cssText = "background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); margin-bottom: 8px; text-align: left; width: 100%; cursor: help;";
        
        const itemRefineLvl = accountMeta.itemRefines?.[blueprint.name] || 0;
        const refineBadge = itemRefineLvl > 0 ? `<span style="color:#ffd700; font-weight:bold;"> (+${itemRefineLvl})</span>` : "";

        // 精簡 HTML
        btnWrapper.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong style="color:#fff; font-size:13px;">${blueprint.name}${refineBadge}</strong>
                <span style="color:#00ffcc; font-size:10px;">[長按看數值]</span>
            </div>
        `;
        
        const actionRow = document.createElement('div');
        actionRow.style.cssText = "display: flex; gap: 6px;";

        const btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.cssText = "padding: 6px 10px; font-size: 11px; flex: 1;";
        btnForge.innerHTML = "🔨 打造";
        btnForge.onclick = () => { executeForgeEquipment(blueprint); };
        actionRow.appendChild(btnForge);

        const isEquipped = (accountMeta.equipment.weapon === blueprint.name || accountMeta.equipment.armor === blueprint.name || accountMeta.equipment.accessory === blueprint.name);
        const hasInWarehouse = (accountMeta.warehouse[blueprint.name] || 0) > 0;

        if (isEquipped || hasInWarehouse) {
            const btnRefine = document.createElement('button');
            btnRefine.className = "btn-game btn-rerun";
            btnRefine.style.cssText = "padding: 6px 10px; font-size: 11px; flex: 1;";
            btnRefine.innerHTML = `🔥 精鍊(+${itemRefineLvl + 1})`;
            btnRefine.onclick = () => { refineSpecificEquipment(blueprint.name); };
            actionRow.appendChild(btnRefine);
        }
        if (isEquipped) {
            const btnUnequip = document.createElement('button');
            btnUnequip.className = "btn-game btn-rest"; 
            btnUnequip.style.cssText = "padding: 6px 10px; font-size: 11px; flex: 1;";
            btnUnequip.innerHTML = "❌ 卸下";
            btnUnequip.onclick = () => { executeEquipAction(blueprint.name, "unequip"); };
            actionRow.appendChild(btnUnequip);
        } else if (hasInWarehouse) {
            const btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-rerun"; 
            btnEquip.style.cssText = "padding: 6px 10px; font-size: 11px; flex: 1;";
            btnEquip.innerHTML = "⚡ 穿戴";
            btnEquip.onclick = () => { executeEquipAction(blueprint.name, "equip"); };
            actionRow.appendChild(btnEquip);
        }
        
        btnWrapper.appendChild(actionRow);

        // ✨ Floating Card 隱藏複雜資訊
        bindFloatingCard(btnWrapper, () => ({
            title: blueprint.name, type: "裝備藍圖", desc: blueprint.desc,
            stats: `📊 比對：${getEquipmentStatDiff(blueprint)}<br>🔨 素材：${Object.keys(blueprint.ingredients).map(k => `${k} x${blueprint.ingredients[k]}`).join(", ")}`
        }));
        
        bContainer.appendChild(btnWrapper);
    });
}

function addLog(msg, type = "deal") {
    const box = DOM.get('log-box');
    if (!box) return;
    const classMap = { take: " log-take-dmg", perfect: " log-perfect", env: " log-env-tick", miss: " log-miss", "skill-hit": " log-skill-hit", "victory-badge": " log-victory-badge" };
    const p = document.createElement('div');
    p.className = `log-row-box${classMap[type] || ""}`;
    p.innerHTML = msg;
    box.appendChild(p);
    box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
}

function changeCookingTab(range) { activeCookingRange = range; renderVillageCookingWorkshop(); }
function changeCraftingCat(cat) { activeCraftingCategory = cat; renderVillageWorkshop(); }
function changeCraftingLvl(range) { activeCraftingLvlRange = range; renderVillageWorkshop(); }
