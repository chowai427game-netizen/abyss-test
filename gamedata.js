// ==========================================================================
// 🌋 命淵生態圈：地下城魔物、每 10 層領主與料理數據庫
// ==========================================================================

// 1. 普通小怪數據庫（隨機遭遇）
const REGULAR_MONSTERS_POOL = [
    { name: "💧 藍色史萊姆", baseHp: 40, hpScale: 14, baseAtk: 4, atkScale: 2.5 },
    { name: "👺 綠皮哥布林", baseHp: 45, hpScale: 15, baseAtk: 5, atkScale: 2.8 },
    { name: "🐗 荒野半獸人", baseHp: 55, hpScale: 18, baseAtk: 6, atkScale: 3.2 },
    { name: "👻 迷途哭泣怨靈", baseHp: 38, hpScale: 13, baseAtk: 5, atkScale: 3.0 },
    { name: "🧱 古墓巨石守衛", baseHp: 70, hpScale: 22, baseAtk: 4, atkScale: 2.2 }
];

// 2. 每 10 層定點攔截的「深淵領主 Boss」數據庫
const BOSS_DATABASE = {
    10: { name: "👑 哥布林暴君 • 狂怒者", baseHp: 250, baseAtk: 35, dropItem: "哥布林乾癟香料", desc: "深淵前層的殘暴統治者，巨槌帶有粉碎性震盪！" },
    20: { name: "🧙 深淵墮落大祭司 • 莫爾", baseHp: 500, baseAtk: 55, dropItem: "墮落祭司禁忌血清", desc: "詠唱黑暗禁咒的古老祭司，防禦壁障極厚！" },
    30: { name: "🌌 虛空秩序扭曲者 • 零", baseHp: 900, baseAtk: 85, dropItem: "秩序扭曲者核心", desc: "撕裂空間的虛空生物，其存在本身就在干擾 QTE 力場！" },
    40: { name: "🌊 深淵巨鎧領主 • Scylla", baseHp: 1500, baseAtk: 120, dropItem: "🦀 帝王蟹巨腿", desc: "鎮守深淵 40 層的海棲霸主，蟹螯擁有斷鋼級物理外傷！" }
};

// 3. 皇家廚藝配方數據庫
const RECIPES_DATABASE = [
    { name: "🍲 哥布林亂燉雜碎湯", ingredients: { "半獸人厚實後腿肉": 1, "哥布林乾癟香料": 1 }, type: "village_eat", desc: "進城前吃：進入地下城前 15 層最大生命值固定 +60 點。" },
    { name: "🌭 皇家大快活厚牛巨堡", ingredients: { "半獸人厚實後腿肉": 2, "史萊姆核心黏液": 1 }, type: "dungeon_use", desc: "局內攜帶：戰鬥中吃當場奶滿 100 點 HP，並加載 80 點物理盾。" },
    { name: "🍮 發光奧術史萊姆凍", ingredients: { "史萊姆核心黏液": 2, "古墓巨石苔蘚": 1 }, type: "village_eat", desc: "進城前吃：Max MP 永久 +30，每回合 MP 自動回復固定 +3。" },
    { name: "🍧 萬年永凍刨冰", ingredients: { "萬年永凍冰晶": 1, "怨靈純淨淚晶": 1 }, type: "dungeon_use", desc: "局內攜帶：當前對戰魔物強行陷入【凍結】狀態 2 回合（封鎖再生）。" },
    { name: "🍲 皇家銀河蟹肉宴", ingredients: { "🦀 帝王蟹巨腿": 1, "怨靈純淨淚晶": 1 }, type: "village_eat", desc: "進城前吃：最大生命永續 +200 點，完美免疫永凍冰原治癒禁制。" },
    { name: "🍷 秩序逆轉禁忌血釀", ingredients: { "秩序扭曲者核心": 1, "墮落祭司禁忌血清": 1 }, type: "dungeon_use", desc: "局內攜帶：顛倒虛空！直接強行跳過當前樓層戰鬥，無傷安全降臨下一層。" }
];

// 4. 普通小怪的素材掉落映射表
const MONSTER_DROPS = {
    "💧 藍色史萊姆": "史萊姆核心黏液", 
    "👺 綠皮哥布林": "哥布林乾癟香料", 
    "🐗 荒野半獸人": "半獸人厚實後腿肉", 
    "👻 迷途哭泣怨靈": "怨靈純淨淚晶", 
    "🧱 古墓巨石守衛": "古墓巨石苔蘚",
    "🧙 深淵墮落祭司": "墮落祭司禁忌血清",
    "🧊 萬年霜凍冰魔": "萬年永凍冰晶", 
    "🌌 虛空秩序扭曲者": "秩序扭曲者核心", 
    "🌊 深淵巨鎧 Scylla": "🦀 帝王蟹巨腿"
};
