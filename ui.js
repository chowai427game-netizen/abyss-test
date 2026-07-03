// ==========================================================================
// 🎨 命運深淵：DOM 渲染、介面對齊與打擊感日誌輸出
// ==========================================================================

function addLog(msg, type = "normal") {
    const box = document.getElementById('log-box');
    if (!box) return;
    
    let impactClass = "log-row-box";
    if (type === "perfect") impactClass += " log-perfect";
    else if (type === "deal") impactClass += " log-deal-dmg";
    else if (type === "take") impactClass += " log-take-dmg";
    else if (type === "env") impactClass += " log-env-tick";
    
    box.innerHTML += `<div class="${impactClass}">${msg}</div>`;
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
    if (targetLoc === "KITCHEN") renderVillageCookingWorkshop();
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
            if(j === "swordsman") { currentRun.maxMp = 50; currentRun.mpRegen = 5; currentRun.skills = { "狂擊": 1 }; }
            else if(j === "magician") { currentRun.maxMp = 150; currentRun.mpRegen = 20; currentRun.skills = { "火箭術": 1 }; }
            else if(j === "acolyte") { currentRun.maxMp = 90; currentRun.mpRegen = 10; currentRun.skills = { "治癒術": 1 }; }
            else { currentRun.maxMp = 50; currentRun.mpRegen = 15; currentRun.skills = { "緊急治療": 1 }; }
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

function updateUI() {
    const toggle = (id, show) => { const el = document.getElementById(id); if(el) el.style.display = show ? "block" : "none"; };
    const envBar = document.getElementById('env-alert-bar');
    
    if (gameState === "TITLE") {
        toggle('title-box', true); toggle('status-panel-box', false); toggle('village-panel-box', false); toggle('log-box', false); toggle('action-panel-box', false);
        document.getElementById('location-text').innerText = "🔮 命運的起點";
        if(envBar) { envBar.className = "env-zone-normal"; envBar.innerHTML = "✨ 當前環境力場：穩定"; }
        return;
    }
    
    toggle('title-box', false); toggle('status-panel-box', true); toggle('log-box', true); toggle('action-panel-box', true);
    
    if (envBar) {
        if (currentEnvironment === "NORMAL") { envBar.className = "env-zone-normal"; envBar.innerHTML = "✨ 當前環境力場：重力與空間表現穩定"; }
        else if (currentEnvironment === "FIRE") { envBar.className = "env-zone-fire"; envBar.innerHTML = "🌋 警告：進入【烈焰焦土地核】每回合反噬燒血！火法克制"; }
        else if (currentEnvironment === "ICE") { envBar.className = "env-zone-ice"; envBar.innerHTML = "❄️ 警告：進入【萬年永凍冰原】常駐強效治癒禁制！"; }
        else if (currentEnvironment === "POISON") { envBar.className = "env-zone-poison"; envBar.innerHTML = "🧪 警告：進入【瘴氣劇毒沼澤】引導主動技能將深度感染！"; }
        else if (currentEnvironment === "VOID") { envBar.className = "env-zone-void"; envBar.innerHTML = "🌀 警告：進入【重力虛空壓制】主動 QTE 判定時間瘋狂縮短！"; }
    }
    
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
    document.getElementById('p-dodge').innerText = currentRun.dodgeChance + "%";
    document.getElementById('p-exp-text').innerText = `${currentRun.exp} / ${currentRun.nextExp}`;
    
    document.getElementById('hp-bar-fill').style.width = (currentRun.hp / currentRun.maxHp) * 100 + "%";
    document.getElementById('mp-bar-fill').style.width = (currentRun.mp / currentRun.maxMp) * 100 + "%";
    
    let sList = Object.keys(currentRun.skills).map(k => `${k}(Lv.${currentRun.skills[k]})`).join(", ");
    if(playerStatusEffects.burn > 0) sList += ` | 🔥燃燒x${playerStatusEffects.burn}`;
    if(playerStatusEffects.poison > 0) sList += ` | 🧪劇毒x${playerStatusEffects.poison}`;
    document.getElementById('p-skills-list').innerHTML = sList;
    
    renderDungeonInventoryUI();

    if (gameState === "VILLAGE") {
        toggle('village-panel-box', true); toggle('reward-panel-box', false);
        let locText = "🌍 目前位置：地表村莊";
        if(currentVillageLocation === "GATE") locText += " ➔ 🚪 傳送大殿";
        if(currentVillageLocation === "KITCHEN") locText += " ➔ 🍳 皇家料理屋";
        if(currentVillageLocation === "SQUARE") locText += " ➔ 🏛️ 中央廣場";
        if(currentVillageLocation === "WORKSHOP") locText += " ➔ 🛠️ 加工所";
        
        document.getElementById('location-text').innerText = locText;
        document.getElementById('btn-main-action').innerText = "🌀 啟動傳送門降臨深淵 B1F";
        document.getElementById('btn-main-action').disabled = false;
    } else if (gameState === "BATTLE") {
        toggle('village-panel-box', false); toggle('reward-panel-box', false);
        document.getElementById('location-text').innerText = `🚨 當前位置：地下城 B${dungeonFloor}F`;
        document.getElementById('btn-main-action').innerText = `🪜 前進探險 B${dungeonFloor + 1}F`;
    } else if (gameState === "REWARD") {
        toggle('village-panel-box', false); toggle('reward-panel-box', true);
        document.getElementById('btn-main-action').disabled = true;
    }
}
