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
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "state.js"), "utf8"), context);
    return { context, storage, messages };
}

function createElement() {
    return {
        style: {},
        innerHTML: "",
        innerText: "",
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 80 }; },
        addEventListener() {},
        removeEventListener() {}
    };
}

function createGameContext() {
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
        setTimeout() { return 1; },
        clearTimeout() {},
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
    vm.runInContext(fs.readFileSync(path.join(repoRoot, "game.js"), "utf8"), context);
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
    return { context, elements };
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
    assert.equal(vm.runInContext("gameState", context), "ENDING", "B60 victory should enter a terminal ending state");
    assert.equal(vm.runInContext("accountMeta.campaignCleared", context), true, "campaign completion should be persisted");
    assert.equal(elements.get("game-ending-overlay").style.display, "flex", "B60 should show the ending modal");

    vm.runInContext("closeCampaignEndingModal()", context);
    assert.equal(vm.runInContext("gameState", context), "VILLAGE", "ending action should return safely to the village");
}

(async () => {
    await testOfflinePinAndLocalSave();
    await testCloudHttpFailureAndPayload();
    testBossRewardAndFinale();
    console.log("✅ Critical progression, offline PIN, cloud-save failure, and ending tests passed.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
