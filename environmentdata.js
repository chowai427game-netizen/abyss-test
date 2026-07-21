// ==========================================================================
// 🌀 environmentdata.js：深淵力場異常、黑市/邪神隨機奇遇數據庫
// ==========================================================================

// 1. 地下城力場地貌外觀與警報文字
const ENVIRONMENT_DATABASE = {
    "NORMAL": { className: "env-zone-normal", logText: "✨ 當前環境力場：重力與空間表現穩定" },
    "FIRE": { className: "env-zone-fire", logText: "🌋 警告：進入【烈焰焦土地核】每回合反噬燒血！火法克制" },
    "ICE": { className: "env-zone-ice", logText: "❄️ 警告：進入【萬年永凍冰原】常駐強效治癒禁制！" },
    "POISON": { className: "env-zone-poison", logText: "🧪 警告：進入【瘴氣劇毒沼澤】引導主動技能將深度感染！" },
    "VOID": { className: "env-zone-void", logText: "🌀 警告：進入【重力虛空壓制】主動時間流速發生變異！" }
};

const deepFreeze = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    Object.keys(obj).forEach(prop => {
        if (typeof obj[prop] === 'object' && obj[prop] !== null) {
            deepFreeze(obj[prop]);
        }
    });
    return Object.freeze(obj);
};

// 安全凍結環境資料庫
deepFreeze(ENVIRONMENT_DATABASE);

if (typeof SKILLS_DATABASE !== "undefined") {
    deepFreeze(SKILLS_DATABASE);
}
