// ==========================================================================
// 🎭 jobdata.js：皇家五大職業核心數據、屬性成長、技能庫與轉職樹
// ==========================================================================

// 1. 🎭 職業基礎資訊、成長係數與固有天賦
const JOB_DATABASE = {
    swordsman: {
        id: "swordsman",
        name: "劍士",
        icon: "⚔️",
        desc: "擁有高血量與優異防護力，前線抗傷與近戰物理輸出的核心主力。",
        primaryStat: "STR",
        secondaryStat: "VIT",
        hpScaling: 12.0,   // 每級/體質 HP 成長係數
        mpScaling: 2.0,    // 每級/智力 MP 成長係數
        baseDef: 5,
        baseMdef: 2,
        passiveTrait: { name: "鋼鐵意志", desc: "受到的物理傷害永久減少 10%，受擊時 15% 機率獲得 30 點護盾。" }
    },
    magician: {
        id: "magician",
        name: "魔法師",
        icon: "🪄",
        desc: "掌控冰火雷三系元素，能夠打出毀滅性的遠程範圍魔攻與控場。",
        primaryStat: "INT",
        secondaryStat: "DEX",
        hpScaling: 6.5,
        mpScaling: 8.0,
        baseDef: 1,
        baseMdef: 8,
        passiveTrait: { name: "元素共鳴", desc: "魔法攻擊 (MATK) 提升 15%，施法時有 20% 機率不消耗 MP。" }
    },
    acolyte: {
        id: "acolyte",
        name: "服事",
        icon: "✝️",
        desc: "神的代言人，具備強大的治癒、神聖增益與對不死系魔物的特攻力量。",
        primaryStat: "INT",
        secondaryStat: "VIT",
        hpScaling: 8.5,
        mpScaling: 6.0,
        baseDef: 3,
        baseMdef: 6,
        passiveTrait: { name: "聖光庇護", desc: "受到的魔法傷害減少 15%，所有治癒與護盾效果提升 25%。" }
    },
    thief: {
        id: "thief",
        name: "盜賊",
        icon: "🗡️",
        desc: "身法敏捷、擅長淬毒與暴擊，擁有全職業最高的閃避率與瞬間爆發。",
        primaryStat: "AGI",
        secondaryStat: "STR",
        hpScaling: 7.5,
        mpScaling: 3.5,
        baseDef: 2,
        baseMdef: 2,
        passiveTrait: { name: "殘影身法", desc: "基礎迴避率 (FLEE) 額外 +15%，普攻有 20% 機率觸發雙連擊。" }
    },
    archer: {
        id: "archer",
        name: "弓箭手",
        icon: "🏹",
        desc: "精準無比的百步穿楊專家，高命中、遠距離高百爆與穩定攻速。",
        primaryStat: "DEX",
        secondaryStat: "AGI",
        hpScaling: 7.0,
        mpScaling: 4.0,
        baseDef: 2,
        baseMdef: 3,
        passiveTrait: { name: "鷹眼狙擊", desc: "命中率 (HIT) 額外 +20，無視目標 25% 的物理防禦。" }
    }
};

// 2. 📊 職業 Job Level 屬性加成矩陣 (配點與 Job 等級帶來的加成)
const JOB_STAT_BONUS = {
    swordsman: { STR: 6, AGI: 2, VIT: 7, INT: 1, DEX: 3, LUK: 2 },
    magician:  { STR: 1, AGI: 2, VIT: 2, INT: 8, DEX: 6, LUK: 2 },
    acolyte:   { STR: 2, AGI: 2, VIT: 5, INT: 6, DEX: 4, LUK: 3 },
    thief:     { STR: 4, AGI: 8, VIT: 2, INT: 1, DEX: 4, LUK: 3 },
    archer:    { STR: 2, AGI: 6, VIT: 2, INT: 2, DEX: 8, LUK: 2 }
};

// 3. 📖 職業技能庫 (全面配合 RO 六大屬性與戰鬥引擎)
const SKILLS_DATABASE = {
    swordsman: [
        { id: "s_1", name: "狂擊", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "物理重擊造成 180% 傷害，機率使怪眩暈。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * (1.4 + lv * 0.4)), stunChance: 20 + lv * 10 }) },
        { id: "s_2", name: "怒爆", type: "active", mp: 25, reqLv: 3, goldCost: 250, reqMat: { "哥布林香料": 1 }, desc: "釋放鬥氣造成火真傷，附加普攻燃燒。", run: (lv) => ({ fireDmg: 20 + lv * 20, burnStacks: lv }) },
        { id: "s_3", name: "霸體", type: "active", mp: 20, reqLv: 5, goldCost: 450, reqMat: { "巨石苔蘚": 2 }, desc: "不屈姿態！自身固定減傷面板暴增，持續多回合。", run: (lv) => ({ blockBuff: 8 + lv * 6, turns: 3 + lv }) },
        { id: "s_4", name: "盾擊", type: "active", mp: 15, reqLv: 8, goldCost: 700, reqMat: { "硬殼龜甲": 3 }, desc: "重盾破防，強制扣除敵護盾並為自己加載晶體盾。", run: (lv) => ({ shieldGain: 40 + lv * 40 }) },
        { id: "s_5", name: "殘影斬", type: "active", mp: 35, reqLv: 12, goldCost: 1200, reqMat: { "獸人後腿肉": 3 }, desc: "發動雙段連續物理突刺，每段造成高度物理外傷。", run: (lv) => ({ isDoubleHit: true, pScale: 0.9 + lv * 0.3 }) }
    ],
    magician: [
        { id: "m_1", name: "火箭術", type: "active", mp: 30, reqLv: 1, goldCost: 100, reqMat: {}, desc: "造成火傷並附燃燒。若怪處於凍結，此招傷害爆發 2.5 倍。", run: (lv) => ({ baseFire: 18 + lv * 18, meltMult: 2.5 + lv * 0.5 }) },
        { id: "m_2", name: "冰箭術", type: "active", mp: 30, reqLv: 3, goldCost: 250, reqMat: { "史萊姆黏液": 2 }, desc: "造成水傷。成功有高機率將魔物強行【凍結】1回合。", run: (lv) => ({ baseWater: 20 + lv * 15, freezeChance: 30 + lv * 15 }) },
        { id: "m_3", name: "禪心", type: "active", mp: 0, reqLv: 5, goldCost: 450, reqMat: {}, desc: "犧牲當前行動不發動揮砍，強行讓 MP 當場大回復。", run: (lv) => ({ mpRestore: 55 + lv * 25 }) },
        { id: "m_4", name: "火牆術", type: "active", mp: 45, reqLv: 8, goldCost: 700, reqMat: { "哥布林香料": 3 }, desc: "立起火牆。敵反擊時每回合開頭反噬受創並燃燒。", run: (lv) => ({ thornsFire: 18 + lv * 12, duration: 1 + lv }) },
        { id: "m_5", name: "雷爆術", type: "active", mp: 60, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 2 }, desc: "雷暴大轟炸；魔物身上每有1層毒 or 火狀態，傷害加深。", run: (lv) => ({ baseStorm: 60 + lv * 35, ampPerStatus: 0.2 + lv * 0.05 }) }
    ],
    acolyte: [
        { id: "a_1", name: "治癒術", type: "active", mp: 20, reqLv: 1, goldCost: 100, reqMat: {}, desc: "聖光降臨，立刻百分比回復自身已損失生命值。", run: (lv, maxHp, dummy, hp) => ({ healPercent: 0.18 + lv * 0.08, lostHp: maxHp - hp }) },
        { id: "a_2", name: "天使之賜福", type: "active", mp: 40, reqLv: 3, goldCost: 250, reqMat: { "祭司血清": 1 }, desc: "神聖洗禮！本局冒險基礎攻擊與最大生命上限永續加載。", run: (lv) => ({ permAtk: 5 + lv * 5, permHp: 30 + lv * 30 }) },
        { id: "a_3", name: "加速術", type: "active", mp: 15, reqLv: 5, goldCost: 450, reqMat: {}, desc: "極限閃避！完美閃避率提升，且下一回合自身必定暴擊。", run: (lv) => ({ permDodge: 8 + lv * 4, guaranteedCritNext: true }) },
        { id: "a_4", name: "光之壁", type: "active", mp: 25, reqLv: 8, goldCost: 700, reqMat: { "祭司血清": 3 }, desc: "當魔物施展大招時，強行將該傷害高額抹除。", run: (lv) => ({ bossDmgCut: 0.4 + lv * 0.15 }) },
        { id: "a_5", name: "神聖之光", type: "active", mp: 15, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 3 }, desc: "射出破邪聖光。對特定不死系或深層魔物有數倍特大傷。", run: (lv) => ({ holyBase: 15 + lv * 20, undeadMult: 2.0 + lv * 1.0 }) }
    ],
    thief: [
        { id: "t_1", name: "毒刃", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "淬毒突刺！造成物理傷並為魔物注入 2 層【劇毒】。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * 1.3), poisonStacks: 2 }) },
        { id: "t_2", name: "殘影", type: "active", mp: 20, reqLv: 3, goldCost: 250, reqMat: { "史萊姆黏液": 2 }, desc: "極速閃避姿態！大幅提升閃避率與行動速度，持續 3 回合。", run: (lv) => ({ dodgeBuff: 15 + lv * 5, spdBuff: 10 + lv * 2 }) },
        { id: "t_3", name: "伏擊暴擊", type: "active", mp: 25, reqLv: 5, goldCost: 450, reqMat: { "獸人後腿肉": 2 }, desc: "潛行致命一擊！本次攻擊 100% 觸發暴擊且暴傷翻倍。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * (2.0 + lv * 0.5)), forceCrit: true }) },
        { id: "t_4", name: "神偷手套", type: "active", mp: 10, reqLv: 8, goldCost: 700, reqMat: { "哥布林香料": 3 }, desc: "戰術順手牽羊！攻擊時強制竊取魔物金幣與隨機素材。", run: (lv) => ({ stealGold: 30 + lv * 20, stealMat: true }) },
        { id: "t_5", name: "劇毒爆裂", type: "active", mp: 40, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 2 }, desc: "引爆敵方身上所有劇毒，按毒素層數造成毀滅性真傷！", run: (lv) => ({ explodePoison: true, baseDmg: 60 + lv * 35 }) }
    ],
    archer: [
        { id: "r_1", name: "二連矢", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "極速連射！對魔物連續射出兩箭造成高額打擊。", run: (lv) => ({ isDoubleHit: true, pScale: 0.85 + lv * 0.25 }) },
        { id: "r_2", name: "衝鋒箭", type: "active", mp: 20, reqLv: 3, goldCost: 250, reqMat: { "硬殼龜甲": 1 }, desc: "強烈擊退箭矢！造成物理傷害並有高機率強行眩暈魔物。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * 1.4), stunChance: 50 + lv * 10 }) },
        { id: "r_3", name: "心眼", type: "passive", reqLv: 5, goldCost: 450, reqMat: {}, desc: "【自動被動】精準狙擊，永久提升自身 10% 暴擊率與 5 點速度。" },
        { id: "r_4", name: "箭雨狂轟", type: "active", mp: 35, reqLv: 8, goldCost: 700, reqMat: { "巨石苔蘚": 3 }, desc: "漫天箭雨！造成高度貫穿打擊，無視敵方 50% 物理防護。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * 1.8), pierceArmor: 0.5 }) },
        { id: "r_5", name: "鷹眼狙擊", type: "active", mp: 50, reqLv: 12, goldCost: 1200, reqMat: { "祭司血清": 3 }, desc: "極限瞄準爆頭！對大領主或魔物造成超高倍率致命打擊。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * (3.0 + lv * 0.8)) }) }
    ]
};

// 4. ⚔️ 預留進階轉職樹數據 (二轉職業)
const ADVANCED_JOBS_DATABASE = {
    swordsman: [
        { id: "knight", name: "騎士", icon: "🏇", reqLv: 20, desc: "掌握槍術與衝鋒，極致近戰輸出。" },
        { id: "crusader", name: "十字軍", icon: "🛡️", reqLv: 20, desc: "神聖盾牌與極致體質，隊伍不倒要塞。" }
    ],
    magician: [
        { id: "wizard", name: "巫師", icon: "🧙‍♂️", reqLv: 20, desc: "大範圍毀滅魔法，元素掌控者。" },
        { id: "sage", name: "賢者", icon: "📖", reqLv: 20, desc: "自由詠唱與魔法打斷，戰鬥法師。" }
    ],
    acolyte: [
        { id: "priest", name: "祭司", icon: "👼", reqLv: 20, desc: "頂級輔助與強效驅魔聖光。" },
        { id: "monk", name: "武僧", icon: "👊", reqLv: 20, desc: "阿修羅霸凰拳，近戰神聖爆發。" }
    ],
    thief: [
        { id: "assassin", name: "刺客", icon: "🥷", reqLv: 20, desc: "雙手持刃與致命劇毒，影之殺手。" },
        { id: "rogue", name: "流氓", icon: "🗡️", reqLv: 20, desc: "強奪偷竊與弓刀雙修的戰術大師。" }
    ],
    archer: [
        { id: "hunter", name: "獵人", icon: "🦅", reqLv: 20, desc: "獵鷹協同作戰與陷阱大師。" },
        { id: "bard_dancer", name: "詩人/舞孃", icon: "🪕", reqLv: 20, desc: "戰歌合奏與團隊全能力增益。" }
    ]
};

// ==========================================================================
// 🛠️ 職業輔助邏輯與驗證函式
// ==========================================================================

/**
 * 獲取職業計算後的額外屬性加成 (根據 Job Level 比例算)
 */
function getJobBonusStats(jobId, jobLevel = 1) {
    const baseBonus = JOB_STAT_BONUS[jobId] || { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    const factor = Math.min(2.0, 1.0 + (jobLevel - 1) * 0.05); // 每提升 1 級 Job 多 5% 職業加成
    
    let calculated = {};
    for (let key in baseBonus) {
        calculated[key] = Math.floor(baseBonus[key] * factor);
    }
    return calculated;
}

/**
 * 檢查角色是否滿足學習某技能的條件
 */
function canLearnSkill(playerData, skill, warehouse) {
    if (playerData.level < skill.reqLv) {
        return { canLearn: false, reason: `等級不足！需達到 Lv.${skill.reqLv}` };
    }
    if (playerData.gold < skill.goldCost) {
        return { canLearn: false, reason: `金幣不足！需要 ${skill.goldCost}G` };
    }
    for (let mat in skill.reqMat) {
        let count = warehouse[mat] || 0;
        if (count < skill.reqMat[mat]) {
            return { canLearn: false, reason: `缺少素材：${mat} x${skill.reqMat[mat]}` };
        }
    }
    return { canLearn: true };
}

// 凍結保護
deepFreeze(JOB_DATABASE);
deepFreeze(JOB_STAT_BONUS);
deepFreeze(SKILLS_DATABASE);
deepFreeze(ADVANCED_JOBS_DATABASE);
