// ==========================================================================
// 🧮 statengine.js：RO 六大能力值轉換公式、裝備加成與戰鬥傷害算式內核
// ==========================================================================

/**
 * 重置並重新計算玩家單次冒險 (Current Run) 的所有基礎屬性與面板
 */
function resetCurrentRunData() {
    if (!accountMeta.stats) {
        accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    }
    
    const s = accountMeta.stats;
    const job = currentRun.job || "swordsman";

    // 基礎等級與經驗同步
    currentRun.lv = accountMeta.lv || 1; 
    currentRun.exp = accountMeta.exp || 0; 
    currentRun.nextExp = accountMeta.nextExp || 30;

    // ⚔️ 1. STR (力量)：近戰 ATK、負重上限
    const strBonusAtk = s.STR * 3 + Math.pow(Math.floor(s.STR / 10), 2);
    currentRun.maxWeight = 100 + s.STR * 20;

    // ⚡ 2. AGI (敏捷)：攻速 SPD、物理迴避 FLEE
    currentRun.spd = 20 + Math.floor(s.AGI * 1.5);
    currentRun.flee = 10 + s.AGI * 1.2;

    // 🛡️ 3. VIT (體質)：最大 HP、物理防禦 DEF、HP 回復率
    currentRun.maxHp = 100 + (s.VIT * 22);
    currentRun.def = Math.floor(s.VIT * 0.8);
    currentRun.block = currentRun.def; 
    currentRun.hpRegen = 1 + Math.floor(s.VIT / 5);

    // 🔮 4. INT (智力)：魔法攻擊 MATK、魔防 MDEF、最大 MP、MP 回復率
    currentRun.matk = 15 + s.INT * 3.5 + Math.pow(Math.floor(s.INT / 10), 2);
    currentRun.mdef = Math.floor(s.INT * 0.8);
    currentRun.maxMp = 50 + (s.INT * 12);
    currentRun.mpRegen = 15 + Math.floor(s.INT * 1.2);

    // 🎯 5. DEX (靈巧)：命中率 HIT、遠程 ATK、詠唱時間縮減
    currentRun.hit = 80 + s.DEX * 1.5 + s.LUK * 0.3;
    const dexBonusAtk = s.DEX * 3 + Math.pow(Math.floor(s.DEX / 10), 2);
    currentRun.castReduction = Math.min(0.80, (s.DEX * 1.5 + s.INT * 0.5) / 100);

    // 🎰 6. LUK (幸運)：暴擊率 CRIT、完全迴避 Perfect Dodge
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

    // 當前 HP/MP 上限修正
    currentRun.hp = Math.min(currentRun.hp || currentRun.maxHp, currentRun.maxHp);
    currentRun.mp = Math.min(currentRun.mp || currentRun.maxMp, currentRun.maxMp);

    // 疊加裝備與精煉星級加成
    applyEquipmentStats('weapon');
    applyEquipmentStats('armor');
    applyEquipmentStats('accessory');
}

/**
 * 讀取並疊加指定部位裝備與精煉星級加成
 */
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
    if (st.def) currentRun.def += Math.floor(st.def * multiplier);
    if (st.block) { currentRun.block += Math.floor(st.block * multiplier); currentRun.def = currentRun.block; }
    if (st.mdef) currentRun.mdef += Math.floor(st.mdef * multiplier);
    if (st.maxHp) currentRun.maxHp += Math.floor(st.maxHp * multiplier); 
    if (st.critChance) currentRun.critChance = Math.min(80, currentRun.critChance + Math.floor(st.critChance * multiplier));
    if (st.hit) currentRun.hit += Math.floor(st.hit * multiplier);
    if (st.flee) currentRun.flee += Math.floor(st.flee * multiplier);
}

/**
 * 雙向戰鬥傷害算式（含 Perfect Dodge, HIT, FLEE, DEF, MDEF, CRIT）
 * @param {number} attackerAtk 攻擊方 ATK / MATK
 * @param {number} defenderDef 防禦方 DEF / MDEF
 * @param {boolean} isPlayerAttacking 是否為玩家發動攻擊（false 表示魔物攻擊玩家）
 * @param {boolean} isMagic 是否為魔法攻擊（忽略 FLEE 與 Perfect Dodge）
 */
function calculateDamage(attackerAtk, defenderDef, isPlayerAttacking = true, isMagic = false) {
    if (isPlayerAttacking && activeMonster) {
        // A1. 玩家攻擊：魔物完全迴避
        if (!isMagic && Math.random() * 100 < (activeMonster.perfectDodge || 0)) {
            return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
        }

        // B1. 玩家攻擊：命中率判定 (Player HIT vs Monster FLEE)
        if (!isMagic) {
            const monsterFlee = activeMonster.flee || (dungeonFloor * 3);
            const hitRate = Math.max(10, Math.min(95, currentRun.hit - monsterFlee));
            if (Math.random() * 100 > hitRate) {
                return { damage: 0, isCrit: false, isMiss: true };
            }
        }
    } else if (!isPlayerAttacking && activeMonster) {
        // A2. 魔物攻擊玩家：玩家完全迴避 (LUK 完美迴避機制)
        if (!isMagic && Math.random() * 100 < (currentRun.perfectDodge || 0)) {
            return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
        }

        // B2. 魔物攻擊玩家：命中率判定 (Monster HIT vs Player FLEE)
        if (!isMagic) {
            const monsterHit = activeMonster.hit || (dungeonFloor * 4 + 75);
            const hitRate = Math.max(10, Math.min(95, monsterHit - currentRun.flee));
            if (Math.random() * 100 > hitRate) {
                return { damage: 0, isCrit: false, isMiss: true };
            }
        }
    }

    // C. 減傷算式 (Soft DEF / MDEF)
    const defConst = isMagic ? 40 : 50;
    const reduction = defenderDef / (defenderDef + Math.max(1, defConst));
    let baseDmg = attackerAtk * (1 - reduction);
    
    // 浮動傷害 (90% ~ 110%)
    let variance = 0.9 + Math.random() * 0.2;
    let finalDmg = Math.max(1, Math.floor(baseDmg * variance));
    
    // D. 暴擊判定 (玩家物理攻擊特有)
    let isCrit = false;
    if (isPlayerAttacking && !isMagic && Math.random() * 100 < currentRun.critChance) {
        isCrit = true;
        finalDmg = Math.floor(finalDmg * 1.5);
    }
    
    return { damage: finalDmg, isCrit: isCrit, isMiss: false };
}
