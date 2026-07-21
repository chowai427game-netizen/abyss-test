// ==========================================================================
// 🧮 statengine.js：RO 六大能力值轉換公式、裝備加成與戰鬥傷害算式內核
// ==========================================================================

// 1. 能力值轉換與面板重構
function resetCurrentRunData() {
    if (!accountMeta.stats) {
        accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    }
    
    const s = accountMeta.stats;
    const job = currentRun.job || "swordsman";

    currentRun.lv = accountMeta.lv || 1; 
    currentRun.exp = accountMeta.exp || 0; 
    currentRun.nextExp = accountMeta.nextExp || 30;

    // STR: 近戰 ATK、負重上限
    const strBonusAtk = s.STR * 3 + Math.pow(Math.floor(s.STR / 10), 2);
    currentRun.maxWeight = 100 + s.STR * 20;

    // AGI: 攻速 ASPD、物理迴避 FLEE
    currentRun.spd = 20 + Math.floor(s.AGI * 1.5);
    currentRun.flee = 10 + s.AGI * 1.2;

    // VIT: 最大 HP、物理防禦 DEF、HP 回復率
    currentRun.maxHp = 100 + (s.VIT * 22);
    currentRun.def = Math.floor(s.VIT * 0.8);
    currentRun.block = currentRun.def; 
    currentRun.hpRegen = 1 + Math.floor(s.VIT / 5);

    // INT: 魔法攻擊 MATK、魔法防禦 MDEF、最大 MP、MP 回復率
    currentRun.matk = 15 + s.INT * 3.5 + Math.pow(Math.floor(s.INT / 10), 2);
    currentRun.mdef = Math.floor(s.INT * 0.8);
    currentRun.maxMp = 50 + (s.INT * 12);
    currentRun.mpRegen = 15 + Math.floor(s.INT * 1.2);

    // DEX: 命中率 HIT、遠程 ATK、詠唱時間縮減
    currentRun.hit = 80 + s.DEX * 1.5 + s.LUK * 0.3;
    const dexBonusAtk = s.DEX * 3 + Math.pow(Math.floor(s.DEX / 10), 2);
    currentRun.castReduction = Math.min(0.80, (s.DEX * 1.5 + s.INT * 0.5) / 100);

    // LUK: 暴擊率 CRIT、完全迴避 Perfect Dodge
    currentRun.critChance = Math.min(80, Math.floor(s.LUK * 0.4 + s.DEX * 0.1));
    currentRun.perfectDodge = Math.min(30, Math.floor(s.LUK * 0.2));

    // 🎯 職業主傷害類型分流
    if (job === "archer") {
        currentRun.atk = 15 + dexBonusAtk + Math.floor(s.STR * 0.5);
    } else if (job === "magician" || job === "acolyte") {
        currentRun.atk = 10 + Math.floor(s.STR * 1.5);
    } else { // swordsman, thief
        currentRun.atk = 15 + strBonusAtk + Math.floor(s.DEX * 0.5);
    }

    currentRun.hp = Math.min(currentRun.hp || currentRun.maxHp, currentRun.maxHp);
    currentRun.mp = Math.min(currentRun.mp || currentRun.maxMp, currentRun.maxMp);

    applyEquipmentStats('weapon');
    applyEquipmentStats('armor');
    applyEquipmentStats('accessory');
}

// 2. 裝備與星級屬性疊加
function applyEquipmentStats(slot) {
    const equipName = accountMeta.equipment ? accountMeta.equipment[slot] : null;
    if (!equipName || typeof CRAFTING_BLUEPRINTS === "undefined") return;

    const blueprint = CRAFTING_BLUEPRINTS.find(x => x.name === equipName);
    if (!blueprint || !blueprint.stats) return;

    const starLevel = (accountMeta.equipmentStars && accountMeta.equipmentStars[slot]) || 0;
    const multiplier = 1 + (starLevel * 0.15); 

    const st = blueprint.stats;
    if (st.atk) currentRun.atk += Math.floor(st.atk * multiplier);
    if (st.matk) currentRun.matk += Math.floor(st.matk * multiplier);
    if (st.spd) currentRun.spd += Math.floor(st.spd * multiplier);
    if (st.mpRegen) currentRun.mpRegen += Math.floor(st.mpRegen * multiplier);
    if (st.block) { currentRun.block += Math.floor(st.block * multiplier); currentRun.def = currentRun.block; }
    if (st.mdef) currentRun.mdef += Math.floor(st.mdef * multiplier);
    if (st.maxHp) currentRun.maxHp += Math.floor(st.maxHp * multiplier); 
    if (st.critChance) currentRun.critChance = Math.min(80, currentRun.critChance + Math.floor(st.critChance * multiplier));
    if (st.hit) currentRun.hit += Math.floor(st.hit * multiplier);
    if (st.flee) currentRun.flee += Math.floor(st.flee * multiplier);
}

// 3. 戰鬥判定與傷害算式（含 Perfect Dodge, HIT, FLEE, DEF, MDEF, CRIT）
function calculateDamage(attackerAtk, defenderDef, isPlayerAttacking = true, isMagic = false) {
    if (isPlayerAttacking && activeMonster) {
        // A. 完全迴避判定
        if (!isMagic && Math.random() * 100 < (activeMonster.perfectDodge || 0)) {
            return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
        }

        // B. 命中率判定 (HIT vs FLEE)
        if (!isMagic) {
            const monsterFlee = activeMonster.flee || (dungeonFloor * 3);
            const hitRate = Math.max(10, Math.min(95, currentRun.hit - monsterFlee));
            if (Math.random() * 100 > hitRate) {
                return { damage: 0, isCrit: false, isMiss: true };
            }
        }
    }

    // C. 減傷算式 (Soft DEF / MDEF)
    const defConst = isMagic ? 40 : 50;
    const reduction = defenderDef / (defenderDef + defConst);
    let baseDmg = attackerAtk * (1 - reduction);
    
    let variance = 0.9 + Math.random() * 0.2;
    let finalDmg = Math.max(1, Math.floor(baseDmg * variance));
    
    // D. 暴擊判定
    let isCrit = false;
    if (isPlayerAttacking && !isMagic && Math.random() * 100 < currentRun.critChance) {
        isCrit = true;
        finalDmg = Math.floor(finalDmg * 1.5);
    }
    
    return { damage: finalDmg, isCrit: isCrit, isMiss: false };
}
