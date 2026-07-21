// ==========================================================================
// 🎭 jobdata.js：皇家職業技能內核、新職業 (盜賊/弓箭手) 與技能學習材料庫
// ==========================================================================

const SKILLS_DATABASE = {
    novice: [
        { 
            name: "緊急治療", type: "active", mp: 15, maxLv: 5, reqLv: 1, costGold: 50, costMat: {},
            desc: "基礎求生治療，聖光微現回復些許生命值。", 
            run: (lv, atk, maxMp, hp) => ({ healPercent: 0.15 + lv * 0.05, lostHp: (100 - hp) + 40 }) 
        }
    ],
    swordsman: [
        { 
            name: "狂擊", type: "active", mp: 15, maxLv: 5, reqLv: 1, costGold: 100, costMat: { "史萊姆黏液": 2 },
            desc: "物理重擊造成高額傷害，機率使怪眩暈。", 
            run: (lv, dmg) => ({ dmg: Math.floor(dmg * (1.4 + lv * 0.4)), stun: 20 + lv * 10 }) 
        },
        { 
            name: "怒爆", type: "active", mp: 25, maxLv: 5, reqLv: 3, costGold: 200, costMat: { "哥布林香料": 3 },
            desc: "釋放鬥氣造成火真傷，附加普攻燃燒。", 
            run: (lv) => ({ fireDmg: 20 + lv * 20, burnStacks: lv }) 
        },
        { 
            name: "霸體", type: "active", mp: 20, maxLv: 5, reqLv: 5, costGold: 350, costMat: { "硬殼龜甲": 2 },
            desc: "不屈姿態！自身固定減傷面板暴增，持續多回合。", 
            run: (lv) => ({ blockBuff: 5 + lv * 5, turns: 3 + lv }) 
        },
        { 
            name: "挑釁", type: "active", mp: 10, maxLv: 5, reqLv: 8, costGold: 500, costMat: { "獸人後腿肉": 3 },
            desc: "敵增攻 15% 但防禦瓦解，我方暴擊傷害增幅。", 
            run: (lv) => ({ critMult: 1.2 + lv * 0.3, enemyAtkUp: 0.15 }) 
        }
    ],
    magician: [
        { 
            name: "火箭術", type: "active", mp: 30, maxLv: 5, reqLv: 1, costGold: 100, costMat: { "史萊姆黏液": 2 },
            desc: "造成火傷並附燃燒。若怪處於凍結，傷害爆發 2.5 倍。", 
            run: (lv) => ({ baseFire: 15 + lv * 15, meltMult: 2.5 + lv * 0.5 }) 
        },
        { 
            name: "冰箭術", type: "active", mp: 30, maxLv: 5, reqLv: 3, costGold: 200, costMat: { "巨石苔蘚": 3 },
            desc: "造成水傷。成功有高機率將魔物強行【凍結】1回合。", 
            run: (lv) => ({ baseWater: 20 + lv * 15, freezeChance: 25 + lv * 15 }) 
        },
        { 
            name: "雷擊術", type: "active", mp: 35, maxLv: 5, reqLv: 5, costGold: 350, costMat: { "怨靈淚晶": 2 },
            desc: "引導天雷。若我方連擊率高於10%，追加1段落雷。", 
            run: (lv) => ({ baseThunder: 30 + lv * 20, extraThunder: 15 + lv * 15 }) 
        }
    ],
    acolyte: [
        { 
            name: "治癒術", type: "active", mp: 20, maxLv: 5, reqLv: 1, costGold: 100, costMat: { "史萊姆黏液": 2 },
            desc: "聖光降臨，立刻百分比回復自身已損失生命值。", 
            run: (lv, maxHp, dummy, hp) => ({ healPercent: 0.17 + lv * 0.08, lostHp: maxHp - hp }) 
        },
        { 
            name: "天使之賜福", type: "active", mp: 40, maxLv: 5, reqLv: 4, costGold: 300, costMat: { "祭司血清": 2 },
            desc: "神聖洗禮！本局冒險基礎攻擊與最大生命上限永續加載。", 
            run: (lv) => ({ permAtk: 4 + lv * 6, permHp: 20 + lv * 30 }) 
        }
    ],
    // 🗡️ 新增職業：盜賊 (Thief)
    thief: [
        { 
            name: "雙重打擊", type: "active", mp: 15, maxLv: 5, reqLv: 1, costGold: 100, costMat: { "史萊姆黏液": 2 },
            desc: "極速揮動雙刃，造成 2 段物理突刺傷害。", 
            run: (lv, dmg) => ({ isDoubleHit: true, pScale: 0.8 + lv * 0.3 }) 
        },
        { 
            name: "毒刃", type: "active", mp: 20, maxLv: 5, reqLv: 3, costGold: 220, costMat: { "哥布林香料": 3 },
            desc: "淬毒刃擊，受擊魔物每回合受到劇毒反噬。", 
            run: (lv) => ({ poisonStacks: 1 + lv, baseDmg: 15 + lv * 10 }) 
        },
        { 
            name: "殘影身法", type: "active", mp: 25, maxLv: 5, reqLv: 6, costGold: 400, costMat: { "怨靈淚晶": 2 },
            desc: "身形化為殘影，大幅提升閃避率與連擊率。", 
            run: (lv) => ({ dodgeGain: 12 + lv * 5, doubleGain: 10 + lv * 5 }) 
        },
        { 
            name: "鬼手偷竊", type: "active", mp: 10, maxLv: 5, reqLv: 8, costGold: 600, costMat: { "獸人後腿肉": 4 },
            desc: "伸出暗影鬼手，強行竊取魔物金幣與額外素材。", 
            run: (lv) => ({ stealGold: 30 + lv * 30, stealChance: 40 + lv * 10 }) 
        }
    ],
    // 🏹 新增職業：弓箭手 (Archer)
    archer: [
        { 
            name: "二連矢", type: "active", mp: 15, maxLv: 5, reqLv: 1, costGold: 100, costMat: { "史萊姆黏液": 2 },
            desc: "弓弦雙發！快速射出兩支箭矢貫穿敵人。", 
            run: (lv, dmg) => ({ isDoubleHit: true, pScale: 0.85 + lv * 0.25 }) 
        },
        { 
            name: "衝擊箭", type: "active", mp: 25, maxLv: 5, reqLv: 3, costGold: 220, costMat: { "硬殼龜甲": 2 },
            desc: "重矢擊退敵方，高機率強行打斷行動並造成眩暈。", 
            run: (lv) => ({ dmgMult: 1.5 + lv * 0.3, stunChance: 30 + lv * 10 }) 
        },
        { 
            name: "心眼鷹眼", type: "passive", maxLv: 5, reqLv: 5, costGold: 400, costMat: { "祭司血清": 2 },
            desc: "【自動被動】洞察敵方弱點，永久提升暴擊率與攻速面板。" 
        },
        { 
            name: "箭雨狂轟", type: "active", mp: 45, maxLv: 5, reqLv: 8, costGold: 650, costMat: { "巨石苔蘚": 4 },
            desc: "朝天空射出無數箭雨，對魔物造成狂暴覆蓋傷害。", 
            run: (lv) => ({ baseRainDmg: 60 + lv * 40 }) 
        }
    ]
};
