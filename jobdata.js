// ==========================================================================
// 🎭 jobdata.js：皇家五大職業技能內核、學習需求與公式庫 (移除初心者，新增盜賊與弓箭手)
// ==========================================================================

const SKILLS_DATABASE = {
    swordsman: [
        { name: "狂擊", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "物理重擊造成 180% 傷害，機率使怪眩暈。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * (1.4 + lv * 0.4)), stun: 20 + lv * 10 }) },
        { name: "怒爆", type: "active", mp: 25, reqLv: 3, goldCost: 250, reqMat: { "哥布林香料": 1 }, desc: "釋放鬥氣造成火真傷，附加普攻燃燒。", run: (lv) => ({ fireDmg: 20 + lv * 20, burnStacks: lv }) },
        { name: "霸體", type: "active", mp: 20, reqLv: 5, goldCost: 450, reqMat: { "巨石苔蘚": 2 }, desc: "不屈姿態！自身固定減傷面板暴增，持續多回合。", run: (lv) => ({ blockBuff: 5 + lv * 5, turns: 3 + lv }) },
        { name: "盾擊", type: "active", mp: 15, reqLv: 8, goldCost: 700, reqMat: { "硬殼龜甲": 3 }, desc: "重盾破防，強制扣除敵護盾並為自己加載晶體盾。", run: (lv) => ({ shieldGain: 40 + lv * 40 }) },
        { name: "殘影斬", type: "active", mp: 35, reqLv: 12, goldCost: 1200, reqMat: { "獸人後腿肉": 3 }, desc: "發動雙段連續物理突刺，每段造成高度物理外傷。", run: (lv, dmg) => ({ isDoubleHit: true, pScale: 0.9 + lv * 0.3 }) }
    ],
    magician: [
        { name: "火箭術", type: "active", mp: 30, reqLv: 1, goldCost: 100, reqMat: {}, desc: "造成火傷並附燃燒。若怪處於凍結，此招傷害爆發 2.5 倍。", run: (lv) => ({ baseFire: 15 + lv * 15, meltMult: 2.5 + lv * 0.5 }) },
        { name: "冰箭術", type: "active", mp: 30, reqLv: 3, goldCost: 250, reqMat: { "史萊姆黏液": 2 }, desc: "造成水傷。成功有高機率將魔物強行【凍結】1回合。", run: (lv) => ({ baseWater: 20 + lv * 15, freezeChance: 25 + lv * 15 }) },
        { name: "禪心", type: "active", mp: 0, reqLv: 5, goldCost: 450, reqMat: {}, desc: "犧牲當前行動不發動揮砍，強行讓 MP 當場大回復。", run: (lv) => ({ mpRestore: 55 + lv * 25 }) },
        { name: "火牆術", type: "active", mp: 45, reqLv: 8, goldCost: 700, reqMat: { "哥布林香料": 3 }, desc: "立起火牆。敵反擊時每回合開頭反噬受創並燃燒。", run: (lv) => ({ thornsFire: 15 + lv * 10, duration: 1 + lv }) },
        { name: "雷爆術", type: "active", mp: 60, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 2 }, desc: "雷暴大轟炸；魔物身上每有1層毒 or 火狀態，傷害加深。", run: (lv) => ({ baseStorm: 50 + lv * 30, ampPerStatus: 0.15 + lv * 0.05 }) }
    ],
    acolyte: [
        { name: "治癒術", type: "active", mp: 20, reqLv: 1, goldCost: 100, reqMat: {}, desc: "聖光降臨，立刻百分比回復自身已損失生命值。", run: (lv, maxHp, dummy, hp) => ({ healPercent: 0.17 + lv * 0.08, lostHp: maxHp - hp }) },
        { name: "天使之賜福", type: "active", mp: 40, reqLv: 3, goldCost: 250, reqMat: { "祭司血清": 1 }, desc: "神聖洗禮！本局冒險基礎攻擊與最大生命上限永續加載。", run: (lv) => ({ permAtk: 4 + lv * 6, permHp: 20 + lv * 30 }) },
        { name: "加速術", type: "active", mp: 15, reqLv: 5, goldCost: 450, reqMat: {}, desc: "極限閃避！完美閃避率提升，且下一回合自身必定暴擊。", run: (lv) => ({ permDodge: 7 + lv * 3 }) },
        { name: "光之壁", type: "active", mp: 25, reqLv: 8, goldCost: 700, reqMat: { "祭司血清": 3 }, desc: "當魔物施展大招時，強行將該傷害高額抹除。", run: (lv) => ({ bossDmgCut: 0.35 + lv * 0.15 }) },
        { name: "神聖之光", type: "active", mp: 15, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 3 }, desc: "射出破邪聖光。對特定不死系或深層魔物有數倍特大傷。", run: (lv) => ({ holyBase: 10 + lv * 15, undeadMult: 2.0 + lv * 1.0 }) }
    ],
    thief: [
        { name: "毒刃", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "淬毒突刺！造成物理傷並為魔物注入 2 層【劇毒】。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * 1.3), poisonStacks: 2 }) },
        { name: "殘影", type: "active", mp: 20, reqLv: 3, goldCost: 250, reqMat: { "史萊姆黏液": 2 }, desc: "極速閃避姿態！大幅提升閃避率與行動速度，持續 3 回合。", run: (lv) => ({ dodgeBuff: 15 + lv * 5, spdBuff: 10 }) },
        { name: "伏擊暴擊", type: "active", mp: 25, reqLv: 5, goldCost: 450, reqMat: { "獸人後腿肉": 2 }, desc: "潛行致命一擊！本次攻擊 100% 觸發暴擊且暴傷翻倍。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * (2.0 + lv * 0.5)), forceCrit: true }) },
        { name: "神偷手套", type: "active", mp: 10, reqLv: 8, goldCost: 700, reqMat: { "哥布林香料": 3 }, desc: "戰術順手牽羊！攻擊時強制竊取魔物金幣與隨機素材。", run: (lv) => ({ stealGold: 30 + lv * 20, stealMat: true }) },
        { name: "劇毒爆裂", type: "active", mp: 40, reqLv: 12, goldCost: 1200, reqMat: { "怨靈淚晶": 2 }, desc: "引爆敵方身上所有劇毒，按毒素層數造成毀滅性真傷！", run: (lv) => ({ explodePoison: true, baseDmg: 50 + lv * 30 }) }
    ],
    archer: [
        { name: "二連矢", type: "active", mp: 15, reqLv: 1, goldCost: 100, reqMat: {}, desc: "極速連射！對魔物連續射出兩箭造成高額打擊。", run: (lv, dmg) => ({ isDoubleHit: true, pScale: 0.85 + lv * 0.25 }) },
        { name: "衝鋒箭", type: "active", mp: 20, reqLv: 3, goldCost: 250, reqMat: { "硬殼龜甲": 1 }, desc: "強烈擊退箭矢！造成物理傷害並有 50% 機率強行眩暈魔物。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * 1.4), stunChance: 50 }) },
        { name: "心眼", type: "passive", reqLv: 5, goldCost: 450, reqMat: {}, desc: "【自動被動】精準狙擊，永久提升自身 10% 暴擊率與 5 點速度。" },
        { name: "箭雨狂轟", type: "active", mp: 35, reqLv: 8, goldCost: 700, reqMat: { "巨石苔蘚": 3 }, desc: "漫天箭雨！造成高度貫穿打擊，無視敵方 50% 物理防護。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * 1.8), pierceArmor: 0.5 }) },
        { name: "鷹眼狙擊", type: "active", mp: 50, reqLv: 12, goldCost: 1200, reqMat: { "祭司血清": 3 }, desc: "極限瞄準爆頭！對大領主或魔物造成超高倍率致命打擊。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * (3.0 + lv * 0.8)) }) }
    ]
};
