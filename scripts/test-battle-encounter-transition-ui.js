#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "js/ui.js"), "utf8");
const transitionUi = ui.match(/let battleSceneLogLines = \[\];[\s\S]*?(?=\nfunction getBattleDiaryTone)/);
assert.ok(transitionUi, "encounter transition UI lifecycle exists");

function createClassList() {
    const classes = new Set();
    return {
        add(value) { classes.add(value); },
        remove(value) { classes.delete(value); },
        contains(value) { return classes.has(value); }
    };
}

function createHarness() {
    let nextTimerId = 0;
    const timers = new Map();
    const handles = [];
    let transitionArgs = null;

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
        DOM: { get(id) { return id === "battle-scene-box" ? scene : null; } },
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
        window: { PixelFxEncounterTransition: transitionApi },
        getComputedStyle() { return { margin: "0px", gridColumn: "auto", gridRow: "auto", alignSelf: "auto", justifySelf: "auto" }; },
        prefersReducedMotion() { return false; },
        setTimeout(callback, delay) {
            const id = ++nextTimerId;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        Promise
    };
    vm.createContext(sandbox);
    vm.runInContext(`${transitionUi[0]}\nthis.playIntro = playBattleSceneEncounterIntro;\nthis.restoreIntro = restoreBattleSceneAfterEncounterIntro;`, sandbox);

    return {
        sandbox,
        scene,
        body,
        originalParent,
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
    harness.handles[0].resolveFinished(true);
    assert.equal(await introReady, true, "the encounter gate opens when the transition completes");

    const cancelledIntro = harness.sandbox.playIntro();
    assert.equal(harness.scene.classList.contains("is-encounter-reveal-held"), true, "a second encounter holds the portrait again");
    harness.sandbox.restoreIntro();
    assert.equal(await cancelledIntro, false, "restoring the scene cancels and resolves the pending intro gate");
    assert.equal(harness.handles[1].cancelled, true, "restoring cancels the active transition handle");
    assert.equal(harness.scene.classList.contains("is-encounter-reveal-held"), false, "cancelled intros cannot leave the monster hidden");
    assert.equal(harness.timers.size, 0, "cancelled intros clear their delayed start timer");
    assert.equal(harness.scene.parentNode, harness.originalParent, "the scene returns to its original layout container");

    console.log("Battle encounter UI transition tests passed: zoom sequencing, opaque portrait reveal, gate release, and cancellation cleanup.");
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
