// ==========================================================================
// 🧮 statengine.js：修復版（包含全面防毒與保底機制）
// ==========================================================================

/**
 * 重置並重新計算玩家單次冒險 (Current Run) 的所有基礎屬性與面板
 */
function resetCurrentRunData() {
    // 🛡️ 1. 屬性物件保底與單鍵補齊防爆
    if (!accountMeta.stats) {
        accountMeta.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
    }
    
    // 確保即使舊存檔缺鍵，取出的數值也絕對是數字（避免 undefined * 3 變成 NaN）
    const s = {
        STR: Number(accountMeta.stats.STR) || 0,
        AGI: Number(accountMeta.stats.AGI) || 0,
        VIT: Number(accountMeta.stats.VIT) || 0,
        INT: Number(accountMeta.stats.INT) || 0,
        DEX: Number(accountMeta.stats.DEX) || 0,
        LUK: Number(accountMeta.stats.LUK) || 0
    };

    const job = currentRun.job || "swordsman";

    // 基礎等級與經驗同步
    currentRun.lv = Number(accountMeta.lv) || 1; 
    currentRun.exp = Number(accountMeta.exp) || 0; 
    currentRun.nextExp = Number(accountMeta.nextExp) || 30;

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
 */
function calculateDamage(attackerAtk, defenderDef, isPlayerAttacking = true, isMagic = false) {
    // 🛡️ 2. 攻防數值保底轉換（關鍵修復！）
    const atk = Math.max(0, Number(attackerAtk) || 0);
    const def = Math.max(0, Number(defenderDef) || 0);

    if (isPlayerAttacking && activeMonster) {
        // A1. 玩家攻擊：魔物完全迴避
        if (!isMagic && Math.random() * 100 < (Number(activeMonster.perfectDodge) || 0)) {
            return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
        }

        // B1. 玩家攻擊：命中率判定 (Player HIT vs Monster FLEE)
        if (!isMagic) {
            const monsterFlee = Number(activeMonster.flee) || (dungeonFloor * 3);
            const playerHit = Number(currentRun.hit) || 80;
            const hitRate = Math.max(10, Math.min(95, playerHit - monsterFlee));
            if (Math.random() * 100 > hitRate) {
                return { damage: 0, isCrit: false, isMiss: true };
            }
        }
    } else if (!isPlayerAttacking && activeMonster) {
        // A2. 魔物攻擊玩家：玩家完全迴避
        if (!isMagic && Math.random() * 100 < (Number(currentRun.perfectDodge) || 0)) {
            return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
        }

        // B2. 魔物攻擊玩家：命中率判定
        if (!isMagic) {
            const monsterHit = Number(activeMonster.hit) || (dungeonFloor * 4 + 75);
            const playerFlee = Number(currentRun.flee) || 10;
            const hitRate = Math.max(10, Math.min(95, monsterHit - playerFlee));
            if (Math.random() * 100 > hitRate) {
                return { damage: 0, isCrit: false, isMiss: true };
            }
        }
    }

    // C. 減傷算式 (Soft DEF / MDEF)
    const defConst = isMagic ? 40 : 50;
    const reduction = def / (def + Math.max(1, defConst));
    let baseDmg = atk * (1 - reduction);
    
    // 浮動傷害 (90% ~ 110%)
    let variance = 0.9 + Math.random() * 0.2;
    let finalDmg = Math.max(1, Math.floor(baseDmg * variance));
    
    // D. 暴擊判定 (玩家物理攻擊特有)
    let isCrit = false;
    const playerCrit = Number(currentRun.critChance) || 0;
    if (isPlayerAttacking && !isMagic && Math.random() * 100 < playerCrit) {
        isCrit = true;
        finalDmg = Math.floor(finalDmg * 1.5);
    }
    
    return { damage: finalDmg, isCrit: isCrit, isMiss: false };
}
