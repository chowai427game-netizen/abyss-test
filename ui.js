// 7.ui.js
// ==========================================================================
// 🎨 命運深淵：DOM 渲染、介面對齊與打擊感日誌輸出 (動態節點修正版)
// ==========================================================================

function addLog(msg, type = "normal") {
    const box = document.getElementById('log-box');
    if (!box) return;
    
    let impactClass = "log-row-box";
    if (type === "perfect") impactClass += " log-perfect";
    else if (type === "deal") impactClass += " log-deal-dmg";
    else if (type === "take") impactClass += " log-take-dmg";
    else if (type === "env") impactClass += " log-env-tick";
    else if (type === "victory-badge") impactClass += " log-victory-badge"; // 👈 新增呢一行！
    
    // 💡 修正：不再使用 innerHTML +=，改用 createElement 確保 CSS @keyframes 動畫不會被後續日誌摧毀重置
    const row = document.createElement('div');
    row.className = impactClass;
    row.innerHTML = msg;
    
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
}

function translateJob(j) {
    if(j === "novice") return "初心者"; if(j === "swordsman") return "劍士";
    if(j === "magician") return "魔法師"; return "服事";
}

function switchVillageLocation(targetLoc) {
    currentVillageLocation = targetLoc;
    const locations = ["GATE", "KITCHEN", "SQUARE", "WORKSHOP"];
    
    locations.forEach(loc => {
        const panel = document.getElementById(`v-loc-${loc.toLowerCase()}`);
        const tabBtn = document.getElementById(`btn-tab-${loc.toLowerCase()}`);
        if (panel) panel.style.display = (loc === targetLoc) ? "block" : "none";
        if (tabBtn) {
            if (loc === targetLoc) tabBtn.classList.add("active");
            else tabBtn.classList.remove("active");
        }
    });

    if (targetLoc === "GATE") renderVillageJobSelectors(); 
    if (targetLoc === "KITCHEN") renderVillageCookingWorkshop(); //廚房
    if (targetLoc === "WORKSHOP") renderVillageWorkshop();// 👈 新增這一行加工！
    updateUI();
}

function renderDungeonInventoryUI() {
    const bagContainer = document.getElementById('p-dungeon-bag');
    if (!bagContainer) return;
    bagContainer.innerHTML = "";
    
    let slotWrapper = document.createElement('div');
    slotWrapper.className = "bag-slot-container";
    
    for (let i = 0; i < 2; i++) {
        let btnSlot = document.createElement('button');
        let item = currentRun.inventory[i];
        
        if (item) {
            btnSlot.className = "btn-bag-slot has-item";
            btnSlot.innerHTML = item;
            btnSlot.onclick = () => {
                if (gameState === "VILLAGE") {
                    accountMeta.warehouse[item] = (accountMeta.warehouse[item] || 0) + 1;
                    currentRun.inventory.splice(i, 1);
                    addLog(`🎒 將 [${item}] 移出出徵袋，歸還倉庫。`);
                    updateUI();
                    if(currentVillageLocation === "KITCHEN") renderVillageCookingWorkshop();
                } else if (gameState === "BATTLE") {
                    executeUseDungeonItem(item, i); // 由 game.js 提供
                }
            };
        } else {
            btnSlot.className = "btn-bag-slot";
            btnSlot.innerHTML = "[ 空 ]";
            btnSlot.disabled = true;
        }
        slotWrapper.appendChild(btnSlot);
    }
    bagContainer.appendChild(slotWrapper);
}

function renderVillageJobSelectors() {
    const container = document.getElementById('job-choices-container');
    if (!container) return;
    container.innerHTML = "";
    let jobs = ["novice", "swordsman", "magician", "acolyte"];
    jobs.forEach(j => {
        let btn = document.createElement('button');
        btn.className = `btn-game btn-job-choice ${currentRun.job === j ? 'active' : ''}`;
        let isUnlocked = accountMeta.unlockedJobs.includes(j);
        btn.innerHTML = `${translateJob(j)}<br><b>${isUnlocked ? '🟢 可選' : '🔒 封鎖'}</b>`;
        btn.disabled = !isUnlocked;
        btn.onclick = () => {
            currentRun.job = j;
            // 替換這段舊代碼
            if(j === "swordsman") { currentRun.maxMp = 50; currentRun.mpRegen = 5; currentRun.skills = { "狂擊": 1 }; currentRun.spd = 18; } /* 劍士稍慢但力大 */
            else if(j === "magician") { currentRun.maxMp = 150; currentRun.mpRegen = 20; currentRun.skills = { "火箭術": 1 }; currentRun.spd = 15; } /* 法師需詠唱最慢 */
            else if(j === "acolyte") { currentRun.maxMp = 90; currentRun.mpRegen = 10; currentRun.skills = { "治癒術": 1 }; currentRun.spd = 22; } /* 服事身輕如燕 */
            else { currentRun.maxMp = 50; currentRun.mpRegen = 15; currentRun.skills = { "緊急治療": 1 }; currentRun.spd = 20; } /* 初心者平均 */
            updateUI(); renderVillageJobSelectors();
        };
        container.appendChild(btn);
    });
}

function renderVillageCookingWorkshop() {
    const wBox = document.getElementById('village-warehouse-display');
    if (!wBox) return;
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    wBox.innerHTML = `📦 <strong>雲端永久食材倉庫存留：</strong><br>${wItems || "倉庫空空如也"}`;
    
    const rContainer = document.getElementById('recipes-container');
    if (!rContainer) return;
    rContainer.innerHTML = "";
    
    RECIPES_DATABASE.forEach(recipe => {
        let btn = document.createElement('button');
        btn.className = "btn-game btn-cook";
        let reqText = Object.keys(recipe.ingredients).map(k => `${k} x${recipe.ingredients[k]}`).join(", ");
        btn.innerHTML = `🥞 製作: <strong>${recipe.name}</strong> [需：${reqText}]<br><span style="color:#aaa;">${recipe.desc}</span>`;
        btn.disabled = !canCanCook(recipe.ingredients); // 由 game.js 提供
        btn.onclick = () => executeVillageCooking(recipe); // 由 game.js 提供
        rContainer.appendChild(btn);
        
        if (recipe.type === "dungeon_use" && (accountMeta.warehouse[recipe.name] || 0) > 0) {
            let btnEquip = document.createElement('button');
            btnEquip.className = "btn-game btn-explore";
            btnEquip.style.padding = "6px"; btnEquip.style.fontSize = "12px"; btnEquip.style.marginTop = "-5px"; btnEquip.style.marginBottom = "10px";
            btnEquip.innerHTML = `🎒 帶上 [${recipe.name}] 出擊 (庫存:${accountMeta.warehouse[recipe.name]})`;
            btnEquip.onclick = () => tryEquipItemToBag(recipe.name);
            rContainer.appendChild(btnEquip);
        }
    });

    if ((accountMeta.warehouse["🪨 焦黑的未知物體"] || 0) > 0) {
        let btnEquipBurnt = document.createElement('button');
        btnEquipBurnt.className = "btn-game btn-explore";
        btnEquipBurnt.style.padding = "6px"; btnEquipBurnt.style.fontSize = "12px"; btnEquipBurnt.style.background = "#555";
        btnEquipBurnt.innerHTML = `🎒 帶上 [🪨 焦黑的未知物體] (庫存:${accountMeta.warehouse["🪨 焦黑的未知物體"]})`;
        btnEquipBurnt.onclick = () => tryEquipItemToBag("🪨 焦黑的未知物體");
        rContainer.appendChild(btnEquipBurnt);
    }
}

// ui.js - 優化後的介面力場分流隱藏邏輯
function updateUI() {
    const toggle = (id, show) => { const el = document.getElementById(id); if(el) el.style.display = show ? "block" : "none"; };
    const envBar = document.getElementById('env-alert-bar');
    
    // 📢 1. 封面狀態：完全蒸發力場警報列
    if (gameState === "TITLE") {
        toggle('title-box', true); toggle('status-panel-box', false); toggle('village-panel-box', false); toggle('log-box', false); toggle('action-panel-box', false);
        toggle('env-alert-bar', false); /* 👈 強制隱藏 */
        document.getElementById('location-text').innerText = "🔮 命運的起點";
        return;
    }
    
    toggle('title-box', false); toggle('status-panel-box', true); toggle('log-box', true); toggle('action-panel-box', true);
    
    // 🌍 2. 地表村莊狀態：同樣全面關閉環境力場顯示，確保後勤整備的純粹性
    if (gameState === "VILLAGE") {
        toggle('village-panel-box', true); toggle('reward-panel-box', false);
        toggle('env-alert-bar', false); /* 👈 隱藏村莊內的力場條，消除玩家焦慮 */
        
        let locText = "🌍 目前位置：地表村莊";
        if(currentVillageLocation === "GATE") locText += " ➔ 🚪 傳送大殿";
        if(currentVillageLocation === "KITCHEN") locText += " ➔ 🍳 皇家料理屋";
        if(currentVillageLocation === "SQUARE") locText += " ➔ 🏛️ 中央廣場";
        if(currentVillageLocation === "WORKSHOP") locText += " ➔ 🛠️ 加工所";
        
        document.getElementById('location-text').innerText = locText;
        document.getElementById('btn-main-action').innerText = "🌀 啟動傳送門降臨深淵 B1F";
        document.getElementById('btn-main-action').disabled = false;
        
        // 隱藏重巡按鈕（村莊內不需重巡）
        const rBtn = document.getElementById('btn-rerun-action');
        if(rBtn) rBtn.style.display = "none";
        
    } else {
        // 🚨 3. 只有身處戰鬥（BATTLE/ENCOUNTER）等地下城環境，才開啟力場條
        toggle('env-alert-bar', true);
        if (envBar) {
            if (currentEnvironment === "NORMAL") { envBar.className = "env-zone-normal"; envBar.innerHTML = "✨ 當前環境力場：重力與空間表現穩定"; }
            else if (currentEnvironment === "FIRE") { envBar.className = "env-zone-fire"; envBar.innerHTML = "🌋 警告：進入【烈焰焦土地核】每回合反噬燒血！火法克制"; }
            else if (currentEnvironment === "ICE") { envBar.className = "env-zone-ice"; envBar.innerHTML = "❄️ 警告：進入【萬年永凍冰原】常駐強效治癒禁制！"; }
            else if (currentEnvironment === "POISON") { envBar.className = "env-zone-poison"; envBar.innerHTML = "🧪 警告：進入【瘴氣劇毒沼澤】引導主動技能將深度感染！"; }
            else if (currentEnvironment === "VOID") { envBar.className = "env-zone-void"; envBar.innerHTML = "🌀 警告：進入【重力虛空壓制】主動 QTE 判定時間瘋狂縮短！"; }
        }
    }
    
    // 更新基礎核心數據
    document.getElementById('p-name').innerText = accountMeta.name;
    document.getElementById('p-job').innerText = translateJob(currentRun.job);
    document.getElementById('p-lv').innerText = currentRun.lv;
    document.getElementById('p-hp').innerText = currentRun.hp;
    document.getElementById('p-maxhp').innerText = currentRun.maxHp;
    document.getElementById('p-mp').innerText = currentRun.mp;
    document.getElementById('p-maxmp').innerText = currentRun.maxMp;
    document.getElementById('p-gold').innerText = currentRun.gold;
    document.getElementById('p-block').innerText = currentRun.block;
    document.getElementById('p-crit').innerText = currentRun.critChance + "%";
    document.getElementById('p-spd').innerText = currentRun.spd; // 👈 新增這行綁定速度
    document.getElementById('p-dodge').innerText = currentRun.dodgeChance + "%";
    document.getElementById('p-exp-text').innerText = `${currentRun.exp} / ${currentRun.nextExp}`;
    document.getElementById('p-equip-weapon').innerText = accountMeta.equipment.weapon || "🎚️ 拳頭空手";
    document.getElementById('p-equip-armor').innerText = accountMeta.equipment.armor || "👕 布衣新手";
    
    document.getElementById('hp-bar-fill').style.width = (currentRun.hp / currentRun.maxHp) * 100 + "%";
    document.getElementById('mp-bar-fill').style.width = (currentRun.mp / currentRun.maxMp) * 100 + "%";
    
    let sList = Object.keys(currentRun.skills).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ");
    if(playerStatusEffects.burn > 0) sList += ` | 🔥燃燒x${playerStatusEffects.burn}`;
    if(playerStatusEffects.poison > 0) sList += ` | 🧪劇毒x${playerStatusEffects.poison}`;
    document.getElementById('p-skills-list').innerHTML = sList;
    
    renderDungeonInventoryUI();

    // 4. 地下城深層狀態分流控制
    if (gameState === "BATTLE") {
        toggle('village-panel-box', false); toggle('reward-panel-box', false);
        document.getElementById('location-text').innerText = `🚨 當前位置：地下城 B${dungeonFloor}F`;
        
        // 💡 特殊檢測：如果前進的下一層是 BOSS 關卡 (例如目前 9, 19, 29 層)，啟動雙軌安全整備按鈕
        if ((dungeonFloor + 1) % 10 === 0) {
            document.getElementById('btn-main-action').innerText = `☠️ 挑戰大領主 B${dungeonFloor + 1}F`;
            // 呼叫動態增幅函數，展開重巡按鈕
            injectRerunButtonUI();
        } else {
            document.getElementById('btn-main-action').innerText = `🪜 前進探險 B${dungeonFloor + 1}F`;
            const rBtn = document.getElementById('btn-rerun-action');
            if(rBtn) rBtn.style.display = "none";
        }
    } else if (gameState === "REWARD" || gameState === "ENCOUNTER") {
        toggle('village-panel-box', false); toggle('reward-panel-box', true);
        document.getElementById('btn-main-action').disabled = true;
        const rBtn = document.getElementById('btn-rerun-action');
        if(rBtn) rBtn.style.display = "none";
    }
}
// ui.js 尾部追加函數
function injectRerunButtonUI() {
    const rerunBtn = document.getElementById('btn-rerun-action');
    if (rerunBtn) {
        rerunBtn.style.display = "block";
        rerunBtn.disabled = false;
        rerunBtn.innerText = `🔄 重巡 B${dungeonFloor}F 安全整備`;
    }
}

// ==========================================================================
// 🛠️ ui.js 尾部追加：加工所鍛造與穿戴按鈕動態生成器
// ==========================================================================

function renderVillageWorkshop() {
    const wBox = document.getElementById('workshop-warehouse-display');
    if (!wBox) return;
    let wItems = Object.keys(accountMeta.warehouse).map(k => `${k} (x${accountMeta.warehouse[k]})`).join(" | ");
    wBox.innerHTML = `📦 <strong>雲端永久食材與裝備庫存：</strong><br>${wItems || "倉庫空空如也"}`;
    
    const bContainer = document.getElementById('blueprints-container');
    if (!bContainer) return;
    bContainer.innerHTML = "";
    
    CRAFTING_BLUEPRINTS.forEach(blueprint => {
        let btnWrapper = document.createElement('div');
        btnWrapper.style.background = "rgba(0,0,0,0.2)";
        btnWrapper.style.padding = "14px";
        btnWrapper.style.borderRadius = "12px";
        btnWrapper.style.border = "1px solid rgba(255,255,255,0.04)";
        btnWrapper.style.marginBottom = "10px";
        btnWrapper.style.textAlign = "left";

        let reqText = Object.keys(blueprint.ingredients).map(k => `${k} x${blueprint.ingredients[k]}`).join(", ");
        
        let statText = Object.keys(blueprint.stats).map(k => {
            let name = k === "atk" ? "攻擊" : k === "spd" ? "速度" : k === "mpRegen" ? "回魔" : k === "block" ? "減傷" : k === "maxHp" ? "生命" : "閃避";
            let val = blueprint.stats[k];
            return `${name} ${val > 0 ? '+' : ''}${val}`;
        }).join(", ");

        let titleHtml = `<strong style="color:#fff; font-size:14px;">${blueprint.name}</strong> <span style="color:#ffd700; font-size:11px; font-weight:bold;">[${statText}]</span>`;
        
        let infoP = document.createElement('p');
        infoP.style.margin = "0 0 10px 0";
        infoP.style.fontSize = "12px";
        infoP.style.color = "#babcbf";
        infoP.style.lineHeight = "1.5";
        infoP.innerHTML = `${titleHtml}<br>${blueprint.desc}<br><span style="color:#8e8e93; font-size:11px;">🔨 所需素材：${reqText}</span>`;
        btnWrapper.appendChild(infoP);

        // 🔘 控制鈕 1: 打造按鈕
        let btnForge = document.createElement('button');
        btnForge.className = "btn-game btn-explore";
        btnForge.style.padding = "6px 12px";
        btnForge.style.fontSize = "11px";
        btnForge.style.marginRight = "8px";
        btnForge.innerHTML = "🔨 消耗材料打造";
        btnForge.disabled = !canCanCook(blueprint.ingredients); // 複用材料檢查函數
        btnForge.onclick = () => { executeForgeEquipment(blueprint); };
        btnWrapper.appendChild(btnForge);

        // 🔘 控制鈕 2: 穿上/脫下 狀態機判定
        let isEquipped = (accountMeta.equipment.weapon === blueprint.name || accountMeta.equipment.armor === blueprint.name);
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
