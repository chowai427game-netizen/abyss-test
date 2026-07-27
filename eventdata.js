// ==========================================================================
// 🌀 eventdata.js：邪神與仙子事件 & 隨機寶箱數據庫 (含戰術背包上限安全防護)
// ==========================================================================

const ABYSS_EVENTS_DATABASE = [
    {
        title: "🩸 命運邪神祭壇 • 血脈契約",
        desc: "虛空中傳來邪神的低語，祂要求你用體質換取無上的力量 (STR)。",
        choices: [
            { text: "🩸 簽署契約（代價: VIT -2, 報酬: STR +6）", run: (run, meta) => { if(!meta.stats) meta.stats = {STR:0,AGI:0,VIT:0,INT:0,DEX:0,LUK:0}; meta.stats.VIT = Math.max(0, meta.stats.VIT - 2); meta.stats.STR += 6; if(typeof resetCurrentRunData==="function") resetCurrentRunData(); return "🩸 你用靈魂之血換取了通紅的殺意！(STR +6, VIT -2)"; } },
            { text: "🏃 拒絕轉身離開", run: () => "🏃 你謹慎地避開了邪神的誘惑，神經重新緊繃。" }
        ]
    },
    {
        title: "🧚 迷落的深淵精靈仙子",
        desc: "一隻翅膀受傷的發光小仙子倒在廢墟中，你可以選擇分給她一點魔力，或者粗暴地將其捏碎吸取精華。",
        choices: [
            { text: "🪄 灌注微量魔力（代價: MP -15, 報酬: INT +3, LUK +3）", run: (run, meta) => { run.mp = Math.max(0, run.mp - 15); meta.stats.INT += 3; meta.stats.LUK += 3; if(typeof resetCurrentRunData==="function") resetCurrentRunData(); return "✨ 精靈仙子圍繞著你翩翩起舞，賜予你智慧與幸運的加冕！"; } },
            { text: "🩸 殘忍捏碎（報酬: STR +3, 隨機獲得史萊姆黏液 x1）", run: (run, meta) => { meta.stats.STR += 3; meta.warehouse["史萊姆黏液"] = (meta.warehouse["史萊姆黏液"] || 0) + 1; if(typeof resetCurrentRunData==="function") resetCurrentRunData(); return "💀 你冷酷地捏碎了仙子，狂暴力量湧入體內 (STR +3)！"; } }
        ]
    },
    {
        title: "🏕️ 遺留的冒險者營地篝火",
        desc: "一個空無一人的帳篷，篝火還殘留著微熱。你可以在這裡睡一覺，或者仔細搜刮他的帳篷。",
        choices: [
            { text: "💤 在篝火旁小憩（回復 80 HP，回復 30 MP）", run: (run) => { run.hp = Math.min(run.maxHp, run.hp + 80); run.mp = Math.min(run.maxMp, run.mp + 30); return "💤 溫暖的營火重整了你的神經。"; } },
            { text: "🔍 仔細搜刮帳篷（獲得 80G 金幣，但有 50% 機率踩到生鏽陷阱扣 20 HP）", run: (run) => { if(Math.random() < 0.5) { run.hp = Math.max(1, run.hp - 20); run.gold += 80; return "💥 搜刮到了金幣！但你踩到營地的主人布下的夾子，腳踝受創！"; } else { run.gold += 80; return "🪙 完美避開了預警線，搜刮到了一袋沉甸甸的金幣！"; } } }
        ]
    },
    {
        title: "🧙 黑市魔液調配師",
        desc: "一個渾身散發藥草氣味的哥布林隱士擋在路上，拿出一瓶五彩斑斕的試劑，要你喝下去。",
        choices: [
            { text: "🧪 一口乾了它！（隨機觸發: AGI +5 / 中毒扣 25 HP）", run: (run, meta) => { if(Math.random() < 0.5) { meta.stats.AGI += 5; if(typeof resetCurrentRunData==="function") resetCurrentRunData(); return "🧪 你的肌肉神經反應爆發，敏捷狂飆 (AGI +5)！"; } else { run.hp = Math.max(5, run.hp - 25); return "🤢 這瓶魔液劇毒無比！你當場狂吐，胃部灼燒。"; } } },
            { text: "🏃 搖搖頭，快步走開", run: () => "🏃 隱士對著你發出瘋癲的怪笑，你迅速離去。" }
        ]
    },
    {
        title: "🧱 坍塌的重力魔導石碑",
        desc: "石碑上流轉著反重力的奇異電波，你可以將手放上去感悟力場規律。",
        choices: [
            { text: "🧿 感悟重力力場（INT +3, DEX +3）", run: (run, meta) => { meta.stats.INT += 3; meta.stats.DEX += 3; if(typeof resetCurrentRunData==="function") resetCurrentRunData(); return "🌀 重力偏折，你的詠唱與命中大幅提升 (INT+3, DEX+3)！"; } },
            { text: "🪓 暴力砸毀（獲得 150G 金幣，但受到 30 點重力反震真實創傷）", run: (run) => { run.hp = Math.max(1, run.hp - 30); run.gold += 150; return "💥 石碑碎裂，露出了裏面鑲嵌的遠古金幣！"; } }
        ]
    },
    { 
        title: "🦴 腐爛的巨大遠古龍獸屍骸", 
        desc: "這裏躺著一具龐大的巨龍遺骸，你可以選擇在龍牙下祈禱，或者冒險伸手進食道深處掏取寶物。", 
        choices: [
            { text: "🧎 跪地祈禱（LUK +4，暴擊與完迴提升）", run: (run, meta) => { meta.stats.LUK += 4; if(typeof resetCurrentRunData==="function") resetCurrentRunData(); return "✨ 龍威洗禮，你的幸運氣場大幅增強 (LUK +4)！"; } },
            { text: "🔍 伸手掏取（50% 機率獲得「硬殼龜甲」x1 / 50% 毒素扣 25 HP）", run: (run, meta) => { if(Math.random()<0.5) { meta.warehouse["硬殼龜甲"] = (meta.warehouse["硬殼龜甲"]||0)+1; return "🎁 居然摸到了地底巨獸反芻出來的硬殼龜甲！"; } else { run.hp = Math.max(1, run.hp - 25); return "🤢 一條毒蟒咬了你的手！毒素侵蝕你的心神。"; } } }
        ] 
    },
    { 
        title: "⛲ 墮落天使的生命聖泉", 
        desc: "泉水散發著紫金色的光芒，極具誘惑力。你敢喝嗎？", 
        choices: [
            { text: "🍻 暢飲聖泉（生命值滿回復，且 MP 滿回復）", run: (run) => { run.hp = run.maxHp; run.mp = run.maxMp; return "✨ 泉水洗滌了你全身的疲憊與傷痕！"; } },
            { text: "🧪 裝入瓶中帶走（獲得「🌭 大快活厚牛巨堡」x1，但扣 30G）", run: (run, meta) => { 
                if(run.gold >= 30) { 
                    run.gold -= 30; 
                    if (!run.inventory) run.inventory = [];
                    if (run.inventory.length < (typeof MAX_BAG_SIZE !== "undefined" ? MAX_BAG_SIZE : 6)) {
                        run.inventory.push("🌭 大快活厚牛巨堡");
                        return "🎁 你用紙杯裝了一杯泉水塞進包包！"; 
                    } else {
                        meta.warehouse["🌭 大快活厚牛巨堡"] = (meta.warehouse["🌭 大快活厚牛巨堡"] || 0) + 1;
                        return "📦 快捷背包已滿，獎勵直接快遞回村莊倉庫！";
                    }
                } else { 
                    return "🪙 你兜裏沒零錢買瓶子，只好遺憾走開。"; 
                } 
            } }
        ] 
    }
];

const TREASURE_CHESTS_POOL = [
    { tier: "WOODEN", name: "🪵 生鏽的舊木箱", minGold: 10, maxGold: 30, isTrap: false, msg: "安全開啟，獲得少量行軍碎銀。" },
    { tier: "WOODEN", name: "🪵 哥布林隱密骨箱", minGold: 15, maxGold: 35, isTrap: false, msg: "裏面塞滿了哥布林搶來的碎銀子。" },
    { tier: "WOODEN", name: "🧱 苔蘚碎石木匣", minGold: 20, maxGold: 40, isTrap: false, msg: "揭開木匣，獲得古代銅幣。" },
    { tier: "GOLDEN", name: "👑 皇家耀金璀璨寶箱", minGold: 80, maxGold: 200, isTrap: false, msg: "金光閃閃！皇室御廚特製保險庫，財富豐厚！" },
    { tier: "GOLDEN", name: "👑 墮落神殿魔金寶箱", minGold: 100, maxGold: 220, isTrap: true, dmg: 25, msg: "【暗箭機關！】寶箱兩側射出鋼弩扣 25 HP，但你拿到了大把魔金！" },
    { tier: "GOLDEN", name: "💎 璀璨深淵鑽石寶箱", minGold: 150, maxGold: 300, isTrap: false, msg: "絕美奢華！鑽石切面折射流光，沒有任何機關！" },
    { tier: "GOLDEN", name: "👹 牙齒利刃擬態寶箱 (Mimic)", minGold: 50, maxGold: 150, isTrap: true, dmg: 35, msg: "【擬態巨怪！】寶箱突然長出獠牙咬你手臂扣 35 HP！你反手震碎它掏出金幣！" }
];
