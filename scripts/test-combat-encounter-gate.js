#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gameSource = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const combatFunction = gameSource.match(/function startNodeCombat\(nodeType\) \{[\s\S]*?\n\}\n\n(?=\/\/ -{10,})/);
assert.ok(combatFunction, "the production startNodeCombat function is available for the gate test");

function createHarness({ introSignal, portraitSignal, backgroundSignal = Promise.resolve(true) }) {
    const calls = [];
    const timers = [];
    const elements = new Map();
    let sceneVisible = false;
    let nextTimerId = 0;
    const sandbox = {
        activeMonster: null,
        activeTactic: "AUTO",
        combatEncounterGeneration: 0,
        combatIntroStartTimer: null,
        combatEncounterCooldownPending: false,
        combatPaused: false,
        currentEnvironment: "NORMAL",
        currentRun: { hp: 100, maxHp: 100, mp: 50, tactic: "AUTO" },
        dungeonFloor: 5,
        envAtb: 0,
        gameState: "BATTLE",
        monsterAtb: 0,
        pendingCombatItem: null,
        playerAtb: 0,
        battleTimeElapsed: 0,
        BOSS_DATABASE: {},
        document: {
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, { style: {}, className: "", innerText: "" });
                return elements.get(id);
            }
        },
        stopCombatTicker() { calls.push({ type: "stop-ticker" }); },
        clearVfxLayer() {},
        clearBattleTransientEffects() {},
        getEnvironmentConfig() { return { id: "NORMAL", className: "env-zone-normal", logText: "stable" }; },
        spawnMonsterForFloor() {
            return { name: "💧 藍色史萊姆", maxHp: 40, atk: 8, def: 2, mdef: 1, spd: 9, dropItem: "史萊姆黏液" };
        },
        normalizeTacticMode(value) { return value || "AUTO"; },
        syncTacticButtonsUi() {},
        syncCombatPauseUi() {},
        updateUI() { sceneVisible = true; calls.push({ type: "update-ui" }); },
        waitForBattleSceneBackgroundReady(environmentKey) {
            calls.push({ type: "background-ready", environmentKey });
            return backgroundSignal;
        },
        playBattleSceneEncounterIntro() {
            calls.push({ type: "intro", sceneVisible });
            return introSignal;
        },
        waitForBattleMonsterPortraitReady() { return portraitSignal; },
        addLog(message, logType = "deal") { calls.push({ type: "log", message: String(message), logType }); },
        scheduleVfx(callback) { calls.push({ type: "schedule-vfx" }); callback(); },
        spawnVfx() { calls.push({ type: "spawn-vfx" }); },
        prefersReducedMotion() { return false; },
        startCombatTicker() { calls.push({ type: "ticker" }); },
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.push({ id, callback, delay });
            return id;
        },
        clearTimeout(id) {
            const index = timers.findIndex((timer) => timer.id === id);
            if (index >= 0) timers.splice(index, 1);
        },
        clearInterval() {}
    };

    vm.createContext(sandbox);
    vm.runInContext(`${combatFunction[0]}\nthis.runCombat = startNodeCombat;`, sandbox);
    return {
        sandbox,
        calls,
        timers,
        runCombat: (nodeType = "NORMAL") => sandbox.runCombat(nodeType),
        fireTimer(delay) {
            const index = timers.findIndex((timer) => timer.delay === delay);
            assert.notEqual(index, -1, `an intro timer with delay ${delay} ms is scheduled`);
            const [timer] = timers.splice(index, 1);
            timer.callback();
        }
    };
}

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));
const countCalls = (calls, type) => calls.filter((call) => call.type === type).length;

(async () => {
    let resolveBackground;
    const backgroundSignal = new Promise((resolve) => { resolveBackground = resolve; });
    let resolveBurst;
    const burstSignal = new Promise((resolve) => { resolveBurst = resolve; });
    let resolvePortrait;
    const portraitSignal = new Promise((resolve) => { resolvePortrait = resolve; });
    const burstHarness = createHarness({ introSignal: burstSignal, portraitSignal, backgroundSignal });

    burstHarness.runCombat();
    assert.equal(burstHarness.calls.find((call) => call.type === "background-ready").environmentKey, "NORMAL", "the chosen environment background is requested for the encounter");
    assert.equal(countCalls(burstHarness.calls, "intro"), 0, "cinematic does not measure the scene before the background is ready");
    assert.equal(countCalls(burstHarness.calls, "log"), 0, "the monster name is not logged while the wipe is closing");
    assert.equal(countCalls(burstHarness.calls, "ticker"), 0, "combat ATB stays stopped before the burst");
    assert.equal(burstHarness.sandbox.combatEncounterCooldownPending, true, "the encounter remains gated during the transition");

    resolveBackground(true);
    await flushMicrotasks();
    assert.equal(burstHarness.calls.find((call) => call.type === "intro").sceneVisible, true, "UI reveals the initially hidden scene only after its background is ready");
    assert.ok(burstHarness.calls.findIndex((call) => call.type === "update-ui" && burstHarness.calls.indexOf(call) > 0) < burstHarness.calls.findIndex((call) => call.type === "intro"), "the ready battle scene is rendered before the cinematic starts");
    assert.equal(countCalls(burstHarness.calls, "log"), 0, "the monster name remains hidden while the background-ready scene enters the wipe");

    resolveBurst(true);
    await flushMicrotasks();
    assert.equal(countCalls(burstHarness.calls, "log"), 0, "the encounter waits for the portrait even after the burst signal");
    assert.equal(countCalls(burstHarness.calls, "ticker"), 0, "combat cannot start before its portrait is ready");

    resolvePortrait(true);
    await flushMicrotasks();
    assert.equal(countCalls(burstHarness.calls, "log"), 1, "the encounter diary is revealed after burst and portrait readiness");
    assert.match(burstHarness.calls.find((call) => call.type === "log").message, /藍色史萊姆/);
    assert.equal(countCalls(burstHarness.calls, "ticker"), 1, "combat ATB starts once after the reveal gates open");
    assert.equal(burstHarness.sandbox.combatEncounterCooldownPending, false);

    const fallbackHarness = createHarness({ introSignal: 420, portraitSignal: Promise.resolve(true) });
    fallbackHarness.runCombat();
    await flushMicrotasks();
    assert.equal(countCalls(fallbackHarness.calls, "log"), 0, "numeric fallback also delays the encounter diary");
    assert.equal(countCalls(fallbackHarness.calls, "ticker"), 0);
    fallbackHarness.fireTimer(420);
    await flushMicrotasks();
    assert.equal(countCalls(fallbackHarness.calls, "log"), 1, "numeric fallback reveals the encounter after its zoom delay");
    assert.equal(countCalls(fallbackHarness.calls, "ticker"), 1, "numeric fallback starts combat after the delay and portrait gate");

    console.log("Combat encounter gate tests passed: the selected background loads before cinematic measurement; diary and ATB wait for burst plus portrait readiness; 420 ms fallback remains functional.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
