// ==========================================================================
// 🌀 environmentdata.js：深淵力場異常數據庫 (具備安全深層凍結防護 v4.1)
// ==========================================================================

const deepFreeze = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    Object.keys(obj).forEach(prop => {
        if (typeof obj[prop] === 'object' && obj[prop] !== null && !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });
    return Object.freeze(obj);
};

// 1. 地下城力場地貌外觀與警報文字及數值機制數據庫
const ENVIRONMENT_DATABASE = {
    "NORMAL": {
        id: "NORMAL",
        name: "穩定場域",
        icon: "✨",
        className: "env-zone-normal",
        logText: "✨ 當前環境力場：重力與空間表現穩定",
        effects: {
            tickDamagePercent: 0,
            healMultiplier: 1.0,
            skillMpExtraCost: 0,
            spdModifier: 0
        }
    },
    "FIRE": {
        id: "FIRE",
        name: "烈焰焦土",
        icon: "🌋",
        className: "env-zone-fire",
        logText: "🌋 警告：進入【烈焰焦土地核】每回合反噬燒血！火法克制",
        effects: {
            tickDamagePercent: 0.05, // 每回合扣最大生命 5%
            healMultiplier: 1.0,
            skillMpExtraCost: 0,
            spdModifier: 0
        }
    },
    "ICE": {
        id: "ICE",
        name: "萬年永凍",
        icon: "❄️",
        className: "env-zone-ice",
        logText: "❄️ 警告：進入【萬年永凍冰原】常駐強效治癒禁制！",
        effects: {
            tickDamagePercent: 0,
            healMultiplier: 0.5, // 所有治癒效果降低 50%
            skillMpExtraCost: 0,
            spdModifier: -5 // 行動速度微幅降低
        }
    },
    "POISON": {
        id: "POISON",
        name: "瘴氣劇毒",
        icon: "🧪",
        className: "env-zone-poison",
        logText: "🧪 警告：進入【瘴氣劇毒沼澤】引導主動技能將深度感染！",
        effects: {
            tickDamagePercent: 0.02, // 每回合扣最大生命 2%
            healMultiplier: 0.8,
            skillMpExtraCost: 5, // 使用技能時額外消耗 5 MP
            spdModifier: 0
        }
    },
    "VOID": {
        id: "VOID",
        name: "重力虛空",
        icon: "🌀",
        className: "env-zone-void",
        logText: "🌀 警告：進入【重力虛空壓制】主動時間流速發生變異！",
        effects: {
            tickDamagePercent: 0,
            healMultiplier: 0.9,
            skillMpExtraCost: 10, // 技能魔力負擔大幅加重
            spdModifier: -10 // 重力壓制，速度大幅降低
        }
    }
};

// 安全凍結環境資料庫，防止運行期被意外篡改
deepFreeze(ENVIRONMENT_DATABASE);

// --------------------------------------------------------------------------
// ⚡ 效能優化與環境力場 API (v4.1)
// --------------------------------------------------------------------------

/**
 * 根據樓層（1F-60F）自動獲取對應的環境力場 Key
 */
function getEnvironmentKeyByFloor(floor) {
    const f = Math.max(1, parseInt(floor) || 1);
    
    // 1F - 9F 穩定綠洲/古墓
    if (f >= 1 && f <= 9) return "NORMAL";
    // 11F - 19F 永凍冰原
    if (f >= 11 && f <= 19) return "ICE";
    // 21F - 29F 烈焰焦土
    if (f >= 21 && f <= 29) return "FIRE";
    // 31F - 39F 虛空裂縫
    if (f >= 31 && f <= 39) return "VOID";
    // 41F - 49F 瘴氣深淵
    if (f >= 41 && f <= 49) return "POISON";
    // 51F - 60F 宇宙虛無星辰
    if (f >= 51 && f <= 60) return "VOID";

    // 10F, 20F, 30F, 40F, 50F, 60F 各自 Boss 關卡主題對應
    if (f === 10) return "NORMAL";
    if (f === 20) return "ICE";
    if (f === 30) return "VOID";
    if (f === 40) return "ICE";
    if (f === 50) return "FIRE";

    return "NORMAL";
}

/**
 * 根據環境 Key 或樓層獲取環境設定物件
 */
function getEnvironmentConfig(envKeyOrFloor) {
    if (typeof envKeyOrFloor === "number") {
        const key = getEnvironmentKeyByFloor(envKeyOrFloor);
        return ENVIRONMENT_DATABASE[key] || ENVIRONMENT_DATABASE.NORMAL;
    }
    if (typeof envKeyOrFloor === "string" && ENVIRONMENT_DATABASE[envKeyOrFloor]) {
        return ENVIRONMENT_DATABASE[envKeyOrFloor];
    }
    return ENVIRONMENT_DATABASE.NORMAL;
}

/**
 * 計算環境每回合對玩家造成的狀態與傷害影響（提供給戰鬥引擎 statengine.js 調用）
 */
function applyEnvironmentTurnEffect(run, envKey) {
    if (!run) return { dmg: 0, msg: "", healMultiplier: 1.0, skillMpExtraCost: 0, spdModifier: 0 };
    
    const config = getEnvironmentConfig(envKey);
    const effects = config.effects;
    
    let dmg = 0;
    let msg = "";

    // 1. 烈焰/劇毒燒血計算
    if (effects.tickDamagePercent > 0) {
        const rawDmg = Math.floor((run.maxHp || 100) * effects.tickDamagePercent);
        
        // 考慮咖喱料理抗性 (熔岩惡魔激辣咖喱可減半火傷)
        let finalDmg = rawDmg;
        if (envKey === "FIRE" && run.buffs && run.buffs.fireResist) {
            finalDmg = Math.floor(rawDmg * 0.5);
        }
        
        dmg = Math.max(1, finalDmg);
        run.hp = Math.max(1, (run.hp || 1) - dmg);
        msg = `${config.icon}【${config.name}】環境力場侵蝕，受到 ${dmg} 點環境真傷！`;
    }

    return {
        dmg: dmg,
        msg: msg,
        healMultiplier: effects.healMultiplier || 1.0,
        skillMpExtraCost: effects.skillMpExtraCost || 0,
        spdModifier: effects.spdModifier || 0
    };
}
