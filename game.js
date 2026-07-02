let player = { name: "勇者", hp: 100, maxHp: 100, mp: 0, maxMp: 50, gold: 0, atk: 15 };
let gameState = "TITLE"; // TITLE (封面), VILLAGE (村莊), BATTLE (戰鬥)
let isQteActive = false;
let qteTimer = null;
let qteResolvePointer = null;

function addLog(msg) {
    const box = document.getElementById('log-box');
    if (box) {
        box.innerHTML += `<div class="log-row-box">${msg}</div>`;
        box.scrollTop = box.scrollHeight;
    }
}

// 核心控制器：根據 gameState 隱藏或顯示對應的 HTML 面板
function updateUI() {
    const setDisplay = (id, status) => { 
        const el = document.getElementById(id); 
        if(el) el.style.display = status; 
    };
    
    if (gameState === "TITLE") {
        setDisplay('title-box', 'block');
        setDisplay('status-panel-box', 'none');
        setDisplay('log-box', 'none');
        setDisplay('action-panel', 'none');
        document.getElementById('location-text').innerText = "🔮 命運的起點";
        return;
    }

    // 進入遊戲後的通用 UI 切換
    setDisplay('title-box', 'none');
    setDisplay('status-panel-box', 'grid');
    setDisplay('log-box', 'block');
    setDisplay('action-panel', 'flex');

    document.getElementById('p-name').innerText = player.name;
    document.getElementById('p-hp').innerText = player.hp;
    document.getElementById('p-mp').innerText = player.mp;
    document.getElementById('p-gold').innerText = player.gold;
    document.getElementById('hp-bar-fill').style.width = (player.hp / player.maxHp) * 100 + "%";
    document.getElementById('mp-bar-fill').style.width = (player.mp / player.maxMp) * 100 + "%";

    if (gameState === "VILLAGE") {
        document.getElementById('location-text').innerText = "🌍 目前位置：地表村莊";
        document.getElementById('btn-action1').innerText = "⚔️ 進入地下城 (測試 QTE 戰鬥)";
    } else if (gameState === "BATTLE") {
        document.getElementById('location-text').innerText = "⚔️ 地下城 B1F 激烈交戰";
    }
}

// 1. 點擊封面「開啟冒險之旅」
function handleStartGame() {
    let inputName = document.getElementById('player-name-input').value.trim();
    player.name = inputName || "無名勇者";
    gameState = "VILLAGE";
    
    updateUI();
    document.getElementById('log-box').innerHTML = ""; // 清空測試提示
    addLog(`📜 勇者 <strong>${player.name}</strong> 降臨村莊！全新 MP 與 QTE 引擎已成功加載。`);
}

// 2. 點擊「進入地下城」
async function handleAction1() {
    if (gameState === "VILLAGE") {
        gameState = "BATTLE";
        updateUI();
        await runBattleLoop();
    }
}

// 3. QTE 異步 Promise 控制器（核心機制）
function triggerQteSystem(skillName, durationMs) {
    return new Promise((resolve) => {
        isQteActive = true;
        qteResolvePointer = resolve;
        
        document.getElementById('qte-skill-name').innerText = `✨ ${skillName} 發動！ ✨`;
        document.getElementById('qte-overlay').style.display = 'flex';
        
        let timerFill = document.getElementById('qte-timer-fill');
        timerFill.style.width = '100%';
        timerFill.style.transition = `width ${durationMs}ms linear`;
        setTimeout(() => timerFill.style.width = '0%', 10);

        qteTimer = setTimeout(() => {
            endQte(false);
        }, durationMs);
    });
}

function handleQteTap() {
    if (!isQteActive) return;
    clearTimeout(qteTimer);
    endQte(true);
}

function endQte(isSuccess) {
    isQteActive = false;
    document.getElementById('qte-overlay').style.display = 'none';
    
    const shell = document.getElementById('main-game-shell');
    if (isSuccess) {
        shell.classList.add('shake-effect', 'success-flash');
        setTimeout(() => shell.classList.remove('shake-effect', 'success-flash'), 200);
    } else {
        shell.classList.add('shake-effect', 'fail-flash');
        setTimeout(() => shell.classList.remove('shake-effect', 'fail-flash'), 200);
    }
    
    if (qteResolvePointer) qteResolvePointer(isSuccess);
}

// 4. 回合制戰鬥引擎主循環
async function runBattleLoop() {
    document.getElementById('btn-action1').disabled = true;
    let monster = { name: "💧 藍色史萊姆", hp: 60, atk: 12 };
    addLog(`👹 前方遭遇 **${monster.name}**！戰鬥瞬間爆發！`);
    
    let round = 1;
    while(player.hp > 0 && monster.hp > 0) {
        addLog(`=== [第 ${round} 回合] ===`);
        
        // 📥 MP 每回合開始回復機制
        player.mp = Math.min(player.maxMp, player.mp + 15);
        updateUI();
        addLog(`🔵 魔力湧動！回復 15 點 MP。（目前 MP: ${player.mp}/${player.maxMp}）`);
        await new Promise(r => setTimeout(r, 600));

        // 🔮 隨機抽中觸發【初心者•緊急治療】技能
        if (player.hp < player.maxHp && Math.random() < 0.7) {
            addLog(`🔮 觸發本職技能！正在詠唱【緊急治療】...`);
            
            // 💡 異步中斷戰鬥，進入 QTE 判定
            let qteResult = await triggerQteSystem("緊急治療", 1200);
            
            if (qteResult) {
                player.hp = Math.min(player.maxHp, player.hp + 25);
                addLog(`<span style="color:#2ecc71; font-weight:bold;">🟢【QTE PERFECT】聖光完美降臨！血量大幅回復 +25 HP！</span>`);
            } else {
                player.hp = Math.min(player.maxHp, player.hp + 8);
                addLog(`<span style="color:#aaaaaa;">⚠️【QTE MISS】施法被打斷！動作踉蹌，只微幅回復了 +8 HP。</span>`);
            }
            updateUI();
            await new Promise(r => setTimeout(r, 600));
        }

        // ⚔️ 玩家普攻
        monster.hp -= player.atk;
        addLog(`⚔️ 勇者揮劍斬擊，對史萊姆造成 ${player.atk} 點基礎物理傷害。`);
        if (monster.hp <= 0) break;
        await new Promise(r => setTimeout(r, 600));

        // 🔴 敵方反擊
        player.hp -= monster.atk;
        updateUI();
        addLog(`🔴 史萊姆黏液猛烈撞擊，勇者受到 -${monster.atk} 點外傷！`);
        
        round++;
        await new Promise(r => setTimeout(r, 1000));
    }

    // 戰後算帳與重置
    if (player.hp > 0) {
        player.gold += 15;
        addLog(`🎉 戰滅大捷！成功傳奇殲滅魔物，拾獲金幣 15 G。`);
        gameState = "VILLAGE";
    } else {
        addLog(`💀 勇者力竭魂歸深淵！強制回村，扣除當局所有臨時進度。`);
        player.hp = 100; player.mp = 0; 
        gameState = "VILLAGE";
    }
    
    document.getElementById('btn-action1').disabled = false;
    updateUI();
}

window.onload = function() { updateUI(); };
