// ==========================================================================
// 🧭 肉鴿分支地圖與 40 種奇遇卡片對接引擎
// ==========================================================================

const ROUTE_THEME_LIBRARY = [
    {
        id: "rift",
        name: "裂縫之門",
        icon: "🕳️",
        color: "#8b5cf6",
        omen: "裂縫深處傳來低語，像是某種古老存在正在觀望你。",
        riskText: "這條路充滿不明異動，走進去可能遇見變異敵人。",
        rewardText: "但若邊緣走位得當，通常能找到稀有殘骸或隱藏寶物。"
    },
    {
        id: "altar",
        name: "祭壇遺跡",
        icon: "🗿",
        color: "#f59e0b",
        omen: "石祭壇上殘留血跡與古老符文，周圍空氣都帶著咒語。",
        riskText: "你可能面對祭儀守衛或詛咒波動，風險不小。",
        rewardText: "然而這裡通常藏著稀有素材、神秘藥劑與隱藏任務線索。"
    },
    {
        id: "mist",
        name: "迷霧小徑",
        icon: "🌫️",
        color: "#38bdf8",
        omen: "霧氣像在引導你前進，四周卻看不清真正出口在哪裡。",
        riskText: "路徑較安定，但迷霧很容易讓人誤判方向與伏擊點。",
        rewardText: "這條路適合補給、休整與撿拾零碎物資。"
    },
    {
        id: "cache",
        name: "遺失寶庫",
        icon: "💎",
        color: "#22c55e",
        omen: "殘破箱櫃與金屬碎片堆在一起，像是被遺忘的寶藏。",
        riskText: "寶庫往往會有陷阱與守護機關，任何踏錯一步都可能招來反擊。",
        rewardText: "若能穿過，通常能拿到高價裝備、奇珍和大量金幣。"
    },
    {
        id: "bloodytrail",
        name: "血跡小徑",
        icon: "🩸",
        color: "#ef4444",
        omen: "地面顆粒狀的血跡從深處延伸過來，像是剛剛有人跑過。",
        riskText: "這裡很可能有戰鬥、追擊與突發敵人。",
        rewardText: "也常帶來稀有戰利品與強勁戰鬥數據。"
    },
    {
        id: "echo",
        name: "回音廊道",
        icon: "🔊",
        color: "#a78bfa",
        omen: "空洞的回音像在對你說話，彷彿這條路曾經有人走過。",
        riskText: "聲音不斷變換，會讓人誤判危險和獎勵的真實方向。",
        rewardText: "但若你能保持清醒，常能得到命運的額外啟示。"
    },
    {
        id: "sanctum",
        name: "淨化小堂",
        icon: "✨",
        color: "#2dd4bf",
        omen: "一縷光芒從瓦礫之中滲出，像被遺忘的守護力場。",
        riskText: "這裡通常較安全，但不知是否有暗影伺機而動。",
        rewardText: "適合治療、恢復、補給與小幅屬性加成。"
    },
    {
        id: "shrine",
        name: "黑暗神龕",
        icon: "🕯️",
        color: "#f97316",
        omen: "燃盡的蠟燭在無風中燃燒，像有人守在黑暗另一側。",
        riskText: "儀式神龕常常伴隨詛咒與超常現象，冒進不一定安全。",
        rewardText: "一旦通過，往往會帶來驚人的獎勵與劇烈增益。"
    }
];

function weightedPick(items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (const item of items) {
        roll -= item.weight;
        if (roll <= 0) return item;
    }
    return items[0];
}

function buildRandomRouteNode(floor, baseType) {
    const theme = ROUTE_THEME_LIBRARY[Math.floor(Math.random() * ROUTE_THEME_LIBRARY.length)];
    const dangerBase = 28 + floor * 1.15 + Math.random() * 30;
    const rewardBase = 20 + floor * 0.9 + Math.random() * 28;

    let danger = Math.min(96, Math.round(dangerBase));
    let reward = Math.min(96, Math.round(rewardBase));

    if (baseType === "REST_SHOP") {
        danger = Math.min(65, Math.round(danger * 0.55));
        reward = Math.min(85, Math.round(reward * 1.1));
    } else if (baseType === "EVENT") {
        danger = Math.min(88, Math.round(danger * 0.8));
        reward = Math.min(92, Math.round(reward * 1.15));
    } else if (baseType === "ELITE") {
        danger = Math.min(98, Math.round(danger * 1.2));
        reward = Math.min(98, Math.round(reward * 1.32));
    } else if (baseType === "COMBAT") {
        danger = Math.min(90, Math.round(danger * 0.95));
        reward = Math.min(88, Math.round(reward * 1.08));
    }

    const riskLabel = danger >= 75 ? "極危" : danger >= 50 ? "高危" : danger >= 30 ? "中危" : "低危";
    const rewardLabel = reward >= 75 ? "巨額" : reward >= 50 ? "優厚" : reward >= 30 ? "穩妥" : "微薄";

    return {
        type: baseType,
        title: `${theme.icon} ${theme.name}`,
        desc: `${theme.omen} ${theme.riskText} ${theme.rewardText}`,
        icon: theme.icon,
        color: theme.color,
        danger,
        reward,
        clue: theme.omen,
        riskLabel,
        rewardLabel,
        themeName: theme.name,
        variant: theme.id
    };
}

function generateRouteNodes(floor) {
    if (floor % 10 === 0) {
        return [{
            type: "BOSS",
            title: `👹 領主巨室 (B${floor}F)`,
            desc: "深淵真相在這裡沉睡，殘破的王座上，壓迫感像一張巨口正等著你靠近。",
            icon: "👹",
            color: "#ff3838",
            danger: 98,
            reward: 96,
            clue: "最終的命運就在這裡揭開，這一層不只是戰鬥，而是試煉。",
            riskLabel: "極危",
            rewardLabel: "巨額",
            themeName: "領主巨室",
            variant: "boss"
        }];
    }

    const typesPool = [
        { type: "COMBAT", weight: 42 },
        { type: "ELITE", weight: 20 },
        { type: "EVENT", weight: 24 },
        { type: "REST_SHOP", weight: 14 }
    ];

    let choices = [];
    let count = Math.random() < 0.38 ? 2 : 3;

    for (let i = 0; i < count; i++) {
        const selected = weightedPick(typesPool);
        choices.push(buildRandomRouteNode(floor, selected.type));
    }

    if (!choices.some(c => c.type === "COMBAT" || c.type === "ELITE")) {
        choices[0] = buildRandomRouteNode(floor, "COMBAT");
    }

    if (!choices.some(c => c.type === "EVENT")) {
        choices[Math.min(choices.length - 1, 1)] = buildRandomRouteNode(floor, "EVENT");
    }

    return choices;
}

function renderRouteSelectionPanel() {
    const routeBox = document.getElementById('route-panel-box');
    const routeContainer = document.getElementById('route-choices-container');
    const monsterCard = document.getElementById('monster-status-card');
    
    if (!routeBox || !routeContainer) return;

    if (!currentRun.currentNodes || currentRun.currentNodes.length === 0) {
        currentRun.currentNodes = generateRouteNodes(dungeonFloor || 1);
        if (typeof saveGameData === "function") saveGameData();
    }

    routeContainer.innerHTML = "";
    routeBox.style.display = "block";
    if (monsterCard) monsterCard.style.display = "none";

    const titleEl = document.getElementById('route-title-text');
    if (titleEl) {
        titleEl.innerText = `🧭 命運分流：選擇前進 B${dungeonFloor}F 路線 🧭`;
    }

    currentRun.currentNodes.forEach((node, idx) => {
        const btn = document.createElement('div');
        const riskBar = Math.max(10, Math.min(100, node.danger || 50));
        const rewardBar = Math.max(10, Math.min(100, node.reward || 50));

        btn.style.cssText = `
            background: linear-gradient(135deg, rgba(20, 20, 28, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%);
            border: 1px solid ${node.color || '#ffd700'};
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.25s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), inset 0 0 10px ${node.color}22;
        `;

        btn.onmouseover = () => {
            btn.style.transform = "translateY(-2px)";
            btn.style.boxShadow = `0 6px 20px ${node.color}66, inset 0 0 15px ${node.color}44`;
        };
        btn.onmouseout = () => {
            btn.style.transform = "translateY(0)";
            btn.style.boxShadow = `0 4px 15px rgba(0, 0, 0, 0.5), inset 0 0 10px ${node.color}22`;
        };

        btn.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px;">
                <span style="font-size: 15px; font-weight: bold; color: ${node.color}; line-height: 1.3;">${node.icon} ${node.title}</span>
                <span style="font-size: 10px; padding: 2px 8px; border-radius: 10px; background: ${node.color}22; color: ${node.color}; border: 1px solid ${node.color}55; white-space: nowrap;">分支 #${idx + 1}</span>
            </div>
            <div style="font-size: 11px; color: #d1d1d6; line-height: 1.5; margin-bottom: 10px;">${node.clue || node.desc}</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                <span style="font-size: 10px; padding: 3px 7px; border-radius: 999px; background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.4); color: #ff9090;">危險 ${node.riskLabel || '中危'} ${riskBar}%</span>
                <span style="font-size: 10px; padding: 3px 7px; border-radius: 999px; background: rgba(34,197,94,0.14); border: 1px solid rgba(34,197,94,0.4); color: #8ef0a5;">報酬 ${node.rewardLabel || '穩妥'} ${rewardBar}%</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                <div style="height: 7px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06);">
                    <div style="height: 100%; width: ${riskBar}%; background: linear-gradient(90deg, #f87171, #ef4444); border-radius: inherit;"></div>
                </div>
                <div style="height: 7px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06);">
                    <div style="height: 100%; width: ${rewardBar}%; background: linear-gradient(90deg, #34d399, #22c55e); border-radius: inherit;"></div>
                </div>
            </div>
        `;

        btn.onclick = () => {
            selectRouteNode(idx);
        };

        routeContainer.appendChild(btn);
    });

    const villagePanel = document.getElementById('village-panel-box');
    if (villagePanel) villagePanel.style.display = "none";
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
        addLog(`🧭【探險抉擇】你選擇前往 <strong>${selectedNode.title}</strong>；此路線危險度 ${selectedNode.riskLabel || '中危'}，預期報酬 ${selectedNode.rewardLabel || '穩妥'}。`, "perfect");
    }

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
