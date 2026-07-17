// ==========================================================================
// 📺 ui.js：分頁渲染、部位星級精煉台、裝備拆解及 QTE 面板同步核心 (修復優化版)
// ==========================================================================

const DOM = {
    isInitialized: false,
    elements: {},
    init() {
        if (this.isInitialized) return;
        const keys = [
            'p-name', 'p-job', 'p-lv', 'p-exp-text', 'p-hp', 'p-maxhp', 'p-mp', 'p-maxmp',
            'hp-bar-fill', 'mp-bar-fill', 'p-atb-row', 'p-atb-text', 'p-atb-bar-fill',
            'p-gold', 'p-block', 'p-crit', 'p-spd', 'p-dodge', 'p-skills-list', 'p-dungeon-bag',
            'p-equip-weapon', 'p-equip-armor', 'p-equip-accessory', 'btn-main-action',
            'btn-rerun-action', 'btn-secondary-action', 'btn-auto-battle', 'env-alert-bar',
            'monster-status-card', 'm-name', 'm-hp-text', 'm-hp-bar', 'm-atb-row', 'm-atb-text',
            'm-atb-bar-fill', 'm-atk', 'm-spd', 'reward-panel-box', 'log-box', 'title-box',
            'status-panel-box', 'action-panel-box', 'village-panel-box', 'log-wrapper-box'
        ];
        keys.forEach(key => {
            this.elements[key] = document.getElementById(key);
        });
        this.isInitialized = true;
    },
    get(key) {
        if (!this.isInitialized) this.init();
        return this.elements[key];
    }
};

// 全域過濾器狀態機
let activeCookingRange = "1-10";
let activeCraftingCategory = "all";
let activeCraftingLvlRange = "1-10";

/**
 * 🗺️ 地表村莊區域分流切換核心
 */
function switchVillageLocation(targetLoc) {
    currentVillageLocation = targetLoc;
    
    const panels = ['v-loc-gate', 'v-loc-kitchen', 'v-loc-workshop', 'v-loc-square'];
    panels.forEach(p => {
        const el = document.getElementById(p);
        if (el) el.style.display = 'none';
    });
    
    const tabs = { 
        'GATE': 'btn-tab-gate', 
        'KITCHEN': 'btn-tab-kitchen', 
        'SQUARE': 'btn-tab-square', 
        'WORKSHOP': 'btn-tab-workshop' 
    };
    
    Object.keys(tabs).forEach(k => {
        const tBtn = document.getElementById(tabs[k]);
        if (tBtn) {
            if (k === targetLoc) tBtn.classList.add('active');
            else tBtn.classList.remove('active');
        }
    });
    
    const locTextEl = document.getElementById('location-text');
    if (targetLoc === "GATE") {
        const el = document.getElementById('v-loc-gate'); if (el) el.style.display = 'block';
        if (locTextEl) locTextEl.innerHTML = "⛺ 地表村莊 ➔ 傳送大殿";
        renderVillageJobSelectors();
    } 
    else if (targetLoc === "KITCHEN") {
        const el = document.getElementById('v-loc-kitchen'); if (el) el.style.display = 'block';
        if (locTextEl) locTextEl.innerHTML = "🍳 地表村莊 ➔ 皇家料理屋";
        renderVillageCookingWorkshop();
    } 
    else if (targetLoc === "SQUARE") {
        const el = document.getElementById('v-loc-square'); if (el) el.style.display = 'block';
        if (locTextEl) locTextEl.innerHTML = "🏛️ 地表村莊 ➔ 中央廣場";
    }
    else if (targetLoc === "WORKSHOP") {
        const el = document.getElementById('v-loc-workshop'); if (el) el.style.display = 'block';
        if (locTextEl) locTextEl.innerHTML = "🛠️ 地表村莊 ➔ 魔導加工所";
        renderVillageWorkshop();
    }
    
    updateUI();
}

/**
 * 🔄 遊戲全局狀態機 UI 刷新渲染引擎
 */
function updateUI() {
    const titleBox = document.getElementById('title-box');
    const statusBox = document.getElementById('status-panel-box');
    const actionBox = document.getElementById('action-panel-box');
    const villageBox = document.getElementById('village-panel-box');
    const rewardBox = document.getElementById('reward-panel-box');
    const logBox = document.getElementById('log-box');
    const envBar = document.getElementById('env-alert-bar');
    const autoBtn = document.getElementById('btn-auto-battle');
    const logWrapper = document.getElementById('log-wrapper-box');

    // ==========================================
    // ⛺ 狀態 A：當前勇者在地表村莊
    // ==========================================
    if (gameState === "VILLAGE") {
        if (titleBox) titleBox.style.display = "none"; // ✨ 已修正：移除原來的 style.style.display 語法錯誤
        if (statusBox) statusBox.style.display = "grid";
        if (actionBox) actionBox.style.display = "flex";
        if (villageBox) villageBox.style.display = "block";
        if (rewardBox) rewardBox.style.display = "none";
        
        if (logWrapper) logWrapper.style.display = "block"; // ✨ 已修正：保持開啟，讓村莊清除加載遮罩後的日誌能正常渲染
        if (envBar) envBar.style.display = "none";
        if (autoBtn) autoBtn.style.display = "none";
        
        // 確保變陣抽屜在回到村莊時自動關閉收回
        const drawer = document.getElementById('tactics-drawer-box');
        if (drawer) drawer.classList.remove('expanded');
        
        const mainActionBtn = document.getElementById('btn-main-action');
        if (mainActionBtn) {
            mainActionBtn.innerText = "🔮 啟動傳送門降臨深淵 B1F";
            mainActionBtn.disabled = false; 
        }
        const rerunBtn = document.getElementById('btn-rerun-action');
        if (rerunBtn) rerunBtn.style.display = "none";
        
        // 驅動數據同步
        syncCharacterDataUi();
        return; // ⛺ 阻斷村莊渲染，防止混入地下城邏輯
    }
    
    // ==========================================
    // ⚔️ 狀態 B：當前勇者在地下城深淵戰鬥中
    // ==========================================
    if (titleBox) titleBox.style.display = "none";
    if (statusBox) statusBox.style.display = "grid";
    if (actionBox) actionBox.style.display = "flex";
    if (villageBox) villageBox.style.display = "none";
    if (logBox) logBox.style.display = "block";
    if (logWrapper) logWrapper.style.display = "block"; 
    if (envBar) envBar.style.display = "block";
    if (autoBtn) autoBtn.style.display = "block"; 
    
    let actBtn = document.getElementById('btn-main-action');
    if (actBtn) {
        actBtn.innerText = (dungeonFloor % 10 === 0) ? `👹 討伐大領主 B${dungeonFloor}F 核心` : `⚔️ 深入突進下一層 B${dungeonFloor+1}F`;
    }
    let rerunBtn = document.getElementById('btn-rerun-action');
    if (rerunBtn) {
        rerunBtn.style.display = (dungeonFloor > 0 && (dungeonFloor + 1) % 10 === 0) ? "block" : "none";
    }

    if (envBar && ENVIRONMENT_DATABASE[currentEnvironment]) {
        envBar.className = ENVIRONMENT_DATABASE[currentEnvironment].className;
        envBar.innerHTML = `${ENVIRONMENT_DATABASE[currentEnvironment].logText} (B${dungeonFloor}F)`;
    }

    let monBox = document.getElementById('monster-status-card');
    if (activeMonster && monBox) {
        monBox.style.display = "block";
        document.getElementById('m-name').innerText = activeMonster.name;
        document.getElementById('m-hp-text').innerText = `${activeMonster.hp} / ${activeMonster.maxHp}`;
        document.getElementById('m-hp-bar').style.width = `${Math.max(0, (activeMonster.hp / activeMonster.maxHp) * 100)}%`;
        document.getElementById('m-atk').innerText = activeMonster.atk;
        document.getElementById('m-spd').innerText = activeMonster.spd;

        const mAtbRow = document.getElementById('m-atb-row');
        if (mAtbRow) {
            mAtbRow.style.display = "block";
            let mAtbPercent = Math.min(100, Math.max(0, monsterAtb));
            const mAtbText = document.getElementById('m-atb-text');
            const mAtbBar = document.getElementById('m-atb-bar-fill');
            if (mAtbText) mAtbText.innerText = Math.floor(mAtbPercent);
            if (mAtbBar) mAtbBar.style.width = `${mAtbPercent}%`;
        }
    } else if (monBox) {
        monBox.style.display = "none";
        const mAtbRow = document.getElementById('m-atb-row');
        if (mAtbRow) mAtbRow.style.display = "none";
    }

    if (rewardBox) {
        rewardBox.style.display = (gameState === "REWARD" || gameState === "ENCOUNTER") ? "block" : "none";
    }
    
    // 驅動數據同步
    syncCharacterDataUi();
}

/**
 * 👤 核心數據更新面板 (紙娃娃裝備星級適應)
 */
function syncCharacterDataUi() {
    document.getElementById('p-name').innerText = accountMeta.name;
    document.getElementById('p-job').innerText = getJobChineseName(currentRun.job);
    document.getElementById('p-lv').innerText = currentRun.lv;
    document.getElementById('p-exp-text').innerText = `${currentRun.exp} / ${currentRun.nextExp}`;
    document.getElementById('p-hp').innerText = currentRun.hp;
    document.getElementById('p-maxhp').innerText = currentRun.maxHp;
    document.getElementById('p-mp').innerText = currentRun.mp;
    document.getElementById('p-maxmp').innerText = currentRun.maxMp;
    
    document.getElementById('hp-bar-fill').style.width = `${Math.max(0, (currentRun.hp / currentRun.maxHp) * 100)}%`;
    document.getElementById('mp-bar-fill').style.width = `${Math.max(0, (currentRun.mp / currentRun.maxMp) * 100)}%`;
    
    const pAtbRow = document.getElementById('p-atb-row');
    if (pAtbRow) {
        if (gameState === "VILLAGE") {
            pAtbRow.style.display = "none";
        } else {
            pAtbRow.style.display = "block";
            let pAtbPercent = Math.min(100, Math.max(0, playerAtb));
            document.getElementById('p-atb-text').innerText = Math.floor(pAtbPercent);
            document.getElementById('p-atb-bar-fill').style.width = `${pAtbPercent}%`;
        }
    }

    document.getElementById('p-gold').innerText = currentRun.gold;
    document.getElementById('p-block').innerText = currentRun.block;
    document.getElementById('p-crit').innerText = `${currentRun.critChance}%`;
    document.getElementById('p-spd').innerText = currentRun.spd;
    document.getElementById('p-dodge').innerText = `${currentRun.dodgeChance}%`;
    
    let skList = Object.keys(currentRun.skills).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ");
    const skillListEl = document.getElementById('p-skills-list');
    if (skillListEl) skillListEl.innerText = skList || "基本打擊";
    
    let wStar = accountMeta.equipmentStars.weapon > 0 ? ` [⭐x${accountMeta.equipmentStars.weapon}]` : "";
    let aStar = accountMeta.equipmentStars.armor > 0 ? ` [⭐x${accountMeta.equipmentStars.armor}]` : "";
    let cStar = accountMeta.equipmentStars.accessory > 0 ? ` [⭐x${accountMeta.equipmentStars.accessory}]` : "";

    const slotWeapon = document.getElementById('p-equip-weapon');
    const slotArmor = document.getElementById('p-equip-armor');
    const slotAccessory = document.getElementById('p-equip-accessory');

    if (slotWeapon) slotWeapon.innerText = (accountMeta.equipment.weapon || "空手") + wStar;
    if (slotArmor) slotArmor.innerText = (accountMeta.equipment.armor || "布衣") + aStar;
    if (slotAccessory) slotAccessory.innerText = (accountMeta.equipment.accessory || "無") + cStar;
    
    let bagBox = document.getElementById('p-dungeon-bag');
    if (bagBox) {
        bagBox.innerHTML = "";
        currentRun.inventory.forEach((item, index) => {
            let sBtn = document.createElement('button');
            sBtn.className = "btn-game btn-cook";
            sBtn.style.margin = "2px 4px";
            sBtn.style.padding = "4px 8px";
            sBtn.style.fontSize = "11px";
            sBtn.innerHTML = item;
            sBtn.onclick = () => { executeUseDungeonItem(item, index); };
            bagBox.appendChild(sBtn);
        });
        if (currentRun.inventory.length === 0) bagBox.innerHTML = "<span style='color:#666;'>[空]</span>";
    }
}

function getJobChineseName(j) {
    if (j === "novice") return "初心者";
    if (j === "swordsman") return "劍士";
    if (j === "magician") return "魔法師";
    if (j === "acolyte") return "服事";
    return j;
}

function changeCookingTab(selectedRange) {
    activeCookingRange = selectedRange;
    const container = document.getElementById('v-loc-kitchen');
    if (container) {
        const btns = container.querySelectorAll('.tab-filter-row button');
        btns.forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${selectedRange}'`)) btn.className = "btn-game btn-rerun";
            else btn.className = "btn-game btn-rest";
        });
    }
    renderVillageCookingWorkshop();
}

function changeCraftingCat(selectedCat) {
    activeCraftingCategory = selectedCat;
    const row = document.getElementById('workshop-cat-row');
    if (row) {
        const btns = row.querySelectorAll('button');
        btns.forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${selectedCat}'`)) btn.className = "btn-game btn-rerun";
            else btn.className = "btn-game btn-rest";
        });
    }
    renderVillageWorkshop();
}

function changeCraftingLvl(selectedLvl) {
    activeCraftingLvlRange = selectedLvl;
    const row = document.getElementById('workshop-lvl-row');
    if (row) {
        const btns = row.querySelectorAll('button');
        btns.forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${selectedLvl}'`)) btn.className = "btn-game btn-rerun";
            else btn.className = "btn-game btn-rest";
        });
    }
    renderVillageWorkshop();
}

function renderVillageCookingWorkshop() {
    const wBox = document.getElementById('kitchen-warehouse-display');
    if (!wBox) return;
    
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    wBox.innerHTML = `📦 <strong>當前倉庫現存食材：</strong><br>${wItems || "暫無任何行軍素材"}`;
    
    const rContainer = document.getElementById('recipes-container');
    if (!rContainer) return;
    rContainer.innerHTML = "";

    const filteredRecipes = RECIPES_DATABASE.filter(r => r.range === activeCookingRange);

    if (filteredRecipes.length === 0) {
        rContainer.innerHTML = `<div style="color:#555; font-size:12px; padding:15px; width:100%; text-align:center;">🌿 該層數配方尚在通訊重構成形中...</div>`;
        return;
    }

    filteredRecipes.forEach(recipe => {
        let card = document.createElement('div');
        card.style.background = "rgba(0,0,0,0.25)";
        card.style.padding = "12px";
        card.style.borderRadius = "10px";
        card.style.border = "1px solid rgba(255,255,255,0.03)";
        card.style.marginBottom = "8px";
        card.style.width = "100%";
        card.style.textAlign = "left";

        let ingList = Object.keys(recipe.ingredients).map(k => `${k} x${recipe.ingredients[k]}`).join(", ");
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

        let btnCook = document.createElement('button');
        btnCook.className = "btn-game btn-cook";
        btnCook.style.padding = "4px 10px";
        btnCook.style.fontSize = "11px";
        btnCook.innerHTML = recipe.type === "village_eat" ? "🍴 當場進食獲得長效 Buff" : "🍳 烹飪納入快捷欄";
        btnCook.disabled = !hasIngredients;
        btnCook.onclick = () => { executeVillageCooking(recipe); };
        
        card.appendChild(btnCook);
        rContainer.appendChild(card);
    });
}

function renderStarUpRow(slot, displayName, currentStar) {
    let starsStr = "⭐".repeat(currentStar) + "☆".repeat(5 - currentStar);
    let upgradeBtn = "";
    
    if (currentStar >= 5) {
        upgradeBtn = `<span style="color: #ffd700; font-size: 11px; font-weight: bold;">[已臻滿星]</span>`;
    } else {
        let cost = getStarUpCost(slot, currentStar);
        let costText = Object.keys(cost).map(k => `${k} x${cost[k]}`).join(", ");
        
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
    const wBox = document.getElementById('workshop-warehouse-display');
    if (!wBox) return;
    
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    wBox.innerHTML = `📦 <strong>雲端永久素材與裝備庫存：</strong><br>${wItems || "倉庫空空如也"}`;
    
    const bContainer = document.getElementById('blueprints-container');
    if (!bContainer) return;
    bContainer.innerHTML = "";
    
    let starPanel = document.createElement('div');
    starPanel.className = "dynamic-panel reward-style";
    starPanel.style.border = "1px solid rgba(212, 175, 55, 0.4)";
    starPanel.style.background = "rgba(15, 13, 10, 0.5)";
    starPanel.style.marginBottom = "15px";
    starPanel.style.padding = "12px";
    starPanel.style.width = "100%";
    
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

    const filteredBlueprints = CRAFTING_BLUEPRINTS.filter(b => {
        const matchCat = (activeCraftingCategory === "all" || b.type === activeCraftingCategory);
        const matchLvl = (b.range === activeCraftingLvlRange);
        return matchCat && matchLvl;
    });

    if (filteredBlueprints.length === 0) {
        let emptyDiv = document.createElement('div');
        emptyDiv.innerHTML = `<div style="color:#555; font-size:12px; padding:20px; width:100%; text-align:center;">🔨 該級別無此分類神裝，等待神匠開拓藍圖...</div>`;
        bContainer.appendChild(emptyDiv);
        return;
    }

    filteredBlueprints.forEach(blueprint => {
        let btnWrapper = document.createElement('div');
        btnWrapper.style.background = "rgba(0,0,0,0.2)";
        btnWrapper.style.padding = "14px";
        btnWrapper.style.borderRadius = "12px";
        btnWrapper.style.border = "1px solid rgba(255,255,255,0.04)";
        btnWrapper.style.marginBottom = "10px";
        btnWrapper.style.textAlign = "left";
        btnWrapper.style.width = "100%";

        let reqText = Object.keys(blueprint.ingredients).map(k => `${k} x${blueprint.ingredients[k]}`).join(", ");
        let statText = Object.keys(blueprint.stats).map(k => {
            let name = k === "atk" ? "攻擊" : k === "spd" ? "速度" : k === "mpRegen" ? "回魔" : k === "block" ? "減傷" : k === "maxHp" ? "生命" : "閃避";
            return `${name} ${blueprint.stats[k] > 0 ? '+' : ''}${blueprint.stats[k]}`;
        }).join(", ");

        let titleHtml = `<strong style="color:#fff; font-size:14px;">${blueprint.name}</strong> <span style="color:#ffd700; font-size:11px; font-weight:bold;">[${statText}]</span>`;
        let infoP = document.createElement('p');
        infoP.style.margin = "0 0 10px 0"; infoP.style.fontSize = "12px"; infoP.style.color = "#babcbf"; infoP.style.lineHeight = "1.5";
        infoP.innerHTML = `${titleHtml}<br>${blueprint.desc}<br><span style="color:#8e8e93; font-size:11px;">🔨 所需素材：${reqText}</span>`;
        btnWrapper.appendChild(infoP);

        let canForge = true;
        for (let ing in blueprint.ingredients) {
            if ((accountMeta.warehouse[ing] || 0) < blueprint.ingredients[ing]) canForge = false;
        }

        let btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.padding = "6px 12px"; btnForge.style.fontSize = "11px"; btnForge.style.marginRight = "8px";
        btnForge.innerHTML = "🔨 消耗材料打造";
        btnForge.disabled = !canForge; 
        btnForge.onclick = () => { executeForgeEquipment(blueprint); };
        btnWrapper.appendChild(btnForge);

        let isEquipped = (accountMeta.equipment.weapon === blueprint.name || accountMeta.equipment.armor === blueprint.name || accountMeta.equipment.accessory === blueprint.name);
        let hasInWarehouse = (accountMeta.warehouse[blueprint.name] || 0) > 0;

        if (isEquipped) {
            let btnUnequip = document.createElement('button');
            btnUnequip.className = "btn-game btn-rest"; btnUnequip.style.padding = "6px 12px"; btnUnequip.style.fontSize = "11px";
            btnUnequip.innerHTML = "❌ 卸下神裝";
            btnUnequip.onclick = () => { executeEquipAction(blueprint.name, "unequip"); };
            btnWrapper.appendChild(btnUnequip);
        } else if (hasInWarehouse) {
            let btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-rerun"; btnEquip.style.padding = "6px 12px"; btnEquip.style.fontSize = "11px";
            btnEquip.innerHTML = "⚡ 穿戴上身";
            btnEquip.onclick = () => { executeEquipAction(blueprint.name, "equip"); };
            btnWrapper.appendChild(btnEquip);

            let btnDismantle = document.createElement('button');
            btnDismantle.className = "btn-game btn-rest"; 
            btnDismantle.style.padding = "6px 12px"; btnDismantle.style.fontSize = "11px"; btnDismantle.style.marginLeft = "6px";
            btnDismantle.style.background = "linear-gradient(135deg, #c0392b 0%, #962d00 100%) !important";
            btnDismantle.innerHTML = "♻️ 拆解回收";
            btnDismantle.onclick = () => { executeDismantle(blueprint.name); };
            btnWrapper.appendChild(btnDismantle);
        }

        bContainer.appendChild(btnWrapper);
    });
}

function renderVillageJobSelectors() {}

/**
 * 📜 魔導日誌列印核心
 */
function addLog(msg, type = "deal") {
    let box = document.getElementById('log-box');
    if (!box) return;
    let className = "log-row-box";
    if (type === "take") className += " log-take-dmg";
    if (type === "perfect") className += " log-perfect";
    if (type === "env") className += " log-env-tick";
    if (type === "victory-badge") className += " log-victory-badge";
    
    let p = document.createElement('div');
    p.className = className;
    p.innerHTML = msg;
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
}
