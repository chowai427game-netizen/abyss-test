// ==========================================================================
// 👹 monsterdata.js：深淵魔物生態圈、每10層大領主與特技數據庫
// ==========================================================================

// 1. 普通小怪數據庫 (包含基礎速度與每層成長係數)
const REGULAR_MONSTERS_POOL = [
    { name: "💧 藍色史萊姆", baseHp: 40, hpScale: 14, baseAtk: 4, atkScale: 2.5, baseSpd: 14 },
    { name: "👺 綠皮哥布林", baseHp: 45, hpScale: 15, baseAtk: 5, atkScale: 2.8, baseSpd: 26 },
    { name: "🐗 荒野半獸人", baseHp: 55, hpScale: 18, baseAtk: 6, atkScale: 3.2, baseSpd: 12 },
    { name: "👻 迷途哭泣怨靈", baseHp: 38, hpScale: 13, baseAtk: 5, atkScale: 3.0, baseSpd: 22 },
    { name: "🧱 古墓巨石守衛", baseHp: 70, hpScale: 22, baseAtk: 4, atkScale: 2.2, baseSpd: 8 }
];

// 2. 每 10 層定點攔截的「深淵大領主 Boss」數據庫
const BOSS_DATABASE = {
    10: { name: "👑 哥布林暴君 • 狂怒者", baseHp: 250, baseAtk: 35, baseSpd: 28, dropItem: "哥布林乾癟香料", desc: "深淵前層的殘暴統治者，巨槌帶有粉碎性震盪！" },
    20: { name: "🧙 深淵墮落大祭司 • 莫爾", baseHp: 500, baseAtk: 55, baseSpd: 18, dropItem: "墮落祭司禁忌血清", desc: "詠唱黑暗禁咒的古老祭司，防禦壁障極厚！" },
    30: { name: "🌌 虛空秩序扭曲者 • 零", baseHp: 900, baseAtk: 85, baseSpd: 35, dropItem: "秩序扭曲者核心", desc: "撕裂空間的虛空生物，其存在本身就在干擾力場！" },
    40: { name: "🌊 深淵巨鎧領主 • Scylla", baseHp: 1500, baseAtk: 120, baseSpd: 15, dropItem: "🦀 帝王蟹巨腿", desc: "鎮守深淵 40 層的海棲霸主，蟹螯擁有斷鋼級物理外傷！" }
};

// 3. 預留：領主特殊大招階段觸發詞條 (便於未來給 Boss 加載「狂暴」或者「魔法詠唱」大招)
const BOSS_SKILLS_DATABASE = {
    "👑 哥布林暴君 • 狂怒者": [
        { name: "🔨 崩山巨槌", triggerHpPercent: 50, dmgMultiplier: 1.8, desc: "暴君高舉巨槌砸向地面，造成大範圍物理震盪傷！" }
    ]
};
