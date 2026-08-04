// ==========================================================================
// 🧮 statengine.js：屬性計算與傷害判定引擎
// ==========================================================================

function resetCurrentRunData() {
    if (!accountMeta) return;
    if (!accountMeta.stats) {
        accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    }
    
    const s = {
        STR: Number(accountMeta.stats.STR) || 0,
        AGI: Number(accountMeta.stats.AGI) || 0,
        VIT: Number(accountMeta.stats.VIT) || 0,
        INT: Number(accountMeta.stats.INT) || 0,
        DEX: Number(accountMeta.stats.DEX) || 0,
        LUK: Number(accountMeta.stats.LUK) || 0
    };

    const job = accountMeta.job || currentRun.job || "swordsman";
    currentRun.job = job;

    currentRun.lv = Number(accountMeta.lv) || 1; 
    currentRun.exp = Number(accountMeta.exp) || 0; 
    currentRun.nextExp = Number(accountMeta.nextExp) || 30;

    const strBonusAtk = s.STR * 3 + Math.pow(Math.floor(s.STR / 10), 2);
    currentRun.maxWeight = 100 + s.STR * 20;

    currentRun.spd = 20 + Math.floor(s.AGI * 1.5);
    currentRun.flee = 10 + s.AGI * 1.2;

    currentRun.maxHp = 100 + (s.VIT * 22) + (activeVillageBuffs.maxHpAdd || 0);
    currentRun.def = Math.floor(s.VIT * 0.8);
    currentRun.block = currentRun.def; 
    currentRun.hpRegen = 1 + Math.floor(s.VIT / 5);

    currentRun.matk = 15 + s.INT * 3.5 + Math.pow(Math.floor(s.INT / 10), 2);
    currentRun.mdef = Math.floor(s.INT * 0.8);
    currentRun.maxMp = 50 + (s.INT * 12) + (activeVillageBuffs.maxMpAdd || 0);
    currentRun.mpRegen = 15 + Math.floor(s.INT * 1.2);

    currentRun.hit = 80 + s.DEX * 1.5 + s.LUK * 0.3;
    const dexBonusAtk = s.DEX * 3 + Math.pow(Math.floor(s.DEX / 10), 2);
    currentRun.castReduction = Math.min(0.80, (s.DEX * 1.5 + s.INT * 0.5) / 100);

    currentRun.critChance = Math.min(80, Math.floor(s.LUK * 0.4 + s.DEX * 0.1));
    currentRun.perfectDodge = Math.min(30, Math.floor(s.LUK * 0.2));

    currentRun.vampRate = 0;
    currentRun.doubleStrike = 0;

    if (job === "archer") {
        currentRun.atk = 15 + dexBonusAtk + Math.floor(s.STR * 0.5);
    } else if (job === "magician" || job === "acolyte") {
        currentRun.atk = 10 + Math.floor(s.STR * 1.5);
    } else {
        currentRun.atk = 15 + strBonusAtk + Math.floor(s.DEX * 0.5);
    }

    currentRun.hp = Math.min(currentRun.hp || currentRun.maxHp, currentRun.maxHp);
    currentRun.mp = Math.min(currentRun.mp || currentRun.maxMp, currentRun.maxMp);

    applyEquipmentStats('weapon');
    applyEquipmentStats('armor');
    applyEquipmentStats('accessory');
}

function applyEquipmentStats(slot) {
    if (!accountMeta || !accountMeta.equipment) return;
    const equipName = accountMeta.equipment[slot];
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
    if (st.hpRegen) currentRun.hpRegen += Math.floor(st.hpRegen * multiplier);
    if (st.def) currentRun.def += Math.floor(st.def * multiplier);
    if (st.block) {
        const bVal = Math.floor(st.block * multiplier);
        currentRun.block += bVal;
        currentRun.def += bVal;
    }
    if (st.mdef) currentRun.mdef += Math.floor(st.mdef * multiplier);
    if (st.maxHp) currentRun.maxHp += Math.floor(st.maxHp * multiplier);
    if (st.maxMp) currentRun.maxMp += Math.floor(st.maxMp * multiplier);
    if (st.critChance) currentRun.critChance = Math.min(80, currentRun.critChance + Math.floor(st.critChance * multiplier));
    if (st.hit) currentRun.hit += Math.floor(st.hit * multiplier);
    if (st.flee) currentRun.flee += Math.floor(st.flee * multiplier);
    if (st.vampRate) currentRun.vampRate += Math.floor(st.vampRate * multiplier);
    if (st.doubleStrike) currentRun.doubleStrike += Math.floor(st.doubleStrike * multiplier);
}

// 計算裝備屬性加成範例
function calculateEquipmentBonus(equipName) {
    const blueprint = CRAFTING_BLUEPRINTS.find(b => b.name === equipName);
    if (!blueprint) return {};

    const refineLvl = accountMeta.itemRefines?.[equipName] || 0;
    const multiplier = 1 + (refineLvl * 0.15); // 每 +1 增加 15% 基礎屬性

    let finalStats = {};
    for (let key in blueprint.stats) {
        finalStats[key] = Math.floor(blueprint.stats[key] * multiplier);
    }
    return finalStats;
}

function calculateDamage(attackerAtk, defenderDef, isPlayerAttacking = true, isMagic = false) {
    const atk = Math.max(0, Number(attackerAtk) || 0);
    const def = Math.max(0, Number(defenderDef) || 0);

    if (isPlayerAttacking && activeMonster) {
        if (!isMagic && Math.random() * 100 < (Number(activeMonster.perfectDodge) || 0)) {
            return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
        }

        if (!isMagic) {
            const monsterFlee = Number(activeMonster.flee) || (typeof dungeonFloor !== "undefined" ? dungeonFloor * 3 : 0);
            const playerHit = Number(currentRun.hit) || 80;
            const hitRate = Math.max(10, Math.min(95, playerHit - monsterFlee));
            if (Math.random() * 100 > hitRate) {
                return { damage: 0, isCrit: false, isMiss: true };
            }
        }
    } else if (!isPlayerAttacking && activeMonster) {
        if (!isMagic && Math.random() * 100 < (Number(currentRun.perfectDodge) || 0)) {
            return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
        }

        if (!isMagic) {
            const monsterHit = Number(activeMonster.hit) || (typeof dungeonFloor !== "undefined" ? dungeonFloor * 4 + 75 : 80);
            const playerFlee = Number(currentRun.flee) || 10;
            const hitRate = Math.max(10, Math.min(95, monsterHit - playerFlee));
            if (Math.random() * 100 > hitRate) {
                return { damage: 0, isCrit: false, isMiss: true };
            }
        }
    }

    const defConst = isMagic ? 40 : 50;
    const reduction = def / (def + Math.max(1, defConst));
    let baseDmg = atk * (1 - reduction);
    
    let variance = 0.9 + Math.random() * 0.2;
    let finalDmg = Math.max(1, Math.floor(baseDmg * variance));
    
    let isCrit = false;
    const playerCrit = Number(currentRun.critChance) || 0;
    if (isPlayerAttacking && !isMagic && Math.random() * 100 < playerCrit) {
        isCrit = true;
        finalDmg = Math.floor(finalDmg * 1.5);
    }
    
    return { damage: finalDmg, isCrit: isCrit, isMiss: false };
}

