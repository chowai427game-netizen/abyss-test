// ==========================================================================
// 👹 monsterdata.js：1F-59F 怪物分流與六大深淵領主數據庫
// ==========================================================================

const REGULAR_MONSTERS_POOL = [
    { name: "💧 藍色史萊姆", minFloor: 1, maxFloor: 9, baseHp: 40, hpScale: 14, baseAtk: 4, atkScale: 2.5, baseSpd: 14, def: 1, mdef: 1, flee: 5 },
    { name: "👺 綠皮哥布林", minFloor: 1, maxFloor: 9, baseHp: 45, hpScale: 15, baseAtk: 5, atkScale: 2.8, baseSpd: 26, def: 2, mdef: 1, flee: 18 },
    { name: "🐗 荒野半獸人", minFloor: 1, maxFloor: 9, baseHp: 55, hpScale: 18, baseAtk: 6, atkScale: 3.2, baseSpd: 12, def: 4, mdef: 2, flee: 8 },
    { name: "👻 迷途哭泣怨靈", minFloor: 1, maxFloor: 9, baseHp: 38, hpScale: 13, baseAtk: 5, atkScale: 3.0, baseSpd: 22, def: 1, mdef: 6, flee: 15 },
    { name: "🧱 古墓巨石守衛", minFloor: 1, maxFloor: 9, baseHp: 70, hpScale: 22, baseAtk: 4, atkScale: 2.2, baseSpd: 8, def: 8, mdef: 3, flee: 2 },

    { name: "❄️ 冰川小惡魔", minFloor: 11, maxFloor: 19, baseHp: 180, hpScale: 25, baseAtk: 18, atkScale: 4.5, baseSpd: 20, def: 8, mdef: 12, flee: 22 },
    { name: "🕷️ 地底毒牙蛛", minFloor: 11, maxFloor: 19, baseHp: 150, hpScale: 22, baseAtk: 22, atkScale: 5.0, baseSpd: 28, def: 6, mdef: 8, flee: 30 },
    { name: "🧟 復甦凍僵腐屍", minFloor: 11, maxFloor: 19, baseHp: 240, hpScale: 30, baseAtk: 15, atkScale: 3.8, baseSpd: 10, def: 12, mdef: 5, flee: 10 },
    { name: "🦅 冰原吸血皮翼", minFloor: 11, maxFloor: 19, baseHp: 130, hpScale: 20, baseAtk: 20, atkScale: 4.2, baseSpd: 32, def: 5, mdef: 10, flee: 35 },
    { name: "🛡️ 鋼鐵霜殼陸龜", minFloor: 11, maxFloor: 19, baseHp: 320, hpScale: 40, baseAtk: 12, atkScale: 3.0, baseSpd: 7, def: 20, mdef: 12, flee: 5 },

    { name: "🔥 焦土爆烈小鬼", minFloor: 21, maxFloor: 29, baseHp: 380, hpScale: 35, baseAtk: 45, atkScale: 7.0, baseSpd: 24, def: 12, mdef: 20, flee: 28 },
    { name: "🦎 熔岩劇毒壁虎", minFloor: 21, maxFloor: 29, baseHp: 450, hpScale: 40, baseAtk: 38, atkScale: 6.2, baseSpd: 22, def: 16, mdef: 14, flee: 25 },
    { name: "💀 焦黑地獄刺客", minFloor: 21, maxFloor: 29, baseHp: 350, hpScale: 32, baseAtk: 55, atkScale: 8.5, baseSpd: 36, def: 10, mdef: 12, flee: 42 },
    { name: "🥩 煉獄虐殺食人魔", minFloor: 21, maxFloor: 29, baseHp: 600, hpScale: 55, baseAtk: 50, atkScale: 7.5, baseSpd: 12, def: 25, mdef: 10, flee: 12 },
    { name: "🔮 浮空禁忌魔導書", minFloor: 21, maxFloor: 29, baseHp: 300, hpScale: 28, baseAtk: 48, atkScale: 8.0, baseSpd: 18, def: 8, mdef: 30, flee: 20 }
];

const BOSS_DATABASE = {
    10: { name: "👑 哥布林暴君 • 狂怒者", baseHp: 250, baseAtk: 35, baseSpd: 28, def: 8, mdef: 5, flee: 15, dropItem: "暴君槌芯", desc: "深淵前層的殘暴統治者，巨槌帶有粉碎性震盪！" },
    20: { name: "🧙 深淵墮落大祭司 • 莫爾", baseHp: 500, baseAtk: 55, baseSpd: 18, def: 12, mdef: 25, flee: 20, dropItem: "祭司血清", desc: "詠唱黑暗禁咒的古老祭司，防禦壁障極厚！" },
    30: { name: "🌌 虛空秩序扭曲者 • 零", baseHp: 900, baseAtk: 85, baseSpd: 35, def: 20, mdef: 35, flee: 40, perfectDodge: 5, dropItem: "虛空核心", desc: "撕裂空間的虛空生物！" },
    40: { name: "🌊 深淵巨鎧領主 • Scylla", baseHp: 1500, baseAtk: 120, baseSpd: 15, def: 45, mdef: 20, flee: 15, dropItem: "帝王蟹腿", desc: "鎮守深淵 40 層的海棲霸主！" },
    50: { name: "🔥 煉獄魔神 • 巴洛克", baseHp: 3200, baseAtk: 220, baseSpd: 24, def: 40, mdef: 40, flee: 30, perfectDodge: 8, dropItem: "魔神火核", desc: "深淵熔岩孕育出的狂暴魔神！" },
    60: { name: "🪐 終焉星神 • 艾爾達", baseHp: 7500, baseAtk: 450, baseSpd: 38, def: 60, mdef: 60, flee: 50, perfectDodge: 10, dropItem: "終焉奇點", desc: "主宰宇宙與萬物終焉的古老神明！" }
};

const BOSS_SKILLS_DATABASE = {
    "👑 哥布林暴君 • 狂怒者": [
        { name: "🔨 崩山巨槌", triggerHpPercent: 50, dmgMultiplier: 1.8, desc: "暴君高舉巨槌砸向地面，造成大範圍物理震盪傷！" }
    ],
    "🧙 深淵墮落大祭司 • 莫爾": [
        { name: "💀 黑暗洗禮", triggerHpPercent: 60, dmgMultiplier: 1.5, desc: "大祭司吟唱禁咒，將周圍生靈轉化為暗影能量炸裂！" }
    ]
};

const MONSTER_DROPS = {
    "💧 藍色史萊姆": "史萊姆黏液", "👺 綠皮哥布林": "哥布林香料", "🐗 荒野半獸人": "獸人後腿肉", "👻 迷途哭泣怨靈": "怨靈淚晶", "🧱 古墓巨石守衛": "巨石苔蘚",
    "❄️ 冰川小惡魔": "寒冰霜塵", "🕷️ 地底毒牙蛛": "毒蜘蛛腺體", "🧟 復甦凍僵腐屍": "腐屍毒素", "🦅 冰原吸血皮翼": "怨念皮翼", "🛡️ 鋼鐵霜殼陸龜": "硬殼龜甲",
    "🔥 焦土爆烈小鬼": "烈焰餘燼", "🦎 熔岩劇毒壁虎": "熔岩鱗片", "💀 焦黑地獄刺客": "焦黑骨碎", "🥩 煉獄虐殺食人魔": "食人魔厚皮", "🔮 浮空禁忌魔導書": "魔導碎頁"
};
