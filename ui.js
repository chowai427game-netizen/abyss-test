// ==========================================================================
// 📺 ui.js：介面控制、選單渲染與數據同步核心 (5 大 UX 體驗升級版)
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
            'slot-weapon', 'slot-armor', 'slot-accessory',
            'btn-main-action', 'btn-rerun-action', 'btn-secondary-action', 'btn-auto-battle',
            'env-alert-bar', 'monster-status-card', 'm-name', 'm-hp-text', 'm-hp-bar', 'm-hp-bar-ghost',
            'm-atb-row', 'm-atb-text', 'm-atb-bar-fill', 'm-atk', 'm-spd',
            'reward-panel-box', 'log-box', 'title-box', 'status-panel-box', 'action-panel-box',
            'village-panel-box', 'log-wrapper-box', 'tactics-drawer-box', 'char-folder-summary',
            'stat-alloc-grid', 'bag-capacity-text', 'bag-slots-container', 'location-text',
            'guild-skills-container', 'kitchen-warehouse-display', 'recipes-container',
            'workshop-warehouse-display', 'blueprints-container',
            'player-status-badges', 'monster-status-badges'
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
let activeWarehouseFilter = "all"; // 🏷️ 倉庫過濾狀態

// --------------------------------------------------------------------------
// 🍞 1. Toast 輕量通知 API
// --------------------------------------------------------------------------

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

// --------------------------------------------------------------------------
// 👻 2. 血條傷害殘影白條控制
// --------------------------------------------------------------------------

let ghostHpTimer = null;
let ghostMonsterHpTimer = null;

function updateHpBarWithGhost(current, max, fillElId, ghostElId) {
    const fillEl = DOM.get(fillElId);
    const ghostEl = DOM.get(ghostElId);
    if (!fillEl) return;

    const targetPct = Math.max(0, Math.min(100, (current / max) * 100));

    if (!ghostEl) {
        fillEl.style.width = `${targetPct}%`;
        return;
    }

    const currentGhostPct = parseFloat(ghostEl.style.width) || 100;

    if (targetPct < currentGhostPct) {
        fillEl.style.width = `${targetPct}%`;
        clearTimeout(fillElId === 'hp-bar-fill' ? ghostHpTimer : ghostMonsterHpTimer);
        const timer = setTimeout(() => {
            ghostEl.style.width = `${targetPct}%`;
        }, 220);

        if (fillElId === 'hp-bar-fill') ghostHpTimer = timer;
        else ghostMonsterHpTimer = timer;
    } else {
        fillEl.style.width = `${targetPct}%`;
        ghostEl.style.width = `${targetPct}%`;
    }
}

// --------------------------------------------------------------------------
// 🎴 3. 通用 Floating Card 浮動卡片引擎
// --------------------------------------------------------------------------

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

function bindFloatingCard(element, getCardDataFn) {
    if (!element) return;

    element.onmouseenter = (e) => {
        const data = getCardDataFn();
        if (data) showFloatingCard(e, data.title, data.type, data.desc, data.stats);
    };
    element.onmouseleave = () => hideFloatingCard();

    element.ontouchstart = (e) => {
        touchCardTimer = setTimeout(() => {
            const data = getCardDataFn();
            if (data) showFloatingCard(e, data.title, data.type, data.desc, data.stats);
        }, 250);
    };
    element.ontouchend = () => hideFloatingCard();
    element.ontouchcancel = () => hideFloatingCard();
}

// --------------------------------------------------------------------------
// ✨ 4. Buff / Debuff 狀態徽章列渲染引擎
// --------------------------------------------------------------------------

function renderStatusBadges(containerEl, effectsMap) {
    if (!containerEl) return;
    containerEl.innerHTML = "";

    if (!effectsMap || Object.keys(effectsMap).length === 0) return;

    for (let key in effectsMap) {
        const eff = effectsMap[key];
        if (!eff || eff.duration <= 0) continue;

        const badge = document.createElement('div');
        const isBuff = eff.type === "buff";
        badge.className = `status-badge ${isBuff ? 'buff' : 'debuff'}`;
        badge.innerHTML = `<span>${eff.icon || '✨'}</span> <span>${eff.name}</span> <b>(${eff.duration})</b>`;

        bindFloatingCard(badge, () => ({
            title: eff.name,
            type: isBuff ? "增益 Buff" : "減益 Debuff",
            desc: eff.desc || "戰場狀態影響。",
            stats: `剩餘回合: ${eff.duration}`
        }));

        containerEl.appendChild(badge);
    }
}

// --------------------------------------------------------------------------
// 📱 5. 手機端橫向滑動切換村莊分頁 (Swipe Navigation)
// --------------------------------------------------------------------------

function initSwipeNavigation() {
    const villageBox = DOM.get('village-panel-box');
    if (!villageBox) return;

    let touchStartX = 0;
    let touchStartY = 0;
    const locations = ['GATE', 'GUILD', 'KITCHEN', 'WORKSHOP', 'SQUARE'];

    villageBox.ontouchstart = (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    };

    villageBox.ontouchend = (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        // 確保為水平滑動（避免垂直滾動頁面時誤觸）
        if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
            const currentIndex = locations.indexOf(currentVillageLocation);
            if (diffX < 0 && currentIndex < locations.length - 1) {
                // 左滑 ➔ 下一個分頁
                switchVillageLocation(locations[currentIndex + 1]);
                showToast(`轉至 ${locations[currentIndex + 1]} 區域`, "info");
            } else if (diffX > 0 && currentIndex > 0) {
                // 右滑 ➔ 上一個分頁
                switchVillageLocation(locations[currentIndex - 1]);
                showToast(`轉至 ${locations[currentIndex - 1]} 區域`, "info");
            }
        }
    };
}

// --------------------------------------------------------------------------
// 🎯 屬性配點邏輯
// --------------------------------------------------------------------------

function allocateStatPoint(statKey) {
    if (!accountMeta.statPoints || accountMeta.statPoints <= 0) {
        showToast("自由能力點數不足！", "warn");
        return;
    }
    
    if (!accountMeta.stats) {
        accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    }
    
    accountMeta.statPoints--;
    accountMeta.stats[statKey] = (accountMeta.stats[statKey] || 0) + 1;
    
    resetCurrentRunData();
    saveGameData();
    
    showToast(`⚡ ${statKey} 提升至 ${accountMeta.stats[statKey]}！`, "success");
    addLog(`⚡ 屬性強化：<strong>${statKey}</strong> 提升至 ${accountMeta.stats[statKey]}！`, "perfect");
    updateUI();
}

// --------------------------------------------------------------------------
// 🎒 背包與倉庫高效率互轉機制
// --------------------------------------------------------------------------

function executeWithdrawFoodFromWarehouse(itemName) {
    if (!currentRun.inventory) currentRun.inventory = [];
    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;

    if (currentRun.inventory.length >= maxBag) {
        showToast(`🎒 背包容量已滿 (${currentRun.inventory.length}/${maxBag})！`, "warn");
        return;
    }

    const qtyInWarehouse = accountMeta.warehouse?.[itemName] || 0;
    if (qtyInWarehouse <= 0) {
        showToast(`📦 倉庫內已無存貨 (${itemName})！`, "warn");
        return;
    }

    accountMeta.warehouse[itemName]--;
    if (accountMeta.warehouse[itemName] <= 0) {
        delete accountMeta.warehouse[itemName];
    }
    currentRun.inventory.push(itemName);

    if (typeof saveGameData === "function") saveGameData();
    showToast(`🎒 取出 ${itemName} 放入背包`, "success");
    addLog(`🎒 從倉庫取出 <strong>${itemName}</strong> 放入攜帶背包。`, "perfect");
    
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
    showToast(`📦 ${itemName} 已存入倉庫`, "info");
    addLog(`📦 已將背包中的 <strong>${itemName}</strong> 退回存放至倉庫。`, "perfect");

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
    addLog(`📦 已將背包內全部 <strong>${count}</strong> 件物品一次性轉存至倉庫！`, "perfect");

    updateUI();
    if (currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
    if (currentVillageLocation === "WORKSHOP") renderVillageWorkshop();
}

// --------------------------------------------------------------------------
// ⚔️ 裝備數值比對預覽計算
// --------------------------------------------------------------------------

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

// --------------------------------------------------------------------------
// 👤 角色數據 UI 同步 (含背包滿載警示 + Status Badges)
// --------------------------------------------------------------------------

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

    // 配點網格
    const gridEl = DOM.get('stat-alloc-grid');
    if (gridEl) {
        gridEl.innerHTML = "";
        const statConfig = [
            { key: "STR", name: "⚔️ 力量", desc: "近戰ATK / 負重", detail: "每點增加近戰物理攻擊與背包負重上限。" },
            { key: "AGI", name: "⚡ 敏捷", desc: "攻速 / 迴避", detail: "每點增加行動條積攢速度與完全閃避率。" },
            { key: "VIT", name: "🛡️ 體質", desc: "HP上限 / 防禦", detail: "每點增加生命上限與物理減傷數值。" },
            { key: "INT", name: "🔮 智力", desc: "魔攻 / 魔防", detail: "每點增加魔法攻擊力、最大 MP 與魔防。" },
            { key: "DEX", name: "🎯 靈巧", desc: "命中 / 詠唱", detail: "每點增加物理命中 Hit 與技能吟唱速度。" },
            { key: "LUK", name: "🎰 幸運", desc: "暴擊 / 完迴", detail: "每點增加暴擊觸發率與幸運迴避率。" }
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
                cursor: pointer;
            `;

            cell.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 11px; color: #ddd;">${s.name} <b style="color: #00ffcc;">${val}</b></span>
                </div>
                <button class="btn-game" 
                    style="padding: 2px 6px; font-size: 11px; min-width: 22px; height: 22px; line-height: 1;"
                    ${hasPoints ? "" : "disabled"} 
                    onclick="event.stopPropagation(); allocateStatPoint('${s.key}')">+</button>
            `;

            bindFloatingCard(cell, () => ({
                title: s.name,
                type: "基礎配點",
                desc: s.detail,
                stats: `當前投資點數: ${val}`
            }));

            gridEl.appendChild(cell);
        });
    }

    // 血條更新
    const hpEl = DOM.get('p-hp');
    const maxHpEl = DOM.get('p-maxhp');
    const mpEl = DOM.get('p-mp');
    const maxMpEl = DOM.get('p-maxmp');
    const pAtbRow = DOM.get('p-atb-row');
    const pAtbBar = DOM.get('p-atb-bar-fill');
    const pAtbText = DOM.get('p-atb-text');
    
    if (hpEl) hpEl.innerText = currentRun.hp;
    if (maxHpEl) maxHpEl.innerText = currentRun.maxHp;
    if (mpEl) mpEl.innerText = currentRun.mp;
    if (maxMpEl) maxMpEl.innerText = currentRun.maxMp;
    if (pAtbRow) {
    if (gameState === "BATTLE") {
        pAtbRow.style.display = "block"; // 戰鬥中顯示
        const pAtbPercent = Math.min(100, Math.max(0, typeof playerAtb !== "undefined" ? playerAtb : 0));
            
        if (pAtbBar) {
            pAtbBar.style.width = `${pAtbPercent}%`;
        }
        if (pAtbText) {
            pAtbText.innerText = `${Math.floor(pAtbPercent)}%`;
        }
    } else {
        pAtbRow.style.display = "none"; // 在村莊時隱藏行動條
        }
    }

    updateHpBarWithGhost(currentRun.hp, currentRun.maxHp, 'hp-bar-fill', 'hp-bar-ghost');

    const mpBar = DOM.get('mp-bar-fill');
    if (mpBar) mpBar.style.width = `${Math.max(0, Math.min(100, (currentRun.mp / currentRun.maxMp) * 100))}%`;

    // 渲染玩家當前 Buff/Debuff 狀態徽章
    renderStatusBadges(DOM.get('player-status-badges'), currentRun.activeEffects);

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

    // 裝備卡片名稱與 Paper Doll 綁定
    const wStar = (accountMeta.equipmentStars?.weapon || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.weapon}]` : "";
    const aStar = (accountMeta.equipmentStars?.armor || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.armor}]` : "";
    const cStar = (accountMeta.equipmentStars?.accessory || 0) > 0 ? ` [⭐x${accountMeta.equipmentStars.accessory}]` : "";

    const wName = accountMeta.equipment?.weapon || "空手";
    const aName = accountMeta.equipment?.armor || "布衣";
    const cName = accountMeta.equipment?.accessory || "無";

    setTxt('p-equip-weapon', wName + wStar);
    setTxt('p-equip-armor', aName + aStar);
    setTxt('p-equip-accessory', cName + cStar);

    ['slot-weapon', 'slot-armor', 'slot-accessory'].forEach(slotId => {
        const slotEl = DOM.get(slotId);
        if (!slotEl) return;
        const type = slotId.replace('slot-', '');
        const eqName = accountMeta.equipment?.[type] || "無";
        bindFloatingCard(slotEl, () => {
            let desc = "未裝備任何道具。";
            let stats = "";
            if (typeof CRAFTING_BLUEPRINTS !== "undefined") {
                const bp = CRAFTING_BLUEPRINTS.find(b => b.name === eqName);
                if (bp) {
                    desc = bp.desc;
                    stats = Object.keys(bp.stats).map(k => `${k}: +${bp.stats[k]}`).join(" | ");
                }
            }
            return { title: eqName, type: `裝備部位: ${type.toUpperCase()}`, desc: desc, stats: stats };
        });
    });

    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;
    const invLen = currentRun.inventory?.length || 0;
    
    // 🚨 警示 1：背包容量動態文字樣式
    const capTextEl = DOM.get('bag-capacity-text');
    if (capTextEl) {
        let capClass = "";
        if (invLen >= maxBag) capClass = "text-full";
        else if (invLen === maxBag - 1) capClass = "text-warn";

        if (gameState === "VILLAGE" && invLen > 0) {
            capTextEl.innerHTML = `<span class="${capClass}">🎒 ${invLen} / ${maxBag}</span> <button class="btn-game btn-rest" style="padding: 2px 8px; font-size: 10px; margin-left: 6px;" onclick="executeDepositAllBagItems()">📦 一鍵全存</button>`;
        } else {
            capTextEl.innerHTML = `<span class="${capClass}">🎒 ${invLen} / ${maxBag}</span>`;
        }
    }

    // 🚨 警示 2：背包滿載呼吸燈動畫
    const bagContainer = DOM.get('bag-slots-container');
    if (bagContainer) {
        bagContainer.classList.toggle('bag-full', invLen >= maxBag);
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
                slot.onclick = () => {
                    if (gameState === "BATTLE") {
                        if (typeof executeUseDungeonItem === "function") {
                            executeUseDungeonItem(item, i);
                        }
                    } else {
                        executeDepositBagItemToWarehouse(i);
                    }
                };

                bindFloatingCard(slot, () => {
                    let desc = "攜帶型冒險道具。";
                    let typeStr = "消耗品";
                    let statsStr = gameState === "BATTLE" ? "點擊在戰鬥中使用" : "點擊退回存入倉庫";

                    if (typeof RECIPES_DATABASE !== "undefined") {
                        const recipe = RECIPES_DATABASE.find(r => r.name === item);
                        if (recipe) {
                            desc = recipe.desc;
                            typeStr = recipe.type === "village_eat" ? "長效 Buff 料理" : "戰鬥回復料理";
                        }
                    }
                    if (typeof CRAFTING_BLUEPRINTS !== "undefined") {
                        const bp = CRAFTING_BLUEPRINTS.find(b => b.name === item);
                        if (bp) {
                            desc = bp.desc;
                            typeStr = "神裝藍圖產物";
                            statsStr += " | " + Object.keys(bp.stats).map(k => `${k}: +${bp.stats[k]}`).join(" | ");
                        }
                    }
                    return { title: item, type: typeStr, desc: desc, stats: statsStr };
                });
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
        
        initSwipeNavigation(); // 📱 初始化滑動手勢
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
        
        bindFloatingCard(envBar, () => ({
            title: ENVIRONMENT_DATABASE[currentEnvironment].name || "環境力場",
            type: "戰場環境",
            desc: ENVIRONMENT_DATABASE[currentEnvironment].desc || "該區域受異常力場覆蓋，影響屬性變化。",
            stats: ENVIRONMENT_DATABASE[currentEnvironment].logText
        }));
    }

    const monBox = DOM.get('monster-status-card');
    if (activeMonster && monBox) {
        monBox.style.display = "block";
        DOM.get('m-name').innerText = activeMonster.name;
        DOM.get('m-hp-text').innerText = `${activeMonster.hp} / ${activeMonster.maxHp}`;
        
        updateHpBarWithGhost(activeMonster.hp, activeMonster.maxHp, 'm-hp-bar', 'm-hp-bar-ghost');

        DOM.get('m-atk').innerText = activeMonster.atk;
        DOM.get('m-spd').innerText = activeMonster.spd;

        // 👹 弱點與蓄力警告 (Monster Threat Cue)
        const mAtbPercent = Math.min(100, Math.max(0, typeof monsterAtb !== "undefined" ? monsterAtb : 0));
        
        if (mAtbPercent >= 80) {
            monBox.classList.add('monster-threat-high');
        } else {
            monBox.classList.remove('monster-threat-high');
        }

        const weakElement = activeMonster.weakness ? `弱點: ${activeMonster.weakness}` : "無特別弱點";

        bindFloatingCard(monBox, () => ({
            title: activeMonster.name,
            type: "敵對魔物",
            desc: `${activeMonster.desc || "深淵威脅生物。"}<br><br>🎯 <b>弱點屬性:</b> <span style="color:#00ffcc;">${weakElement}</span>`,
            stats: `攻擊力: ${activeMonster.atk} | 速度: ${activeMonster.spd}`
        }));

        // 渲染魔物 Buff/Debuff 狀態徽章
        renderStatusBadges(DOM.get('monster-status-badges'), activeMonster.activeEffects);

        const mAtbRow = DOM.get('m-atb-row');
        if (mAtbRow) {
            mAtbRow.style.display = "block";
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
        monBox.classList.remove('monster-threat-high');
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
                🏇✨ 開啟二轉突破選擇
            </button>
        `;
        container.appendChild(advBanner);
    }

    const jobSkills = typeof getAllSkillsForJob === "function" ? getAllSkillsForJob(currentJob) : (SKILLS_DATABASE[currentJob] || []);

    jobSkills.forEach(s => {
        const row = document.createElement('div');
        row.style.cssText = `
            background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.05); margin-bottom: 6px; width: 100%;
            display: flex; justify-content: space-between; align-items: center; cursor: pointer;
        `;

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

        let btnDisabled = isMaxLevel || !hasLevel || !hasGold || !hasMats;
        const skillTypeTag = s.type === "passive" ? `<span style="color:#00ffcc; font-size:10px;">[被動]</span>` : `<span style="color:#ff9f43; font-size:10px;">[MP:${s.mp}]</span>`;

        row.innerHTML = `
            <div>
                <strong style="color: #ffd700; font-size: 12px;">${skillTypeTag} ${s.name}</strong>
                <span style="color: #8e8e93; font-size: 11px; margin-left: 6px;">Lv.${currentLv} / 10</span>
            </div>
        `;

        const btnLearn = document.createElement('button');
        btnLearn.className = "btn-game btn-explore";
        btnLearn.style.cssText = "padding: 4px 10px; font-size: 11px; font-weight: bold;";
        btnLearn.innerText = isMaxLevel ? "滿級" : `升級 (${goldCost}G)`;
        btnLearn.disabled = btnDisabled;
        btnLearn.onclick = (e) => { e.stopPropagation(); executeLearnSkill(s); };

        row.appendChild(btnLearn);

        const curDmgText = formatSkillEffectText(s, currentLv, currentRun);
        const nextDmgText = !isMaxLevel ? formatSkillEffectText(s, nextLv, currentRun) : "已達上限";

        bindFloatingCard(row, () => ({
            title: `${s.name} (Lv.${currentLv})`,
            type: s.type === "passive" ? "被動技能" : `主動技能 (MP: ${s.mp})`,
            desc: `${s.desc}<br><br>🔹 當前威力: ${curDmgText}<br>${!isMaxLevel ? `⚡ 下級突破: ${nextDmgText}` : ''}`,
            stats: isMaxLevel ? "已達最高等級" : `升級所需: 🪙 ${goldCost} G ${reqMatText ? `| 📦 ${reqMatText}` : ''}`
        }));

        container.appendChild(row);
    });
}

// --------------------------------------------------------------------------
// 🏷️ 倉庫過濾與渲染輔助 (Warehouse Filter Helper)
// --------------------------------------------------------------------------

function renderWarehouseFilterBar(containerEl, onFilterChange) {
    if (!containerEl) return;
    const filterRow = document.createElement('div');
    filterRow.className = "warehouse-filter-row";

    const tags = [
        { key: "all", label: "🌐 全部" },
        { key: "mat", label: "🌾 食材素材" },
        { key: "dish", label: "🍱 料理成品" },
        { key: "equip", label: "⚔️ 裝備神裝" }
    ];

    tags.forEach(t => {
        const btn = document.createElement('button');
        btn.className = `tag-btn ${activeWarehouseFilter === t.key ? 'active' : ''}`;
        btn.innerText = t.label;
        btn.onclick = () => {
            activeWarehouseFilter = t.key;
            onFilterChange();
        };
        filterRow.appendChild(btn);
    });

    containerEl.appendChild(filterRow);
}

// --------------------------------------------------------------------------
// 🍳 皇家料理屋介面 (含倉庫 Tag 分類過濾)
// --------------------------------------------------------------------------

function renderVillageCookingWorkshop() {
    const wBox = DOM.get('kitchen-warehouse-display');
    if (wBox) {
        wBox.innerHTML = "";

        // 🏷️ 渲染過濾標籤列
        renderWarehouseFilterBar(wBox, renderVillageCookingWorkshop);

        const warehouseData = accountMeta.warehouse || {};
        let rawMaterials = [];
        let cookedDishes = [];

        const recipeNames = typeof RECIPES_DATABASE !== "undefined" ? RECIPES_DATABASE.map(r => r.name) : [];

        for (let itemKey in warehouseData) {
            let count = warehouseData[itemKey];
            if (count <= 0) continue;

            const isDish = recipeNames.includes(itemKey);

            if (activeWarehouseFilter === "mat" && isDish) continue;
            if (activeWarehouseFilter === "dish" && !isDish) continue;

            if (isDish) {
                cookedDishes.push({ name: itemKey, qty: count });
            } else {
                rawMaterials.push({ name: itemKey, qty: count });
            }
        }

        if (activeWarehouseFilter !== "dish") {
            const rawMatContainer = document.createElement('div');
            rawMatContainer.className = "warehouse-pill-box";

            if (rawMaterials.length === 0) {
                rawMatContainer.innerHTML = `<span style="color:#888; font-size:11px;">無符合條件的食材</span>`;
            } else {
                rawMaterials.forEach(m => {
                    const pill = document.createElement('span');
                    pill.className = "warehouse-pill";
                    pill.innerHTML = `${m.name} <span class="count">x${m.qty}</span>`;
                    rawMatContainer.appendChild(pill);
                });
            }
            wBox.appendChild(rawMatContainer);
        }

        if (activeWarehouseFilter !== "mat" && cookedDishes.length > 0) {
            const dishesGrid = document.createElement('div');
            dishesGrid.style.cssText = "display: flex; flex-direction: column; gap: 4px; margin-top: 6px;";

            cookedDishes.forEach(d => {
                const dishRow = document.createElement('div');
                dishRow.style.cssText = `
                    display: flex; justify-content: space-between; align-items: center;
                    background: rgba(255, 215, 0, 0.05); border: 1px solid rgba(255, 215, 0, 0.2);
                    border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer;
                `;
                dishRow.innerHTML = `<span>🍱 <strong>${d.name}</strong> (x${d.qty})</span>`;

                const btnWithdraw = document.createElement('button');
                btnWithdraw.className = "btn-game btn-explore";
                btnWithdraw.style.cssText = "padding: 2px 6px; font-size: 10px; font-weight: bold;";
                btnWithdraw.innerText = "🎒 取出 1 個";
                btnWithdraw.onclick = (e) => { e.stopPropagation(); executeWithdrawFoodFromWarehouse(d.name); };

                dishRow.appendChild(btnWithdraw);

                bindFloatingCard(dishRow, () => {
                    let desc = "完成的美味料理。";
                    if (typeof RECIPES_DATABASE !== "undefined") {
                        const r = RECIPES_DATABASE.find(item => item.name === d.name);
                        if (r) desc = r.desc;
                    }
                    return { title: d.name, type: "成品料理", desc: desc, stats: `倉庫現存數量: ${d.qty}` };
                });

                dishesGrid.appendChild(dishRow);
            });

            wBox.appendChild(dishesGrid);
        }
    }
    
    const rContainer = DOM.get('recipes-container');
    if (!rContainer) return;
    rContainer.innerHTML = "";

    const selectorControl = document.createElement('div');
    selectorControl.style.cssText = "margin-bottom: 10px; width: 100%;";
    selectorControl.innerHTML = `
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

    filteredRecipes.forEach(recipe => {
        const row = document.createElement('div');
        row.style.cssText = `
            background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.03); margin-bottom: 6px; width: 100%;
            display: flex; justify-content: space-between; align-items: center; cursor: pointer;
        `;

        const ingList = Object.keys(recipe.ingredients).map(k => `${k} x${recipe.ingredients[k]}`).join(", ");

        row.innerHTML = `<div><strong style="color:#2ecc71; font-size:12px;">${recipe.name}</strong></div>`;

        const btnCook = document.createElement('button');
        btnCook.className = "btn-game btn-cook";
        btnCook.style.cssText = "padding: 3px 8px; font-size: 11px;";
        btnCook.innerHTML = recipe.type === "village_eat" ? "🍴 進食 Buff" : "🍳 烹飪存倉";
        btnCook.onclick = (e) => { e.stopPropagation(); executeVillageCooking(recipe); };

        row.appendChild(btnCook);

        bindFloatingCard(row, () => ({
            title: recipe.name,
            type: recipe.type === "village_eat" ? "長效進食 Buff" : "可攜帶戰鬥料理",
            desc: recipe.desc,
            stats: `🌾 配料需求: ${ingList}`
        }));

        rContainer.appendChild(row);
    });
}

// --------------------------------------------------------------------------
// 🛠️ 加工所介面 (含倉庫 Tag 分類過濾)
// --------------------------------------------------------------------------

function renderVillageWorkshop() {
    const wBox = DOM.get('workshop-warehouse-display');
    if (wBox) {
        wBox.innerHTML = "";

        // 🏷️ 渲染過濾標籤列
        renderWarehouseFilterBar(wBox, renderVillageWorkshop);

        const warehouseData = accountMeta.warehouse || {};
        let itemsList = [];

        for (let k in warehouseData) {
            if (warehouseData[k] <= 0) continue;
            
            const isEquip = typeof CRAFTING_BLUEPRINTS !== "undefined" && CRAFTING_BLUEPRINTS.some(b => b.name === k);
            const isDish = typeof RECIPES_DATABASE !== "undefined" && RECIPES_DATABASE.some(r => r.name === k);
            const isMat = !isEquip && !isDish;

            if (activeWarehouseFilter === "mat" && !isMat) continue;
            if (activeWarehouseFilter === "dish" && !isDish) continue;
            if (activeWarehouseFilter === "equip" && !isEquip) continue;

            itemsList.push({ name: k, qty: warehouseData[k] });
        }

        const pillBox = document.createElement('div');
        pillBox.className = "warehouse-pill-box";

        if (itemsList.length === 0) {
            pillBox.innerHTML = `<span style="color:#888; font-size:11px;">無符合條件的物品</span>`;
        } else {
            itemsList.forEach(item => {
                const pill = document.createElement('span');
                pill.className = "warehouse-pill";
                pill.innerHTML = `${item.name} <span class="count">x${item.qty}</span>`;
                pillBox.appendChild(pill);
            });
        }
        wBox.appendChild(pillBox);
    }
    
    const bContainer = DOM.get('blueprints-container');
    if (!bContainer) return;
    bContainer.innerHTML = "";

    const selectorWrapper = document.createElement('div');
    selectorWrapper.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; width: 100%;";
    selectorWrapper.innerHTML = `
        <select class="select-game" onchange="changeCraftingCat(this.value)">
            <option value="all" ${activeCraftingCategory === "all" ? "selected" : ""}>🌐 全部神裝藍圖</option>
            <option value="weapon" ${activeCraftingCategory === "weapon" ? "selected" : ""}>🗡️ 武器藍圖</option>
            <option value="armor" ${activeCraftingCategory === "armor" ? "selected" : ""}>👕 防具藍圖</option>
            <option value="accessory" ${activeCraftingCategory === "accessory" ? "selected" : ""}>💍 飾品藍圖</option>
        </select>
        <select class="select-game" onchange="changeCraftingLvl(this.value)">
            <option value="1-10" ${activeCraftingLvlRange === "1-10" ? "selected" : ""}>📜 階層 B1F ~ B10F</option>
            <option value="11-20" ${activeCraftingLvlRange === "11-20" ? "selected" : ""}>📜 階層 B11F ~ B20F</option>
            <option value="21-30" ${activeCraftingLvlRange === "21-30" ? "selected" : ""}>📜 階層 B21F ~ B30F</option>
        </select>
    `;
    bContainer.appendChild(selectorWrapper);

    if (typeof CRAFTING_BLUEPRINTS === "undefined") return;
    const filteredBlueprints = CRAFTING_BLUEPRINTS.filter(b => {
        const matchCat = (activeCraftingCategory === "all" || b.type === activeCraftingCategory);
        const matchLvl = (b.range === activeCraftingLvlRange);
        return matchCat && matchLvl;
    });

    filteredBlueprints.forEach(blueprint => {
        const row = document.createElement('div');
        row.style.cssText = `
            background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 8px;
            border: 1px solid rgba(255,255,255,0.04); margin-bottom: 6px; text-align: left;
            width: 100%; display: flex; justify-content: space-between; align-items: center; cursor: pointer;
        `;

        const itemRefineLvl = accountMeta.itemRefines?.[blueprint.name] || 0;
        const refineBadge = itemRefineLvl > 0 ? `<span style="color:#ffd700;"> (+${itemRefineLvl})</span>` : "";
        const statDiffHtml = getEquipmentStatDiff(blueprint);
        const reqText = Object.keys(blueprint.ingredients).map(k => `${k} x${blueprint.ingredients[k]}`).join(", ");

        row.innerHTML = `<div><strong style="color:#fff; font-size:12px;">${blueprint.name}${refineBadge}</strong></div>`;

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = "display: flex; gap: 4px;";

        // 1. 打造按鈕
        const btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.cssText = "padding: 3px 6px; font-size: 10px;";
        btnForge.innerHTML = "🔨 打造";
        btnForge.onclick = (e) => { e.stopPropagation(); if (typeof executeForgeEquipment === "function") executeForgeEquipment(blueprint); };
        btnGroup.appendChild(btnForge);

        const isEquipped = (accountMeta.equipment?.weapon === blueprint.name || accountMeta.equipment?.armor === blueprint.name || accountMeta.equipment?.accessory === blueprint.name);
        const hasInWarehouse = (accountMeta.warehouse?.[blueprint.name] || 0) > 0;
        const curRefine = accountMeta.itemRefines?.[blueprint.name] || 0;

        // 2. ✨ 強化按鈕 (只要玩家擁有該裝備，無論穿著或在倉庫，都會出現強化按鈕)
        if (isEquipped || hasInWarehouse) {
            const btnRefine = document.createElement('button');
            btnRefine.className = "btn-game btn-rerun";
            btnRefine.style.cssText = "padding: 3px 6px; font-size: 10px; background: linear-gradient(135deg, #f39c12 0%, #d35400 100%) !important;";
            btnRefine.innerHTML = `✨ 強化 (+${curRefine})`;
            btnRefine.onclick = (e) => { 
                e.stopPropagation(); 
                if (typeof refineSpecificEquipment === "function") {
                    refineSpecificEquipment(blueprint.name);
                } 
            };
            btnGroup.appendChild(btnRefine);
        }

        // 3. 穿戴 / 卸下按鈕
        if (isEquipped) {
            const btnUnequip = document.createElement('button');
            btnUnequip.className = "btn-game btn-rest"; 
            btnUnequip.style.cssText = "padding: 3px 6px; font-size: 10px;";
            btnUnequip.innerHTML = "❌ 卸下";
            btnUnequip.onclick = (e) => { e.stopPropagation(); if (typeof executeEquipAction === "function") executeEquipAction(blueprint.name, "unequip"); };
            btnGroup.appendChild(btnUnequip);
        } else if (hasInWarehouse) {
            const btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-rerun"; 
            btnEquip.style.cssText = "padding: 3px 6px; font-size: 10px;";
            btnEquip.innerHTML = "⚡ 穿戴";
            btnEquip.onclick = (e) => { e.stopPropagation(); if (typeof executeEquipAction === "function") executeEquipAction(blueprint.name, "equip"); };
            btnGroup.appendChild(btnEquip);
        }

        row.appendChild(btnGroup);

        bindFloatingCard(row, () => ({
            title: blueprint.name,
            type: `裝備藍圖 (${blueprint.type.toUpperCase()})`,
            desc: `${blueprint.desc}<br><br>📊 <strong>穿戴屬性比對:</strong> ${statDiffHtml}`,
            stats: `🔨 所需打造材料: ${reqText}`
        }));

        bContainer.appendChild(row);
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
// 🔑 360° 轉盤開鎖 (Radial Lockpick QTE System)
// ==========================================================================

let lockpickState = {
    targetAngle: 0,      // 最佳解鎖角度 (0 ~ 360)
    tolerance: 15,       // 容許誤差角度 (±15度)
    currentAngle: 0,     // 玩家目前指針角度
    holdProgress: 0,     // 成功區域停留蓄力進度 (0 ~ 100)
    isDragging: false,
    holdTimer: null,
    onSuccessCallback: null
};

// --------------------------------------------------------------------------
// 📦 1. 寶箱察看前置面板 (防止過快自動觸發 QTE)
// --------------------------------------------------------------------------

function openChestInspectionModal(chestName = "遠古白銀寶箱", difficulty = "medium", onSuccess) {
    const overlay = document.getElementById('chest-inspect-overlay');
    const titleEl = document.getElementById('chest-inspect-title');
    const descEl = document.getElementById('chest-inspect-desc');

    if (titleEl) titleEl.innerText = `📦 發現 ${chestName}`;
    if (descEl) descEl.innerText = `此寶箱掛有高階鎖芯，需要精細開鎖（難度：${difficulty.toUpperCase()}）。`;

    lockpickState.onSuccessCallback = onSuccess;
    lockpickState.difficulty = difficulty;

    if (overlay) overlay.style.display = 'flex';
}

function closeChestInspectModal() {
    const overlay = document.getElementById('chest-inspect-overlay');
    if (overlay) overlay.style.display = 'none';
}

function confirmStartLockpick() {
    closeChestInspectModal();
    initLockpickQTE(lockpickState.difficulty);
}

function executeForceOpenChest() {
    closeChestInspectModal();
    if (Math.random() < 0.5) {
        showToast("💥 撬鎖成功！但寶箱內部分物品受損。", "warn");
        if (lockpickState.onSuccessCallback) lockpickState.onSuccessCallback(true);
    } else {
        showToast("⚠️ 撬鎖失敗！開鎖器折斷，引爆陷阱！", "warn");
        addLog("⚠️ 強行撬鎖失敗，觸發防盜毒霧，受到微量傷害！", "take");
    }
}

// --------------------------------------------------------------------------
// ⚙️ 2. 初始化轉盤與 Pointer Events 跨平台監聽
// --------------------------------------------------------------------------

function initLockpickQTE(difficulty = "medium") {
    const overlay = document.getElementById('lockpick-modal-overlay');
    const dial = document.getElementById('lockpick-dial');
    const sweetSpot = document.getElementById('lockpick-sweet-spot');

    // 根據難度設定容許誤差
    lockpickState.tolerance = difficulty === 'hard' ? 8 : (difficulty === 'easy' ? 22 : 14);
    // 隨機產生最佳角度 (30° ~ 330° 避免正好落在原點)
    lockpickState.targetAngle = Math.floor(Math.random() * 300) + 30;
    lockpickState.currentAngle = 0;
    lockpickState.holdProgress = 0;
    lockpickState.isDragging = false;

    // 視覺渲染最佳區域環形漸層
    const tAngle = lockpickState.targetAngle;
    const tol = lockpickState.tolerance;
    const startAngle = (tAngle - tol + 360) % 360;
    const endAngle = (tAngle + tol) % 360;

    sweetSpot.style.background = `conic-gradient(
        from 0deg,
        transparent 0deg ${startAngle}deg,
        rgba(0, 255, 204, 0.6) ${startAngle}deg ${endAngle}deg,
        transparent ${endAngle}deg 360deg
    )`;

    updateLockpickNeedle(0);
    updateProgressFill(0);

    if (overlay) overlay.style.display = 'flex';

    // 📱/💻 跨平台通用 Pointer Events 綁定
    if (dial && !dial.dataset.bound) {
        dial.dataset.bound = "true";

        dial.addEventListener('pointerdown', (e) => {
            dial.setPointerCapture(e.pointerId); // 鎖定指標，防止滑出界外失靈
            lockpickState.isDragging = true;
            calculateAngleFromPointer(e, dial);
        });

        dial.addEventListener('pointermove', (e) => {
            if (!lockpickState.isDragging) return;
            calculateAngleFromPointer(e, dial);
        });

        const stopDrag = (e) => {
            if (lockpickState.isDragging) {
                lockpickState.isDragging = false;
                try { dial.releasePointerCapture(e.pointerId); } catch(err) {}
            }
        };

        dial.addEventListener('pointerup', stopDrag);
        dial.addEventListener('pointercancel', stopDrag);
    }

    startHoldProgressLoop();
}

// --------------------------------------------------------------------------
// 📐 3. 角度計算 (atan2) 與視覺回饋
// --------------------------------------------------------------------------

function calculateAngleFromPointer(e, dial) {
    const rect = dial.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    // 使用 Math.atan2 計算 0~360 度角 (以正下方為起點向順時針)
    let rad = Math.atan2(dy, dx);
    let deg = rad * (180 / Math.PI) - 90; // 調整角度偏移
    if (deg < 0) deg += 360;

    lockpickState.currentAngle = Math.round(deg);
    updateLockpickNeedle(lockpickState.currentAngle);
}

function updateLockpickNeedle(deg) {
    const needle = document.getElementById('lockpick-needle');
    const dial = document.getElementById('lockpick-dial');
    const hintText = document.getElementById('lockpick-hint-text');

    if (needle) needle.style.transform = `translate(-50%, 0) rotate(${deg}deg)`;

    // 檢查是否處於最佳區域 (Sweet Spot)
    const diff = Math.abs(deg - lockpickState.targetAngle);
    const inZone = diff <= lockpickState.tolerance || (360 - diff) <= lockpickState.tolerance;

    if (dial) dial.classList.toggle('in-sweet-spot', inZone);

    if (hintText) {
        if (inZone) {
            hintText.innerHTML = `<span style="color:#00ffcc; font-weight:bold;">✨ 感受到了微弱聲響！保持住角度...</span>`;
            // 手機端微幅震動提示
            if (navigator.vibrate && Math.random() < 0.3) navigator.vibrate(15);
        } else {
            hintText.innerText = "按住轉盤拖拽旋轉，尋找最佳解鎖感應區";
        }
    }
}

// --------------------------------------------------------------------------
// ⏱️ 4. 在最佳角度停留自動積攢進度條
// --------------------------------------------------------------------------

function startHoldProgressLoop() {
    if (lockpickState.holdTimer) clearInterval(lockpickState.holdTimer);

    lockpickState.holdTimer = setInterval(() => {
        const overlay = document.getElementById('lockpick-modal-overlay');
        if (!overlay || overlay.style.display === 'none') {
            clearInterval(lockpickState.holdTimer);
            return;
        }

        const diff = Math.abs(lockpickState.currentAngle - lockpickState.targetAngle);
        const inZone = diff <= lockpickState.tolerance || (360 - diff) <= lockpickState.tolerance;

        if (inZone) {
            lockpickState.holdProgress = Math.min(100, lockpickState.holdProgress + 4);
            if (lockpickState.holdProgress >= 100) {
                clearInterval(lockpickState.holdTimer);
                finishLockpickQTE(true);
            }
        } else {
            lockpickState.holdProgress = Math.max(0, lockpickState.holdProgress - 2);
        }

        updateProgressFill(lockpickState.holdProgress);
    }, 50);
}

function updateProgressFill(pct) {
    const fill = document.getElementById('lockpick-progress-fill');
    if (fill) fill.style.width = `${pct}%`;
}

function checkLockpickSuccess() {
    if (lockpickState.holdProgress >= 80) {
        finishLockpickQTE(true);
    } else {
        showToast("⚠️ 尚未對準解鎖點，強行轉動失敗！", "warn");
    }
}

function finishLockpickQTE(isSuccess) {
    if (lockpickState.holdTimer) clearInterval(lockpickState.holdTimer);
    const overlay = document.getElementById('lockpick-modal-overlay');
    if (overlay) overlay.style.display = 'none';

    if (isSuccess) {
        showToast("🔓 咔噠！鎖芯轉動成功解鎖！", "success");
        addLog("🔓 <strong>轉盤解鎖成功：</strong> 成功破譯遠古機械鎖！", "perfect");
        if (lockpickState.onSuccessCallback) lockpickState.onSuccessCallback(false);
    }
}
