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
    Math: Object.assign(Object.create(Math), { random: () => 0 })
};
vm.createContext(context);
for (const file of ["data/jobdata.js", "data/monsterdata.js", "js/statengine.js"]) {
    vm.runInContext(fs.readFileSync(path.join(repoRoot, file), "utf8"), context, { filename: file });
}

function makeAccount(job, stats = {}, lv = 1) {
    return {
        job,
        lv,
        exp: 0,
        nextExp: 30,
        stats: { STR: 0, AGI: 0, VIT: 0, INT: 0, DEX: 0, LUK: 0, ...stats },
        skills: {},
        equipment: {},
        bossTalentBonuses: { maxHp: 0, spd: 0, critChance: 0 }
    };
}

function makeRun(job) {
    return {
        job,
        skills: {},
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        atk: 15,
        matk: 15,
        def: 0,
        mdef: 0,
        hit: 80,
        flee: 10,
        spd: 20,
        critChance: 0,
        perfectDodge: 0,
        doubleStrike: 0,
        runBonuses: {}
    };
}

function resetStats(job, stats = {}, lv = 1) {
    const account = makeAccount(job, stats, lv);
    const run = makeRun(job);
    context.exports.resetCurrentRunData(account, run, {}, {}, []);
    return run;
}

// The active spawn API must use floor-within-zone scaling, not absolute floor scaling.
const tierTwoFirst = vm.runInContext('generateMonsterInstance(REGULAR_MONSTERS_POOL.find(m => m.minFloor === 11), 11)', context);
const tierTwoLast = vm.runInContext('generateMonsterInstance(REGULAR_MONSTERS_POOL.find(m => m.minFloor === 11), 19)', context);
assert.equal(tierTwoFirst.hp, 180);
assert.equal(tierTwoLast.hp, 380);
assert.equal(tierTwoFirst.def, 8);
assert.equal(tierTwoFirst.mdef, 12);
assert.notEqual(tierTwoFirst.def, tierTwoFirst.mdef, "monster magic defense remains independent from physical defense");
const spawned = vm.runInContext('spawnMonsterForFloor(21)', context);
assert.equal(spawned.hp, 380, "the first floor of a zone starts at its base HP");
assert.ok(Number.isFinite(spawned.hit) && Number.isFinite(spawned.flee) && Number.isFinite(spawned.perfectDodge));
const magicMonster = vm.runInContext('generateMonsterInstance(REGULAR_MONSTERS_POOL.find(m => m.name.includes("魔導書")), 21)', context);
assert.equal(magicMonster.attackType, "magic", "caster monster attack type survives scaling");
assert.equal(vm.runInContext('spawnMonsterForFloor(20).attackType', context), "magic", "caster boss attack type survives spawning");
assert.equal(vm.runInContext('spawnMonsterForFloor(20).shield', context), 100, "shielded bosses expose their barrier to the combat engine");
assert.equal(vm.runInContext('spawnMonsterForFloor(10).shield', context), 0, "unshielded bosses keep zero shield");
assert.equal(vm.runInContext('getMonstersForFloor(61).length', context), 5, "B61 uses the five designed post-end regular monsters instead of fallback slimes");
assert.equal(vm.runInContext('getMonstersForFloor(69).length', context), 5, "the post-end roster covers the full 61F–69F range");
assert.equal(vm.runInContext('getMonstersForFloor(65).every(m => m.skill && m.skill.id && m.skill.name && m.skill.elite)', context), true, "each post-end archetype has a named skill and an elite extension");
assert.equal(vm.runInContext('spawnMonsterForFloor(61).skill.name', context), "先兆刻印", "regular monster skill metadata survives generation");
assert.equal(vm.runInContext('spawnMonsterForFloor(60).skill.name', context), "終焉因果鎖定", "Elda's special skill is available to the battle runtime");
assert.equal(vm.runInContext('spawnMonsterForFloor(70).phaseSkill.name', context), "因果回簿", "the new final boss exposes its one-time phase mechanic");

// Every boss must exceed the strongest regular monster on the preceding floor.
for (const bossFloor of [10, 20, 30, 40, 50, 60, 70]) {
    const priorFloor = bossFloor - 1;
    const strongestPrior = vm.runInContext(`REGULAR_MONSTERS_POOL.filter(m => ${priorFloor} >= m.minFloor && ${priorFloor} <= m.maxFloor).map(m => ({ hp: m.baseHp + m.hpScale * (${priorFloor} - m.minFloor), atk: m.baseAtk + m.atkScale * (${priorFloor} - m.minFloor) })).reduce((best, x) => ({ hp: Math.max(best.hp, x.hp), atk: Math.max(best.atk, x.atk) }), { hp: 0, atk: 0 })`, context);
    const boss = vm.runInContext(`BOSS_DATABASE[${bossFloor}]`, context);
    assert.ok(boss.baseHp > strongestPrior.hp, `${bossFloor}F boss HP must exceed the prior-floor regular maximum`);
    assert.ok(boss.baseAtk > strongestPrior.atk, `${bossFloor}F boss ATK must exceed the prior-floor regular maximum`);
}

// Job metadata now contributes to actual combat stats.
const swordsman = resetStats("swordsman");
assert.equal(swordsman.maxHp, 170);
assert.equal(swordsman.def, 7, "job base physical defense is included");
assert.equal(swordsman.jobCombatTraits.physicalDamageReduction, 0.1);
const archer = resetStats("archer");
assert.ok(archer.hit >= 100, "archer passive HIT bonus is applied");
assert.equal(archer.jobCombatTraits.ignorePhysicalDefense, 0.25);
const wizard = resetStats("wizard");
assert.equal(wizard.jobCombatTraits.magicCanCrit, true);
assert.ok(wizard.matk > 15, "wizard MATK multiplier is applied");
const levelTwoSwordsman = resetStats("swordsman", {}, 2);
assert.ok(levelTwoSwordsman.maxHp > swordsman.maxHp, "job HP scaling is applied on level-up");

// Tank mitigation and archer armor penetration are used by the shared damage resolver.
context.Math.random = () => 0;
let damage = context.exports.calculateDamage(100, 0, false, false, { hit: 95 }, swordsman, 1);
assert.equal(damage.damage, 81, "swordsman reduces incoming physical damage by 10%");
damage = context.exports.calculateDamage(100, 100, true, false, { flee: 0, perfectDodge: 0 }, archer, 1);
assert.equal(damage.damage, 36, "archer passive armor penetration affects the shared resolver");

// High-evasion targets retain a useful minimum accuracy floor instead of collapsing to 10%.
context.Math.random = () => 0.7;
damage = context.exports.calculateDamage(100, 0, true, false, { flee: 75, perfectDodge: 0 }, swordsman, 59);
assert.equal(damage.isMiss, true, "high evasion can cause misses");
context.Math.random = () => 0;
const crittingWizard = { ...wizard, critChance: 100 };
damage = context.exports.calculateDamage(100, 0, true, true, { mdef: 0 }, crittingWizard, 1);
assert.equal(damage.isCrit, true, "wizard magic can critically hit");

const gameSource = fs.readFileSync(path.join(repoRoot, "js/game.js"), "utf8");
assert.match(gameSource, /spawnMonsterForFloor\(dungeonFloor\)/, "the live battle path must use the shared monster generator");
assert.match(gameSource, /shield:\s*bossMeta\.baseShield\s*\|\|\s*0/, "the live boss object must keep its generated barrier");
assert.match(gameSource, /attackType:\s*bossMeta\.attackType\s*\|\|\s*"physical"/, "the live boss object must keep its attack type");
assert.doesNotMatch(gameSource, /baseHp\s*\+\s*dungeonFloor\s*\*\s*\(rollSeed\.hpScale/, "absolute-floor monster scaling must not return");

console.log("✅ Monster scaling, boss tuning, hit/defense, job traits, and shared damage balance tests passed.");
