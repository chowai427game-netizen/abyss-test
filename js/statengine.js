// ==========================================================================
// 🧮 statengine.js：屬性計算與傷害判定引擎 (v4.2 全域連動修復版)
// ==========================================================================

(function (exports) {
    const JOB_COMBAT_TRAITS = {
        swordsman: { physicalDamageReduction: 0.10 },
        magician: { matkMultiplier: 1.15, freeSkillMpChance: 0.20 },
        acolyte: { magicDamageReduction: 0.15, healMultiplier: 1.25, shieldMultiplier: 1.25 },
        thief: { fleeBonus: 15, doubleStrikeChance: 0.20 },
        archer: { hitBonus: 20, ignorePhysicalDefense: 0.25 },
        knight: { spdBonus: 10, physicalDamageMultiplier: 1.20 },
        crusader: { maxHpMultiplier: 1.20, reflectChance: 0.30, reflectDamageRate: 0.25 },
        wizard: { matkMultiplier: 1.25, magicCanCrit: true },
        sage: { doubleCastChance: 0.30 },
        priest: { allDamageReduction: 0.15, healMultiplier: 1.50, shieldMultiplier: 1.50 },
        monk: { critBonus: 15, ignorePhysicalDefense: 0.25 },
        assassin: { fleeBonus: 25, doubleStrikeChance: 0.35 },
        rogue: { critDamageBonus: 0.30, lootMultiplier: 2 },
        hunter: { falconChance: 0.40 },
        bard_dancer: { allStatsMultiplier: 1.15 }
    };

    /**
     * 重置並計算單次 Run 的勇者即時屬性
     * @param {Object} account - 玩家帳號持久化數據 (accountMeta)
     * @param {Object} run - 當前 Run 的動態狀態 (currentRun)
     * @param {Object} buffs - 村莊 Buff (activeVillageBuffs)
     * @param {Object} skillsDb - 技能資料庫 (SKILLS_DATABASE)
     * @param {Array} blueprintsDb - 藍圖資料庫 (CRAFTING_BLUEPRINTS)
     */
    function resetCurrentRunData(account, run, buffs = {}, skillsDb = {}, blueprintsDb = []) {
        // 安全容錯：若未傳入則嘗試讀取全域變數 (相容舊版呼叫)
        const acc = account || (typeof accountMeta !== "undefined" ? accountMeta : null);
        const current = run || (typeof currentRun !== "undefined" ? currentRun : null);
        const villageBuffs = buffs || (typeof activeVillageBuffs !== "undefined" ? activeVillageBuffs : {});
        const sDb = skillsDb || (typeof SKILLS_DATABASE !== "undefined" ? SKILLS_DATABASE : {});
        const bDb = blueprintsDb || (typeof CRAFTING_BLUEPRINTS !== "undefined" ? CRAFTING_BLUEPRINTS : []);

        if (!acc || !current) return;

        if (!acc.stats) {
            acc.stats = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
        }

        const job = acc.job || current.job || "swordsman";
        current.job = job;
        current.lv = Number(acc.lv) || 1;
        current.exp = Number(acc.exp) || 0;
        current.nextExp = Number(acc.nextExp) || 30;

        // 🛠️ 1. 計算職業等級固有加成 (Job Stat Bonus)
        let jobBonus = { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 };
        if (typeof getJobBonusStats === "function") {
            jobBonus = getJobBonusStats(job, current.lv);
        } else if (typeof JOB_STAT_BONUS !== "undefined" && JOB_STAT_BONUS[job]) {
            jobBonus = JOB_STAT_BONUS[job];
        }

        // 綜合基本配點與職業加成
        const jobMeta = (typeof JOB_DATABASE !== "undefined" && JOB_DATABASE[job]) || {};
        const jobTraits = JOB_COMBAT_TRAITS[job] || {};
        const allStatsMultiplier = Number(jobTraits.allStatsMultiplier) || 1;
        const jobLevelGrowth = Math.max(0, current.lv - 1);
        const s = {
            STR: Math.floor(((Number(acc.stats.STR) || 0) + (jobBonus.STR || 0)) * allStatsMultiplier),
            AGI: Math.floor(((Number(acc.stats.AGI) || 0) + (jobBonus.AGI || 0)) * allStatsMultiplier),
            VIT: Math.floor(((Number(acc.stats.VIT) || 0) + (jobBonus.VIT || 0)) * allStatsMultiplier),
            INT: Math.floor(((Number(acc.stats.INT) || 0) + (jobBonus.INT || 0)) * allStatsMultiplier),
            DEX: Math.floor(((Number(acc.stats.DEX) || 0) + (jobBonus.DEX || 0)) * allStatsMultiplier),
            LUK: Math.floor(((Number(acc.stats.LUK) || 0) + (jobBonus.LUK || 0)) * allStatsMultiplier)
        };

        // 記錄舊的最大值，用於比例補算 HP/MP
        const oldMaxHp = current.maxHp || 100;
        const oldMaxMp = current.maxMp || 50;

        // ==========================================================================
        // ⚙️ 核心套用：適合 3 點/級的平滑成長公式 (防暴脹)
        // ==========================================================================
        // 1. STR 力量
        const strBonusAtk = Math.floor(s.STR * 1.5 + Math.pow(Math.floor(s.STR / 10), 1.3));
        current.maxWeight = 100 + s.STR * 10;

        // 2. AGI 敏捷
        current.spd = 20 + Math.floor(s.AGI * 0.5) + (Number(jobTraits.spdBonus) || 0);
        current.flee = 10 + Math.floor(s.AGI * 0.6) + (Number(jobTraits.fleeBonus) || 0);

        // 3. VIT 體質 (加點 VIT 立刻拉高 maxHp)
        current.maxHp = 100 + (s.VIT * 10) + jobLevelGrowth * (Number(jobMeta.hpScaling) || 0) + (villageBuffs.maxHpAdd || 0);
        current.def = (Number(jobMeta.baseDef) || 0) + Math.floor(s.VIT * 0.3);
        current.block = current.def;
        current.hpRegen = 1 + Math.floor(s.VIT / 10);

        // 4. INT 智力 (加點 INT 立刻拉高 maxMp 與魔攻)
        current.matk = 15 + Math.floor(s.INT * 1.8 + Math.pow(Math.floor(s.INT / 10), 1.3));
        current.mdef = (Number(jobMeta.baseMdef) || 0) + Math.floor(s.INT * 0.3);
        current.maxMp = 50 + (s.INT * 6) + jobLevelGrowth * (Number(jobMeta.mpScaling) || 0) + (villageBuffs.maxMpAdd || 0);
        current.mpRegen = 15 + Math.floor(s.INT * 0.5);

        // 5. DEX 靈巧
        current.hit = 80 + Math.floor(s.DEX * 0.8 + s.LUK * 0.2) + (Number(jobTraits.hitBonus) || 0);
        const dexBonusAtk = Math.floor(s.DEX * 1.5 + Math.pow(Math.floor(s.DEX / 10), 1.3));
        current.castReduction = Math.min(0.80, (s.DEX * 0.5 + s.INT * 0.2) / 100);

        // 6. LUK 幸運
        current.critChance = Math.min(80, Math.floor(s.LUK * 0.2 + s.DEX * 0.05) + (Number(jobTraits.critBonus) || 0));
        current.perfectDodge = Math.min(30, Math.floor(s.LUK * 0.1));

        current.vampRate = 0;
        current.doubleStrike = 0;

        const bossTalentBonuses = acc.bossTalentBonuses || { maxHp: 0, spd: 0, critChance: 0 };

        // 職業攻防基礎公式
        if (job === "archer" || job === "hunter" || job === "bard_dancer") {
            current.atk = 15 + dexBonusAtk + Math.floor(s.STR * 0.5);
        } else if (job === "magician" || job === "acolyte" || job === "wizard" || job === "sage" || job === "priest") {
            current.atk = 10 + Math.floor(s.STR * 1.5);
        } else {
            current.atk = 15 + strBonusAtk + Math.floor(s.DEX * 0.5);
        }

        // 2. 🛡️ 計算裝備加成 (裝備部位: weapon, armor, accessory)
        applyEquipmentStats('weapon', acc, current, bDb);
        applyEquipmentStats('armor', acc, current, bDb);
        applyEquipmentStats('accessory', acc, current, bDb);

        // 3. 🔮 自動掃描已學習被動技能並套用屬性加成
        if (current.skills && (sDb || typeof getAllSkillsForJob === "function")) {
            let availableSkills = [];
            if (typeof getAllSkillsForJob === "function") {
                availableSkills = getAllSkillsForJob(job);
            } else {
                availableSkills = sDb[job] || [];
            }

            for (let sKey in current.skills) {
                const skLv = current.skills[sKey];
                if (skLv <= 0) continue;

                const sMeta = availableSkills.find(s => s.name === sKey || s.id === sKey);
                if (sMeta && sMeta.type === "passive" && sMeta.passiveStats) {
                    for (let pStat in sMeta.passiveStats) {
                        const bonusPerLv = sMeta.passiveStats[pStat];
                        const totalBonus = bonusPerLv * skLv;

                        if (pStat === "critChance") {
                            current.critChance = Math.min(80, (current.critChance || 0) + totalBonus);
                        } else if (pStat === "spd") {
                            current.spd = (current.spd || 0) + totalBonus;
                        } else if (pStat === "flee") {
                            current.flee = (current.flee || 0) + totalBonus;
                        } else if (pStat === "doubleStrike") {
                            current.doubleStrike = (current.doubleStrike || 0) + totalBonus / 100;
                        } else if (current[pStat] !== undefined) {
                            current[pStat] += totalBonus;
                        }
                    }
                }
            }
        }

        const runBonuses = current.runBonuses || {};
        current.atk += Number(runBonuses.atk) || 0;
        current.matk += Number(runBonuses.matk) || 0;
        current.maxHp += Number(runBonuses.maxHp) || 0;
        current.perfectDodge = Math.min(30, (Number(current.perfectDodge) || 0) + (Number(runBonuses.perfectDodge) || 0));
        current.maxHp += Number(bossTalentBonuses.maxHp) || 0;
        current.maxHp = Math.floor(current.maxHp * (Number(jobTraits.maxHpMultiplier) || 1));
        current.spd += Number(bossTalentBonuses.spd) || 0;
        current.critChance = Math.min(80, (current.critChance || 0) + (Number(bossTalentBonuses.critChance) || 0));
        current.matk = Math.floor((current.matk || 0) * (Number(jobTraits.matkMultiplier) || 1));
        current.doubleStrike = (Number(current.doubleStrike) || 0) + (Number(jobTraits.doubleStrikeChance) || 0);
        current.jobCombatTraits = { ...jobTraits };

        // 💖【關鍵修復】若是村莊狀態或加點後，直接補滿當前 HP / MP 至最新上限
        if (typeof gameState !== "undefined" && gameState === "VILLAGE") {
            current.hp = current.maxHp;
            current.mp = current.maxMp;
        } else {
            // 戰鬥中加點則補足增長差額
            const hpDiff = current.maxHp - oldMaxHp;
            const mpDiff = current.maxMp - oldMaxMp;
            current.hp = Math.min(current.maxHp, (current.hp || oldMaxHp) + Math.max(0, hpDiff));
            current.mp = Math.min(current.maxMp, (current.mp || oldMaxMp) + Math.max(0, mpDiff));
        }
    }

    /**
     * 套用指定部位的裝備屬性加成
     */
    function applyEquipmentStats(slot, account, run, blueprintsDb) {
        const acc = account || (typeof accountMeta !== "undefined" ? accountMeta : null);
        const current = run || (typeof currentRun !== "undefined" ? currentRun : null);
        const bDb = blueprintsDb || (typeof CRAFTING_BLUEPRINTS !== "undefined" ? CRAFTING_BLUEPRINTS : []);

        if (!acc || !acc.equipment || !current) return;
        const equipName = acc.equipment[slot];
        if (!equipName) return;

        let blueprint = null;
        if (typeof getItemBlueprintByName === "function") {
            blueprint = getItemBlueprintByName(equipName);
        } else if (bDb) {
            blueprint = bDb.find(x => x.name === equipName);
        }

        if (!blueprint || !blueprint.stats) return;

        const starLevel = (acc.equipmentStars && acc.equipmentStars[slot]) || 
                          (acc.itemRefines && acc.itemRefines[equipName]) || 0;
        const multiplier = 1 + (starLevel * 0.15);

        const st = blueprint.stats;
        if (st.atk) current.atk += Math.floor(st.atk * multiplier);
        if (st.matk) current.matk += Math.floor(st.matk * multiplier);
        if (st.spd) current.spd += Math.floor(st.spd * multiplier);
        if (st.mpRegen) current.mpRegen += Math.floor(st.mpRegen * multiplier);
        if (st.hpRegen) current.hpRegen += Math.floor(st.hpRegen * multiplier);
        if (st.def) current.def += Math.floor(st.def * multiplier);
        if (st.block) {
            const bVal = Math.floor(st.block * multiplier);
            current.block += bVal;
            current.def += bVal;
        }
        if (st.mdef) current.mdef += Math.floor(st.mdef * multiplier);
        if (st.maxHp) current.maxHp += Math.floor(st.maxHp * multiplier);
        if (st.maxMp) current.maxMp += Math.floor(st.maxMp * multiplier);
        if (st.critChance) current.critChance = Math.min(80, current.critChance + Math.floor(st.critChance * multiplier));
        if (st.hit) current.hit += Math.floor(st.hit * multiplier);
        if (st.flee) current.flee += Math.floor(st.flee * multiplier);
        if (st.vampRate) current.vampRate += Math.floor(st.vampRate * multiplier);
        if (st.doubleStrike) current.doubleStrike += (st.doubleStrike * multiplier) / 100;
    }

    /**
     * 計算單件裝備最終屬性 preview (預覽面板 API)
     */
    function calculateEquipmentBonus(equipName, slot = "weapon", account, blueprintsDb) {
        const acc = account || (typeof accountMeta !== "undefined" ? accountMeta : null);
        const bDb = blueprintsDb || (typeof CRAFTING_BLUEPRINTS !== "undefined" ? CRAFTING_BLUEPRINTS : []);

        let blueprint = null;
        if (typeof getItemBlueprintByName === "function") {
            blueprint = getItemBlueprintByName(equipName);
        } else if (bDb) {
            blueprint = bDb.find(b => b.name === equipName);
        }

        if (!blueprint || !blueprint.stats) return {};

        const refineLvl = (acc && acc.equipmentStars && acc.equipmentStars[slot]) || 
                          (acc && acc.itemRefines && acc.itemRefines[equipName]) || 0;
        const multiplier = 1 + (refineLvl * 0.15);

        let finalStats = {};
        for (let key in blueprint.stats) {
            finalStats[key] = Math.floor(blueprint.stats[key] * multiplier);
        }
        return finalStats;
    }

    /**
     * 核心傷害與命中判定引擎
     */
    function calculateDamage(attackerAtk, defenderDef, isPlayerAttacking = true, isMagic = false, targetMonster = null, playerRun = null, floor = 1) {
        const atk = Math.max(0, Number(attackerAtk) || 0);
        let def = Math.max(0, Number(defenderDef) || 0);

        const monster = targetMonster || (typeof activeMonster !== "undefined" ? activeMonster : null);
        const current = playerRun || (typeof currentRun !== "undefined" ? currentRun : null);
        const dFloor = floor || (typeof dungeonFloor !== "undefined" ? dungeonFloor : 1);

        if (isPlayerAttacking && monster) {
            if (!isMagic && Math.random() * 100 < (Number(monster.perfectDodge) || 0)) {
                return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
            }

            if (!isMagic) {
                const monsterFlee = Number(monster.flee) || 0;
                const playerHit = Number(current?.hit) || 80;
                const hitRate = Math.max(60, Math.min(98, 95 + (playerHit - 80) * 0.5 - monsterFlee * 0.5));
                if (Math.random() * 100 > hitRate) {
                    return { damage: 0, isCrit: false, isMiss: true };
                }
            }
        } 
        else if (!isPlayerAttacking && monster) {
            if (!isMagic && Math.random() * 100 < (Number(current?.perfectDodge) || 0)) {
                return { damage: 0, isCrit: false, isMiss: true, isPerfectDodge: true };
            }

            if (!isMagic) {
                const monsterHit = Number(monster.hit) || (82 + Math.min(10, Math.floor(dFloor * 0.15)));
                const playerFlee = (Number(current?.flee) || 10) + (Number(current?.activeCombatBuffs?.dodgeBuff?.value) || 0);
                const hitRate = Math.max(55, Math.min(95, monsterHit - Math.max(0, playerFlee - 10) * 0.5));
                if (Math.random() * 100 > hitRate) {
                    return { damage: 0, isCrit: false, isMiss: true };
                }
            }
        }

        const traits = current?.jobCombatTraits || {};
        if (isPlayerAttacking && !isMagic) {
            const pierce = Math.max(0, Math.min(0.75, Number(traits.ignorePhysicalDefense) || 0));
            def *= 1 - pierce;
        }
        const defConst = isMagic ? 40 : 50;
        if (!isPlayerAttacking && current) {
            const defenseBuffKey = isMagic ? "mdefBuff" : "blockBuff";
            def += Number(current.activeCombatBuffs?.[defenseBuffKey]?.value) || 0;
        }
        const reduction = def / (def + Math.max(1, defConst));
        let baseDmg = atk * (1 - reduction);
        if (isPlayerAttacking && !isMagic) baseDmg *= Number(traits.physicalDamageMultiplier) || 1;

        let variance = 0.9 + Math.random() * 0.2;
        let finalDmg = Math.max(1, Math.floor(baseDmg * variance));

        let isCrit = false;
        const playerCrit = Number(current?.critChance) || 0;
        const canCrit = isPlayerAttacking && (!isMagic || traits.magicCanCrit || current?.guaranteedCritNext);
        if (canCrit && (current?.guaranteedCritNext || Math.random() * 100 < playerCrit)) {
            isCrit = true;
            finalDmg = Math.floor(finalDmg * (1.5 + (Number(traits.critDamageBonus) || 0)));
            if (current?.guaranteedCritNext) current.guaranteedCritNext = false;
        }

        if (!isPlayerAttacking && current) {
            const passiveReduction = Number(traits.allDamageReduction || 0) +
                (isMagic ? Number(traits.magicDamageReduction || 0) : Number(traits.physicalDamageReduction || 0));
            finalDmg = Math.max(1, Math.floor(finalDmg * (1 - Math.min(0.75, passiveReduction))));
            if (monster?.isBoss && Number(current.bossDmgCut) > 0) {
                finalDmg = Math.max(1, Math.floor(finalDmg * (1 - Math.min(0.9, Number(current.bossDmgCut)))));
                current.bossDmgCut = 0;
            }
        }

        return { damage: finalDmg, isCrit: isCrit, isMiss: false };
    }

    // 匯出 API (支援 CommonJS / Node.js 與 Browser 全域)
    exports.resetCurrentRunData = resetCurrentRunData;
    exports.applyEquipmentStats = applyEquipmentStats;
    exports.calculateEquipmentBonus = calculateEquipmentBonus;
    exports.calculateDamage = calculateDamage;

    // 🌐【關鍵修復】顯式將關鍵函式直接掛載至全域 window，防止全域呼叫遺失
    if (typeof window !== "undefined") {
        window.resetCurrentRunData = resetCurrentRunData;
        window.applyEquipmentStats = applyEquipmentStats;
        window.calculateEquipmentBonus = calculateEquipmentBonus;
        window.calculateDamage = calculateDamage;
    }

})(typeof exports !== 'undefined' ? exports : (window.StatEngine = {}));
