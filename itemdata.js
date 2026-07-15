// ==========================================================================
// 📦 itemdata.js：皇家魔導熔爐 & 頂級料理食譜庫 (共120種藍圖)
// ==========================================================================

const CRAFTING_BLUEPRINTS = [
    // ==================== 🛠️ LEVEL 1-10 基礎魔導 ====================
    // Weapons
    { name: "🗡️ 獸王重劍", type: "weapon", range: "1-10", stats: { atk: 25, spd: -2 }, ingredients: { "獸人後腿肉": 3, "史萊姆黏液": 2 }, desc: "半獸人骨精煉的重劍，攻擊力大提升。" },
    { name: "🏹 獵手短弓", type: "weapon", range: "1-10", stats: { atk: 15, spd: 4 }, ingredients: { "史萊姆黏液": 3, "哥布林香料": 1 }, desc: "輕快的新手木弓，大幅增加攻擊速度。" },
    { name: "🗡️ 銹蝕刺針", type: "weapon", range: "1-10", stats: { atk: 18, spd: 1 }, ingredients: { "史萊姆黏液": 2, "獸人後腿肉": 1 }, desc: "鐵劍殘骸改造的刺針，手感平穩。" },
    { name: "🪓 哥布林柴刀", type: "weapon", range: "1-10", stats: { atk: 22, spd: -1 }, ingredients: { "哥布林香料": 4 }, desc: "綠皮魔物砍柴用的重型鋼刃。" },
    { name: "🪵 古木法杖", type: "weapon", range: "1-10", stats: { atk: 10, mpRegen: 3 }, ingredients: { "巨石苔蘚": 3, "怨靈淚晶": 1 }, desc: "刻有魔法陣的木質短法杖。" },
    // Armor
    { name: "👕 獸皮背心", type: "armor", range: "1-10", stats: { maxHp: 40, block: 2 }, ingredients: { "獸人後腿肉": 4 }, desc: "耐穿防風的基礎獸皮護甲。" },
    { name: "鞋 疾風輕靴", type: "armor", range: "1-10", stats: { spd: 8, dodgeChance: 5 }, ingredients: { "哥布林香料": 3, "怨靈淚晶": 1 }, desc: "流動著哥布林狂熱意志的戰靴。" },
    { name: "🛡️ 舊木圓盾", type: "armor", range: "1-10", stats: { block: 4, maxHp: 20 }, ingredients: { "巨石苔蘚": 3 }, desc: "表面長滿苔蘚的厚木板盾。" },
    { name: "👕 怨靈斗篷", type: "armor", range: "1-10", stats: { dodgeChance: 6, spd: 2 }, ingredients: { "怨靈淚晶": 4 }, desc: "具有隱蔽特性的半透明舊披風。" },
    { name: "🛡️ 哥布林皮帽", type: "armor", range: "1-10", stats: { block: 1, maxHp: 30 }, ingredients: { "哥布林香料": 2, "史萊姆黏液": 2 }, desc: "有陣怪味的防砸護面皮帽。" },
    // Accessories
    { name: "💍 銅製指環", type: "accessory", range: "1-10", stats: { atk: 5 }, ingredients: { "史萊姆黏液": 3 }, desc: "打磨得很乾淨的基礎銅戒指。" },
    { name: "📿 石質護身符", type: "accessory", range: "1-10", stats: { block: 2 }, ingredients: { "巨石苔蘚": 4 }, desc: "摸起來冰涼的防禦護心石。" },
    { name: "💍 怨靈哭泣指環", type: "accessory", range: "1-10", stats: { critChance: 8, doubleStrike: 5 }, ingredients: { "怨靈淚晶": 3, "史萊姆黏液": 2 }, desc: "激發佩戴者潛在殺意神經的邪環。" },
    { name: "📿 獸齒項鍊", type: "accessory", range: "1-10", stats: { critChance: 5 }, ingredients: { "獸人後腿肉": 3 }, desc: "掛滿銳利獸牙的部族飾品。" },
    { name: "💍 史萊姆黏膠指環", type: "accessory", range: "1-10", stats: { dodgeChance: 4 }, ingredients: { "史萊姆黏液": 5 }, desc: "滑溜溜難以被抓到的奇特膠戒。" },

    // ==================== ❄️ LEVEL 11-20 寒霜淬鍊 ====================
    // Weapons
    { name: "🗡️ 寒冰霜刃", type: "weapon", range: "11-20", stats: { atk: 38, spd: 2 }, ingredients: { "寒冰霜塵": 3, "史萊姆黏液": 2 }, desc: "永凍冰川淬鍊的霜刀，能遲滯對手。" },
    { name: "🪄 祭司奧術短杖", type: "weapon", range: "11-20", stats: { atk: 18, mpRegen: 8 }, ingredients: { "暴君槌芯": 1, "巨石苔蘚": 3 }, desc: "魔導加工所的主打法杖，奧術回藍超神。" },
    { name: "🪓 劇毒雙刃狂斧", type: "weapon", range: "11-20", stats: { atk: 45, spd: -3 }, ingredients: { "毒蜘蛛腺體": 3, "獸人後腿肉": 2 }, desc: "斧刃淬了劇毒的重型狂戰斧。" },
    { name: "🗡️ 冰晶銳刺", type: "weapon", range: "11-20", stats: { atk: 32, critChance: 6 }, ingredients: { "寒冰霜塵": 2, "怨靈淚晶": 3 }, desc: "像冰錐一樣銳利的突刺短劍。" },
    { name: "🏹 怨念強弓", type: "weapon", range: "11-20", stats: { atk: 28, spd: 5 }, ingredients: { "怨念皮翼": 3, "哥布林香料": 2 }, desc: "由蝙蝠骨架和皮翼拉絲製成的獵弓。" },
    // Armor
    { name: "👕 守衛重甲", type: "armor", range: "11-20", stats: { block: 10, maxHp: 60, spd: -4 }, ingredients: { "硬殼龜甲": 3, "巨石苔蘚": 2 }, desc: "融入堅硬背甲防護，極度防身但笨重。" },
    { name: "鞋 霜凍舞靴", type: "armor", range: "11-20", stats: { spd: 12, dodgeChance: 4 }, ingredients: { "寒冰霜塵": 3, "史萊姆黏液": 3 }, desc: "在冰面上也能如履平地的敏捷凍靴。" },
    { name: "👕 毒霧皮大衣", type: "armor", range: "11-20", stats: { maxHp: 100, block: 3 }, ingredients: { "毒蜘蛛腺體": 2, "腐屍毒素": 2 }, desc: "散發出刺鼻蛛毒氣味的厚皮大衣。" },
    { name: "🛡️ 霜殼巨盾", type: "armor", range: "11-20", stats: { block: 8, maxHp: 50 }, ingredients: { "硬殼龜甲": 2, "寒冰霜塵": 2 }, desc: "凍結水汽覆蓋的巨型龜甲防盾。" },
    { name: "👕 蝙蝠皮護額", type: "armor", range: "11-20", stats: { dodgeChance: 6, maxHp: 40 }, ingredients: { "怨念皮翼": 4 }, desc: "賦予微弱夜視和聲吶感知能力的輕型護額。" },
    // Accessories
    { name: "💍 凍結晶環", type: "accessory", range: "11-20", stats: { critChance: 7, dodgeChance: 3 }, ingredients: { "寒冰霜塵": 4 }, desc: "永遠不會融化的純冰戒指。" },
    { name: "📿 毒網垂飾", type: "accessory", range: "11-20", stats: { vampRate: 6 }, ingredients: { "毒蜘蛛腺體": 3, "史萊姆黏液": 3 }, desc: "抽取蜘蛛毒腺製成的吸血鏈墜。" },
    { name: "💍 祭司守護指環", type: "accessory", range: "11-20", stats: { block: 4, mpRegen: 3 }, ingredients: { "祭司血清": 1, "巨石苔蘚": 2 }, desc: "銘刻了墮落神殿防禦禱文的銀環。" },
    { name: "📿 枯骨吊墜", type: "accessory", range: "11-20", stats: { maxHp: 60 }, ingredients: { "腐屍毒素": 3, "怨靈淚晶": 3 }, desc: "散發死亡氣息的骷髏吊墜。" },
    { name: "💍 鋼殼重戒", type: "accessory", range: "11-20", stats: { block: 5 }, ingredients: { "硬殼龜甲": 3 }, desc: "用陸龜最硬的那塊殼打磨成的指環。" },

    // ==================== 🔥 LEVEL 21-30 熔岩精煉 (⚠️ 開始回收低層材料) ====================
    // Weapons
    { name: "🗡️ 烈焰熔劍", type: "weapon", range: "21-30", stats: { atk: 65, spd: -2 }, ingredients: { "烈焰餘燼": 3, "史萊姆黏液": 5 }, desc: "將焦土烈焰灌注鐵劍的熔岩重劍。" },
    { name: "🏹 爆熱強弩", type: "weapon", range: "21-30", stats: { atk: 50, spd: 6 }, ingredients: { "熔岩鱗片": 3, "哥布林香料": 5 }, desc: "弓弦以高熱鱗片拉絲製成的重型手弩。" },
    { name: "🗡️ 地獄赤骨匕首", type: "weapon", range: "21-30", stats: { atk: 45, critChance: 12 }, ingredients: { "焦黑骨碎": 4, "怨靈淚晶": 6 }, desc: "刺激殺意的邪骨尖刃，暴擊率驚人。" },
    { name: "🪓 食人魔震盪裂斧", type: "weapon", range: "21-30", stats: { atk: 75, spd: -5 }, ingredients: { "食人魔厚皮": 3, "獸人後腿肉": 5 }, desc: "沈重無比的虐殺巨斧，力透紙背。" },
    { name: "🪄 禁忌熔岩法杖", type: "weapon", range: "21-30", stats: { atk: 35, mpRegen: 10 }, ingredients: { "魔導碎頁": 3, "巨石苔蘚": 5 }, desc: "熔岩魔力流轉的法杖，回藍效能更強。" },
    // Armor
    { name: "👕 熔岩重型鎧甲", type: "armor", range: "21-30", stats: { block: 16, maxHp: 120, spd: -5 }, ingredients: { "熔岩鱗片": 4, "硬殼龜甲": 3 }, desc: "結合龜甲與熔岩高溫板甲，防禦超凡。" },
    { name: "鞋 赤炎推進皮靴", type: "armor", range: "21-30", stats: { spd: 18, dodgeChance: 6 }, ingredients: { "烈焰餘燼": 3, "寒冰霜塵": 4 }, desc: "利用冷熱氣流噴射前進的蒸汽流皮靴。" },
    { name: "🛡️ 食人魔骨盾", type: "armor", range: "21-30", stats: { block: 12, maxHp: 80 }, ingredients: { "食人魔厚皮": 3, "獸人後腿肉": 6 }, desc: "包裹着食人魔堅韌厚皮的骨製大盾。" },
    { name: "👕 灰燼偽裝斗篷", type: "armor", range: "21-30", stats: { dodgeChance: 10, spd: 4 }, ingredients: { "烈焰餘燼": 2, "怨念皮翼": 5 }, desc: "由火山灰燼與蝙蝠皮膜織成的暗影披風。" },
    { name: "🛡️ 熔火防爆頭盔", type: "armor", range: "21-30", stats: { block: 6, maxHp: 100 }, ingredients: { "焦黑骨碎": 3, "毒蜘蛛腺體": 4 }, desc: "覆蓋蛛網隔熱層的火山探索鋼盔。" },
    // Accessories
    { name: "💍 暴烈灰燼指環", type: "accessory", range: "21-30", stats: { atk: 15, critChance: 5 }, ingredients: { "烈焰餘燼": 4, "史萊姆黏液": 8 }, desc: "每捏碎一次手指都帶有微量爆發的指環。" },
    { name: "📿 熔岩不滅護身符", type: "accessory", range: "21-30", stats: { vampRate: 10, dodgeChance: 5 }, ingredients: { "熔岩鱗片": 3, "寒冰霜塵": 5 }, desc: "【流派核心】冰火相融，賦予強大的吸血割裂感。" },
    { name: "💍 禁忌魔導書指環", type: "accessory", range: "21-30", stats: { mpRegen: 12 }, ingredients: { "魔導碎頁": 4, "巨石苔蘚": 6 }, desc: "鑲崁了殘缺魔法書頁的智慧魔戒。" },
    { name: "📿 赤骨項鍊", type: "accessory", range: "21-30", stats: { doubleStrike: 12 }, ingredients: { "焦黑骨碎": 3, "怨靈淚晶": 6 }, desc: "用被灼燒骷髏齒骨穿成的戰鬥頸鍊。" },
    { name: "💍 食人魔蠻力戒", type: "accessory", range: "21-30", stats: { block: 8, maxHp: 50 }, ingredients: { "食人魔厚皮": 4, "獸人後腿肉": 6 }, desc: "大大激發肌肉力量的粗獷鐵環。" },

    // ==================== 🌀 LEVEL 31-40 虛空時空 (⚠️ 精煉縫合低層材料) ====================
    // Weapons
    { name: "🗡️ 虛空時空裂刃", type: "weapon", range: "31-40", stats: { atk: 95, spd: 8 }, ingredients: { "虛空眼球": 3, "時空皮革": 2, "史萊姆黏液": 10 }, desc: "【頂級神兵】扭曲虛空時空打造的太刀。" },
    { name: "🏹 異次元黑洞巨弓", type: "weapon", range: "31-40", stats: { atk: 75, spd: 12 }, ingredients: { "吸血毒牙": 4, "時空皮革": 3, "哥布林香料": 10 }, desc: "射出的箭矢帶有微弱時空牽引力的長弓。" },
    { name: "🗡️ 符文刻印大劍", type: "weapon", range: "31-40", stats: { atk: 110, spd: -4 }, ingredients: { "符文石板": 4, "巨石苔蘚": 10 }, desc: "巨重石板雕琢而成，刻滿了爆烈符文。" },
    { name: "🪓 九頭蛇狂暴血斧", type: "weapon", range: "31-40", stats: { atk: 85, vampRate: 12 }, ingredients: { "九頭蛇血": 3, "獸人後腿肉": 10 }, desc: "用九頭蛇蛇毒與活性血淬鍊的嗜血狂斧。" },
    { name: "🪄 虛空眼球凝視法杖", type: "weapon", range: "31-40", stats: { atk: 55, mpRegen: 16 }, ingredients: { "虛空眼球": 4, "魔導碎頁": 5 }, desc: "頂端鑲嵌活體眼球的詭異法杖，增幅魔力。" },
    // Armor
    { name: "🛡️ 帝王蟹巨型重盾", type: "armor", range: "31-40", stats: { block: 25, maxHp: 250, spd: -6 }, ingredients: { "帝王蟹腿": 2, "硬殼龜甲": 6 }, desc: "海中巨鎧霸主巨螯改造，減傷高達 25 點！" },
    { name: "👕 時空閃爍皮甲", type: "armor", range: "31-40", stats: { maxHp: 180, dodgeChance: 12 }, ingredients: { "時空皮革": 4, "怨念皮翼": 8 }, desc: "時空皮革縫製，身體呈現半躍遷閃爍狀態。" },
    { name: "🛡️ 符文壁障面罩", type: "armor", range: "31-40", stats: { block: 15, maxHp: 150 }, ingredients: { "符文石板": 3, "焦黑骨碎": 6 }, desc: "散發出淡淡能量迴路幽光的防禦面罩。" },
    { name: "👕 九頭蛇皮鱗甲", type: "armor", range: "31-40", stats: { maxHp: 300, block: 10 }, ingredients: { "九頭蛇血": 2, "熔岩鱗片": 5 }, desc: "帶有超強自愈活性細胞的多層皮甲。" },
    { name: "鞋 虛空躍遷之靴", type: "armor", range: "31-40", stats: { spd: 25, dodgeChance: 8 }, ingredients: { "時空皮革": 3, "寒冰霜塵": 8 }, desc: "輕輕起跳就能向前躍遷半米的時空靴。" },
    // Accessories
    { name: "💍 虛空之眼死光戒", type: "accessory", range: "31-40", stats: { critChance: 15, doubleStrike: 10 }, ingredients: { "虛空眼球": 4, "烈焰餘燼": 8 }, desc: "凝視它的深淵，深淵回饋你致命的暴擊率。" },
    { name: "📿 時空摺疊護身符", type: "accessory", range: "31-40", stats: { dodgeChance: 12 }, ingredients: { "時空皮革": 4, "毒蜘蛛腺體": 8 }, desc: "將佩戴者周邊的時空進行微米摺疊的魔器。" },
    { name: "💍 吸血鬼尖牙牙環", type: "accessory", range: "31-40", stats: { vampRate: 15 }, ingredients: { "吸血毒牙": 4, "腐屍毒素": 10 }, desc: "將妖蝠毒牙內彎製成的殘忍吸血戒指。" },
    { name: "📿 碑文殘片掛飾", type: "accessory", range: "31-40", stats: { block: 12, maxHp: 100 }, ingredients: { "符文石板": 4, "巨石苔蘚": 8 }, desc: "上古遺蹟斷碑殘片串成的重型護身符。" },
    { name: "💍 活性蛇血指環", type: "accessory", range: "31-40", stats: { maxHp: 150, mpRegen: 5 }, ingredients: { "九頭蛇血": 3, "史萊姆黏液": 12 }, desc: "戴上後能感受到心跳同步狂飆的活性血戒。" },

    // ==================== 👿 LEVEL 41-50 惡魔煉獄 (⚠️ 精煉縫合中低層材料) ====================
    // Weapons
    { name: "🗡️ 惡魔狂怒大劍", type: "weapon", range: "41-50", stats: { atk: 150, spd: -5 }, ingredients: { "惡魔之角": 3, "獸人後腿肉": 15 }, desc: "熔鑄了深淵惡魔長角，暴力美學的終極代表。" },
    { name: "🗡️ 墜落暗刃太刀", type: "weapon", range: "41-50", stats: { atk: 120, spd: 14 }, ingredients: { "暗刃鋼片": 4, "時空皮革": 6 }, desc: "漆黑吸光的暗殺寶刀，出刀無聲，速度絕倫。" },
    { name: "🪓 奪心者靈魂撕裂斧", type: "weapon", range: "41-50", stats: { atk: 135, critChance: 18 }, ingredients: { "奪心碎晶": 3, "焦黑骨碎": 10 }, desc: "揮舞時能產生精神噪音，直接擊碎靈魂防線。" },
    { name: "🗡️ 烈地黑龍爪刃", type: "weapon", range: "41-50", stats: { atk: 140, doubleStrike: 15 }, ingredients: { "地龍魔爪": 3, "熔岩鱗片": 8 }, desc: "地底惡龍利爪尖端拼裝而成的爪刃，撕裂傷拉滿。" },
    { name: "🪄 泣血妖花劇毒魔杖", type: "weapon", range: "41-50", stats: { atk: 80, mpRegen: 22 }, ingredients: { "泣血花瓣": 4, "魔導碎頁": 12 }, desc: "妖豔魔花攀附的劇毒短杖，奧術迴路空前暢通。" },
    // Armor
    { name: "👕 狂魔胸甲", type: "armor", range: "41-50", stats: { block: 35, maxHp: 400, spd: -6 }, ingredients: { "惡魔之角": 3, "硬殼龜甲": 12 }, desc: "融合惡魔之角和龜殼淬鍊的惡魔護身鎧。" },
    { name: "👕 暗影夜行緊身衣", type: "armor", range: "41-50", stats: { maxHp: 280, dodgeChance: 18 }, ingredients: { "暗刃鋼片": 3, "時空皮革": 8 }, desc: "穿戴後整個人融入地貌陰影，閃避率狂飆。" },
    { name: "🛡️ 精神壁障重盾", type: "armor", range: "41-50", stats: { block: 28, maxHp: 300 }, ingredients: { "奪心碎晶": 3, "符文石板": 8 }, desc: "散發出暗紫色精神能量磁場的念動巨盾。" },
    { name: "👕 龍鱗隔熱防護衣", type: "armor", range: "41-50", stats: { maxHp: 500, block: 20 }, ingredients: { "地龍魔爪": 2, "食人魔厚皮": 10 }, desc: "地龍護體鱗片精心織造，隔熱性能與強度極佳。" },
    { name: "鞋 泣血幻步花靴", type: "armor", range: "41-50", stats: { spd: 35, dodgeChance: 12 }, ingredients: { "泣血花瓣": 4, "寒冰霜塵": 12 }, desc: "每走一步都會在大地上短暫留下一道血色花瓣殘影。" },
    // Accessories
    { name: "💍 惡魔之角碎骨戒", type: "accessory", range: "41-50", stats: { atk: 35, critChance: 8 }, ingredients: { "惡魔之角": 4, "烈焰餘燼": 12 }, desc: "用惡魔角質骨粉混合秘銀燒鑄的強擊指環。" },
    { name: "📿 暗影之鋼項鍊", type: "accessory", range: "41-50", stats: { doubleStrike: 18, spd: 8 }, ingredients: { "暗刃鋼片": 4, "怨念皮翼": 12 }, desc: "極細暗影鋼絲穿成的頸鍊，能引導肌肉做出殘影追擊。" },
    { name: "💍 奪心碎晶幻覺指環", type: "accessory", range: "41-50", stats: { dodgeChance: 15 }, ingredients: { "奪心碎晶": 4, "毒蜘蛛腺體": 12 }, desc: "能使周圍怪物的視覺與感知產生偏移的迷幻魔戒。" },
    { name: "📿 巨龍魔骨護身符", type: "accessory", range: "41-50", stats: { maxHp: 250, block: 15 }, ingredients: { "地龍魔爪": 3, "巨石苔蘚": 15 }, desc: "穿透了地龍背骨，常駐散發龍威的守護護符。" },
    { name: "💍 泣血花吻戒指", type: "accessory", range: "41-50", stats: { vampRate: 20 }, ingredients: { "泣血花瓣": 4, "史萊姆黏液": 16 }, desc: "【吸血神戒】每一次攻擊都宛如妖花之吻，嗜血吸生。" },

    // ==================== 🪐 LEVEL 51-60 混沌星塵 (⚠️ 終極融合與全層材料回收) ====================
    // Weapons
    { name: "🗡️ 終焉寂滅星雲刃", type: "weapon", range: "51-60", stats: { atk: 260, spd: 15 }, ingredients: { "星塵碎片": 5, "死神鐮刃": 3, "時空皮革": 12 }, desc: "【紀元至高神兵】斬斷因果，蘊藏了星雲爆炸的極致破壞力。" },
    { name: "🪓 混沌吞噬寂滅巨斧", type: "weapon", range: "51-60", stats: { atk: 320, spd: -8 }, ingredients: { "混沌核心": 4, "惡魔之角": 6, "獸人後腿肉": 25 }, desc: "斧柄由黑魔長角拼裝，斧刃乃混沌風暴本身，碎甲第一。" },
    { name: "🗡️ 重力塌陷碎星錘", type: "weapon", range: "51-60", stats: { atk: 280, block: 20 }, ingredients: { "重力奇點": 4, "符文石板": 10, "巨石苔蘚": 20 }, desc: "揮舞時能產生重力偏折，大幅度增加自身防禦面板與重量感。" },
    { name: "🏹 裁決神聖之翼戰弓", type: "weapon", range: "51-60", stats: { atk: 210, doubleStrike: 25 }, ingredients: { "裁決羽毛": 5, "暗刃鋼片": 8, "哥布林香料": 20 }, desc: "用神使鋼羽編織的機關戰弓，能傾瀉暴風般的追擊連射。" },
    { name: "🪄 星塵秩序法陣魔杖", type: "weapon", range: "51-60", stats: { atk: 150, mpRegen: 35 }, ingredients: { "星塵碎片": 4, "奪心碎晶": 8, "魔導碎頁": 15 }, desc: "【不滅法杖】頂端匯聚星塵風暴，奧術回魔與傷害史詩共振。" },
    // Armor
    { name: "👕 宇宙混沌不滅戰鎧", type: "armor", range: "51-60", stats: { block: 60, maxHp: 800, spd: -8 }, ingredients: { "混沌核心": 4, "地龍魔爪": 10, "硬殼龜甲": 20 }, desc: "終極防線！集惡龍爪與陸龜甲、混沌材料，防禦驚天動地。" },
    { name: "👕 織星斗篷", type: "armor", range: "51-60", stats: { maxHp: 500, dodgeChance: 25 }, ingredients: { "星塵碎片": 4, "時空皮革": 12, "怨念皮翼": 15 }, desc: "用流星落下的織網製成的斗篷，閃避與生命並存。" },
    { name: "🛡️ 重力奇點扭曲神盾", type: "armor", range: "51-60", stats: { block: 45, maxHp: 600 }, ingredients: { "重力奇點": 4, "硬殼龜甲": 15, "焦黑骨碎": 15 }, desc: "中心鑲嵌重力奇異點，能讓襲來的物理打擊軌跡發生偏折。" },
    { name: "👕 死神寂滅風衣", type: "armor", range: "51-60", stats: { maxHp: 450, spd: 40 }, ingredients: { "死神鐮刃": 3, "暗刃鋼片": 10, "時空皮革": 10 }, desc: "死神黑霧繚繞的殘破風衣，穿戴後速度突破常理上限。" },
    { name: "🛡️ 秩序判決皇冠", type: "armor", range: "51-60", stats: { block: 30, maxHp: 550 }, ingredients: { "裁決羽毛": 4, "奪心碎晶": 10, "符文石板": 12 }, desc: "神聖羽毛與銘刻石板鑲鑄而成的判決頭盔，全防提升。" },
    // Accessories
    { name: "💍 星塵風暴流光戒", type: "accessory", range: "51-60", stats: { critChance: 25, doubleStrike: 15 }, ingredients: { "星塵碎片": 5, "吸血毒牙": 12, "烈焰餘燼": 20 }, desc: "極光盤旋的指環，使狂暴連砍和致命暴擊率發生史詩級爆發。" },
    { name: "📿 混沌黑洞項鍊", type: "accessory", range: "51-60", stats: { vampRate: 25 }, ingredients: { "混沌核心": 4, "吸血毒牙": 15, "腐屍毒素": 20 }, desc: "【無盡吸血】核心如同一顆永動黑洞，將敵人的生命瘋狂剥奪。" },
    { name: "💍 奇點時空重力環", type: "accessory", range: "51-60", stats: { block: 20, spd: 15 }, ingredients: { "重力奇點": 4, "毒蜘蛛腺體": 15, "寒冰霜塵": 20 }, desc: "極大改寫身體重力密度的臂環，同時增加爆發速度與減傷。" },
    { name: "📿 死神寂滅吊墜", type: "accessory", range: "51-60", stats: { critChance: 20, vampRate: 15 }, ingredients: { "死神鐮刃": 3, "九頭蛇血": 12, "怨靈淚晶": 20 }, desc: "吊墜由骷髏死牙製成，佩戴者攻擊會觸發極度嗜血與收割效果。" },
    { name: "💍 秩序審判天之戒", type: "accessory", range: "51-60", stats: { maxHp: 400, mpRegen: 15 }, ingredients: { "裁決羽毛": 4, "九頭蛇血": 12, "史萊姆黏液": 25 }, desc: "神羽天光庇護，大幅增加精神防禦、MP 回復及生命上限。" }
];

const RECIPES_DATABASE = [
    // ==================== 🍳 LEVEL 1-10 基礎行軍 ====================
    { name: "🍲 哥布林雜碎湯", range: "1-10", ingredients: { "獸人後腿肉": 1, "哥布林香料": 1 }, type: "village_eat", desc: "進城前吃：進入地下城前 15 層最大生命值固定 +60 點。" },
    { name: "🌭 大快活厚牛巨堡", range: "1-10", ingredients: { "獸人後腿肉": 2, "史萊姆黏液": 1 }, type: "dungeon_use", desc: "局內攜帶：戰鬥中吃當場奶滿 100 點 HP，並加載 80 點物理盾。" },
    { name: "🍵 苔蘚解毒清涼茶", range: "1-10", ingredients: { "巨石苔蘚": 2, "史萊姆黏液": 1 }, type: "village_eat", desc: "進城前吃：進入地下城後，每回合 MP 自動額外回復固定 +1。" },
    { name: "🥩 烤野豬肉大串", range: "1-10", ingredients: { "獸人後腿肉": 2 }, type: "dungeon_use", desc: "局內攜帶：咬一口當場回復 60 點 HP，並加載 20 點物理盾。" },
    { name: "🍬 怨靈薄荷糖", range: "1-10", ingredients: { "怨靈淚晶": 2, "史萊姆黏液": 1 }, type: "village_eat", desc: "進城前吃：激發精神活性，永久暴擊機率固定 +3%。" },

    // ==================== 🍳 LEVEL 11-20 寒霜抗性 ====================
    { name: "🍮 奧術史萊姆凍", range: "11-20", ingredients: { "史萊姆黏液": 2, "巨石苔蘚": 1 }, type: "village_eat", desc: "進城前吃：Max MP 永久 +30，每回合 MP 自動回復固定 +3。" },
    { name: "🍧 萬年永凍刨冰", range: "21-30", ingredients: { "永凍冰晶": 1, "怨靈淚晶": 1 }, type: "dungeon_use", desc: "局內攜帶：當前對戰魔物強行陷入【凍結】狀態 2 回合（封鎖再生）。" },
    { name: "🍲 霜殼滋補陸龜湯", range: "11-20", ingredients: { "硬殼龜甲": 1, "獸人後腿肉": 2 }, type: "village_eat", desc: "進城前吃：體表硬化，戰鬥開始時永久獲得 150 點物理晶體防盾。" },
    { name: "🧪 毒腺烈性催化劑", range: "11-20", ingredients: { "毒蜘蛛腺體": 2, "史萊姆黏液": 2 }, type: "dungeon_use", desc: "局內攜帶：捏碎後對魔物造成 150 點即死毒屬性傷害。" },
    { name: "🥩 烤冰蝠薄切", range: "11-20", ingredients: { "怨念皮翼": 2, "哥布林香料": 1 }, type: "village_eat", desc: "進城前吃：神經突觸流速增加，基礎攻速永久增加 +5 點。" },

    // ==================== 🍳 LEVEL 21-30 爆熱熔岩 ====================
    { name: "🍛 熔岩惡魔激辣咖喱", range: "21-30", ingredients: { "烈焰餘燼": 2, "哥布林香料": 3 }, type: "village_eat", desc: "進城前吃：火抗灌注！在【烈焰焦土地核】內燒血傷害永久扣減 50%。" },
    { name: "🍖 炙烤熔岩壁虎乾", range: "21-30", ingredients: { "熔岩鱗片": 2, "獸人後腿肉": 4 }, type: "dungeon_use", desc: "局內攜帶：回復 180 點 HP，並使你下一招物理揮砍必暴擊。" },
    { name: "🍜 焦黑赤骨拉麵", range: "21-30", ingredients: { "焦黑骨碎": 2, "硬殼龜甲": 2 }, type: "village_eat", desc: "進城前吃：骨質重構，最大生命值永久暴增 +120 點。" },
    { name: "🍲 食人魔烈火雜燴", range: "21-30", ingredients: { "食人魔厚皮": 1, "寒冰霜塵": 3 }, type: "village_eat", desc: "進城前吃：冷熱對沖，防禦力固定永久 +5 點減傷。" },
    { name: "🍷 魔導奧術瓊漿", range: "21-30", ingredients: { "魔導碎頁": 2, "腐屍毒素": 3 }, type: "dungeon_use", desc: "局內攜帶：魔力泉湧！當場補滿 80 點 MP 殘餘值。" },

    // ==================== 🍳 LEVEL 31-40 空間摺疊 ====================
    { name: "🍲 皇家銀河蟹肉宴", range: "31-40", ingredients: { "帝王蟹腿": 1, "怨靈淚晶": 1 }, type: "village_eat", desc: "進城前吃：最大生命永續 +200 點，完美免疫永凍冰原治癒禁制。" },
    { name: "🍮 虛空之眼星空派", range: "31-40", ingredients: { "虛空眼球": 2, "寒冰霜塵": 5 }, type: "village_eat", desc: "進城前吃：視界摺疊，進入戰鬥時完美閃避率永久 +8%。" },
    { name: "🥩 時空鹽焗醃肉", range: "31-40", ingredients: { "時空皮革": 2, "獸人後腿肉": 8 }, type: "dungeon_use", desc: "局內攜帶：扭曲時空，使自身 ATB 行動條當場暴漲 50% 進度！" },
    { name: "🍷 吸血蝠血橙釀", range: "31-40", ingredients: { "吸血毒牙": 2, "史萊姆黏液": 10 }, type: "village_eat", desc: "進城前吃：嗜血覺醒，物理揮砍永久附帶 5% 的吸血效果。" },
    { name: "🍵 符文古法養生湯", range: "31-40", ingredients: { "符文石板": 1, "巨石苔蘚": 10 }, type: "village_eat", desc: "進城前吃：古法守護，最大生命值上限 +100，防禦固定 +3。" },

    // ==================== 🍳 LEVEL 41-50 惡魔盛宴 ====================
    { name: "🍷 逆轉禁忌血釀", range: "41-50", ingredients: { "虛空核心": 1, "祭司血清": 1 }, type: "dungeon_use", desc: "局內攜帶：顛倒虛空！直接強行跳過當前樓層戰鬥，無傷安全降臨下一層。" },
    { name: "🍲 惡魔骨湯大砂鍋", range: "41-50", ingredients: { "惡魔之角": 2, "硬殼龜甲": 10 }, type: "village_eat", desc: "進城前吃：骨骼魔化，最大生命上限永久 +300 點。" },
    { name: "🥩 暗刃鐵板黑胡椒牛扒", range: "41-50", ingredients: { "暗刃鋼片": 2, "食人魔厚皮": 8 }, type: "village_eat", desc: "進城前吃：殺意浸透，基礎攻擊力永久暴力加成 +25 點。" },
    { name: "🥗 奪心魔靈精神沙律", range: "41-50", ingredients: { "奪心碎晶": 2, "魔導碎頁": 10 }, type: "village_eat", desc: "進城前吃：腦容量翻倍，Max MP 永久 +80，每回合回魔 +5。" },
    { name: "🍟 地龍魔爪厚炸薯", range: "41-50", ingredients: { "地龍魔爪": 2, "獸人後腿肉": 12 }, type: "dungeon_use", desc: "局內攜帶：當場補滿 250 點 HP，並移除自身身上的灼燒狀態。" },

    // ==================== 🍳 LEVEL 51-60 星輝宇宙 ====================
    { name: "🌌 星塵漫游太空冰霜凍", range: "51-60", ingredients: { "星塵碎片": 2, "寒冰霜塵": 15 }, type: "village_eat", desc: "進城前吃：星體護體，全戰局完美閃避率永久 +12%。" },
    { name: "🍛 混沌核心大亂燉", range: "51-60", ingredients: { "混沌核心": 2, "獸人後腿肉": 20 }, type: "village_eat", desc: "進城前吃：基因崩潰，全戰局物理連擊率 (Double Strike) 永久 +15%。" },
    { name: "🍧 奇異點重力刨冰", range: "51-60", ingredients: { "重力奇點": 2, "烈焰餘燼": 15 }, type: "dungeon_use", desc: "局內攜帶：重力崩塌，強行將敵方魔物的速度（Spd）永久砍半！" },
    { name: "🍷 死神寂滅葡萄酒", range: "51-60", ingredients: { "死神鐮刃": 1, "吸血毒牙": 12 }, type: "village_eat", desc: "進城前吃：寂滅死氣，物理揮砍永久附帶 10% 吸血與 5% 暴擊。" },
    { name: "🍗 秩序大天使聖輝雞翼", range: "51-60", ingredients: { "裁決羽毛": 2, "巨石苔蘚": 25 }, type: "village_eat", desc: "進城前吃：天使之光，戰鬥開始時獲得極厚的 600 點物理晶體神盾。" }
];

const MARKET_ITEMS_POOL = [
    // 局內攜帶消耗品 (40種)
    { name: "🌭 大快活厚牛巨堡", price: 45, desc: "立刻補滿 100 HP，並生成 80 點物理防盾。" },
    { name: "🍧 萬年永凍刨冰", price: 55, desc: "強行凍結魔物 2 回合，封鎖再生與反擊。" },
    { name: "🍷 逆轉禁忌血釀", price: 130, desc: "空間扭曲！強行蒸發並無傷跳過當前樓層怪。" },
    { name: "🧪 微光初級治癒藥水", price: 20, desc: "立刻回復 50 點 HP。" },
    { name: "🧪 皇家大瓶強效魔藥", price: 40, desc: "立刻回復 150 點 HP。" },
    { name: "🧪 秘銀奧術回魔劑", price: 30, desc: "立刻回復 40 點 MP 殘餘值。" },
    { name: "🧪 聖使神聖活力合劑", price: 80, desc: "立刻補滿 100% 的 HP 與 MP。" },
    { name: "🛡️ 鋼鐵臨時防禦膠囊", price: 25, desc: "本場戰鬥減傷面板（Block）暫時增加 15 點。" },
    { name: "⚡ 狂暴腎上腺素針", price: 40, desc: "本場戰鬥暴擊機率（Crit）暫時暴增 25%。" },
    { name: "🐾 貓神輕盈肉墊粉", price: 35, desc: "本場戰鬥完美閃避（Dodge）暫時增加 15%。" },
    { name: "📜 狂暴爆烈火焰卷軸", price: 50, desc: "撕開後對當前魔物造成 150 點火屬性真實傷害。" },
    { name: "📜 冰晶地刺冰封卷軸", price: 50, desc: "撕開後凍結魔物 1 回合，並造成 80 點水傷。" },
    { name: "📜 天雷大轟頂雷電卷軸", price: 70, desc: "撕開後引導萬雷轟頂，造成 250 點雷電法傷。" },
    { name: "🧲 時空黑洞引力信標", price: 90, desc: "使敵方魔物進入重力壓制，速度 Spd 扣減 40%，持續 5 回合。" },
    { name: "🍷 魔物大補血酒", price: 110, desc: "代價：魔物攻擊力提升 15% ➔ 報酬：你當場狂吸其 300 生命。" },
    { name: "🧼 史萊姆黏糊滑膠水", price: 25, desc: "黏住對手的武器，使其下一回合的攻擊強制落空。" },
    { name: "🌶️ 哥布林爆辣魔力辣粉", price: 30, desc: "噴向自己，損失 15 HP 但當場補滿 30 MP。" },
    { name: "🥩 烤野豬肉大串乾", price: 25, desc: "美味的口糧，當場回復 60 點生命值。" },
    { name: "🍮 活性史萊姆果凍", price: 35, desc: "滑溜溜的甜點，回復 40 HP 與 20 MP。" },
    { name: "🦴 不死骷髏替身草偶", price: 100, desc: "本層戰鬥若致死，自動保留 1 HP 並凍結怪 1 回合。" },
    { name: "🧤 鐵匠特製石英手套", price: 45, desc: "裝載後，下一次在加工所鍛造時 QTE 的大成功區間擴寬 15%。" },
    { name: "🥄 皇家御廚銀質調羹", price: 45, desc: "裝載後，下一次在料理屋烹飪時 QTE 的大成功區間擴寬 15%。" },
    { name: "🪓 鋼鐵碎甲鐵飛刀", price: 35, desc: "擲出飛刀，永久削弱當前魔物 8 點基礎防禦減傷。" },
    { name: "🧪 泣血妖花迷魂花粉", price: 60, desc: "使魔物陷入精神混亂，20% 機率自己打自己，持續 3 回合。" },
    { name: "🧼 劇毒沼澤淨化噴劑", price: 30, desc: "徹底洗去自身身上的所有【中毒】與【灼燒】層數。" },
    { name: "🧿 虛空超維度扭曲目鏡", price: 85, desc: "時空干涉，將當前的隨機地下城環境洗回正常（NORMAL）。" },
    { name: "💍 臨時鋼圈鐵套指環", price: 15, desc: "便宜的指環，增加 3 點基礎攻擊力。" },
    { name: "📿 生鏽的聖徽吊墜", price: 15, desc: "殘破的聖徽，增加 20 點生命上限。" },
    { name: "🛡️ 木屑膠合臨時防面罩", price: 15, desc: "粗糙的護具，增加 1 點減傷（Block）。" },
    { name: "🧪 狂魔血清注射劑", price: 95, desc: "戰意狂飆！當前最大生命值砍半，但攻擊力瞬間翻倍！" },
    { name: "🌌 碎星引力壓縮球", price: 120, desc: "捏爆後對魔物造成 400 點無屬性極致物理衝擊傷害。" },
    { name: "🥀 妖花之瓣止血敷貼", price: 40, desc: "立刻回復 80 HP，並在接下來 3 回合內每回合回 20 HP。" },
    { name: "🧪 萬能解毒活性血清", price: 30, desc: "解除自身所有劇毒狀態，並回復 30 點生命。" },
    { name: "📜 雷暴大轟炸禁忌卷軸", price: 150, desc: "大範圍天罰！對當前魔物造成 600 點毀滅雷電法術法傷。" },
    { name: "🧪 惡魔心臟狂暴藥酒", price: 110, desc: "注入狂暴本能，全場戰鬥攻擊速度 Spd 提升 50%。" },
    { name: "🧿 聖殿守護祝福徽章", price: 75, desc: "生成 300 點極厚的神聖晶體防盾抵擋傷害。" },
    { name: "🧼 萬年永凍刨冰精華", price: 70, desc: "強效急凍，凍結怪 3 回合並清除其身上的再生屬性。" },
    { name: "🍷 狂戰不屈燃燒熱血", price: 80, desc: "當生命低於 30% 時，攻擊力瞬間提升 1.5 倍（局內被動）。" },
    { name: "📜 時空回溯逃逸護符", price: 50, desc: "在局內戰敗時不會丟失素材，直接安全逃回村莊（一次性）。" },
    { name: "👑 帝王蟹腿肉黃金罐頭", price: 90, desc: "頂級補給，當場回復 300 HP 氣血並回復 50 MP。" }
];
