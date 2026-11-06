#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function createCombatContext() {
    const logs = [];
    const cues = [];
    const vfx = [];
    const deterministicMath = Object.assign(Object.create(Math), { random: () => 0.99 });
    const context = {
        console,
        Math: deterministicMath,
        document: { getElementById() { return null; } },
        setTimeout() { return 1; },
        clearTimeout() {},
        setInterval() { return 1; },
        clearInterval() {},
        addLog(message) { logs.push(String(message)); },
        spawnVfx(type, options) { vfx.push({ type, options }); },
        showBattleSkillCastCue(name, tone, options) { cues.push({ name, tone, options }); },
        calculateDamage(attack) { return { damage: Math.floor(attack), isMiss: false }; },
        logs,
        cues,
        vfx
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(root, "data/monsterdata.js"), "utf8"), context, { filename: "monsterdata.js" });
    vm.runInContext(fs.readFileSync(path.join(root, "js/game.js"), "utf8"), context, { filename: "game.js" });
    vm.runInContext(`
        accountMeta = { name: "測試者" };
        currentRun = { hp: 20000, maxHp: 20000, mp: 100, maxMp: 100, shield: 0, def: 0, mdef: 0, job: "mage", jobCombatTraits: {}, activeCombatBuffs: {} };
        gameState = "BATTLE";
    `, context);
    return context;
}

function setMonster(context, monster) {
    context.__monster = monster;
    vm.runInContext(`activeMonster = __monster;`, context);
    delete context.__monster;
}

function act(context, count = 1) {
    for (let i = 0; i < count; i++) vm.runInContext("executeMonsterActionTick()", context);
}

function read(context, expression) {
    return vm.runInContext(expression, context);
}

// B61-69 should be a real roster, not the old blue-slime fallback.
assert.equal(read(createCombatContext(), "getMonstersForFloor(61).length"), 5);
assert.equal(read(createCombatContext(), "getMonstersForFloor(69).length"), 5);

// A normal enemy action is followed by a visible telegraph and a later skill hit.
{
    const context = createCombatContext();
    setMonster(context, {
        name: "測試因果織痕者", hp: 5000, maxHp: 5000, atk: 200, shield: 0,
        skill: { name: "先兆刻印", desc: "蓄力測試", interval: 1, kind: "hit", multiplier: 1.25, attackType: "magic" },
        enemySkillActionCount: 0, enemySkillPending: false
    });
    const hpBefore = read(context, "currentRun.hp");
    act(context);
    assert.equal(read(context, "currentRun.hp"), hpBefore - 200, "first normal action uses the base ATK");
    act(context);
    assert.equal(read(context, "currentRun.hp"), hpBefore - 200, "the telegraph action deals no damage");
    assert.equal(read(context, "activeMonster.enemySkillPending"), true);
    assert.ok(context.logs.some((message) => message.includes("敵方預告") && message.includes("先兆刻印")));
    assert.ok(context.cues.some((cue) => cue.name === "先兆刻印"), "telegraph uses the battle cast cue");
    act(context);
    assert.equal(read(context, "currentRun.hp"), hpBefore - 450, "the next enemy action resolves the 1.25x magic hit");
}

// Elite overrides are applied to the same skill without mutating its shared template.
{
    const context = createCombatContext();
    const templateSkill = {
        name: "倒因噬血", desc: "精英測試", interval: 1, kind: "hit", multiplier: 1.15,
        attackType: "physical", shieldRate: 0.25, shieldGainCap: 220,
        elite: { shieldRate: 0.3, shieldGainCap: 300 }
    };
    setMonster(context, {
        name: "精英逆果噬血蛭", hp: 9000, maxHp: 9000, atk: 200, shield: 0, isElite: true,
        skill: templateSkill, enemySkillActionCount: 0, enemySkillPending: false
    });
    act(context, 2); // one normal hit, then telegraph
    act(context); // empowered hit and elite shield gain
    assert.equal(read(context, "activeMonster.shield"), 69, "elite leech gains 30% of the 230 actual HP damage");
    assert.equal(templateSkill.shieldRate, 0.25, "elite override does not mutate shared template data");
}

// A bell's ward consumes its action and does not also hit the player.
{
    const context = createCombatContext();
    setMonster(context, {
        name: "未響因果鐘靈", hp: 8000, maxHp: 8000, atk: 100, shield: 0,
        skill: { name: "無聲結界", desc: "結界測試", interval: 1, kind: "shield", shieldAmount: 600, shieldCap: 1200 },
        enemySkillActionCount: 0, enemySkillPending: false
    });
    const hpBefore = read(context, "currentRun.hp");
    act(context, 2); // normal hit, telegraph
    act(context); // shield-only action
    assert.equal(read(context, "currentRun.hp"), hpBefore - 100, "ward action cannot deal a second hit");
    assert.equal(read(context, "activeMonster.shield"), 600);
    assert.ok(context.logs.some((message) => message.includes("無聲結界") && message.includes("不造成傷害")));
}

// B70 phase: the warning grants a breakable shield; breaking it cancels the strike.
{
    const context = createCombatContext();
    setMonster(context, {
        name: "歸因者・未竟之初", hp: 7000, maxHp: 14000, atk: 740, shield: 0,
        phaseSkill: { name: "因果回簿", desc: "階段測試", triggerAtHpRatio: 0.5, kind: "phase-hit", shieldAmount: 1200, multiplier: 1.2, attackType: "magic" },
        phaseSkillTriggered: false, phaseSkillPending: false
    });
    const hpBefore = read(context, "currentRun.hp");
    act(context);
    assert.equal(read(context, "activeMonster.shield"), 1200, "crossing 50% telegraphs and grants the phase shield");
    assert.equal(read(context, "currentRun.hp"), hpBefore, "phase wind-up deals no damage");
    read(context, "activeMonster.shield = 0"); // simulate the player breaking the shield during the window
    act(context);
    assert.equal(read(context, "currentRun.hp"), hpBefore, "a broken phase shield cancels the charged attack");
    assert.ok(context.logs.some((message) => message.includes("蓄力攻擊取消")));
}

// If the B70 shield survives, exactly one 1.2x magic hit resolves on the next action.
{
    const context = createCombatContext();
    setMonster(context, {
        name: "歸因者・未竟之初", hp: 7000, maxHp: 14000, atk: 740, shield: 0,
        phaseSkill: { name: "因果回簿", desc: "階段測試", triggerAtHpRatio: 0.5, kind: "phase-hit", shieldAmount: 1200, multiplier: 1.2, attackType: "magic" },
        phaseSkillTriggered: false, phaseSkillPending: false
    });
    act(context);
    act(context);
    assert.equal(read(context, "currentRun.hp"), 20000 - 888, "surviving the shield window resolves one 1.2x hit");
    assert.equal(read(context, "activeMonster.phaseSkillPending"), false);
}

console.log("Enemy skill regression passed: 61F-69F roster, telegraphs, elite modifiers, shield-only skill, and B70 breakable phase attack.");
