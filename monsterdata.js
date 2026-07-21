// ==========================================================================
// 👹 monsterdata.js：1F-59F 怪物分流與六大深淵領主數據庫 (含 DEF/MDEF/FLEE)
// ==========================================================================

const REGULAR_MONSTERS_POOL = [
    // === 🧱 1F - 9F (地表裂縫與前層古墓) ===
    { name: "💧 藍色史萊姆", minFloor: 1, maxFloor: 9, baseHp: 40, hpScale: 14, baseAtk: 4, atkScale: 2.5, baseSpd: 14, def: 1, mdef: 1, flee: 5 },
    { name: "👺 綠皮哥布林", minFloor: 1, maxFloor: 9, baseHp: 45, hpScale: 15, baseAtk: 5, atkScale: 2.8, baseSpd: 26, def: 2, mdef: 1, flee: 18 },
    { name: "🐗 荒野半獸人", minFloor: 1, maxFloor: 9, baseHp: 55, hpScale: 18, baseAtk: 6, atkScale: 3.2, baseSpd: 12, def: 4, mdef: 2, flee: 8 },
    { name: "👻 迷途哭泣怨靈", minFloor: 1, maxFloor: 9, baseHp: 38, hpScale: 13, baseAtk: 5, atkScale: 3.0, baseSpd: 22, def: 1, mdef: 6, flee: 15 },
    { name: "🧱 古墓巨石守衛", minFloor: 1, maxFloor: 9, baseHp: 70, hpScale: 22, baseAtk: 4, atkScale: 2.2, baseSpd: 8, def: 8, mdef: 3, flee: 2 },

    // === ❄️ 11F - 19F (萬年永凍冰窟) ===
    { name: "❄️ 冰川小惡魔", minFloor: 11, maxFloor: 19, baseHp: 180, hpScale: 25, baseAtk: 18, atkScale: 4.5, baseSpd: 20, def: 8, mdef: 12, flee: 22 },
    { name: "🕷️ 地底毒牙蛛", minFloor: 11, maxFloor: 19, baseHp: 150, hpScale: 22, baseAtk: 22, atkScale: 5.0, baseSpd: 28, def: 6, mdef: 8, flee: 30 },
    { name: "🧟 復甦凍僵腐屍", minFloor: 11, maxFloor: 19, baseHp: 240, hpScale: 30, baseAtk: 15, atkScale: 3.8, baseSpd: 10, def: 12, mdef: 5, flee: 10 },
    { name: "🦅 冰原吸血皮翼", minFloor: 11, maxFloor: 19, baseHp: 130, hpScale: 20, baseAtk: 20, atkScale: 4.2, baseSpd: 32, def: 5, mdef: 10, flee: 35 },
    { name: "🛡️ 鋼鐵霜殼陸龜", minFloor: 11, maxFloor: 19, baseHp: 320, hpScale: 40, baseAtk: 12, atkScale: 3.0, baseSpd: 7, def: 20, mdef: 12, flee: 5 },

    // === 🔥 21F - 29F (烈焰硫磺焦土) ===
    { name: "🔥 焦土爆烈小鬼", minFloor: 21, maxFloor: 29, baseHp: 380, hpScale: 35, baseAtk: 45, atkScale: 7.0, baseSpd: 24, def: 12, mdef: 20, flee: 28 },
    { name: "🦎 熔岩劇毒壁虎", minFloor: 21, maxFloor: 29, baseHp: 450, hpScale: 40, baseAtk: 38, atkScale: 6.2, baseSpd: 22, def: 16, mdef: 14, flee: 25 },
    { name: "💀 焦黑地獄刺客", minFloor: 21, maxFloor: 29, baseHp: 350, hpScale: 32, baseAtk: 55, atkScale: 8.5, baseSpd: 36, def: 10, mdef: 12, flee: 42 },
    { name: "🥩 煉獄虐殺食人魔", minFloor: 21, maxFloor: 29, baseHp: 600, hpScale: 55, baseAtk: 50, atkScale: 7.5, baseSpd: 12, def: 25, mdef: 10, flee: 12 },
    { name: "🔮 浮空禁忌魔導書", minFloor: 21, maxFloor: 29, baseHp: 300, hpScale: 28, baseAtk: 48, atkScale: 8.0, baseSpd: 18, def: 8, mdef: 30, flee: 20 },

    // === 🌀 31F - 39F (時空扭曲虛空裂縫) ===
    { name: "👁️ 虛空扭曲觀察者", minFloor: 31, maxFloor: 39, baseHp: 800, hpScale: 65, baseAtk: 75, atkScale: 10.5, baseSpd: 22, def: 18, mdef: 40, flee: 30 },
    { name: "🌌 裂縫黯夜潛行者", minFloor: 31, maxFloor: 39, baseHp: 720, hpScale: 60, baseAtk: 90, atkScale: 12.0, baseSpd: 30, def: 15, mdef: 20, flee: 50 },
    { name: "🦇 異次元吸血巨蝠", minFloor: 31, maxFloor: 39, baseHp: 650, hpScale: 55, baseAtk: 85, atkScale: 11.5, baseSpd: 38, def: 12, mdef: 25, flee: 48 },
    { name: "🗿 虛空遺蹟守衛像", minFloor: 31, maxFloor: 39, baseHp: 1100, hpScale: 90, baseAtk: 65, atkScale: 8.0, baseSpd: 11, def: 40, mdef: 30, flee: 10 },
    { name: "🐍 劇毒多頭利維坦", minFloor: 31, maxFloor: 39, baseHp: 950, hpScale: 75, baseAtk: 80, atkScale: 10.0, baseSpd: 16, def: 28, mdef: 28, flee: 20 },

    // === 👹 41F - 49F (古老黑魔祭壇) ===
    { name: "👿 深淵貪婪狂魔", minFloor: 41, maxFloor: 49, baseHp: 1600, hpScale: 110, baseAtk: 130, atkScale: 15.0, baseSpd: 24, def: 35, mdef: 30, flee: 35 },
    { name: "🗡️ 墮落暗殺刺刃者", minFloor: 41, maxFloor: 49, baseHp: 1300, hpScale: 95, baseAtk: 160, atkScale: 18.0, baseSpd: 40, def: 22, mdef: 25, flee: 60 },
    { name: "🧠 奪心碎裂魔靈", minFloor: 41, maxFloor: 49, baseHp: 1200, hpScale: 90, baseAtk: 145, atkScale: 16.5, baseSpd: 28, def: 18, mdef: 50, flee: 40 },
    { name: "🐲 岩漿黑羽幼龍", minFloor: 41, maxFloor: 49, baseHp: 2200, hpScale: 150, baseAtk: 120, atkScale: 14.0, baseSpd: 15, def: 45, mdef: 35, flee: 18 },
    { name: "🥀 嗜血泣淚妖花", minFloor: 41, maxFloor: 49, baseHp: 1500, hpScale: 100, baseAtk: 135, atkScale: 16.0, baseSpd: 12, def: 28, mdef: 42, flee: 15 },

    // === 🌌 51F - 59F (萬象寂滅星系邊緣) ===
    { name: "✨ 織星流星漫遊者", minFloor: 51, maxFloor: 59, baseHp: 3000, hpScale: 200, baseAtk: 220, atkScale: 25.0, baseSpd: 28, def: 40, mdef: 60, flee: 55 },
    { name: "🌌 混沌世界吞噬蟲", minFloor: 51, maxFloor: 59, baseHp: 3500, hpScale: 240, baseAtk: 200, atkScale: 22.0, baseSpd: 18, def: 55, mdef: 45, flee: 25 },
    { name: "🪐 重力異變奇點", minFloor: 51, maxFloor: 59, baseHp: 4500, hpScale: 300, baseAtk: 180, atkScale: 20.0, baseSpd: 12, def: 70, mdef: 70, flee: 10 },
    { name: "💀 終焉寂滅死神", minFloor: 51, maxFloor: 59, baseHp: 2800, hpScale: 180, baseAtk: 260, atkScale: 30.0, baseSpd: 45, def: 30, mdef: 50, flee: 70 },
    { name: "👑 宇宙虛無秩序使者", minFloor: 51, maxFloor: 59, baseHp: 4000, hpScale: 270, baseAtk: 210, atkScale: 24.0, baseSpd: 22, def: 50, mdef: 65, flee: 40 }
];

const BOSS_DATABASE = {
    10: { name: "👑 哥布林暴君 • 狂怒者", baseHp: 250, baseAtk: 35, baseSpd: 28, def: 8, mdef: 5, flee: 15, dropItem: "暴君槌芯", desc: "深淵前層的殘暴統治者，巨槌帶有粉碎性震盪！" },
    20: { name: "🧙 深淵墮落大祭司 • 莫爾", baseHp: 500, baseAtk: 55, baseSpd: 18, def: 12, mdef: 25, flee: 20, dropItem: "祭司血清", desc: "詠唱黑暗禁咒的古老祭司，防禦壁障極厚！" },
    30: { name: "🌌 虛空秩序扭曲者 • 零", baseHp: 900, baseAtk: 85, baseSpd: 35, def: 20, mdef: 35, flee: 40, perfectDodge: 5, dropItem: "虛空核心", desc: "撕裂空間的虛空生物，其存在本身就在干擾力場！" },
    40: { name: "🌊 深淵巨鎧領主 • Scylla", baseHp: 1500, baseAtk: 120, baseSpd: 15, def: 45, mdef: 20, flee: 15, dropItem: "帝王蟹腿", desc: "鎮守深淵 40 層的海棲霸主，蟹螯擁有斷鋼級物理外傷！" },
    50: { name: "🔥 煉獄魔神 • 巴洛克", baseHp: 3200, baseAtk: 220, baseSpd: 24, def: 40, mdef: 40, flee: 30, perfectDodge: 8, dropItem: "魔神火核", desc: "由深淵熔岩孕育出的狂暴魔神，揮舞烈焰巨鞭！" },
    60: { name: "🪐 終焉星神 • 艾爾達", baseHp: 7500, baseAtk: 450, baseSpd: 38, def: 60, mdef: 60, flee: 50, perfectDodge: 10, dropItem: "終焉奇點", desc: "主宰宇宙與萬物終焉的古老神明，掌控因果律武器！" }
};

const BOSS_SKILLS_DATABASE = {
    "👑 哥布林暴君 • 狂怒者": [
        { name: "🔨 崩山巨槌", triggerHpPercent: 50, dmgMultiplier: 1.8, desc: "暴君高舉巨槌砸向地面，造成大範圍物理震盪傷！" }
    ],
    "🧙 深淵墮落大祭司 • 莫爾": [
        { name: "💀 黑暗洗禮", triggerHpPercent: 60, dmgMultiplier: 1.5, desc: "大祭司吟唱禁咒，將周圍生靈轉化為暗影能量炸裂！" },
        { name: "🛡️ 邪能護盾", triggerHpPercent: 30, dmgMultiplier: 0.0, desc: "大祭司給自己施加極厚的反彈護盾，封鎖神聖法術！" }
    ],
    "🌌 虛空秩序扭曲者 • 零": [
        { name: "🌀 空間粉碎", triggerHpPercent: 40, dmgMultiplier: 2.2, desc: "零強行扭曲周圍空間，使玩家肉體與力場一同撕裂！" }
    ],
    "🌊 深淵巨鎧領主 • Scylla": [
        { name: "🦀 斷鋼斷骨斬", triggerHpPercent: 50, dmgMultiplier: 2.0, desc: "深淵領主用極限巨螯發動斷鋼重擊，重傷物理防線！" }
    ],
    "🔥 煉獄魔神 • 巴洛克": [
        { name: "🌋 獄火爆裂罪鞭", triggerHpPercent: 50, dmgMultiplier: 2.5, desc: "魔神召喚煉獄核心之火，一鞭抽下造成毀滅性真實灼傷！" }
    ],
    "🪐 終焉星神 • 艾爾達": [
        { name: "💫 寂滅星系大崩塌", triggerHpPercent: 70, dmgMultiplier: 2.0, desc: "艾爾達引爆引力奇點，空間引力崩塌造成大破防傷害！" },
        { name: "⏳ 因果扭曲逆轉", triggerHpPercent: 25, dmgMultiplier: 3.0, desc: "星神操縱時間線，打出抹除靈魂印記的終極因果必殺！" }
    ]
};

const MONSTER_DROPS = {
    "💧 藍色史萊姆": "史萊姆黏液", "👺 綠皮哥布林": "哥布林香料", "🐗 荒野半獸人": "獸人後腿肉", "👻 迷途哭泣怨靈": "怨靈淚晶", "🧱 古墓巨石守衛": "巨石苔蘚",
    "❄️ 冰川小惡魔": "寒冰霜塵", "🕷️ 地底毒牙蛛": "毒蜘蛛腺體", "🧟 復甦凍僵腐屍": "腐屍毒素", "🦅 冰原吸血皮翼": "怨念皮翼", "🛡️ 鋼鐵霜殼陸龜": "硬殼龜甲",
    "🔥 焦土爆烈小鬼": "烈焰餘燼", "🦎 熔岩劇毒壁虎": "熔岩鱗片", "💀 焦黑地獄刺客": "焦黑骨碎", "🥩 煉獄虐殺食人魔": "食人魔厚皮", "🔮 浮空禁忌魔導書": "魔導碎頁",
    "👁️ 虛空扭曲觀察者": "虛空眼球", "🌌 裂縫黯夜潛行者": "時空皮革", "🦇 異次元吸血巨蝠": "吸血毒牙", "🗿 虛空遺蹟守衛像": "符文石板", "🐍 劇毒多頭利維坦": "九頭蛇血",
    "👿 深淵貪婪狂魔": "惡魔之角", "🗡️ 墮落暗殺刺刃者": "暗刃鋼片", "🧠 奪心碎裂魔靈": "奪心碎晶", "🐲 岩漿黑羽幼龍": "地龍魔爪", "🥀 嗜血泣淚妖花": "泣血花瓣",
    "✨ 織星流星漫遊者": "星塵碎片", "🌌 混沌世界吞噬蟲": "混沌核心", "🪐 重力異變奇點": "重力奇點", "💀 終焉寂滅死神": "死神鐮刃", "👑 宇宙虛無秩序使者": "裁決羽毛"
};
