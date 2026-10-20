#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const context = {
    exports: {},
    console,
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
    document: { getElementById: () => null, addEventListener: () => {} },
    addEventListener: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    localStorage: { setItem: () => {}, getItem: () => null },
    navigator: { userAgent: "node-test" }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of ["data/jobdata.js", "js/statengine.js", "js/game.js"]) {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, file), "utf8"), context, { filename: file });
}
const skillDb = vm.runInContext("SKILLS_DATABASE", context);

const activeEffectKeys = new Set([
    "dmg", "physicalDmg", "magicDmg", "hitCount", "isDoubleHit", "isTripleHit", "isMagic",
    "forceCrit", "critDamageBonus", "consumeAllMp", "mpBonusDamageRate", "pierceArmor", "ignoreDef", "shieldBreak", "dispel",
    "bonusVsFrozen", "bonusVsBurning", "bonusVsPoisoned", "poisonStacks", "burnStacks",
    "freezeChance", "stunChance", "explodePoison", "healAmount", "healPercent",
    "shieldGain", "mpRestore", "blockBuff", "mdefBuff", "dodgeBuff", "spdBuff", "thornsFire",
    "turns", "duration", "permAtk", "permHp", "permDodge", "guaranteedCritNext", "bossDmgCut",
    "stealGold", "stealMat"
]);
const passiveEffectKeys = new Set([
    "STR", "AGI", "VIT", "INT", "DEX", "LUK", "atk", "matk", "maxHp", "maxMp", "spd", "flee",
    "hit", "critChance", "perfectDodge", "def", "mdef", "hpRegen", "mpRegen", "castReduction",
    "maxWeight", "block", "vampRate", "doubleStrike"
]);

let totalSkills = 0;
let activeCount = 0;
let passiveCount = 0;
for (const [job, skills] of Object.entries(skillDb)) {
    assert.ok(Array.isArray(skills), `${job} skill list must be an array`);
    for (const skill of skills) {
        totalSkills++;
        assert.ok(skill.id && skill.name, `${job} skill needs stable id and name`);
        if (skill.type === "active") {
            activeCount++;
            assert.equal(typeof skill.run, "function", `${skill.name} has a skill formula`);
            for (const level of [1, 5, 10]) {
                const effect = skill.run(level, 100, 200, 40, 100, { atk: 100, matk: 120 });
                assert.ok(effect && typeof effect === "object", `${skill.name} returns an effect object at Lv.${level}`);
                for (const [key, value] of Object.entries(effect)) {
                    assert.ok(activeEffectKeys.has(key), `${job}/${skill.name} returns unsupported effect field ${key}`);
                    if (typeof value === "number") assert.ok(Number.isFinite(value), `${job}/${skill.name}.${key} must be finite`);
                    if (["freezeChance", "stunChance"].includes(key)) assert.ok(value >= 0 && value <= 100, `${job}/${skill.name}.${key} stays within 0–100% at Lv.${level}`);
                }
            }
        } else if (skill.type === "passive") {
            passiveCount++;
            assert.ok(skill.passiveStats && Object.keys(skill.passiveStats).length > 0, `${skill.name} defines passive stats`);
            for (const [key, value] of Object.entries(skill.passiveStats)) {
                assert.ok(passiveEffectKeys.has(key), `${job}/${skill.name} returns unsupported passive stat ${key}`);
                assert.ok(Number.isFinite(Number(value)), `${job}/${skill.name}.${key} is numeric`);
            }
        } else {
            assert.fail(`${job}/${skill.name} has an unsupported type ${skill.type}`);
        }
    }
}
assert.equal(Object.keys(skillDb).length, 15);
assert.equal(totalSkills, 49);
assert.equal(activeCount, 41);
assert.equal(passiveCount, 8);

function buildStatsRun(job, learnedSkill = null) {
    const run = {
        job, lv: 30, hp: 100, maxHp: 100, mp: 50, maxMp: 50, atk: 15, matk: 15,
        def: 0, mdef: 0, spd: 20, flee: 10, hit: 80, critChance: 0,
        skills: learnedSkill ? { [learnedSkill.name]: 1 } : {}, equipment: {}, equipmentStars: {}
    };
    const account = {
        job, lv: 30, exp: 0, nextExp: 100, stats: { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0 },
        skills: run.skills, equipment: {}, equipmentStars: {}, bossTalentBonuses: {}
    };
    context.exports.resetCurrentRunData(account, run, {}, skillDb, []);
    return run;
}
for (const [job, skills] of Object.entries(skillDb)) {
    for (const passive of skills.filter((entry) => entry.type === "passive")) {
        const baseline = buildStatsRun(job);
        const learned = buildStatsRun(job, passive);
        for (const stat of Object.keys(passive.passiveStats)) {
            assert.ok(Number(learned[stat]) > Number(baseline[stat]), `${job}/${passive.name} actually increases ${stat}`);
        }
    }
}

function freshBattle({ job = "tester", monsterHp = 1000, def = 0, mdef = 0, shield = 0 } = {}) {
    const calls = [];
    const logs = [];
    const run = {
        job, hp: 100, maxHp: 100, mp: 500, maxMp: 500, atk: 100, matk: 200, def: 10, mdef: 15,
        hit: 120, flee: 10, critChance: 0, perfectDodge: 0, spd: 20, shield: 0, gold: 0,
        inventory: [], skills: {}, activeCombatBuffs: {}, jobCombatTraits: {}, runBonuses: {}
    };
    const monster = {
        name: "測試魔物", hp: monsterHp, maxHp: monsterHp, atk: 10, def, mdef, hit: 95,
        shield, poisonStacks: 0, burnStacks: 0, freezeTurns: 0, stunTurns: 0, isBoss: false,
        dropItem: "測試素材"
    };
    context.currentRun = run;
    context.activeMonster = monster;
    context.accountMeta = { name: "測試角色", warehouse: {} };
    context.calculateDamage = (damage, defense, isPlayerAttacking = true, isMagic = false) => {
        calls.push({ damage, defense, isPlayerAttacking, isMagic });
        return { damage: Math.floor(damage), isMiss: false, isCrit: false };
    };
    context.spawnVfx = () => {};
    context.triggerProjectileFX = () => {};
    context.resolveSkillVfx = () => ({ projectileType: "slash" });
    context.detectSkillCssClass = () => "skill-test";
    context.addLog = (message) => logs.push(String(message));
    context.safePushToInventory = (targetRun, account, item) => { targetRun.inventory.push(item); return `獲得 ${item}`; };
    context.getMonsterDrop = () => "測試素材";
    return { run, monster, calls, logs };
}
function skill(job, id) {
    const found = skillDb[job].find((entry) => entry.id === id);
    assert.ok(found, `missing skill ${job}/${id}`);
    return found;
}
function cast(job, id, level = 1, effect = null) {
    const battle = freshBattle({ job });
    const meta = skill(job, id);
    const baseAttack = ["magician", "acolyte", "wizard", "priest", "sage"].includes(job) ? battle.run.matk : battle.run.atk;
    const prepared = effect || meta.run(level, baseAttack, battle.run.maxMp, battle.run.hp, battle.run.maxHp, battle.run);
    assert.equal(context.executeActiveSkill(meta, level, prepared), true, `${meta.name} should execute`);
    return battle;
}

// Sword shield strike destroys a barrier and grants its caster a scaled shield.
{
    const battle = freshBattle({ job: "swordsman", shield: 120 });
    const meta = skill("swordsman", "s_4");
    assert.equal(context.executeActiveSkill(meta, 2, meta.run(2, 100)), true);
    assert.equal(battle.monster.shield, 0);
    assert.equal(battle.run.shield, 120);
    assert.ok(battle.logs.some((line) => line.includes("破盾")));
}

// Firebolt gets exactly 2.5x damage against frozen targets; lightning stacks both elemental bonuses.
{
    const fire = freshBattle({ job: "magician" });
    fire.monster.freezeTurns = 1;
    const fireMeta = skill("magician", "m_1");
    context.executeActiveSkill(fireMeta, 1, fireMeta.run(1, fire.run.matk));
    assert.equal(fire.calls[0].damage, 450, "frozen firebolt is 2.5x its 180 base damage");
    const lightning = freshBattle({ job: "magician" });
    lightning.monster.poisonStacks = 2;
    lightning.monster.burnStacks = 1;
    const meta = skill("magician", "m_5");
    const effect = meta.run(2, 200);
    context.executeActiveSkill(meta, 2, effect);
    assert.equal(lightning.calls[0].damage, Math.floor(effect.dmg * 2), "poison and burn each add 50% damage");
}

// Cross attack uses physical and magical attack and their corresponding defense independently.
{
    const battle = freshBattle({ job: "crusader", def: 20, mdef: 40 });
    const meta = skill("crusader", "c_1");
    const effect = meta.run(1, battle.run.atk, battle.run.maxMp, battle.run.hp, battle.run.maxHp, battle.run);
    context.executeActiveSkill(meta, 1, effect);
    assert.deepEqual(battle.calls.map((c) => [c.damage, c.defense, c.isMagic]), [[160, 20, false], [320, 40, true]]);
}

// Ambush adds its stated half-step critical multiplier.
{
    const battle = freshBattle({ job: "thief" });
    const meta = skill("thief", "t_3");
    context.executeActiveSkill(meta, 2, meta.run(2, battle.run.atk));
    assert.equal(battle.monster.hp, 400, "ambush critical multiplier is 2.0x rather than the default 1.5x");
}

// Asura spends the cast cost first, converts every remaining MP to damage, and ends at 0 MP.
{
    const battle = freshBattle({ job: "monk", monsterHp: 5000 });
    battle.run.mp = 200;
    const meta = skill("monk", "mk_2");
    const effect = meta.run(1, battle.run.atk, battle.run.maxMp, battle.run.hp, battle.run.maxHp, battle.run);
    context.executeActiveSkill(meta, 1, effect);
    assert.equal(battle.run.mp, 0);
    assert.equal(battle.calls[0].damage, 690, "base damage plus 120 remaining MP is passed to the critical resolver");
    assert.equal(battle.monster.hp, 3965, "the all-MP attack is then critically multiplied by 1.5");
}

assert.equal(skill("hunter", "ht_2").run(10, 100).stunChance, 100, "trap stun chance is capped at 100%");
assert.equal(skill("knight", "k_2").run(10, 100).stunChance, 90, "knight stun chance is capped at the documented 90%");

// Sage dispels an enemy barrier and temporary buffs only after the attack lands.
{
    const battle = freshBattle({ job: "sage", shield: 75 });
    battle.monster.buffs = { rage: true };
    const meta = skill("sage", "sg_1");
    context.executeActiveSkill(meta, 1, meta.run(1, battle.run.matk));
    assert.equal(battle.monster.shield, 0);
    assert.equal(Object.hasOwn(battle.monster, "buffs"), false);
    assert.ok(battle.logs.some((line) => line.includes("解除魔法")));
}

// Thief loot is conditional on a successful hit and its material is surfaced to the player.
{
    const battle = freshBattle({ job: "thief" });
    const meta = skill("thief", "t_4");
    const effect = meta.run(2, battle.run.atk);
    context.calculateDamage = () => ({ damage: 0, isMiss: true, isCrit: false });
    context.executeActiveSkill(meta, 2, effect);
    assert.equal(battle.run.gold, 0);
    assert.equal(battle.run.inventory.length, 0);

    const successful = freshBattle({ job: "thief" });
    context.executeActiveSkill(meta, 2, effect);
    assert.equal(successful.run.gold, 70);
    assert.deepEqual(successful.run.inventory, ["測試素材"]);
    assert.ok(successful.logs.some((line) => line.includes("偷竊成功")));
}

// Temporary priest magic defense is stored with its own duration; unsupported use of boss guard is rejected.
{
    const battle = freshBattle({ job: "priest" });
    const meta = skill("priest", "p_2");
    context.executeActiveSkill(meta, 1, meta.run(1));
    assert.deepEqual(JSON.parse(JSON.stringify(battle.run.activeCombatBuffs.mdefBuff)), { value: 30, turns: 5 });
    delete battle.run.activeCombatBuffs.mdefBuff;
    const magicDamageWithoutBuff = context.exports.calculateDamage(100, battle.run.mdef, false, true, battle.monster, battle.run, 1).damage;
    battle.run.activeCombatBuffs.mdefBuff = { value: 30, turns: 5 };
    const magicDamageWithBuff = context.exports.calculateDamage(100, battle.run.mdef, false, true, battle.monster, battle.run, 1).damage;
    assert.ok(magicDamageWithBuff < magicDamageWithoutBuff, "priest magic-defense buff reduces incoming magic damage");
    battle.monster.attackType = "magic";
    battle.monster.atk = 100;
    battle.run.hp = 500;
    const incomingCalls = [];
    context.calculateDamage = (damage, defense, isPlayerAttacking, isMagic) => {
        incomingCalls.push({ defense, isPlayerAttacking, isMagic });
        return context.exports.calculateDamage(damage, defense, isPlayerAttacking, isMagic, battle.monster, battle.run, 1);
    };
    context.executeMonsterActionTick();
    assert.deepEqual(incomingCalls.map((call) => [call.defense, call.isPlayerAttacking, call.isMagic]), [[15, false, true]]);
    assert.ok(battle.run.hp < 500, "enemy magic attack resolves against magic defense");
    assert.equal(context.executeActiveSkill(skill("acolyte", "a_4"), 1, skill("acolyte", "a_4").run(1)), false);
    assert.equal(battle.run.mp, 450, "invalid non-boss guard does not consume MP");
}

// Fire wall reflects after monster attacks, adds burn, and thief evasion stance has its promised 3 turns.
{
    const battle = freshBattle({ job: "magician" });
    const wall = skill("magician", "m_4");
    context.executeActiveSkill(wall, 1, wall.run(1, battle.run.matk));
    context.executeMonsterActionTick();
    assert.equal(battle.monster.burnStacks, 1);
    assert.equal(battle.monster.hp, 750, "fire wall deals its cast damage and the first 30-point retaliation");
    const thiefBuff = skill("thief", "t_2").run(1);
    assert.equal(thiefBuff.turns, 3);
}

console.log(`✅ All ${totalSkills} skill formulas validated; hybrid damage, elemental bonuses, dispel, barriers, buffs, status and steal effects passed.`);
