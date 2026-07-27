// ==========================================================================
// 📦 itemdata.js：皇家魔導熔爐 & 頂級料理食譜庫
// ==========================================================================

const CRAFTING_BLUEPRINTS = [
    { name: "🗡️ 獸王重劍", type: "weapon", range: "1-10", stats: { atk: 25, hit: 5, spd: -2 }, ingredients: { "獸人後腿肉": 3, "史萊姆黏液": 2 }, desc: "半獸人骨精鍊的重劍，攻擊力大提升。" },
    { name: "🏹 獵手短弓", type: "weapon", range: "1-10", stats: { atk: 15, hit: 12, spd: 4 }, ingredients: { "史萊姆黏液": 3, "哥布林香料": 1 }, desc: "輕快的新手木弓，大幅增加命中與速度。" },
    { name: "🗡️ 銹蝕刺針", type: "weapon", range: "1-10", stats: { atk: 18, hit: 8, spd: 1 }, ingredients: { "史萊姆黏液": 2, "獸人後腿肉": 1 }, desc: "鐵劍殘骸改造的刺針，手感平穩。" },
    { name: "🪓 哥布林柴刀", type: "weapon", range: "1-10", stats: { atk: 22, spd: -1 }, ingredients: { "哥布林香料": 4 }, desc: "綠皮魔物砍柴用的重型鋼刃。" },
    { name: "🪵 古木法杖", type: "weapon", range: "1-10", stats: { matk: 18, mpRegen: 3 }, ingredients: { "巨石苔蘚": 3, "怨靈淚晶": 1 }, desc: "刻有魔法陣的木質短法杖，增幅魔攻。" },
    
    { name: "👕 獸皮背心", type: "armor", range: "1-10", stats: { maxHp: 40, block: 2 }, ingredients: { "獸人後腿肉": 4 }, desc: "耐穿防風的基礎獸皮護甲。" },
    { name: "鞋 疾風輕靴", type: "armor", range: "1-10", stats: { spd: 8, flee: 6 }, ingredients: { "哥布林香料": 3, "怨靈淚晶": 1 }, desc: "流動著哥布林狂熱意志的戰靴，提升迴避。" },
    { name: "🛡️ 舊木圓盾", type: "armor", range: "1-10", stats: { block: 4, maxHp: 20 }, ingredients: { "巨石苔蘚": 3 }, desc: "表面長滿苔蘚的厚木板盾。" },
    { name: "👕 怨靈斗篷", type: "armor", range: "1-10", stats: { flee: 8, spd: 2, mdef: 2 }, ingredients: { "怨靈淚晶": 4 }, desc: "具有隱蔽特性的半透明舊披風。" },
    { name: "🛡️ 哥布林皮帽", type: "armor", range: "1-10", stats: { block: 1, mdef: 2, maxHp: 30 }, ingredients: { "哥布林香料": 2, "史萊姆黏液": 2 }, desc: "有陣怪味的防砸護面皮帽。" },
    
    { name: "💍 銅製指環", type: "accessory", range: "1-10", stats: { atk: 5, hit: 5 }, ingredients: { "史萊姆黏液": 3 }, desc: "打磨得很乾淨的基礎銅戒指。" },
    { name: "📿 石質護身符", type: "accessory", range: "1-10", stats: { block: 2, mdef: 2 }, ingredients: { "巨石苔蘚": 4 }, desc: "摸起來冰涼的防禦護心石。" },
    { name: "💍 怨靈哭泣指環", type: "accessory", range: "1-10", stats: { critChance: 8, hit: 6 }, ingredients: { "怨靈淚晶": 3, "史萊姆黏液": 2 }, desc: "激發佩戴者潛在殺意神經的邪環。" },
    { name: "📿 獸齒項鍊", type: "accessory", range: "1-10", stats: { critChance: 5, atk: 3 }, ingredients: { "獸人後腿肉": 3 }, desc: "掛滿銳利獸牙的部族飾品。" },
    { name: "💍 史萊姆黏膠指環", type: "accessory", range: "1-10", stats: { flee: 6 }, ingredients: { "史萊姆黏液": 5 }, desc: "滑溜溜難以被抓到的奇特膠戒。" },

    { name: "🗡️ 寒冰霜刃", type: "weapon", range: "11-20", stats: { atk: 38, hit: 8, spd: 2 }, ingredients: { "寒冰霜塵": 3, "史萊姆黏液": 2 }, desc: "永凍冰川淬鍊的霜刀，能遲滯對手。" },
    { name: "🪄 祭司奧術短杖", type: "weapon", range: "11-20", stats: { matk: 32, mpRegen: 8, mdef: 4 }, ingredients: { "暴君槌芯": 1, "巨石苔蘚": 3 }, desc: "魔導加工所的主打法杖，奧術回藍超神。" },
    { name: "🪓 劇毒雙刃狂斧", type: "weapon", range: "11-20", stats: { atk: 45, hit: -2, spd: -3 }, ingredients: { "毒蜘蛛腺體": 3, "獸人後腿肉": 2 }, desc: "斧刃淬了劇毒的重型狂戰斧。" },
    
    { name: "👕 守衛重甲", type: "armor", range: "11-20", stats: { block: 10, mdef: 4, maxHp: 60, spd: -4 }, ingredients: { "硬殼龜甲": 3, "巨石苔蘚": 2 }, desc: "融入堅硬背甲防護，極度防身但笨重。" },
    { name: "鞋 霜凍舞靴", type: "armor", range: "11-20", stats: { spd: 12, flee: 8 }, ingredients: { "寒冰霜塵": 3, "史萊姆黏液": 3 }, desc: "在冰面上也能如履平地的敏捷凍靴。" },
    
    { name: "💍 凍結晶環", type: "accessory", range: "11-20", stats: { critChance: 7, flee: 5 }, ingredients: { "寒冰霜塵": 4 }, desc: "永遠不會融化的純冰戒指。" },
    { name: "📿 毒網垂飾", type: "accessory", range: "11-20", stats: { hit: 8, atk: 5 }, ingredients: { "毒蜘蛛腺體": 3, "史萊姆黏液": 3 }, desc: "抽取蜘蛛毒腺製成的毒性鏈墜。" }
];

const RECIPES_DATABASE = [
    { name: "🍲 哥布林雜碎湯", range: "1-10", ingredients: { "獸人後腿肉": 1, "哥布林香料": 1 }, type: "village_eat", desc: "進城前吃：進入地下城前 15 層最大生命值固定 +60 點。" },
    { name: "🌭 大快活厚牛巨堡", range: "1-10", ingredients: { "獸人後腿肉": 2, "史萊姆黏液": 1 }, type: "dungeon_use", desc: "局內攜帶：戰鬥中吃當場奶滿 100 點 HP，並加載 80 點物理盾。" },
    { name: "🍵 苔蘚解毒清涼茶", range: "1-10", ingredients: { "巨石苔蘚": 2, "史萊姆黏液": 1 }, type: "village_eat", desc: "進城前吃：進入地下城後，每回合 MP 自動額外回復固定 +1。" },
    { name: "🥩 烤野豬肉大串", range: "1-10", ingredients: { "獸人後腿肉": 2 }, type: "dungeon_use", desc: "局內攜帶：咬一口當場回復 60 點 HP，並加載 20 點物理盾。" },
    { name: "🍬 怨靈薄荷糖", range: "1-10", ingredients: { "怨靈淚晶": 2, "史萊姆黏液": 1 }, type: "village_eat", desc: "進城前吃：激發精神活性，永久暴擊機率固定 +3%。" },

    { name: "🍮 奧術史萊姆凍", range: "11-20", ingredients: { "史萊姆黏液": 2, "巨石苔蘚": 1 }, type: "village_eat", desc: "進城前吃：Max MP 永久 +30，每回合 MP 自動回復固定 +3。" },
    { name: "🍧 萬年永凍刨冰", range: "21-30", ingredients: { "永凍冰晶": 1, "怨靈淚晶": 1 }, type: "dungeon_use", desc: "局內攜帶：當前對戰魔物強行陷入【凍結】狀態 2 回合（封鎖再生）。" },
    { name: "🍷 逆轉禁忌血釀", range: "41-50", ingredients: { "虛空核心": 1, "祭司血清": 1 }, type: "dungeon_use", desc: "局內攜帶：顛倒虛空！直接強行跳過當前樓層戰鬥，無傷安全降臨下一層。" }
];

const MARKET_ITEMS_POOL = [
    { name: "🌭 大快活厚牛巨堡", price: 45, desc: "立刻補滿 100 HP，並生成 80 點物理防盾。" },
    { name: "🍧 萬年永凍刨冰", price: 55, desc: "強行凍結魔物 2 回合，封鎖再生與反擊。" },
    { name: "🍷 逆轉禁忌血釀", price: 130, desc: "空間扭曲！強行蒸發並無傷跳過當前樓層怪。" },
    { name: "🧪 微光初級治癒藥水", price: 20, desc: "立刻回復 50 點 HP。" }
];
