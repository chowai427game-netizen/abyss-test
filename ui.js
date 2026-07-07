// ==========================================================================
// 📺 ui.js：全域介面渲染與動態分類分頁控制核心
// ==========================================================================

// 💡 追蹤當前分頁與分類狀態
let currentWorkshopType = "weapon";   // "weapon" | "armor" | "accessory"
let currentWorkshopLv = "1-10";       // "1-10" | "11-20" | "21-30" | "31-40" | "41-50"
let currentKitchenFloor = "B1-B10";    // "B1-B10" | "B11-B20" | "B21-B30" | "B31-B40" | "B41-50"

function switchVillageLocation(targetLoc) {
    currentVillageLocation = targetLoc;
    
    const panels = ['v-loc-gate', 'v-loc-kitchen', 'v-loc-workshop'];
    panels.forEach(p => {
        const el = document.getElementById(p);
        if (el) el.style.display = 'none';
    });
    
    const navTextEl = document.getElementById('v-nav-text') || document.getElementById('current-location-text');
    
    if (targetLoc === "GATE") {
        const el = document.getElementById('v-loc-gate');
        if (el) el.style.display = 'block';
        if (navTextEl) navTextEl.innerHTML = "⛺ 傳送大殿";
        renderVillageJobSelectors();
    } 
    else if (targetLoc === "KITCHEN") {
        const el = document.getElementById('v-loc-kitchen');
        if (el) el.style.display = 'block';
        if (navTextEl) navTextEl.innerHTML = "🍳 料理屋";
        renderVillageCookingWorkshop();
    } 
    else if (targetLoc === "WORKSHOP") {
        const el = document.getElementById('v-loc-workshop');
        if (el) el.style.display = 'block';
        if (navTextEl) navTextEl.innerHTML = "🛠️ 加工所";
        renderVillageWorkshop();
    }
    
    updateUI();
}

function updateUI() {
    if (gameState === "TITLE") {
        document.getElementById('screen-title').style.display = "block";
        document.getElementById('screen-village').style.display = "none";
        document.getElementById('screen-battle').style.display = "none";
        return;
    }
    
    // 數據刷新
    document.getElementById('p-name').innerText = accountMeta.name;
    document.getElementById('p-job').innerText = getJobChineseName(currentRun.job);
    document.getElementById('p-lv').innerText = currentRun.lv;
    document.getElementById('p-exp-text').innerText = `${currentRun.exp} / ${currentRun.nextExp}`;
    document.getElementById('p-hp-text').innerText = `${currentRun.hp} / ${currentRun.maxHp}`;
    document.getElementById('p-mp-text').innerText = `${currentRun.mp} / ${currentRun.maxMp}`;
    
    // 進度條控制
    document.getElementById('p-hp-bar').style.width = `${Math.max(0, (currentRun.hp / currentRun.maxHp) * 100)}%`;
    document.getElementById('p-mp-bar').style.width = `${Math.max(0, (currentRun.mp / currentRun.maxMp) * 100)}%`;
    
    document.getElementById('p-gold').innerText = currentRun.gold;
    document.getElementById('p-block').innerText = currentRun.block;
    document.getElementById('p-crit').innerText = `${currentRun.critChance}%`;
    document.getElementById('p-spd').innerText = currentRun.spd;
    document.getElementById('p-dodge').innerText = `${currentRun.dodgeChance}%`;
    
    // 裝備展示
    if(document.getElementById('p-equip-weapon')) document.getElementById('p-equip-weapon').innerText = accountMeta.equipment.weapon || "🎚️ 拳頭空手";
    if(document.getElementById('p-equip-armor')) document.getElementById('p-equip-armor').innerText = accountMeta.equipment.armor || "👕 新手衣服";
    if(document.getElementById('p-equip-accessory')) document.getElementById('p-equip-accessory').innerText = accountMeta.equipment.accessory || "📿 脖子空空";

    // 技能文字
    let skList = Object.keys(currentRun.skills).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ");
    document.getElementById('p-skills').innerText = skList || "無內能";

    // 背包快捷物資
    let bagBox = document.getElementById('p-dungeon-bag');
    if (bagBox) {
        bagBox.innerHTML = "";
        currentRun.inventory.forEach((item, index) => {
            let sBtn = document.createElement('button');
            sBtn.className = "btn-game btn-cook";
            sBtn.style.margin = "2px";
            sBtn.style.fontSize = "11px";
            sBtn.innerHTML = item;
            sBtn.onclick = () => { executeUseDungeonItem(item, index); };
            bagBox.appendChild(sBtn);
        });
        if(currentRun.inventory.length === 0) bagBox.innerHTML = "<span style='color:#666;'>[空]</span>";
    }

    if (gameState === "VILLAGE") {
        document.getElementById('screen-title').style.display = "none";
        document.getElementById('screen-village').style.display = "block";
        document.getElementById('screen-battle').style.display = "none";
        document.getElementById('btn-main-action').innerText = "🔮 啟動傳送門降臨深淵 B1F";
    } 
    else if (gameState === "BATTLE" || gameState === "ENCOUNTER" || gameState === "ENCOUNTER_RESOLVED" || gameState === "REWARD") {
        document.getElementById('screen-title').style.display = "none";
        document.getElementById('screen-village').style.display = "none";
        document.getElementById('screen-battle').style.display = "block";
        
        let actBtn = document.getElementById('btn-main-action');
        actBtn.innerText = (dungeonFloor % 10 === 0) ? `👹 討伐大領主 B${dungeonFloor}F 核心` : `⚔️ 深入突進下一層 B${dungeonFloor+1}F`;
        
        // 戰鬥怪物繪製
        let monBox = document.getElementById('monster-status-card');
        if (activeMonster) {
            monBox.style.display = "block";
            document.getElementById('m-name').innerText = activeMonster.name;
            document.getElementById('m-hp-text').innerText = `${activeMonster.hp} / ${activeMonster.maxHp}`;
            document.getElementById('m-hp-bar').style.width = `${Math.max(0, (activeMonster.hp / activeMonster.maxHp) * 100)}%`;
            document.getElementById('m-atk').innerText = activeMonster.atk;
            document.getElementById('m-spd').innerText = activeMonster.spd;
        } else {
            monBox.style.display = "none";
        }

        // 奇遇抉擇渲染
        let rewardBox = document.getElementById('reward-selection-panel');
        if (gameState === "REWARD" || gameState === "ENCOUNTER") {
            rewardBox.style.display = "block";
        } else {
            rewardBox.style.display = "none";
        }
    }
}

function getJobChineseName(j) {
    if(j === "novice") return "初心者";
    if(j === "swordsman") return "劍士";
    if(j === "magician") return "魔法師";
    if(j === "acolyte") return "服事";
    return j;
}

function addLog(msg, type = "deal") {
    let box = document.getElementById('log-box');
    if (!box) return;
    let color = "#fff";
    if (type === "take") color = "#ff4757";
    if (type === "perfect") color = "#2ecc71";
    if (type === "env") color = "#ffa500";
    if (type === "victory-badge") color = "#ffd700";
    
    let p = document.createElement('p');
    p.style.color = color;
    p.style.margin = "5px 0";
    p.style.fontSize = "13px";
    p.innerHTML = msg;
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
}

function renderVillageJobSelectors() {}

// ==========================================================================
// 🍳 料理屋分頁渲染 (按層數 B1-B10, B11-B20 等)
// ==========================================================================
function renderVillageCookingWorkshop() {
    const kBox = document.getElementById('kitchen-warehouse-display') || document.getElementById('workshop-warehouse-display');
    const container = document.getElementById('recipes-container') || document.getElementById('blueprints-container');
    if (!container) return;
    
    container.innerHTML = "";
    
    // 1. 動態繪製層數頁籤列
    let floors = ["B1-B10", "B11-B20", "B21-B30", "B31-B40", "B41-B50"];
    let tabWrapper = document.createElement('div');
    tabWrapper.style.display = "flex";
    tabWrapper.style.gap = "5px";
    tabWrapper.style.marginBottom = "15px";
    tabWrapper.style.width = "100%";
    
    floors.forEach(fl => {
        let tBtn = document.createElement('button');
        tBtn.className = (currentKitchenFloor === fl) ? "btn-game btn-cook" : "btn-game btn-rest";
        tBtn.style.padding = "4px 8px";
        tBtn.style.fontSize = "11px";
        tBtn.innerText = fl;
        tBtn.onclick = () => { currentKitchenFloor = fl; renderVillageCookingWorkshop(); };
        tabWrapper.appendChild(tBtn);
    });
    container.appendChild(tabWrapper);

    // 2. 顯示永久庫存
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    if(kBox) kBox.innerHTML = `📦 <strong>雲端永久物資庫存：</strong><br>${wItems || "倉庫空空如也"}`;

    // 3. 過濾並渲染當前層數料理
    let filteredRecipes = RECIPES_DATABASE.filter(r => r.floorRange === currentKitchenFloor);
    
    if(filteredRecipes.length === 0) {
        let p = document.createElement('p');
        p.style.color = "#666";
        p.style.padding = "20px";
        p.innerText = "🧙 該層數配方尚在通訊重構中...";
        container.appendChild(p);
        return;
    }

    filteredRecipes.forEach(recipe => {
        let card = document.createElement('div');
        card.style.background = "rgba(0,0,0,0.2)";
        card.style.padding = "12px";
        card.style.borderRadius = "10px";
        card.style.marginBottom = "8px";
        card.style.textAlign = "left";
        card.style.width = "100__%";

        let reqText = Object.keys(recipe.ingredients).map(k => `${k} x${recipe.ingredients[k]}`).join(", ");
        card.innerHTML = `<strong style="color:#fff;">${recipe.name}</strong><br><span style="color:#aaa; font-size:12px;">${recipe.desc}</span><br><span style="color:#8e8e93; font-size:11px;">🌾 素材需求：${reqText}</span><br>`;

        let canCook = true;
        for (let ing in recipe.ingredients) {
            if ((accountMeta.warehouse[ing] || 0) < recipe.ingredients[ing]) canCook = false;
        }

        let cBtn = document.createElement('button');
        cBtn.className = "btn-game btn-cook";
        cBtn.style.marginTop = "6px";
        cBtn.style.padding = "4px 10px";
        cBtn.style.fontSize = "11px";
        cBtn.innerText = recipe.type === "village_eat" ? "🍴 開局烹飪進食" : "🎒 製作局內快捷物資";
        cBtn.disabled = !canCook;
        cBtn.onclick = () => { executeVillageCooking(recipe); };
        card.appendChild(cBtn);

        container.appendChild(card);
    });
}

// ==========================================================================
// 🛠️ 加工所分頁渲染 (雙軌制：按分類 + 按 LV 級別)
// ==========================================================================
function renderVillageWorkshop() {
    const wBox = document.getElementById('workshop-warehouse-display');
    const bContainer = document.getElementById('blueprints-container');
    if (!bContainer) return;
    
    bContainer.innerHTML = "";
    
    // 1. 頂部雙軌：第一層頁籤 ——「裝備分類」
    let typeWrapper = document.createElement('div');
    typeWrapper.style.display = "flex";
    typeWrapper.style.gap = "8px";
    typeWrapper.style.marginBottom = "8px";
    typeWrapper.style.width = "100%";
    
    let types = [
        { id: "weapon", name: "🗡️ 武器藍圖" },
        { id: "armor", name: "🛡️ 防具藍圖" },
        { id: "accessory", name: "💍 飾品部隊" }
    ];
    
    types.forEach(t => {
        let btn = document.createElement('button');
        btn.className = (currentWorkshopType === t.id) ? "btn-game btn-rerun" : "btn-game btn-rest";
        btn.style.padding = "5px 10px";
        btn.style.fontSize = "11px";
        btn.innerText = t.name;
        btn.onclick = () => { currentWorkshopType = t.id; renderVillageWorkshop(); };
        typeWrapper.appendChild(btn);
    });
    bContainer.appendChild(typeWrapper);

    // 2. 頂部雙軌：第二層頁籤 ——「等級區間分頁」
    let lvWrapper = document.createElement('div');
    lvWrapper.style.display = "flex";
    lvWrapper.style.gap = "5px";
    lvWrapper.style.marginBottom = "15px";
    lvWrapper.style.width = "100%";
    lvWrapper.style.borderTop = "1px solid rgba(255,255,255,0.05)";
    lvWrapper.style.paddingTop = "8px";
    
    let lvs = ["1-10", "11-20", "21-30", "31-40", "41-50"];
    lvs.forEach(l => {
        let btn = document.createElement('button');
        btn.className = (currentWorkshopLv === l) ? "btn-game btn-explore" : "btn-game btn-rest";
        btn.style.padding = "3px 8px";
        btn.style.fontSize = "11px";
        btn.innerText = `Lv.${l}`;
        btn.onclick = () => { currentWorkshopLv = l; renderVillageWorkshop(); };
        lvWrapper.appendChild(btn);
    });
    bContainer.appendChild(lvWrapper);

    // 3. 顯示永久庫存
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    if (wBox) wBox.innerHTML = `📦 <strong>雲端永久食材與裝備庫存：</strong><br>${wItems || "倉庫空空如也"}`;
    
    // 4. 【雙重過濾】同時匹配 分類 且 匹配 等級區間
    let filteredBlueprints = CRAFTING_BLUEPRINTS.filter(b => b.type === currentWorkshopType && b.levelRange === currentWorkshopLv);
    
    if (filteredBlueprints.length === 0) {
        let p = document.createElement('p');
        p.style.color = "#555";
        p.style.padding = "20px";
        p.style.fontSize = "12px";
        p.innerText = "🔨 該級別無此分類神裝，等待神匠開拓藍圖...";
        bContainer.appendChild(p);
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
        infoP.style.margin = "0 0 10px 0";
        infoP.style.fontSize = "12px";
        infoP.style.color = "#babcbf";
        infoP.style.lineHeight = "1.5";
        infoP.innerHTML = `${titleHtml}<br>${blueprint.desc}<br><span style="color:#8e8e93; font-size:11px;">🔨 所需素材：${reqText}</span>`;
        btnWrapper.appendChild(infoP);

        let canForge = true;
        for (let ing in blueprint.ingredients) {
            if ((accountMeta.warehouse[ing] || 0) < blueprint.ingredients[ing]) canForge = false;
        }

        let btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.padding = "6px 12px";
        btnForge.style.fontSize = "11px";
        btnForge.style.marginRight = "8px";
        btnForge.innerHTML = "🔨 消耗材料打造";
        btnForge.disabled = !canForge; 
        btnForge.onclick = () => { executeForgeEquipment(blueprint); };
        btnWrapper.appendChild(btnForge);

        let isEquipped = (accountMeta.equipment.weapon === blueprint.name || accountMeta.equipment.armor === blueprint.name || accountMeta.equipment.accessory === blueprint.name);
        let hasInWarehouse = (accountMeta.warehouse[blueprint.name] || 0) > 0;

        if (isEquipped) {
            let btnUnequip = document.createElement('button');
            btnUnequip.className = "btn-game btn-rest";
            btnUnequip.style.padding = "6px 12px";
            btnUnequip.style.fontSize = "11px";
            btnUnequip.innerHTML = "❌ 卸下神裝";
            btnUnequip.onclick = () => { executeEquipAction(blueprint.name, "unequip"); };
            btnWrapper.appendChild(btnUnequip);
        } else if (hasInWarehouse) {
            let btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-rerun";
            btnEquip.style.padding = "6px 12px";
            btnEquip.style.fontSize = "11px";
            btnEquip.innerHTML = "⚡ 穿戴上身";
            btnEquip.onclick = () => { executeEquipAction(blueprint.name, "equip"); };
            btnWrapper.appendChild(btnEquip);
        }

        bContainer.appendChild(btnWrapper);
    });
}

// ==========================================================================
// 🎛️ ui.js 尾部追加：多維度動態分頁與交互式高亮切換矩陣
// ==========================================================================

// 1. 全域動態篩選狀態計數器
let activeCookingRange = "1-10";
let activeCraftingCategory = "all";
let activeCraftingLvlRange = "1-10";

// 2. 料理屋分頁切換與按鈕高亮驅動
function changeCookingTab(selectedRange) {
    activeCookingRange = selectedRange;
    
    // 遍歷料理屋容器內的所有 Button，進行高亮樣式重置
    const container = document.getElementById('v-loc-kitchen');
    if (container) {
        const btns = container.querySelectorAll('.tab-filter-row button');
        btns.forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${selectedRange}'`)) {
                btn.className = "btn-game btn-rerun"; // 高亮耀金
            } else {
                btn.className = "btn-game btn-rest";  // 暗色沉澱
            }
        });
    }
    renderVillageCookingWorkshop();
}

// 3. 加工所部位類別切換驅動
function changeCraftingCat(selectedCat) {
    activeCraftingCategory = selectedCat;
    
    const row = document.getElementById('workshop-cat-row');
    if (row) {
        const btns = row.querySelectorAll('button');
        btns.forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${selectedCat}'`)) {
                btn.className = "btn-game btn-rerun";
            } else {
                btn.className = "btn-game btn-rest";
            }
        });
    }
    renderVillageWorkshop();
}

// 4. 加工所需求等級範圍切換驅動
function changeCraftingLvl(selectedLvl) {
    activeCraftingLvlRange = selectedLvl;
    
    const row = document.getElementById('workshop-lvl-row');
    if (row) {
        const btns = row.querySelectorAll('button');
        btns.forEach(btn => {
            if (btn.getAttribute('onclick').includes(`'${selectedLvl}'`)) {
                btn.className = "btn-game btn-rerun";
            } else {
                btn.className = "btn-game btn-rest";
            }
        });
    }
    renderVillageWorkshop();
}

// 5. 複寫與升級原有的料理屋渲染器 (注入層數過濾功能)
function renderVillageCookingWorkshop() {
    const wBox = document.getElementById('kitchen-warehouse-display');
    if (!wBox) return;
    
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    wBox.innerHTML = `📦 <strong>當前倉庫現存食材：</strong><br>${wItems || "暫無任何行軍素材"}`;
    
    const rContainer = document.getElementById('recipes-container');
    if (!rContainer) return;
    rContainer.innerHTML = "";

    // 💡 關鍵：只篩選出與當前激活分頁範圍相符合的料理
    const filteredRecipes = RECIPES_DATABASE.filter(r => r.range === activeCookingRange);

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
        btnCook.innerHTML = recipe.type === "village_eat" ? "🍴 當場進食獲得長效 Buff" : "🍳 烹飪納入戰術背包";
        btnCook.disabled = !hasIngredients;
        btnCook.onclick = () => { executeVillageCooking(recipe); };
        
        card.appendChild(btnCook);
        rContainer.appendChild(card);
    });
}

// 6. 複寫與升級原有的加工所渲染器 (注入類別 + 等級範圍雙重交叉過濾功能)
function renderVillageWorkshop() {
    const wBox = document.getElementById('workshop-warehouse-display');
    if (!wBox) return;
    
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    wBox.innerHTML = `📦 <strong>雲端永久素材與裝備庫存：</strong><br>${wItems || "倉庫空空如也"}`;
    
    const bContainer = document.getElementById('blueprints-container');
    if (!bContainer) return;
    bContainer.innerHTML = "";
    
    // 💡 核心雙軌交叉過濾算法：同時核對 category 類別與 levelRange 等級段
    const filteredBlueprints = CRAFTING_BLUEPRINTS.filter(b => {
        const matchCat = (activeCraftingCategory === "all" || b.type === activeCraftingCategory);
        const matchLvl = (b.range === activeCraftingLvlRange);
        return matchCat && matchLvl;
    });

    if (filteredBlueprints.length === 0) {
        bContainer.innerHTML = `<div style="color:#666; font-size:12px; padding:20px; width:100%; text-align:center;">🔍 該篩選條件下，皇家大圖書館暫未記載任何神裝藍圖。</div>`;
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
        infoP.style.margin = "0 0 10px 0";
        infoP.style.fontSize = "12px";
        infoP.style.color = "#babcbf";
        infoP.style.lineHeight = "1.5";
        infoP.innerHTML = `${titleHtml}<br>${blueprint.desc}<br><span style="color:#8e8e93; font-size:11px;">🔨 所需素材：${reqText}</span>`;
        btnWrapper.appendChild(infoP);

        let canForge = true;
        for (let ing in blueprint.ingredients) {
            if ((accountMeta.warehouse[ing] || 0) < blueprint.ingredients[ing]) {
                canForge = false;
            }
        }

        // 🔘 控制鈕 1: 打造按鈕
        let btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.padding = "6px 12px";
        btnForge.style.fontSize = "11px";
        btnForge.style.marginRight = "8px";
        btnForge.innerHTML = "🔨 消耗材料打造";
        btnForge.disabled = !canForge; 
        btnForge.onclick = () => { executeForgeEquipment(blueprint); };
        btnWrapper.appendChild(btnForge);

        // 🔘 控制鈕 2: 穿上/脫下 狀態機判定
        let isEquipped = (accountMeta.equipment.weapon === blueprint.name || accountMeta.equipment.armor === blueprint.name || accountMeta.equipment.accessory === blueprint.name);
        let hasInWarehouse = (accountMeta.warehouse[blueprint.name] || 0) > 0;

        if (isEquipped) {
            let btnUnequip = document.createElement('button');
            btnUnequip.className = "btn-game btn-rest";
            btnUnequip.style.padding = "6px 12px";
            btnUnequip.style.fontSize = "11px";
            btnUnequip.innerHTML = "❌ 卸下神裝";
            btnUnequip.onclick = () => { executeEquipAction(blueprint.name, "unequip"); };
            btnWrapper.appendChild(btnUnequip);
        } else if (hasInWarehouse) {
            let btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-rerun";
            btnEquip.style.padding = "6px 12px";
            btnEquip.style.fontSize = "11px";
            btnEquip.innerHTML = "⚡ 穿戴上身";
            btnEquip.onclick = () => { executeEquipAction(blueprint.name, "equip"); };
            btnWrapper.appendChild(btnEquip);
        }

        bContainer.appendChild(btnWrapper);
    });
}
