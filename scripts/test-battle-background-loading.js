#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const uiSource = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");
const stateSource = fs.readFileSync(path.join(root, "js/state.js"), "utf8");
const gameSource = fs.readFileSync(path.join(root, "js/game.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "css/12-combat-scene.css"), "utf8");
const backgroundHelpersStart = uiSource.indexOf("const BATTLE_SCENE_BACKGROUND_PATHS = Object.freeze(");
const backgroundHelpersEnd = uiSource.indexOf("function updateBattleScene(monster)", backgroundHelpersStart);
assert.ok(backgroundHelpersStart >= 0 && backgroundHelpersEnd > backgroundHelpersStart, "production background loader helpers are present");
const backgroundHelpers = uiSource.slice(backgroundHelpersStart, backgroundHelpersEnd);
const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

function createClassList() {
    const values = new Set();
    return {
        values,
        add(name) { values.add(name); },
        remove(name) { values.delete(name); },
        toggle(name, force) {
            if (force === undefined ? !values.has(name) : force) values.add(name);
            else values.delete(name);
        },
        contains(name) { return values.has(name); }
    };
}

function createBackgroundHarness() {
    const images = [];
    const timeouts = new Map();
    let nextTimeoutId = 0;
    const scene = { classList: createClassList() };
    class FakeImage {
        constructor() {
            this.complete = false;
            this.naturalWidth = 0;
            this.onload = null;
            this.onerror = null;
            images.push(this);
        }
        set src(value) { this._src = value; }
        get src() { return this._src; }
        decode() {
            return new Promise((resolve, reject) => {
                this.resolveDecode = resolve;
                this.rejectDecode = reject;
            });
        }
    }
    const sandbox = {
        Image: FakeImage,
        DOM: { get(id) { return id === "battle-scene-box" ? scene : null; } },
        currentEnvironment: "NORMAL",
        setTimeout(callback, delay) {
            const id = ++nextTimeoutId;
            timeouts.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) { timeouts.delete(id); }
    };
    vm.createContext(sandbox);
    vm.runInContext(`${backgroundHelpers}\nthis.backgroundPaths = BATTLE_SCENE_BACKGROUND_PATHS; this.waitBackground = waitForBattleSceneBackgroundReady; this.backgroundLoaded = battleSceneBackgroundLoaded; this.backgroundFailed = battleSceneBackgroundFailed;`, sandbox);
    return { sandbox, images, timeouts, scene };
}

function createLoadingHarness(backgroundPromise) {
    const timers = new Map();
    const overlayClasses = createClassList();
    const barClasses = createClassList();
    const elements = new Map([
        ["loading-overlay", { classList: overlayClasses, style: {} }],
        ["loading-bar-fill", { classList: barClasses }],
        ["loading-flavor-text", { innerText: "" }],
        ["player-name-input", null]
    ]);
    let domReadyHandler = null;
    let nextTimerId = 0;
    const context = {
        window: { addEventListener(event, handler) { if (event === "DOMContentLoaded") domReadyHandler = handler; } },
        document: { getElementById(id) { return elements.get(id) || null; } },
        localStorage: { getItem() { return null; } },
        SERVER_URL: "https://render.example.test",
        fetch: async () => ({ ok: true }),
        AbortController,
        Promise,
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        waitForBattleSceneBackgroundReady() { return backgroundPromise; },
        checkPlayerNameLive() {}
    };
    vm.createContext(context);
    vm.runInContext(stateSource, context);
    return { context, elements, timers, overlayClasses, barClasses, getHandler: () => domReadyHandler };
}

async function testZoneBackgroundWaitsForDecode() {
    const harness = createBackgroundHarness();
    assert.equal(harness.sandbox.backgroundPaths.NORMAL, "assets/combat/battle-ruins-bg.png");
    assert.equal(harness.sandbox.backgroundPaths.VOID, "assets/combat/battle-void-bg.png");
    assert.equal(harness.sandbox.backgroundPaths.ICE, "assets/combat/battle-ice-bg.png");
    assert.equal(harness.sandbox.backgroundPaths.FIRE, "assets/combat/battle-fire-bg.png");
    assert.equal(harness.sandbox.backgroundPaths.POISON, "assets/combat/battle-poison-bg.png");
    for (const assetPath of Object.values(harness.sandbox.backgroundPaths)) {
        const asset = fs.readFileSync(path.join(root, assetPath));
        assert.ok(asset.length > 0, `${assetPath} exists and is non-empty`);
    }

    harness.sandbox.currentEnvironment = "ICE";
    let settled = false;
    const ready = harness.sandbox.waitBackground("ICE").then((value) => { settled = true; return value; });
    assert.equal(harness.images.length, 1, "selected-zone background starts one image request");
    assert.equal(harness.images[0].src, "assets/combat/battle-ice-bg.png");
    assert.equal(settled, false, "battle background gate remains closed before image load/decode");

    harness.images[0].naturalWidth = 1024;
    harness.images[0].complete = true;
    harness.images[0].onload();
    await flushMicrotasks();
    assert.equal(settled, false, "load event alone does not release the gate while decode is pending");
    harness.images[0].resolveDecode();
    assert.equal(await ready, true, "decoded selected-zone background releases the gate");
    assert.equal(harness.sandbox.backgroundLoaded.has("ICE"), true);
    assert.equal(harness.scene.classList.contains("is-background-fallback"), false);
}

async function testDecodeFailureUsesStableFallbackAndNoRetryLoop() {
    const harness = createBackgroundHarness();
    harness.sandbox.currentEnvironment = "POISON";
    const ready = harness.sandbox.waitBackground("POISON");
    const image = harness.images[0];
    image.onerror();
    assert.equal(await ready, false, "background request failure is explicitly reported as fallback mode");
    assert.equal(harness.sandbox.backgroundFailed.has("POISON"), true);
    assert.equal(harness.scene.classList.contains("is-background-fallback"), true);
    assert.equal(await harness.sandbox.waitBackground("POISON"), false, "failed asset remains on safe fallback instead of retrying on every UI update");
    assert.equal(harness.images.length, 1, "failed background does not create an unbounded request loop");

    assert.match(cssSource, /\.battle-scene\.is-background-fallback\s*\{[\s\S]*?background-color:\s*#101814;[\s\S]*?linear-gradient/);

    const decodeHarness = createBackgroundHarness();
    decodeHarness.sandbox.currentEnvironment = "FIRE";
    const decodeReady = decodeHarness.sandbox.waitBackground("FIRE");
    const decodeImage = decodeHarness.images[0];
    decodeImage.naturalWidth = 1024;
    decodeImage.complete = true;
    decodeImage.onload();
    decodeImage.rejectDecode(new Error("decode failed"));
    assert.equal(await decodeReady, false, "a rejected browser decode resolves to the safe background fallback");
    assert.equal(decodeHarness.scene.classList.contains("is-background-fallback"), true);
}

async function testTimeoutIgnoresLateDecode() {
    const harness = createBackgroundHarness();
    const ready = harness.sandbox.waitBackground("VOID");
    const image = harness.images[0];
    const timeout = [...harness.timeouts.values()].find((timer) => timer.delay === 5000);
    assert.ok(timeout, "background load has a bounded five-second timeout");
    timeout.callback();
    assert.equal(await ready, false, "timed-out background resolves to the stable fallback");

    image.naturalWidth = 1024;
    image.complete = true;
    image.onload?.();
    image.resolveDecode?.();
    await flushMicrotasks();
    assert.equal(harness.sandbox.backgroundLoaded.has("VOID"), false, "late load/decode cannot overwrite the timeout fallback");
    assert.equal(harness.sandbox.backgroundFailed.has("VOID"), true);
}

async function testInitialOverlayWaitsForBackgroundAfterRenderHealth() {
    let resolveBackground;
    const backgroundPromise = new Promise((resolve) => { resolveBackground = resolve; });
    const harness = createLoadingHarness(backgroundPromise);
    const initPromise = harness.getHandler()();
    await flushMicrotasks();
    assert.equal([...harness.timers.values()].some((timer) => timer.delay === 600), false, "successful Render health check alone does not schedule the initial overlay dismissal");
    assert.equal(harness.barClasses.contains("complete"), false, "loading bar waits for the local battle background gate too");

    resolveBackground(true);
    await initPromise;
    assert.equal(harness.barClasses.contains("complete"), true, "loading bar completes after Render and initial battle background are ready");
    assert.equal([...harness.timers.values()].some((timer) => timer.delay === 600), true, "overlay dismissal starts only after both readiness gates settle");

    const failedHarness = createLoadingHarness(Promise.resolve(false));
    await failedHarness.getHandler()();
    assert.match(failedHarness.elements.get("loading-flavor-text").innerText, /安全底色/,
        "background failure explains the stable fallback instead of holding the startup overlay forever");
    assert.equal([...failedHarness.timers.values()].some((timer) => timer.delay === 600), true,
        "the overlay can finish after the background timeout/failure falls back safely");
}

function testEncounterIntroWaitsForSelectedBackground() {
    assert.match(gameSource, /const backgroundSignal = typeof waitForBattleSceneBackgroundReady === "function"[\s\S]*?const startEncounterIntro = \(\) =>[\s\S]*?const beginEncounterIntro = \(\) =>[\s\S]*?Promise\.resolve\(backgroundSignal\)\.catch\(\(\) => false\)\.then\(beginEncounterIntro\)/,
        "encounter transition waits for the selected region background before starting its cinematic");
    assert.match(uiSource, /const backgroundSettled = battleSceneBackgroundLoaded\.has\(environmentKey\) \|\| battleSceneBackgroundFailed\.has\(environmentKey\);[\s\S]*?scene\.style\.display = showScene && backgroundSettled \? "block" : "none"/,
        "battle scene remains hidden until the selected background is decoded or safely falls back");
}

(async () => {
    await testZoneBackgroundWaitsForDecode();
    await testDecodeFailureUsesStableFallbackAndNoRetryLoop();
    await testTimeoutIgnoresLateDecode();
    await testInitialOverlayWaitsForBackgroundAfterRenderHealth();
    testEncounterIntroWaitsForSelectedBackground();
    console.log("Battle background cold-load tests passed: zone decode gate, safe fallback, bounded timeout, late-callback protection, and initial overlay readiness.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
