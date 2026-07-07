// ==========================================================================
// 📦 itemdata.js：皇家道具、食材配方、神裝藍圖與黑市物資數據庫 (分類分頁版)
// ==========================================================================

// 1. 🛠️ 皇家魔導加工所：武器、防具、飾品【鍛造藍圖】(新增 levelRange)
const CRAFTING_BLUEPRINTS = [
    // === 🗡️ 武器類 ===
    {
        name: "🗡️ 獸王破甲重劍",
        type: "weapon",
        levelRange: "1-10",
        stats: { atk: 25, spd: -2 },
        ingredients: { "半獸人獸肉": 3, "史萊姆黏液": 2 },
        desc: "利用半獸人骨與黏液精煉嘅重劍，物理外傷 +25。"
    },
    {
        name: "🪄 祭司奧術短杖",
        type: "weapon",
        levelRange: "11-20",
        stats: { atk: 10, mpRegen: 8, spd: 3 },
        ingredients: { "祭司血清": 2, "巨石苔蘚": 1 },
        desc: "散發著黑魔法微光的短杖，使回魔速增加 (+8)。"
    },
    {
        name: "🌌 秩序主宰時空裂刃",
        type: "weapon",
        levelRange: "31-40",
        stats: { atk: 45, spd: 6 },
        ingredients: { "秩序核心": 1, "哥布林香料": 3 },
        desc: "【頂級神兵】扭曲空間結構太刀 (+45 攻擊, +6 速度)。"
    },

    // === 🛡️ 防具類 ===
    {
        name: "🛡️ 帝王蟹巨鎧防盾",
        type: "armor",
        levelRange: "31-40",
        stats: { block: 8, maxHp: 120 },
        ingredients: { "🦀 蟹王巨腿": 2, "巨石苔蘚": 2 },
        desc: "傳承重盾！物理面板減傷固定永久爆增 +8 點，最大生命上限 +120。"
    },
    {
        name: "👕 巨石守衛重甲",
        type: "armor",
        levelRange: "11-20",
        stats: { block: 12, maxHp: 60, spd: -4 },
        ingredients: { "巨石苔蘚": 3, "史萊姆黏液": 2 },
        desc: "融合遠古巨石板甲，提供極限防護 (+12 減傷)，但身軀變笨重。"
    },
    {
        name: "👟 疾風流螢輕靴",
        type: "armor",
        levelRange: "1-10",
        stats: { spd: 8, dodgeChance: 5 },
        ingredients: { "哥布林香料": 3, "怨靈淚晶": 1 },
        desc: "灌注了狂暴狂熱流速嘅原形戰靴，勇者攻擊速度 +8，完美閃避 +5%。"
    },

    // === 💍 飾品類 ===
    {
        name: "💍 怨靈咒縛哭泣指環",
        type: "accessory",
        levelRange: "1-10",
        stats: { critChance: 12, doubleStrike: 15 },
        ingredients: { "怨靈淚晶": 3, "史萊姆黏液": 1 },
        desc: "刺激殺意神經的指環，暴擊率 +12%，連擊率 +15%。"
    },
    {
        name: "📿 霜晶永凍不滅護身符",
        type: "accessory",
        levelRange: "21-30",
        stats: { dodgeChance: 8, vampRate: 10 },
        ingredients: { "永凍冰晶": 2, "半獸人獸肉": 1 },
        desc: "【流派核心】常駐散發極寒極光，完美閃避 +8%，附帶 10% 吸血！"
    }
];

// 2. 皇家廚藝配方效果映射 (新增 floorRange)
const RECIPES_DATABASE = [
    { name: "🍲 哥布林亂燉雜碎湯", floorRange: "B1-B10", ingredients: { "半獸人獸肉": 1, "哥布林香料": 1 }, type: "village_eat", desc: "進城前吃：最大生命值固定 +60 點。" },
    { name: "🌭 皇家大快活厚牛巨堡", floorRange: "B1-B10", ingredients: { "半獸人獸肉": 2, "史萊姆黏液": 1 }, type: "dungeon_use", desc: "局內攜帶：奶滿 100 點 HP，並加載 80 點物理盾。" },
    { name: "🍮 發光奧術史萊姆凍", floorRange: "B1-B10", ingredients: { "史萊姆黏液": 2, "巨石苔蘚": 1 }, type: "village_eat", desc: "進城前吃：Max MP +30，每回合回魔 +3。" },
    { name: "🍧 萬年永凍刨冰", floorRange: "B11-B20", ingredients: { "永凍冰晶": 1, "怨靈淚晶": 1 }, type: "dungeon_use", desc: "局內攜帶：對戰魔物強行陷入【凍結】狀態 2 回合。" },
    { name: "🍲 皇家銀河蟹肉宴", floorRange: "B31-B40", ingredients: { "🦀 蟹王巨腿": 1, "怨靈淚晶": 1 }, type: "village_eat", desc: "進城前吃：最大生命 +200 點，完美免疫凍結環境。" },
    { name: "🍷 秩序逆轉禁忌血釀", floorRange: "B31-B40", ingredients: { "秩序核心": 1, "祭司血清": 1 }, type: "dungeon_use", desc: "局內攜帶：直接強行跳過當前樓層戰鬥，安全降臨下一層。" }
];

// 3. 普通小怪素材掉落映射表
const MONSTER_DROPS = {
    "💧 藍色史萊姆": "史萊姆黏液", 
    "👺 綠皮哥布林": "哥布林香料", 
    "🐗 荒野半獸人": "半獸人獸肉", 
    "👻 迷途哭泣怨靈": "怨靈淚晶", 
    "🧱 古墓巨石守衛": "巨石苔蘚",
    "🧙 深淵墮落祭司": "祭司血清",
    "🧊 萬年霜凍冰魔": "永凍冰晶", 
    "🌌 虛空秩序扭曲者": "秩序核心", 
    "🌊 深淵巨鎧 Scylla": "🦀 蟹王巨腿"
};

// 4. 流浪黑市局內物資定價表
const MARKET_ITEMS_POOL = [
    { name: "🌭 皇家大快活厚牛巨堡", price: 45, desc: "立刻補滿 100 HP，並生成 80 點物理防盾。" },
    { name: "🍧 萬年永凍刨冰", price: 55, desc: "強行凍結魔物 2 回合，封鎖再生。" },
    { name: "🍷 秩序逆轉禁忌血釀", price: 130, desc: "空間扭曲！強行無傷跳過當前樓層怪。" }
];
