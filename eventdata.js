// ==========================================================================
// 🌀 eventdata.js：40種邪神/仙子奇遇 & 5階級隨機寶箱數據庫 (含歐皇 0.1% 全服公告)
// ==========================================================================

// 輔助函式：安全加入戰術背包，若容量已滿則自動寄回倉庫
function safePushToInventory(run, meta, itemName) {
    if (!run.inventory) run.inventory = [];
    if (!meta.warehouse) meta.warehouse = {};
    const maxBag = typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6;
    
    if (run.inventory.length < maxBag) {
        run.inventory.push(itemName);
        return `🎁 成功將 [${itemName}] 塞進快捷背包！`;
    } else {
        meta.warehouse[itemName] = (meta.warehouse[itemName] || 0) + 1;
        return `📦 快捷背包已滿，[${itemName}] 已自動放入村莊倉庫！`;
    }
}

// 輔助安全函式：重新計算當前局內屬性面板與 UI
function safeRefreshStats() {
    if (typeof recalculateRunStats === "function") {
        recalculateRunStats();
    }
    if (typeof updateUI === "function") {
        updateUI();
    }
}

// ==========================================================================
// 📦 5 階級寶箱組態配置 (Tier 5 ~ Tier 1 嚴格配率與戰利品池)
// ==========================================================================

const CHEST_TIERS_CONFIG = {
    // 🪵 Tier 5: 破損寶箱 (70.0% 垃圾箱)
    TIER_5: {
        tier: 5,
        tierName: "破損寶箱",
        color: "#8e8e93",
        rate: 0.700, // 70.0%
        minGold: 10,
        maxGold: 50,
        names: ["🪵 破爛朽木箱", "🧱 廢棄石縫瓦罐", "💀 生鏽哥布林皮包", "🧟 發霉舊木盒", "🪵 崩塌半獸人木桶"],
        loots: ["史萊姆黏液", "哥布林香料", "獸人後腿肉", "巨石苔蘚", "怨靈淚晶", "🪨 焦黑的未知物體"]
    },
    // 📦 Tier 4: 普通寶箱 (20.0% 稍有價值物資)
    TIER_4: {
        tier: 4,
        tierName: "普通寶箱",
        color: "#2ecc71",
        rate: 0.200, // 20.0%
        minGold: 50,
        maxGold: 150,
        names: ["📦 冒險者遺留物資箱", "🕸️ 冰凍蛛絲鐵皮箱", "🛡️ 霜殼行軍皮革箱", "蜥蜴皮保險袋", "🧪 煉金術士棄置藥箱"],
        loots: ["寒冰霜塵", "毒蜘蛛腺體", "腐屍毒素", "怨念皮翼", "硬殼龜甲", "🥩 烤野豬肉大串", "🧪 微光初級治癒藥水"]
    },
    // 💎 Tier 3: 稀有寶箱 (8.5% 交易/開啟價值)
    TIER_3: {
        tier: 3,
        tierName: "稀有寶箱",
        color: "#3498db",
        rate: 0.085, // 8.5%
        minGold: 150,
        maxGold: 400,
        names: ["💎 璀璨深淵銀邊寶箱", "🔥 熔岩鍍金精鋼箱", "🔮 魔導加工所遺物箱", "👑 哥布林暴君藏寶箱", "🌊 深海白金藏寶盒"],
        loots: ["烈焰餘燼", "熔岩鱗片", "焦黑骨碎", "食人魔厚皮", "魔導碎頁", "🌭 大快活厚牛巨堡", "🍧 萬年永凍刨冰", "💍 銅製指環", "📿 石質護身符"]
    },
    // 👑 Tier 2: 史詩寶箱 (1.4% 非常難求)
    TIER_2: {
        tier: 2,
        tierName: "史詩寶箱",
        color: "#a55eea",
        rate: 0.014, // 1.4%
        minGold: 400,
        maxGold: 1000,
        names: ["👑 皇家耀金璀璨寶箱", "🌀 虛空裂縫重力神箱", "👿 煉獄魔神熾金庫", "🪐 宇宙星神隕鐵匣", "💀 亡靈死神幽冥骨匣"],
        loots: ["虛空眼球", "時空皮革", "吸血毒牙", "惡魔之角", "星塵碎片", "🍷 逆轉禁忌血釀", "🗡️ 寒冰霜刃", "👕 守衛重甲", "💍 凍結晶環"]
    },
    // 🌟 Tier 1: 傳說寶箱 (0.1% 歐皇專屬)
    TIER_1: {
        tier: 1,
        tierName: "傳說寶箱",
        color: "#ffd700",
        rate: 0.001, // 0.1%
        minGold: 2000,
        maxGold: 5000,
        names: ["🌟 創世神聖天之寶盒", "👑 歐皇至高因果律金庫", "🌌 宇宙虛無至尊神匣"],
        // 🔮 只會出現 51-60 級傳說飾品藍圖
        loots: ["💍 星塵風暴流光戒", "📿 混沌黑洞項鍊", "💍 奇點時空重力環", "📿 死神寂滅吊墜", "💍 秩序審判天之戒"]
    }
};

// ==========================================================================
// 🎲 寶箱抽取與開啟核心邏輯
// ==========================================================================

// 1. 根據概率 (70%, 20%, 8.5%, 1.4%, 0.1%) 隨機抽取一個 Tier 寶箱
function drawRandomChest() {
    const roll = Math.random(); // 0.0 ~ 1.0

    let config;
    if (roll < 0.700) {
        config = CHEST_TIERS_CONFIG.TIER_5; // 0 ~ 70%
    } else if (roll < 0.900) {
        config = CHEST_TIERS_CONFIG.TIER_4; // 70% ~ 90%
    } else if (roll < 0.985) {
        config = CHEST_TIERS_CONFIG.TIER_3; // 90% ~ 98.5%
    } else if (roll < 0.999) {
        config = CHEST_TIERS_CONFIG.TIER_2; // 98.5% ~ 99.9%
    } else {
        config = CHEST_TIERS_CONFIG.TIER_1; // 99.9% ~ 100% (0.1% 歐皇)
    }

    // 從該 Tier 隨機選一個名稱
    const randomName = config.names[Math.floor(Math.random() * config.names.length)];

    return {
        tier: config.tier,
        tierName: config.tierName,
        name: randomName,
        color: config.color,
        minGold: config.minGold,
        maxGold: config.maxGold,
        loots: config.loots
    };
}

// 2. 開啟寶箱並發放戰利品 (獲得隨機金幣 + 隨機 1 件專屬池戰利品)
function openChestAndGetLoot(chestObj, run, meta) {
    // 🪙 計算金幣
    const goldEarned = Math.floor(Math.random() * (chestObj.maxGold - chestObj.minGold + 1)) + chestObj.minGold;
    run.gold = (run.gold || 0) + goldEarned;

    // 🎁 從對應 Tier 的戰利品池中隨機抽取 1 件物品
    const randomItem = chestObj.loots[Math.floor(Math.random() * chestObj.loots.length)];
    const inventoryMsg = safePushToInventory(run, meta, randomItem);

    // 🌟 若抽到 0.1% Tier 1 傳說寶箱，觸發全服廣播特效
    if (chestObj.tier === 1) {
        if (typeof showToast === "function") {
            showToast(`🌟【歐皇降臨】你解開了【${chestObj.name}】，獲得傳說神裝藍圖 [${randomItem}]！`, "success");
        }
        if (typeof addLog === "function") {
            addLog(`📢⚡<b>【全服公告・歐皇降臨】</b> 勇者 <strong>${meta.name || "無名勇者"}</strong> 破譯了千分之一機率的 <span style="color:#ffd700; font-weight:bold;">[${chestObj.name}]</span>！獲得金幣 +${goldEarned} G 及傳說藍圖：<strong style="color:#ffd700;">[${randomItem}]</strong>！`, "victory-badge");
        }
    }

    return {
        gold: goldEarned,
        item: randomItem,
        msg: inventoryMsg
    };
}

// 保留 40 種奇遇數據庫 (完全不變)
const ABYSS_EVENTS_DATABASE = [
    {
        title: "🩸 命運邪神祭壇 • 血脈契約",
        desc: "虛空中傳來邪神的低語，祂要求你用體質換取無上的力量 (STR)。",
        choices: [
            { text: "🩸 簽署契約（代價: VIT -2, 報酬: STR +6）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.VIT = Math.max(0, meta.stats.VIT - 2); meta.stats.STR += 6; safeRefreshStats(); return "🩸 你用靈魂之血換取了通紅的殺意！(STR +6, VIT -2)"; } },
            { text: "🏃 拒絕轉身離開", run: () => "🏃 你謹慎地避開了邪神的誘惑，神經重新緊繃。" }
        ]
    },
    {
        title: "🧚 迷落的深淵精靈仙子",
        desc: "一隻翅膀受傷的發光小仙子倒在廢墟中，你可以選擇分給她一點魔力，或者粗暴地將其捏碎吸取精華。",
        choices: [
            { text: "🪄 灌注微量魔力（代價: MP -15, 報酬: INT +3, LUK +3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; run.mp = Math.max(0, run.mp - 15); meta.stats.INT += 3; meta.stats.LUK += 3; safeRefreshStats(); return "✨ 精靈仙子圍繞著你翩翩起舞，賜予你智慧與幸運的加冕！"; } },
            { text: "🩸 殘忍捏碎（報酬: STR +3, 隨機獲得史萊姆黏液 x1）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; if(!meta.warehouse) meta.warehouse = {}; meta.stats.STR += 3; meta.warehouse["史萊姆黏液"] = (meta.warehouse["史萊姆黏液"] || 0) + 1; safeRefreshStats(); return "💀 你冷酷地捏碎了仙子，狂暴力量湧入體內 (STR +3)！"; } }
        ]
    },
    {
        title: "🏕️ 遺留的冒險者營地篝火",
        desc: "一個空無一人的帳篷，篝火還殘留著微熱。你可以在這裡睡一覺，或者仔細搜刮他的帳篷。",
        choices: [
            { text: "💤 在篝火旁小憩（回復 80 HP，回復 30 MP）", run: (run) => { run.hp = Math.min(run.maxHp, run.hp + 80); run.mp = Math.min(run.maxMp, run.mp + 30); safeRefreshStats(); return "💤 溫暖的營火重整了你的神經。"; } },
            { text: "🔍 仔細搜刮帳篷（獲得 80G 金幣，但有 50% 機率踩到生鏽陷阱扣 20 HP）", run: (run) => { if(Math.random() < 0.5) { run.hp = Math.max(1, run.hp - 20); run.gold += 80; safeRefreshStats(); return "💥 搜刮到了金幣！但你踩到營地的主人布下的夾子，腳踝受創！"; } else { run.gold += 80; safeRefreshStats(); return "🪙 完美避開了預警線，搜刮到了一袋沉甸甸的金幣！"; } } }
        ]
    },
    {
        title: "🧙 黑市魔液調配師",
        desc: "一個渾身散發藥草氣味的哥布林隱士擋在路上，拿出一瓶五彩斑斕的試劑，要你喝下去。",
        choices: [
            { text: "🧪 一口乾了它！（隨機觸發: AGI +5 / 中毒扣 25 HP）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; if(Math.random() < 0.5) { meta.stats.AGI += 5; safeRefreshStats(); return "🧪 你的肌肉神經反應爆發，敏捷狂飆 (AGI +5)！"; } else { run.hp = Math.max(5, run.hp - 25); safeRefreshStats(); return "🤢 這瓶魔液劇毒無比！你當場狂吐，胃部灼燒。"; } } },
            { text: "🏃 搖搖頭，快步走開", run: () => "🏃 隱士對著你發出瘋癲的怪笑，你迅速離去。" }
        ]
    },
    {
        title: "🧱 坍塌的重力魔導石碑",
        desc: "石碑上流轉著反重力的奇異電波，你可以將手放上去感悟力場規律。",
        choices: [
            { text: "🧿 感悟重力力場（INT +3, DEX +3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.INT += 3; meta.stats.DEX += 3; safeRefreshStats(); return "🌀 重力偏折，你的詠唱與命中大幅提升 (INT+3, DEX+3)！"; } },
            { text: "🪓 暴力砸毀（獲得 150G 金幣，但受到 30 點重力反震真實創傷）", run: (run) => { run.hp = Math.max(1, run.hp - 30); run.gold += 150; safeRefreshStats(); return "💥 石碑碎裂，露出了裏面鑲嵌的遠古金幣！"; } }
        ]
    },
    { 
        title: "🦴 腐爛的巨大遠古龍獸屍骸", 
        desc: "這裏躺著一具龐大的巨龍遺骸，你可以選擇在龍牙下祈禱，或者冒險伸手進食道深處掏取寶物。", 
        choices: [
            { text: "🧎 跪地祈禱（LUK +4，暴擊與完迴提升）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.LUK += 4; safeRefreshStats(); return "✨ 龍威洗禮，你的幸運氣場大幅增強 (LUK +4)！"; } },
            { text: "🔍 伸手掏取（50% 機率獲得「硬殼龜甲」x1 / 50% 毒素扣 25 HP）", run: (run, meta) => { if(!meta.warehouse) meta.warehouse = {}; if(Math.random()<0.5) { meta.warehouse["硬殼龜甲"] = (meta.warehouse["硬殼龜甲"]||0)+1; safeRefreshStats(); return "🎁 居然摸到了地底巨獸反芻出來的硬殼龜甲！"; } else { run.hp = Math.max(1, run.hp - 25); safeRefreshStats(); return "🤢 一條毒蟒咬了你的手！毒素侵蝕你的心神。"; } } }
        ] 
    },
    { 
        title: "⛲ 墮落天使的生命聖泉", 
        desc: "泉水散發著紫金色的光芒，極具誘惑力。你敢喝嗎？", 
        choices: [
            { text: "🍻 暢飲聖泉（生命值滿回復，且 MP 滿回復）", run: (run) => { run.hp = run.maxHp; run.mp = run.maxMp; safeRefreshStats(); return "✨ 泉水洗滌了你全身的疲憊與傷痕！"; } },
            { text: "🧪 裝入瓶中帶走（獲得「🌭 大快活厚牛巨堡」x1，扣 30G）", run: (run, meta) => { 
                if(run.gold >= 30) { 
                    run.gold -= 30; 
                    return safePushToInventory(run, meta, "🌭 大快活厚牛巨堡");
                } else { 
                    return "🪙 你兜裏沒零錢買瓶子，只好遺憾走開。"; 
                } 
            } }
        ] 
    },
    { 
        title: "🧙‍♀️ 狂暴元素女巫的分身", 
        desc: "女巫分身在冰火元素中交錯，她要求你展示出對法術或敏捷的熱愛。", 
        choices: [
            { text: "🔥 奉獻火焰法術（代價: MP -30，報酬: INT +5）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; run.mp = Math.max(0, run.mp - 30); meta.stats.INT += 5; safeRefreshStats(); return "🔥 女巫滿意地讚賞你的天賦，智力獲得提升 (INT +5)！"; } },
            { text: "❄️ 奉獻寒冰魔力（代價: HP -20，報酬: AGI +5）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; run.hp = Math.max(1, run.hp - 20); meta.stats.AGI += 5; safeRefreshStats(); return "❄️ 女巫的分身化為冰晶，融入你的戰鬥步伐 (AGI +5)！"; } }
        ] 
    },
    { 
        title: "🛡️ 戰死先烈的生鏽英魂塚", 
        desc: "這裏插著一把生鏽的鐵巨劍，英魂在此遊蕩，你可以選擇獻祭財富來平息他們的憤怒。", 
        choices: [
            { text: "🪙 供奉 100G 金幣（VIT +4，防禦與血量提升）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; run.gold = Math.max(0, run.gold - 100); meta.stats.VIT += 4; safeRefreshStats(); return "🛡️ 英魂之盾庇護著你，鋼鐵體質提升 (VIT +4)！"; } },
            { text: "🗡️ 強行拔出鐵巨劍（STR +6，但英魂震怒使 VIT -2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.STR += 6; meta.stats.VIT = Math.max(0, meta.stats.VIT - 2); safeRefreshStats(); return "💥 英魂之怒震碎了你的胸口，但你奪取了狂熱力量 (STR +6, VIT -2)！"; } }
        ] 
    },
    { 
        title: "🪱 地底巨型蠕蟲的黏性蟲巢", 
        desc: "你一腳踩進了蠕蟲產卵的地底蟲繭中，裏面有無數透明發光的卵。", 
        choices: [
            { text: "🍳 偷取蟲卵吞食（VIT +5，但 AGI -1）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.VIT += 5; meta.stats.AGI = Math.max(0, meta.stats.AGI - 1); safeRefreshStats(); return "🤢 你強忍惡心吃下了黏性蟲卵，肌肉密度暴增 (VIT +5, AGI -1)！"; } },
            { text: "🔥 用火焰淨化它（獲得 50G 金幣與「史萊姆黏液」x1）", run: (run, meta) => { if(!meta.warehouse) meta.warehouse = {}; run.gold += 50; meta.warehouse["史萊姆黏液"] = (meta.warehouse["史萊姆黏液"]||0)+1; safeRefreshStats(); return "🔥 蟲巢在火焰中熔毀，殘餘物中析出了純淨的膠質。"; } }
        ] 
    },
    { 
        title: "🧿 時空小丑的瘋狂輪盤", 
        desc: "小丑在虛無中召喚出時空轉盤，隨機逆轉你的時空。", 
        choices: [
            { text: "🎰 開心轉動它（50% 機率獲得 200G / 50% 吐出 100G）", run: (run) => { if(Math.random()<0.5) { run.gold += 200; safeRefreshStats(); return "🪙 時空大爆發！幸運大轉盤獲得 200G！"; } else { run.gold = Math.max(0, run.gold - 100); safeRefreshStats(); return "💸 糟了！小丑割破了你的錢包偷走了金幣。"; } } }
        ] 
    },
    { 
        title: "👼 盲眼大天使雕像", 
        desc: "這是一座失落的巨大天使石雕，你可以選擇觸摸它的盲眼以感悟天光。", 
        choices: [
            { text: "👁️ 觸摸盲眼（INT +3, VIT +2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.INT += 3; meta.stats.VIT += 2; safeRefreshStats(); return "✨ 石像流下一滴天之淚，溫暖了你的感官 (INT+3, VIT+2)。"; } }
        ] 
    },
    { 
        title: "🧪 黑血祭司的禁忌培養皿", 
        desc: "這裏留著一瓶被大祭司遺棄的異能細胞血清。", 
        choices: [
            { text: "🩸 注射黑血細胞（STR +6，但 VIT -2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.STR += 6; meta.stats.VIT = Math.max(0, meta.stats.VIT - 2); safeRefreshStats(); return "💀 你將細胞打入大腿，力量瞬間暴增 (STR +6)！"; } }
        ] 
    },
    { 
        title: "🗿 巨石重力壓縮儀", 
        desc: "一個散發強力磁場的地底機器，可以將你包包中的材料進行分子壓縮。", 
        choices: [
            { text: "⚙️ 啓動壓縮（將倉庫中 5 個史萊姆黏液壓縮為「巨石苔蘚」x2）", run: (run, meta) => { if(!meta.warehouse) meta.warehouse = {}; if((meta.warehouse["史萊姆黏液"]||0)>=5) { meta.warehouse["史萊姆黏液"] -= 5; meta.warehouse["巨石苔蘚"] = (meta.warehouse["巨石苔蘚"]||0)+2; safeRefreshStats(); return "⚙️ 成功將軟膠壓縮成硬度極高的苔蘚岩石！"; } else { return "⚠️ 材料不足！機器不理你。"; } } }
        ] 
    },
    { 
        title: "🐺 嗜血狼群的咆哮廢墟", 
        desc: "你被幾隻變異巨狼圍攻，你需要用武力突圍或者用獸肉安撫祂們。", 
        choices: [
            { text: "🥩 投餵「獸人後腿肉」x1（獲得 40 XP 經驗值）", run: (run, meta) => { if(!meta.warehouse) meta.warehouse = {}; if((meta.warehouse["獸人後腿肉"]||0)>=1) { meta.warehouse["獸人後腿肉"]--; run.exp += 40; safeRefreshStats(); return "🐺 巨狼咬起後腿肉，叼回了暗處，認可了你的血脈。"; } else { return "⚠️ 你倉庫空空，狼群不依不饒！"; } } },
            { text: "⚔️ 拔劍血戰（扣 30 HP，獲得 200G 與 100 XP）", run: (run) => { run.hp = Math.max(1, run.hp - 30); run.gold += 200; run.exp += 100; safeRefreshStats(); return "💥 你殺出了一條血路，戰利品極其豐厚！"; } }
        ] 
    },
    { 
        title: "🧭 流落的深淵指南針", 
        desc: "地面上躺著一個閃爍符文微光的黃銅指南針。", 
        choices: [
            { text: "🧭 撿起來校準身位（DEX +3, AGI +2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.DEX += 3; meta.stats.AGI += 2; safeRefreshStats(); return "🧭 指南針指引了力場縫隙，命中與攻速提升 (DEX+3, AGI+2)！"; } }
        ] 
    },
    { 
        title: "🥀 嗜血妖花綻放的溫床", 
        desc: "一朵巨大的紅色妖花正在吞噬一具魔物屍體，這裏魔能翻湧。", 
        choices: [
            { text: "🩸 以鮮血灌溉（代價: HP -40，報酬: STR +4, LUK +3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; run.hp = Math.max(1, run.hp - 40); meta.stats.STR += 4; meta.stats.LUK += 3; safeRefreshStats(); return "🥀 妖花吸飽了熱血，結出瘋狂殺戮之果 (STR+4, LUK+3)！"; } }
        ] 
    },
    { 
        title: "🧱 古墓裂縫中的金色古幣", 
        desc: "裂縫中卡著一袋閃閃發光的古代金幣，你可以伸手去拿，但可能觸發古代巨石防線。", 
        choices: [
            { text: "💰 伸手硬掏（獲得 180G 金幣，但扣減 15% 當前 HP）", run: (run) => { let loss = Math.floor(run.hp * 0.15); run.hp = Math.max(1, run.hp - loss); run.gold += 180; safeRefreshStats(); return `💰 金幣到手！但石板塌陷砸到手臂，扣減了 ${loss} 點 HP。`; } }
        ] 
    },
    { 
        title: "🧙 瘋癲的煉金術狂熱徒", 
        desc: "一個身穿破爛法袍的學者狂笑著攔住你，要拿你做藥劑活性實驗。", 
        choices: [
            { text: "🧪 配合實驗（VIT +6，但 STR -2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.VIT += 6; meta.stats.STR = Math.max(0, meta.stats.STR - 2); safeRefreshStats(); return "🧪 藥劑重組了肌肉結構，身軀防禦提升 (VIT +6, STR -2)！"; } }
        ] 
    },
    { 
        title: "🕸️ 永凍蛛母的蛛絲迷宮", 
        desc: "這是一片被蛛絲覆蓋的寒冷迷宮，你可以強行燒毀，或者用魔力融化。", 
        choices: [
            { text: "🔥 用大火燒（獲得 60G 金幣，但有 50% 機率吸入毒氣扣 20 HP）", run: (run) => { if(Math.random()<0.5) { run.hp = Math.max(1, run.hp - 20); run.gold += 60; safeRefreshStats(); return "🤮 大火燃燒蛛絲釋放了劇毒障氣！你大口喘氣吸入肺部。"; } else { run.gold += 60; safeRefreshStats(); return "🔥 烈火沖天！蛛絲和蟲卵付之一矩，你踏著灰燼拾起金幣。"; } } }
        ] 
    },
    { 
        title: "🪐 重力奇異點黑洞殘骸", 
        desc: "一個微型黑洞在你面前緩慢自轉，扭曲著周圍的空氣。", 
        choices: [
            { text: "🪐 投擲「時空皮革」x1 穩定力場（AGI +5, DEX +3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; if(!meta.warehouse) meta.warehouse = {}; if((meta.warehouse["時空皮革"]||0)>=1) { meta.warehouse["時空皮革"]--; meta.stats.AGI += 5; meta.stats.DEX += 3; safeRefreshStats(); return "🌀 黑洞重力逆變，你的反應速度永久增快 (AGI+5, DEX+3)！"; } else { return "⚠️ 身上沒有時空皮革可以穩定黑洞！"; } } }
        ] 
    },
    { 
        title: "💀 亡靈死神的寂滅刀痕", 
        desc: "地面上有一道巨型鐮刀斬擊下的虛無刀痕，散發著恐怖的寂滅死亡劍意。", 
        choices: [
            { text: "🗡️ 跪地參悟死意（STR +8，VIT -3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.STR += 8; meta.stats.VIT = Math.max(0, meta.stats.VIT - 3); safeRefreshStats(); return "💀 死亡寒意浸透脊柱，物理破壞力飆升 (STR +8)！"; } }
        ] 
    },
    { 
        title: "💧 史萊姆繁衍之池", 
        desc: "你來到了一片晶瑩剔透的藍色溫泉前，史萊姆們在此產卵。", 
        choices: [
            { text: "🍻 喝一口溫泉水（MP 恢復 50，INT +3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; run.mp = Math.min(run.maxMp, run.mp + 50); meta.stats.INT += 3; safeRefreshStats(); return "✨ 帶有奧術魔力的溫泉水滋養了識海 (INT +3)！"; } }
        ] 
    },
    { 
        title: "👹 深淵黑市拍賣會的漏網之魚", 
        desc: "一個受傷的走私商人倒在路邊，他的貨箱破裂，漏出了一件裝備。", 
        choices: [
            { text: "🪙 用 120G 購買（獲得「💍 怨靈哭泣指環」）", run: (run, meta) => { if(!meta.warehouse) meta.warehouse = {}; if(run.gold >= 120) { run.gold -= 120; meta.warehouse["💍 怨靈哭泣指環"] = (meta.warehouse["💍 怨靈哭泣指環"]||0)+1; safeRefreshStats(); return "🎁 成功從走私商人手中接盤了一枚發光的哭泣戒指！"; } else { return "🪙 你的零錢不夠拍下這件寶物。"; } } }
        ] 
    },
    { 
        title: "🏛️ 皇家加工所遠征探險廢墟", 
        desc: "這裡遺留著一個報廢的永久精鍊高台殘骸，能源核心還能發一次光。", 
        choices: [
            { text: "🌟 精鍊全身防具（防具槽位精鍊免費升星 1 星！）", run: (run, meta) => { if(!meta.equipmentStars) meta.equipmentStars = { weapon: 0, armor: 0, accessory: 0 }; if(meta.equipmentStars.armor < 5) { meta.equipmentStars.armor++; safeRefreshStats(); return "🌟 高台爆發出一陣金光！你的防具槽位發生了永久進化。"; } else { return "🌟 你的防具部位已是滿星，高台能量反震回復了你 50 HP。"; } } }
        ] 
    },
    { 
        title: "🦇 冰原蝙蝠王的吸生巢穴", 
        desc: "天花板上掛滿了發光的冰晶蝙蝠，祂們將你當作了熱量來源。", 
        choices: [
            { text: "🛡️ 撐起防線（代價: HP -30，報酬: VIT +4）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; run.hp = Math.max(1, run.hp - 30); meta.stats.VIT += 4; safeRefreshStats(); return "🛡️ 你強行撐起鬥氣盾，淬鍊了體質 (VIT +4)！"; } }
        ] 
    },
    { 
        title: "🐍 劇毒蛇蛻之壁", 
        desc: "牆上掛著幾張巨大的蛇蛻，散發著驚人的劇毒生命力。", 
        choices: [
            { text: "🔍 剝下蛇蛻（VIT +3, LUK +2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.VIT += 3; meta.stats.LUK += 2; safeRefreshStats(); return "🐍 劇毒生命力融入你，體質與幸運補強 (VIT+3, LUK+2)！"; } }
        ] 
    },
    { 
        title: "🧱 巨石板甲防護神陣", 
        desc: "地面上由無數巨石塊布成了一個玄奧的防禦陣法，你可以坐下來打坐。", 
        choices: [
            { text: "🧎 静心冥想（VIT +4, DEX +2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.VIT += 4; meta.stats.DEX += 2; safeRefreshStats(); return "🛡️ 土元素之盾盤旋周身，防禦更為堅固 (VIT+4, DEX+2)！"; } }
        ] 
    },
    { 
        title: "🐺 深淵野狼王的利齒詛咒", 
        desc: "一具黑狼骷髏頭張著巨口，口中含著一塊發光的紅寶石。", 
        choices: [
            { text: "💎 奪取寶石（STR +5, AGI -1）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.STR += 5; meta.stats.AGI = Math.max(0, meta.stats.AGI - 1); safeRefreshStats(); return "💥 寶石化為血脈力量，攻擊飆升 (STR +5)！"; } }
        ] 
    },
    { 
        title: "🧚 奧術小仙子的魔法賭局", 
        desc: "仙子在桌面上點燃了冰火兩盞元素燈，讓你猜一盞。", 
        choices: [
            { text: "🔥 押註火焰（50% 機率 INT +6，50% 機率 VIT -3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; if(Math.random()<0.5) { meta.stats.INT += 6; safeRefreshStats(); return "🔥 火光大盛！智力獲得狂暴增幅 (INT +6)！"; } else { meta.stats.VIT = Math.max(0, meta.stats.VIT - 3); safeRefreshStats(); return "💥 賭輸了！大火爆裂，傷及氣血 (VIT -3)！"; } } }
        ] 
    },
    { 
        title: "⛺ 廢棄的皇家行軍糧倉", 
        desc: "廢墟角落堆放著幾箱保存完好的行軍乾糧。", 
        choices: [
            { text: "🎒 搜刮糧倉（獲得「🌭 大快活厚牛巨堡」x1）", run: (run, meta) => { return safePushToInventory(run, meta, "🌭 大快活厚牛巨堡"); } }
        ] 
    },
    { 
        title: "🧪 毒霧沼澤中的迷霧祭司", 
        desc: "大霧迷漫，一個黑影在腐骨中祈禱，邀請你一同獻祭。", 
        choices: [
            { text: "🩸 供奉「毒蜘蛛腺體」x2（VIT +5, LUK +3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; if(!meta.warehouse) meta.warehouse = {}; if((meta.warehouse["毒蜘蛛腺體"]||0)>=2) { meta.warehouse["毒蜘蛛腺體"] -= 2; meta.stats.VIT += 5; meta.stats.LUK += 3; safeRefreshStats(); return "🧪 邪能儀式啟動，體質與幸運倍增 (VIT+5, LUK+3)！"; } else { return "⚠️ 身上沒有足夠的毒蜘蛛腺體！"; } } }
        ] 
    },
    { 
        title: "🧱 古墓禁地防禦神龕", 
        desc: "一個古老石碑神龕，你可以獻祭你的一部分敏捷來加載體質防線。", 
        choices: [
            { text: "🛡️ 供奉敏捷（AGI -3 ➔ VIT +6）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.AGI = Math.max(0, meta.stats.AGI - 3); meta.stats.VIT += 6; safeRefreshStats(); return "🛡️ 巨石壁障加載！體質大幅增加 (AGI-3, VIT+6)！"; } }
        ] 
    },
    { 
        title: "🪓 半獸人酋長的戰歌擂台", 
        desc: "廢墟石壁上刻滿了巨型獸骨和巨斧，散發出狂暴戰意。", 
        choices: [
            { text: "🦁 吟唱狂怒戰歌（STR +4, LUK +3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.STR += 4; meta.stats.LUK += 3; safeRefreshStats(); return "🦁 戰歌迴響，力量與暴擊幸運大幅提升 (STR+4, LUK+3)！"; } }
        ] 
    },
    { 
        title: "🕸️ 永凍蛛絲迷宮殘留寶藏", 
        desc: "蛛網深處卡著一個報廢的寶箱，被寒冰凍結。", 
        choices: [
            { text: "🔥 用火焰融化（獲得 80G 金幣與「寒冰霜塵」x1）", run: (run, meta) => { if(!meta.warehouse) meta.warehouse = {}; run.gold += 80; meta.warehouse["寒冰霜塵"] = (meta.warehouse["寒冰霜塵"]||0)+1; safeRefreshStats(); return "🔥 火燒冰消！成功取出了被凍結在蛛網裏的古代金幣。"; } }
        ] 
    },
    { 
        title: "🧿 時空摺疊亂流哨卡", 
        desc: "這裏的時間流速是混亂的，你可以選擇將部分金幣投入亂流以此修復因果線。", 
        choices: [
            { text: "🪙 投入 150G（全屬性 +2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; if(run.gold >= 150) { run.gold -= 150; meta.stats.STR += 2; meta.stats.AGI += 2; meta.stats.VIT += 2; meta.stats.INT += 2; meta.stats.DEX += 2; meta.stats.LUK += 2; safeRefreshStats(); return "🪐 時間線逆轉收束！全能力獲得神聖提升！"; } else { return "⚠️ 錢不夠，因果黑洞無動於衷。"; } } }
        ] 
    },
    { 
        title: "💀 亡靈骨海中的生鏽金幣堆", 
        desc: "骷髏坑底埋著一堆沾滿骨粉的生鏽古董金幣。", 
        choices: [
            { text: "💰 跳下骨坑搜刮（獲得 250G 金幣，但 VIT -2）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; run.gold += 250; meta.stats.VIT = Math.max(0, meta.stats.VIT - 2); safeRefreshStats(); return "💀 拿到了巨款！但你吸入屍毒，體質受到些微腐蝕。"; } }
        ] 
    },
    { 
        title: "💧 發光史萊姆大母體遺蛻", 
        desc: "一坨巨大的發光凝膠倒在地上，雖然已失去生命活性，但魔力驚人。", 
        choices: [
            { text: "🍳 割下吞食（INT +5）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.INT += 5; safeRefreshStats(); return "🔮 魔力凝膠在食道化為磅礡魔力 (INT +5)！"; } }
        ] 
    },
    { 
        title: "🧚 森林小仙子的感恩禮物", 
        desc: "你救了一隻卡在裂縫裏的小花仙，她對你表示感謝。", 
        choices: [
            { text: "💐 接受生命祝福（VIT +3, AGI +3）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.VIT += 3; meta.stats.AGI += 3; safeRefreshStats(); return "✨ 花仙對你吹拂花粉，體質與步履變得無比輕盈 (VIT+3, AGI+3)！"; } }
        ] 
    },
    { 
        title: "🏛️ 皇家魔導加工所的終極餽贈", 
        desc: "廢墟深處有一個古老的神匠大熔爐，你可以選擇淬火武器。", 
        choices: [
            { text: "🗡️ 淬鍊武器（武器槽位精鍊升星 1 星！）", run: (run, meta) => { if(!meta.equipmentStars) meta.equipmentStars = { weapon: 0, armor: 0, accessory: 0 }; if(meta.equipmentStars.weapon < 5) { meta.equipmentStars.weapon++; safeRefreshStats(); return "🌟 熔爐咆哮！你的武器部位得到完美的淬火強化，威力提升。"; } else { return "🌟 你的武器部位已是 5 星，神匠餽贈回復了你 50 MP。"; } } }
        ] 
    }
];
