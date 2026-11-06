#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { TextEncoder } = require("node:util");

const repoRoot = path.resolve(__dirname, "..");

function createStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
        clear() { values.clear(); },
        values
    };
}

function createStateContext({ storage = createStorage(), fetch } = {}) {
    const messages = [];
    const window = {
        crypto: webcrypto,
        addEventListener() {},
        location: { reload() {} }
    };
    const context = {
        window,
        document: { getElementById() { return null; } },
        localStorage: storage,
        fetch: fetch || (async () => { throw new Error("offline"); }),
        AbortController,
        TextEncoder,
        Uint8Array,
        setTimeout,
        clearTimeout,
        Date,
        JSON,
        Math,
        console: { info() {}, warn() {}, error() {}, log() {} },
        showToast(message) { messages.push(message); }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "js/state.js"), "utf8"), context);
    return { context, storage, messages };
}

function createElement() {
    const listeners = new Map();
    return {
        style: {},
        innerHTML: "",
        innerText: "",
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 80 }; },
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(handler);
        },
        removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
        dispatch(type) {
            for (const handler of [...(listeners.get(type) || [])]) handler({ type, target: this });
        },
        listenerCount(type) { return listeners.get(type)?.size || 0; }
    };
}

function createGameContext() {
    const timers = new Map();
    const timerCallbacks = new Map();
    let nextTimerId = 1;
    const elements = new Map([
        "monster-status-card",
        "reward-panel-box",
        "reward-choices-container",
        "reward-title-text",
        "btn-main-action",
        "btn-rerun-action",
        "game-ending-overlay",
        "boss-victory-overlay",
        "victory-boss-name"
    ].map((id) => [id, createElement()]));
    const document = {
        readyState: "complete",
        getElementById(id) { return elements.get(id) || null; }
    };
    const context = {
        document,
        window: { innerWidth: 1000, innerHeight: 800 },
        clearInterval() {},
        setTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay });
            timerCallbacks.set(id, callback);
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        Math,
        console,
        clampVfxPercent(value, fallback) { return Number.isFinite(value) ? value : fallback; },
        clearVfxLayer() {},
        prefersReducedMotion() { return false; },
        spawnVfx() {},
        addLog() {},
        updateUI() {},
        saveGameData() {},
        resetCurrentRunData() {},
        switchVillageLocation() {}
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "js/game.js"), "utf8"), context);
    vm.runInContext(`
        accountMeta = {
            name: "QA",
            exp: 0,
            nextExp: 100000,
            lv: 1,
            gold: 0,
            maxFloor: 1,
            stats: {},
            warehouse: {},
            equipment: {},
            bossTalentBonuses: { maxHp: 0, spd: 0, critChance: 0 },
            claimedBossFloors: []
        };
        currentRun = {
            exp: 0,
            nextExp: 100000,
            lv: 1,
            gold: 0,
            maxHp: 100,
            hp: 100,
            maxMp: 50,
            mp: 50,
            inventory: [],
            skills: {}
        };
        gameState = "BATTLE";
        dungeonFloor = 10;
        activeMonster = { name: "QA Boss", hp: 0, maxHp: 100, isBoss: true };
    `, context);
    return { context, elements, timers, timerCallbacks };
}

async function testOfflinePinAndLocalSave() {
    const setup = createStateContext();
    const firstLogin = await vm.runInContext('initOrLoadPlayer("QA Player", "123456")', setup.context);
    assert.equal(firstLogin.success, true, "new offline account should be creatable");

    const save = JSON.parse(setup.storage.getItem("ABYSS_DESTINY_SAVE_QA Player"));
    assert.equal(Object.hasOwn(save, "pin"), false, "local account save must not contain the PIN");
    assert.equal(setup.storage.getItem("ABYSS_DESTINY_PIN_QA Player"), null, "reversible legacy PIN key must be removed");
    assert.ok(setup.storage.getItem("ABYSS_DESTINY_PIN_HASH_QA Player"), "salted PIN verifier should be stored");

    const wrongPin = await vm.runInContext('initOrLoadPlayer("QA Player", "000000")', setup.context);
    assert.equal(wrongPin.success, false, "wrong offline PIN must be rejected");

    const validPin = await vm.runInContext('initOrLoadPlayer("QA Player", "123456")', setup.context);
    assert.equal(validPin.success, true, "correct offline PIN should load the local account");
}

async function testCloudHttpFailureAndPayload() {
    let requestPayload;
    const setup = createStateContext({
        fetch: async (url, options) => {
            if (url.endsWith("/api/auth/login")) {
                return { ok: true, async json() { return { success: true, isNewUser: false, activeChar: { name: "QA", lv: 1 } }; } };
            }
            requestPayload = JSON.parse(options.body);
            return { ok: false, status: 500 };
        }
    });
    const result = await vm.runInContext('initOrLoadPlayer("QA", "123456")', setup.context);
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(result.success, true, "local gameplay should continue after cloud save failure");
    assert.equal(Object.hasOwn(requestPayload.activeChar, "pin"), false, "cloud character snapshot must not duplicate the PIN");
    assert.ok(setup.messages.some((message) => message.includes("雲端存檔失敗")), "HTTP 500 should show a visible save warning");
}

function testBossRewardAndFinale() {
    const { context, elements } = createGameContext();
    vm.runInContext("executeDungeonVictorySequence()", context);
    const firstReward = JSON.parse(vm.runInContext("JSON.stringify(accountMeta.bossTalentBonuses)", context));
    assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(accountMeta.claimedBossFloors)", context)), [10]);

    vm.runInContext(`
        gameState = "BATTLE";
        activeMonster = { name: "QA Boss", hp: 0, maxHp: 100, isBoss: true };
        executeDungeonVictorySequence();
    `, context);
    assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(accountMeta.bossTalentBonuses)", context)), firstReward);
    assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(accountMeta.claimedBossFloors)", context)), [10]);

    vm.runInContext(`
        gameState = "BATTLE";
        dungeonFloor = 60;
        activeMonster = { name: "終焉星神", hp: 0, maxHp: 100, isBoss: true };
        executeDungeonVictorySequence();
    `, context);
    assert.equal(vm.runInContext("gameState", context), "ENCOUNTER_RESOLVED", "B60 victory must allow progression into the newly playable post-end floors");
    assert.notEqual(vm.runInContext("accountMeta.campaignCleared", context), true, "campaign completion is deferred until the new B70 finale");
    assert.notEqual(elements.get("game-ending-overlay").style.display, "flex", "B60 should not show the campaign ending modal");

    vm.runInContext(`
        gameState = "BATTLE";
        dungeonFloor = 70;
        activeMonster = { name: "歸因者・未竟之初", hp: 0, maxHp: 100, isBoss: true };
        executeDungeonVictorySequence();
    `, context);
    assert.equal(vm.runInContext("gameState", context), "ENDING", "B70 victory should enter the terminal campaign ending state");
    assert.equal(vm.runInContext("accountMeta.campaignCleared", context), true, "B70 campaign completion should be persisted");
    assert.equal(elements.get("game-ending-overlay").style.display, "flex", "B70 should show the ending modal");

    vm.runInContext("closeCampaignEndingModal()", context);
    assert.equal(vm.runInContext("gameState", context), "VILLAGE", "ending action should return safely to the village");
}

function getTimerIdByDelay(timers, delay) {
    const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `expected an active ${delay}ms timer`);
    return entry[0];
}

function runTimer(timers, id) {
    const timer = timers.get(id);
    assert.ok(timer, `expected timer ${id} to still be active`);
    timers.delete(id);
    timer.callback();
}

function testBossVictoryModalLifecycle() {
    const { context, elements, timers, timerCallbacks } = createGameContext();
    const overlay = elements.get("boss-victory-overlay");

    vm.runInContext('triggerBossVictoryModal("第一位領主")', context);
    const firstUnlockTimer = getTimerIdByDelay(timers, 800);
    const firstAutoCloseTimer = getTimerIdByDelay(timers, 5000);
    const staleUnlockCallback = timerCallbacks.get(firstUnlockTimer);
    const staleAutoCloseCallback = timerCallbacks.get(firstAutoCloseTimer);
    assert.equal(overlay.style.display, "flex", "opening the boss victory modal should show it");
    assert.equal(overlay.attributes["aria-hidden"], "false", "opening the boss victory modal should expose it to assistive technology");

    runTimer(timers, firstUnlockTimer);
    assert.equal(overlay.listenerCount("click"), 1, "manual dismissal should unlock after the intro delay");
    overlay.dispatch("click");
    assert.equal(overlay.style.display, "none", "manual dismissal should hide the current modal");
    assert.equal(overlay.attributes["aria-hidden"], "true", "manual dismissal should hide the modal from assistive technology");
    assert.equal(overlay.listenerCount("click"), 0, "manual dismissal should remove the click handler");
    assert.equal(timers.has(firstAutoCloseTimer), false, "manual dismissal should cancel its auto-close timer");

    vm.runInContext('triggerBossVictoryModal("第二位領主")', context);
    assert.equal(overlay.style.display, "flex", "a later victory should open a fresh modal");
    assert.equal(overlay.attributes["aria-hidden"], "false", "reopening should restore the visible accessibility state");
    assert.equal(elements.get("victory-boss-name").innerText, "第二位領主");

    staleUnlockCallback();
    assert.equal(overlay.listenerCount("click"), 0, "a stale unlock callback must not unlock a newer modal early");
    overlay.dispatch("click");
    assert.equal(overlay.style.display, "flex", "the newer modal must remain open before its own unlock delay");

    staleAutoCloseCallback();
    assert.equal(overlay.style.display, "flex", "a stale auto-close callback must not close a newer modal");
    assert.equal(overlay.attributes["aria-hidden"], "false", "a stale callback must not change the newer modal accessibility state");

    const secondUnlockTimer = getTimerIdByDelay(timers, 800);
    runTimer(timers, secondUnlockTimer);
    overlay.dispatch("click");
    assert.equal(overlay.style.display, "none", "the newer modal should still close through its own click handler");
    assert.equal(overlay.attributes["aria-hidden"], "true", "closing the newer modal should synchronize aria-hidden");

    const autoClosed = createGameContext();
    const autoOverlay = autoClosed.elements.get("boss-victory-overlay");
    vm.runInContext('triggerBossVictoryModal("自動關閉測試")', autoClosed.context);
    runTimer(autoClosed.timers, getTimerIdByDelay(autoClosed.timers, 5000));
    assert.equal(autoOverlay.style.display, "none", "the current auto-close timer should hide its modal");
    assert.equal(autoOverlay.attributes["aria-hidden"], "true", "auto-close should synchronize aria-hidden");
}

function testVillageCleanupAfterDefeatAndRetreat() {
    const defeated = createGameContext();
    vm.runInContext(`
        gameState = "BATTLE";
        dungeonFloor = 8;
        activeMonster = { name: "殘留魔物", hp: 42, maxHp: 42 };
        currentRun.hp = 0;
        executeDungeonDefeatSequence();
    `, defeated.context);
    assert.equal(vm.runInContext("gameState", defeated.context), "VILLAGE", "defeat returns the player to the village");
    assert.equal(vm.runInContext("activeMonster", defeated.context), null, "defeat clears the stale monster object");
    assert.equal(vm.runInContext("dungeonFloor", defeated.context), 0, "defeat resets the next dungeon entry to B1F");

    const retreated = createGameContext();
    vm.runInContext(`
        gameState = "SELECT_ROUTE";
        dungeonFloor = 8;
        activeMonster = { name: "撤退殘留魔物", hp: 42, maxHp: 42 };
        handleSecondaryAction();
    `, retreated.context);
    assert.equal(vm.runInContext("activeMonster", retreated.context), null, "retreat clears the stale monster object");
    assert.equal(vm.runInContext("dungeonFloor", retreated.context), 0, "retreat resets the next dungeon entry to B1F");
}

(async () => {
    await testOfflinePinAndLocalSave();
    await testCloudHttpFailureAndPayload();
    testBossRewardAndFinale();
    testBossVictoryModalLifecycle();
    testVillageCleanupAfterDefeatAndRetreat();
    console.log("✅ Critical progression, offline PIN, cloud-save failure, and ending tests passed.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
