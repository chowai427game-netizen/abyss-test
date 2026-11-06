#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");
const transitionUi = ui.match(/let battleSceneLogLines = \[\];[\s\S]*?(?=\nconst BATTLE_MONSTER_PORTRAIT_OVERRIDES)/);
assert.ok(transitionUi, "encounter transition UI lifecycle exists");

function createClassList() {
    const classes = new Set();
    return {
        add(value) { classes.add(value); },
        remove(value) { classes.delete(value); },
        contains(value) { return classes.has(value); }
    };
}

function createHarness({ transitionAvailable = true } = {}) {
    let nextTimerId = 0;
    const timers = new Map();
    const handles = [];
    let transitionArgs = null;
    let reduceMotion = false;
    const diaryElements = [0, 1].map(() => ({
        textContent: "",
        dataset: {},
        className: "",
        classList: createClassList()
    }));

    const originalParent = {
        children: [],
        insertBefore(element, reference) {
            if (element.parentNode?.children) {
                const oldIndex = element.parentNode.children.indexOf(element);
                if (oldIndex >= 0) element.parentNode.children.splice(oldIndex, 1);
            }
            const index = reference ? this.children.indexOf(reference) : -1;
            this.children.splice(index < 0 ? this.children.length : index, 0, element);
            element.parentNode = this;
            return element;
        },
        removeChild(element) {
            const index = this.children.indexOf(element);
            if (index >= 0) this.children.splice(index, 1);
            element.parentNode = null;
            return element;
        }
    };
    const body = {
        classList: createClassList(),
        children: [],
        appendChild(element) {
            if (element.parentNode?.children) {
                const oldIndex = element.parentNode.children.indexOf(element);
                if (oldIndex >= 0) element.parentNode.children.splice(oldIndex, 1);
            }
            this.children.push(element);
            element.parentNode = this;
            return element;
        }
    };
    const styleProperties = new Map();
    const scene = {
        parentNode: originalParent,
        classList: createClassList(),
        style: {
            setProperty(name, value) { styleProperties.set(name, value); },
            removeProperty(name) { styleProperties.delete(name); }
        },
        getBoundingClientRect() { return { top: 20, left: 12, width: 420, height: 264 }; }
    };
    originalParent.children.push(scene);

    const transitionApi = {
        options: { speed: 0.5, palette: "smoke", color: "#0b0a10", seed: 2 },
        create(args) {
            transitionArgs = args;
            let resolveFinished;
            const handle = {
                started: false,
                cancelled: false,
                finished: new Promise((resolve) => { resolveFinished = resolve; }),
                start() {
                    this.started = true;
                    return true;
                },
                cancel() {
                    this.cancelled = true;
                    resolveFinished(false);
                    return true;
                },
                resolveFinished
            };
            handles.push(handle);
            return handle;
        }
    };

    const sandbox = {
        DOM: { get(id) {
            if (id === "battle-scene-box") return scene;
            if (id === "battle-scene-log-line-1") return diaryElements[0];
            if (id === "battle-scene-log-line-2") return diaryElements[1];
            return null;
        } },
        document: {
            body,
            createElement(tag) {
                assert.equal(tag, "div");
                return {
                    parentNode: null,
                    style: {},
                    setAttribute() {},
                    remove() { this.parentNode?.removeChild(this); }
                };
            }
        },
        window: transitionAvailable ? { PixelFxEncounterTransition: transitionApi } : {},
        gameState: "BATTLE",
        getComputedStyle() { return { margin: "0px", gridColumn: "auto", gridRow: "auto", alignSelf: "auto", justifySelf: "auto" }; },
        prefersReducedMotion() { return reduceMotion; },
        setReducedMotion(value) { reduceMotion = Boolean(value); },
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        setInterval() { return ++nextTimerId; },
        clearInterval() {},
        Promise
    };
    vm.createContext(sandbox);
    vm.runInContext(`${transitionUi[0]}\nthis.playIntro = playBattleSceneEncounterIntro;\nthis.restoreIntro = restoreBattleSceneAfterEncounterIntro;\nthis.syncDiary = syncBattleSceneLog;\nthis.getDiary = () => battleSceneLogLines;\nthis.getPinnedEncounter = () => battleSceneEncounterLogEntry;\nthis.transitionIsActive = () => Boolean(battleSceneShatterTransition);`, sandbox);

    return {
        sandbox,
        scene,
        body,
        originalParent,
        diaryElements,
        handles,
        timers,
        getTransitionArgs: () => transitionArgs,
        runTimer(delay) {
            const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
            assert.ok(entry, `the ${delay} ms timer is scheduled`);
            timers.delete(entry[0]);
            entry[1].callback();
        }
    };
}

(async () => {
    const harness = createHarness();
    const introReady = harness.sandbox.playIntro();
    assert.equal(typeof introReady?.then, "function", "the encounter intro returns a readiness promise");
    assert.equal(harness.scene.classList.contains("is-encounter-reveal-held"), true, "the monster is hidden during the zoom and wipe setup");
    assert.equal(harness.getTransitionArgs().container, harness.scene, "the wipe is confined to the battle scene");
    assert.equal(harness.getTransitionArgs().speed, 0.5);
    assert.equal(harness.getTransitionArgs().palette, "smoke");
    assert.equal(harness.handles[0].started, false, "the wipe waits until the scene zoom finishes");

    harness.runTimer(420);
    assert.equal(harness.handles[0].started, true, "the wipe starts after the 420 ms encounter zoom");
    harness.getTransitionArgs().onCovered();
    assert.equal(harness.scene.classList.contains("is-encounter-reveal-held"), false, "the monster is released at the opaque pane callback");
    let introResolved = false;
    introReady.then(() => { introResolved = true; });
    await Promise.resolve();
    assert.equal(introResolved, false, "the encounter gate stays closed while the pane is covered and waiting to burst");
    harness.getTransitionArgs().onBurst();
    assert.equal(await introReady, true, "the encounter gate opens at the burst callback");
    assert.equal(harness.sandbox.transitionIsActive(), true, "the visual transition continues after combat begins");
    harness.sandbox.setReducedMotion(true);
    harness.sandbox.syncDiary("⚔️【降臨 B5F】發現魔物：<strong>💧 藍色史萊姆</strong>");
    assert.equal(harness.sandbox.getDiary().length, 1, "the encounter diary is added when the burst has revealed the monster");
    assert.equal(harness.handles[0].cancelled, false, "adding the encounter diary does not cancel the active Shatter Wipe");
    harness.handles[0].resolveFinished(true);
    await Promise.resolve();
    assert.equal(harness.sandbox.transitionIsActive(), false, "the transition handle is cleared when the remaining shards finish");
    assert.ok([...harness.timers.values()].some((timer) => timer.delay === 1000), "the discovery line gets a one-second hold after Shatter completes");
    harness.sandbox.syncDiary("⚔️ 玩家施放技能！");
    harness.sandbox.syncDiary("✨ 技能命中魔物");
    assert.match(harness.diaryElements[0].textContent, /發現魔物/, "the encounter discovery stays in the first line during its hold");
    assert.match(harness.diaryElements[1].textContent, /技能命中魔物/, "new combat messages remain visible on the second line");
    harness.runTimer(1000);
    assert.equal(harness.sandbox.getPinnedEncounter(), null, "the discovery pin clears after one second");
    assert.match(harness.diaryElements[0].textContent, /玩家施放技能/, "the diary returns to recent combat messages after the hold expires");

    harness.sandbox.setReducedMotion(false);
    const cancelledIntro = harness.sandbox.playIntro();
    assert.equal(harness.scene.classList.contains("is-encounter-reveal-held"), true, "a second encounter holds the portrait again");
    harness.sandbox.restoreIntro();
    assert.equal(await cancelledIntro, false, "restoring the scene cancels and resolves the pending intro gate");
    assert.equal(harness.handles[1].cancelled, true, "restoring cancels the active transition handle");
    assert.equal(harness.scene.classList.contains("is-encounter-reveal-held"), false, "cancelled intros cannot leave the monster hidden");
    assert.equal(harness.timers.size, 0, "cancelled intros clear their delayed start timer");
    assert.equal(harness.scene.parentNode, harness.originalParent, "the scene returns to its original layout container");

    const fallbackHarness = createHarness({ transitionAvailable: false });
    assert.equal(fallbackHarness.sandbox.playIntro(), 420, "missing PixelFX uses the bounded zoom fallback");
    assert.equal(fallbackHarness.scene.classList.contains("is-encounter-cinematic"), true);
    fallbackHarness.sandbox.syncDiary("發現魔物：💧 藍色史萊姆");
    assert.equal(fallbackHarness.scene.classList.contains("is-encounter-cinematic"), true, "the delayed diary does not cancel the fallback zoom");
    assert.ok(fallbackHarness.sandbox.getPinnedEncounter(), "the zoom-only fallback also pins the encounter diary");
    fallbackHarness.sandbox.restoreIntro();

    console.log("Battle encounter UI transition tests passed: zoom, opaque portrait reveal, burst-time gate, post-Shatter one-second diary hold, fallback zoom, and cancellation cleanup.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
