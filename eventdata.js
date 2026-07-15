// ==========================================================================
// 🌀 eventdata.js：40種邪神與仙子事件 & 40種隨機寶箱數據庫
// ==========================================================================

// 1. 🌌 40種深淵邪神、仙子、遺蹟隨機事件數據庫
const ABYSS_EVENTS_DATABASE = [
    {
        title: "🩸 命運邪神祭壇 • 血脈契約",
        desc: "虛空中傳來邪神的低語，祂要求你用生命上限來換取無上的毀滅力量。",
        choices: [
            { text: "🩸 簽署契約（代價: Max HP -30, 報酬: 攻擊力 +15）", run: (run) => { run.maxHp = Math.max(15, run.maxHp - 30); run.hp = Math.min(run.hp, run.maxHp); run.atk += 15; return "🩸 你用靈魂之血換取了通紅的殺意！"; } },
            { text: "🏃 拒絕轉身離開", run: (run) => { return "🏃 你謹慎地避開了邪神的誘惑，神經重新緊繃。"; } }
        ]
    },
    {
        title: "🧚 迷落的深淵精靈仙子",
        desc: "一隻翅膀受傷的發光小仙子倒在廢墟中，你可以選擇分給她一點魔力，或者粗暴地將其捏碎吸取精華。",
        choices: [
            { text: "🪄 灌注微量魔力（代價: MP -15, 報酬: 幸運退款率與最大 HP +40）", run: (run) => { run.mp = Math.max(0, run.mp - 15); run.maxHp += 40; run.hp += 40; return "✨ 精靈仙子圍繞著你翩翩起舞，賦予你生命的加冕！"; } },
            { text: "🩸 殘忍捏碎（報酬: 攻擊力 +8, 隨機獲得1個一級素材）", run: (run, meta) => { run.atk += 8; meta.warehouse["史萊姆黏液"] = (meta.warehouse["史萊姆黏液"] || 0) + 1; return "💀 你冷酷地捏碎了仙子，狂暴力量湧入武器。"; } }
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
            { text: "🧪 一口乾了它！（隨機觸發: 攻擊力永久 +10 / 或者是中毒扣 25 HP）", run: (run) => { if(Math.random() < 0.5) { run.atk += 10; return "🧪 你的肌肉開始膨脹，力量爆發！"; } else { run.hp = Math.max(5, run.hp - 25); return "🤢 這瓶魔液劇毒無比！你當場狂吐，胃部灼燒。"; } } },
            { text: "🏃 搖搖頭，快步走開", run: (run) => { return "🏃 隱士對著你發出瘋癲的怪笑，你迅速離去。"; } }
        ]
    },
    {
        title: "🧱 坍塌的重力魔導石碑",
        desc: "石碑上流轉著反重力的奇異電波，你可以將手放上去感悟力場規律。",
        choices: [
            { text: "🧿 感悟重力力場（最大 MP +30，速度 Spd +5）", run: (run) => { run.maxMp += 30; run.spd += 5; return "🌀 重力偏折，你感覺到肉體輕盈無比！"; } },
            { text: "🪓 暴力砸毀（獲得 150G 金幣，但受到 30 點重力反震真實創傷）", run: (run) => { run.hp = Math.max(1, run.hp - 30); run.gold += 150; return "💥 石碑碎裂，露出了裏面鑲嵌的遠古金幣！"; } }
        ]
    },
    // ... 為了確保 40 個奇遇數據完全不重樣且全部直接跑通，我們採用高密度數據矩陣：
    { title: "🦴 腐爛的巨大遠古龍獸屍骸", desc: "這裏躺著一具龐大的巨龍遺骸，你可以選擇在龍牙下祈禱，或者冒險伸手進食道深處掏取寶物。", choices: [
        { text: "🧎 跪地祈禱（暴擊率 Crit +5%）", run: (run) => { run.critChance += 5; return "✨ 龍威洗禮，你的攻擊線路變得更加致命。"; } },
        { text: "🔍 伸手掏取（50% 機率獲得「硬殼龜甲」x1 / 50% 抓出龍胃毒素扣 25 HP）", run: (run, meta) => { if(Math.random()<0.5) { meta.warehouse["硬殼龜甲"] = (meta.warehouse["硬殼龜甲"]||0)+1; return "🎁 居然摸到了地底巨獸反芻出來的硬殼龜甲！"; } else { run.hp = Math.max(1, run.hp - 25); return "🤢 一條毒蟒咬了你的手！毒素侵蝕你的心神。"; } } }
    ] },
    { title: "⛲ 墮落天使的生命聖泉", desc: "泉水散發著紫金色的光芒，極具誘惑力。你敢喝嗎？", choices: [
        { text: "🍻 暢飲聖泉（生命值滿回復，且 MP 滿回復）", run: (run) => { run.hp = run.maxHp; run.mp = run.maxMp; return "✨ 泉水洗滌了你全身的疲憊與傷痕！"; } },
        { text: "🧪 裝入瓶中帶走（隨機獲得「大快活厚牛巨堡」x1，但丟失 30G 金幣）", run: (run) => { if(run.gold >= 30) { run.gold -= 30; run.inventory.push("🌭 大快活厚牛巨堡"); return "🎁 你用紙杯裝了一杯泉水，塞進包包。"; } else { return "🪙 你兜裏沒零錢買瓶子，只好遺憾走開。"; } } }
    ] },
    { title: "🧙‍♀️ 狂暴元素女巫的分身", desc: "女巫分身在冰火元素中交錯，她要求你展示出對法術的熱愛。", choices: [
        { text: "🔥 奉獻火焰法術（代價: MP -30，報酬: 攻擊力 +12）", run: (run) => { run.mp = Math.max(0, run.mp - 30); run.atk += 12; return "🔥 女巫滿意地讚賞你的天賦，為你的武器開光。"; } },
        { text: "❄️ 奉獻寒冰魔力（代價: HP -20，報酬: 閃避率 +6%）", run: (run) => { run.hp = Math.max(1, run.hp - 20); run.dodgeChance += 6; return "❄️ 女巫的分身化為冰晶，融入你的戰鬥步伐。"; } }
    ] },
    { title: "🛡️ 戰死先烈的生鏽英魂塚", desc: "這裏插著一把生鏽的鐵巨劍，英魂在此遊蕩，你可以選擇獻祭你的財富來平息他們的憤怒。", choices: [
        { text: "🪙 供奉 100G 金幣（減傷 Block 永久 +5）", run: (run) => { run.gold = Math.max(0, run.gold - 100); run.block += 5; return "🛡️ 英魂之盾庇護著你，鋼鐵之風在你的體表盤旋。"; } },
        { text: "🗡️ 強行拔出鐵巨劍（攻擊力 +18，但英魂震怒使你最大 HP -30）", run: (run) => { run.atk += 18; run.maxHp = Math.max(15, run.maxHp - 30); run.hp = Math.min(run.hp, run.maxHp); return "💥 英魂之怒震碎了你的胸口，但你奪取了他們的狂熱大劍！"; } }
    ] },
    { title: "🪱 地底巨型蠕蟲的黏性蟲巢", desc: "你一腳踩進了蠕蟲產卵的地底蟲繭中，裏面有無數透明發光的卵。", choices: [
        { text: "🍳 偷取蟲卵吞食（最大生命上限永久 +50，但速度 Spd -2）", run: (run) => { run.maxHp += 50; run.hp += 50; run.spd -= 2; return "🤢 你強忍惡心吃下了黏性蟲卵，肌肉密度暴增！"; } },
        { text: "🔥 用火焰淨化它（獲得 50G 金幣與「史萊姆黏液」x1）", run: (run, meta) => { run.gold += 50; meta.warehouse["史萊姆黏液"] = (meta.warehouse["史萊姆黏液"]||0)+1; return "🔥 蟲巢在火焰中熔毀，殘餘物中析出了純淨的膠質。"; } }
    ] },
    // 11-40 緊湊奇遇陣列（40個事件飽和填充，支持代碼流暢度）
    { title: "🧿 時空小丑的瘋狂輪盤", desc: "小丑在虛無中召喚出時空轉盤，隨機逆轉你的時空。", choices: [
        { text: "🎰 開心轉動它（50% 機率獲得 200G / 50% 吐出 100G）", run: (run) => { if(Math.random()<0.5) { run.gold += 200; return "🪙 時空大爆發！幸運大轉盤獲得 200G！"; } else { run.gold = Math.max(0, run.gold - 100); return "💸 糟了！小丑割破了你的錢包偷走了金幣。"; } } }
    ] },
    { title: "👼 盲眼大天使雕像", desc: "這是一座失落的巨大天使石雕，你可以選擇觸摸它的盲眼以感悟天光。", choices: [
        { text: "👁️ 觸摸盲眼（最大 HP +25，每回合回藍 +1）", run: (run) => { run.maxHp += 25; run.hp += 25; run.mpRegen += 1; return "✨ 石像流下一滴天之淚，溫暖了你的奧術感官。"; } }
    ] },
    { title: "🧪 黑血祭司的禁忌培養皿", desc: "這裏留著一瓶被大祭司遺棄的異能細胞血清。", choices: [
        { text: "🩸 注射黑血細胞（攻擊力 +20，但戰鬥開始時會額外受到 10 點腐屍毒素傷害）", run: (run) => { run.atk += 20; return "💀 你不計後果將病毒般的細胞打入大腿，力量瞬間暴增！"; } }
    ] },
    { title: "🗿 巨石重力壓縮儀", desc: "一個散發強力磁場的地底機器，可以將你包包中的材料進行分子壓縮。", choices: [
        { text: "⚙️ 啓動壓縮（將倉庫中 5 個史萊姆黏液壓縮為「巨石苔蘚」x2）", run: (run, meta) => { if((meta.warehouse["史萊姆黏液"]||0)>=5) { meta.warehouse["史萊姆黏液"] -= 5; meta.warehouse["巨石苔蘚"] = (meta.warehouse["巨石苔蘚"]||0)+2; return "⚙️ 機器隆隆作響，成功將軟膠壓縮成硬度極高的苔蘚岩石！"; } else { return "⚠️ 材料不足！機器不理你。"; } } }
    ] },
    { title: "🐺 嗜血狼群的咆哮廢墟", desc: "你被幾隻變異巨狼圍攻，你需要用武力突圍或者用獸肉安撫祂們。", choices: [
        { text: "🥩 投餵「獸人後腿肉」x1（安全脫身，並獲得 40 XP 經驗值）", run: (run, meta) => { if((meta.warehouse["獸人後腿肉"]||0)>=1) { meta.warehouse["獸人後腿肉"]--; run.exp += 40; return "🐺 巨狼咬起後腿肉，叼回了暗處，並認可了你的血脈。"; } else { return "⚠️ 你倉庫兜兜空空，狼群不依不饒！"; } } },
        { text: "⚔️ 拔劍血戰（損失 30 HP，但獲得 200G 戰利品與 100 XP）", run: (run) => { run.hp = Math.max(1, run.hp - 30); run.gold += 200; run.exp += 100; return "💥 你殺出了一條血路，身上全是爪痕，但戰利品極其豐厚！"; } }
    ] },
    { title: "🧭 流落的深淵指南針", desc: "地面上躺著一個閃爍符文微光的黃銅指南針。", choices: [
        { text: "🧭 撿起來校準身位（閃避率 +5%，速度 +3）", run: (run) => { run.dodgeChance += 5; run.spd += 3; return "🧭 指南針指引了地下城重力力場微弱的縫隙所在。"; } }
    ] },
    { title: "🥀 嗜血妖花綻放的溫床", desc: "一朵巨大的紅色妖花正在吞噬一具魔物屍體，這裏魔能翻湧。", choices: [
        { text: "🩸 以鮮血灌溉（代價: 當前 HP -40，報酬: 攻擊力 +18，暴擊率 +6%）", run: (run) => { run.hp = Math.max(1, run.hp - 40); run.atk += 18; run.critChance += 6; return "🥀 妖花吸飽了你體內強大勇者的熱血，結出蘊含瘋狂殺戮意念的惡之果！"; } }
    ] },
    { title: "🧱 古墓裂縫中的金色古幣", desc: "裂縫中卡著一袋閃閃發光的古代金幣，你可以伸手去拿，但可能觸發古代巨石防線。", choices: [
        { text: "💰 伸手硬掏（獲得 180G 金幣，但扣減 15% 當前 HP 的生命）", run: (run) => { let loss = Math.floor(run.hp * 0.15); run.hp = Math.max(1, run.hp - loss); run.gold += 180; return `💰 金幣到手！但石板塌陷砸到手臂，扣減了 ${loss} 點 HP。`; } }
    ] },
    { title: "🧙 瘋癲的煉金術狂熱徒", desc: "一個身穿破爛法袍的學者狂笑著攔住你，要拿你做藥劑活性實驗。", choices: [
        { text: "🧪 配合實驗（最大 HP 永久 +60，但失去 10 點基礎攻擊力）", run: (run) => { run.maxHp += 60; run.hp += 60; run.atk = Math.max(5, run.atk - 10); return "🧪 藥劑重組了你的肌肉結構，身軀防禦提升，但發力變得遲緩。"; } }
    ] },
    { title: "🕸️ 永凍蛛母的蛛絲迷宮", desc: "這是一片被蛛絲覆蓋的寒冷迷宮，你可以強行燒毀，或者用魔力融化。", choices: [
        { text: "🔥 用大火燒（獲得 60G 金幣，但有 50% 機率吸入毒氣扣 20 HP）", run: (run) => { if(Math.random()<0.5) { run.hp = Math.max(1, run.hp - 20); run.gold += 60; return "🤮 大火燃燒蛛絲釋放了劇毒障氣！你大口喘氣吸入肺部。"; } else { run.gold += 60; return "🔥 烈火沖天！蛛絲和蟲卵付之一炬，你踏著灰燼拾起金幣。"; } } }
    ] },
    // 剩下的20個緊密填充奇遇事件，確保40種飽和
    { title: "🪐 重力奇異點黑洞殘骸", desc: "一個微型黑洞在你面前緩慢自轉，扭曲著周圍的空氣。", choices: [{ text: "🪐 投擲「時空皮革」x1 穩定力場（永久連擊率 Double Strike +10%）", run: (run, meta) => { if((meta.warehouse["時空皮革"]||0)>=1) { meta.warehouse["時空皮革"]--; run.doubleStrike += 10; return "🌀 黑洞重力逆變，你的神經反射速度永久加快！"; } else { return "⚠️ 身上沒有時空皮革可以穩定黑洞！"; } } }] },
    { title: "💀 亡靈死神的寂滅刀痕", desc: "地面上有一道巨型鐮刀斬擊下的虛無刀痕，散發著恐怖的寂滅死亡劍意。", choices: [{ text: "🗡️ 跪地參悟死意（攻擊力 +25，最大 HP -20）", run: (run) => { run.atk += 25; run.maxHp = Math.max(10, run.maxHp - 20); run.hp = Math.min(run.hp, run.maxHp); return "💀 死亡的寒意浸透你的脊柱，你的物理破壞力再次飆升！"; } }] },
    { title: "💧 史萊姆繁衍之池", desc: "你來到了一片晶瑩剔透的藍色溫泉前，史萊姆們在此產卵。", choices: [{ text: "🍻 喝一口溫泉水（MP 恢復 50，每回合回魔 +2）", run: (run) => { run.mp = Math.min(run.maxMp, run.mp + 50); run.mpRegen += 2; return "✨ 帶有奧術魔力的溫泉水滋養了你的識海。"; } }] },
    { title: "👹 深淵黑市拍賣會的漏網之魚", desc: "一個受傷的走私商人倒在路邊，他的貨箱破裂，漏出了一件裝備。", choices: [{ text: "🪙 用 120G 購買（獲得「💍 怨靈哭泣指環」）", run: (run, meta) => { if(run.gold >= 120) { run.gold -= 120; meta.warehouse["💍 怨靈哭泣指環"] = (meta.warehouse["💍 怨靈哭泣指環"]||0)+1; return "🎁 成功從走私商人手中接盤了一枚發光的哭泣戒指！"; } else { return "🪙 你的零錢不夠拍下這件寶物。"; } } }] },
    { title: "🏛️ 皇家加工所遠征探險廢墟", desc: "這裡遺留著一個報廢的永久精鍊高台殘骸，能源核心還能發一次光。", choices: [{ text: "🌟 精鍊全身防具（防具槽位精鍊免費升星 1 星！）", run: (run, meta) => { if(meta.equipmentStars.armor < 5) { meta.equipmentStars.armor++; return "🌟 高台爆發出一陣金光！你的防具槽位發生了永久進化。"; } else { return "🌟 你的防具部位已是滿星，高台能量反震回復了你 50 HP。"; } } }] },
    { title: "🦇 冰原蝙蝠王的吸生巢穴", desc: "天花板上掛滿了發光的冰晶蝙蝠，祂們將你當作了熱量來源。", choices: [{ text: "🛡️ 撐起防線（代價: 當前 HP -30，報酬: 物理防盾 +300）", run: (run) => { run.hp = Math.max(1, run.hp - 30); playerShield += 300; return "🛡️ 你強行撐起鬥氣盾護住要害，蝙蝠撞擊反而加載了鬥氣盾。"; } }] },
    { title: "🐍 劇毒蛇蛻之壁", desc: "牆上掛著幾張巨大的蛇蛻，散發著驚人的劇毒生命力。", choices: [{ text: "🔍 剝下蛇蛻（最大生命上限 +40）", run: (run) => { run.maxHp += 40; run.hp += 40; return "🐍 劇毒生命力融入你，最大生命得到永久補強。"; } }] },
    { title: "🧱 巨石板甲防護神陣", desc: "地面上由無數巨石塊布成了一個玄奧的防禦陣法，你可以坐下來打坐。", choices: [{ text: "🧎 静心冥想（減傷 Block 永久 +4）", run: (run) => { run.block += 4; return "🛡️ 土元素之盾盤旋周身，你的皮膚變得像巨石般堅硬。"; } }] },
    { title: "🐺 深淵野狼王的利齒詛咒", desc: "一具黑狼骷髏頭張著巨口，口中含著一塊發光的紅寶石。", choices: [{ text: "💎 奪取寶石（攻擊力 +15，但完美閃避率永久 -5%）", run: (run) => { run.atk += 15; run.dodgeChance = Math.max(0, run.dodgeChance - 5); return "💥 寶石碎裂化為血脈之力融入武器，但你的身軀變得沈重。"; } }] },
    { title: "🧚 奧術小仙子的魔法賭局", desc: "仙子在桌面上點燃了冰火兩盞元素燈，讓你猜一盞。", choices: [
        { text: "🔥 押註火焰（50% 機率攻擊力 +15，50% 機率最大 HP -20）", run: (run) => { if(Math.random()<0.5) { run.atk += 15; return "🔥 火光大盛！女巫意志為你的力量瘋狂增幅！"; } else { run.maxHp = Math.max(15, run.maxHp - 20); run.hp = Math.min(run.hp, run.maxHp); return "💥 賭輸了！大火爆裂，燒穿了你的氣血胸骨！"; } } }
    ] },
    { title: "⛺ 廢棄的皇家行軍糧倉", desc: "廢墟角落堆放著幾箱保存完好的行軍乾糧。", choices: [{ text: "🎒 搜刮糧仓（獲得「🌭 大快活厚牛巨堡」x1）", run: (run) => { run.inventory.push("🌭 大快活厚牛巨堡"); return "🎁 成功翻箱倒櫃，發現了一罐熱量充沛的經典厚牛堡！"; } }] },
    { title: "🧪 毒霧沼澤中的迷霧祭司", desc: "大霧迷漫，一個黑影在腐骨中祈禱，邀請你一同獻祭。", choices: [{ text: "🩸 供奉「毒蜘蛛腺體」x2（最大生命上限 +80，暴擊率 +5%）", run: (run, meta) => { if((meta.warehouse["毒蜘蛛腺體"]||0)>=2) { meta.warehouse["毒蜘蛛腺體"] -= 2; run.maxHp += 80; run.hp += 80; run.critChance += 5; return "🧪 邪能儀式啟動，狂暴毒素使你的肌肉爆發，殺意倍增。"; } else { return "⚠️ 身上沒有足夠的毒蜘蛛腺體，祭司用鐮刀敲了你的頭扣 10 HP。"; } } }] },
    { title: "🧱 古墓禁地防禦神龕", desc: "一個古老石碑神龕，你可以獻祭你的一部分速度來加載防線。", choices: [{ text: "🛡️ 供奉速度（Spd -4 ➔ 減傷 Block 永久 +8）", run: (run) => { run.spd = Math.max(5, run.spd - 4); run.block += 8; return "🛡️ 巨石壁障在你體表加載！你的防禦固若金湯。"; } }] },
    { title: "🪓 半獸人酋長的戰歌擂台", desc: "廢墟石壁上刻滿了巨型獸骨和巨斧，散發出狂暴戰意。", choices: [{ text: "🦁 吟唱狂怒戰歌（暴擊率 +8%，連擊率 +5%）", run: (run) => { run.critChance += 8; run.doubleStrike += 5; return "🦁 戰歌迴響，獸性殺意灌注，你的每一刀都充滿了毀滅暴烈。"; } }] },
    { title: "🕸️ 永凍蛛絲迷宮殘留寶藏", desc: "蛛網深處卡著一個報廢的寶箱，被寒冰凍結。", choices: [{ text: "🔥 用火焰融化（獲得 80G 金幣與「寒冰霜塵」x1）", run: (run, meta) => { run.gold += 80; meta.warehouse["寒冰霜塵"] = (meta.warehouse["寒冰霜塵"]||0)+1; return "🔥 火燒冰消！成功取出了被凍結在蛛網裏的古代金幣。"; } }] },
    { title: "🧿 時空摺疊亂流哨卡", desc: "這裏的時間流速是混亂的，你可以選擇將部分金幣投入亂流以此修復因果線。", choices: [{ text: "🪙 投入 150G（最大生命值 +100，最大 MP +50）", run: (run) => { if(run.gold >= 150) { run.gold -= 150; run.maxHp += 100; run.hp += 100; run.maxMp += 50; return "🪐 時間線逆轉收束！你的神經、靈魂與生命大福度提升。"; } else { return "⚠️ 錢不夠，因果黑洞無動於衷。"; } } }] },
    { title: "💀 亡靈骨海中的生銹金幣堆", desc: "骷髏坑底埋著一堆沾滿骨粉的生銹古董金幣。", choices: [{ text: "💰 跳下骨坑搜刮（獲得 250G 金幣，但感染腐骨毒素 Max HP -20）", run: (run) => { run.gold += 250; run.maxHp = Math.max(10, run.maxHp - 20); run.hp = Math.min(run.hp, run.maxHp); return "💀 拿到了巨款！但你吸入坑底屍毒，肺部劇痛。"; } }] },
    { title: "💧 發光史萊姆大母體遺蛻", desc: "一坨巨大的發光凝膠倒在地上，雖然已失去生命活性，但魔力驚人。", choices: [{ text: "🍳 割下吞食（最大 MP +40，每回合自動回藍 +3）", run: (run) => { run.maxMp += 40; run.mpRegen += 3; return "🔮 魔力凝膠在你的食道內化為磅礴的奧術魔力。"; } }] },
    { title: "🧚 森林小仙子的感恩禮物", desc: "你救了一隻卡在裂縫裏的小花仙，她對你表示感謝。", choices: [{ text: "💐 接受生命祝福（最大 HP +50，閃避率 +5%）", run: (run) => { run.maxHp += 50; run.hp += 50; run.dodgeChance += 5; return "✨ 花仙對你吹拂了一口神聖花粉，你的步伐變得無比輕盈。"; } }] },
    { title: "🏛️ 皇家魔導加工所的終極餽贈", desc: "廢墟深處有一個古老的神匠大熔爐，你可以選擇淬火武器。", choices: [{ text: "🗡️ 淬鍊武器（武器槽位精鍊升星 1 星！）", run: (run, meta) => { if(meta.equipmentStars.weapon < 5) { meta.equipmentStars.weapon++; return "🌟 熔爐咆哮！你的武器部位得到完美的淬火強化，威力提升。"; } else { return "🌟 你的武器部位已是 5 星，神匠餽贈回復了你 50 MP。"; } } }] }
];

// 2. 🧳 40種寶箱儲備列 (包含木、金、鑽石、機關、Mimic擬態魔等 40 種不同類型)
const TREASURE_CHESTS_POOL = [
    // 🪵 生鏽木箱/骨箱 (15種)
    { tier: "WOODEN", name: "🪵 生鏽的舊木箱", minGold: 10, maxGold: 30, isTrap: false, msg: "安全開啟，獲得少量行軍碎銀。" },
    { tier: "WOODEN", name: "🪵 哥布林隱密骨箱", minGold: 15, maxGold: 35, isTrap: false, msg: "裏面塞滿了哥布林搶來的碎銀子。" },
    { tier: "WOODEN", name: "🧱 苔蘚碎石木匣", minGold: 20, maxGold: 40, isTrap: false, msg: "揭開木匣，獲得古代銅幣。" },
    { tier: "WOODEN", name: "💀 怨靈腐蝕舊皮包", minGold: 5, maxGold: 25, isTrap: true, dmg: 10, msg: "噗嗤！皮包泄露腐蝕性酸氣扣 10 HP，但也掏出了金幣！" },
    { tier: "WOODEN", name: "🪵 半獸人獠牙木匣", minGold: 25, maxGold: 50, isTrap: false, msg: "木匣以骨雕裝飾，藏著不少野獸錢幣。" },
    { tier: "WOODEN", name: "🕸️ 冰凍蛛絲木箱", minGold: 15, maxGold: 40, isTrap: true, dmg: 12, msg: "嘶！蛛網內射出毒針扣 12 HP，但你強行搶到了碎銀！" },
    { tier: "WOODEN", name: "🧟 臭氣熏天發霉木盒", minGold: 10, maxGold: 30, isTrap: true, dmg: 8, msg: "發霉木盒釋放黴菌毒氣扣 8 HP！" },
    { tier: "WOODEN", name: "🪵 焦黑地底枯木匣", minGold: 30, maxGold: 60, isTrap: false, msg: "雖然外殼被燒焦，裏面的金幣完好無損。" },
    { tier: "WOODEN", name: "🦎 熔岩蜥蜴皮袋", minGold: 35, maxGold: 70, isTrap: false, msg: "獸皮袋防熱性能極好，裝了不少焦黑古幣。" },
    { tier: "WOODEN", name: "👁️ 虛空眼球怪皮囊", minGold: 40, maxGold: 80, isTrap: true, dmg: 15, msg: "皮囊突然睜開眼睛咬你一口扣 15 HP！你反手掏空了它的底褲！" },
    { tier: "WOODEN", name: "🪵 崩塌半獸人木罐", minGold: 20, maxGold: 50, isTrap: false, msg: "砸碎瓦罐，露出了古代金屬幣。" },
    { tier: "WOODEN", name: "🧱 苔蘚斑駁古陶罐", minGold: 25, maxGold: 55, isTrap: false, msg: "打破陶罐，獲得古代祭祀用銅錢。" },
    { tier: "WOODEN", name: "💀 古墓殉葬黑骨盒", minGold: 10, maxGold: 45, isTrap: true, dmg: 14, msg: "骨盒釋放靈魂尖叫扣 14 HP，你強行搜刮了裏面的碎鑽。" },
    { tier: "WOODEN", name: "🕸️ 地底毒蜘蛛絲繭", minGold: 15, maxGold: 50, isTrap: true, dmg: 18, msg: "毒液四濺！刺瞎雙眼扣 18 HP！但也搶出了金幣！" },
    { tier: "WOODEN", name: "🧟 凍結僵硬行軍行囊", minGold: 30, maxGold: 70, isTrap: false, msg: "死去的先烈行囊，你接管了祂殘存的物資金幣。" },

    // 👑 璀璨金箱/銀箱 (15種)
    { tier: "GOLDEN", name: "👑 皇家耀金璀璨寶箱", minGold: 80, maxGold: 200, isTrap: false, msg: "金光閃閃！皇室御廚特製保險庫，財富豐厚！" },
    { tier: "GOLDEN", name: "👑 墮落神殿魔金寶箱", minGold: 100, maxGold: 220, isTrap: true, dmg: 25, msg: "【暗箭機關！】寶箱兩側射出鋼弩扣 25 HP，但你拿到了大把魔金！" },
    { tier: "GOLDEN", name: "💎 璀璨深淵鑽石寶箱", minGold: 150, maxGold: 300, isTrap: false, msg: "絕美奢華！鑽石切面折射流光，沒有任何機關！" },
    { tier: "GOLDEN", name: "🌀 虛空裂縫重力鐵箱", minGold: 120, maxGold: 280, isTrap: true, dmg: 30, msg: "重力塌陷反震！狂噴一口鮮血扣 30 HP！但也拿到了超維度寶藏！" },
    { tier: "GOLDEN", name: "🔥 煉獄熔岩熾金巨箱", minGold: 140, maxGold: 320, isTrap: true, dmg: 35, msg: "【極度滾燙！】熱浪撲面扣 35 HP！但你用大劍挑開了熾熱的黃金！" },
    { tier: "GOLDEN", name: "👑 哥布林暴君私藏金箱", minGold: 90, maxGold: 180, isTrap: false, msg: "暴君從地表掠奪來的極品保險箱，塞滿了皇室鑄幣！" },
    { tier: "GOLDEN", name: "🧙 墮落大祭司儀式寶盒", minGold: 110, maxGold: 240, isTrap: true, dmg: 22, msg: "【暗黑詛咒！】靈魂受詛扣 22 HP！但大把秘銀幣盡入你口袋！" },
    { tier: "GOLDEN", name: "🌊 Scylla 海鱗白金寶箱", minGold: 130, maxGold: 290, isTrap: false, msg: "用深海白金鑄成，常駐帶有咸濕海水气息，財寶極多。" },
    { tier: "GOLDEN", name: "👿 煉獄炎魔巨型金庫", minGold: 160, maxGold: 350, isTrap: true, dmg: 40, msg: "地核心火燃燒！體表重創扣 40 HP！但也強行搶到了熔火黃金！" },
    { tier: "GOLDEN", name: "🪐 宇宙星神隕鐵星匣", minGold: 200, maxGold: 450, isTrap: false, msg: "【天界神禮】用隕石鐵打造，自動滑開釋放重力，財寶溢出！" },
    { tier: "GOLDEN", name: "💎 秘銀不滅重型鎧箱", minGold: 100, maxGold: 250, isTrap: false, msg: "箱蓋極厚，完美防塵防盜，藏有大批高級魔幣。" },
    { tier: "GOLDEN", name: "🌀 裂縫潛行者暗影大箱", minGold: 120, maxGold: 270, isTrap: true, dmg: 20, msg: "黑影暗殺刺擊扣 20 HP！你強行反殺並撬開了寶箱！" },
    { tier: "GOLDEN", name: "👑 秩序裁決黃金神匣", minGold: 180, maxGold: 400, isTrap: false, msg: "神聖羽毛封印自動解除，財寶在秩序之光中閃耀。" },
    { tier: "GOLDEN", name: "🔮 魔導加工所遠古遺物箱", minGold: 130, maxGold: 310, isTrap: false, msg: "古代神匠儲存高級素材和秘銀的密封箱，安全開啟。" },
    { tier: "GOLDEN", name: "🥀 泣血妖花妖嬈魔匣", minGold: 140, maxGold: 300, isTrap: true, dmg: 28, msg: "【妖花荊棘！】手掌被刺破扣 28 HP！但也摸到了大把古代血金！" },

    // 👹 Mimic 擬態怪寶箱與高危機關 (10種，必帶陷阱或高額扣血)
    { tier: "GOLDEN", name: "👹 牙齒利刃擬態寶箱 (Mimic)", minGold: 50, maxGold: 150, isTrap: true, dmg: 35, msg: "【擬態巨怪！】寶箱突然長出獠牙巨口咬你手臂扣 35 HP！你反手一拳震碎了它掏出了大袋金幣！" },
    { tier: "GOLDEN", name: "👹 泣血妖藤偽裝箱", minGold: 40, maxGold: 120, isTrap: true, dmg: 28, msg: "藤蔓絞殺！荊棘刺穿小腿扣 28 HP，但藤蔓退去後露出了亮晶晶的金幣！" },
    { tier: "GOLDEN", name: "👹 奪心魔影寄生鐵箱", minGold: 60, maxGold: 160, isTrap: true, dmg: 40, msg: "【腦部衝擊！】靈魂遭到奪心魔影寄生扣 40 HP！強忍頭疼在箱底摸到大批金幣！" },
    { tier: "GOLDEN", name: "👹 萬年永凍尖冰機關匣", minGold: 30, maxGold: 110, isTrap: true, dmg: 25, msg: "冰箭破空！大腿被射穿扣 25 HP，但冰雕碎裂露出了裏面古代帝王錢幣！" },
    { tier: "GOLDEN", name: "👹 地獄死神幽冥骨匣", minGold: 70, maxGold: 180, isTrap: true, dmg: 45, msg: "【死神寂滅鐮芒！】死氣割裂胸骨扣 45 HP！但也拿到了冥界黃金！" },
    { tier: "GOLDEN", name: "👹 毒蛇吐信機關銅匣", minGold: 35, maxGold: 95, isTrap: true, dmg: 24, msg: "毒蟒躍出咬中脖子扣 24 HP！你捏碎了蟒頭，在匣子底掏出金幣！" },
    { tier: "GOLDEN", name: "👹 焦熱爆碎自毀鋼匣", minGold: 45, maxGold: 130, isTrap: true, dmg: 32, msg: "【大爆炸！】你剛走近寶箱轟然炸裂扣 32 HP！碎屑中落滿了飛濺的金幣！" },
    { tier: "GOLDEN", name: "👹 時空眼球幻像寶盒", minGold: 55, maxGold: 140, isTrap: true, dmg: 26, msg: "眼球在腦海中引導爆破扣 26 HP！你閉眼強行摸空了寶盒！" },
    { tier: "GOLDEN", name: "👹 劇毒多頭蛇酸液毒匣", minGold: 65, maxGold: 170, isTrap: true, dmg: 38, msg: "【強酸腐蝕！】酸霧溶解了你的護甲扣 38 HP！但強酸蒸發露出了赤金！" },
    { tier: "GOLDEN", name: "👹 宇宙奇異點微型重力雷匣", minGold: 80, maxGold: 220, isTrap: true, dmg: 50, msg: "【重力極限撕裂！】空間塌陷扣 50 HP！但也拿到了高維宇宙金幣！" }
];
