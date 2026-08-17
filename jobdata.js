// ==========================================================================
// 🎭 jobdata.js：皇家五大基礎職業、十大二轉進階職業、二轉樹與技能庫
// ==========================================================================

const JOB_DATABASE = {
    // ----------------------------------------------------------------------
    // ⚔️ 一轉基礎職業 (Base Jobs)
    // ----------------------------------------------------------------------
    swordsman: {
        id: "swordsman",
        name: "劍士",
        icon: "⚔️",
        desc: "擁有高血量與優異防護力，前線抗傷與近戰物理輸出的核心主力。",
        primaryStat: "STR",
        secondaryStat: "VIT",
        hpScaling: 12.0,
        mpScaling: 2.0,
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
    },

    // ----------------------------------------------------------------------
    // 🏇 二轉進階職業 (Advanced 2nd Jobs)
    // ----------------------------------------------------------------------
    knight: {
        id: "knight",
        baseJob: "swordsman",
        name: "騎士",
        icon: "🏇",
        desc: "掌握槍術與衝鋒，擁有極致近戰突破力與多段貫穿衝擊力。",
        primaryStat: "STR",
        secondaryStat: "AGI",
        hpScaling: 15.0,
        mpScaling: 2.5,
        baseDef: 10,
        baseMdef: 4,
        passiveTrait: { name: "騎乘術", desc: "行動速度 (SPD) +10，近戰物理傷害提升 20%。" }
    },
    crusader: {
        id: "crusader",
        baseJob: "swordsman",
        name: "十字軍",
        icon: "🛡️",
        desc: "神聖盾牌與極致體質，以聖光反彈傷害並為自身加載不屈防禦。",
        primaryStat: "VIT",
        secondaryStat: "STR",
        hpScaling: 18.0,
        mpScaling: 3.5,
        baseDef: 15,
        baseMdef: 8,
        passiveTrait: { name: "聖殿壁壘", desc: "最大 HP +20%，受擊時 30% 機率反彈 25% 傷害。" }
    },
    wizard: {
        id: "wizard",
        baseJob: "magician",
        name: "巫師",
        icon: "🧙‍♂️",
        desc: "大範圍毀滅魔法主宰，能召喚暴風雪與毀滅隕石碾碎敵陣。",
        primaryStat: "INT",
        secondaryStat: "DEX",
        hpScaling: 7.5,
        mpScaling: 12.0,
        baseDef: 2,
        baseMdef: 12,
        passiveTrait: { name: "元素主宰", desc: "魔法攻擊 (MATK) 提升 25%，魔法造成暴擊。" }
    },
    sage: {
        id: "sage",
        baseJob: "magician",
        name: "賢者",
        icon: "📖",
        desc: "戰鬥型魔法師，善於邊揮砍邊自動念咒，並能取消敵方增益。",
        primaryStat: "INT",
        secondaryStat: "AGI",
        hpScaling: 8.5,
        mpScaling: 10.0,
        baseDef: 4,
        baseMdef: 10,
        passiveTrait: { name: "自由詠唱", desc: "自動戰鬥時 30% 機率連續施展雙重主動魔法。" }
    },
    priest: {
        id: "priest",
        baseJob: "acolyte",
        name: "祭司",
        icon: "👼",
        desc: "頂級神聖輔助，強效聖光大幅提高生存與全隊能力。",
        primaryStat: "INT",
        secondaryStat: "VIT",
        hpScaling: 10.0,
        mpScaling: 8.5,
        baseDef: 5,
        baseMdef: 10,
        passiveTrait: { name: "神聖光環", desc: "治癒與護盾效果提升 50%，受到的所有傷害減少 15%。" }
    },
    monk: {
        id: "monk",
        baseJob: "acolyte",
        name: "武僧",
        icon: "👊",
        desc: "近戰神聖爆發大師，連環拳與阿修羅霸凰拳帶來瞬間秒殺。",
        primaryStat: "STR",
        secondaryStat: "INT",
        hpScaling: 11.0,
        mpScaling: 5.0,
        baseDef: 6,
        baseMdef: 6,
        passiveTrait: { name: "爆氣蓄勁", desc: "暴擊率 (CRIT) +15%，物理攻擊無視敵方 25% 防禦。" }
    },
    assassin: {
        id: "assassin",
        baseJob: "thief",
        name: "刺客",
        icon: "🥷",
        desc: "影之殺手，雙手持刃與高速連擊，配合劇毒帶來毀滅打擊。",
        primaryStat: "AGI",
        secondaryStat: "STR",
        hpScaling: 9.0,
        mpScaling: 4.0,
        baseDef: 3,
        baseMdef: 3,
        passiveTrait: { name: "影之雙刃", desc: "閃避率 (FLEE) +25%，普攻 35% 機率觸發雙連擊。" }
    },
    rogue: {
        id: "rogue",
        baseJob: "thief",
        name: "流氓",
        icon: "🗡️",
        desc: "戰術搶奪專家，擅長背刺爆頭與強制奪取敵方物資資源。",
        primaryStat: "STR",
        secondaryStat: "DEX",
        hpScaling: 9.5,
        mpScaling: 4.5,
        baseDef: 4,
        baseMdef: 3,
        passiveTrait: { name: "盜賊美學", desc: "戰利品獲取翻倍，暴擊傷害提升 30%。" }
    },
    hunter: {
        id: "hunter",
        baseJob: "archer",
        name: "獵人",
        icon: "🦅",
        desc: "獵鷹協同作戰專家與陷阱大師，具備極高的遠程貫穿力。",
        primaryStat: "DEX",
        secondaryStat: "AGI",
        hpScaling: 8.5,
        mpScaling: 5.0,
        baseDef: 3,
        baseMdef: 4,
        passiveTrait: { name: "獵鷹協同", desc: "攻擊時 40% 機率觸發獵鷹俯衝，造成額外無視防禦物理傷害。" }
    },
    bard_dancer: {
        id: "bard_dancer",
        baseJob: "archer",
        name: "詩人/舞孃",
        icon: "🪕",
        desc: "戰歌合奏大師，提供全方位戰鬥增益與節奏掌控。",
        primaryStat: "DEX",
        secondaryStat: "VIT",
        hpScaling: 9.0,
        mpScaling: 6.0,
        baseDef: 4,
        baseMdef: 5,
        passiveTrait: { name: "戰歌合奏", desc: "戰鬥開局自動獲得全屬性 +15% 增益。" }
    }
};

const JOB_STAT_BONUS = {
    // 一轉
    swordsman: { STR: 6, AGI: 2, VIT: 7, INT: 1, DEX: 3, LUK: 2 },
    magician:  { STR: 1, AGI: 2, VIT: 2, INT: 8, DEX: 6, LUK: 2 },
    acolyte:   { STR: 2, AGI: 2, VIT: 5, INT: 6, DEX: 4, LUK: 3 },
    thief:     { STR: 4, AGI: 8, VIT: 2, INT: 1, DEX: 4, LUK: 3 },
    archer:    { STR: 2, AGI: 6, VIT: 2, INT: 2, DEX: 8, LUK: 2 },

    // 二轉
    knight:     { STR: 12, AGI: 6, VIT: 12, INT: 2, DEX: 6, LUK: 4 },
    crusader:   { STR: 8, AGI: 4, VIT: 16, INT: 6, DEX: 5, LUK: 5 },
    wizard:     { STR: 2, AGI: 4, VIT: 4, INT: 18, DEX: 12, LUK: 4 },
    sage:       { STR: 3, AGI: 8, VIT: 5, INT: 15, DEX: 8, LUK: 5 },
    priest:     { STR: 4, AGI: 4, VIT: 10, INT: 14, DEX: 8, LUK: 6 },
    monk:       { STR: 12, AGI: 6, VIT: 8, INT: 8, DEX: 6, LUK: 4 },
    assassin:   { STR: 8, AGI: 18, VIT: 4, INT: 2, DEX: 8, LUK: 6 },
    rogue:      { STR: 10, AGI: 12, VIT: 6, INT: 3, DEX: 10, LUK: 5 },
    hunter:     { STR: 4, AGI: 12, VIT: 4, INT: 4, DEX: 18, LUK: 4 },
    bard_dancer:{ STR: 4, AGI: 10, VIT: 8, INT: 8, DEX: 12, LUK: 4 }
};

const SKILLS_DATABASE = {
    // ----------------------------------------------------------------------
    // 一轉技能庫
    // ----------------------------------------------------------------------
    swordsman: [
        { id: "s_1", name: "狂擊", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "物理重擊造成高額傷害，機率使怪眩暈。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * (1.4 + lv * 0.4)), hitCount: 1, stunChance: 20 + lv * 10 }) },
        { id: "s_2", name: "怒爆", type: "active", mp: 25, reqLv: 3, goldCost: 250, reqMat: { "哥布林香料": 1 }, desc: "釋放鬥氣造成火真傷，附加普攻燃燒。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * 1.2) + (20 + lv * 20), hitCount: 1, burnStacks: lv }) },
        { id: "s_3", name: "霸體", type: "active", mp: 20, reqLv: 5, goldCost: 450, reqMat: { "巨石苔蘚": 2 }, desc: "不屈姿態！自身固定減傷面板暴增，持續多回合。", run: (lv) => ({ blockBuff: 8 + lv * 6, turns: 3 + lv }) },
        { id: "s_4", name: "盾擊", type: "active", mp: 15, reqLv: 8, goldCost: 700, reqMat: { "硬殼龜甲": 3 }, desc: "重盾破防，強制扣除敵護盾並為自己加載晶體盾。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * 1.1), hitCount: 1, shieldGain: 40 + lv * 40 }) },
        { id: "s_5", name: "殘影斬", type: "active", mp: 35, reqLv: 12, goldCost: 1200, reqMat: { "獸人後腿肉": 3 }, desc: "發動多段連續物理突刺！每提升 5 級增加 +1 次突刺打擊。", run: (lv, atkPower) => {
            let hits = 2 + Math.floor(lv / 5);
            return { dmg: Math.floor((atkPower * 0.85 + lv * 12) * hits), hitCount: hits, isDoubleHit: hits === 2 };
        } }
    ],

    magician: [
        { id: "m_1", name: "火箭術", type: "active", mp: 30, reqLv: 1, goldCost: 100, reqMat: {}, desc: "召喚火焰隕石。每升 1 級增加 +1 發火焰彈與合共傷害！處於冰凍狀態時傷害為 2.5 倍。", run: (lv, matkPower) => {
            let hits = lv; // Lv.1 = 1發, Lv.5 = 5發, Lv.10 = 10發
            let dmgPerHit = matkPower * 0.85 + lv * 10;
            return { dmg: Math.floor(dmgPerHit * hits), hitCount: hits, isMagic: true, burnStacks: Math.floor(lv / 2) };
        } },
        { id: "m_2", name: "冰箭術", type: "active", mp: 30, reqLv: 3, goldCost: 250, reqMat: { "史萊姆黏液": 2 }, desc: "射出極寒冰錐。每升 1 級增加 +1 發冰錐！成功有高機率將魔物【凍結】1回合。", run: (lv, matkPower) => {
            let hits = lv;
            let dmgPerHit = matkPower * 0.75 + lv * 8;
            return { dmg: Math.floor(dmgPerHit * hits), hitCount: hits, freezeChance: 30 + lv * 10, isMagic: true };
        } },
        { id: "m_3", name: "禪心", type: "active", mp: 0, reqLv: 5, goldCost: 450, reqMat: {}, desc: "強行讓 MP 當場大回復。", run: (lv) => ({ mpRestore: 55 + lv * 25 }) },
        { id: "m_4", name: "火牆術", type: "active", mp: 45, reqLv: 8, goldCost: 700, reqMat: { "哥布林香料": 3 }, desc: "立起火牆。敵反擊時每回合開頭反噬受創並燃燒。", run: (lv, matkPower) => ({ dmg: Math.floor(matkPower * 1.1), hitCount: 1, thornsFire: 18 + lv * 12, duration: 1 + lv, isMagic: true }) },
        { id: "m_5", name: "雷爆術", type: "active", mp: 60, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 2 }, desc: "雷暴大轟炸！隨等級提高落雷發數 (1 + Lv/2)，魔物身上有毒或火時加深傷害。", run: (lv, matkPower) => {
            let hits = 1 + Math.floor(lv / 2);
            return { dmg: Math.floor((matkPower * 1.2 + lv * 20) * hits), hitCount: hits, isMagic: true };
        } }
    ],

    acolyte: [
        { id: "a_1", name: "治癒術", type: "active", mp: 20, reqLv: 1, goldCost: 100, reqMat: {}, desc: "聖光降臨，立刻百分比回復自身生命值。", run: (lv, dummy, maxMp, hp, maxHp) => ({ healPercent: 0.18 + lv * 0.08, hitCount: 1, lostHp: (maxHp || 100) - (hp || 0) }) },
        { id: "a_2", name: "天使之賜福", type: "active", mp: 40, reqLv: 3, goldCost: 250, reqMat: { "祭司血清": 1 }, desc: "神聖洗禮！本局冒險基礎攻擊與最大生命上限永續加載。", run: (lv) => ({ permAtk: 5 + lv * 5, permHp: 30 + lv * 30 }) },
        { id: "a_3", name: "加速術", type: "active", mp: 15, reqLv: 5, goldCost: 450, reqMat: {}, desc: "極限閃避！完美閃避率提升。", run: (lv) => ({ permDodge: 8 + lv * 4, guaranteedCritNext: true }) },
        { id: "a_4", name: "光之壁", type: "active", mp: 25, reqLv: 8, goldCost: 700, reqMat: { "祭司血清": 3 }, desc: "當魔物施展大招時，強行將該傷害高額抹除。", run: (lv) => ({ bossDmgCut: 0.4 + lv * 0.15 }) },
        { id: "a_5", name: "神聖之光", type: "active", mp: 15, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 3 }, desc: "射出破邪聖光。每 2 級增加 +1 束聖光柱 (1 + Lv/2)，對深層魔物造成多段無視防禦打擊。", run: (lv, matkPower) => {
            let hits = 1 + Math.floor(lv / 2);
            return { dmg: Math.floor((matkPower * 1.1 + lv * 18) * hits), hitCount: hits, isMagic: true, ignoreDef: true };
        } }
    ],

    thief: [
        { id: "t_1", name: "毒刃", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "淬毒突刺！每 3 級增加 +1 發毒刃投擲，並注入【劇毒】。", run: (lv, atkPower) => {
            let hits = 1 + Math.floor(lv / 3);
            return { dmg: Math.floor((atkPower * 1.0 + lv * 12) * hits), hitCount: hits, poisonStacks: 2 + lv };
        } },
        { id: "t_2", name: "殘影", type: "active", mp: 20, reqLv: 3, goldCost: 250, reqMat: { "史萊姆黏液": 2 }, desc: "極速閃避姿態！大幅提升閃避率與行動速度，持續 3 回合。", run: (lv) => ({ dodgeBuff: 15 + lv * 5, spdBuff: 10 + lv * 2 }) },
        { id: "t_3", name: "伏擊暴擊", type: "active", mp: 25, reqLv: 5, goldCost: 450, reqMat: { "獸人後腿肉": 2 }, desc: "潛行致命一擊！本次攻擊 100% 觸發暴擊且暴傷翻倍。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * (2.0 + lv * 0.5)), hitCount: 1, forceCrit: true }) },
        { id: "t_4", name: "神偷手套", type: "active", mp: 10, reqLv: 8, goldCost: 700, reqMat: { "哥布林香料": 3 }, desc: "戰術順手牽羊！攻擊時強制竊取魔物金幣與隨機素材。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * 1.0), hitCount: 1, stealGold: 30 + lv * 20, stealMat: true }) },
        { id: "t_5", name: "劇毒爆裂", type: "active", mp: 40, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 2 }, desc: "引爆敵方身上所有劇毒，按毒素層數造成毀滅性真傷！", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * 1.5) + (60 + lv * 35), hitCount: 1, explodePoison: true }) }
    ],

    archer: [
        { id: "r_1", name: "二連矢", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "極速連射！預設射出 2 箭，等級 5 以上解鎖 3 連發狂轟！", run: (lv, atkPower) => {
            let hits = lv >= 5 ? 3 : 2;
            return { dmg: Math.floor((atkPower * 0.8 + lv * 15) * hits), hitCount: hits, isDoubleHit: hits === 2, isTripleHit: hits === 3 };
        } },
        { id: "r_2", name: "衝鋒箭", type: "active", mp: 20, reqLv: 3, goldCost: 250, reqMat: { "硬殼龜甲": 1 }, desc: "強烈擊退箭矢！造成物理傷害並有高機率強行眩暈魔物。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * (1.3 + lv * 0.3)), hitCount: 1, stunChance: 50 + lv * 10 }) },
        { id: "r_3", name: "心眼", type: "passive", reqLv: 5, goldCost: 450, reqMat: {}, passiveStats: { critChance: 10, spd: 5 }, desc: "【被動】精準狙擊，永久提升自身 10% 暴擊率與 5 點速度。" },
        { id: "r_4", name: "箭雨狂轟", type: "active", mp: 35, reqLv: 8, goldCost: 700, reqMat: { "巨石苔蘚": 3 }, desc: "漫天箭雨！隨等級提升箭矢瀑布數量 (3 + Lv/2)，無視 50% 防禦。", run: (lv, atkPower) => {
            let hits = 3 + Math.floor(lv / 2);
            return { dmg: Math.floor((atkPower * 0.55 + lv * 8) * hits), hitCount: hits, pierceArmor: 0.5 };
        } },
        { id: "r_5", name: "鷹眼狙擊", type: "active", mp: 50, reqLv: 12, goldCost: 1200, reqMat: { "祭司血清": 3 }, desc: "極限瞄準爆頭！對大領主或魔物造成超高倍率致命打擊。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * (3.0 + lv * 0.8)), hitCount: 1 }) }
    ],

    // ----------------------------------------------------------------------
    // 二轉專屬技能庫 (需要角色 Level >= 20)
    // ----------------------------------------------------------------------
    knight: [
        { id: "k_1", name: "連刺攻擊", type: "active", mp: 30, reqLv: 20, goldCost: 1500, reqMat: { "獸人後腿肉": 5 }, desc: "長槍快速連續突刺！隨等級增加突刺次數 (3 + Lv/3)。", run: (lv, atkPower) => {
            let hits = 3 + Math.floor(lv / 3);
            return { dmg: Math.floor((atkPower * 0.7 + lv * 12) * hits), hitCount: hits, isTripleHit: hits === 3 };
        } },
        { id: "k_2", name: "怪物互擊", type: "active", mp: 45, reqLv: 24, goldCost: 2200, reqMat: { "巨石苔蘚": 5 }, desc: "揮動巨劍造成物理衝擊，並有 40% 機率使魔物眩暈。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * (2.2 + lv * 0.5)), hitCount: 1, stunChance: 40 + lv * 5 }) },
        { id: "k_3", name: "騎乘術", type: "passive", reqLv: 28, goldCost: 3000, reqMat: { "祭司血清": 3 }, passiveStats: { spd: 10, critChance: 8 }, desc: "【被動】騎乘作戰，永久提升 10 點速度與 8% 暴擊率。" }
    ],
    crusader: [
        { id: "c_1", name: "聖十字審判", type: "active", mp: 50, reqLv: 20, goldCost: 1500, reqMat: { "祭司血清": 5 }, desc: "召喚聖十字光輝打擊！2 連爆發混合物攻與魔攻傷害。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * (1.3 + lv * 0.3) * 2), hitCount: 2, isMagic: true }) },
        { id: "c_2", name: "犧牲庇護", type: "active", mp: 35, reqLv: 24, goldCost: 2200, reqMat: { "硬殼龜甲": 5 }, desc: "以全身重裝護甲化為晶體聖盾，立刻獲得極高護盾值。", run: (lv) => ({ shieldGain: 150 + lv * 80 }) },
        { id: "c_3", name: "鋼鐵防禦", type: "passive", reqLv: 28, goldCost: 3000, reqMat: { "巨石苔蘚": 6 }, passiveStats: { def: 15, maxHp: 200 }, desc: "【被動】永久提升 15 點防禦力與 200 點最大生命值。" }
    ],
    wizard: [
        { id: "w_1", name: "暴風雪", type: "active", mp: 70, reqLv: 20, goldCost: 1500, reqMat: { "史萊姆黏液": 6 }, desc: "冰爽暴風雪大轟炸！射出 3 + Lv/2 發冰錐，極高機率凍結魔物。", run: (lv, matkPower) => {
            let hits = 3 + Math.floor(lv / 2);
            return { dmg: Math.floor((matkPower * 0.75 + lv * 15) * hits), hitCount: hits, freezeChance: 70, isMagic: true };
        } },
        { id: "w_2", name: "隕石術", type: "active", mp: 90, reqLv: 25, goldCost: 2500, reqMat: { "哥布林香料": 6 }, desc: "召喚毀滅隕石群！隨等級傾瀉 2 + Lv 顆大隕石毀滅敵陣。", run: (lv, matkPower) => {
            let hits = 2 + lv;
            return { dmg: Math.floor((matkPower * 0.85 + lv * 18) * hits), hitCount: hits, isMagic: true };
        } },
        { id: "w_3", name: "魔力增幅", type: "passive", reqLv: 28, goldCost: 3000, reqMat: { "怨靈淚晶": 5 }, passiveStats: { matk: 30, maxMp: 150 }, desc: "【被動】永久提升 30 點魔攻 (MATK) 與 150 點最大 MP。" }
    ],
    sage: [
        { id: "sg_1", name: "魔法效果解除", type: "active", mp: 40, reqLv: 20, goldCost: 1500, reqMat: { "怨靈淚晶": 4 }, desc: "破除魔物護甲與增益，造成元素破防真傷。", run: (lv, matkPower) => ({ dmg: Math.floor(matkPower * (1.8 + lv * 0.4)), hitCount: 1, ignoreDef: true, isMagic: true }) },
        { id: "sg_2", name: "自動念咒", type: "passive", reqLv: 25, goldCost: 2500, reqMat: { "史萊姆黏液": 5 }, passiveStats: { doubleStrike: 25, spd: 8 }, desc: "【被動】普通攻擊時有 25% 機率自動追擊二連發。" }
    ],
    priest: [
        { id: "p_1", name: "聖母之頌歌", type: "active", mp: 10, reqLv: 20, goldCost: 1500, reqMat: { "祭司血清": 5 }, desc: "聖母祝福！立刻巨量回復自身 120 點 MP。", run: (lv) => ({ mpRestore: 120 + lv * 40, hitCount: 1 }) },
        { id: "p_2", name: "讚美光陣", type: "active", mp: 50, reqLv: 24, goldCost: 2200, reqMat: { "怨靈淚晶": 4 }, desc: "展開神聖防禦陣！大幅提升防禦力與魔防力，持續數回合。", run: (lv) => ({ blockBuff: 20 + lv * 10, turns: 4 + lv }) },
        { id: "p_3", name: "驅魔聖典", type: "passive", reqLv: 28, goldCost: 3000, reqMat: { "祭司血清": 6 }, passiveStats: { mdef: 15, maxHp: 150 }, desc: "【被動】神聖光環守護，永久提升 15 點魔防與 150 點 HP。" }
    ],
    monk: [
        { id: "mk_1", name: "猛龍誇強", type: "active", mp: 35, reqLv: 20, goldCost: 1500, reqMat: { "獸人後腿肉": 5 }, desc: "神聖連環 4 連拳！瞬間造成極高物理近戰打擊。", run: (lv, atkPower) => ({ dmg: Math.floor((atkPower * 0.6 + lv * 10) * 4), hitCount: 4 }) },
        { id: "mk_2", name: "阿修羅霸凰拳", type: "active", mp: 80, reqLv: 26, goldCost: 3000, reqMat: { "怨靈淚晶": 6 }, desc: "耗盡所有鬥氣釋放極限一擊！造成毀滅性核爆極大傷害！", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * (4.5 + lv * 1.2)), hitCount: 1, forceCrit: true }) }
    ],
    assassin: [
        { id: "as_1", name: "音速投擲", type: "active", mp: 45, reqLv: 20, goldCost: 1500, reqMat: { "獸人後腿肉": 5 }, desc: "鬼魅 8 連發突刺！對魔物造成高額多段殘影打擊。", run: (lv, atkPower) => ({ dmg: Math.floor((atkPower * 0.35 + lv * 8) * 8), hitCount: 8 }) },
        { id: "as_2", name: "塗毒大師", type: "passive", reqLv: 25, goldCost: 2500, reqMat: { "史萊姆黏液": 6 }, passiveStats: { critChance: 15, flee: 12 }, desc: "【被動】淬毒極致，永久提升 15% 暴擊率與 12 點閃避率。" }
    ],
    rogue: [
        { id: "rg_1", name: "挾持襲擊", type: "active", mp: 30, reqLv: 20, goldCost: 1500, reqMat: { "哥布林香料": 5 }, desc: "突襲挾持！強行偷取 50G 與素材，並使敵人眩暈 1 回合。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * 1.5), hitCount: 1, stealGold: 50 + lv * 25, stunChance: 100 }) },
        { id: "rg_2", name: "背刺", type: "active", mp: 40, reqLv: 24, goldCost: 2200, reqMat: { "獸人後腿肉": 6 }, desc: "繞後致命背刺！100% 觸發暴擊且無視敵方 40% 防禦。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * (2.5 + lv * 0.6)), hitCount: 1, forceCrit: true, pierceArmor: 0.4 }) }
    ],
    hunter: [
        { id: "ht_1", name: "獵鷹突擊", type: "active", mp: 40, reqLv: 20, goldCost: 1500, reqMat: { "硬殼龜甲": 5 }, desc: "指揮獵鷹俯衝打擊！隨等級發動 1 + Lv/3 次俯衝貫穿。", run: (lv, atkPower) => {
            let hits = 1 + Math.floor(lv / 3);
            return { dmg: Math.floor((atkPower * 1.5 + lv * 20) * hits), hitCount: hits, ignoreDef: true };
        } },
        { id: "ht_2", name: "爆炸陷阱", type: "active", mp: 35, reqLv: 24, goldCost: 2200, reqMat: { "哥布林香料": 6 }, desc: "引爆獵人陷阱！造成火物理傷害並高機率眩暈魔物。", run: (lv, atkPower) => ({ dmg: Math.floor(atkPower * 1.8), hitCount: 1, stunChance: 60 + lv * 10 }) }
    ],
    bard_dancer: [
        { id: "bd_1", name: "布拉奇之歌", type: "active", mp: 30, reqLv: 20, goldCost: 1500, reqMat: { "祭司血清": 4 }, desc: "奏響戰歌！行動速度 (SPD) 暴增，持續多回合。", run: (lv) => ({ spdBuff: 20 + lv * 5, turns: 4 }) },
        { id: "bd_2", name: "不和諧音程", type: "passive", reqLv: 25, goldCost: 2500, reqMat: { "怨靈淚晶": 5 }, passiveStats: { spd: 10, maxHp: 150 }, desc: "【被動】節律掌控，永久提升 10 點速度與 150 點最大 HP。" }
    ]
};

const ADVANCED_JOBS_DATABASE = {
    swordsman: [
        { id: "knight", name: "騎士", icon: "🏇", reqLv: 20, desc: "掌握槍術與衝鋒，擁有極致近戰突破力與多段貫穿衝擊力。" },
        { id: "crusader", name: "十字軍", icon: "🛡️", reqLv: 20, desc: "神聖盾牌與極致體質，以聖光反彈傷害並為自身加載不屈防禦。" }
    ],
    magician: [
        { id: "wizard", name: "巫師", icon: "🧙‍♂️", reqLv: 20, desc: "大範圍毀滅魔法主宰，能召喚暴風雪與毀滅隕石碾碎敵陣。" },
        { id: "sage", name: "賢者", icon: "📖", reqLv: 20, desc: "戰鬥型魔法師，善於邊揮砍邊自動念咒，並能取消敵方增益。" }
    ],
    acolyte: [
        { id: "priest", name: "祭司", icon: "👼", reqLv: 20, desc: "頂級神聖輔助，強效聖光大幅提高生存與全隊能力。" },
        { id: "monk", name: "武僧", icon: "👊", reqLv: 20, desc: "近戰神聖爆發大師，連環拳與阿修羅霸凰拳帶來瞬間秒殺。" }
    ],
    thief: [
        { id: "assassin", name: "刺客", icon: "🥷", reqLv: 20, desc: "影之殺手，雙手持刃與高速連擊，配合劇毒帶來毀滅打擊。" },
        { id: "rogue", name: "流氓", icon: "🗡️", reqLv: 20, desc: "戰術搶奪專家，擅長背刺爆頭與強制奪取敵方物資資源。" }
    ],
    archer: [
        { id: "hunter", name: "獵人", icon: "🦅", reqLv: 20, desc: "獵鷹協同作戰專家與陷阱大師，具備極高的遠程貫穿力。" },
        { id: "bard_dancer", name: "詩人/舞孃", icon: "🪕", reqLv: 20, desc: "戰歌合奏大師，提供全方位戰鬥增益與節律掌控。" }
    ]
};

// --------------------------------------------------------------------------
// 🛠️ 邏輯與技能擷取輔助函式 (Helper Functions)
// --------------------------------------------------------------------------

// 取得玩家當前職業可學習的所有技能（包含一轉繼承與二轉技能）
function getAllSkillsForJob(jobId) {
    let jobObj = JOB_DATABASE[jobId];
    if (!jobObj) return [];

    let skillsList = [];
    
    // 如果是二轉職業，先繼承一轉母職業技能
    if (jobObj.baseJob && SKILLS_DATABASE[jobObj.baseJob]) {
        skillsList = skillsList.concat(SKILLS_DATABASE[jobObj.baseJob]);
    }
    
    // 加上當前職業專屬技能
    if (SKILLS_DATABASE[jobId]) {
        skillsList = skillsList.concat(SKILLS_DATABASE[jobId]);
    }

    return skillsList;
}

function getJobChineseName(j) {
    return JOB_DATABASE[j]?.name || "無名勇者";
}

function getJobBonusStats(jobId, jobLevel = 1) {
    const baseBonus = JOB_STAT_BONUS[jobId] || { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    const factor = Math.min(2.0, 1.0 + (jobLevel - 1) * 0.05);
    
    let calculated = {};
    for (let key in baseBonus) {
        calculated[key] = Math.floor(baseBonus[key] * factor);
    }
    return calculated;
}

function canLearnSkill(playerData, skill, warehouse, currentLv = 0) {
    if (currentLv >= 10) {
        return { canLearn: false, reason: "👑 技能已達到最高等級上限 (Lv.10)！" };
    }
    
    const playerLv = playerData.lv || playerData.level || 1;
    if (playerLv < skill.reqLv) {
        return { canLearn: false, reason: `📈 等級不足！需達到 Lv.${skill.reqLv}（當前 Lv.${playerLv}）` };
    }

    const nextLv = currentLv + 1;
    const goldCost = skill.goldCost * nextLv;
    const playerGold = playerData.gold || 0;
    
    if (playerGold < goldCost) {
        return { canLearn: false, reason: `🪙 金幣不足！需要 ${goldCost} G（當前 ${playerGold} G）` };
    }

    let missingMats = [];
    for (let mat in skill.reqMat) {
        let reqQty = skill.reqMat[mat] * nextLv;
        let count = warehouse[mat] || 0;
        if (count < reqQty) {
            missingMats.push(`${mat} x${reqQty - count}`);
        }
    }

    if (missingMats.length > 0) {
        return { canLearn: false, reason: `📦 缺少素材：${missingMats.join(", ")}` };
    }

    return { canLearn: true };
}

// 判定玩家是否滿足二轉條件 (等級 >= 20 且當前為一轉職業)
function canAdvanceJob(playerData) {
    const currentJob = playerData.job;
    const currentLv = playerData.lv || playerData.level || 1;
    
    const isBaseJob = ADVANCED_JOBS_DATABASE.hasOwnProperty(currentJob);
    return (currentLv >= 20 && isBaseJob);
}
