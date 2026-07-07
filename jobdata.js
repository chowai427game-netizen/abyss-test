// ==========================================================================
// 🎭 jobdata.js：皇家職業技能內核與傷害/治癒公式運算庫
// ==========================================================================

const SKILLS_DATABASE = {
    novice: [
        { name: "緊急治療", type: "active", mp: 15, desc: "基礎求生治療，聖光微現回復些許生命值。", run: (lv, atk, maxMp, hp) => ({ healPercent: 0.20, lostHp: (100 - hp) + 40 }) }
    ],
    swordsman: [
        { name: "狂擊", type: "active", mp: 15, desc: "物理重擊造成 180% 傷害，機率使怪眩暈。", run: (lv, dmg) => ({ dmg: Math.floor(dmg * (1.4 + lv * 0.4)), stun: 20 + lv * 10 }) },
        { name: "怒爆", type: "active", mp: 25, desc: "釋放鬥氣造成火真傷，附加普攻燃燒。", run: (lv) => ({ fireDmg: 20 + lv * 20, burnStacks: lv }) },
        { name: "霸體", type: "active", mp: 20, desc: "不屈姿態！自身固定減傷面板暴增，持續多回合。", run: (lv) => ({ blockBuff: 5 + lv * 5, turns: 3 + lv }) },
        { name: "挑釁", type: "active", mp: 10, desc: "敵增攻 15% 但防禦瓦解，我方暴擊傷害增幅。", run: (lv) => ({ critMult: 1.2 + lv * 0.3, enemyAtkUp: 0.15 }) },
        { name: "快速回復", type: "passive", desc: "【自動被動】回合開始時自動修復回復最大生命值 8% 氣血。" },
        { name: "狂暴狀態", type: "active", mp: 30, desc: "戰鬥連擊率固定提升；且自身血越低連擊再飆升。", run: (lv) => ({ baseDouble: 10 + lv * 5 }) },
        { name: "盾擊", type: "active", mp: 15, desc: "重盾破防，強制扣除敵護盾並為自己加載晶體盾。", run: (lv) => ({ shieldGain: 40 + lv * 40 }) },
        { name: "集中精神", type: "active", mp: 10, desc: "沉下氣息，成功則接下來幾回合閃避率提升且耗魔減半。", run: (lv) => ({ dodgeGain: 10 + lv * 5, turns: 1 + lv }) },
        { name: "殘影斬", type: "active", mp: 35, desc: "發動雙段連續物理突刺，每段造成高度物理外傷。", run: (lv, dmg) => ({ isDoubleHit: true, pScale: 0.9 + lv * 0.3 }) },
        { name: "堅毅不屈", type: "passive", desc: "【自動被動】單次受創超上限 25% 時，自動將受創 30% 轉化為自身攻擊。" }
    ],
    magician: [
        { name: "火箭術", type: "active", mp: 30, desc: "造成火傷並附燃燒。若怪處於凍結，此招傷害爆發 2.5 倍。", run: (lv) => ({ baseFire: 15 + lv * 15, meltMult: 2.5 + lv * 0.5 }) },
        { name: "冰箭術", type: "active", mp: 30, desc: "造成水傷。成功有高機率將魔物強行【凍結】1回合。", run: (lv) => ({ baseWater: 20 + lv * 15, freezeChance: 25 + lv * 15 }) },
        { name: "雷擊術", type: "active", mp: 35, desc: "引導天雷。若我方連擊率高於10%，追加1段落雷。", run: (lv) => ({ baseThunder: 30 + lv * 20, extraThunder: 15 + lv * 15 }) },
        { name: "聖靈召喚", type: "active", mp: 25, desc: "造成念動傷。此魔攻無條件穿透魔物晶體盾與減傷甲。", run: (lv) => ({ pierceMagic: 25 + lv * 20 }) },
        { name: "能量外套", type: "passive", desc: "【自動被動】進入戰鬥第 1 回合，體表自動化生成 250 點防禦魔法盾。" },
        { name: "心靈爆破", type: "active", mp: 50, desc: "發動精神爆破，造成自身當前 MP 殘餘值高百分比的魔法傷。", run: (lv, dummy, mp) => ({ mpToDmg: mp * (0.50 + lv * 0.30) }) },
        { name: "禪心", type: "active", mp: 0, desc: "犧牲當前行動不發動揮砍，強行讓 MP 當場大回復。", run: (lv) => ({ mpRestore: 55 + lv * 25 }) },
        { name: "火牆術", type: "active", mp: 45, desc: "立起火牆。敵反擊時每回合開頭反噬受創並燃燒。", run: (lv) => ({ thornsFire: 15 + lv * 10, duration: 1 + lv }) },
        { name: "冰凍術", type: "active", mp: 20, desc: "將當前地下城異常環境力場，直接強制洗牌洗成【永凍冰原】。", run: (lv) => ({ globalFreezeTurns: 1 + lv }) },
        { name: "雷爆術", type: "active", mp: 60, desc: "雷暴大轟炸；魔物身上每有1層毒 or 火狀態，傷害加深。", run: (lv) => ({ baseStorm: 50 + lv * 30, ampPerStatus: 0.15 + lv * 0.05 }) }
    ],
    acolyte: [
        { name: "治癒術", type: "active", mp: 20, desc: "聖光降臨，立刻百分比回復自身已損失生命值。", run: (lv, maxHp, dummy, hp) => ({ healPercent: 0.17 + lv * 0.08, lostHp: maxHp - hp }) },
        { name: "天使之賜福", type: "active", mp: 40, desc: "神聖洗禮！本局冒險基礎攻擊與最大生命上限永續加載。", run: (lv) => ({ permAtk: 4 + lv * 6, permHp: 20 + lv * 30 }) },
        { name: "加速術", type: "active", mp: 15, desc: "極限閃避！完美閃避率提升，且下一回合自身必定暴擊。", run: (lv) => ({ permDodge: 7 + lv * 3 }) },
        { name: "光之壁", type: "active", mp: 25, desc: "當魔物施展大招時，強行將該傷害高額抹除。", run: (lv) => ({ bossDmgCut: 0.35 + lv * 0.15 }) },
        { name: "神聖之光", type: "active", mp: 15, desc: "射出破邪聖光。對特定不死系或深層魔物有數倍特大傷。", run: (lv) => ({ holyBase: 10 + lv * 15, undeadMult: 2.0 + lv * 1.0 }) },
        { name: "天使之護", type: "passive", desc: "【自動被動】神聖鐵甲加護，勇者固定減傷面板直接永續增加。" },
        { name: "聖母之頌歌", type: "active", mp: 30, desc: "高階詠唱，局內自身每回合 MP 回復速度瘋狂翻倍。", run: (lv) => ({ mpRegenBuff: 10, duration: 3 + lv }) },
        { name: "天使之淚", type: "active", mp: 10, desc: "當場徹底斬斷自身身上的所有【燃燒】與【劇毒】狀態。", run: (lv) => ({ cureStatus: true, healPerStack: 5 + lv * 10 }) },
        { name: "十字驅魔", type: "active", mp: 20, desc: "神聖驅逐，使敵方魔物的基礎攻擊力與命中率永久倒扣。", run: (lv) => ({ enemyDebuff: 0.10 + lv * 0.05 }) },
        { name: "神聖反彈", type: "active", mp: 15, desc: "鏡面信仰。肉身受到的物理外傷按數值釋放神聖反彈。", run: (lv) => ({ reflectRate: 0.25 + lv * 0.15, duration: 1 + lv }) }
    ]
};
