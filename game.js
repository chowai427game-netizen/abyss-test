function applyRouteNodeSpecialEffects(node) {
    if (!node || !node.variant) return false;

    const thisFloor = dungeonFloor || 1;
    let triggerExtra = false;

    if (node.variant === "sanctum") {
        const healHp = Math.floor(currentRun.maxHp * 0.18);
        const healMp = Math.floor(currentRun.maxMp * 0.2);
        currentRun.hp = Math.min(currentRun.maxHp, currentRun.hp + healHp);
        currentRun.mp = Math.min(currentRun.maxMp, currentRun.mp + healMp);
        if (typeof addLog === "function") {
            addLog(`✨【淨化小堂】你撿起失落的護符，HP +${healHp}、MP +${healMp}，心神稍微安定。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "mist") {
        const bonusGold = 18 + thisFloor * 2;
        currentRun.gold += bonusGold;
        if (typeof addLog === "function") {
            addLog(`🌫️【迷霧小徑】你在不明霧中找到一小袋散落金屬與銀幣，獲得 +${bonusGold} G。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "cache") {
        const cacheGold = 30 + thisFloor * 3;
        currentRun.gold += cacheGold;
        if (typeof addLog === "function") {
            addLog(`💎【遺失寶庫】深處的箱櫃在你觸碰時發出嗡鳴，裡頭混著古老金屬與寶石，獲得 +${cacheGold} G。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "rift") {
        const roll = Math.random();
        if (roll < 0.45) {
            const loss = 12 + thisFloor * 2;
            currentRun.hp = Math.max(1, currentRun.hp - loss);
            if (typeof addLog === "function") {
                addLog(`🕳️【裂縫之門】你踩進扭曲邊緣，裂縫噴出詛咒之風，損失 <span class="num-popup num-boss-strike">-${loss} HP</span>。`, "take");
            }
        } else {
            const reward = 12 + thisFloor * 2;
            currentRun.gold += reward;
            if (typeof addLog === "function") {
                addLog(`🕳️【裂縫之門】你抓住一枚隨裂縫飄出的碎片，短暫得到異常靈感，獲得 +${reward} G。`, "perfect");
            }
        }
        triggerExtra = true;
    }

    if (node.variant === "bloodytrail") {
        const bonusPower = 3 + Math.floor(thisFloor / 10);
        currentRun.atk = (currentRun.atk || 0) + bonusPower;
        if (typeof addLog === "function") {
            addLog(`🩸【血跡小徑】你跟隨濃烈血跡，短時間內感到戰意被點燃，ATK +${bonusPower}。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "echo") {
        const revealGold = 10 + thisFloor * 2;
        currentRun.gold += revealGold;
        if (typeof addLog === "function") {
            addLog(`🔊【回音廊道】低語在你耳邊迴盪，像在提示某個被埋藏的路線，獲得 +${revealGold} G。`, "perfect");
        }
        triggerExtra = true;
    }

    if (node.variant === "altar") {
        const omenRoll = Math.random();
        if (omenRoll < 0.55) {
            currentRun.shield = (currentRun.shield || 0) + 18;
            if (typeof addLog === "function") {
                addLog(`🗿【祭壇遺跡】你在祭台前接過一枚護符，身上浮現一圈細緻護盾，Shield +18。`, "perfect");
            }
        } else {
            const curse = 10 + thisFloor * 2;
            currentRun.hp = Math.max(1, currentRun.hp - curse);
            if (typeof addLog === "function") {
                addLog(`🗿【祭壇遺跡】祭壇之力反噬，詛咒印記在你皮膚上蔓延，損失 <span class="num-popup num-boss-strike">-${curse} HP</span>。`, "take");
            }
        }
        triggerExtra = true;
    }

    if (node.variant === "shrine") {
        const shrineRoll = Math.random();
        if (shrineRoll < 0.6) {
            const extraReward = 40 + thisFloor * 4;
            currentRun.gold += extraReward;
            if (typeof addLog === "function") {
                addLog(`🕯️【黑暗神龕】神龕在你祈願時發出微光，祂似乎看見了你的意志，獲得 +${extraReward} G。`, "perfect");
            }
        } else {
            const damage = 20 + thisFloor * 3;
            currentRun.hp = Math.max(1, currentRun.hp - damage);
            if (typeof addLog === "function") {
                addLog(`🕯️【黑暗神龕】神龕的黑暗意志回應了你的祈求，卻以反噬作為代價，損失 <span class="num-popup num-boss-strike">-${damage} HP</span>。`, "take");
            }
        }
        triggerExtra = true;
    }

    return triggerExtra;
}

function buildRouteEncounterSummary(node) {
    if (!node) return "深淵中的未知路徑，沒有任何可確定的歷史痕跡。";

    const routeTypeText = {
        COMBAT: "這裡像是一處深淵狩獵場，敵人將迎面而來。",
        ELITE: "這裡必然有更強大的異種守衛，勝負可能瞬間翻轉。",
        EVENT: "這裡像是命運卡牌打開的地方，未知的選擇正等著你。",
        REST_SHOP: "這裡聽起來像是失落旅人的藏身處，適合恢復狀態與補給。",
        BOSS: "這裡是地底最深的試煉，所有過往都匯聚在這裡。"
    };

    return `${routeTypeText[node.type] || "這條路似乎暗藏了某種真正的試煉。"} ${node.clue || node.desc}`;
}

function resolveRouteNodeSpecial(selectedNode) {
    if (!selectedNode) return;

    const extra = applyRouteNodeSpecialEffects(selectedNode);
    if (extra && typeof updateUI === "function") {
        updateUI();
    }
}

function selectRouteNode(index) {
    if (!currentRun.currentNodes || !currentRun.currentNodes[index]) return;

    const selectedNode = currentRun.currentNodes[index];
    currentRun.selectedNodeType = selectedNode.type;
    currentRun.currentNodes = [];

    const routeBox = document.getElementById('route-panel-box');
    if (routeBox) routeBox.style.display = "none";

    const actionPanel = document.getElementById('action-panel-box');
    if (actionPanel) actionPanel.style.display = "flex";

    if (typeof addLog === "function") {
        const summary = buildRouteEncounterSummary(selectedNode);
        addLog(`🧭【探險抉擇】你選擇前往 <strong>${selectedNode.title}</strong>；此路線危險度 ${selectedNode.riskLabel || '中危'}，預期報酬 ${selectedNode.rewardLabel || '穩妥'}。<br>${summary}`, "perfect");
    }

    resolveRouteNodeSpecial(selectedNode);

    if (selectedNode.type === "REST_SHOP") {
        executeRestShopNode();
    } else if (selectedNode.type === "EVENT") {
        gameState = "ENCOUNTER";
        if (typeof updateUI === "function") updateUI();
        triggerRandomAbyssEvent();
    } else {
        gameState = "BATTLE";
        if (typeof updateUI === "function") updateUI();
        startNodeCombat(selectedNode.type);
    }
}

// NOTE: this replaces the older selectRouteNode definition that was previously below renderRouteSelectionPanel.
// The new implementation keeps the same game flow while adding deeper route-based atmosphere and risk/reward feedback.
